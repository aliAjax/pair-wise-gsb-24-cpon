// 页面壳：标题、身份切换、页签导航。资料/规则/保存分别在 data、rules、storage 中。

import { useState } from "react";
import { Badge } from "./components/ui";
import { HandoverPage } from "./pages/HandoverPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RegisterPage } from "./pages/RegisterPage";
import { TracePage } from "./pages/TracePage";
import { useWorkbench } from "./store";
import "./styles.css";

const TABS = [
  { id: "overview", label: "总览" },
  { id: "register", label: "探方登记" },
  { id: "handover", label: "标本交接" },
  { id: "trace", label: "追溯留痕" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function App() {
  const wb = useWorkbench();
  const { db, user, userId, setUserId, actions } = wb;
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 探方台</p>
          <h1>考古探方记录</h1>
          <p className="subtitle">
            探方按地层登记开口深度、遗迹与标本；已交结论只能补充观察，校正留原因和原记录；
            标本交接清楚之前，遗址不能宣布收官。
          </p>
        </div>
        <div className="stack-card">
          <span>当前身份</span>
          <div className="user-switch">
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}（{u.role === "curator" ? "整理员" : "队员"}）
                </option>
              ))}
            </select>
            <Badge tone={user.role === "curator" ? "curator" : "member"}>
              {user.role === "curator" ? "资料整理员" : "发掘队员"}
            </Badge>
          </div>
          <button
            className="ghost"
            onClick={() => {
              if (window.confirm("重置为初始示例数据？本机改动将丢失。")) actions.resetAll();
            }}
          >
            重置数据
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewPage wb={wb} />}
      {tab === "register" && <RegisterPage wb={wb} />}
      {tab === "handover" && <HandoverPage wb={wb} />}
      {tab === "trace" && <TracePage wb={wb} />}
    </main>
  );
}

export default App;
