import { useMemo, useState } from "react";
import "./styles.css";
import { PEOPLE } from "./data/reference";
import { dashboardMetrics, siteStatuses } from "./rules/selectors";
import { useLedger } from "./ui/useLedger";
import { ROLE_LABEL } from "./ui/format";
import { RegistryTab } from "./ui/RegistryTab";
import { HandoverTab } from "./ui/HandoverTab";
import { ClosureTab } from "./ui/ClosureTab";
import { TraceTab } from "./ui/TraceTab";
import type { LedgerEvent } from "./data/events";
import type { CommitResult } from "./ui/useLedger";

type TabKey = "registry" | "handover" | "closure" | "trace";

const TABS: { key: TabKey; label: string }[] = [
  { key: "registry", label: "探方登记" },
  { key: "handover", label: "标本交接台" },
  { key: "closure", label: "收官闸口" },
  { key: "trace", label: "追溯台账" },
];

function MetricCard({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <article className={`metric-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function App() {
  const { events, state, commit, reset } = useLedger();
  const [personId, setPersonId] = useState(PEOPLE[1].id); // 默认林队员
  const [tab, setTab] = useState<TabKey>("registry");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const person = useMemo(() => PEOPLE.find((p) => p.id === personId)!, [personId]);
  const metrics = dashboardMetrics(state);
  const sites = siteStatuses(state);
  const closedCount = sites.filter((s) => s.closed).length;
  const blockedCount = sites.filter((s) => !s.closed && !s.canClose).length;

  const run = (make: () => LedgerEvent[]): CommitResult => {
    let newEvents: LedgerEvent[];
    try {
      newEvents = make();
    } catch (err) {
      const text = err instanceof Error ? err.message : "操作被拒绝";
      setToast({ kind: "err", text });
      return { ok: false, error: text };
    }
    const r = commit(newEvents);
    setToast(r.ok ? { kind: "ok", text: "已记账" } : { kind: "err", text: r.error ?? "保存失败" });
    if (r.ok) window.setTimeout(() => setToast(null), 1800);
    return r;
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 考古探方工作台</p>
          <h1>探方登记 · 交接 · 追溯台</h1>
          <p className="subtitle">
            队员与整理员记同一本台账：地层按探方登记开口深度、遗迹与标本；同层多人时只补观察、不改他人已交结论；
            整理员校正写原因留原记录；未处理标本不清零，遗址不能收官。
          </p>
        </div>
        <div className="stack-card identity">
          <span>当前身份（切换角色可验证权限）</span>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {PEOPLE.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {ROLE_LABEL[p.role]}</option>
            ))}
          </select>
          <button onClick={() => { if (window.confirm("重置为演示台账？你做的记录会被清空。")) { reset(); setToast({ kind: "ok", text: "已重置演示数据" }); } }}>
            重置演示数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="遗址 / 探方" value={`${metrics.sites} / ${metrics.squares}`} hint={`已收官 ${closedCount} · ${blockedCount} 个遗址有未处理标本`} tone={blockedCount > 0 ? "tone-danger" : "tone-ok"} />
        <MetricCard label="地层记录" value={metrics.layers} hint={`${metrics.uncorrectedLayers} 份草稿未提交交接`} tone={metrics.uncorrectedLayers > 0 ? "tone-watch" : "tone-ok"} />
        <MetricCard label="标本件数" value={metrics.counts.total} hint="随登记、交回、校正实时变化" />
        <MetricCard label="未处理标本" value={`${metrics.counts.pending} 条`} hint={`未交接 ${metrics.counts.unhanded} · 待整理 ${metrics.counts.handed}`} tone={metrics.counts.pending > 0 ? "tone-danger" : "tone-ok"} />
      </section>

      <nav className="tab-bar panel">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.kind === "ok" ? "ok" : "err"}`}>{toast.text}</div>}

      {tab === "registry" && <RegistryTab state={state} person={person} run={run} />}
      {tab === "handover" && <HandoverTab state={state} person={person} run={run} />}
      {tab === "closure" && <ClosureTab state={state} person={person} run={run} />}
      {tab === "trace" && <TraceTab events={events} state={state} />}

      <footer className="foot-note">
        资料（data）· 规则（rules）· 保存（storage）· 页面（ui）四层分离；台账只追加不改写，数据保存在本机浏览器，刷新后续用。
      </footer>
    </main>
  );
}

export default App;
