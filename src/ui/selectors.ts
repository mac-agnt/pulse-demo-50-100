/* Shared selectors over the query layer. The top-bar counts, Home, Work,
   Activity and notifications all use these, so a number shown in one place is
   the same number everywhere. */

import type { Q } from "../core/query";
import { isStageOverdue } from "../core/ops";
import { ms } from "../core/time";
import type { Approval, Id, Tone } from "../core/types";
import { personRows } from "../core/people";

export function currentStage(a: Approval) {
  return a.stages.find((st) => st.status === "pending");
}

/** Approvals whose current decision sits with the viewer (directly or by delegation). */
export function waitingOnMe(q: Q): Approval[] {
  const me = q.viewer.person.id;
  return q.approvals({ ignoreScope: true }).filter((a) => {
    if (a.status !== "pending") return false;
    const st = currentStage(a);
    if (!st) return false;
    if (st.assigneeId === me) return true;
    return q.s.data.delegations.some((d) => d.active && d.toId === me && d.fromId === st.assigneeId && d.ruleIds.includes(a.ruleId) && d.until >= q.ctx.now
      && q.s.data.requests.find((r) => r.id === a.requestId)?.requesterId !== me);
  });
}

export function workCounts(q: Q) {
  return {
    tasks: q.tasks().filter((t) => q.isOpenTask(t)).length,
    approvals: waitingOnMe(q).length,
    workflows: q.runs().filter((r) => r.status === "failed" || r.status === "awaiting_input").length,
    /* People needing an action: lapsed certificates, probation reviews due in 30 days, unsigned documents. */
    people: personRows(q).filter((r) => r.certIssue === "lapsed" || (r.probationDueDays !== null && r.probationDueDays <= 30) || r.docsOutstanding > 0).length,
    schedules: q.schedules().filter((x) => x.active).length
  };
}

export interface AttentionItem {
  key: string;
  kind: "run" | "execution" | "task" | "approval" | "issue" | "blocked";
  objectKind: "run" | "request" | "task" | "approval" | "issue";
  id: Id;
  title: string;
  reason: string;
  ownerId: Id | null;
  since: string;
  tone: Tone;
  rank: number;
  next: string;
}

/** Unresolved things that need a person, ordered by urgency then age. */
export function attention(q: Q): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const r of q.runs()) {
    if (r.status === "failed") out.push({ key: "run:" + r.id, kind: "run", objectKind: "run", id: r.id, title: r.ref + " " + r.title,
      reason: r.failure?.message || "Run failed", ownerId: r.assigneeId || r.ownerId, since: r.failure?.at || r.updatedAt, tone: "bad", rank: 0, next: "Recover the run" });
  }
  for (const r of q.requests()) {
    if (r.execution.status === "failed") out.push({ key: "ex:" + r.id, kind: "execution", objectKind: "request", id: r.id, title: r.ref + " " + r.title,
      reason: "Approved, but the action failed: " + (r.execution.lastError || "unknown error"), ownerId: r.requesterId, since: r.execution.executedAt || r.updatedAt, tone: "bad", rank: 0, next: "Review the failed action" });
  }
  for (const a of q.approvals()) {
    if (a.status === "pending" && isStageOverdue(a, q.ctx.now)) {
      const req = q.s.data.requests.find((x) => x.id === a.requestId)!;
      const st = currentStage(a)!;
      out.push({ key: "ap:" + a.id, kind: "approval", objectKind: "approval", id: a.id, title: req.ref + " " + req.title,
        reason: "Decision past its deadline, with " + q.name(st.assigneeId), ownerId: st.assigneeId, since: st.dueAt || a.submittedAt, tone: "warn", rank: 1, next: "Decide or escalate" });
    }
  }
  for (const t of q.tasks()) {
    if (q.isOverdue(t)) out.push({ key: "t:" + t.id, kind: "task", objectKind: "task", id: t.id, title: t.title,
      reason: "Overdue" + (t.assigneeId ? "" : " and unassigned"), ownerId: t.assigneeId, since: t.dueAt!, tone: "bad", rank: 1, next: t.assigneeId ? "Finish or reschedule" : "Assign an owner" });
    else if (q.isOpenTask(t) && q.blockers(t).length && t.dueAt && ms(t.dueAt) - ms(q.ctx.now) < 48 * 3600_000) out.push({ key: "b:" + t.id, kind: "blocked", objectKind: "task", id: t.id, title: t.title,
      reason: "Blocked by “" + q.blockers(t)[0].title + "” and due soon", ownerId: t.assigneeId, since: t.createdAt, tone: "warn", rank: 2, next: "Unblock the dependency" });
  }
  for (const i of q.issues()) {
    if ((i.state === "open" || i.state === "in_progress") && i.severity === "high") out.push({ key: "i:" + i.id, kind: "issue", objectKind: "issue", id: i.id, title: i.title,
      reason: "High-severity data issue", ownerId: i.ownerId, since: i.detectedAt, tone: "warn", rank: 2, next: "Resolve the issue" });
  }
  return out.sort((a, b) => a.rank - b.rank || a.since.localeCompare(b.since));
}
