/* Stories: the recorded events of one run, request or change grouped into
   one item, so Activity shows what happened once instead of a card for every
   low-level event. Grouping uses the event's storyKey (written by the ops),
   else the request behind an approval, else the object itself. */

import { storyKeyOf, type AuditEvent, type Tone } from "../../core";
import type { Q } from "../../core/query";
import { objectResolver, type ObjectInfo } from "./eventInfo";

export type Stream = "data" | "people" | "agents";
export type StreamFilter = "all" | "people" | "agents" | "systems";

export interface Story {
  key: string;
  /** Oldest first. */
  events: AuditEvent[];
  first: AuditEvent;
  last: AuditEvent;
  stream: Stream;
  /** The person or agent responsible: the latest person or agent actor, else the source. */
  responsibleId: string;
  object: ObjectInfo;
  why: { text: string; tone: Tone };
  simulated: boolean;
  /** Records and objects the story touched. */
  recordIds: string[];
}

function streamOf(events: AuditEvent[]): Stream {
  if (events.some((e) => e.actorKind === "agent" || e.objectType === "agentRun" || e.objectType === "agent")) return "agents";
  if (events.some((e) => e.actorKind === "person")) return "people";
  return "data";
}

export function matchesFilter(st: Story, f: StreamFilter): boolean {
  if (f === "all") return true;
  if (f === "people") return st.events.some((e) => e.actorKind === "person");
  if (f === "agents") return st.events.some((e) => e.actorKind === "agent");
  return st.events.some((e) => e.actorKind === "system" || e.actorKind === "source");
}

/** Why it matters, from the current state of the object where it is known, else from the events. */
function whyOf(q: Q, all: AuditEvent[]): { text: string; tone: Tone } {
  // Judge by what happened to the object; comments only matter when they are all there is.
  const events = all.some((e) => e.objectType !== "comment") ? all.filter((e) => e.objectType !== "comment") : all;
  const last = events[events.length - 1];
  const any = (re: RegExp) => events.some((e) => re.test(e.action));
  const s = q.s;
  const req = last.objectType === "request" ? s.data.requests.find((r) => r.id === last.objectId)
    : last.objectType === "approval" ? s.data.requests.find((r) => r.id === s.data.approvals.find((a) => a.id === last.objectId)?.requestId) : undefined;
  if (req) {
    const ap = s.data.approvals.find((a) => a.id === req.approvalId);
    if (req.execution.status === "failed") return { text: "Approved, but the action failed. Someone has to recover it.", tone: "bad" };
    if (req.execution.status === "succeeded") return { text: "Decided and applied: " + req.execution.effect + ".", tone: "ok" };
    if (ap?.status === "pending") {
      const st = ap.stages.find((x) => x.status === "pending");
      return { text: "Waiting on a decision" + (st ? " by " + q.name(st.assigneeId) : "") + ". Nothing changes until then.", tone: "warn" };
    }
    if (req.status === "declined") return { text: "Declined. Nothing was applied.", tone: "neutral" };
    if (req.status === "changes_requested") return { text: "Returned for changes to the requester.", tone: "warn" };
    if (req.status === "approved") return { text: "Approved. The action has not run yet.", tone: "warn" };
  }
  if (last.objectType === "run") {
    const r = s.data.runs.find((x) => x.id === last.objectId);
    if (r?.status === "failed") return { text: "The workflow stopped and needs recovery. Later steps are waiting.", tone: "bad" };
    if (r?.status === "paused") return { text: "Paused on purpose. Later steps will not start until it resumes.", tone: "warn" };
    if (r?.status === "completed") return { text: "The workflow finished.", tone: "ok" };
  }
  if (last.objectType === "agentRun") {
    const r = s.data.agentRuns.find((x) => x.id === last.objectId);
    if (r?.state === "failed") return { text: "The agent run failed. Its owner decides whether to retry the failed step.", tone: "bad" };
    if (r?.state === "waiting_approval") return { text: "A restricted action waits for a human decision in Work.", tone: "warn" };
    if (r?.state === "completed") return { text: "The run finished. Its outputs are linked in the run.", tone: "ok" };
    if (r) return { text: "The run is in progress. Sample execution, no live AI.", tone: "accent" };
  }
  if (any(/fail/)) return { text: "Something failed and needs a person.", tone: "bad" };
  if (any(/^issue\./)) return { text: "A possible data problem was flagged for review.", tone: "warn" };
  if (any(/^sync\./)) return { text: "Source data changed what Pulse shows for these records.", tone: "neutral" };
  if (any(/^update\.published/)) return { text: "Shared with its audience.", tone: "ok" };
  if (any(/^update\.drafted/)) return { text: "A draft only. It reaches nobody until someone who can publish updates publishes it.", tone: "warn" };
  if (any(/^comment\./)) return { text: "Discussion on the item; mentioned people are notified in Pulse.", tone: "neutral" };
  if (any(/^task\.completed/)) return { text: "Work finished.", tone: "ok" };
  if (any(/^task\./)) return { text: "Work was created or changed.", tone: "neutral" };
  if (any(/^record\./)) return { text: "A record changed. Its history keeps the earlier value.", tone: "neutral" };
  if (any(/^config\./)) return { text: "Settings changed for everyone in the organisation.", tone: "neutral" };
  return { text: "Recorded change.", tone: "neutral" };
}

/** Group visible events into stories, newest story first. */
export function buildStories(q: Q, events: AuditEvent[]): Story[] {
  const resolve = objectResolver(q);
  const by = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const k = storyKeyOf(q.s, e);
    const list = by.get(k);
    if (list) list.push(e); else by.set(k, [e]);
  }
  const out: Story[] = [];
  for (const [key, list] of by) {
    list.sort((a, b) => a.at.localeCompare(b.at));
    const first = list[0], last = list[list.length - 1];
    const lead = [...list].reverse().find((e) => e.actorKind === "person" || e.actorKind === "agent") || last;
    // The story is about the object of its first event (the request, run or record), not a later comment.
    const primary = list.find((e) => e.objectType !== "comment") || first;
    out.push({
      key, events: list, first, last, stream: streamOf(list), responsibleId: lead.actorId,
      object: resolve(primary), why: whyOf(q, list), simulated: list.some((e) => e.simulated),
      recordIds: [...new Set(list.flatMap((e) => e.recordIds))]
    });
  }
  return out.sort((a, b) => b.last.at.localeCompare(a.last.at));
}
