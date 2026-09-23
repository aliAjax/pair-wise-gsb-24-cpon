// 规则层：派生查询。所有数量、待办、收官判定都从台账状态现算，不另存副本。

import type { LedgerState, Site, Specimen } from "../data/types";
import { SITES, SQUARES } from "../data/reference";

export interface SpecimenCounts {
  total: number; // 在库数量（件）：登记增、交回后保留、校正后按最新值
  registered: number; // 登记批次条数
  unhanded: number; // 未交接（队员手上，待整理流程开始）
  handed: number; // 已交接待整理（整理员手上）
  returned: number; // 已交回入库
  pending: number; // 未处理 = 未交接 + 已交接待整理
}

export function countSpecimens(list: Specimen[]): SpecimenCounts {
  const counts: SpecimenCounts = { total: 0, registered: list.length, unhanded: 0, handed: 0, returned: 0, pending: 0 };
  for (const s of list) {
    counts.total += Number(s.qty) || 0;
    if (s.status === "unhanded") counts.unhanded += 1;
    if (s.status === "handed") counts.handed += 1;
    if (s.status === "returned") counts.returned += 1;
    if (s.status !== "returned") counts.pending += 1;
  }
  return counts;
}

export function specimensAt(state: LedgerState, siteId?: string, squareId?: string): Specimen[] {
  return Object.values(state.specimens).filter(
    (s) => (!siteId || s.siteId === siteId) && (!squareId || s.squareId === squareId),
  );
}

export function layersAt(state: LedgerState, siteId?: string, squareId?: string) {
  return Object.values(state.layers)
    .filter((l) => (!siteId || l.siteId === siteId) && (!squareId || l.squareId === squareId))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function squareName(squareId: string): string {
  return SQUARES.find((q) => q.id === squareId)?.name ?? squareId;
}

export function siteName(siteId: string): string {
  return SITES.find((s) => s.id === siteId)?.name ?? siteId;
}

export interface SiteStatus {
  site: Site;
  closed: boolean;
  pending: number; // 未处理标本条数
  pendingQty: number; // 未处理标本件数
  counts: SpecimenCounts;
  canClose: boolean;
  blockReason?: string;
}

export function siteStatuses(state: LedgerState): SiteStatus[] {
  return SITES.map((site) => {
    const list = specimensAt(state, site.id);
    const counts = countSpecimens(list);
    const closed = Boolean(state.closures[site.id]);
    const pending = counts.pending;
    const pendingQty = list
      .filter((s) => s.status !== "returned")
      .reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
    return {
      site,
      closed,
      pending,
      pendingQty,
      counts,
      // 收官闸口：遗址还有未处理标本（未交接或待整理）就不能宣布收官
      canClose: pending === 0,
      blockReason: pending > 0 ? `还有 ${pending} 条 / ${pendingQty} 件标本未处理（未交接或待整理）` : undefined,
    };
  });
}

export function dashboardMetrics(state: LedgerState) {
  const sites = SITES.length;
  const squares = SQUARES.length;
  const layers = Object.keys(state.layers).length;
  const all = Object.values(state.specimens);
  const counts = countSpecimens(all);
  const uncorrectedLayers = Object.values(state.layers).filter((l) => !l.conclusion?.submitted).length;
  return { sites, squares, layers, counts, uncorrectedLayers };
}
