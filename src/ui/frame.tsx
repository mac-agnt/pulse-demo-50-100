/* Page frame in the original Pulse design language: a large page title under a
   mono eyebrow (MODULE · PAGE · SCOPE), a stat strip, segmented views with a
   sliding thumb, filter chips, glass cards, alert callouts and KPI tiles.
   Every working page uses these so the product reads as one design. */

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Tone } from "../core";

export const glass: CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--card-r,18px)",
  backdropFilter: "blur(20px) saturate(1.3)", boxShadow: "var(--card-shadow)"
};

export const mono: CSSProperties = { fontFamily: "var(--mono)" };

export function PageFrame({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className="pf-page" style={{ maxWidth: wide ? 1480 : 1280 }}>{children}</div>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="pf-eyebrow" style={style}>{children}</div>;
}

/** Big page title with eyebrow, info dot, one-line description, actions on the right. */
export function Hero({ eyebrow, title, blurb, actions, aside, children, infoOnly }: {
  eyebrow: string; title: string; blurb?: ReactNode; actions?: ReactNode; aside?: ReactNode; children?: ReactNode;
  /** Show the description only as the "i" tooltip, as the original Tasks and Approvals pages did. */
  infoOnly?: boolean;
}) {
  return (
    <div className="pf-hero">
      <div className="pf-hero-main">
        <Eyebrow>{eyebrow}</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <h1 className="pf-title">{title}</h1>
          {typeof blurb === "string" && <span className="pf-info" title={blurb} aria-hidden="true">i</span>}
        </div>
        {blurb && !infoOnly && <div className="pf-blurb">{blurb}</div>}
        {children}
      </div>
      {(actions || aside) && (
        <div className="pf-hero-side">
          {actions && <div className="pf-actions">{actions}</div>}
          {aside}
        </div>
      )}
    </div>
  );
}

export interface Stat { label: string; value: string; color?: string; icon?: string; onClick?: () => void; title?: string }

/** The original stat strip: an optional ink "add" button, then large mono figures. */
export function StatStrip({ stats, onAdd, addLabel }: { stats: Stat[]; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="pf-stats">
      {onAdd && (
        <button type="button" className="pf-add" onClick={onAdd} aria-label={addLabel || "Add"} title={addLabel}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14 M5 12h14" /></svg>
        </button>
      )}
      <div className="pf-stat-row">
        {stats.map((s) => {
          const body = (
            <>
              <div className="pf-stat-label">
                {s.icon && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>}
                {s.label}
              </div>
              <div className="pf-stat-value" style={{ color: s.color || "var(--ink)" }}>{s.value}</div>
            </>
          );
          return s.onClick
            ? <button key={s.label} type="button" className="pf-stat pf-stat--btn" onClick={s.onClick} title={s.title}>{body}</button>
            : <div key={s.label} className="pf-stat" title={s.title}>{body}</div>;
        })}
      </div>
    </div>
  );
}

/** Segmented views with the sliding pill thumb from the original design. */
export function SegTabs<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string; count?: number | string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const w = wrap.current, t = thumb.current;
    const btn = w?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!w || !t || !btn) { if (t) t.style.opacity = "0"; return; }
    t.style.opacity = "1";
    t.style.width = btn.offsetWidth + "px";
    t.style.transform = "translateX(" + btn.offsetLeft + "px)";
  });
  return (
    <div ref={wrap} className="pf-seg" role="group" aria-label={label}>
      <span ref={thumb} className="pf-seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <span className="pf-seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A filter chip that is a real select underneath. */
export function FilterChip({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  const cur = options.find((o) => o.value === value) || options[0];
  return (
    <label className="pf-chip" data-on={value !== options[0]?.value}>
      <span>{cur?.label}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Btn({ children, onClick, primary, disabled, title, small }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string; small?: boolean }) {
  return <button type="button" className={"pf-btn" + (primary ? " pf-btn--primary" : "") + (small ? " pf-btn--sm" : "")} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

const TONE: Record<Tone, [string, string]> = {
  ok: ["var(--ok)", "var(--ok-soft)"], warn: ["var(--warn)", "var(--warn-soft)"], bad: ["var(--bad)", "var(--bad-soft)"],
  accent: ["var(--accent)", "var(--accent-faint)"], neutral: ["var(--dim)", "var(--track)"]
};
export const toneColor = (t: Tone) => TONE[t][0];
export const toneSoft = (t: Tone) => TONE[t][1];

/** Status pill in the original style: square dot, text, tinted background. */
export function Pill({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className="pf-pill" style={{ background: TONE[tone][1], color: TONE[tone][0] }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 2, background: TONE[tone][0], flex: "none" }} />}
      {children}
    </span>
  );
}

/** Card with an optional title row. */
export function Panel({ title, meta, right, children, style, pad = true }: { title?: ReactNode; meta?: ReactNode; right?: ReactNode; children: ReactNode; style?: CSSProperties; pad?: boolean }) {
  return (
    <section className="pf-panel" style={style}>
      {(title || right) && (
        <div className="pf-panel-h">
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div className="pf-panel-t">{title}</div>}
            {meta && <div className="pf-panel-m">{meta}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={pad ? { padding: "0 20px 18px" } : undefined}>{children}</div>
    </section>
  );
}

/** Alert banner with what happened and what you can do. */
export function Callout({ tone = "bad", eyebrow, title, children, actions }: { tone?: Tone; eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pf-callout" style={{ borderColor: TONE[tone][0], background: "linear-gradient(90deg," + TONE[tone][1] + ",transparent 80%), var(--surface)" }} role="note">
      <div className="pf-eyebrow" style={{ color: TONE[tone][0], display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[tone][0] }} />{eyebrow}
      </div>
      <div className="pf-callout-t">{title}</div>
      {children && <div className="pf-callout-b">{children}</div>}
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>{actions}</div>}
    </div>
  );
}

/** KPI tile: label, big value, a one-line basis. Click to see the working. */
export function KpiTile({ label, value, sub, tone, onClick, badge }: { label: string; value: string; sub?: ReactNode; tone?: Tone; onClick?: () => void; badge?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={"pf-kpi" + (onClick ? " pf-kpi--btn" : "")} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone ? TONE[tone][0] : "var(--neutral)" }} />
        <span className="pf-kpi-l">{label}</span>
        {badge && <span className="pf-eyebrow" style={{ marginLeft: "auto", fontSize: 9 }}>{badge}</span>}
      </div>
      <div className="pf-kpi-v" style={{ color: tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn)" : "var(--ink)" }}>{value}</div>
      {sub && <div className="pf-kpi-s">{sub}</div>}
    </Tag>
  );
}

export function Avatar({ initials, size = 32, round = true, tone }: { initials: string; size?: number; round?: boolean; tone?: string }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flex: "none", borderRadius: round ? "50%" : 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: tone || "var(--surface-2)", border: "1px solid var(--border)", color: "var(--body)", fontSize: Math.round(size * 0.34), fontWeight: 600 }}>{initials}</span>
  );
}

/** Eyebrow text for a page: MODULE · PAGE · SCOPE. */
export const eyebrowOf = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).map((p) => String(p).toUpperCase()).join(" · ");
