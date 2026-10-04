/* Projects capability (optional module). Reads go through the query layer
   (q.canSee + q.inScope) so a project list, a dashboard figure and a unit
   profile agree. Every change is an operation here: pure (state, ctx, ...)
   => Result, authority rechecked inside, one audit event per change with
   storyKey "project:<id>" so a change reads as one linked history.

   Rules this file keeps:
   - Progress always says which basis it uses and what it leaves out. Task
     completion never stands for financial or physical completion.
   - Computed health is shown beside the owner-reported health, never instead.
   - A gate is satisfied only when every obligation it names is "approved".
   - A moved milestone lists its known downstream dependants. Dates of
     dependants change only when cascading is configured; otherwise they are
     proposed and flagged. Money is never recalculated here. */

import { can, viewerOf } from "./access";
import { registerMetric } from "./metrics";
import { createRequest, draft, logEvent, nid, registerDecisionHook, registerEffect, type Result } from "./ops";
import { query, type Q, type QueryOpts } from "./query";
import { DAY, fmtDate, localDay, ms, zonedTime } from "./time";
import type {
  AuditEvent, CoreState, Ctx, Health, Id, ISO, Milestone, ObligationState, OrgConfig, Project, ProjectPhaseDef, ProjectRisk,
  ProjectSettings, ProjectTemplateDef, ProjectTypeDef, Task
} from "./types";

const fail = (error: string): Result => ({ ok: false, error });
export const projectStory = (projectId: Id) => "project:" + projectId;
export const MILESTONE_FORM_ID = "form-milestone-change";

/* ── Labels and configuration ──────────────────────────────────────────── */

/** Configured names for the concept ("Project", "Engagement", "Initiative"). Ids never change with them. */
export function projectTerms(c: OrgConfig) {
  const one = c.projects?.label?.trim() || "Project";
  const many = c.projects?.plural?.trim() || one + "s";
  return { one, many, oneLower: one.toLowerCase(), manyLower: many.toLowerCase() };
}

export function projectTypeOf(c: OrgConfig, typeId: string): ProjectTypeDef | undefined {
  return c.projects.types.find((t) => t.id === typeId);
}

export function projectPhases(c: OrgConfig, p: { typeId: string }): ProjectPhaseDef[] {
  return projectTypeOf(c, p.typeId)?.phases || [];
}

export function projectPhaseLabel(c: OrgConfig, p: { typeId: string }, phaseId?: string): string {
  if (!phaseId) return "None";
  return projectPhases(c, p).find((x) => x.id === phaseId)?.label
    || c.projects.types.flatMap((t) => t.phases).find((x) => x.id === phaseId)?.label || "Unknown phase";
}

export const PROJECT_HEALTH_LABEL: Record<Health, string> = { on_track: "On track", at_risk: "At risk", off_track: "Off track" };
export const PROJECT_HEALTH_TONE: Record<Health, "ok" | "warn" | "bad"> = { on_track: "ok", at_risk: "warn", off_track: "bad" };
export const PROJECT_STATUS_LABEL: Record<Project["status"], string> = {
  planned: "Planned", active: "Active", on_hold: "On hold", completed: "Completed", cancelled: "Cancelled"
};
export const PROGRESS_BASIS_LABEL: Record<ProjectSettings["progressBasis"], string> = {
  milestones: "Milestones completed", tasks: "Tasks done", "estimate-hours": "Estimated hours done"
};
export const OBLIGATION_STATE_TEXT: Record<ObligationState | "not_found", string> = {
  missing: "Missing", received: "Received, not yet reviewed", under_review: "Under review", approved: "Approved",
  rejected: "Rejected", expired: "Expired", not_found: "Not set up"
};

/* ── Dates ─────────────────────────────────────────────────────────────── */

/** "YYYY-MM-DD" (or an ISO time) to that local day at the given hour in the organisation's timezone. */
export function projectDay(date: string, tz: string, hour = 17): ISO | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.length > 10 ? localDay(date, tz) : date);
  if (!m) return null;
  const at = zonedTime(Number(m[1]), Number(m[2]), Number(m[3]), hour, 0, tz);
  return isNaN(ms(at)) ? null : at;
}

/** Whole local days from a to b. */
export function projectDaysBetween(a: ISO, b: ISO, tz: string): number {
  const d = (x: ISO) => { const [y, m, dd] = localDay(x, tz).split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  return Math.round((d(b) - d(a)) / DAY);
}

/** Move a time by whole local days, keeping its wall-clock time. */
export function shiftLocalDays(at: ISO, days: number, tz: string): ISO {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
  const [h, mi] = f.format(new Date(at)).split(":").map(Number);
  const [y, m, d] = localDay(at, tz).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return zonedTime(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), h % 24, mi, tz);
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export function canSeeProject(q: Q, p: Project): boolean {
  return q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility });
}

/** People attached to a project: its owner and the assignees of its tasks. Used for "My work" scope. */
function projectPeople(s: CoreState, p: Project): Id[] {
  return [p.ownerId, ...s.data.tasks.filter((t) => t.projectId === p.id && t.assigneeId).map((t) => t.assigneeId as Id)];
}

/** Projects the viewer may see, inside the selected scope (unless ignored). */
export function projectsFor(q: Q, opt?: QueryOpts): Project[] {
  return q.s.data.projects.filter((p) => canSeeProject(q, p) && q.inScope({ teamId: p.teamId, unitId: p.unitId }, projectPeople(q.s, p), opt));
}

/** One project, permission-checked, regardless of the selected scope. */
export function projectFor(q: Q, id: Id): Project | undefined {
  const p = q.s.data.projects.find((x) => x.id === id);
  return p && canSeeProject(q, p) ? p : undefined;
}

