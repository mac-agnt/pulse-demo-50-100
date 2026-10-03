/* Agent outcomes that can be evidenced from core data. Only two are defined:
   data issues an agent opened (and how many were later resolved), and tasks an
   agent created (and how many are done). Anything else is "Not measured". */

import type { Q } from "../../core/query";
import type { AgentDef, DataIssue, Id, Task } from "../../core";

export interface AgentOutcome {
  agent: AgentDef;
  issuesOpened: DataIssue[];
  issuesResolved: number;
  issuesDismissed: number;
  /** Issue events whose issue the viewer cannot see. */
  issuesHidden: number;
  tasksCreated: Task[];
  tasksDone: number;
}

/** Issues opened by an agent, from the audit trail, within the viewer's scope. */
export function agentIssueIds(q: Q, agentId: Id): Id[] {
  const ids = q.events().filter((e) => e.actorId === agentId && e.objectType === "issue" && e.action === "issue.opened").map((e) => e.objectId);
  return [...new Set(ids)];
}

export function agentTasks(q: Q, agentId: Id): Task[] {
  return q.tasks().filter((t) => t.createdBy === agentId);
}

export function agentOutcomes(q: Q): AgentOutcome[] {
  const issues = new Map(q.issues({ ignoreScope: true }).map((i) => [i.id, i]));
  return q.s.config.agents.map((agent) => {
    const ids = agentIssueIds(q, agent.id);
    const seen = ids.map((id) => issues.get(id)).filter((i): i is DataIssue => !!i);
    const tasks = agentTasks(q, agent.id);
    return {
      agent,
      issuesOpened: seen,
      issuesResolved: seen.filter((i) => i.state === "resolved").length,
      issuesDismissed: seen.filter((i) => i.state === "dismissed").length,
      issuesHidden: ids.length - seen.length,
      tasksCreated: tasks,
      tasksDone: tasks.filter((t) => t.status === "done").length
    };
  });
}

export const ISSUE_STATE_LABEL: Record<DataIssue["state"], string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed" };
export const ISSUE_STATE_TONE = { open: "warn", in_progress: "accent", resolved: "ok", dismissed: "neutral" } as const;
