// 规则层：命令。校验权限与输入，通过后生成台账事件；不合法的操作直接抛错，绝不落账。

import type {
  ConclusionSubmittedEvent,
  DraftUpdatedEvent,
  LayerCreatedEvent,
  LedgerEvent,
  ObservationAddedEvent,
  RecordCorrectedEvent,
  SiteClosedEvent,
  SiteReopenedEvent,
  SpecimenCorrectedEvent,
  SpecimenHandedEvent,
  SpecimenRegisteredEvent,
  SpecimenReturnedEvent,
} from "../data/events";
import { SQUARES } from "../data/reference";
import type { ConclusionSnapshot, FeatureInput, LayerRecord, LedgerState, Person, Specimen, SpecimenSnapshot } from "../data/types";
import {
  canAddObservation,
  canCloseSite,
  canCorrectRecord,
  canCorrectSpecimen,
  canCreateLayer,
  canEditDraft,
  canHandOver,
  canRegisterSpecimen,
  canReopenSite,
  canReturn,
  canSubmit,
} from "./permissions";
import { specimensAt } from "./selectors";

export interface CommandContext {
  now: () => number;
  id: (prefix: string) => string;
}

const defaultContext: CommandContext = {
  now: () => Date.now(),
  id: (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`,
};

function base<E extends LedgerEvent>(
  event: Omit<E, "id" | "at"> & { by: string },
  ctx: CommandContext,
): E {
  return { id: ctx.id("ev"), at: ctx.now(), ...(event as object) } as E;
}

function requireText(value: string, label: string): string {
  const v = value.trim();
  if (!v) throw new Error(`请填写${label}`);
  return v;
}

function snapshotOf(layer: LayerRecord): ConclusionSnapshot {
  const c = layer.conclusion!;
  return {
    openingDepth: c.openingDepth,
    summary: c.summary,
    features: c.features.map((f) => ({ ...f })),
  };
}

export const commands = {
  createLayer(
    state: LedgerState,
    person: Person,
    input: { siteId: string; squareId: string; code: string; openingDepth: string; summary: string; features: FeatureInput[] },
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const d = canCreateLayer(person);
    if (!d.ok) throw new Error(d.reason);

    const square = SQUARES.find((q) => q.id === input.squareId && q.siteId === input.siteId);
    if (!square) throw new Error("请选择有效的遗址和探方");
    const code = requireText(input.code, "地层编号（如 第3层）");
    const depth = requireText(input.openingDepth, "开口深度");
    const summary = requireText(input.summary, "地层小结");
    const duplicate = Object.values(state.layers).some((l) => l.squareId === input.squareId && l.code === code);
    if (duplicate) throw new Error(`该探方已存在 ${code} 的记录`);

    const layerId = ctx.id("l");
    const draft: ConclusionSnapshot = {
      openingDepth: depth,
      summary,
      features: input.features
        .filter((f) => f.code.trim())
        .map((f) => ({
          id: ctx.id("f"),
          code: f.code.trim(),
          kind: f.kind,
          soil: f.soil.trim(),
          note: f.note.trim(),
        })),
    };
    return [
      base<LayerCreatedEvent>(
        {
          type: "layer_created",
          by: person.id,
          layerId,
          siteId: input.siteId,
          squareId: input.squareId,
          code,
          conclusionId: ctx.id("c"),
          draft,
        },
        ctx,
      ),
    ];
  },

  updateDraft(
    state: LedgerState,
    person: Person,
    layerId: string,
    patch: Partial<ConclusionSnapshot>,
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const layer = state.layers[layerId];
    if (!layer) throw new Error("地层记录不存在");
    const d = canEditDraft(person, layer);
    if (!d.ok) throw new Error(d.reason);
    if (patch.openingDepth !== undefined && !patch.openingDepth.trim()) throw new Error("开口深度不能为空");
    if (patch.summary !== undefined && !patch.summary.trim()) throw new Error("地层小结不能为空");
    return [base<DraftUpdatedEvent>({ type: "draft_updated", by: person.id, layerId, patch }, ctx)];
  },

  submitConclusion(state: LedgerState, person: Person, layerId: string, ctx: CommandContext = defaultContext): LedgerEvent[] {
    const layer = state.layers[layerId];
    if (!layer) throw new Error("地层记录不存在");
    const d = canSubmit(person, layer);
    if (!d.ok) throw new Error(d.reason);
    return [base<ConclusionSubmittedEvent>({ type: "conclusion_submitted", by: person.id, layerId }, ctx)];
  },

  addObservation(
    state: LedgerState,
    person: Person,
    layerId: string,
    text: string,
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const layer = state.layers[layerId];
    if (!layer) throw new Error("地层记录不存在");
    const d = canAddObservation(person, layer);
    if (!d.ok) throw new Error(d.reason);
    const clean = requireText(text, "观察内容");
    return [
      base<ObservationAddedEvent>(
        {
          type: "observation_added",
          by: person.id,
          layerId,
          observationId: ctx.id("o"),
          text: clean,
        },
        ctx,
      ),
    ];
  },

  correctRecord(
    state: LedgerState,
    person: Person,
    layerId: string,
    input: { reason: string; after: ConclusionSnapshot },
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const layer = state.layers[layerId];
    if (!layer) throw new Error("地层记录不存在");
    const d = canCorrectRecord(person, layer);
    if (!d.ok) throw new Error(d.reason);
    const reason = requireText(input.reason, "校正原因");
    if (!input.after.openingDepth.trim()) throw new Error("校正后的开口深度不能为空");
    if (!input.after.summary.trim()) throw new Error("校正后的地层小结不能为空");
    return [
      base<RecordCorrectedEvent>(
        {
          type: "record_corrected",
          by: person.id,
          layerId,
          correctionId: ctx.id("rc"),
          reason,
          before: snapshotOf(layer),
          after: {
            openingDepth: input.after.openingDepth.trim(),
            summary: input.after.summary.trim(),
            features: input.after.features
              .filter((f) => f.code.trim())
              .map((f) => ({ id: f.id || ctx.id("f"), code: f.code.trim(), kind: f.kind, soil: f.soil.trim(), note: f.note.trim() })),
          },
        },
        ctx,
      ),
    ];
  },

  registerSpecimen(
    state: LedgerState,
    person: Person,
    input: { layerId: string; name: string; qty: number; coord: string },
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const layer = state.layers[input.layerId];
    if (!layer) throw new Error("地层记录不存在");
    const d = canRegisterSpecimen(person, layer);
    if (!d.ok) throw new Error(d.reason);
    const name = requireText(input.name, "标本名称");
    const qty = Math.floor(Number(input.qty));
    if (!qty || qty <= 0) throw new Error("标本数量必须是大于 0 的整数");
    const coord = requireText(input.coord, "出土坐标");

    const sameLayer = specimensAt(state, layer.siteId, layer.squareId).filter((s) => s.layerId === layer.id);
    const seq = sameLayer.length + 1;
    const squareName = SQUARES.find((q) => q.id === layer.squareId)?.name ?? layer.squareId;
    const sitePrefix = layer.siteId === "s-dg" ? "DG" : "XHW";
    const layerNo = layer.code.replace(/^第|层$/g, "");
    const code = `${sitePrefix}-${squareName}-${layerNo}:${String(seq).padStart(3, "0")}`;

    return [
      base<SpecimenRegisteredEvent>(
        {
          type: "specimen_registered",
          by: person.id,
          specimenId: ctx.id("sp"),
          code,
          siteId: layer.siteId,
          squareId: layer.squareId,
          layerId: layer.id,
          input: { name, qty, coord },
        },
        ctx,
      ),
    ];
  },

  handOver(
    state: LedgerState,
    person: Person,
    specimenIds: string[],
    receiverId: string,
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const specimens = specimenIds.map((id) => state.specimens[id]).filter(Boolean);
    const d = canHandOver(person, specimens);
    if (!d.ok) throw new Error(d.reason);
    if (!receiverId) throw new Error("请选择接收的整理员");
    return [base<SpecimenHandedEvent>({ type: "specimen_handed", by: person.id, specimenIds, receiverId }, ctx)];
  },

  returnSpecimens(state: LedgerState, person: Person, specimenIds: string[], ctx: CommandContext = defaultContext): LedgerEvent[] {
    const specimens = specimenIds.map((id) => state.specimens[id]).filter(Boolean);
    const d = canReturn(person, specimens);
    if (!d.ok) throw new Error(d.reason);
    return [base<SpecimenReturnedEvent>({ type: "specimen_returned", by: person.id, specimenIds }, ctx)];
  },

  correctSpecimen(
    state: LedgerState,
    person: Person,
    specimenId: string,
    input: { reason: string; after: SpecimenSnapshot },
    ctx: CommandContext = defaultContext,
  ): LedgerEvent[] {
    const specimen: Specimen | undefined = state.specimens[specimenId];
    if (!specimen) throw new Error("标本不存在");
    const d = canCorrectSpecimen(person, specimen);
    if (!d.ok) throw new Error(d.reason);
    const reason = requireText(input.reason, "校正原因");
    const name = requireText(input.after.name, "标本名称");
    const qty = Math.floor(Number(input.after.qty));
    if (!qty || qty <= 0) throw new Error("校正后数量必须是大于 0 的整数");
    const coord = requireText(input.after.coord, "出土坐标");
    return [
      base<SpecimenCorrectedEvent>(
        {
          type: "specimen_corrected",
          by: person.id,
          specimenId,
          correctionId: ctx.id("sc"),
          reason,
          before: { name: specimen.name, qty: specimen.qty, coord: specimen.coord },
          after: { name, qty, coord },
        },
        ctx,
      ),
    ];
  },

  closeSite(state: LedgerState, person: Person, siteId: string, ctx: CommandContext = defaultContext): LedgerEvent[] {
    const d = canCloseSite(person, state, siteId);
    if (!d.ok) throw new Error(d.reason);
    return [base<SiteClosedEvent>({ type: "site_closed", by: person.id, siteId }, ctx)];
  },

  reopenSite(state: LedgerState, person: Person, siteId: string, ctx: CommandContext = defaultContext): LedgerEvent[] {
    const d = canReopenSite(person, state, siteId);
    if (!d.ok) throw new Error(d.reason);
    return [base<SiteReopenedEvent>({ type: "site_reopened", by: person.id, siteId }, ctx)];
  },
};
