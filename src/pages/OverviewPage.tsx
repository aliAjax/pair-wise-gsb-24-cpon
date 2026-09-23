// 总览页：指标随登记/交回/校正实时变化；遗址收官受未交接标本约束

import { useState } from "react";
import { canCloseSite, globalStats, siteStats } from "../rules";
import type { Workbench } from "../store";
import { fmtTime } from "../utils";
import { Badge } from "../components/ui";

export function OverviewPage({ wb }: { wb: Workbench }) {
  const { db, user, actions } = wb;
  const stats = globalStats(db);
  const [message, setMessage] = useState("");

  const tryClose = (siteId: string) => {
    const res = actions.closeSite(siteId);
    setMessage(res.ok ? "已宣布收官" : res.error);
  };

  return (
    <>
      <section className="metrics-grid">
        <article className="metric-card">
          <span>探方数</span>
          <strong>{stats.units}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>地层记录（含草稿 {stats.drafts}）</span>
          <strong>{stats.records}</strong>
          <i className="status-watch" />
        </article>
        <article className="metric-card">
          <span>标本总件数</span>
          <strong>{stats.specimenQty}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>待交接标本（{stats.pendingCount} 条）</span>
          <strong>{stats.pendingQty}</strong>
          <i className={stats.pendingQty > 0 ? "status-danger" : "status-ok"} />
        </article>
      </section>

      {message && <p className="notice">{message}</p>}

      <section className="site-grid">
        {db.sites.map((site) => {
          const st = siteStats(db, site.id);
          const closed = Boolean(site.closedAt);
          const check = canCloseSite(db, site, user);
          return (
            <article key={site.id} className="panel site-card">
              <div className="section-heading">
                <div>
                  <p>遗址</p>
                  <h2>{site.name}</h2>
                </div>
                {closed ? <Badge tone="done">已收官</Badge> : <Badge tone="open">进行中</Badge>}
              </div>
              <dl className="stat-list">
                <div>
                  <dt>探方</dt>
                  <dd>{st.units}</dd>
                </div>
                <div>
                  <dt>地层记录</dt>
                  <dd>
                    {st.records}（草稿 {st.drafts}）
                  </dd>
                </div>
                <div>
                  <dt>标本件数</dt>
                  <dd>{st.specimenQty}</dd>
                </div>
                <div>
                  <dt>待交接</dt>
                  <dd className={st.pendingCount > 0 ? "text-danger" : ""}>
                    {st.pendingCount} 条 / {st.pendingQty} 件
                  </dd>
                </div>
                <div>
                  <dt>已交接</dt>
                  <dd>{st.handedQty} 件</dd>
                </div>
              </dl>
              {closed && <p className="muted">收官时间：{fmtTime(site.closedAt!)}</p>}
              {user.role === "curator" && (
                <div className="row-actions">
                  {!closed ? (
                    <button
                      className="primary-action"
                      disabled={!check.ok}
                      title={check.ok ? "核对无误，宣布收官" : check.error}
                      onClick={() => tryClose(site.id)}
                    >
                      宣布收官
                    </button>
                  ) : (
                    <button onClick={() => actions.reopenSite(site.id)}>撤销收官</button>
                  )}
                  {!closed && !check.ok && <span className="hint">{check.error}</span>}
                </div>
              )}
            </article>
          );
        })}

        <article className="panel rules-card">
          <div className="section-heading">
            <div>
              <p>协作规则</p>
              <h2>收工对得上</h2>
            </div>
          </div>
          <ul className="rules-list">
            <li>探方按地层记开口深度、遗迹、结论与标本。</li>
            <li>同层多人：队员只能补充观察，不能改别人已交的结论。</li>
            <li>整理员校正必须写原因，原记录自动留痕。</li>
            <li>标本先登记、后交接；未交接的计入待整理。</li>
            <li>遗址还有未交接标本，不能宣布收官。</li>
            <li>草稿可暂存续记，数据保存在本机浏览器。</li>
          </ul>
        </article>
      </section>
    </>
  );
}