export function projectMilestones(s: CoreState, projectId: Id): Milestone[] {
  return s.data.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** Canonical tasks of a project (the same tasks Work shows). */
export function projectTasks(s: CoreState, projectId: Id): Task[] {
  return s.data.tasks.filter((t) => t.projectId === projectId);
}

const isOpen = (t: Task) => t.status !== "done" && t.status !== "cancelled";

export function nextMilestoneOf(s: CoreState, projectId: Id): Milestone | undefined {
  return projectMilestones(s, projectId).find((m) => !m.completedAt);
}

/** Days the milestone is behind (+) or ahead of (-) its baseline. */
export function milestoneSlipDays(s: CoreState, m: Milestone): number {
  return projectDaysBetween(m.baselineAt, m.dueAt, s.config.timezone);
}

export function latestProjectUpdate(s: CoreState, projectId: Id) {
  return s.data.projectUpdates.filter((u) => u.projectId === projectId).sort((a, b) => b.at.localeCompare(a.at))[0];
}

/* ── Progress ──────────────────────────────────────────────────────────── */

export interface ProjectProgress {
  basis: ProjectSettings["progressBasis"];
  basisLabel: string;
  /** Percentage, or null when nothing can be measured on this basis. */
  value: number | null;
  done: number;
  total: number;
  /** Plain sentence: "2 of 4 milestones completed". */
  text: string;
  /** What the figure leaves out, e.g. unestimated tasks. */
  excluded: string[];
  note: string;
}

export function projectProgress(s: CoreState, p: Project): ProjectProgress {
  const basis = s.config.projects.progressBasis;
  const note = "Planned work only. This is not financial or physical completion.";
  const out = (value: number | null, done: number, total: number, text: string, excluded: string[] = []): ProjectProgress =>
    ({ basis, basisLabel: PROGRESS_BASIS_LABEL[basis], value, done, total, text, excluded, note });
  if (basis === "milestones") {
    const list = projectMilestones(s, p.id);
    const done = list.filter((m) => m.completedAt).length;
    return out(list.length ? (100 * done) / list.length : null, done, list.length,
      list.length ? done + " of " + list.length + " milestones completed" : "No milestones planned yet");
  }
  const tasks = projectTasks(s, p.id);
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const live = tasks.filter((t) => t.status !== "cancelled");
  const exCancelled = cancelled ? [cancelled + " cancelled task" + (cancelled === 1 ? " is" : "s are") + " left out"] : [];
  if (basis === "tasks") {
    const done = live.filter((t) => t.status === "done").length;
    return out(live.length ? (100 * done) / live.length : null, done, live.length,
      live.length ? done + " of " + live.length + " tasks done (a count of tasks, not effort)" : "No tasks yet", exCancelled);
  }
  const est = live.filter((t) => typeof t.estimateHours === "number" && t.estimateHours > 0);
  const unest = live.length - est.length;
  const total = est.reduce((n, t) => n + (t.estimateHours as number), 0);
  const done = est.filter((t) => t.status === "done").reduce((n, t) => n + (t.estimateHours as number), 0);
  const excluded = [...(unest ? [unest + " task" + (unest === 1 ? " has" : "s have") + " no estimate and " + (unest === 1 ? "is" : "are") + " not counted"] : []), ...exCancelled];
  return out(total ? (100 * done) / total : null, done, total,
    total ? done + " of " + total + " estimated hours done" : "No estimated tasks, so progress cannot be measured on this basis", excluded);
}

/* ── Gates ─────────────────────────────────────────────────────────────── */

export interface GateItem { obligationId: Id; label: string; state: ObligationState | "not_found"; ok: boolean }
export interface GateStatus { label: string; satisfied: boolean; items: GateItem[]; missing: GateItem[]; text: string }

/** A gate is satisfied when every obligation it names is approved. Anything else is listed as missing. */
export function milestoneGate(s: CoreState, m: Milestone): GateStatus | null {
  if (!m.gate) return null;
  const items = m.gate.obligationIds.map((id): GateItem => {
    const ob = s.data.obligations.find((o) => o.id === id);
    const req = ob ? s.config.standards.requirements.find((r) => r.id === ob.requirementId) : undefined;
    const state = ob ? ob.state : "not_found";
    return { obligationId: id, label: req?.label || (ob ? ob.requirementId : id), state, ok: state === "approved" };
  });
  const missing = items.filter((i) => !i.ok);
  return {
    label: m.gate.label, satisfied: missing.length === 0, items, missing,
    text: missing.length === 0 ? "Satisfied" : "Missing: " + missing.map((i) => i.label + " (" + OBLIGATION_STATE_TEXT[i.state].toLowerCase() + ")").join(", ")
  };
}

/* ── Health ────────────────────────────────────────────────────────────── */

export interface HealthReason {
  level: "at_risk" | "off_track";
  kind: "slip" | "overdue-milestone" | "overdue-tasks" | "gate" | "risk" | "dependency";
  text: string;
  refId?: Id;
}

export interface ProjectHealth {
  health: Health;
  reasons: HealthReason[];
  /** Owner-reported health, kept separately. */
  reported?: Health;
  /** Computed and reported disagree. */
  differs: boolean;
}

const GATE_WARN_DAYS = 14;

export function projectHealth(s: CoreState, p: Project, now: ISO): ProjectHealth {
  const tz = s.config.timezone;
  const reasons: HealthReason[] = [];
  if (p.status === "completed" || p.status === "cancelled") return { health: "on_track", reasons, reported: p.reportedHealth, differs: false };
  const list = projectMilestones(s, p.id);
  const byId = new Map(list.map((m) => [m.id, m]));
  const next = list.find((m) => !m.completedAt);
  if (next) {
    const slip = milestoneSlipDays(s, next);
    if (ms(next.dueAt) < ms(now)) {
      reasons.push({ level: "off_track", kind: "overdue-milestone", refId: next.id, text: "“" + next.label + "” was due " + fmtDate(next.dueAt, tz) + " and is not complete" });
    } else if (slip >= s.config.projects.atRiskSlipDays) {
      reasons.push({ level: "at_risk", kind: "slip", refId: next.id,
        text: "Next milestone “" + next.label + "” has slipped " + slip + " day" + (slip === 1 ? "" : "s") + " from its baseline (at risk from " + s.config.projects.atRiskSlipDays + ")" });
    }
  }
  for (const m of list) {
    if (m.completedAt) continue;
    for (const depId of m.dependsOn) {
      const d = byId.get(depId) || s.data.milestones.find((x) => x.id === depId);
      if (d && !d.completedAt && ms(d.dueAt) > ms(m.dueAt)) {
        reasons.push({ level: "at_risk", kind: "dependency", refId: m.id, text: "“" + m.label + "” is due before “" + d.label + "”, which it depends on" });
      }
    }
    const g = milestoneGate(s, m);
    const daysLeft = projectDaysBetween(now, m.dueAt, tz);
    if (g && !g.satisfied && daysLeft <= GATE_WARN_DAYS) {
      reasons.push({ level: "at_risk", kind: "gate", refId: m.id,
        text: "Gate “" + g.label + "” on “" + m.label + "” is not satisfied " + (daysLeft < 0 ? "and the milestone is past due" : "with " + daysLeft + " day" + (daysLeft === 1 ? "" : "s") + " to go") + ". " + g.text });
    }
  }
  const overdue = projectTasks(s, p.id).filter((t) => isOpen(t) && !!t.dueAt && ms(t.dueAt) < ms(now));
  if (overdue.length) reasons.push({ level: "at_risk", kind: "overdue-tasks", text: overdue.length + " " + (overdue.length === 1 ? "task is" : "tasks are") + " overdue" });
  const high = s.data.risks.filter((r) => r.projectId === p.id && r.kind !== "decision" && r.severity === "high" && r.state !== "closed");
  if (high.length) reasons.push({ level: "at_risk", kind: "risk", refId: high[0].id, text: high.length + " open high " + (high.length === 1 ? "risk" : "risks") + ": " + high.map((r) => r.title).join("; ") });
  const health: Health = reasons.some((r) => r.level === "off_track") ? "off_track" : reasons.length ? "at_risk" : "on_track";
  return { health, reasons, reported: p.reportedHealth, differs: !!p.reportedHealth && p.reportedHealth !== health };
}

/* ── Dependencies and impact ───────────────────────────────────────────── */

export interface Dependants {
  milestones: Milestone[];
  tasks: { task: Task; why: string; milestoneId?: Id }[];
  gates: { milestoneId: Id; milestone: string; status: GateStatus }[];
}

/** Everything known to come after a milestone: milestones that depend on it (transitively),
    open tasks linked to it or to those milestones, open tasks that wait on those tasks, and gates. */
export function milestoneDependants(s: CoreState, milestoneId: Id): Dependants {
  const root = s.data.milestones.find((m) => m.id === milestoneId);
  if (!root) return { milestones: [], tasks: [], gates: [] };
  const all = s.data.milestones.filter((m) => m.projectId === root.projectId);
  const seen = new Set<Id>([root.id]);
  const order: Milestone[] = [];
  const queue = [root.id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const m of all) if (!seen.has(m.id) && m.dependsOn.includes(cur)) { seen.add(m.id); order.push(m); queue.push(m.id); }
  }
  const tasks: Dependants["tasks"] = [];
  const taken = new Set<Id>();
  const label = (id: Id) => s.data.milestones.find((m) => m.id === id)?.label || "milestone";
  for (const t of s.data.tasks) {
    if (!isOpen(t) || !t.milestoneId || !seen.has(t.milestoneId)) continue;
    taken.add(t.id);
    tasks.push({ task: t, milestoneId: t.milestoneId, why: t.milestoneId === root.id ? "Linked to this milestone" : "Linked to “" + label(t.milestoneId) + "”" });
  }
  // Tasks that wait on any of those tasks, transitively.
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of s.data.tasks) {
      if (taken.has(t.id) || !isOpen(t)) continue;
      const on = t.dependsOn.find((d) => taken.has(d));
      if (on) {
        taken.add(t.id);
        tasks.push({ task: t, milestoneId: t.milestoneId, why: "Waits on “" + (s.data.tasks.find((x) => x.id === on)?.title || "a task") + "”" });
        grew = true;
      }
    }
  }
  const gates: Dependants["gates"] = [];
  for (const m of [root, ...order]) {
    const g = milestoneGate(s, m);
    if (g) gates.push({ milestoneId: m.id, milestone: m.label, status: g });
  }
  return { milestones: order, tasks, gates };
}

