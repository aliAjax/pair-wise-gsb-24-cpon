// 页面层：登记台。探方按地层登记开口深度、遗迹、标本；同层多人协作，结论与观察分离。

import { useState } from "react";
import type { LedgerState, Person } from "../data/types";
import { SITES, SQUARES } from "../data/reference";
import {
  canAddObservation,
  canCorrectRecord,
  canEditDraft,
  canRegisterSpecimen,
  canSubmit,
} from "../rules/permissions";
import { siteName, specimensAt } from "../rules/selectors";
import { commands } from "../rules/commands";
import { personName, ROLE_LABEL, SPECIMEN_STATUS_LABEL, formatTime } from "./format";
import { FeatureRows, Field } from "./forms";
import type { CommitResult } from "./useLedger";

interface TabProps {
  state: LedgerState;
  person: Person;
  run: (make: () => import("../data/events").LedgerEvent[]) => CommitResult;
}

type OpenEditor =
  | { kind: "create" }
  | { kind: "edit"; layerId: string }
  | { kind: "observe"; layerId: string }
  | { kind: "correct"; layerId: string }
  | { kind: "specimen"; layerId: string }
  | null;

const emptyDraft = { openingDepth: "", summary: "", features: [] as import("../data/types").Feature[] };

export function RegistryTab({ state, person, run }: TabProps) {
  const [siteId, setSiteId] = useState("");
  const [squareId, setSquareId] = useState("");
  const [editor, setEditor] = useState<OpenEditor>(null);
  const [error, setError] = useState("");

  const squares = SQUARES.filter((q) => !siteId || q.siteId === siteId);
  const layers = Object.values(state.layers)
    .filter((l) => (!siteId || l.siteId === siteId) && (!squareId || l.squareId === squareId))
    .sort((a, b) => a.createdAt - b.createdAt);

  const fire = (make: () => import("../data/events").LedgerEvent[]) => {
    const r = run(make);
    if (r.ok) {
      setError("");
      setEditor(null);
    } else {
      setError(r.error ?? "操作失败");
    }
  };

  return (
    <div className="tab-body">
      <div className="filter-bar panel">
        <Field label="遗址">
          <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setSquareId(""); }}>
            <option value="">全部遗址</option>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="探方">
          <select value={squareId} onChange={(e) => setSquareId(e.target.value)}>
            <option value="">全部探方</option>
            {squares.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </Field>
        <div className="filter-spacer" />
        {person.role === "member" && (
          <button className="primary-action" onClick={() => setEditor({ kind: "create" })}>
            + 登记新地层
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {editor?.kind === "create" && (
        <CreateLayerForm
          state={state}
          person={person}
          defaultSiteId={siteId}
          defaultSquareId={squareId}
          onCancel={() => setEditor(null)}
          onSubmit={fire}
        />
      )}

      <div className="layer-list">
        {layers.map((layer) => (
          <LayerCard
            key={layer.id}
            state={state}
            person={person}
            layerId={layer.id}
            open={editor}
            onOpen={setEditor}
            onAction={fire}
            onMessage={setError}
          />
        ))}
        {layers.length === 0 && <div className="empty-hint">当前筛选下还没有地层记录。</div>}
      </div>
    </div>
  );
}

function CreateLayerForm({
  state,
  person,
  defaultSiteId,
  defaultSquareId,
  onCancel,
  onSubmit,
}: {
  state: LedgerState;
  person: Person;
  defaultSiteId: string;
  defaultSquareId: string;
  onCancel: () => void;
  onSubmit: (make: () => import("../data/events").LedgerEvent[]) => void;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId || SITES[0].id);
  const [squareId, setSquareId] = useState(defaultSquareId || "");
  const [code, setCode] = useState("");
  const [openingDepth, setDepth] = useState("");
  const [summary, setSummary] = useState("");
  const [features, setFeatures] = useState(emptyDraft.features);

  const squares = SQUARES.filter((q) => q.siteId === siteId);

  return (
    <form
      className="panel editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(() =>
          commands.createLayer(
            state,
            person,
            { siteId, squareId, code, openingDepth, summary, features },
          ),
        );
      }}
    >
      <h3>登记新地层</h3>
      <div className="form-grid">
        <Field label="遗址">
          <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setSquareId(""); }}>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="探方">
          <select value={squareId} onChange={(e) => setSquareId(e.target.value)}>
            <option value="">请选择探方</option>
            {squares.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </Field>
        <Field label="地层">
          <input placeholder="如 第3层" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="开口深度（米）">
          <input placeholder="如 0.45" value={openingDepth} onChange={(e) => setDepth(e.target.value)} />
        </Field>
      </div>
      <Field label="地层小结">
        <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="土色土质、堆积描述、层位关系" />
      </Field>
      <FeatureRows features={features} onChange={setFeatures} />
      <div className="form-actions">
        <button type="button" onClick={onCancel}>取消</button>
        <button type="submit" className="primary-action">保存草稿</button>
      </div>
    </form>
  );
}

