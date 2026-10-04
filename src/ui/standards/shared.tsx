/* Small pieces shared by the Standards views and panels. */

import type { ReactNode } from "react";
import {
  useCore, navigate, openObject, moduleEnabled, fmtDate, OBLIGATION_TONE,
  type ObligationState, type ObligationView, type SubjectInfo, type CheckRunState, type Tone
} from "../../core";
import { toneColor, toneSoft } from "../frame";
import "../../styles/standards.css";

export type StdPanel =
  | { kind: "obligation"; key: string }
  | { kind: "requirement"; id: string }
  | { kind: "check"; id: string }
  | { kind: "policy"; id: string }
  | { kind: "receive" }
  | null;
export type OpenStd = (p: StdPanel) => void;

/** Short labels for matrix cells and lists. Text always travels with the colour. */
export const SHORT: Record<ObligationState, string> = {
  missing: "Missing", received: "Received", under_review: "In review", approved: "Approved", rejected: "Rejected", expired: "Expired"
};

export const CHECK_LABEL: Record<CheckRunState, string> = { due: "Due", overdue: "Overdue", passed: "Passed", failed: "Failed" };
export const CHECK_TONE: Record<CheckRunState, Tone> = { due: "neutral", overdue: "bad", passed: "ok", failed: "bad" };

/** Status in text and colour. */
export function Status({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className="std-status" style={{ background: toneSoft(tone), color: toneColor(tone) }} title={title}>
      <span className="std-status-dot" style={{ background: toneColor(tone) }} aria-hidden="true" />{children}
    </span>
  );
}

export function StatePill({ v, long }: { v: ObligationView; long?: boolean }) {
  const approvedNotApplied = v.state === "under_review" && v.review?.status === "approved";
  const text = long
    ? (v.state === "received" ? "Received, not reviewed" : approvedNotApplied ? "Review approved, not applied" : SHORT[v.state])
    : approvedNotApplied ? "Approved, not applied" : SHORT[v.state];
  const tone: Tone = v.expiring ? "warn" : OBLIGATION_TONE[v.state];
  return <Status tone={tone}>{text}{v.expiring ? ", renewal due" : ""}</Status>;
}

/** Open a subject where it lives, when its module is on. Locations and units have no page of their own. */
export function useSubjectLink() {
  const { core } = useCore();
  return (sub: SubjectInfo): (() => void) | null => {
    if (!sub.exists) return null;
    switch (sub.kind) {
      case "project": return moduleEnabled(core.config, "projects") ? () => openObject("project", sub.id) : null;
      case "person": return moduleEnabled(core.config, "people") ? () => openObject("person", sub.id) : null;
      case "record": return () => openObject("record", sub.id);
      case "supplier": return moduleEnabled(core.config, "purchasing") ? () => navigate({ page: "Purchasing", section: "suppliers", focus: { kind: "supplier", id: sub.id } }) : null;
      default: return null;
    }
  };
}

export function useDates() {
  const { core, ctx } = useCore();
  const tz = core.config.timezone;
  return { tz, now: ctx.now, d: (at?: string) => (at ? fmtDate(at, tz) : "None"), dy: (at?: string) => (at ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(new Date(at)) : "None") };
}

export function Two({ a, b }: { a: ReactNode; b?: ReactNode }) {
  return <span className="std-two"><span>{a}</span>{b ? <span>{b}</span> : null}</span>;
}

export function LinkBtn({ onClick, children, title }: { onClick: () => void; children: ReactNode; title?: string }) {
  return <button type="button" className="std-link" onClick={onClick} title={title}>{children}</button>;
}

export interface Col<T> { key: string; label: string; render: (row: T) => ReactNode; width?: number | string; hideNarrow?: boolean; align?: "left" | "right" }

/** List table: 14px text, 46px rows, scrolls inside its card on narrow screens. Rows open with click or Enter. */
export function StdTable<T>({ rows, cols, rowKey, onOpen, empty, label }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onOpen?: (r: T) => void; empty: ReactNode; label: string }) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="std-wrap">
      <table className="std-table" aria-label={label}>
        <thead>
          <tr>{cols.map((c) => <th key={c.key} scope="col" className={c.hideNarrow ? "std-hn" : undefined} style={{ width: c.width, textAlign: c.align || "left" }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} tabIndex={onOpen ? 0 : undefined} className={onOpen ? "std-tr" : undefined} onClick={() => onOpen?.(r)}
              onKeyDown={(e) => { if (onOpen && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(r); } }}>
              {cols.map((c) => <td key={c.key} className={c.hideNarrow ? "std-hn" : undefined} style={{ textAlign: c.align || "left" }}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
