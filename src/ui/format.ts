// 页面层：中文展示与事件描述（追溯日志人看得懂的文案）

import type { LedgerEvent } from "../data/events";
import { PEOPLE, SITES, SQUARES } from "../data/reference";
import type { LedgerState, SpecimenStatus } from "../data/types";
import { siteName, squareName } from "../rules/selectors";

export function personName(id: string): string {
  return PEOPLE.find((p) => p.id === id)?.name ?? id;
}

export const ROLE_LABEL: Record<string, string> = {
  member: "发掘队员",
  cataloger: "资料整理员",
  leader: "领队",
};

export const SPECIMEN_STATUS_LABEL: Record<SpecimenStatus, string> = {
  unhanded: "未交接",
  handed: "待整理",
  returned: "已交回",
};

export function formatTime(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function describeEvent(event: LedgerEvent, state: LedgerState): string {
  const layer = "layerId" in event ? state.layers[event.layerId] : undefined;
  const where = layer ? `${siteName(layer.siteId)} ${squareName(layer.squareId)} ${layer.code}` : "";

  switch (event.type) {
    case "layer_created":
      return `登记 ${where}：开口深度 ${event.draft.openingDepth}，建草稿结论`;
    case "draft_updated":
      return `更新 ${where} 的草稿结论`;
    case "conclusion_submitted":
      return `交接提交 ${where} 的结论（锁定，他人不得修改）`;
    case "observation_added":
      return `在 ${where} 补充观察：${event.text}`;
    case "record_corrected":
      return `校正 ${where} 已交结论；原因：${event.reason}`;
    case "specimen_registered":
      return `登记标本 ${event.code}：${event.input.name} ${event.input.qty} 件（${where}）`;
    case "specimen_handed":
      return `交接标本 ${event.specimenIds.length} 条给 ${personName(event.receiverId)}：${event.specimenIds
        .map((id) => state.specimens[id]?.code ?? id)
        .join("、")}`;
    case "specimen_returned":
      return `整理后交回入库 ${event.specimenIds.length} 条：${event.specimenIds
        .map((id) => state.specimens[id]?.code ?? id)
        .join("、")}`;
    case "specimen_corrected": {
      const s = state.specimens[event.specimenId];
      return `校正标本 ${s?.code ?? event.specimenId}（${event.before.qty}→${event.after.qty} 件）；原因：${event.reason}`;
    }
    case "site_closed":
      return `宣布 ${SITES.find((x) => x.id === event.siteId)?.name ?? event.siteId} 收官`;
    case "site_reopened":
      return `重开 ${SITES.find((x) => x.id === event.siteId)?.name ?? event.siteId}`;
  }
}
