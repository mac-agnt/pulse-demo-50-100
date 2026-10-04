/* Helpers that turn audit events into readable labels. Activity and Agents both
   use these, so an event reads the same wherever it appears. Every label is
   resolved through the query layer, so objects the viewer cannot see stay hidden. */

import type { Q } from "../../core/query";
import type { ActorKind, AuditEvent, DataIssue, FieldValue, Focus, ModuleId, Tone } from "../../core";

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
  "config.changed": "Settings changed",
  "update.drafted": "Update drafted",
  "update.published": "Update published",
  "update.discarded": "Draft discarded",
  "comment.added": "Comment"
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
  const moduleOn = (m: ModuleId) => !!q.s.config.modules?.[m]?.enabled;
  const resolveTarget = (type: string, oid: string): ObjectInfo => {
    if (type === "record") { const r = q.record(oid); return r ? { type: T.record, label: r.ref + " " + r.title, open: { kind: "record", id: oid } } : hidden(T.record); }
    if (type === "request") { const r = q.request(oid); return r ? { type: T.request, label: r.ref + " " + r.title, open: { kind: "request", id: oid } } : hidden(T.request); }
    if (type === "task") { const t = q.task(oid); return t ? { type: T.task, label: t.title, open: { kind: "task", id: oid } } : hidden(T.task); }
    if (type === "project") {
      const p = q.s.data.projects.find((x) => x.id === oid);
      if (!p) return { type: "Project", label: oid };
      if (!q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) return hidden(q.s.config.projects?.label || "Project");
      return { type: q.s.config.projects?.label || "Project", label: p.title, open: moduleOn("projects") ? { kind: "project", id: oid } : undefined };
    }
    if (type === "invoice") { const i = q.s.data.invoices.find((x) => x.id === oid); return { type: "Invoice", label: i?.ref || oid, open: i && moduleOn("purchasing") ? { kind: "invoice", id: oid } : undefined }; }
    if (type === "agentRun") { const r = q.s.data.agentRuns.find((x) => x.id === oid); return { type: "Agent run", label: r ? r.ref + " " + r.goal : oid, open: r ? { kind: "agentRun", id: oid } : undefined }; }
    return { type: "Object", label: oid };
  };

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
      /* Module objects. A disabled module keeps its history but has no page to open. */
      case "project": case "milestone": case "risk": {
        const P = q.s.config.projects?.label || "Project";
        const pid = e.objectType === "project" ? id
          : e.objectType === "milestone" ? q.s.data.milestones.find((m) => m.id === id)?.projectId
          : q.s.data.risks.find((r) => r.id === id)?.projectId;
        const p = q.s.data.projects.find((x) => x.id === pid);
        const type = e.objectType === "project" ? P : e.objectType === "milestone" ? "Milestone" : "Risk";
        if (!p) return { type, label: id };
        if (!q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) return hidden(type);
        const sub = e.objectType === "milestone" ? q.s.data.milestones.find((m) => m.id === id)?.label
          : e.objectType === "risk" ? q.s.data.risks.find((r) => r.id === id)?.title : "";
        return { type, label: (sub ? sub + ", " : "") + p.title, open: moduleOn("projects") ? { kind: "project", id: p.id } : undefined };
      }
      case "budget": {
        const b = q.s.data.budgets.find((x) => x.id === id);
        return { type: "Budget", label: b?.label || id, open: b && moduleOn("finance") ? { kind: "budget", id } : undefined };
      }
      case "order": {
        const o = q.s.data.orders.find((x) => x.id === id);
        return { type: "Order", label: o?.ref || id, open: o && moduleOn("purchasing") ? { kind: "order", id } : undefined };
      }
      case "invoice": {
        const i = q.s.data.invoices.find((x) => x.id === id);
        return { type: "Invoice", label: i?.ref || id, open: i && moduleOn("purchasing") ? { kind: "invoice", id } : undefined };
      }
      case "supplier":
        return { type: "Supplier", label: q.s.data.suppliers.find((x) => x.id === id)?.name || id };
      case "receivable": case "transaction":
        return { type: e.objectType === "receivable" ? "Receivable" : "Transaction", label: id };
      case "requirement": case "check": {
        const ob = q.s.data.obligations.find((x) => x.id === id);
        const req = q.s.config.standards.requirements.find((r) => r.id === (ob?.requirementId || id));
        return { type: e.objectType === "check" ? "Check" : "Requirement", label: req?.label || id, open: ob && moduleOn("standards") ? { kind: "obligation", id: ob.id } : undefined };
      }
      case "agent": {
        const a = q.s.config.agents.find((x) => x.id === id);
        return { type: "Agent", label: a?.name || id, open: a ? { kind: "agent", id } : undefined };
      }
      case "agentRun": {
        const r = q.s.data.agentRuns.find((x) => x.id === id);
        return { type: "Agent run", label: r ? r.ref + " " + r.goal : id, open: r ? { kind: "agentRun", id } : undefined };
      }
      case "update": {
        const u = q.s.data.companyUpdates.find((x) => x.id === id);
        if (u) return { type: u.state === "published" ? "Company update" : "Drafted update", label: u.title };
        // Project progress updates share the "update" object type.
        const pu = q.s.data.projectUpdates.find((x) => x.id === id);
        const p = pu && q.s.data.projects.find((x) => x.id === pu.projectId);
        if (p) {
          if (!q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) return hidden("Project update");
          return { type: (q.s.config.projects?.label || "Project") + " update", label: p.title, open: moduleOn("projects") ? { kind: "project", id: p.id } : undefined };
        }
        return { type: "Update", label: id };
      }
      case "comment": {
        const c = q.s.data.comments.find((x) => x.id === id);
        if (!c) return { type: "Comment", label: id };
        // A comment reads as the object it is on.
        const target = resolveTarget(c.objectType, c.objectId);
        return { type: "Comment on " + target.type.toLowerCase(), label: target.label, open: target.open, hidden: target.hidden };
      }
      case "appointment": {
        const a = q.s.data.appointments.find((x) => x.id === id);
        return { type: "Appointment", label: a?.title || id };
      }
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
