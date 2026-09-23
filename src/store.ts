// 状态层：把规则与保存串起来，向页面提供动作。所有改动先过规则，再落盘。

import { useMemo, useState } from "react";
import type {
  AuditAction,
  Database,
  LayerSnapshot,
  SpecimenSnapshot,
  User,
} from "./data/types";
import {
  canEditRecord,
  canHandover,
  canObserve,
  canCloseSite,
  validateLayerInput,
  validateRecordCorrection,
  validateSpecimenCorrection,
  validateSpecimenInput,
  type Check,
  type LayerInput,
  type SpecimenInput,
} from "./rules";
import { loadDb, resetDb, saveDb } from "./storage";
import { now, uid } from "./utils";

export type Result = { ok: true } | { ok: false; error: string };

const toResult = (check: Check): Result => (check.ok ? { ok: true } : check);

export function useWorkbench() {
  const [db, setDb] = useState<Database>(loadDb);
  const [userId, setUserId] = useState<string>(() => loadDb().users[0]?.id ?? "");

  const user: User = useMemo(
    () => db.users.find((u) => u.id === userId) ?? db.users[0],
    [db, userId]
  );

  /** 统一入口：校验 → 变更 → 写日志 → 落盘 */
  const commit = (
    check: Check,
    mutate: (draft: Database) => void,
    audit?: { action: AuditAction; summary: string }
  ): Result => {
    if (!check.ok) return check;
    setDb((prev) => {
      const draft: Database = structuredClone(prev);
      mutate(draft);
      if (audit) {
        draft.audit.unshift({
          id: uid("a"),
          at: now(),
          actorId: user.id,
          actorName: user.name,
          role: user.role,
          action: audit.action,
          summary: audit.summary,
        });
      }
      saveDb(draft);
      return draft;
    });
    return { ok: true };
  };

  const actions = {
    /** 登记/续记地层记录；submit=true 表示直接提交结论 */
    saveRecord(input: LayerInput, recordId: string | null, submit: boolean): Result {
      const check = validateLayerInput(input, submit);
      if (!check.ok) return check;
      const existing = recordId ? db.records.find((r) => r.id === recordId) : null;
      if (recordId && !existing) return { ok: false, error: "记录不存在" };
      if (existing && !canEditRecord(existing, user))
        return { ok: false, error: "已交的结论不能再改，只能补充观察" };
      const unit = db.units.find((u) => u.id === input.unitId);
      return commit(
        { ok: true },
        (draft) => {
          const rec = existing
            ? draft.records.find((r) => r.id === existing.id)!
            : null;
          if (rec) {
            Object.assign(rec, input, {
              status: submit ? "submitted" : "draft",
              updatedAt: now(),
            });
          } else {
            draft.records.unshift({
              id: uid("r"),
              ...input,
              authorId: user.id,
              authorName: user.name,
              status: submit ? "submitted" : "draft",
              observations: [],
              revisions: [],
              createdAt: now(),
              updatedAt: now(),
            });
          }
        },
        {
          action: submit ? "submit_record" : "save_draft",
          summary: `${submit ? "提交" : "暂存"} ${unit?.code ?? ""} ${input.layer} 记录`,
        }
      );
    },

    /** 同层多人时，队员对他人已交结论只能补充观察 */
    addObservation(recordId: string, text: string): Result {
      const rec = db.records.find((r) => r.id === recordId);
      if (!rec) return { ok: false, error: "记录不存在" };
      if (!canObserve(rec)) return { ok: false, error: "草稿暂不接受观察，待提交后再补" };
      if (!text.trim()) return { ok: false, error: "请填写观察内容" };
      const unit = db.units.find((u) => u.id === rec.unitId);
      return commit(
        { ok: true },
        (draft) => {
          const target = draft.records.find((r) => r.id === recordId)!;
          target.observations.push({
            id: uid("o"),
            authorId: user.id,
            authorName: user.name,
            text: text.trim(),
            createdAt: now(),
          });
          target.updatedAt = now();
        },
        {
          action: "add_observation",
          summary: `补充观察：${unit?.code ?? ""} ${rec.layer}（${rec.authorName}的结论）`,
        }
      );
    },

    /** 整理员校正：必须写原因，原记录进 revisions 留痕 */
    correctRecord(recordId: string, patch: LayerSnapshot, reason: string): Result {
      const rec = db.records.find((r) => r.id === recordId);
      if (!rec) return { ok: false, error: "记录不存在" };
      const check = validateRecordCorrection(rec, user, patch, reason);
      if (!check.ok) return check;
      const unit = db.units.find((u) => u.id === rec.unitId);
      return commit(
        { ok: true },
        (draft) => {
          const target = draft.records.find((r) => r.id === recordId)!;
          target.revisions.push({
            id: uid("v"),
            curatorId: user.id,
            curatorName: user.name,
            reason: reason.trim(),
            before: {
              openingDepth: target.openingDepth,
              features: target.features,
              conclusion: target.conclusion,
            },
            after: { ...patch },
            createdAt: now(),
          });
          Object.assign(target, patch, { updatedAt: now() });
        },
        {
          action: "correct_record",
          summary: `校正 ${unit?.code ?? ""} ${rec.layer} 结论（原记录已保留）`,
        }
      );
    },

    registerSpecimen(input: SpecimenInput): Result {
      const check = validateSpecimenInput(input);
      if (!check.ok) return check;
      const unit = db.units.find((u) => u.id === input.unitId);
      return commit(
        { ok: true },
        (draft) => {
          draft.specimens.unshift({
            id: uid("p"),
            ...input,
            name: input.name.trim(),
            layer: input.layer.trim(),
            status: "pending",
            registeredById: user.id,
            registeredByName: user.name,
            registeredAt: now(),
            handedAt: null,
            receiverName: null,
            corrections: [],
          });
        },
        {
          action: "register_specimen",
          summary: `登记标本 ${input.name} ×${input.quantity}（${unit?.code ?? ""} ${input.layer}）`,
        }
      );
    },

    /** 交回标本：待交接 → 已交接，数量统计随之变化 */
    handoverSpecimen(specimenId: string): Result {
      const sp = db.specimens.find((s) => s.id === specimenId);
      if (!sp) return { ok: false, error: "标本不存在" };
      if (!canHandover(sp)) return { ok: false, error: "该标本已交接" };
      const unit = db.units.find((u) => u.id === sp.unitId);
      return commit(
        { ok: true },
        (draft) => {
          const target = draft.specimens.find((s) => s.id === specimenId)!;
          target.status = "handed";
          target.handedAt = now();
          target.receiverName = user.name;
        },
        {
          action: "handover_specimen",
          summary: `交接标本 ${sp.name} ×${sp.quantity}（${unit?.code ?? ""} ${sp.layer}）`,
        }
      );
    },

    correctSpecimen(specimenId: string, patch: SpecimenSnapshot, reason: string): Result {
      const sp = db.specimens.find((s) => s.id === specimenId);
      if (!sp) return { ok: false, error: "标本不存在" };
      const check = validateSpecimenCorrection(sp, user, patch, reason);
      if (!check.ok) return check;
      return commit(
        { ok: true },
        (draft) => {
          const target = draft.specimens.find((s) => s.id === specimenId)!;
          target.corrections.push({
            id: uid("c"),
            curatorId: user.id,
            curatorName: user.name,
            reason: reason.trim(),
            before: { name: target.name, layer: target.layer, quantity: target.quantity },
            after: { ...patch },
            createdAt: now(),
          });
          Object.assign(target, patch);
        },
        {
          action: "correct_specimen",
          summary: `校正标本 ${sp.name}：数量 ${sp.quantity} → ${patch.quantity}`,
        }
      );
    },

    /** 宣布收官：规则层保证有未交接标本时到不了这里 */
    closeSite(siteId: string): Result {
      const site = db.sites.find((s) => s.id === siteId);
      if (!site) return { ok: false, error: "遗址不存在" };
      const check = canCloseSite(db, site, user);
      if (!check.ok) return check;
      return commit(
        { ok: true },
        (draft) => {
          draft.sites.find((s) => s.id === siteId)!.closedAt = now();
        },
        { action: "close_site", summary: `宣布 ${site.name} 收官` }
      );
    },

    reopenSite(siteId: string): Result {
      const site = db.sites.find((s) => s.id === siteId);
      if (!site) return { ok: false, error: "遗址不存在" };
      if (user.role !== "curator") return { ok: false, error: "由整理员操作" };
      if (!site.closedAt) return { ok: false, error: "该遗址未收官" };
      return commit(
        { ok: true },
        (draft) => {
          draft.sites.find((s) => s.id === siteId)!.closedAt = null;
        },
        { action: "reopen_site", summary: `撤销 ${site.name} 收官` }
      );
    },

    resetAll(): void {
      setDb(resetDb());
    },
  };

  return { db, user, userId, setUserId, actions };
}

export type Workbench = ReturnType<typeof useWorkbench>;
