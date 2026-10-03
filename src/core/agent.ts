/* Sample answers. No AI model is connected in this build: every answer is
   assembled from the records the asker can already see, through the same
   query layer as the pages, and is labelled as a sample response.
   Citations point at real seeded objects; nothing is invented. */

import { query } from "./query";
import { computeMetric } from "./metrics";
import { scopeLabel } from "./access";
import { relative } from "./time";
import { ISSUE_LABEL } from "./quality";
import type { CoreState, Ctx, Id } from "./types";

export interface Citation { kind: "task" | "approval" | "record" | "issue" | "run" | "request" | "event"; id: Id; label: string }

export interface Answer {
  text: string;
  cols?: string[];
  rows?: string[][];
  citations: Citation[];
  scope: string;
  period: string;
  limitations: string[];
  sample: true;
}

const SAMPLE_NOTE = "Sample response built from the records you can see. No AI model is connected.";

export function answer(s: CoreState, ctx: Ctx, question: string): Answer {
  const q = query(s, ctx);
  const tz = s.config.timezone;
  const scope = scopeLabel(s, ctx.scope);
  const lim: string[] = [SAMPLE_NOTE];
  const text = question.toLowerCase();
  const base = { scope, sample: true as const, limitations: lim };

  if (/overdue|late|behind|slip/.test(text)) {
    const late = q.tasks().filter((t) => q.isOverdue(t)).sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));
    return { ...base, period: "Now",
      text: late.length ? late.length + " task" + (late.length === 1 ? " is" : "s are") + " overdue in " + scope + ". The oldest is “" + late[0].title + "”." : "Nothing is overdue in " + scope + ".",
      cols: ["Task", "Owner", "Due"], rows: late.slice(0, 6).map((t) => [t.title, q.name(t.assigneeId), relative(t.dueAt, ctx.now, tz)]),
      citations: late.slice(0, 6).map((t) => ({ kind: "task", id: t.id, label: t.title })) };
  }
  if (/approv|decision|decide|waiting on me|sign/.test(text)) {
    const mine = q.approvals().filter((a) => a.status === "pending" && a.stages.find((st) => st.status === "pending")?.assigneeId === ctx.viewerId);
    const all = q.approvals().filter((a) => a.status === "pending");
    const req = (id: Id) => s.data.requests.find((r) => r.id === id)!;
    return { ...base, period: "Now",
      text: mine.length + " decision" + (mine.length === 1 ? " is" : "s are") + " waiting on you, out of " + all.length + " pending in " + scope + ".",
      cols: ["Request", "With", "Waiting since"],
      rows: all.slice(0, 6).map((a) => [req(a.requestId).ref + " " + req(a.requestId).title, q.name(a.stages.find((st) => st.status === "pending")?.assigneeId), relative(a.stages.find((st) => st.status === "pending")?.startedAt, ctx.now, tz)]),
      citations: all.slice(0, 6).map((a) => ({ kind: "approval", id: a.id, label: req(a.requestId).ref })) };
  }
  if (/data|quality|issue|missing|duplicate|conflict/.test(text)) {
    const open = q.issues().filter((i) => i.state === "open" || i.state === "in_progress");
    const comp = computeMetric(s, ctx, "completeness");
    if (comp?.partial) lim.push("Completeness is partial: " + comp.missing.map((m) => m.label + ", " + m.reason).join("; "));
    return { ...base, period: "Now",
      text: open.length + " data issue" + (open.length === 1 ? " is" : "s are") + " open in " + scope + ". Data completeness is " + (comp?.display || "not available") + ".",
      cols: ["Issue", "Kind", "Owner"], rows: open.slice(0, 6).map((i) => [i.title, ISSUE_LABEL[i.kind], q.name(i.ownerId)]),
      citations: open.slice(0, 6).map((i) => ({ kind: "issue", id: i.id, label: i.title })) };
  }
  if (/fail|broken|error|workflow|run/.test(text)) {
    const failed = q.runs().filter((r) => r.status === "failed");
    const exec = q.requests().filter((r) => r.execution.status === "failed");
    return { ...base, period: "Now",
      text: failed.length + " workflow run" + (failed.length === 1 ? " has" : "s have") + " failed and " + exec.length + " approved action" + (exec.length === 1 ? "" : "s") + " did not complete.",
      cols: ["Item", "Problem"], rows: [...failed.map((r) => [r.ref + " " + r.title, r.failure?.message || "Failed"]), ...exec.map((r) => [r.ref + " " + r.title, r.execution.lastError || "Failed"])],
      citations: [...failed.map((r) => ({ kind: "run" as const, id: r.id, label: r.ref })), ...exec.map((r) => ({ kind: "request" as const, id: r.id, label: r.ref }))] };
  }
  // Default: what changed in the last day, from the audit trail.
  const since = new Date(new Date(ctx.now).getTime() - 24 * 3600_000).toISOString();
  const recent = q.events().filter((e) => e.at >= since).sort((a, b) => b.at.localeCompare(a.at));
  return { ...base, period: "Last 24 hours",
    text: recent.length ? recent.length + " things changed in " + scope + " in the last day. The latest: " + recent[0].summary + "." : "Nothing changed in " + scope + " in the last day.",
    cols: ["When", "Who", "What"], rows: recent.slice(0, 6).map((e) => [relative(e.at, ctx.now, tz), q.name(e.actorId), e.summary]),
    citations: recent.slice(0, 6).map((e) => ({ kind: "event", id: e.id, label: e.summary })) };
}
