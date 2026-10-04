/* Calendar and capacity. One query combines permitted task deadlines, project
   milestones, business appointments and, as a separate layer, automation
   schedules. Appointment changes go through the ops here (own appointment,
   or tasks.manage over its team) and leave an audit event. Weekly allocation
   compares scheduled hours with task estimates; work without an estimate is
   counted as unestimated, never as zero hours. */

import { can, viewerOf } from "./access";
import { draft, logEvent, nid, type Result } from "./ops";
import { employment } from "./people";
import { moduleEnabled } from "./modules";
import type { Q } from "./query";
import { cadenceLabel, iso, localDay, ms, nextOccurrence, zonedTime, DAY } from "./time";
import type { Appointment, CoreState, Ctx, Id, Schedule, Task } from "./types";

/* ── Appointments ──────────────────────────────────────────────────────── */

export interface NewAppointment {
  title: string;
  startAt: string;
  minutes: number;
  ownerId?: Id;
  attendeeIds?: Id[];
  teamId?: Id;
  locationId?: Id;
  projectId?: Id;
  note?: string;
}

const fail = (error: string): Result => ({ ok: false, error });
const nameOf = (s: CoreState, id?: Id | null) => s.data.people.find((p) => p.id === id)?.name || "Unknown";

/** Who may change an appointment: its owner, or a manager of its team (or an organisation-wide manager). */
export function appointmentAuthority(s: CoreState, ctx: Ctx, a: { ownerId: Id; teamId?: Id }): string | null {
  if (a.ownerId === ctx.viewerId) return null;
  const v = viewerOf(s, ctx.viewerId);
  if (can(v, "tasks.manage") && (v.isOrgWide || (!!a.teamId && v.overseenTeamIds.includes(a.teamId)))) return null;
  return "Only the owner of this appointment or a manager of its team can change it.";
}

function validate(s: CoreState, ctx: Ctx, n: NewAppointment): string | null {
  if (!n.title.trim()) return "Give the appointment a title.";
  if (!n.startAt || isNaN(Date.parse(n.startAt))) return "Pick a start date and time.";
  if (!Number.isFinite(n.minutes) || n.minutes < 5 || n.minutes > 24 * 60) return "Length must be between 5 minutes and 24 hours.";
  const owner = s.data.people.find((p) => p.id === (n.ownerId || ctx.viewerId));
  if (!owner || owner.kind !== "staff" || owner.status === "suspended") return "The owner must be an active member of staff.";
  for (const id of n.attendeeIds || []) if (!s.data.people.some((p) => p.id === id)) return "One of the attendees is not a known person.";
  if (n.teamId && !s.config.teams.some((t) => t.id === n.teamId)) return "Unknown team.";
  if (n.locationId && !s.config.locations.some((l) => l.id === n.locationId)) return "Unknown location.";
  if (n.projectId && !s.data.projects.some((p) => p.id === n.projectId)) return "Unknown project.";
  return null;
}

export function createAppointment(s0: CoreState, ctx: Ctx, n: NewAppointment): Result {
  const ownerId = n.ownerId || ctx.viewerId;
  const v = viewerOf(s0, ctx.viewerId);
  const teamId = n.teamId || (ownerId === ctx.viewerId ? v.memberTeamIds[0] : undefined);
  const auth = appointmentAuthority(s0, ctx, { ownerId, teamId });
  if (auth) return fail(ownerId === ctx.viewerId ? auth : "Only a manager of the team can book an appointment for someone else.");
  const bad = validate(s0, ctx, { ...n, ownerId });
  if (bad) return fail(bad);
  const s = draft(s0);
  const id = nid(s, "apt");
  const unitId = s.config.teams.find((t) => t.id === teamId)?.unitId;
  const attendeeIds = [...new Set((n.attendeeIds || []).filter((x) => x !== ownerId))];
  s.data.appointments.push({ id, title: n.title.trim(), startAt: new Date(n.startAt).toISOString(), minutes: Math.round(n.minutes), ownerId, attendeeIds,
    teamId, unitId, locationId: n.locationId, projectId: n.projectId, note: n.note?.trim() || undefined });
  logEvent(s, ctx, { action: "appointment.created", objectType: "appointment", objectId: id, recordIds: [], teamId, unitId, storyKey: "appointment:" + id,
    summary: "Booked " + n.title.trim() + (ownerId !== ctx.viewerId ? " for " + nameOf(s, ownerId) : "") });
  return { ok: true, state: s, message: "Appointment added to the calendar. Nobody is sent an invitation from this demo.", id };
}

