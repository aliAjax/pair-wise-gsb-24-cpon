// 页面层：追溯台账。append-only 事件流，倒序展示全部登记、交接、校正、收官动作。

import { useMemo, useState } from "react";
import type { LedgerEvent } from "../data/events";
import type { LedgerState } from "../data/types";
import { SITES } from "../data/reference";
import { describeEvent, formatTime, personName } from "./format";

const TYPE_LABEL: Record<LedgerEvent["type"], string> = {
  layer_created: "登记地层",
  draft_updated: "更新草稿",
  conclusion_submitted: "提交交接",
  observation_added: "补充观察",
  record_corrected: "校正记录",
  specimen_registered: "登记标本",
  specimen_handed: "标本交接",
  specimen_returned: "标本交回",
  specimen_corrected: "校正标本",
  site_closed: "宣布收官",
  site_reopened: "重开遗址",
};

export function TraceTab({ events, state }: { events: LedgerEvent[]; state: LedgerState }) {
  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState<string>("all");

  const types = Object.keys(TYPE_LABEL);

  const siteOfEvent = (ev: LedgerEvent): string | undefined => {
    if ("siteId" in ev) return ev.siteId;
    if ("layerId" in ev) return state.layers[ev.layerId]?.siteId;
    if ("specimenId" in ev) return state.specimens[ev.specimenId]?.siteId;
    if ("specimenIds" in ev) {
      const first = state.specimens[ev.specimenIds[0]];
      return first?.siteId;
    }
    return undefined;
  };

  const filtered = useMemo(() => {
    const reversed = [...events].sort((a, b) => b.at - a.at);
    return reversed.filter((ev) => {
      if (type !== "all" && ev.type !== type) return false;
      if (!siteId) return true;
      return siteOfEvent(ev) === siteId;
    });
  }, [events, state, siteId, type]);

  return (
    <div className="tab-body">
      <div className="filter-bar panel">
        <label className="field">
          <span>遗址</span>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">全部遗址</option>
            {SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>动作类型</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">全部动作</option>
            {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t as LedgerEvent["type"]]}</option>)}
          </select>
        </label>
        <div className="filter-spacer" />
        <span className="meta">共 {filtered.length} 条记录，只增不改，保证可追溯</span>
      </div>

      <ol className="timeline panel">
        {filtered.map((ev) => (
          <li key={ev.id} className={`timeline-item t-${ev.type}`}>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-head">
                <span className="tag tag-type">{TYPE_LABEL[ev.type]}</span>
                <span className="meta">{formatTime(ev.at)} · {personName(ev.by)}</span>
              </div>
              <p>{describeEvent(ev, state)}</p>
              {"reason" in ev && ev.reason && (
                <p className="reason-line">原因：{ev.reason}</p>
              )}
              {"before" in ev && "after" in ev && (
                <div className="diff mini">
                  <div className="diff-before"><b>原记录</b><pre>{JSON.stringify(ev.before, null, 2)}</pre></div>
                  <div className="diff-after"><b>校正后</b><pre>{JSON.stringify(ev.after, null, 2)}</pre></div>
                </div>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className="empty-hint">没有符合条件的台账记录。</li>}
      </ol>
    </div>
  );
}
