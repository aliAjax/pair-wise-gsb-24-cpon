// 规则层：角色权限。同层多人时队员只能补充观察，不能改别人已交的结论。

import type { LayerRecord, LedgerState, Person, Specimen } from "../data/types";

export interface Decision {
  ok: boolean;
  reason?: string;
}

export const allow = (): Decision => ({ ok: true });
export const deny = (reason: string): Decision => ({ ok: false, reason });

export function canCreateLayer(person: Person): Decision {
  if (person.role !== "member") return deny("只有发掘队员能登记地层记录");
  return allow();
}

export function canEditDraft(person: Person, layer: LayerRecord): Decision {
  if (person.role !== "member") return deny("地层草稿只能由发掘队员维护");
  if (!layer.conclusion) return deny("该地层没有草稿结论");
  if (layer.conclusion.authorId !== person.id) return deny("不能修改其他队员的记录，只能补充观察");
  if (layer.conclusion.submitted) return deny("结论已交接提交，不能直接修改；可请整理员校正");
  return allow();
}

export function canSubmit(person: Person, layer: LayerRecord): Decision {
  const base = canEditDraft(person, layer);
  if (!base.ok) return base;
  return allow();
}

export function canAddObservation(person: Person, layer: LayerRecord): Decision {
  if (person.role !== "member") return deny("现场观察由发掘队员补充");
  if (!layer.conclusion) return deny("该地层尚未建立记录");
  return allow();
}

export function canCorrectRecord(person: Person, layer: LayerRecord): Decision {
  if (person.role !== "cataloger") return deny("只有资料整理员能校正记录");
  if (!layer.conclusion?.submitted) return deny("只能校正队员已交接提交的结论（草稿请队员自行修改）");
  return allow();
}

export function canRegisterSpecimen(person: Person, layer: LayerRecord): Decision {
  if (person.role === "leader") return deny("领队不直接登记标本");
  if (!layer.conclusion) return deny("该地层尚未建立记录");
  return allow();
}

export function canHandOver(person: Person, specimens: Specimen[]): Decision {
  if (person.role !== "member") return deny("标本由发掘队员交接到整理台");
  const bad = specimens.filter((s) => s.status !== "unhanded");
  if (specimens.length === 0) return deny("没有选择标本");
  if (bad.length > 0) return deny("只能交接尚未交接的标本");
  return allow();
}

export function canReturn(person: Person, specimens: Specimen[]): Decision {
  if (person.role !== "cataloger") return deny("交回入库由资料整理员操作");
  if (specimens.length === 0) return deny("没有选择标本");
  const bad = specimens.filter((s) => s.status !== "handed");
  if (bad.length > 0) return deny("只能交回已在整理中的标本");
  return allow();
}

export function canCorrectSpecimen(person: Person, specimen: Specimen): Decision {
  if (person.role !== "cataloger") return deny("只有资料整理员能校正标本");
  return allow();
}

export function canCloseSite(person: Person, state: LedgerState, siteId: string): Decision {
  if (person.role !== "leader") return deny("只有领队能宣布遗址收官");
  if (state.closures[siteId]) return deny("该遗址已经收官");
  const pending = Object.values(state.specimens).filter(
    (s) => s.siteId === siteId && s.status !== "returned",
  );
  if (pending.length > 0) {
    const qty = pending.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
    return deny(`还有 ${pending.length} 条 / ${qty} 件标本未处理，不能收官`);
  }
  return allow();
}

export function canReopenSite(person: Person, state: LedgerState, siteId: string): Decision {
  if (person.role !== "leader") return deny("只有领队能重开遗址");
  if (!state.closures[siteId]) return deny("该遗址尚未收官");
  return allow();
}
