import { useEffect, type ReactNode } from "react";
import { colorFor, initials } from "../lib/format";
import { Icon } from "./Icon";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/** Marks a screen whose backend step is not built yet. */
export function SampleBadge({ step }: { step: string }) {
  return (
    <span className="sample" title={`This screen shows sample data until ${step} is built.`}>
      Sample data · {step}
    </span>
  );
}

export function PageHead({ title, subtitle, actions, badge }: { title: string; subtitle?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="row-between">
      <div className="page-head">
        <div className="row" style={{ gap: 10 }}>
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} id={`tab-${t.id}`} className="tab" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Steps({ steps, current }: { steps: { title: string; text?: string }[]; current: number }) {
  return (
    <ol className="steps" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((s, i) => (
        <li key={s.title} className={`step ${i === current ? "active" : i < current ? "done" : ""}`}>
          <span className="step-dot">{i < current ? <Icon name="check" size={16} /> : i + 1}</span>
          <span className="step-text">
            <b>{s.title}</b>
            {s.text && <span>{s.text}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ background: colorFor(name), width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </span>
  );
}

export function Tile({ name }: { name: string }) {
  return (
    <span className="tile" style={{ background: colorFor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  const icon = tone === "success" ? "check" : tone === "info" ? "help" : "alert";
  return (
    <div className={`notice notice-${tone}`}>
      <span style={{ flex: "none", marginTop: 1 }}>
        <Icon name={icon} size={18} />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="stack-sm" style={{ gap: 2 }}>
            <h2>{title}</h2>
            {subtitle && <span className="muted small">{subtitle}</span>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Choice({ checked, disabled, onSelect, children, id }: { checked: boolean; disabled?: boolean; onSelect: () => void; children: ReactNode; id?: string }) {
  return (
    <button type="button" id={id} className="choice" role="radio" aria-checked={checked} aria-disabled={disabled} onClick={() => !disabled && onSelect()}>
      <span className="radio" />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </button>
  );
}

export function Qty({ value, min = 1, max = 100, onChange }: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper-qty">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="num" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

/** Copy text; falls back to selecting nothing when the clipboard is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
