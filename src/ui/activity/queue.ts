/* The one "needs attention" queue. Activity > Needs attention and Home > Today
   priorities both read this, so an item shown in one place is the same item,
   with the same owner and next action, in the other. Each underlying object
   appears once: a decision that an agent run is waiting on, a project risk
   linked to a request and the request's own approval all collapse into one row.

   Sources: the shared attention() selector (failed runs and actions, overdue
   decisions and tasks, blocked work, high-severity data issues), pending
   decisions, runs waiting for input, medium data issues, and, only when the
   module is on, project risks and overdue milestones, agent runs that failed
   or wait for approval, supplier invoice exceptions and standards evidence. */

import { can, moduleEnabled, ops, projectsFor, scopeTeams, store, type Focus, type Id, type Tone } from "../../core";
import type { Q } from "../../core/query";
import { attention, currentStage, waitingOnMe } from "../selectors";

export type Severity = "high" | "medium" | "low";

export interface QueueItem {
  /** The underlying object; duplicates from different sources share it. */
  key: string;
  source: string;
  title: string;
  reason: string;
  ownerId: Id | null;
  deadline?: string;
  since: string;
  tone: Tone;
  severity: Severity;
  /** Plain state of the object: "Failed", "Overdue", "Waiting for a decision"... */
  state: string;
  next: string;
  open: { kind: Focus["kind"]; id: Id };
  /** Other sources that pointed at the same object. */
  also: string[];
  inline?: { kind: "retryRun" | "claimTask" | "startIssue"; id: Id; label: string };
  /** Module the item comes from, for filters. */
  area: "Work" | "Records" | "Projects" | "Agents" | "Purchasing" | "Standards";
}

const FLAG_LABEL: Record<string, string> = {
  over_order: "Invoice is above its order", no_receipt: "No receipt recorded", duplicate: "Possible duplicate invoice",
  no_order: "No matching order", currency_mismatch: "Currency differs from the order"
};

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const toneOfSev = (s: Severity): Tone => (s === "high" ? "bad" : s === "medium" ? "warn" : "neutral");

/** Can the viewer see an agent run? Org-wide people, agent managers, the person it waits on, or anyone whose teams it covers. */
function canSeeAgentRun(q: Q, r: { scopeTeamIds: Id[] | "all"; waitingOwnerId?: Id; agentId: Id }): boolean {
  const v = q.viewer;
  if (v.isOrgWide || can(v, "agents.manage") || r.waitingOwnerId === v.person.id) return true;
  const agent = q.s.config.agents.find((a) => a.id === r.agentId);
  if (agent?.responsibleId === v.person.id) return true;
  const mine = new Set([...v.overseenTeamIds, ...v.memberTeamIds]);
  return r.scopeTeamIds === "all" ? false : r.scopeTeamIds.some((t) => mine.has(t));
}

function agentRunInScope(q: Q, r: { scopeTeamIds: Id[] | "all"; waitingOwnerId?: Id }): boolean {
  const sel = q.ctx.scope;
  if (sel.kind === "organisation") return true;
  if (sel.kind === "personal") return r.waitingOwnerId === q.viewer.person.id;
  const teams = scopeTeams(q.s, sel) || [];
  return r.scopeTeamIds === "all" || r.scopeTeamIds.some((t) => teams.includes(t));
}

