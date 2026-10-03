/* The Records hero in the original Pulse design: a centred eyebrow pill, a large
   title, a short blurb and the "ask in your own words" search field with its
   kind tag, suggestion chips and answer line. Every non-ontology Records tab
   uses it, and its search is the only search on the page: it drives the list
   below. Theme tokens only (styles/records.css). */

import { Fragment, type ReactNode } from "react";
import { Avatar } from "../frame";
import "../../styles/records.css";

/* ── Search ────────────────────────────────────────────────────────────── */

const STOP = new Set(["the", "and", "for", "who", "any", "anyone", "all", "are", "with", "from", "that", "show", "find", "list", "get", "me", "of", "in", "on", "to", "a", "an", "is"]);

/** The words of a hero search that carry meaning. */
export function termsOf(query: string): string[] {
  return query.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}@._-]/gu, "")).filter((w) => w.length > 1 && !STOP.has(w));
}

/** Every term must appear somewhere in the text. */
export function matchesAll(hay: string, terms: string[]): boolean {
  if (!terms.length) return true;
  const h = hay.toLowerCase();
  return terms.every((t) => h.includes(t));
}

/** Text with the search terms marked. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || !text) return <>{text}</>;
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp("(" + esc.join("|") + ")", "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="rh-mark">{p}</mark> : <Fragment key={i}>{p}</Fragment>))}</>;
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

export interface HeroProps {
  eyebrow: string;
  title: string;
  blurb: ReactNode;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  /** KEYWORD or FULL TEXT. */
  kind: string;
  suggestions: string[];
  /** The answer line shown while searching. */
  answer: ReactNode;
  /** Buttons at the top right (New record, Save view, Export). */
  actions?: ReactNode;
  searchLabel: string;
  disabled?: boolean;
}

export function RecordsHero(p: HeroProps) {
  const asking = p.query.trim().length > 0;
  return (
    <div className="rh-hero">
      {p.actions && <div className="rh-actions">{p.actions}</div>}
      <span className="rh-eyebrow"><span className="rh-eyebrow-dot" aria-hidden="true" />{p.eyebrow}</span>
      <h1 className="rh-title">{p.title}</h1>
      <p className="rh-blurb">{p.blurb}</p>
      <div className="rh-ask">
        <div className="rh-field ixz">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "none" }} aria-hidden="true">
            <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
          </svg>
          <input type="search" value={p.query} onChange={(e) => p.onQuery(e.target.value)} placeholder={p.placeholder} aria-label={p.searchLabel}
            disabled={p.disabled} onKeyDown={(e) => { if (e.key === "Escape") p.onQuery(""); }} />
          {asking && (
            <button type="button" className="rh-clear ixm" onClick={() => p.onQuery("")} aria-label="Clear search" title="Clear search">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12 M18 6 6 18" /></svg>
            </button>
          )}
          <span className="rh-kind">{p.kind}</span>
        </div>
        <div className="rh-chips" aria-live="polite">
          {asking ? <span className="rh-answer">{p.answer}</span>
            : p.suggestions.map((s) => (
              <button key={s} type="button" className="rh-chip ixe" onClick={() => p.onQuery(s)}>{s}</button>
            ))}
        </div>
      </div>
    </div>
  );
}

/** The original round "+" button used for New record. */
export function HeroAdd({ onClick, label, disabled, title }: { onClick: () => void; label: string; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className="rh-add ix12 ixo" onClick={onClick} aria-label={label} title={title || label} disabled={disabled}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M12 5v14 M5 12h14" /></svg>
    </button>
  );
}

/** Glass card in the Records style (the original Directory card). */
export function RecCard({ title, caption, badge, right, children, footer }: {
  title: ReactNode; caption?: ReactNode; badge?: ReactNode; right?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <section className="rh-card">
      <div className="rh-card-h">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rh-card-t">{title}</div>
          {caption && <div className="rh-card-c">{caption}</div>}
        </div>
        {right}
        {badge !== undefined && <span className="rh-badge">{badge}</span>}
      </div>
      {children}
      {footer && <div className="rh-card-f">{footer}</div>}
    </section>
  );
}

/** Empty state inside a Records card. */
export function RecEmpty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rh-empty">
      <div className="rh-empty-t">{title}</div>
      {body && <div className="rh-empty-b">{body}</div>}
      {action && <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>{action}</div>}
    </div>
  );
}

/** Tinted initials, using theme tokens only. */
const TINTS = ["var(--accent-faint)", "var(--ok-soft)", "var(--warn-soft)", "var(--surface-2)", "var(--track)"];
export function Initials({ name, initials, size = 28 }: { name: string; initials: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return <Avatar initials={initials} size={size} round={false} tone={TINTS[h % TINTS.length]} />;
}

/** Page wrapper that sits above the Records wash. */
export function RecPage({ children }: { children: ReactNode }) {
  return <div className="rh-page">{children}</div>;
}

export const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