export interface MilestoneImpact {
  milestone: Milestone;
  project: Project;
  from: ISO;
  to: ISO;
  deltaDays: number;
  cascade: boolean;
  /** Dependent milestones with their current and new (or proposed) date. */
  milestones: { milestone: Milestone; from: ISO; to: ISO; applied: boolean; conflict: boolean }[];
  /** Affected open tasks. `to` is set when the date moves (applied) or is proposed. */
  tasks: { task: Task; why: string; from?: ISO; to?: ISO; applied: boolean; conflict: boolean }[];
  gates: Dependants["gates"];
  health: { before: ProjectHealth; after: ProjectHealth };
  ownerId: Id;
  beyondEnd: boolean;
  /** "direct": the viewer may change it now. "request": it needs an approved change request. */
  route: "direct" | "request";
  routeReason: string;
  notes: string[];
}

/** Preview of moving a milestone. Pure: nothing changes. */
export function milestoneImpact(s: CoreState, milestoneId: Id, newDate: ISO, ctx?: Ctx): MilestoneImpact | null {
  const m = s.data.milestones.find((x) => x.id === milestoneId);
  const p = m && s.data.projects.find((x) => x.id === m.projectId);
  if (!m || !p) return null;
  const tz = s.config.timezone;
  const now = ctx?.now || s.config.referenceDate;
  const cascade = s.config.projects.cascadeMilestoneMoves;
  const delta = projectDaysBetween(m.dueAt, newDate, tz);
  const dep = milestoneDependants(s, milestoneId);
  const milestones = dep.milestones.map((d) => {
    const to = shiftLocalDays(d.dueAt, delta, tz);
    return { milestone: d, from: d.dueAt, to, applied: cascade, conflict: !cascade && ms(d.dueAt) < ms(newDate) };
  });
  const tasks = dep.tasks.map((x) => {
    const onRoot = x.milestoneId === m.id;
    const moves = !onRoot && !!x.task.dueAt;
    return {
      task: x.task, why: x.why, from: x.task.dueAt, to: moves ? shiftLocalDays(x.task.dueAt!, delta, tz) : undefined,
      applied: cascade && moves,
      conflict: onRoot ? !!x.task.dueAt && ms(x.task.dueAt) > ms(newDate) : false
    };
  });
  const after = structuredClone(s);
  applyDates(after, milestoneId, newDate, cascade);
  const pushedPast = cascade ? milestones.filter((x) => ms(x.to) > ms(p.endDate)) : [];
  const beyondEnd = ms(newDate) > ms(p.endDate) || pushedPast.length > 0;
  const v = ctx ? viewerOf(s, ctx.viewerId) : null;
  const isOwner = !!v && v.person.id === p.ownerId;
  const T = projectTerms(s.config);
  let route: MilestoneImpact["route"] = "direct";
  let routeReason = "You own this " + T.oneLower + ", so the change applies now.";
  if (beyondEnd) {
    route = "request";
    routeReason = (ms(newDate) > ms(p.endDate) ? "The new date is after" : "Cascading would move “" + pushedPast[0].milestone.label + "” past")
      + " the " + T.oneLower + " end date (" + fmtDate(p.endDate, tz) + "), so it needs an approved change request.";
  }
  else if (ctx && !isOwner) { route = "request"; routeReason = "Only the " + T.oneLower + " owner (" + nameOf(s, p.ownerId) + ") changes dates directly. Anyone else raises a change request."; }
  const notes: string[] = [];
  if (dep.milestones.length || dep.tasks.length) {
    notes.push(cascade
      ? "Dependants move by the same number of days because cascading is switched on in Settings."
      : "Cascading is off, so dependants keep their dates. Their new dates are proposed, not applied, and any that now fall before this milestone are flagged at risk.");
  } else notes.push("No milestones or tasks are recorded as depending on this milestone.");
  notes.push("Dependants are those recorded in the plan. Work outside Pulse that depends on this date is not known here.");
  notes.push("No budget, cost or invoice figures are changed or estimated by a date move.");
  return {
    milestone: m, project: p, from: m.dueAt, to: newDate, deltaDays: delta, cascade, milestones, tasks, gates: dep.gates,
    health: { before: projectHealth(s, p, now), after: projectHealth(after, after.data.projects.find((x) => x.id === p.id)!, now) },
    ownerId: p.ownerId, beyondEnd, route, routeReason, notes
  };
}

/** Mutates s: the milestone's date and, when cascading, its dependants' dates. */
function applyDates(s: CoreState, milestoneId: Id, to: ISO, cascade: boolean) {
  const tz = s.config.timezone;
  const m = s.data.milestones.find((x) => x.id === milestoneId)!;
  const delta = projectDaysBetween(m.dueAt, to, tz);
  const dep = milestoneDependants(s, milestoneId);
  m.dueAt = to;
  if (!cascade || delta === 0) return;
  for (const d of dep.milestones) {
    const live = s.data.milestones.find((x) => x.id === d.id)!;
    live.dueAt = shiftLocalDays(live.dueAt, delta, tz);
  }
  for (const x of dep.tasks) {
    if (x.milestoneId === milestoneId) continue;
    const t = s.data.tasks.find((y) => y.id === x.task.id)!;
    if (t.dueAt) t.dueAt = shiftLocalDays(t.dueAt, delta, tz);
    if (t.startAt) t.startAt = shiftLocalDays(t.startAt, delta, tz);
  }
}

const nameOf = (s: CoreState, id?: Id | null) => s.data.people.find((p) => p.id === id)?.name || s.config.agents.find((a) => a.id === id)?.name || (id === "system" ? "Pulse" : "Unknown");

function storyEvent(s: CoreState, ctx: Ctx, p: Project, e: { action: string; objectType: AuditEvent["objectType"]; objectId: Id; summary: string;
  before?: AuditEvent["before"]; after?: AuditEvent["after"]; actorId?: Id; actorKind?: AuditEvent["actorKind"] }) {
  logEvent(s, ctx, { ...e, recordIds: [], teamId: p.teamId, unitId: p.unitId, storyKey: projectStory(p.id) });
}

