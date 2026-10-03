/* Helpers that turn audit events into readable labels. Activity and Agents both
   use these, so an event reads the same wherever it appears. Every label is
   resolved through the query layer, so objects the viewer cannot see stay hidden. */

import type { Q } from "../../core/query";
import type { ActorKind, AuditEvent, DataIssue, FieldValue, Focus, Tone } from "../../core";

export type ObjectKind = Focus["kind"];

export interface ObjectInfo {
  /** "Task", "Request", ... */
  type: string;
  /** Reference and title, or a reason it cannot be shown. */
  label: string;
  /** Where "open" goes; absent when the object has no page or is not visible. */
  open?: { kind: ObjectKind; id: string };
  hidden?: boolean;
}

export const ACTOR_KIND_LABEL: Record<ActorKind, string> = { person: "Person", agent: "Agent", system: "System", source: "Source sync" };
export const ACTOR_KIND_TONE: Record<ActorKind, Tone> = { person: "neutral", agent: "accent", system: "neutral", source: "neutral" };

const ACTION_OVERRIDES: Record<string, string> = {
  "approval.approve": "Approved",
  "approval.decline": "Declined",
  "approval.return": "Returned for changes",
  "approval.delegate": "Delegated a decision",
  "approval.escalate": "Escalated a decision",
  "request.execution.succeeded": "Action executed",
  "request.execution.failed": "Action failed",
  "sync.completed": "Source sync",
  "export.generated": "Export",
  "config.changed": "Settings changed"
};

/** "task.created" becomes "Task created". */
export function actionLabel(action: string): string {
  if (ACTION_OVERRIDES[action]) return ACTION_OVERRIDES[action];
  const words = action.split(/[._-]+/).filter(Boolean).join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : "Change";
}

/** Plain category used on record timelines. */
export function eventCategory(e: AuditEvent): string {
  if (e.actorKind === "source") return "Sync or import";
  if (e.action.startsWith("approval.")) return "Approval";
  if (e.action.includes("execution") || e.action.startsWith("run.") || e.action === "schedule.ran") return "Execution";
  if (e.actorKind === "agent") return "Agent action";
  if (e.actorKind === "system") return "System change";
  return "Change by a person";
}

/** Builds a resolver with lookups computed once per state. */
export function objectResolver(q: Q) {
  const T = q.s.config.terminology;
  const issues = new Map<string, DataIssue>(q.issues({ ignoreScope: true }).map((i) => [i.id, i]));
  const hidden = (type: string): ObjectInfo => ({ type, label: "Not available to you", hidden: true });

  return (e: AuditEvent): ObjectInfo => {
    const id = e.objectId;
    switch (e.objectType) {
      case "record": {
        const r = q.record(id);
        return r ? { type: T.record, label: r.ref + " " + r.title, open: { kind: "record", id } } : hidden(T.record);
      }
      case "task": {
        const t = q.task(id);
        return t ? { type: T.task, label: t.title, open: { kind: "task", id } } : hidden(T.task);
      }
      case "request": {
        const r = q.request(id);
        return r ? { type: T.request, label: r.ref + " " + r.title, open: { kind: "request", id } } : hidden(T.request);
      }
      case "approval": {
        const a = q.approval(id);
        const r = a ? q.s.data.requests.find((x) => x.id === a.requestId) : undefined;
        return a ? { type: "Approval", label: r ? r.ref + " " + r.title : "Approval", open: { kind: "approval", id } } : hidden("Approval");
      }
      case "run": {
        const r = q.run(id);
        return r ? { type: "Workflow run", label: r.ref + " " + r.title, open: { kind: "run", id } } : hidden("Workflow run");
      }
      case "schedule": {
        const sc = q.schedules({ ignoreScope: true }).find((x) => x.id === id);
        return sc ? { type: "Schedule", label: sc.label, open: { kind: "schedule", id } } : hidden("Schedule");
      }
      case "issue": {
        const i = issues.get(id);
        return i ? { type: "Data issue", label: i.title, open: { kind: "issue", id } } : hidden("Data issue");
      }
      case "file": {
        const f = q.file(id);
        return f ? { type: "File", label: f.title, open: { kind: "file", id } } : hidden("File");
      }
      case "person":
        return { type: "Person", label: q.name(id) };
      case "view": {
        const v = q.s.data.views.find((x) => x.id === id);
        return { type: id === "export" ? "Export" : "Saved view", label: v ? v.name : id === "export" ? "Data export" : "View" };
      }
      case "config":
        return { type: "Settings", label: "Organisation settings" };
      default:
        return { type: "Object", label: id };
    }
  };
}

export function fmtValue(v: FieldValue | undefined): string {
  if (v === null || v === undefined || v === "") return "Empty";
  return String(v);
}

/** Field label from the record type of the first linked record, else the key. */
export function fieldLabel(q: Q, e: AuditEvent, key: string): string {
  for (const id of e.recordIds) {
    const r = q.record(id);
    const t = r && q.s.config.recordTypes.find((x) => x.id === r.typeId);
    const f = t?.fields.find((x) => x.key === key);
    if (f) return f.label;
  }
  return key;
}
