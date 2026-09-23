// 登记页：地层记录（草稿可续记、提交后锁定）、补充观察、整理员校正、标本登记

import { useMemo, useState } from "react";
import { Badge, Empty, Modal } from "../components/ui";
import type { LayerRecord, LayerSnapshot } from "../data/types";
import { canCorrectRecord, canEditRecord, canObserve } from "../rules";
import type { Workbench } from "../store";
import { fmtTime } from "../utils";

const emptyForm = { siteId: "", unitId: "", layer: "", openingDepth: "", features: "", conclusion: "" };

export function RegisterPage({ wb }: { wb: Workbench }) {
  const { db, user, actions } = wb;

  /* 登记表单状态：editingId 非空表示正在续记草稿 */
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  /* 标本登记表单 */
  const [spForm, setSpForm] = useState({ siteId: "", unitId: "", layer: "", name: "", quantity: "1" });
  const [spMessage, setSpMessage] = useState("");

  /* 列表筛选 */
  const [filterSite, setFilterSite] = useState("");
  const [filterUnit, setFilterUnit] = useState("");

  /* 观察输入框（按记录 id 分别保存草稿文本） */
  const [obsText, setObsText] = useState<Record<string, string>>({});

  /* 校正弹窗 */
  const [correcting, setCorrecting] = useState<LayerRecord | null>(null);
  const [patch, setPatch] = useState<LayerSnapshot>({ openingDepth: "", features: "", conclusion: "" });
  const [reason, setReason] = useState("");
  const [corrMessage, setCorrMessage] = useState("");

  const unitsOf = (siteId: string) => db.units.filter((u) => u.siteId === siteId);
  const unitCode = (unitId: string) => db.units.find((u) => u.id === unitId)?.code ?? "?";

  const records = useMemo(
    () =>
      db.records.filter(
        (r) =>
          (!filterSite || r.siteId === filterSite) && (!filterUnit || r.unitId === filterUnit)
      ),
    [db.records, filterSite, filterUnit]
  );

  const set = (key: keyof typeof emptyForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (asSubmit: boolean) => {
    const res = actions.saveRecord(form, editingId, asSubmit);
    setMessage(res.ok ? (asSubmit ? "结论已提交，他人只能补充观察" : "草稿已暂存，可稍后续记") : res.error);
    if (res.ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  };

  const continueDraft = (rec: LayerRecord) => {
    setEditingId(rec.id);
    setForm({
      siteId: rec.siteId,
      unitId: rec.unitId,
      layer: rec.layer,
      openingDepth: rec.openingDepth,
      features: rec.features,
      conclusion: rec.conclusion,
    });
    setMessage(`正在续记 ${unitCode(rec.unitId)} ${rec.layer} 的草稿`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addObs = (recordId: string) => {
    const res = actions.addObservation(recordId, obsText[recordId] ?? "");
    if (res.ok) setObsText((m) => ({ ...m, [recordId]: "" }));
    else setMessage(res.error);
  };

  const openCorrect = (rec: LayerRecord) => {
    setCorrecting(rec);
    setPatch({ openingDepth: rec.openingDepth, features: rec.features, conclusion: rec.conclusion });
    setReason("");
    setCorrMessage("");
  };

  const doCorrect = () => {
    if (!correcting) return;
    const res = actions.correctRecord(correcting.id, patch, reason);
    if (res.ok) setCorrecting(null);
    else setCorrMessage(res.error);
  };

  const registerSpecimen = () => {
    const res = actions.registerSpecimen({ ...spForm, quantity: Number(spForm.quantity) });
    setSpMessage(res.ok ? "标本已登记，计入待交接" : res.error);
    if (res.ok) setSpForm({ siteId: "", unitId: "", layer: "", name: "", quantity: "1" });
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>探方登记</p>
            <h2>{editingId ? "续记草稿" : "新增地层记录"}</h2>
          </div>
          {editingId && (
            <button
              className="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setMessage("");
              }}
            >
              放弃续记
            </button>
          )}
        </div>
        <div className="field-grid">
          <label>
            <span>遗址</span>
            <select
              value={form.siteId}
              onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value, unitId: "" }))}
            >
              <option value="">选择遗址</option>
              {db.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>探方</span>
            <select value={form.unitId} onChange={set("unitId")}>
              <option value="">选择探方</option>
              {unitsOf(form.siteId).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>地层</span>
            <input placeholder="如 第3层" value={form.layer} onChange={set("layer")} />
          </label>
          <label>
            <span>开口深度</span>
            <input placeholder="如 -0.85m" value={form.openingDepth} onChange={set("openingDepth")} />
          </label>
          <label>
            <span>遗迹</span>
            <input placeholder="如 灰坑 H12" value={form.features} onChange={set("features")} />
          </label>
          <label>
            <span>结论</span>
            <input
              placeholder="土质土色、包含物、性质判断"
              value={form.conclusion}
              onChange={set("conclusion")}
            />
          </label>
        </div>
        <div className="row-actions">
          <button onClick={() => submit(false)}>暂存草稿</button>
          <button className="primary-action" onClick={() => submit(true)}>
            提交结论
          </button>
          {message && <span className="hint">{message}</span>}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>标本</p>
            <h2>登记标本</h2>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>遗址</span>
            <select
              value={spForm.siteId}
              onChange={(e) => setSpForm((f) => ({ ...f, siteId: e.target.value, unitId: "" }))}
            >
              <option value="">选择遗址</option>
              {db.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>探方</span>
            <select
              value={spForm.unitId}
              onChange={(e) => setSpForm((f) => ({ ...f, unitId: e.target.value }))}
            >
              <option value="">选择探方</option>
              {unitsOf(spForm.siteId).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>地层</span>
            <input
              placeholder="如 第3层"
              value={spForm.layer}
              onChange={(e) => setSpForm((f) => ({ ...f, layer: e.target.value }))}
            />
          </label>
          <label>
            <span>标本名称</span>
            <input
              placeholder="如 陶片"
              value={spForm.name}
              onChange={(e) => setSpForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            <span>数量</span>
            <input
              type="number"
              min={1}
              value={spForm.quantity}
              onChange={(e) => setSpForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </label>
        </div>
        <div className="row-actions">
          <button className="primary-action" onClick={registerSpecimen}>
            登记标本
          </button>
          {spMessage && <span className="hint">{spMessage}</span>}
        </div>
      </section>

      <section className="panel span-all">
        <div className="section-heading">
          <div>
            <p>记录列表</p>
            <h2>地层记录（{records.length}）</h2>
          </div>
          <div className="filters">
            <select
              value={filterSite}
              onChange={(e) => {
                setFilterSite(e.target.value);
                setFilterUnit("");
              }}
            >
              <option value="">全部遗址</option>
              {db.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
              <option value="">全部探方</option>
              {(filterSite ? unitsOf(filterSite) : db.units).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {records.length === 0 && <Empty text="暂无记录，先在上方登记。" />}
        <div className="record-list">
          {records.map((rec) => (
            <article key={rec.id} className="record-card">
              <div className="record-head">
                <strong>
                  {unitCode(rec.unitId)} · {rec.layer}
                </strong>
                {rec.status === "draft" ? <Badge tone="draft">草稿</Badge> : <Badge tone="done">已交</Badge>}
                {rec.revisions.length > 0 && <Badge tone="warn">校正 {rec.revisions.length} 次</Badge>}
                <span className="muted">
                  {rec.authorName} · {fmtTime(rec.updatedAt)}
                </span>
              </div>
              <p className="record-body">
                开口深度 {rec.openingDepth || "—"} · 遗迹 {rec.features || "—"} · 结论{" "}
                {rec.conclusion || "—"}
              </p>

              {rec.observations.length > 0 && (
                <ul className="obs-list">
                  {rec.observations.map((o) => (
                    <li key={o.id}>
                      <Badge tone="obs">观察</Badge> {o.text}
                      <span className="muted">
                        —— {o.authorName} {fmtTime(o.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="row-actions">
                {canEditRecord(rec, user) && (
                  <>
                    <button onClick={() => continueDraft(rec)}>续记</button>
                    <button
                      className="primary-action"
                      onClick={() => {
                        const res = actions.saveRecord(
                          {
                            siteId: rec.siteId,
                            unitId: rec.unitId,
                            layer: rec.layer,
                            openingDepth: rec.openingDepth,
                            features: rec.features,
                            conclusion: rec.conclusion,
                          },
                          rec.id,
                          true
                        );
                        setMessage(res.ok ? "结论已提交" : res.error);
                      }}
                    >
                      提交结论
                    </button>
                  </>
                )}
                {canCorrectRecord(rec, user) && <button onClick={() => openCorrect(rec)}>校正</button>}
                {rec.status === "submitted" && rec.authorId !== user.id && user.role === "member" && (
                  <span className="hint">他人已交的结论只能补充观察</span>
                )}
              </div>

              {canObserve(rec) && (
                <div className="obs-form">
                  <input
                    placeholder="补充观察（不改结论，只追加）"
                    value={obsText[rec.id] ?? ""}
                    onChange={(e) => setObsText((m) => ({ ...m, [rec.id]: e.target.value }))}
                  />
                  <button onClick={() => addObs(rec.id)}>补充观察</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {correcting && (
        <Modal title={`校正 ${unitCode(correcting.unitId)} ${correcting.layer}（原记录将保留）`} onClose={() => setCorrecting(null)}>
          <div className="field-grid one-col">
            <label>
              <span>开口深度</span>
              <input
                value={patch.openingDepth}
                onChange={(e) => setPatch((p) => ({ ...p, openingDepth: e.target.value }))}
              />
            </label>
            <label>
              <span>遗迹</span>
              <input
                value={patch.features}
                onChange={(e) => setPatch((p) => ({ ...p, features: e.target.value }))}
              />
            </label>
            <label>
              <span>结论</span>
              <input
                value={patch.conclusion}
                onChange={(e) => setPatch((p) => ({ ...p, conclusion: e.target.value }))}
              />
            </label>
            <label>
              <span>校正原因（必填，随原记录一起留痕）</span>
              <input
                placeholder="如 收工对账：与标本袋标签不符"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>
          <div className="row-actions">
            <button className="primary-action" onClick={doCorrect}>
              确认校正
            </button>
            {corrMessage && <span className="hint">{corrMessage}</span>}
          </div>
        </Modal>
      )}
    </div>
  );
}
