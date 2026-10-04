/* My work and Team work: two default views over the same canonical tasks.
   Project tasks (with projectId) are ordinary tasks here. Pure functions over
   the query layer, so tests and every view agree. */

import { ms, scopeTeams, type Id, type Priority, type Q, type Task } from "../../core";

export const PRIO_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const byDue = (a: Task, b: Task) =>
  (a.dueAt ? ms(a.dueAt) : Infinity) - (b.dueAt ? ms(b.dueAt) : Infinity) || PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || a.title.localeCompare(b.title);

/** Open tasks assigned to the viewer, whatever the scope, ordered by due date (no due date last). */
export function myWork(q: Q, opts: { includeDone?: boolean } = {}): Task[] {
  const me = q.viewer.person.id;
  return q.tasks({ ignoreScope: true })
    .filter((t) => t.assigneeId === me && t.status !== "cancelled" && (opts.includeDone || q.isOpenTask(t)))
    .sort(byDue);
}

/** Teams whose queues Team work shows: the selected team or unit, everything visible for the organisation,
    and the viewer's own and overseen teams for the personal scope. */
export function teamQueueIds(q: Q): Id[] | null {
  const sel = q.ctx.scope;
  if (sel.kind === "organisation") return null;
  if (sel.kind === "personal") return [...new Set([...q.viewer.memberTeamIds, ...q.viewer.overseenTeamIds])];
  return scopeTeams(q.s, sel) || [];
}

/** Open team tasks in the queues in scope, permission applied by the query layer. */
export function teamWork(q: Q): Task[] {
  const teams = teamQueueIds(q);
  const pool = teams === null ? q.tasks({ ignoreScope: true }) : q.tasks({ ignoreScope: true }).filter((t) => !!t.teamId && teams.includes(t.teamId));
  return pool.filter((t) => q.isOpenTask(t)).sort(byDue);
}

/** A task is blocked while any task it depends on is still open. */
export const isBlocked = (q: Q, t: Task) => q.blockers(t).length > 0;

/** Unestimated means no effort estimate was given. It is never read as zero hours. */
export const isUnestimated = (t: Task) => !(typeof t.estimateHours === "number" && Number.isFinite(t.estimateHours));