export function attentionQueue(q: Q): QueueItem[] {
  const s = q.s;
  const me = q.viewer.person.id;
  const out = new Map<string, QueueItem>();
  const add = (it: Omit<QueueItem, "tone" | "also">) => {
    const prev = out.get(it.key);
    const full: QueueItem = { ...it, tone: toneOfSev(it.severity), also: [] };
    if (!prev) { out.set(it.key, full); return; }
    // Keep the more urgent framing, remember the other source.
    if (SEV_RANK[full.severity] < SEV_RANK[prev.severity]) { full.also = [...prev.also, prev.source]; out.set(it.key, full); }
    else if (!prev.also.includes(full.source) && prev.source !== full.source) prev.also.push(full.source);
  };
  const reqKey = (requestId: Id) => "request:" + requestId;

  /* Shared attention selector. */
  for (const a of attention(q)) {
    if (a.kind === "run") {
      const run = q.run(a.id);
      add({ key: "run:" + a.id, source: "Failed workflow run", area: "Work", title: a.title, reason: a.reason, ownerId: a.ownerId, since: a.since, severity: "high",
        state: "Failed", next: a.next, open: { kind: "run", id: a.id },
        inline: run && can(q.viewer, "workflows.operate") ? { kind: "retryRun", id: a.id, label: "Retry" } : undefined });
    } else if (a.kind === "execution") {
      add({ key: "exec:" + a.id, source: "Failed action", area: "Work", title: a.title, reason: a.reason, ownerId: a.ownerId, since: a.since, severity: "high",
        state: "Approved, action failed", next: a.next, open: { kind: "request", id: a.id } });
    } else if (a.kind === "approval") {
      const ap = q.approval(a.id);
      add({ key: ap ? reqKey(ap.requestId) : "approval:" + a.id, source: "Overdue decision", area: "Work", title: a.title, reason: a.reason, ownerId: a.ownerId,
        deadline: ap ? currentStage(ap)?.dueAt : undefined, since: a.since, severity: "medium", state: "Decision overdue", next: a.next, open: { kind: "approval", id: a.id } });
    } else if (a.kind === "task" || a.kind === "blocked") {
      const t = q.task(a.id);
      add({ key: "task:" + a.id, source: a.kind === "task" ? "Overdue task" : "Blocked task", area: "Work", title: a.title, reason: a.reason, ownerId: a.ownerId,
        deadline: t?.dueAt, since: a.kind === "task" ? (t?.dueAt || a.since) : a.since, severity: a.kind === "task" ? "high" : "medium",
        state: a.kind === "task" ? "Overdue" : "Blocked", next: a.next, open: { kind: "task", id: a.id },
        inline: t && !t.assigneeId ? { kind: "claimTask", id: a.id, label: "Claim" } : undefined });
    } else if (a.kind === "issue") {
      const i = q.issues().find((x) => x.id === a.id);
      add({ key: "issue:" + a.id, source: "Data issue", area: "Records", title: a.title, reason: a.reason, ownerId: a.ownerId, since: a.since, severity: "medium",
        state: i?.state === "in_progress" ? "In progress" : "Open", next: a.next, open: { kind: "issue", id: a.id },
        inline: i && i.state === "open" && can(q.viewer, "records.edit") ? { kind: "startIssue", id: a.id, label: "Start" } : undefined });
    }
  }

  /* Pending decisions that are not yet overdue. Waiting on the viewer ranks higher. */
  const mineIds = new Set(waitingOnMe(q).map((a) => a.id));
  for (const ap of q.approvals()) {
    const st = currentStage(ap);
    if (ap.status !== "pending" || !st) continue;
    if (out.has(reqKey(ap.requestId))) continue; // already listed as an overdue decision
    const req = q.request(ap.requestId);
    const mine = mineIds.has(ap.id);
    add({ key: reqKey(ap.requestId), source: "Pending decision", area: "Work", title: (req ? req.ref + " " : "") + (req?.title || "Request"),
      reason: mine ? "Waiting on you at " + st.label : "Waiting on " + q.name(st.assigneeId) + " at " + st.label,
      ownerId: st.assigneeId, deadline: st.dueAt, since: st.startedAt || ap.submittedAt, severity: mine ? "medium" : "low",
      state: "Waiting for a decision", next: mine ? "Decide" : "Open the request", open: { kind: "approval", id: ap.id } });
  }
  for (const r of q.runs()) {
    if (r.status === "awaiting_input") add({ key: "run:" + r.id, source: "Run waiting for input", area: "Work", title: r.ref + " " + r.title,
      reason: "A step is waiting for a person", ownerId: r.assigneeId || r.ownerId, since: r.updatedAt, severity: "medium", state: "Waiting for input", next: "Provide the input", open: { kind: "run", id: r.id } });
  }
  for (const i of q.issues()) {
    if ((i.state === "open" || i.state === "in_progress") && i.severity === "medium") add({ key: "issue:" + i.id, source: "Data issue", area: "Records", title: i.title,
      reason: "Medium-severity data issue", ownerId: i.ownerId, since: i.detectedAt, severity: "low", state: i.state === "in_progress" ? "In progress" : "Open",
      next: "Resolve the issue", open: { kind: "issue", id: i.id },
      inline: i.state === "open" && can(q.viewer, "records.edit") ? { kind: "startIssue", id: i.id, label: "Start" } : undefined });
  }

  /* Projects module. */
  if (moduleEnabled(s.config, "projects")) {
    const visible = new Map(projectsFor(q).filter((p) => p.status !== "completed" && p.status !== "cancelled").map((p) => [p.id, p]));
    const P = s.config.projects?.label || "Project";
    for (const r of s.data.risks) {
      const p = visible.get(r.projectId);
      if (!p || r.state === "closed" || r.kind === "decision" || r.severity === "low") continue;
      const nextMs = s.data.milestones.filter((m) => m.projectId === p.id && !m.completedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
      add({ key: r.requestId ? reqKey(r.requestId) : "risk:" + r.id, source: P + " " + (r.kind === "issue" ? "issue" : "risk"), area: "Projects",
        title: r.title, reason: p.title + ": " + r.impact, ownerId: r.ownerId, deadline: nextMs?.dueAt, since: r.createdAt,
        severity: r.severity === "high" ? "high" : "medium", state: r.state === "mitigating" ? "Mitigating" : "Open", next: r.nextAction || "Open the " + P.toLowerCase(),
        open: { kind: "project", id: p.id } });
    }
    for (const m of s.data.milestones) {
      const p = visible.get(m.projectId);
      if (!p || m.completedAt || m.dueAt >= q.ctx.now) continue;
      add({ key: "milestone:" + m.id, source: "Overdue milestone", area: "Projects", title: m.label, reason: p.title + ": milestone past its date", ownerId: p.ownerId,
        deadline: m.dueAt, since: m.dueAt, severity: "high", state: "Overdue", next: "Replan or complete", open: { kind: "project", id: p.id } });
    }
  }

  /* Agents capability. */
  if (s.config.capabilities.agents) {
    for (const r of s.data.agentRuns) {
      if (r.state !== "failed" && r.state !== "waiting_approval") continue;
      if (!canSeeAgentRun(q, r) || !agentRunInScope(q, r)) continue;
      const agent = s.config.agents.find((a) => a.id === r.agentId);
      const failedStep = [...r.steps].reverse().find((x) => x.status === "failed");
      if (r.state === "failed") {
        add({ key: "agentRun:" + r.id, source: "Agent run failed", area: "Agents", title: r.ref + " " + r.goal,
          reason: failedStep?.error?.business || "The run failed", ownerId: agent?.responsibleId || null, since: failedStep?.at || r.startedAt,
          severity: "high", state: "Failed", next: failedStep?.error?.retryable ? "Retry the failed step" : "Review the run", open: { kind: "agentRun", id: r.id } });
      } else {
        add({ key: r.approvalRequestId ? reqKey(r.approvalRequestId) : "agentRun:" + r.id, source: "Agent run waiting for approval", area: "Agents",
          title: r.ref + " " + r.goal, reason: (agent?.name || "An agent") + " is waiting for a human decision", ownerId: r.waitingOwnerId || agent?.responsibleId || null,
          since: r.steps.find((x) => x.kind === "waiting_approval")?.at || r.startedAt, severity: r.waitingOwnerId === me ? "medium" : "low",
          state: "Waiting for approval", next: "Decide", open: r.approvalRequestId ? { kind: "request", id: r.approvalRequestId } : { kind: "agentRun", id: r.id } });
      }
    }
  }

  /* Purchasing module. */
  if (moduleEnabled(s.config, "purchasing") && (can(q.viewer, "purchasing.manage") || can(q.viewer, "finance.view"))) {
    for (const inv of s.data.invoices) {
      if (inv.status !== "exception") continue;
      const order = inv.orderId ? s.data.orders.find((o) => o.id === inv.orderId) : undefined;
      if (order && !q.inScope({ teamId: order.teamId, unitId: order.unitId }, [order.ownerId])) continue;
      add({ key: inv.requestId ? reqKey(inv.requestId) : "invoice:" + inv.id, source: "Invoice exception", area: "Purchasing", title: inv.ref,
        reason: inv.flags.length ? inv.flags.map((f) => FLAG_LABEL[f] || f).join("; ") : "Does not match its order",
        ownerId: order?.ownerId || null, deadline: inv.dueAt, since: inv.issuedAt, severity: "medium", state: "Exception", next: "Review the match", open: { kind: "invoice", id: inv.id } });
    }
  }

  /* Standards module. Receiving a file is not acceptance: received evidence waits for review. */
  if (moduleEnabled(s.config, "standards") && can(q.viewer, "standards.review") && q.ctx.scope.kind !== "personal") {
    for (const ob of s.data.obligations) {
      const req = s.config.standards.requirements.find((r) => r.id === ob.requirementId);
      if (ob.subject.kind === "project") {
        const p = s.data.projects.find((x) => x.id === ob.subject.id);
        if (p && !q.inScope(p, [p.ownerId])) continue;
      }
      const label = req?.label || ob.requirementId;
      if (ob.state === "received" || ob.state === "under_review") {
        add({ key: ob.requestId ? reqKey(ob.requestId) : "obligation:" + ob.id, source: "Evidence to review", area: "Standards", title: label,
          reason: ob.state === "received" ? "Evidence received, not yet reviewed" : "Evidence under review", ownerId: ob.evidence?.receivedBy || null,
          deadline: ob.dueAt, since: ob.evidence?.receivedAt || ob.dueAt || q.ctx.now, severity: "low", state: ob.state === "received" ? "Received" : "Under review",
          next: "Review the evidence", open: { kind: "obligation", id: ob.id } });
      } else if ((ob.state === "missing" || ob.state === "expired" || ob.state === "rejected") && ob.dueAt && ob.dueAt < q.ctx.now) {
        add({ key: "obligation:" + ob.id, source: "Requirement overdue", area: "Standards", title: label,
          reason: ob.state === "expired" ? "Evidence expired" : ob.state === "rejected" ? "Evidence rejected: " + (ob.rejectionReason || "see the review") : "Evidence missing past its due date",
          ownerId: null, deadline: ob.dueAt, since: ob.dueAt, severity: "medium", state: ob.state === "expired" ? "Expired" : ob.state === "rejected" ? "Rejected" : "Missing",
          next: "Request the evidence", open: { kind: "obligation", id: ob.id } });
      }
    }
  }

  return [...out.values()].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]
    || (a.deadline || "￿").localeCompare(b.deadline || "￿") || a.since.localeCompare(b.since));
}

export const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

/** Run an item's inline resolution through the shared ops. The op rechecks authority. */
export function runInline(it: QueueItem) {
  if (!it.inline) return;
  if (it.inline.kind === "retryRun") store.run(ops.retryRun, it.inline.id);
  else if (it.inline.kind === "claimTask") store.run(ops.claimTask, it.inline.id);
  else store.run(ops.setIssueState, it.inline.id, "in_progress", "Started from the attention queue");
}