/** Applies a move and writes the one story event. Returns the summary. */
function applyMove(s: CoreState, ctx: Ctx, m: Milestone, to: ISO, actor: { id: Id; kind: AuditEvent["actorKind"] }, via?: string, reason?: string): string {
  const tz = s.config.timezone;
  const p = s.data.projects.find((x) => x.id === m.projectId)!;
  const imp = milestoneImpact(s, m.id, to, ctx)!;
  const from = m.dueAt;
  let endNote = "";
  const before: Record<string, string> = { dueAt: from };
  const after: Record<string, string> = { dueAt: to };
  const latest = [to, ...(imp.cascade ? imp.milestones.map((x) => x.to) : [])].reduce((a, b) => (ms(b) > ms(a) ? b : a));
  if (ms(latest) > ms(p.endDate)) {
    before.endDate = p.endDate;
    p.endDate = latest;
    after.endDate = latest;
    endNote = " The " + projectTerms(s.config).oneLower + " end date moved to " + fmtDate(latest, tz) + ".";
  }
  applyDates(s, m.id, to, imp.cascade);
  p.updatedAt = ctx.now;
  const sign = imp.deltaDays > 0 ? "+" : "";
  const deps = imp.milestones.map((x) => "“" + x.milestone.label + "”");
  const moved = imp.tasks.filter((x) => x.applied).length;
  let depText = "";
  if (deps.length || imp.tasks.length) {
    depText = imp.cascade
      ? " Moved with it: " + (deps.length ? deps.join(", ") : "no milestones") + (moved ? " and " + moved + " task" + (moved === 1 ? "" : "s") : "") + "."
      : " Dependants not moved (proposed only): " + (deps.length ? deps.join(", ") : "none") + (imp.tasks.length ? "; " + imp.tasks.length + " linked task" + (imp.tasks.length === 1 ? "" : "s") + " listed" : "") + "."
        + (imp.milestones.some((x) => x.conflict) ? " Flagged at risk: " + imp.milestones.filter((x) => x.conflict).map((x) => "“" + x.milestone.label + "”").join(", ") + "." : "");
  }
  const summary = "Moved “" + m.label + "” from " + fmtDate(from, tz) + " to " + fmtDate(to, tz) + " (" + sign + imp.deltaDays + " days)"
    + (via ? " through " + via : "") + "." + depText + endNote + (reason ? " Reason: " + reason.trim().replace(/[.]$/, "") + "." : "")
    + " Health now " + PROJECT_HEALTH_LABEL[imp.health.after.health].toLowerCase() + ".";
  storyEvent(s, ctx, p, { action: "milestone.moved", objectType: "milestone", objectId: m.id, summary, before, after, actorId: actor.id, actorKind: actor.kind });
  return summary;
}

/* ── Authority ─────────────────────────────────────────────────────────── */

/** Owner, a manager whose team or unit the project belongs to, or an organisation-wide manager. */
function projectAuthority(s: CoreState, ctx: Ctx, p: Project): string | null {
  const v = viewerOf(s, ctx.viewerId);
  if (v.person.status !== "active") return "Your account is not active.";
  if (p.ownerId === v.person.id) return null;
  if (can(v, "projects.manage")) {
    if (v.isOrgWide) return null;
    const unitId = p.unitId || s.config.teams.find((t) => t.id === p.teamId)?.unitId;
    if ((p.teamId && v.overseenTeamIds.includes(p.teamId)) || (unitId && v.overseenUnitIds.includes(unitId))) return null;
  }
  return "Only the " + projectTerms(s.config).oneLower + " owner (" + nameOf(s, p.ownerId) + ") or a manager of its team can change it.";
}

function visibleProject(s: CoreState, ctx: Ctx, id: Id): Project | string {
  const p = s.data.projects.find((x) => x.id === id);
  const T = projectTerms(s.config);
  if (!p) return T.one + " not found.";
  if (!canSeeProject(query(s, ctx), p)) return "You cannot see this " + T.oneLower + ".";
  return p;
}

/* ── Templates ─────────────────────────────────────────────────────────── */

export interface TemplatePreview {
  start: ISO;
  end: ISO;
  milestones: { key: string; label: string; phaseId: string; dueAt: ISO; dependsOn: string[]; gate?: { label: string; requirementIds: string[] } }[];
  tasks: { key: string; title: string; phaseId: string; startAt: ISO; dueAt: ISO; estimateHours?: number; milestoneKey?: string; dependsOn: string[] }[];
}

/** Dates a template produces for a start date. Everything is anchored to that start date. */
export function previewTemplate(c: OrgConfig, templateId: string, startDate: string): TemplatePreview | null {
  const tpl = c.projects.templates.find((t) => t.id === templateId);
  const tz = c.timezone;
  const start = projectDay(startDate, tz, 9);
  const start17 = projectDay(startDate, tz, 17);
  if (!tpl || !start || !start17) return null;
  return {
    start, end: shiftLocalDays(start17, tpl.durationDays, tz),
    milestones: tpl.milestones.map((m) => ({ key: m.key, label: m.label, phaseId: m.phaseId, dueAt: shiftLocalDays(start17, m.offsetDays, tz), dependsOn: m.dependsOn || [], gate: m.gate })),
    tasks: tpl.tasks.map((t) => ({ key: t.key, title: t.title, phaseId: t.phaseId, startAt: shiftLocalDays(start, t.offsetDays, tz),
      dueAt: shiftLocalDays(start17, t.offsetDays + t.durationDays, tz), estimateHours: t.estimateHours, milestoneKey: t.milestoneKey, dependsOn: t.dependsOn || [] }))
  };
}

/** Problems with a template, in plain language. Empty means it can be saved. */
export function validateProjectTemplate(c: OrgConfig, tpl: ProjectTemplateDef): string[] {
  const errs: string[] = [];
  const type = projectTypeOf(c, tpl.typeId);
  if (!tpl.label.trim()) errs.push("Give the template a name.");
  if (!type) errs.push("Choose a type for the template.");
  if (!(tpl.durationDays > 0)) errs.push("Duration must be at least one day.");
  const phaseIds = new Set((type?.phases || []).map((p) => p.id));
  const mKeys = tpl.milestones.map((m) => m.key);
  const tKeys = tpl.tasks.map((t) => t.key);
  if (new Set(mKeys).size !== mKeys.length) errs.push("Two milestones share a key.");
  if (new Set(tKeys).size !== tKeys.length) errs.push("Two tasks share a key.");
  for (const m of tpl.milestones) {
    if (!m.label.trim()) errs.push("Every milestone needs a name.");
    if (type && !phaseIds.has(m.phaseId)) errs.push("“" + (m.label || m.key) + "” uses a phase that is not in the type.");
    if (m.offsetDays < 0 || m.offsetDays > tpl.durationDays) errs.push("“" + (m.label || m.key) + "” must fall between day 0 and day " + tpl.durationDays + ".");
    for (const d of m.dependsOn || []) if (!mKeys.includes(d)) errs.push("“" + (m.label || m.key) + "” depends on a milestone that is not in the template.");
  }
  for (const t of tpl.tasks) {
    if (!t.title.trim()) errs.push("Every task needs a title.");
    if (type && !phaseIds.has(t.phaseId)) errs.push("Task “" + (t.title || t.key) + "” uses a phase that is not in the type.");
    if (t.offsetDays < 0 || t.durationDays < 0) errs.push("Task “" + (t.title || t.key) + "” needs a start day and duration of 0 or more.");
    if (t.milestoneKey && !mKeys.includes(t.milestoneKey)) errs.push("Task “" + (t.title || t.key) + "” links to a milestone that is not in the template.");
    if (t.estimateHours !== undefined && !(t.estimateHours > 0)) errs.push("Task “" + (t.title || t.key) + "” has an estimate that is not above 0. Leave it empty for unestimated.");
  }
  // No dependency loops between milestones.
  const deps = new Map(tpl.milestones.map((m) => [m.key, m.dependsOn || []]));
  const visiting = new Set<string>(), done = new Set<string>();
  const loop = (k: string): boolean => {
    if (done.has(k)) return false;
    if (visiting.has(k)) return true;
    visiting.add(k);
    const r = (deps.get(k) || []).some(loop);
    visiting.delete(k); done.add(k);
    return r;
  };
  if (mKeys.some(loop)) errs.push("Milestone dependencies make a loop.");
  return [...new Set(errs)];
}

