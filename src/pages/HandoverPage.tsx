// 交接页：未交接标本待整理，按遗址和探方筛选；交回与校正即时改变数量

import { useMemo, useState } from "react";
import { Badge, Empty, Modal } from "../components/ui";
import type { Specimen, SpecimenSnapshot } from "../data/types";
import type { Workbench } from "../store";
import { fmtTime } from "../utils";

export function HandoverPage({ wb }: { wb: Workbench }) {
  const { db, user, actions } = wb;

  const [filterSite, setFilterSite] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [message, setMessage] = useState("");

  const [correcting, setCorrecting] = useState<Specimen | null>(null);
  const [patch, setPatch] = useState<SpecimenSnapshot>({ name: "", layer: "", quantity: 1 });
  const [reason, setReason] = useState("");
  const [corrMessage, setCorrMessage] = useState("");

  const unitsOf = (siteId: string) => db.units.filter((u) => u.siteId === siteId);
  const unitCode = (unitId: string) => db.units.find((u) => u.id === unitId)?.code ?? "?";
  const siteName = (siteId: string) => db.sites.find((s) => s.id === siteId)?.name ?? "?";

  const filtered = useMemo(
    () =>
      db.specimens.filter(
        (sp) =>
          (!filterSite || sp.siteId === filterSite) && (!filterUnit || sp.unitId === filterUnit)
      ),
    [db.specimens, filterSite, filterUnit]
  );
  const pending = filtered.filter((sp) => sp.status === "pending");
  const handed = filtered.filter((sp) => sp.status === "handed");
  const qty = (list: Specimen[]) => list.reduce((acc, sp) => acc + sp.quantity, 0);

  const handover = (id: string) => {
    const res = actions.handoverSpecimen(id);
    setMessage(res.ok ? "已交接，待交接数量已更新" : res.error);
  };

  const openCorrect = (sp: Specimen) => {
    setCorrecting(sp);
    setPatch({ name: sp.name, layer: sp.layer, quantity: sp.quantity });
    setReason("");
    setCorrMessage("");
  };

  const doCorrect = () => {
    if (!correcting) return;
    const res = actions.correctSpecimen(correcting.id, patch, reason);
    if (res.ok) setCorrecting(null);
    else setCorrMessage(res.error);
  };

  return (
    <div className="page-grid">
      <section className="panel span-all">
        <div className="section-heading">
          <div>
            <p>标本交接</p>
            <h2>
              待交接 {pending.length} 条 / {qty(pending)} 件 · 已交接 {qty(handed)} 件
            </h2>
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
        {message && <p className="notice">{message}</p>}

        <h3 className="sub-heading">待交接（未交接标本待整理）</h3>
        {pending.length === 0 ? (
          <Empty text="当前筛选下没有待交接标本。" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>标本</th>
                <th>遗址 / 探方 / 地层</th>
                <th>数量</th>
                <th>登记</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((sp) => (
                <tr key={sp.id}>
                  <td>
                    {sp.name}
                    {sp.corrections.length > 0 && <Badge tone="warn"> 校正 {sp.corrections.length}</Badge>}
                  </td>
                  <td>
                    {siteName(sp.siteId)} · {unitCode(sp.unitId)} · {sp.layer}
                  </td>
                  <td>{sp.quantity}</td>
                  <td className="muted">
                    {sp.registeredByName} · {fmtTime(sp.registeredAt)}
                  </td>
                  <td className="row-actions">
                    <button className="primary-action" onClick={() => handover(sp.id)}>
                      交接确认
                    </button>
                    {user.role === "curator" && <button onClick={() => openCorrect(sp)}>校正</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 className="sub-heading">已交接</h3>
        {handed.length === 0 ? (
          <Empty text="还没有已交接的标本。" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>标本</th>
                <th>遗址 / 探方 / 地层</th>
                <th>数量</th>
                <th>交接</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {handed.map((sp) => (
                <tr key={sp.id}>
                  <td>
                    {sp.name}
                    {sp.corrections.length > 0 && <Badge tone="warn"> 校正 {sp.corrections.length}</Badge>}
                  </td>
                  <td>
                    {siteName(sp.siteId)} · {unitCode(sp.unitId)} · {sp.layer}
                  </td>
                  <td>{sp.quantity}</td>
                  <td className="muted">
                    {sp.receiverName} 接收 · {sp.handedAt ? fmtTime(sp.handedAt) : "—"}
                  </td>
                  <td className="row-actions">
                    {user.role === "curator" && <button onClick={() => openCorrect(sp)}>校正</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {correcting && (
        <Modal title={`校正标本 ${correcting.name}（原记录将保留）`} onClose={() => setCorrecting(null)}>
          <div className="field-grid one-col">
            <label>
              <span>标本名称</span>
              <input
                value={patch.name}
                onChange={(e) => setPatch((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label>
              <span>地层</span>
              <input
                value={patch.layer}
                onChange={(e) => setPatch((p) => ({ ...p, layer: e.target.value }))}
              />
            </label>
            <label>
              <span>数量</span>
              <input
                type="number"
                min={1}
                value={patch.quantity}
                onChange={(e) => setPatch((p) => ({ ...p, quantity: Number(e.target.value) }))}
              />
            </label>
            <label>
              <span>校正原因（必填，随原记录一起留痕）</span>
              <input
                placeholder="如 清点复核：碎件合并"
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
