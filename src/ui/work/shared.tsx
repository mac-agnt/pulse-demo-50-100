/* Small pieces shared by the Work views and panels. Everything reads through
   the query layer, so a name, date or status looks the same in every panel. */

import { useState, type ReactNode } from "react";
import { useCore, can, fmtDateTime, relative, ms, zonedTime } from "../../core";
import type { AuditEvent, CoreState, FieldDef, FieldValue, Id, RequestFormDef, RequestItem, Schedule, Tone } from "../../core";
import { Chip, PersonName, Icon, ICON, store } from "../kit";
import type { Result } from "../../core/ops";
import type { Ctx } from "../../core";
import "../../styles/work.css";

export type PanelKind = "task" | "approval" | "request" | "run" | "schedule" | "template" | "newTask" | "newRequest" | "newSchedule";
/** intent "decide" opens an approval with the decision box focused (Decline and Return need a reason).
    due prefills a new task's due date (YYYY-MM-DD). */
export interface PanelState { kind: PanelKind; id?: string; intent?: "decide"; due?: string }
export type OpenPanel = (p: PanelState | null) => void;

/** Timezone and clock for the current organisation. */
export function useClock() {
  const { core, ctx } = useCore();
  const tz = core.config.timezone;
  return {
    tz,
    now: ctx.now,
    rel: (at?: string) => relative(at, ctx.now, tz),
    dt: (at?: string) => (at ? fmtDateTime(at, tz) : "None")
  };
}

/** A local calendar date (YYYY-MM-DD) to 17:00 that day in the organisation's timezone. */
export function endOfDay(date: string, tz: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return undefined;
  return zonedTime(Number(m[1]), Number(m[2]), Number(m[3]), 17, 0, tz);
}

export function useViewer() {
  const { q } = useCore();
  const v = q.viewer;
  const me = v.person.id;
  const oversees = (teamId?: Id) => v.isOrgWide || (!!teamId && v.overseenTeamIds.includes(teamId));
  const inTeam = (teamId?: Id) => v.isOrgWide || (!!teamId && (v.memberTeamIds.includes(teamId) || v.overseenTeamIds.includes(teamId)));
  return { v, me, can: (p: Parameters<typeof can>[1]) => can(v, p), oversees, inTeam };
}

export const SCHEDULE_KIND: Record<Schedule["kind"], string> = { "recurring-task": "Recurring task", automation: "Automation", report: "Report" };

/** Wall-clock pieces in the organisation's timezone. */
export function clockText(at: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
}

/** "08:54" today, otherwise "12 Mar". */
export function shortWhen(at: string | undefined, now: string, tz: string) {
  if (!at) return "";
  const same = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(at)) === new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(now));
  return same ? clockText(at, tz) : new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(at));
}

/** Age of something in the original card style: 18m, 3h, Yesterday, 4 days. */
export function ageText(at: string | undefined, now: string) {
  if (!at) return "";
  const m = Math.max(0, Math.round((ms(now) - ms(at)) / 60000));
  if (m < 60) return Math.max(1, m) + "m";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h";
  if (h < 48) return "Yesterday";
  return Math.round(h / 24) + " days";
}

/** Line icons used across the Work views (same paths as the original design). */
export const WI = {
  list: "M4 6.5h3 M4 12h3 M4 17.5h3 M10 6.5h10 M10 12h10 M10 17.5h10",
  cal: "M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z",
  alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6v5 M12 16h.01",
  done: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M8.4 12.2l2.4 2.4 4.8-4.8",
  building: "M4.5 20V6.4A1.4 1.4 0 0 1 5.9 5h6.2a1.4 1.4 0 0 1 1.4 1.4V20 M13.5 10.5h4.6A1.4 1.4 0 0 1 19.5 12v8 M3 20h18",
  day: "M7 4.5v3 M17 4.5v3 M4 10h16 M5.6 6.6h12.8A1.6 1.6 0 0 1 20 8.2v10.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V8.2a1.6 1.6 0 0 1 1.6-1.6Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3 1.8",
  flag: "M5 20V4.6h9l-1 3.4h6.4L18 12h1.4l-9.6 5.4V20",
  play: "M7 4.5v15l13-7.5-13-7.5Z",
  pause: "M9 5.5v13 M15 5.5v13",
  reset: "M3.5 5.5v5h5 M4.2 14a8 8 0 1 0 .3-5.3",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14 M5 12h14",
  eye: "M2.6 12S6.4 5.5 12 5.5 21.4 12 21.4 12 17.6 18.5 12 18.5 2.6 12 2.6 12Z M14.6 12a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0Z",
  doc: "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z M14 3.5V8h4",
  link: "M9.5 14.5l5-5 M10.6 6.7l1.3-1.3a3.8 3.8 0 0 1 5.4 5.4L16 12.1 M13.4 17.3l-1.3 1.3a3.8 3.8 0 0 1-5.4-5.4L8 11.9",
  lock: "M7 11V8a5 5 0 0 1 10 0v3 M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z",
  hand: "M8 12V6.5a1.5 1.5 0 0 1 3 0V11 M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5 M14 10.5V7a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.4 6.5-6 6.5-2.4 0-3.7-1-5-3l-2.2-3.6a1.5 1.5 0 0 1 2.5-1.6L8 13.5"
};

