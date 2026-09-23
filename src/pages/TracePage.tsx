// 追溯页：校正留痕（原记录 + 新记录 + 原因）与全部操作日志

import { Badge, Empty } from "../components/ui";
import type { Workbench } from "../store";
import { fmtTime } from "../utils";

const ACTION_LABEL: Record<string, string> = {
  save_draft: "暂存草稿",
  submit_record: "提交结论",
  add_observation: "补充观察",
  correct_record: "校正记录",
  register_specimen: "登记标本",
  handover_specimen: "交接标本",
  correct_specimen: "校正标本",
  close_site: "宣布收官",
  reopen_site: "撤销收官",
};

export function TracePage({ wb }: { wb: Workbench }) {
  const { db } = wb;
  const unitCode = (unitId: string) => db.units.find((u) => u.id === unitId)?.code ?? "?";

  const recordRevisions = db.records
    .filter((r) => r.revisions.length > 0)
    .flatMap((r) => r.revisions.map((v) => ({ rec: r, rev: v })));
  const specimenCorrections = db.specimens
    .filter((s) => s.corrections.length > 0)
    .flatMap((s) => s.corrections.map((c) => ({ sp: s, corr: c })));

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>校正留痕</p>
            <h2>地层记录校正（{recordRevisions.length}）</h2>
          </div>
        </div>
        {recordRevisions.length === 0 && <Empty text="还没有校正过地层记录。" />}
        {recordRevisions.map(({ rec, rev }) => (
          <article key={rev.id} className="trace-card">
            <div className="record-head">
              <strong>
                {unitCode(rec.unitId)} · {rec.layer}
              </strong>
              <Badge tone="warn">校正</Badge>
              <span className="muted">
                {rev.curatorName} · {fmtTime(rev.createdAt)}
              </span>
            </div>
            <p className="reason">原因：{rev.reason}</p>
            <div className="diff-grid">
              <div>
                <h4>原记录</h4>
                <p>开口深度 {rev.before.openingDepth || "—"}</p>
                <p>遗迹 {rev.before.features || "—"}</p>
                <p>结论 {rev.before.conclusion || "—"}</p>
              </div>
              <div>
                <h4>校正后</h4>
                <p>开口深度 {rev.after.openingDepth || "—"}</p>
                <p>遗迹 {rev.after.features || "—"}</p>
                <p>结论 {rev.after.conclusion || "—"}</p>
              </div>
            </div>
          </article>
        ))}

        <div className="section-heading" style={{ marginTop: 24 }}>
          <div>
            <p>校正留痕</p>
            <h2>标本校正（{specimenCorrections.length}）</h2>
          </div>
        </div>
        {specimenCorrections.length === 0 && <Empty text="还没有校正过标本。" />}
        {specimenCorrections.map(({ sp, corr }) => (
          <article key={corr.id} className="trace-card">
            <div className="record-head">
              <strong>
                {sp.name} · {unitCode(sp.unitId)} {sp.layer}
              </strong>
              <Badge tone="warn">校正</Badge>
              <span className="muted">
                {corr.curatorName} · {fmtTime(corr.createdAt)}
              </span>
            </div>
            <p className="reason">原因：{corr.reason}</p>
            <div className="diff-grid">
              <div>
                <h4>原记录</h4>
                <p>
                  {corr.before.name} · {corr.before.layer} · ×{corr.before.quantity}
                </p>
              </div>
              <div>
                <h4>校正后</h4>
                <p>
                  {corr.after.name} · {corr.after.layer} · ×{corr.after.quantity}
                </p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>操作日志</p>
            <h2>全部动作（{db.audit.length}）</h2>
          </div>
        </div>
        {db.audit.length === 0 && <Empty text="暂无操作。" />}
        <ul className="timeline">
          {db.audit.map((ev) => (
            <li key={ev.id}>
              <Badge tone={ev.role === "curator" ? "curator" : "member"}>
                {ACTION_LABEL[ev.action] ?? ev.action}
              </Badge>
              <div>
                <p>{ev.summary}</p>
                <span className="muted">
                  {ev.actorName} · {fmtTime(ev.at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