function canEditTemplates(s: CoreState, ctx: Ctx): boolean {
  const v = viewerOf(s, ctx.viewerId);
  return can(v, "settings.edit") || (can(v, "projects.manage") && v.isOrgWide);
}

/** Save a template. Editing increments its version; projects already created keep their own copy. */
export function saveProjectTemplate(s0: CoreState, ctx: Ctx, tpl: ProjectTemplateDef): Result {
  if (!canEditTemplates(s0, ctx)) return fail("Only an administrator can change templates.");
  const errs = validateProjectTemplate(s0.config, tpl);
  if (errs.length) return fail(errs[0]);
  const s = draft(s0);
  const list = s.config.projects.templates;
  const i = list.findIndex((t) => t.id === tpl.id);
  const prev = i >= 0 ? list[i] : null;
  if (prev && JSON.stringify({ ...prev, version: 0 }) === JSON.stringify({ ...tpl, version: 0 })) return fail("Nothing changed.");
  const saved: ProjectTemplateDef = { ...structuredClone(tpl), version: prev ? prev.version + 1 : 1 };
  if (i >= 0) list[i] = saved; else list.push(saved);
  logEvent(s, ctx, { action: prev ? "projectTemplate.updated" : "projectTemplate.created", objectType: "config", objectId: tpl.id, recordIds: [],
    storyKey: "projectTemplate:" + tpl.id,
    summary: (prev ? "Updated template “" + saved.label + "” to version " + saved.version : "Created template “" + saved.label + "”") + ". Existing " + projectTerms(s.config).manyLower + " are unchanged.",
    before: prev ? { version: prev.version } : undefined, after: { version: saved.version } });
  return { ok: true, state: s, message: prev ? "Saved as version " + saved.version + ". Existing " + projectTerms(s.config).manyLower + " keep the version they were created from." : "Template created.", id: tpl.id };
}

export interface NewProjectInput {
  templateId: string;
  title: string;
  /** YYYY-MM-DD in the organisation's timezone. */
  startDate: string;
  ownerId: Id;
  teamId?: Id;
  unitId?: Id;
  objective?: string;
  /** Generated once per form; a repeated submit with the same key creates nothing new. */
  key: string;
}

export function createProjectFromTemplate(s0: CoreState, ctx: Ctx, n: NewProjectInput): Result {
  const T = projectTerms(s0.config);
  const existing = s0.data.projects.find((p) => p.sourceKey && p.sourceKey === n.key);
  if (existing) return { ok: true, state: s0, message: "Already created as " + existing.ref + ". Nothing was created twice.", id: existing.id };
  const v = viewerOf(s0, ctx.viewerId);
  if (v.person.status !== "active") return fail("Your account is not active.");
  if (!can(v, "projects.manage")) return fail("Your role cannot create " + T.manyLower + ".");
  const tpl = s0.config.projects.templates.find((t) => t.id === n.templateId);
  if (!tpl) return fail("That template no longer exists.");
  const type = projectTypeOf(s0.config, tpl.typeId);
  if (!type || !type.phases.length) return fail("The template's type has no phases. Set phases in Settings first.");
  if (!n.title.trim()) return fail("Give the " + T.oneLower + " a name.");
  const owner = s0.data.people.find((p) => p.id === n.ownerId);
  if (!owner || owner.kind !== "staff" || owner.status !== "active") return fail("Choose an active member of staff as the owner.");
  const team = n.teamId ? s0.config.teams.find((t) => t.id === n.teamId) : undefined;
  if (n.teamId && !team) return fail("That team no longer exists.");
  const unitId = n.unitId || team?.unitId;
  if (n.unitId && !s0.config.units.some((u) => u.id === n.unitId)) return fail("That unit no longer exists.");
  if (!v.isOrgWide) {
    if (n.teamId && !v.overseenTeamIds.includes(n.teamId)) return fail("You can only create " + T.manyLower + " for teams you manage.");
    if (!n.teamId && n.unitId && !v.overseenUnitIds.includes(n.unitId)) return fail("You can only create " + T.manyLower + " for units you manage.");
    if (!n.teamId && !n.unitId) return fail("Only an organisation-wide manager can create an organisation-wide " + T.oneLower + ".");
  }
  const pv = previewTemplate(s0.config, tpl.id, n.startDate);
  if (!pv) return fail("Enter a valid start date.");
  const s = draft(s0);
  const id = nid(s, "pr");
  const ref = "PRJ-" + (100 + s.data.projects.length + 1);
  const notes: string[] = [];
  s.data.projects.push({
    id, ref, title: n.title.trim(), typeId: tpl.typeId, objective: (n.objective || "").trim(), ownerId: n.ownerId,
    teamId: n.teamId, unitId, phaseId: type.phases[0].id, status: "planned", startDate: pv.start, endDate: pv.end,
    fields: {}, template: { id: tpl.id, version: tpl.version }, visibility: n.teamId ? "team" : unitId ? "unit" : "organisation",
    createdAt: ctx.now, updatedAt: ctx.now, sourceKey: n.key, fileIds: []
  });
  const msIds = new Map<string, Id>();
  for (const m of pv.milestones) msIds.set(m.key, nid(s, "ms"));
  for (const m of pv.milestones) {
    let gate: Milestone["gate"];
    if (m.gate && m.gate.requirementIds.length) {
      const obIds: Id[] = [];
      for (const rqId of m.gate.requirementIds) {
        const req = s.config.standards.requirements.find((r) => r.id === rqId);
        if (!req) { notes.push("Requirement " + rqId + " is not configured, so it was left off the gate on “" + m.label + "”."); continue; }
        const obId = nid(s, "ob");
        s.data.obligations.push({ id: obId, requirementId: rqId, subject: { kind: "project", id }, state: "missing", dueAt: m.dueAt });
        obIds.push(obId);
      }
      if (obIds.length) gate = { label: m.gate.label, obligationIds: obIds };
    }
    s.data.milestones.push({ id: msIds.get(m.key)!, projectId: id, label: m.label, phaseId: m.phaseId, dueAt: m.dueAt, baselineAt: m.dueAt,
      dependsOn: m.dependsOn.map((k) => msIds.get(k)!).filter(Boolean), gate });
  }
  const taskIds = new Map<string, Id>();
  for (const t of pv.tasks) taskIds.set(t.key, nid(s, "t"));
  for (const t of pv.tasks) {
    s.data.tasks.push({
      id: taskIds.get(t.key)!, title: t.title, teamId: n.teamId, unitId, assigneeId: null, linkedRecordIds: [], priority: "normal", status: "open",
      dueAt: t.dueAt, startAt: t.startAt, dependsOn: t.dependsOn.map((k) => taskIds.get(k)!).filter(Boolean), checklist: [], notes: [], evidenceFileIds: [],
      createdAt: ctx.now, createdBy: ctx.viewerId, slaPolicyId: "sla-task", projectId: id, milestoneId: t.milestoneKey ? msIds.get(t.milestoneKey) : undefined,
      phaseId: t.phaseId, estimateHours: t.estimateHours, origin: { kind: "project-template", id: tpl.id }, instanceKey: n.key + ":" + t.key
    });
  }
  const p = s.data.projects.find((x) => x.id === id)!;
  storyEvent(s, ctx, p, { action: "project.created", objectType: "project", objectId: id,
    summary: "Created " + ref + " “" + p.title + "” from template “" + tpl.label + "” version " + tpl.version + ", starting " + fmtDate(pv.start, s.config.timezone)
      + ": " + pv.milestones.length + " milestones and " + pv.tasks.length + " tasks." + (notes.length ? " " + notes.join(" ") : "") });
  return { ok: true, state: s, message: "Created " + ref + " with " + pv.milestones.length + " milestones and " + pv.tasks.length + " tasks in the team queue." + (notes.length ? " " + notes.join(" ") : ""), id };
}