/** A stroked line icon. */
export function Ico({ d, size = 12, sw = 1.7, color }: { d: string; size?: number; sw?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The original switch: a square-ish track with a sliding knob. */
export function Toggle({ on, onChange, label, disabled, title }: { on: boolean; onChange: () => void; label: string; disabled?: boolean; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="wk-toggle" disabled={disabled} title={title}
      onClick={(e) => { e.stopPropagation(); onChange(); }}>
      <span />
    </button>
  );
}

export const isAgent = (id?: string | null) => !!id && id.startsWith("ag-");

/** Request status chip: text always present. */
export const REQ_TONE: Record<string, Tone> = {
  draft: "neutral", submitted: "accent", changes_requested: "warn", approved: "ok", declined: "bad", withdrawn: "neutral"
};

export const RUN_STEP_LABEL: Record<string, string> = {
  done: "Done", current: "Current", waiting: "Waiting", failed: "Failed", pending: "Not started", skipped: "Skipped"
};
export const RUN_STEP_TONE: Record<string, Tone> = {
  done: "ok", current: "accent", waiting: "warn", failed: "bad", pending: "neutral", skipped: "neutral"
};

export function Rows({ children }: { children: ReactNode }) {
  return <div className="pk-list">{children}</div>;
}

/** A row in a list that opens something. */
export function LinkRow({ onClick, children, right, title }: { onClick?: () => void; children: ReactNode; right?: ReactNode; title?: string }) {
  if (!onClick) return <div className="pk-li">{children}<span className="pk-grow" />{right}</div>;
  return (
    <button type="button" className="pk-li pk-li--btn" onClick={onClick} title={title}>
      {children}<span className="pk-grow" />{right}<Icon d={ICON.arrow} size={12} />
    </button>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <div className="wk-muted">{children}</div>;
}

/** Audit events for a set of object ids, newest first. */
export function History({ ids, empty = "No history yet." }: { ids: Id[]; empty?: string }) {
  const { q } = useCore();
  const { dt } = useClock();
  const events: AuditEvent[] = q.events({ ignoreScope: true }).filter((e) => ids.includes(e.objectId)).sort((a, b) => b.at.localeCompare(a.at));
  if (!events.length) return <Muted>{empty}</Muted>;
  return (
    <Rows>
      {events.slice(0, 30).map((e) => (
        <div key={e.id} className="pk-li wk-event">
          <span className="wk-event-who"><PersonName id={e.actorId} /></span>
          <span className="pk-grow wk-wrap">{e.summary}{e.onBehalfOfId ? " (on behalf of " + q.name(e.onBehalfOfId) + ")" : ""}{e.simulated ? " (simulated)" : ""}</span>
          <span className="pk-mono wk-time">{dt(e.at)}</span>
        </div>
      ))}
    </Rows>
  );
}

/** Format a request field value for reading. */
export function useFieldText() {
  const { q, core } = useCore();
  const { tz } = useClock();
  return (def: FieldDef | undefined, v: FieldValue | undefined): string => {
    if (v === null || v === undefined || v === "") return "Not given";
    if (!def) return String(v);
    switch (def.kind) {
      case "record": { const r = q.record(String(v)); return r ? r.ref + " " + r.title : "A record you cannot see"; }
      case "file": { const f = q.file(String(v)); return f ? f.title : "A document you cannot see"; }
      case "person": {
        const p = core.data.people.find((x) => x.id === v);
        return p ? p.name + (p.organisation ? " (" + p.organisation + ")" : "") : "Unknown person";
      }
      case "money": {
        const n = Number(v);
        return isFinite(n) ? new Intl.NumberFormat("en-GB", { style: "currency", currency: def.currency || "EUR", maximumFractionDigits: 2 }).format(n) : String(v);
      }
      case "select": return def.options?.find((o) => o.value === v)?.label || String(v);
      case "date": {
        const t = ms(String(v).length === 10 ? String(v) + "T12:00:00Z" : String(v));
        return isFinite(t) ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(new Date(t)) : String(v);
      }
      default: return String(v);
    }
  };
}

export function formOf(core: CoreState, req: RequestItem): RequestFormDef | undefined {
  return core.config.requestForms.find((f) => f.id === req.formId);
}

/** Inline error that stays in context after an operation is refused. */
export function InlineError({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="pk-error wk-inline-err" role="alert">{text}</div>;
}

export function StatusChip({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return <Chip tone={tone} title={title}>{children}</Chip>;
}

/** Run an operation and keep its refusal visible next to the control that caused it. */
export function useRunner() {
  const [err, setErr] = useState<string | null>(null);
  function run<A extends unknown[]>(op: (s: CoreState, ctx: Ctx, ...a: A) => Result, ...a: A): Result {
    const r = store.run(op, ...a);
    setErr(r.ok ? null : r.error);
    return r;
  }
  return { err, setErr, run };
}
