// 页面层：交接台。未交接标本待整理，按遗址和探方筛选；队员交接、整理员交回与校正。

import { useMemo, useState } from "react";
import type { LedgerEvent } from "../data/events";
import type { LedgerState, Person, Specimen, SpecimenSnapshot, SpecimenStatus } from "../data/types";
import { PEOPLE, SITES, SQUARES } from "../data/reference";
import { canCorrectSpecimen, canHandOver, canReturn } from "../rules/permissions";
import { countSpecimens, siteName, specimensAt } from "../rules/selectors";
import { commands } from "../rules/commands";
import { personName, SPECIMEN_STATUS_LABEL, formatTime } from "./format";
import { Field } from "./forms";
import type { CommitResult } from "./useLedger";

type Filter = "all" | SpecimenStatus;

export function HandoverTab({
  state,
  person,
  run,
}: {
  state: LedgerState;
  person: Person;
  run: (make: () => LedgerEvent[]) => CommitResult;
}) {
  const [siteId, setSiteId] = useState("");
  const [squareId, setSquareId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [receiverId, setReceiverId] = useState(PEOPLE.find((p) => p.role === "cataloger")?.id ?? "");
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const catalogers = PEOPLE.filter((p) => p.role === "cataloger");
  const squares = SQUARES.filter((q) => !siteId || q.siteId === siteId);

  const list = useMemo(() => {
    const scoped = specimensAt(state, siteId || undefined, squareId || undefined);
    return scoped
      .filter((s) => filter === "all" || s.status === filter)
      .sort((a, b) => a.registeredAt - b.registeredAt);
  }, [state, siteId, squareId, filter]);

  const scopedCounts = countSpecimens(specimensAt(state, siteId || undefined, squareId || undefined));

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if ([...picked].filter((id) => list.some((s) => s.id === id)).length === list.length) {
      setPicked(new Set());
    } else {
      setPicked(new Set(list.map((s) => s.id)));
    }
  };

  const chosen = [...picked].map((id) => state.specimens[id]).filter(Boolean);

  const doHandover = () => {
    const r = run(() => commands.handOver(state, person, chosen.filter((s) => s.status === "unhanded").map((s) => s.id), receiverId));
    setMessage(r.ok ? `已交接 ${chosen.filter((s) => s.status === "unhanded").length} 条标本` : (r.error ?? ""));
    if (r.ok) setPicked(new Set());
  };
  const doReturn = () => {
    const ids = chosen.filter((s) => s.status === "handed").map((s) => s.id);
    const r = run(() => commands.returnSpecimens(state, person, ids));
    setMessage(r.ok ? `已交回入库 ${ids.length} 条标本` : (r.error ?? ""));
    if (r.ok) setPicked(new Set());
  };

  const handD = canHandOver(person, chosen);
  const retD = canReturn(person, chosen);

  return (
    <div className="tab-body">
      <div className="filter-bar panel">
        <Field label="遗址">
          <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setSquareId(""); setPicked(new Set()); }}>
            <option value="">全部遗址</option>
            {SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="探方">
          <select value={squareId} onChange={(e) => { setSquareId(e.target.value); setPicked(new Set()); }}>
            <option value="">全部探方</option>
            {squares.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </Field>
        <Field label="状态">
          <select value={filter} onChange={(e) => { setFilter(e.target.value as Filter); setPicked(new Set()); }}>
            <option value="all">全部</option>
            <option value="unhanded">未交接</option>
            <option value="handed">待整理</option>
            <option value="returned">已交回</option>
          </select>
        </Field>
        <div className="filter-spacer" />
        <div className="count-chips">
          <span className="count-chip">未交接 <b>{scopedCounts.unhanded}</b></span>
          <span className="count-chip">待整理 <b>{scopedCounts.handed}</b></span>
          <span className="count-chip">已交回 <b>{scopedCounts.returned}</b></span>
          <span className="count-chip">件数合计 <b>{scopedCounts.total}</b></span>
        </div>
      </div>

      {message && <div className="alert info">{message}</div>}

      <div className="panel batch-bar">
        <label className="batch-check">
          <input type="checkbox" checked={list.length > 0 && [...picked].filter((id) => list.some((s) => s.id === id)).length === list.length} onChange={toggleAll} />
          全选当前筛选（{list.length}）
        </label>
        <span className="meta">已选 {chosen.length} 条</span>
        <div className="filter-spacer" />
        {person.role === "member" && (
          <>
            <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)}>
              {catalogers.map((p) => <option key={p.id} value={p.id}>接收：{p.name}</option>)}
            </select>
            <button className="primary-action" disabled={!handD.ok} title={handD.reason} onClick={doHandover}>
              交接给整理员
            </button>
          </>
        )}
        {person.role === "cataloger" && (
          <button className="accent-action" disabled={!retD.ok} title={retD.reason} onClick={doReturn}>
            整理完成 · 交回入库
          </button>
        )}
        {person.role === "leader" && <span className="meta">领队视角：可查看全部交接情况，操作请切换角色。</span>}
      </div>

      <div className="panel">
        <table className="data-table wide">
          <thead>
            <tr>
              <th></th>
              <th>编号</th>
              <th>遗址 / 探方 / 地层</th>
              <th>名称</th>
              <th>数量</th>
              <th>坐标</th>
              <th>状态</th>
              <th>流转记录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <SpecimenRow
                key={s.id}
                specimen={s}
                state={state}
                person={person}
                checked={picked.has(s.id)}
                onToggle={() => toggle(s.id)}
                onCorrect={() => setCorrecting(s.id)}
                run={run}
                onMessage={setMessage}
                correcting={correcting === s.id}
                cancelCorrect={() => setCorrecting(null)}
              />
            ))}
            {list.length === 0 && (
              <tr><td colSpan={9} className="empty-hint">当前筛选下没有标本。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpecimenRow({
  specimen,
  state,
  person,
  checked,
  onToggle,
  onCorrect,
  run,
  onMessage,
  correcting,
  cancelCorrect,
}: {
  specimen: Specimen;
  state: LedgerState;
  person: Person;
  checked: boolean;
  onToggle: () => void;
  onCorrect: () => void;
  run: (make: () => LedgerEvent[]) => CommitResult;
  onMessage: (msg: string) => void;
  correcting: boolean;
  cancelCorrect: () => void;
}) {
  const layer = state.layers[specimen.layerId];
  const d = canCorrectSpecimen(person, specimen);
  const [form, setForm] = useState<SpecimenSnapshot & { reason: string }>({
    name: specimen.name,
    qty: specimen.qty,
    coord: specimen.coord,
    reason: "",
  });

  const flow: string[] = [];
  flow.push(`${formatTime(specimen.registeredAt)} ${personName(specimen.registeredBy)} 登记`);
  if (specimen.handedAt) flow.push(`${formatTime(specimen.handedAt)} 交${specimen.receiverId ? personName(specimen.receiverId) : "整理员"}`);
  if (specimen.returnedAt) flow.push(`${formatTime(specimen.returnedAt)} 交回入库`);

  return (
    <>
      <tr>
        <td><input type="checkbox" checked={checked} onChange={onToggle} /></td>
        <td>{specimen.code}</td>
        <td>{siteName(specimen.siteId)} / {SQUARES.find((q) => q.id === specimen.squareId)?.name} / {layer?.code ?? "—"}</td>
        <td>{specimen.name}</td>
        <td>{specimen.qty}</td>
        <td>{specimen.coord}</td>
        <td><span className={`status status-${specimen.status}`}>{SPECIMEN_STATUS_LABEL[specimen.status]}</span></td>
        <td className="flow-cell">{flow.map((f, i) => <span key={i} className="flow-step">{f}</span>)}</td>
        <td>
          <button disabled={!d.ok} title={d.reason} onClick={() => { if (!d.ok) onMessage(d.reason ?? "无权限"); else onCorrect(); }}>
            校正
          </button>
        </td>
      </tr>
      {correcting && (
        <tr className="correct-row">
          <td></td>
          <td colSpan={8}>
            <form
              className="inline-form correction"
              onSubmit={(e) => {
                e.preventDefault();
                const r = run(() =>
                  commands.correctSpecimen(state, person, specimen.id, {
                    reason: form.reason,
                    after: { name: form.name, qty: Number(form.qty), coord: form.coord },
                  }),
                );
                if (r.ok) cancelCorrect();
                else onMessage(r.error ?? "校正失败");
              }}
            >
              <h4>校正标本 {specimen.code}（原记录保留，数量与名称按校正结果更新）</h4>
              <div className="before-note">原值：{specimen.name} {specimen.qty} 件，坐标 {specimen.coord}</div>
              <div className="form-grid">
                <Field label="校正后名称"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="校正后数量（件）"><input type="number" min={1} step={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
                <Field label="校正后坐标"><input value={form.coord} onChange={(e) => setForm({ ...form, coord: e.target.value })} /></Field>
                <Field label="校正原因（必填）"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="如 拼对后核减 2 件" /></Field>
              </div>
              <div className="form-actions">
                <button type="button" onClick={cancelCorrect}>取消</button>
                <button type="submit" className="warn-action">提交校正并留痕</button>
              </div>
              {specimen.corrections.length > 0 && (
                <div className="correction-history">
                  <h4>历次校正</h4>
                  {specimen.corrections.map((r) => (
                    <p key={r.id} className="meta">
                      {formatTime(r.at)} {personName(r.by)}：{r.before.name} {r.before.qty}件 → {r.after.name} {r.after.qty}件；{r.reason}
                    </p>
                  ))}
                </div>
              )}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
