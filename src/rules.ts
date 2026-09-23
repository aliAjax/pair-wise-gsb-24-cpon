// 规则层：权限、校验、统计、收官判定。纯函数，不碰页面和存储。

import type {
  Database,
  LayerRecord,
  LayerSnapshot,
  Site,
  Specimen,
  SpecimenSnapshot,
  User,
} from "./data/types";

export interface LayerInput {
  siteId: string;
  unitId: string;
  layer: string;
  openingDepth: string;
  features: string;
  conclusion: string;
}

export interface SpecimenInput {
  siteId: string;
  unitId: string;
  layer: string;
  name: string;
  quantity: number;
}

export type Check = { ok: true } | { ok: false; error: string };

const fail = (error: string): Check => ({ ok: false, error });
const pass: Check = { ok: true };

/* ---------- 地层记录规则 ---------- */

/** 只有作者本人、且仍是草稿时才能改；已交的结论任何人都不能直接改 */
export function canEditRecord(rec: LayerRecord, user: User): boolean {
  return rec.status === "draft" && rec.authorId === user.id;
}

/** 已交结论开放补充观察（包括作者，作者此时也只能补观察） */
export function canObserve(rec: LayerRecord): boolean {
  return rec.status === "submitted";
}

/** 只有整理员能校正已交结论 */
export function canCorrectRecord(rec: LayerRecord, user: User): boolean {
  return rec.status === "submitted" && user.role === "curator";
}

/** 提交时必填；草稿只要求探方和地层，方便续记 */
export function validateLayerInput(input: LayerInput, submit: boolean): Check {
  if (!input.siteId || !input.unitId) return fail("请选择遗址和探方");
  if (!input.layer.trim()) return fail("请填写地层");
  if (submit) {
    if (!input.openingDepth.trim()) return fail("提交前请填写开口深度");
    if (!input.conclusion.trim()) return fail("提交前请填写结论");
  }
  return pass;
}

/** 整理员校正：必须写原因，且要有实际改动 */
export function validateRecordCorrection(
  rec: LayerRecord,
  user: User,
  patch: LayerSnapshot,
  reason: string
): Check {
  if (!canCorrectRecord(rec, user)) return fail("只有整理员能校正已交的结论");
  if (!reason.trim()) return fail("校正必须填写原因");
  const changed =
    patch.openingDepth !== rec.openingDepth ||
    patch.features !== rec.features ||
    patch.conclusion !== rec.conclusion;
  if (!changed) return fail("没有改动，无需校正");
  return pass;
}

/* ---------- 标本规则 ---------- */

export function validateSpecimenInput(input: SpecimenInput): Check {
  if (!input.siteId || !input.unitId) return fail("请选择遗址和探方");
  if (!input.layer.trim()) return fail("请填写地层");
  if (!input.name.trim()) return fail("请填写标本名称");
  if (!Number.isInteger(input.quantity) || input.quantity < 1)
    return fail("数量须为不小于 1 的整数");
  return pass;
}

export function canHandover(sp: Specimen): boolean {
  return sp.status === "pending";
}

export function validateSpecimenCorrection(
  sp: Specimen,
  user: User,
  patch: SpecimenSnapshot,
  reason: string
): Check {
  if (user.role !== "curator") return fail("只有整理员能校正标本");
  if (!reason.trim()) return fail("校正必须填写原因");
  if (!patch.name.trim()) return fail("标本名称不能为空");
  if (!patch.layer.trim()) return fail("地层不能为空");
  if (!Number.isInteger(patch.quantity) || patch.quantity < 1)
    return fail("数量须为不小于 1 的整数");
  const changed =
    patch.name !== sp.name || patch.layer !== sp.layer || patch.quantity !== sp.quantity;
  if (!changed) return fail("没有改动，无需校正");
  return pass;
}

/* ---------- 收官规则 ---------- */

export function pendingSpecimens(db: Database, siteId: string): Specimen[] {
  return db.specimens.filter((sp) => sp.siteId === siteId && sp.status === "pending");
}

/** 遗址还有未交接标本就不能宣布收官 */
export function canCloseSite(db: Database, site: Site, user: User): Check {
  if (user.role !== "curator") return fail("由整理员核对后宣布收官");
  if (site.closedAt) return fail("该遗址已收官");
  const pending = pendingSpecimens(db, site.id).length;
  if (pending > 0) return fail(`还有 ${pending} 条标本未交接，不能宣布收官`);
  return pass;
}

/* ---------- 统计（数量随登记、交回、校正实时推导） ---------- */

export interface SiteStats {
  units: number;
  records: number;
  drafts: number;
  specimenQty: number;
  pendingCount: number;
  pendingQty: number;
  handedQty: number;
}

export function siteStats(db: Database, siteId: string): SiteStats {
  const units = db.units.filter((u) => u.siteId === siteId);
  const records = db.records.filter((r) => r.siteId === siteId);
  const specimens = db.specimens.filter((sp) => sp.siteId === siteId);
  const sum = (list: Specimen[]) => list.reduce((acc, sp) => acc + sp.quantity, 0);
  const pending = specimens.filter((sp) => sp.status === "pending");
  const handed = specimens.filter((sp) => sp.status === "handed");
  return {
    units: units.length,
    records: records.length,
    drafts: records.filter((r) => r.status === "draft").length,
    specimenQty: sum(specimens),
    pendingCount: pending.length,
    pendingQty: sum(pending),
    handedQty: sum(handed),
  };
}

export function globalStats(db: Database): SiteStats {
  const sum = (list: Specimen[]) => list.reduce((acc, sp) => acc + sp.quantity, 0);
  const pending = db.specimens.filter((sp) => sp.status === "pending");
  const handed = db.specimens.filter((sp) => sp.status === "handed");
  return {
    units: db.units.length,
    records: db.records.length,
    drafts: db.records.filter((r) => r.status === "draft").length,
    specimenQty: sum(db.specimens),
    pendingCount: pending.length,
    pendingQty: sum(pending),
    handedQty: sum(handed),
  };
}
