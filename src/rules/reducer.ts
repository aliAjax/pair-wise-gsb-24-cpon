// 规则层：把事件流归约成当前台账状态（纯函数）

import type { LedgerEvent } from "../data/events";
import type {
  Conclusion,
  ConclusionSnapshot,
  Feature,
  LayerRecord,
  LedgerState,
  Specimen,
  SpecimenSnapshot,
} from "../data/types";

export const EMPTY_STATE: LedgerState = { layers: {}, specimens: {}, closures: {} };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyPatch(base: ConclusionSnapshot, patch: Partial<ConclusionSnapshot>): ConclusionSnapshot {
  return {
    openingDepth: patch.openingDepth ?? base.openingDepth,
    summary: patch.summary ?? base.summary,
    features: patch.features ? clone(patch.features) : clone(base.features),
  };
}

function getOrInitLayer(state: LedgerState, layerId: string): LayerRecord {
  let layer = state.layers[layerId];
  if (!layer) {
    layer = { id: layerId, code: "", siteId: "", squareId: "", creatorId: "", createdAt: 0, observations: [] };
    state.layers[layerId] = layer;
  }
  return layer;
}

export function reduce(state: LedgerState, event: LedgerEvent): LedgerState {
  const next: LedgerState = {
    layers: clone(state.layers),
    specimens: clone(state.specimens),
    closures: clone(state.closures),
  };

  switch (event.type) {
    case "layer_created": {
      const layer: LayerRecord = {
        id: event.layerId,
        code: event.code,
        siteId: event.siteId,
        squareId: event.squareId,
        creatorId: event.by,
        createdAt: event.at,
        observations: [],
        conclusion: {
          id: event.conclusionId,
          authorId: event.by,
          at: event.at,
          updatedAt: event.at,
          submitted: false,
          corrections: [],
          ...clone(event.draft),
        },
      };
      next.layers[event.layerId] = layer;
      break;
    }

    case "draft_updated": {
      const layer = getOrInitLayer(next, event.layerId);
      if (!layer.conclusion) break;
      const merged = applyPatch(layer.conclusion, event.patch);
      layer.conclusion = {
        ...layer.conclusion,
        ...merged,
        updatedAt: event.at,
      };
      break;
    }

    case "conclusion_submitted": {
      const layer = next.layers[event.layerId];
      if (layer?.conclusion && !layer.conclusion.submitted) {
        layer.conclusion.submitted = true;
        layer.conclusion.submittedAt = event.at;
      }
      break;
    }

    case "observation_added": {
      const layer = getOrInitLayer(next, event.layerId);
      layer.observations.push({ id: event.observationId, at: event.at, authorId: event.by, text: event.text });
      break;
    }

    case "record_corrected": {
      const layer = next.layers[event.layerId];
      if (!layer?.conclusion) break;
      layer.conclusion.corrections.push({
        id: event.correctionId,
        at: event.at,
        by: event.by,
        reason: event.reason,
        before: clone(event.before),
        after: clone(event.after),
      });
      const conclusion: Conclusion = layer.conclusion;
      conclusion.openingDepth = event.after.openingDepth;
      conclusion.summary = event.after.summary;
      conclusion.features = clone(event.after.features) as Feature[];
      conclusion.updatedAt = event.at;
      break;
    }

    case "specimen_registered": {
      const specimen: Specimen = {
        id: event.specimenId,
        code: event.code,
        siteId: event.siteId,
        squareId: event.squareId,
        layerId: event.layerId,
        registeredBy: event.by,
        registeredAt: event.at,
        status: "unhanded",
        corrections: [],
        ...clone(event.input),
      };
      next.specimens[event.specimenId] = specimen;
      break;
    }

    case "specimen_handed": {
      for (const id of event.specimenIds) {
        const s = next.specimens[id];
        if (s && s.status === "unhanded") {
          s.status = "handed";
          s.handedAt = event.at;
          s.handedBy = event.by;
          s.receiverId = event.receiverId;
        }
      }
      break;
    }

    case "specimen_returned": {
      for (const id of event.specimenIds) {
        const s = next.specimens[id];
        if (s && s.status === "handed") {
          s.status = "returned";
          s.returnedAt = event.at;
        }
      }
      break;
    }

    case "specimen_corrected": {
      const s = next.specimens[event.specimenId];
      if (!s) break;
      s.corrections.push({
        id: event.correctionId,
        at: event.at,
        by: event.by,
        reason: event.reason,
        before: clone(event.before),
        after: clone(event.after),
      });
      s.name = event.after.name;
      s.qty = event.after.qty;
      s.coord = event.after.coord;
      break;
    }

    case "site_closed": {
      next.closures[event.siteId] = { at: event.at, by: event.by };
      break;
    }

    case "site_reopened": {
      delete next.closures[event.siteId];
      break;
    }
  }

  return next;
}

export function reduceAll(events: LedgerEvent[]): LedgerState {
  return events.reduce<LedgerState>((acc, ev) => reduce(acc, ev), EMPTY_STATE);
}