/* ── Project changes ───────────────────────────────────────────────────── */

export type ProjectPatch = Partial<Pick<Project, "title" | "objective" | "ownerId" | "status" | "startDate" | "endDate" | "budgetId" | "reportedHealth">>;

export function updateProject(s0: CoreState, ctx: Ctx, projectId: Id, patch: ProjectPatch, note = ""): Result {
  const p0 = visibleProject(s0, ctx, projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  const T = projectTerms(s0.config);
  if (patch.title !== undefined && !patch.title.trim()) return fail("Give the " + T.oneLower + " a name.");
  if (patch.ownerId !== undefined) {
    const o = s0.data.people.find((x) => x.id === patch.ownerId);
    if (!o || o.kind !== "staff" || o.status !== "active") return fail("Choose an active member of staff as the owner.");
  }
  if (patch.budgetId && !s0.data.budgets.some((b) => b.id === patch.budgetId)) return fail("That budget does not exist.");
  const start = patch.startDate ?? p0.startDate, end = patch.endDate ?? p0.endDate;
  if (ms(end) < ms(start)) return fail("The end date must be on or after the start date.");
  const s = draft(s0);
  const p = s.data.projects.find((x) => x.id === projectId)!;
  const before: Record<string, string | null> = {}, after: Record<string, string | null> = {};
  for (const [k, val] of Object.entries(patch) as [keyof ProjectPatch, string | undefined][]) {
    const cur = (p[k] ?? null) as string | null;
    const next = (val === undefined ? null : typeof val === "string" ? val.trim() || null : val) as string | null;
    if (cur === next) continue;
    before[k] = cur; after[k] = next;
    (p as unknown as Record<string, unknown>)[k] = next ?? undefined;
  }
  if (!Object.keys(after).length) return fail("Nothing changed.");
  p.updatedAt = ctx.now;
  const tz = s.config.timezone;
  const show = (k: string, x: string | null) => x === null ? "none" : k.endsWith("Date") ? fmtDate(x, tz) : k === "ownerId" ? nameOf(s, x)
    : k === "reportedHealth" ? PROJECT_HEALTH_LABEL[x as Health] : k === "status" ? PROJECT_STATUS_LABEL[x as Project["status"]] : x;
  storyEvent(s, ctx, p, { action: "project.updated", objectType: "project", objectId: p.id, before, after,
    summary: "Updated " + p.ref + ": " + Object.keys(after).map((k) => k.replace(/Id$/, "").replace(/([A-Z])/g, " $1").toLowerCase() + " " + show(k, before[k]) + " to " + show(k, after[k])).join("; ") + (note ? ". " + note : "") });
  return { ok: true, state: s, message: "Saved." };
}

/** Gates that must be satisfied before a project may enter a phase: any gate on a milestone in an earlier phase. */
export function phaseBlockers(s: CoreState, p: Project, phaseId: string): { milestone: Milestone; gate: GateStatus }[] {
  const phases = projectPhases(s.config, p);
  const target = phases.findIndex((x) => x.id === phaseId);
  const current = phases.findIndex((x) => x.id === p.phaseId);
  if (target < 0 || target <= current) return [];
  const earlier = new Set(phases.slice(0, target).map((x) => x.id));
  return projectMilestones(s, p.id).filter((m) => earlier.has(m.phaseId)).map((m) => ({ milestone: m, gate: milestoneGate(s, m) }))
    .filter((x): x is { milestone: Milestone; gate: GateStatus } => !!x.gate && !x.gate.satisfied);
}

export function setProjectPhase(s0: CoreState, ctx: Ctx, projectId: Id, phaseId: string): Result {
  const p0 = visibleProject(s0, ctx, projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  const phases = projectPhases(s0.config, p0);
  const to = phases.find((x) => x.id === phaseId);
  if (!to) return fail("That phase is not part of this " + projectTerms(s0.config).oneLower + "'s type.");
  if (p0.phaseId === phaseId) return fail("Already in " + to.label + ".");
  const blocked = phaseBlockers(s0, p0, phaseId);
  if (blocked.length) {
    const b = blocked[0];
    return fail("Cannot move to " + to.label + " yet: the gate “" + b.gate.label + "” on “" + b.milestone.label + "” is not satisfied. " + b.gate.text + ".");
  }
  const s = draft(s0);
  const p = s.data.projects.find((x) => x.id === projectId)!;
  const from = p.phaseId;
  p.phaseId = phaseId;
  if (p.status === "planned") p.status = "active";
  p.updatedAt = ctx.now;
  storyEvent(s, ctx, p, { action: "project.phase", objectType: "project", objectId: p.id, before: { phase: from }, after: { phase: phaseId },
    summary: "Moved " + p.ref + " from " + projectPhaseLabel(s.config, p, from) + " to " + to.label });
  return { ok: true, state: s, message: "Now in " + to.label + "." };
}

export function moveMilestone(s0: CoreState, ctx: Ctx, milestoneId: Id, newDate: string, reason = ""): Result {
  const m0 = s0.data.milestones.find((x) => x.id === milestoneId);
  if (!m0) return fail("Milestone not found.");
  const p0 = visibleProject(s0, ctx, m0.projectId);
  if (typeof p0 === "string") return fail(p0);
  if (m0.completedAt) return fail("“" + m0.label + "” is already complete, so its date is fixed.");
  const to = projectDay(newDate, s0.config.timezone);
  if (!to) return fail("Enter a valid date.");
  if (projectDaysBetween(m0.dueAt, to, s0.config.timezone) === 0) return fail("That is already the milestone date.");
  const imp = milestoneImpact(s0, milestoneId, to, ctx)!;
  if (imp.route === "request") return fail(imp.routeReason);
  const s = draft(s0);
  const m = s.data.milestones.find((x) => x.id === milestoneId)!;
  applyMove(s, ctx, m, to, { id: ctx.viewerId, kind: "person" }, undefined, reason.trim());
  const deps = imp.milestones.length;
  return { ok: true, state: s, message: "Moved to " + fmtDate(to, s.config.timezone) + "."
    + (deps ? imp.cascade ? " " + deps + " dependent milestone" + (deps === 1 ? "" : "s") + " moved too." : " " + deps + " dependent milestone" + (deps === 1 ? " keeps its" : "s keep their") + " date; see the plan for what is flagged." : "") };
}

/** Raise the canonical change request (Work > Requests) for a move that the viewer cannot make directly. */
export function requestMilestoneChange(s0: CoreState, ctx: Ctx, milestoneId: Id, newDate: string, reason: string): Result {
  const m0 = s0.data.milestones.find((x) => x.id === milestoneId);
  if (!m0) return fail("Milestone not found.");
  const p0 = visibleProject(s0, ctx, m0.projectId);
  if (typeof p0 === "string") return fail(p0);
  if (m0.completedAt) return fail("“" + m0.label + "” is already complete, so its date is fixed.");
  const form = s0.config.requestForms.find((f) => f.id === MILESTONE_FORM_ID && f.enabled) || s0.config.requestForms.find((f) => f.effect.kind === "change-milestone" && f.enabled);
  if (!form) return fail("No milestone change request form is set up. An administrator can add one in Settings, Control, Request forms.");
  if (!reason.trim()) return fail("Say why the date needs to change.");
  const to = projectDay(newDate, s0.config.timezone);
  if (!to) return fail("Enter a valid date.");
  const open = s0.data.requests.find((r) => r.formId === form.id && r.fields.milestoneId === milestoneId && ["draft", "submitted", "changes_requested"].includes(r.status));
  if (open) return fail("A change request for this milestone is already open: " + open.ref + ".");
  const v = viewerOf(s0, ctx.viewerId);
  const teamId = p0.teamId || v.memberTeamIds.find((t) => !p0.unitId || s0.config.teams.find((x) => x.id === t)?.unitId === p0.unitId) || v.memberTeamIds[0];
  const day = localDay(to, s0.config.timezone);
  const startEvents = s0.data.events.length;
  const res = createRequest(s0, ctx, {
    formId: form.id, title: "Move “" + m0.label + "” (" + p0.title + ") to " + fmtDate(to, s0.config.timezone),
    fields: { projectId: p0.id, milestoneId, newDate: day, reason: reason.trim() }, evidenceFileIds: [], linkedRecordIds: [], teamId, submit: true
  });
  if (!res.ok) return res;
  const s = res.state; // a fresh copy made by createRequest
  for (const e of s.data.events.slice(startEvents)) e.storyKey = e.storyKey || projectStory(p0.id);
  const p = s.data.projects.find((x) => x.id === p0.id)!;
  const req = s.data.requests.find((r) => r.id === res.id)!;
  storyEvent(s, ctx, p, { action: "milestone.change.requested", objectType: "milestone", objectId: milestoneId,
    before: { dueAt: m0.dueAt }, after: { proposedDueAt: to },
    summary: "Asked to move “" + m0.label + "” to " + fmtDate(to, s.config.timezone) + " through " + req.ref + ". The date is unchanged until it is approved and run. Reason: " + reason.trim() });
  return { ok: true, state: s, message: res.message + " The date stays as it is until the request is approved and run.", id: res.id };
}

export function completeMilestone(s0: CoreState, ctx: Ctx, milestoneId: Id): Result {
  const m0 = s0.data.milestones.find((x) => x.id === milestoneId);
  if (!m0) return fail("Milestone not found.");
  const p0 = visibleProject(s0, ctx, m0.projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  if (m0.completedAt) return fail("Already complete.");
  const g = milestoneGate(s0, m0);
  if (g && !g.satisfied) return fail("The gate “" + g.label + "” is not satisfied. " + g.text + ". Only accepted evidence releases the gate.");
  const s = draft(s0);
  const m = s.data.milestones.find((x) => x.id === milestoneId)!;
  const p = s.data.projects.find((x) => x.id === m.projectId)!;
  m.completedAt = ctx.now;
  p.updatedAt = ctx.now;
  const open = projectTasks(s, p.id).filter((t) => t.milestoneId === m.id && isOpen(t)).length;
  const slip = milestoneSlipDays(s, m);
  storyEvent(s, ctx, p, { action: "milestone.completed", objectType: "milestone", objectId: m.id, after: { completedAt: ctx.now },
    summary: "Completed “" + m.label + "”" + (slip > 0 ? ", " + slip + " days after its baseline" : "") + (open ? ", with " + open + " linked task" + (open === 1 ? "" : "s") + " still open" : "") + "." });
  return { ok: true, state: s, message: "Milestone complete." + (open ? " " + open + " linked task" + (open === 1 ? " is" : "s are") + " still open in Work." : "") };
}

/* ── Risks and decisions ───────────────────────────────────────────────── */

export type RiskInput = Pick<ProjectRisk, "kind" | "title" | "severity" | "impact" | "ownerId" | "nextAction" | "state"> & { requestId?: Id };

export function saveProjectRisk(s0: CoreState, ctx: Ctx, projectId: Id, input: RiskInput, riskId?: Id): Result {
  const p0 = visibleProject(s0, ctx, projectId);
  if (typeof p0 === "string") return fail(p0);
  const existing = riskId ? s0.data.risks.find((r) => r.id === riskId && r.projectId === projectId) : undefined;
  if (riskId && !existing) return fail("That entry no longer exists.");
  const auth = projectAuthority(s0, ctx, p0);
  if (auth && !(existing && existing.ownerId === ctx.viewerId)) return fail(auth);
  if (!input.title.trim()) return fail("Give it a title.");
  const owner = s0.data.people.find((x) => x.id === input.ownerId);
  if (!owner || owner.status === "suspended") return fail("Choose an owner.");
  if (input.requestId && !s0.data.requests.some((r) => r.id === input.requestId)) return fail("The linked request no longer exists.");
  const s = draft(s0);
  const p = s.data.projects.find((x) => x.id === projectId)!;
  const clean = { ...input, title: input.title.trim(), impact: input.impact.trim(), nextAction: input.nextAction.trim(), requestId: input.requestId || undefined };
  let id = riskId;
  const word = input.kind === "decision" ? "decision" : input.kind;
  if (existing) {
    const r = s.data.risks.find((x) => x.id === riskId)!;
    const before = { state: r.state, severity: r.severity, owner: r.ownerId };
    Object.assign(r, clean);
    storyEvent(s, ctx, p, { action: "risk.updated", objectType: "risk", objectId: r.id, before, after: { state: r.state, severity: r.severity, owner: r.ownerId },
      summary: "Updated " + word + " “" + r.title + "” (" + r.severity + ", " + r.state + ")" });
  } else {
    id = nid(s, "rk");
    s.data.risks.push({ id, projectId, ...clean, createdAt: ctx.now });
    storyEvent(s, ctx, p, { action: "risk.created", objectType: "risk", objectId: id,
      summary: "Logged " + word + " “" + clean.title + "” (" + clean.severity + "), owner " + nameOf(s, clean.ownerId) });
  }
  p.updatedAt = ctx.now;
  return { ok: true, state: s, message: existing ? "Saved." : "Added.", id };
}

export function removeProjectRisk(s0: CoreState, ctx: Ctx, riskId: Id): Result {
  const r0 = s0.data.risks.find((r) => r.id === riskId);
  if (!r0) return fail("That entry no longer exists.");
  const p0 = visibleProject(s0, ctx, r0.projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  const s = draft(s0);
  s.data.risks = s.data.risks.filter((r) => r.id !== riskId);
  const p = s.data.projects.find((x) => x.id === r0.projectId)!;
  storyEvent(s, ctx, p, { action: "risk.removed", objectType: "risk", objectId: riskId, summary: "Removed " + r0.kind + " “" + r0.title + "”. Its history is kept." });
  return { ok: true, state: s, message: "Removed. The history keeps a record of it." };
}

/* ── Updates and files ─────────────────────────────────────────────────── */

export function postProjectUpdate(s0: CoreState, ctx: Ctx, projectId: Id, text: string, health: Health): Result {
  const p0 = visibleProject(s0, ctx, projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  const body = text.trim();
  if (!body) return fail("Write the update first.");
  if (body.length > 2000) return fail("Keep updates under 2,000 characters.");
  const s = draft(s0);
  const p = s.data.projects.find((x) => x.id === projectId)!;
  const id = nid(s, "pu");
  s.data.projectUpdates.push({ id, projectId, at: ctx.now, by: ctx.viewerId, text: body, health });
  const before = p.reportedHealth;
  p.reportedHealth = health;
  p.updatedAt = ctx.now;
  storyEvent(s, ctx, p, { action: "project.update.posted", objectType: "update", objectId: id, before: { reportedHealth: before ?? null }, after: { reportedHealth: health },
    summary: "Posted an update on " + p.ref + " (reported " + PROJECT_HEALTH_LABEL[health].toLowerCase() + "): " + (body.length > 120 ? body.slice(0, 117) + "..." : body) });
  return { ok: true, state: s, message: "Update posted.", id };
}

export function linkProjectFile(s0: CoreState, ctx: Ctx, projectId: Id, fileId: Id, link = true): Result {
  const p0 = visibleProject(s0, ctx, projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  const f = query(s0, ctx).file(fileId);
  if (!f) return fail("You cannot see that document.");
  const has = (p0.fileIds || []).includes(fileId);
  if (link && has) return fail("Already linked.");
  if (!link && !has) return fail("Not linked.");
  const s = draft(s0);
  const p = s.data.projects.find((x) => x.id === projectId)!;
  p.fileIds = link ? [...(p.fileIds || []), fileId] : (p.fileIds || []).filter((x) => x !== fileId);
  p.updatedAt = ctx.now;
  storyEvent(s, ctx, p, { action: link ? "project.file.linked" : "project.file.unlinked", objectType: "file", objectId: fileId,
    summary: (link ? "Linked “" : "Unlinked “") + f.title + "” (version " + (f.versions[f.versions.length - 1]?.n ?? 1) + ")" + (link ? " to " : " from ") + p.ref });
  return { ok: true, state: s, message: link ? "Linked." : "Unlinked." };
}

/* ── Project tasks ─────────────────────────────────────────────────────── */

export interface NewProjectTask { title: string; milestoneId?: Id; assigneeId?: Id | null; teamId?: Id; dueDate?: string; estimateHours?: number }

/** Adds a canonical task (shown in Work too) to the project. */
export function addProjectTask(s0: CoreState, ctx: Ctx, projectId: Id, n: NewProjectTask): Result {
  const p0 = visibleProject(s0, ctx, projectId);
  if (typeof p0 === "string") return fail(p0);
  const auth = projectAuthority(s0, ctx, p0);
  if (auth) return fail(auth);
  if (!n.title.trim()) return fail("Give the task a title.");
  const m = n.milestoneId ? s0.data.milestones.find((x) => x.id === n.milestoneId && x.projectId === projectId) : undefined;
  if (n.milestoneId && !m) return fail("That milestone is not part of this " + projectTerms(s0.config).oneLower + ".");
  if (n.estimateHours !== undefined && !(n.estimateHours > 0)) return fail("An estimate must be above 0 hours. Leave it empty if the work is not estimated.");
  const teamId = n.teamId || p0.teamId;
  if (n.assigneeId && teamId && !s0.data.memberships.some((x) => x.personId === n.assigneeId && x.teamId === teamId)) return fail(nameOf(s0, n.assigneeId) + " is not in that team.");
  const dueAt = n.dueDate ? projectDay(n.dueDate, s0.config.timezone) : m?.dueAt;
  if (n.dueDate && !dueAt) return fail("Enter a valid due date.");
  const s = draft(s0);
  const p = s.data.projects.find((x) => x.id === projectId)!;
  const id = nid(s, "t");
  s.data.tasks.push({ id, title: n.title.trim(), teamId, unitId: p.unitId || s.config.teams.find((t) => t.id === teamId)?.unitId, assigneeId: n.assigneeId || null,
    claimedAt: n.assigneeId ? ctx.now : undefined, linkedRecordIds: [], priority: "normal", status: "open", dueAt: dueAt || undefined, dependsOn: [], checklist: [],
    notes: [], evidenceFileIds: [], createdAt: ctx.now, createdBy: ctx.viewerId, slaPolicyId: "sla-task", projectId, milestoneId: m?.id,
    phaseId: m?.phaseId || p.phaseId, estimateHours: n.estimateHours });
  p.updatedAt = ctx.now;
  storyEvent(s, ctx, p, { action: "task.created", objectType: "task", objectId: id,
    summary: "Added task “" + n.title.trim() + "” to " + p.ref + (m ? " for “" + m.label + "”" : "") + (n.assigneeId ? ", assigned to " + nameOf(s, n.assigneeId) : ", in the team queue") });
  return { ok: true, state: s, message: "Task added. It shows in Work for its team" + (n.assigneeId ? " and assignee." : "."), id };
}

/* ── Approved change requests ──────────────────────────────────────────── */

registerEffect("change-milestone", (s, ctx, r) => {
  const m = s.data.milestones.find((x) => x.id === r.fields.milestoneId);
  if (!m) return { ok: false, error: "The milestone no longer exists, so nothing was changed." };
  if (m.completedAt) return { ok: false, error: "“" + m.label + "” is already complete, so its date was not changed." };
  const to = projectDay(String(r.fields.newDate || ""), s.config.timezone);
  if (!to) return { ok: false, error: "The request has no valid new date." };
  if (projectDaysBetween(m.dueAt, to, s.config.timezone) === 0) return { ok: true, effect: "“" + m.label + "” is already on " + fmtDate(to, s.config.timezone) + "; nothing changed" };
  applyMove(s, ctx, m, to, { id: "system", kind: "system" }, r.ref, String(r.fields.reason || ""));
  return { ok: true, effect: "Moved “" + m.label + "” to " + fmtDate(to, s.config.timezone) };
});

registerDecisionHook((s, ctx, r, a, kind, final) => {
  const form = s.config.requestForms.find((f) => f.id === r.formId);
  if (form?.effect.kind !== "change-milestone" || !final || kind === "return") return;
  const m = s.data.milestones.find((x) => x.id === r.fields.milestoneId);
  const p = m && s.data.projects.find((x) => x.id === m.projectId);
  if (!m || !p) return;
  logEvent(s, ctx, { action: "milestone.change." + (kind === "approve" ? "approved" : "declined"), objectType: "milestone", objectId: m.id, recordIds: [],
    teamId: p.teamId, unitId: p.unitId, storyKey: projectStory(p.id),
    summary: (kind === "approve" ? "Approved " : "Declined ") + r.ref + " to move “" + m.label + "”." + (kind === "approve" ? " The date changes when the request is run." : " The date is unchanged.") });
  void a;
});

/* ── Metrics ───────────────────────────────────────────────────────────── */

const activeProjects = (q: Q) => projectsFor(q).filter((p) => p.status === "active" || p.status === "planned" || p.status === "on_hold");

registerMetric("projectsAtRisk", (q, _def, _start, end) => {
  const list = activeProjects(q);
  const flagged = list.filter((p) => projectHealth(q.s, p, end).health !== "on_track");
  const differs = list.filter((p) => { const h = projectHealth(q.s, p, end); return h.differs; }).length;
  return {
    value: flagged.length, num: flagged.length, den: list.length, ids: flagged.map((p) => p.id),
    notes: ["Computed health: next milestone slip, overdue milestones and tasks, unsatisfied gates near their date and open high risks. Owner-reported health is shown separately."
      + (differs ? " " + differs + " of " + list.length + " differ from their owner-reported health." : "")]
  };
});

registerMetric("milestonesOnTime", (q, _def, _start, end) => {
  const list = activeProjects(q);
  const withNext = list.map((p) => ({ p, m: nextMilestoneOf(q.s, p.id) })).filter((x) => !!x.m);
  const ok = withNext.filter((x) => milestoneSlipDays(q.s, x.m!) < q.s.config.projects.atRiskSlipDays && ms(x.m!.dueAt) >= ms(end));
  const without = list.length - withNext.length;
  return {
    value: withNext.length ? (100 * ok.length) / withNext.length : null, num: ok.length, den: withNext.length, ids: withNext.map((x) => x.p.id),
    notes: ["Share of active " + projectTerms(q.s.config).manyLower + " whose next milestone is not overdue and has slipped less than " + q.s.config.projects.atRiskSlipDays + " days from its baseline."
      + (without ? " " + without + " with no open milestone " + (without === 1 ? "is" : "are") + " left out." : "")]
  };
});