function LayerCard({
  state,
  person,
  layerId,
  open,
  onOpen,
  onAction,
  onMessage,
}: {
  state: LedgerState;
  person: Person;
  layerId: string;
  open: OpenEditor;
  onOpen: (e: OpenEditor) => void;
  onAction: (make: () => import("../data/events").LedgerEvent[]) => void;
  onMessage: (msg: string) => void;
}) {
  const layer = state.layers[layerId];
  const c = layer.conclusion;
  const specimens = specimensAt(state, layer.siteId, layer.squareId).filter((s) => s.layerId === layerId);
  const [obsText, setObsText] = useState("");
  const [spForm, setSpForm] = useState({ name: "", qty: "1", coord: "" });
  const [draftForm, setDraftForm] = useState({ openingDepth: "", summary: "" });
  const [correctForm, setCorrectForm] = useState<{ reason: string; openingDepth: string; summary: string; features: import("../data/types").Feature[] } | null>(null);

  const editD = c ? canEditDraft(person, layer) : { ok: false, reason: "无草稿" };
  const submitD = c ? canSubmit(person, layer) : { ok: false, reason: "无草稿" };
  const obsD = canAddObservation(person, layer);
  const correctD = canCorrectRecord(person, layer);
  const specimenD = canRegisterSpecimen(person, layer);
  const isAuthor = c?.authorId === person.id;

  const startEdit = () => {
    if (!c) return;
    setDraftForm({ openingDepth: c.openingDepth, summary: c.summary });
    onOpen({ kind: "edit", layerId });
  };
  const startCorrect = () => {
    if (!c) return;
    setCorrectForm({ reason: "", openingDepth: c.openingDepth, summary: c.summary, features: c.features.map((f) => ({ ...f })) });
    onOpen({ kind: "correct", layerId });
  };

  const guard = (d: { ok: boolean; reason?: string }) => {
    if (!d.ok) onMessage(d.reason ?? "无权限");
    return d.ok;
  };

  return (
    <article className="panel layer-card">
      <header className="layer-head">
        <div>
          <h3>{siteName(layer.siteId)} · {SQUARES.find((q) => q.id === layer.squareId)?.name} · {layer.code}</h3>
          <p className="meta">
            {personName(layer.creatorId)} 登记于 {formatTime(layer.createdAt)}
            {c && !c.submitted && <span className="tag tag-draft">草稿 · {personName(c.authorId)}</span>}
            {c?.submitted && <span className="tag tag-submitted">已交接 {c.submittedAt ? formatTime(c.submittedAt) : ""}</span>}
          </p>
        </div>
        <div className="layer-actions">
          {person.role === "member" && (
            <button disabled={!submitD.ok} title={submitD.reason} onClick={() => guard(submitD) && onAction(() => commands.submitConclusion(state, person, layerId))}>
              提交交接
            </button>
          )}
          {person.role === "member" && (
            <button disabled={!editD.ok} title={editD.reason} onClick={() => guard(editD) && startEdit()}>
              改草稿
            </button>
          )}
          <button disabled={!obsD.ok} title={obsD.reason} onClick={() => { if (guard(obsD)) onOpen({ kind: "observe", layerId }); }}>
            补充观察
          </button>
          {person.role === "cataloger" && (
            <button disabled={!correctD.ok} title={correctD.reason} onClick={() => { if (guard(correctD)) startCorrect(); }}>
              校正结论
            </button>
          )}
          <button disabled={!specimenD.ok} title={specimenD.reason} onClick={() => { if (guard(specimenD)) onOpen({ kind: "specimen", layerId }); }}>
            登记标本
          </button>
        </div>
      </header>

      {c && (
        <div className="conclusion">
          <div className="kv"><b>开口深度</b><span>{c.openingDepth} 米</span></div>
          <div className="kv"><b>地层小结</b><span>{c.summary}</span></div>
          <div className="kv">
            <b>遗迹（{c.features.length}）</b>
            <span>
              {c.features.length === 0
                ? "无"
                : c.features.map((f) => `${f.code} ${f.kind}（${f.soil || "—"}${f.note ? `；${f.note}` : ""}）`).join("；")}
            </span>
          </div>
          {!isAuthor && person.role === "member" && (
            <p className="lock-hint">这是 {personName(c.authorId)} 的结论{ c.submitted ? "且已交接" : "草稿"}，你只能补充观察，不能修改。</p>
          )}
        </div>
      )}

      {open?.kind === "edit" && open.layerId === layerId && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(() => commands.updateDraft(state, person, layerId, { openingDepth: draftForm.openingDepth, summary: draftForm.summary, features: c?.features }));
          }}
        >
          <Field label="开口深度（米）">
            <input value={draftForm.openingDepth} onChange={(e) => setDraftForm({ ...draftForm, openingDepth: e.target.value })} />
          </Field>
          <Field label="地层小结">
            <textarea rows={2} value={draftForm.summary} onChange={(e) => setDraftForm({ ...draftForm, summary: e.target.value })} />
          </Field>
          <div className="form-actions">
            <button type="button" onClick={() => onOpen(null)}>取消</button>
            <button type="submit" className="primary-action">保存（仍是草稿）</button>
          </div>
        </form>
      )}

      {open?.kind === "correct" && open.layerId === layerId && correctForm && (
        <form
          className="inline-form correction"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(() =>
              commands.correctRecord(state, person, layerId, {
                reason: correctForm.reason,
                after: { openingDepth: correctForm.openingDepth, summary: correctForm.summary, features: correctForm.features },
              }),
            );
          }}
        >
          <h4>校正结论（原记录保留在追溯台账中）</h4>
          <div className="before-note">
            原值：开口深度 {c?.openingDepth} 米；{c?.summary}
          </div>
          <div className="form-grid">
            <Field label="校正后开口深度（米）">
              <input value={correctForm.openingDepth} onChange={(e) => setCorrectForm({ ...correctForm, openingDepth: e.target.value })} />
            </Field>
            <Field label="校正原因（必填）">
              <input value={correctForm.reason} onChange={(e) => setCorrectForm({ ...correctForm, reason: e.target.value })} placeholder="如 复测水准点，深度更正" />
            </Field>
          </div>
          <Field label="校正后地层小结">
            <textarea rows={2} value={correctForm.summary} onChange={(e) => setCorrectForm({ ...correctForm, summary: e.target.value })} />
          </Field>
          <FeatureRows features={correctForm.features} onChange={(features) => setCorrectForm({ ...correctForm, features })} />
          <div className="form-actions">
            <button type="button" onClick={() => onOpen(null)}>取消</button>
            <button type="submit" className="warn-action">提交校正并留痕</button>
          </div>
        </form>
      )}

      {layer.observations.length > 0 && (
        <div className="observations">
          <h4>补充观察（{layer.observations.length}）</h4>
          {[...layer.observations].sort((a, b) => a.at - b.at).map((o) => (
            <div className="observation" key={o.id}>
              <span className="tag tag-obs">{personName(o.authorId)} · {formatTime(o.at)}</span>
              <p>{o.text}</p>
            </div>
          ))}
        </div>
      )}

      {open?.kind === "observe" && open.layerId === layerId && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(() => commands.addObservation(state, person, layerId, obsText));
            setObsText("");
          }}
        >
          <Field label={`以「${person.name}」的身份补充观察（不会改动任何人的结论）`}>
            <textarea rows={2} value={obsText} onChange={(e) => setObsText(e.target.value)} placeholder="现场新观察、关系复核意见…" />
          </Field>
          <div className="form-actions">
            <button type="button" onClick={() => onOpen(null)}>取消</button>
            <button type="submit" className="primary-action">追加观察</button>
          </div>
        </form>
      )}

      <div className="specimens">
        <h4>本层标本（{specimens.length} 条 / {specimens.reduce((s2, x) => s2 + x.qty, 0)} 件）</h4>
        {specimens.length === 0 ? (
          <p className="meta">暂无登记标本</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>编号</th><th>名称</th><th>数量</th><th>坐标</th><th>状态</th><th>登记人</th></tr>
            </thead>
            <tbody>
              {specimens.map((s) => (
                <tr key={s.id}>
                  <td>{s.code}</td>
                  <td>{s.name}{s.corrections.length > 0 && <span className="tag tag-corr" title={s.corrections.map((x) => x.reason).join("\n")}>已校正×{s.corrections.length}</span>}</td>
                  <td>{s.qty}</td>
                  <td>{s.coord}</td>
                  <td><span className={`status status-${s.status}`}>{SPECIMEN_STATUS_LABEL[s.status]}</span></td>
                  <td>{personName(s.registeredBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open?.kind === "specimen" && open.layerId === layerId && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(() =>
              commands.registerSpecimen(state, person, {
                layerId,
                name: spForm.name,
                qty: Number(spForm.qty),
                coord: spForm.coord,
              }),
            );
            setSpForm({ name: "", qty: "1", coord: "" });
          }}
        >
          <div className="form-grid">
            <Field label="标本名称"><input value={spForm.name} onChange={(e) => setSpForm({ ...spForm, name: e.target.value })} placeholder="如 夹砂陶片" /></Field>
            <Field label="数量（件）"><input type="number" min={1} step={1} value={spForm.qty} onChange={(e) => setSpForm({ ...spForm, qty: e.target.value })} /></Field>
            <Field label="出土坐标"><input value={spForm.coord} onChange={(e) => setSpForm({ ...spForm, coord: e.target.value })} placeholder="如 E3 N4" /></Field>
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => onOpen(null)}>取消</button>
            <button type="submit" className="primary-action">登记标本（状态：未交接）</button>
          </div>
        </form>
      )}

      {c?.corrections.length ? (
        <details className="correction-history">
          <summary>结论校正记录（{c.corrections.length}）</summary>
          {[...c.corrections].sort((a, b) => a.at - b.at).map((r) => (
            <div className="correction-item" key={r.id}>
              <p className="meta">{personName(r.by)} · {formatTime(r.at)}</p>
              <p><b>原因：</b>{r.reason}</p>
              <div className="diff">
                <div className="diff-before"><b>原记录</b><p>开口深度 {r.before.openingDepth} 米</p><p>{r.before.summary}</p></div>
                <div className="diff-after"><b>校正后</b><p>开口深度 {r.after.openingDepth} 米</p><p>{r.after.summary}</p></div>
              </div>
            </div>
          ))}
        </details>
      ) : null}
      <p className="meta role-note">当前身份：{person.name}（{ROLE_LABEL[person.role]}）{isAuthor ? " · 本记录作者" : ""}</p>
    </article>
  );
}