export function updateAppointment(s0: CoreState, ctx: Ctx, id: Id, patch: Partial<NewAppointment>): Result {
  const a0 = s0.data.appointments.find((x) => x.id === id);
  if (!a0) return fail("Appointment not found.");
  const auth = appointmentAuthority(s0, ctx, a0);
  if (auth) return fail(auth);
  const next: NewAppointment = { title: patch.title ?? a0.title, startAt: patch.startAt ?? a0.startAt, minutes: patch.minutes ?? a0.minutes,
    ownerId: a0.ownerId, attendeeIds: patch.attendeeIds ?? a0.attendeeIds, teamId: patch.teamId ?? a0.teamId, locationId: patch.locationId ?? a0.locationId,
    projectId: patch.projectId ?? a0.projectId, note: patch.note ?? a0.note };
  if (patch.teamId && patch.teamId !== a0.teamId) {
    const moved = appointmentAuthority(s0, ctx, { ownerId: a0.ownerId, teamId: patch.teamId });
    if (moved) return fail(moved);
  }
  const bad = validate(s0, ctx, next);
  if (bad) return fail(bad);
  const s = draft(s0);
  const a = s.data.appointments.find((x) => x.id === id)!;
  const before = { title: a.title, startAt: a.startAt, minutes: a.minutes };
  a.title = next.title.trim();
  a.startAt = new Date(next.startAt).toISOString();
  a.minutes = Math.round(next.minutes);
  a.attendeeIds = [...new Set((next.attendeeIds || []).filter((x) => x !== a.ownerId))];
  a.teamId = next.teamId;
  a.unitId = s.config.teams.find((t) => t.id === next.teamId)?.unitId;
  a.locationId = next.locationId;
  a.projectId = next.projectId;
  a.note = next.note?.trim() || undefined;
  logEvent(s, ctx, { action: "appointment.updated", objectType: "appointment", objectId: id, recordIds: [], teamId: a.teamId, unitId: a.unitId, storyKey: "appointment:" + id,
    summary: "Changed " + a.title, before, after: { title: a.title, startAt: a.startAt, minutes: a.minutes } });
  return { ok: true, state: s, message: "Appointment updated." };
}

export function cancelAppointment(s0: CoreState, ctx: Ctx, id: Id, reason: string): Result {
  const a0 = s0.data.appointments.find((x) => x.id === id);
  if (!a0) return fail("Appointment not found.");
  const auth = appointmentAuthority(s0, ctx, a0);
  if (auth) return fail(auth);
  const s = draft(s0);
  s.data.appointments = s.data.appointments.filter((x) => x.id !== id);
  logEvent(s, ctx, { action: "appointment.cancelled", objectType: "appointment", objectId: id, recordIds: [], teamId: a0.teamId, unitId: a0.unitId, storyKey: "appointment:" + id,
    summary: "Cancelled " + a0.title + (reason.trim() ? ": " + reason.trim() : ""), before: { title: a0.title, startAt: a0.startAt } });
  return { ok: true, state: s, message: "Appointment cancelled. The history keeps a record of it." };
}

/** Appointments the viewer may see: owner, attendees, their team, or managers over it. */
export function canSeeAppointment(q: Q, a: Appointment): boolean {
  return q.canSee({ ownerIds: [a.ownerId, ...a.attendeeIds], teamId: a.teamId, unitId: a.unitId, visibility: "team" });
}

export function appointments(q: Q, opts: { ignoreScope?: boolean } = {}): Appointment[] {
  return (q.s.data.appointments || []).filter((a) => canSeeAppointment(q, a) && q.inScope(a, [a.ownerId, ...a.attendeeIds], opts));
}

/* ── Calendar ──────────────────────────────────────────────────────────── */

export type CalLayer = "task" | "milestone" | "appointment" | "schedule";

export interface CalItem {
  /** Unique per calendar entry: one entry per task, milestone, appointment or schedule slot. */
  key: string;
  layer: CalLayer;
  at: string;
  /** Local day in the organisation timezone (YYYY-MM-DD). */
  day: string;
  minutes?: number;
  title: string;
  ownerId: Id | null;
  object: { kind: "task" | "project" | "appointment" | "schedule"; id: Id };
  done?: boolean;
  overdue?: boolean;
  /** Task produced by a schedule. */
  scheduleId?: Id;
  projectId?: Id;
  /* Schedule layer only. */
  recurrence?: string;
  timezone?: string;
  nextRunAt?: string | null;
  produced?: boolean;
  past?: boolean;
  scheduleKind?: Schedule["kind"];
}

