// 页面层：通用表单控件

import type { ReactNode } from "react";
import type { FeatureInput, FeatureKind, Feature } from "../data/types";

export const FEATURE_KINDS: FeatureKind[] = ["灰坑", "墓葬", "房址", "沟状遗迹", "灶址", "其他"];

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export interface DraftFormState {
  openingDepth: string;
  summary: string;
  features: Feature[];
}

export function FeatureRows({
  features,
  onChange,
}: {
  features: Feature[];
  onChange: (features: Feature[]) => void;
}) {
  const update = (index: number, patch: Partial<FeatureInput>) => {
    onChange(features.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };
  const remove = (index: number) => onChange(features.filter((_, i) => i !== index));
  const add = () =>
    onChange([...features, { id: "", code: "", kind: "灰坑", soil: "", note: "" }]);

  return (
    <div className="feature-editor">
      <div className="feature-editor-head">
        <span>遗迹单位（{features.length}）</span>
        <button type="button" className="link-btn" onClick={add}>
          + 添加遗迹
        </button>
      </div>
      {features.map((f, i) => (
        <div className="feature-row" key={i}>
          <input
            placeholder="单位号 如 H12"
            value={f.code}
            onChange={(e) => update(i, { code: e.target.value })}
          />
          <select value={f.kind} onChange={(e) => update(i, { kind: e.target.value as FeatureKind })}>
            {FEATURE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            placeholder="土色土质"
            value={f.soil}
            onChange={(e) => update(i, { soil: e.target.value })}
          />
          <input
            placeholder="备注"
            value={f.note}
            onChange={(e) => update(i, { note: e.target.value })}
          />
          <button type="button" className="icon-btn" onClick={() => remove(i)} title="删除遗迹">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
