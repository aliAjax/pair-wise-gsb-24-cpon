// 页面层：收官闸口。遗址还有未处理标本就不能宣布收官；已收官可由领队重开。

import type { LedgerEvent } from "../data/events";
import type { LedgerState, Person } from "../data/types";
import { layersAt, siteStatuses } from "../rules/selectors";
import { commands } from "../rules/commands";
import { formatTime, personName } from "./format";
import type { CommitResult } from "./useLedger";

export function ClosureTab({
  state,
  person,
  run,
}: {
  state: LedgerState;
  person: Person;
  run: (make: () => LedgerEvent[]) => CommitResult;
}) {
  const statuses = siteStatuses(state);

  return (
    <div className="tab-body">
      {person.role !== "leader" && (
        <div className="alert info">收官由领队宣布。当前身份「{person.name}」可查看各遗址是否具备收官条件。</div>
      )}
      <div className="closure-grid">
        {statuses.map((s) => {
          const layerCount = layersAt(state, s.site.id).length;
          const closure = state.closures[s.site.id];
          return (
            <article key={s.site.id} className={`panel closure-card ${s.closed ? "is-closed" : ""}`}>
              <header>
                <h3>{s.site.name}</h3>
                {s.closed ? (
                  <span className="tag tag-closed">已收官</span>
                ) : s.canClose ? (
                  <span className="tag tag-ready">具备收官条件</span>
                ) : (
                  <span className="tag tag-blocked">不能收官</span>
                )}
              </header>
              <dl className="stat-list">
                <div><dt>地层记录</dt><dd>{layerCount}</dd></div>
                <div><dt>未交接</dt><dd>{s.counts.unhanded} 条</dd></div>
                <div><dt>待整理</dt><dd>{s.counts.handed} 条</dd></div>
                <div><dt>已交回入库</dt><dd>{s.counts.returned} 条</dd></div>
                <div><dt>未处理合计</dt><dd className={s.pending > 0 ? "num-danger" : "num-ok"}>{s.pending} 条 / {s.pendingQty} 件</dd></div>
                <div><dt>标本件数（含校正）</dt><dd>{s.counts.total} 件</dd></div>
              </dl>
              {!s.closed && s.blockReason && (
                <p className="block-reason">⛔ {s.blockReason}</p>
              )}
              {closure && (
                <p className="meta">{personName(closure.by)} 于 {formatTime(closure.at)} 宣布收官</p>
              )}
              <div className="form-actions">
                {!s.closed && (
                  <button
                    className="primary-action"
                    disabled={person.role !== "leader" || !s.canClose}
                    title={person.role !== "leader" ? "只有领队能宣布收官" : s.blockReason}
                    onClick={() => run(() => commands.closeSite(state, person, s.site.id))}
                  >
                    宣布收官
                  </button>
                )}
                {s.closed && (
                  <button
                    disabled={person.role !== "leader"}
                    title={person.role !== "leader" ? "只有领队能重开遗址" : ""}
                    onClick={() => run(() => commands.reopenSite(state, person, s.site.id))}
                  >
                    重开遗址
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