const keyParts = (k: string) => { const [y, m, d] = k.split("-").map(Number); return { y, m, d }; };
export const addDaysKey = (k: string, n: number) => {
  const p = keyParts(k);
  return new Date(Date.UTC(p.y, p.m - 1, p.d) + n * DAY).toISOString().slice(0, 10);
};
/** Monday of the week containing the day key (0 = Monday). */
export const mondayOf = (k: string) => {
  const p = keyParts(k);
  const wd = (new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7;
  return addDaysKey(k, -wd);
};
/** Start of a local day in a timezone, as an ISO instant. */
export const dayStart = (k: string, tz: string) => { const p = keyParts(k); return zonedTime(p.y, p.m, p.d, 0, 0, tz); };

/** Every occurrence of the given schedules between two local days. One per schedule and local day, ever. */
export function scheduleOccurrences(list: Schedule[], fromKey: string, toKeyExcl: string, tz: string, now: string) {
  const from = dayStart(fromKey, tz), to = dayStart(toKeyExcl, tz);
  const out: { s: Schedule; at: string; key: string; produced: boolean; past: boolean }[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    let at = nextOccurrence(s.cadence, iso(ms(from) - 60000), s.timezone);
    for (let i = 0; i < 64 && ms(at) < ms(to); i++) {
      if (ms(at) >= ms(from)) {
        const key = s.id + ":" + localDay(at, s.timezone);
        const produced = s.producedKeys.includes(key);
        if (!seen.has(key) && (produced || s.active)) {
          seen.add(key);
          out.push({ s, at, key, produced, past: ms(at) <= ms(now) });
        }
      }
      const next = nextOccurrence(s.cadence, at, s.timezone);
      if (next === at) break;
      at = next;
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Calendar entries between two local days (end exclusive), permission and scope applied. */
export function calendarItems(q: Q, fromKey: string, toKeyExcl: string, layers: CalLayer[] = ["task", "milestone", "appointment", "schedule"]): CalItem[] {
  const s = q.s;
  const tz = s.config.timezone;
  const now = q.ctx.now;
  const from = ms(dayStart(fromKey, tz)), to = ms(dayStart(toKeyExcl, tz));
  const inRange = (at?: string) => !!at && ms(at) >= from && ms(at) < to;
  const out: CalItem[] = [];
  const me = q.viewer.person.id;

  /* Tasks in scope plus everything assigned to the viewer, like Work. */
  const taskPool = new Map<Id, Task>();
  if (layers.includes("task") || layers.includes("schedule")) {
    for (const t of q.tasks()) taskPool.set(t.id, t);
    for (const t of q.tasks({ ignoreScope: true })) if (t.assigneeId === me) taskPool.set(t.id, t);
  }
  const shownTaskKeys = new Set<string>();
  if (layers.includes("task")) {
    for (const t of taskPool.values()) {
      if (t.status === "cancelled" || !inRange(t.dueAt)) continue;
      if (t.instanceKey) shownTaskKeys.add(t.instanceKey);
      out.push({ key: "task:" + t.id, layer: "task", at: t.dueAt!, day: localDay(t.dueAt!, tz), title: t.title, ownerId: t.assigneeId,
        object: { kind: "task", id: t.id }, done: t.status === "done", overdue: q.isOverdue(t), scheduleId: t.scheduleId, projectId: t.projectId });
    }
  }

  if (layers.includes("milestone") && moduleEnabled(s.config, "projects")) {
    for (const m of s.data.milestones || []) {
      if (!inRange(m.dueAt)) continue;
      const p = s.data.projects.find((x) => x.id === m.projectId);
      if (!p || p.status === "cancelled") continue;
      if (!q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility }) || !q.inScope(p, [p.ownerId])) continue;
      out.push({ key: "milestone:" + m.id, layer: "milestone", at: m.dueAt, day: localDay(m.dueAt, tz), title: m.label + " (" + p.title + ")", ownerId: p.ownerId,
        object: { kind: "project", id: p.id }, done: !!m.completedAt, overdue: !m.completedAt && ms(m.dueAt) < ms(now), projectId: p.id });
    }
  }

  if (layers.includes("appointment")) {
    for (const a of appointments(q)) {
      if (!inRange(a.startAt)) continue;
      out.push({ key: "appointment:" + a.id, layer: "appointment", at: a.startAt, day: localDay(a.startAt, tz), minutes: a.minutes, title: a.title,
        ownerId: a.ownerId, object: { kind: "appointment", id: a.id }, projectId: a.projectId, past: ms(a.startAt) + a.minutes * 60000 <= ms(now) });
    }
  }

  if (layers.includes("schedule")) {
    for (const o of scheduleOccurrences(q.schedules(), fromKey, toKeyExcl, tz, now)) {
      /* A recurring-task slot that already produced its task shows once: as that task. */
      if (o.produced && shownTaskKeys.has(o.key)) continue;
      out.push({ key: "schedule:" + o.key, layer: "schedule", at: o.at, day: localDay(o.at, tz), title: o.s.label, ownerId: o.s.ownerId,
        object: { kind: "schedule", id: o.s.id }, recurrence: cadenceLabel(o.s.cadence, o.s.timezone), timezone: o.s.timezone,
        nextRunAt: o.s.active ? nextOccurrence(o.s.cadence, now, o.s.timezone) : null, produced: o.produced, past: o.past, scheduleKind: o.s.kind });
    }
  }

  return out.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
}

/* ── Weekly allocation ─────────────────────────────────────────────────── */

export interface Allocation {
  personId: Id;
  /** Contracted hours a week, minus approved leave on working days in the week. */
  scheduledHours: number;
  leaveHours: number;
  availableHours: number;
  /** Sum of estimates on open tasks due in the week that have one. */
  estimatedHours: number;
  estimatedTaskIds: Id[];
  /** Open tasks due in the week without an estimate. Counted, never added as hours. */
  unestimatedTaskIds: Id[];
  /** Estimated hours over available hours; null when nothing is available. */
  load: number | null;
}

/** Allocation for each person whose employment the viewer may see, for the week starting on the given Monday. */
export function weeklyAllocation(q: Q, weekStartKey: string, opts: { ignoreScope?: boolean } = {}): Allocation[] {
  const tz = q.s.config.timezone;
  const start = ms(dayStart(weekStartKey, tz)), end = ms(dayStart(addDaysKey(weekStartKey, 7), tz));
  const workdays = [0, 1, 2, 3, 4].map((i) => addDaysKey(weekStartKey, i));
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => q.isOpenTask(t) && !!t.dueAt && ms(t.dueAt) >= start && ms(t.dueAt) < end);
  return employment(q, opts).map((e) => {
    const perDay = e.hoursPerWeek / 5;
    const leave = q.s.data.leave.filter((l) => l.personId === e.personId && l.status === "approved");
    const awayDays = workdays.filter((d) => leave.some((l) => localDay(l.from, tz) <= d && localDay(l.to, tz) >= d)).length;
    const leaveHours = Math.min(e.hoursPerWeek, awayDays * perDay);
    const mine = tasks.filter((t) => t.assigneeId === e.personId);
    const est = mine.filter((t) => typeof t.estimateHours === "number" && Number.isFinite(t.estimateHours) && t.estimateHours >= 0);
    const unest = mine.filter((t) => !est.includes(t));
    const estimatedHours = est.reduce((n, t) => n + (t.estimateHours as number), 0);
    const availableHours = Math.max(0, e.hoursPerWeek - leaveHours);
    return {
      personId: e.personId, scheduledHours: e.hoursPerWeek, leaveHours, availableHours,
      estimatedHours, estimatedTaskIds: est.map((t) => t.id), unestimatedTaskIds: unest.map((t) => t.id),
      load: availableHours > 0 ? estimatedHours / availableHours : null
    };
  });
}

/** Set or clear a task's effort estimate. The assignee or a manager of the task's team may do it.
    Clearing makes the task unestimated again; it is never stored as zero by accident. */
export function setTaskEstimate(s0: CoreState, ctx: Ctx, taskId: Id, hours: number | null): Result {
  const t0 = s0.data.tasks.find((t) => t.id === taskId);
  if (!t0) return fail("Task not found.");
  const v = viewerOf(s0, ctx.viewerId);
  const manages = can(v, "tasks.manage") && (v.isOrgWide || (!!t0.teamId && v.overseenTeamIds.includes(t0.teamId)));
  if (t0.assigneeId !== ctx.viewerId && !manages) return fail("Only the assignee or a manager of this team can set the estimate.");
  if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 400)) return fail("An estimate must be between 0 and 400 hours.");
  const s = draft(s0);
  const t = s.data.tasks.find((x) => x.id === taskId)!;
  const before = t.estimateHours ?? null;
  if (hours === null) delete t.estimateHours; else t.estimateHours = Math.round(hours * 4) / 4;
  logEvent(s, ctx, { action: "task.estimate", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, unitId: t.unitId,
    storyKey: t.projectId ? "project:" + t.projectId : "task:" + t.id,
    summary: hours === null ? "Cleared the estimate on " + t.title : "Estimated " + t.title + " at " + t.estimateHours + " h", before: { estimateHours: before }, after: { estimateHours: t.estimateHours ?? null } });
  return { ok: true, state: s, message: hours === null ? "Estimate cleared. The task now counts as unestimated." : "Estimate saved." };
}
