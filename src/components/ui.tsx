// 页面共用的小组件

import type { ReactNode } from "react";

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
