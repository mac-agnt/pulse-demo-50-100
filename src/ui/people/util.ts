/* Small helpers for the People page. Everything here reads core rows; nothing
   is invented. Who may act mirrors the rule in core ops (peopleAuthority): the
   person's manager, a manager of their team or unit, or an administrator. The
   op re-checks it at execution time, so this only decides what is enabled. */

import { can, fmtDate, ms, DAY } from "../../core";
import type { CoreState, Employment, Id, LeaveEntry, Q, RoleScope, Task, Tone } from "../../core";
import type { PersonRow } from "../../core/people";

export const STAGE_LABEL: Record<Employment["stage"], string> = {
  onboarding: "Onboarding", probation: "Probation", active: "Active", leaving: "Leaving", left: "Left"
};
export const STAGE_TONE: Record<Employment["stage"], Tone> = {
  onboarding: "accent", probation: "warn", active: "ok", leaving: "neutral", left: "neutral"
};
export const CONTRACT_LABEL: Record<Employment["contract"], string> = {
  "full-time": "Full time", "part-time": "Part time", contractor: "Contractor", temporary: "Temporary"
};
/** Absence reasons stay with the people allowed to see employment details. */
export const LEAVE_LABEL: Record<LeaveEntry["kind"], string> = {
  annual: "Annual leave", sick: "Sick leave", training: "Training", other: "Other leave"
};

export function canManage(q: Q, e: Employment): boolean {
  const v = q.viewer;
  if (v.isOrgWide) return true;
  if (e.managerId === v.person.id) return true;
  if (!can(v, "tasks.manage")) return false;
  return (!!e.teamId && v.overseenTeamIds.includes(e.teamId)) || (!!e.unitId && v.overseenUnitIds.includes(e.unitId));
}

export const isManagerViewer = (q: Q) => q.viewer.isOrgWide || can(q.viewer, "tasks.manage");

/** A renewal task already exists for this certificate's current expiry. */
export function renewalBooked(core: CoreState, personId: Id, certId: Id, expires: string | null): boolean {
  const key = "cert:" + personId + ":" + certId + ":" + (expires || "none");
  return core.data.tasks.some((t) => t.instanceKey === key && t.status !== "cancelled");
}

export function checklistTasks(core: CoreState, personId: Id, which: "onboarding" | "offboarding"): Task[] {
  const prefix = which + ":" + personId + ":";
  return core.data.tasks.filter((t) => !!t.instanceKey && t.instanceKey.startsWith(prefix) && t.status !== "cancelled");
}

/** Date with the year, for start dates that can be years back. */
export function fmtYear(at: string | undefined, tz: string): string {
  if (!at) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(new Date(at));
}

export const dayLabel = (at: string | undefined | null, tz: string) => (at ? fmtDate(at, tz) : "Not set");

export function daysFrom(at: string, now: string): number {
  return Math.round((ms(at) - ms(now)) / DAY);
}

/** "in 9 d", "today", "6 d ago". */
export function inDays(days: number): string {
  if (days === 0) return "today";
  if (Math.abs(days) > 60) { const m = Math.round(Math.abs(days) / 30.4); return days > 0 ? "in " + m + " months" : m + " months ago"; }
  return days > 0 ? "in " + days + " d" : -days + " d ago";
}

export function rangeLabel(from: string, to: string, tz: string): string {
  const a = fmtDate(from, tz), b = fmtDate(to, tz);
  return a === b ? a : a + " to " + b;
}

/** Certificates summary for a row: tone and text. */
export function certSummary(r: PersonRow, tz: string): { tone: Tone; text: string } {
  if (!r.certs.length) return { tone: "neutral", text: "No certificates" };
  const lapsed = r.certs.filter((c) => c.state === "lapsed");
  if (lapsed.length) return { tone: "bad", text: lapsed.length > 1 ? lapsed.length + " lapsed" : lapsed[0].cert.name + " lapsed" };
  const due = r.certs.filter((c) => c.state === "due").sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  if (due.length) return { tone: "warn", text: due[0].cert.name + " due " + fmtDate(due[0].cert.expires || undefined, tz) + (due.length > 1 ? " +" + (due.length - 1) : "") };
  const missing = r.certs.filter((c) => c.state === "missing");
  if (missing.length && r.e.stage === "onboarding") return { tone: "neutral", text: "Not recorded yet" };
  if (missing.length) return { tone: "warn", text: missing.length > 1 ? missing.length + " not recorded" : missing[0].cert.name + " not recorded" };
  return { tone: "ok", text: r.certs.length + " in date" };
}

/** Documents summary for a row. */
export function docSummary(r: PersonRow): { tone: Tone; text: string } {
  const docs = r.e.documents;
  if (!docs.length) return { tone: "neutral", text: "No documents" };
  const open = docs.filter((d) => !d.signedAt);
  if (!open.length) return { tone: "ok", text: "Signed" };
  if (open.length > 1) return { tone: "warn", text: open.length + " to sign" };
  return { tone: "warn", text: shortDoc(open[0].title) + " unsigned" };
}

/** "Staff handbook, current edition" reads as "Staff handbook". */
export const shortDoc = (title: string) => title.split(",")[0];

export function scopeText(core: CoreState, sc: RoleScope): string {
  if (sc.kind === "organisation") return "Whole " + core.config.terminology.organisation.toLowerCase();
  if (sc.kind === "unit") return core.config.units.find((u) => u.id === sc.unitId)?.label || "Unknown unit";
  return core.config.teams.find((t) => t.id === sc.teamId)?.label || "Unknown team";
}

export function rolesOf(core: CoreState, personId: Id): { id: Id; label: string; scope: string }[] {
  return core.data.roleAssignments.filter((r) => r.personId === personId).map((r) => ({
    id: r.id, label: core.config.roles.find((x) => x.id === r.roleId)?.label || r.roleId, scope: scopeText(core, r.scope)
  }));
}

/** Today in YYYY-MM-DD for date inputs. */
export const isoDay = (at: string) => at.slice(0, 10);

export const ICONS = {
  team: "M4.5 20V6.4A1.4 1.4 0 0 1 5.9 5h6.2a1.4 1.4 0 0 1 1.4 1.4V20 M13.5 10.5h4.6A1.4 1.4 0 0 1 19.5 12v8 M3 20h18",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5V12l3 2",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20.5a7.5 7.5 0 0 1 15 0",
  cal: "M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14.2a6.5 6.5 0 0 1 3.5 5.8",
  seed: "M12 20v-8 M12 12c0-4 3-7 7-7 0 4-3 7-7 7Z M12 14c0-3-2.5-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5Z",
  badge: "M12 3l2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1Z M9 12l2 2 4-4",
  away: "M12 3v2 M12 19v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M3 12h2 M19 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  doc: "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z M14 3.5V8h4 M9 13h6 M9 16.5h4",
  pen: "M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4",
  tasks: "M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01",
  shield: "M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6L12 3Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4",
  plus: "M12 5v14 M5 12h14",
  download: "M12 4v11 M7 10l5 5 5-5 M5 19.5h14",
  leave: "M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z M9.5 14.5l2 2 3.5-3.5",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  close: "M6 6l12 12 M18 6 6 18"
};
