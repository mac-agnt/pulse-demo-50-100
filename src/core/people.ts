/* Employee management reads. Employment details (stage, contract, certificates,
   documents, leave) are visible to the person themselves, their manager,
   managers of their team or unit, and administrators. Everyone else sees the
   plain directory only. Workload figures count real tasks and are never a
   performance score. */

import type { Q } from "./query";
import { ms, DAY } from "./time";
import type { Certification, Employment, Id, LeaveEntry, Person } from "./types";

export interface PersonRow {
  person: Person;
  e: Employment;
  team: string;
  unit: string;
  manager: string;
  certs: { cert: Certification; state: "missing" | "lapsed" | "due" | "ok"; days: number | null }[];
  certIssue: "missing" | "lapsed" | "due" | null;
  docsOutstanding: number;
  openTasks: number;
  overdueTasks: number;
  awayNow: LeaveEntry | null;
  nextLeave: LeaveEntry | null;
  probationDueDays: number | null;
  accessReviewDue: boolean;
  tenureDays: number;
}

export function canSeeEmployment(q: Q, e: Employment): boolean {
  const v = q.viewer;
  if (v.isOrgWide || e.personId === v.person.id || e.managerId === v.person.id) return true;
  if (!v.permissions.has("tasks.manage")) return false;
  return (!!e.teamId && v.overseenTeamIds.includes(e.teamId)) || (!!e.unitId && v.overseenUnitIds.includes(e.unitId));
}

/** Employment records the viewer may see, inside the selected scope. */
export function employment(q: Q, opts: { ignoreScope?: boolean } = {}): Employment[] {
  const sel = q.ctx.scope;
  return q.s.data.employment.filter((e) => {
    if (!canSeeEmployment(q, e) || e.stage === "left") return false;
    if (opts.ignoreScope || sel.kind === "organisation") return true;
    if (sel.kind === "personal") return e.personId === q.viewer.person.id || e.managerId === q.viewer.person.id;
    if (sel.kind === "unit") return e.unitId === sel.id;
    return e.teamId === sel.id;
  });
}

export function certState(c: Certification, now: string): { state: "missing" | "lapsed" | "due" | "ok"; days: number | null } {
  if (!c.expires) return { state: "missing", days: null };
  const days = Math.round((ms(c.expires) - ms(now)) / DAY);
  return { state: days < 0 ? "lapsed" : days <= 30 ? "due" : "ok", days };
}

export function personRows(q: Q, opts: { ignoreScope?: boolean } = {}): PersonRow[] {
  const now = q.ctx.now;
  const tasks = q.s.data.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  return employment(q, opts).map((e) => {
    const person = q.s.data.people.find((p) => p.id === e.personId)!;
    const certs = e.certifications.map((cert) => ({ cert, ...certState(cert, now) }));
    const certIssue = certs.some((c) => c.state === "lapsed") ? "lapsed" : certs.some((c) => c.state === "due") ? "due"
      : e.stage !== "onboarding" && certs.some((c) => c.state === "missing") ? "missing" : null;
    const mine = tasks.filter((t) => t.assigneeId === e.personId);
    const leave = q.s.data.leave.filter((l) => l.personId === e.personId && l.status === "approved");
    const awayNow = leave.find((l) => ms(l.from) <= ms(now) && ms(l.to) >= ms(now)) || null;
    const nextLeave = leave.filter((l) => ms(l.from) > ms(now)).sort((a, b) => a.from.localeCompare(b.from))[0] || null;
    return {
      person, e,
      team: q.teamLabel(e.teamId), unit: q.unitLabel(e.unitId), manager: e.managerId ? q.name(e.managerId) : "None",
      certs, certIssue,
      docsOutstanding: e.documents.filter((d) => !d.signedAt).length,
      openTasks: mine.length,
      overdueTasks: mine.filter((t) => t.dueAt && ms(t.dueAt) < ms(now)).length,
      awayNow, nextLeave,
      probationDueDays: e.stage === "probation" && e.probationEnds ? Math.round((ms(e.probationEnds) - ms(now)) / DAY) : null,
      accessReviewDue: !e.lastAccessReview || ms(now) - ms(e.lastAccessReview) > q.s.config.people.accessReviewEveryDays * DAY,
      tenureDays: Math.round((ms(now) - ms(e.startDate)) / DAY)
    };
  });
}

export function leaveInWindow(q: Q, fromDays: number, toDays: number): { entry: LeaveEntry; row: PersonRow }[] {
  const now = ms(q.ctx.now);
  const start = now + fromDays * DAY, end = now + toDays * DAY;
  const rows = personRows(q);
  const byId = new Map<Id, PersonRow>(rows.map((r) => [r.person.id, r]));
  return q.s.data.leave
    .filter((l) => l.status === "approved" && byId.has(l.personId) && ms(l.to) >= start && ms(l.from) <= end)
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((entry) => ({ entry, row: byId.get(entry.personId)! }));
}

export function tenureLabel(days: number): string {
  if (days < 0) return "starts in " + -days + " d";
  if (days < 60) return days + " days";
  const months = Math.floor(days / 30.4);
  if (months < 24) return months + " months";
  const y = Math.floor(months / 12), m = months % 12;
  return y + " years" + (m ? ", " + m + " months" : "");
}
