/* Every change goes through here. Each operation takes the current state, who
   is acting and when, checks permission at execution time, and returns a new
   state plus an audit event. Nothing here talks to an external system: an
   effect that needs a connection fails honestly when there is none. */

import { can, eligibleApprovers, delegatedTo, viewerOf, scopeOptions, scopeKey, type Viewer } from "./access";
import { allIssues, isEmpty } from "./quality";
import { addBusinessHours, localDay, ms, nextOccurrence, addHours } from "./time";
import type {
  Approval, ApprovalStage, AuditEvent, CoreState, Ctx, DataIssue, FieldDef, FieldValue, Id, Priority,
  RecordItem, RequestItem, SavedView, Schedule, Task, TaskStatus, WorkflowRun, OrgConfig, Person, RoleScope
} from "./types";

export type Result = { ok: true; state: CoreState; message: string; id?: Id } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

function begin(s: CoreState) {
  return structuredClone(s);
}

export function nid(s: CoreState, prefix: string) {
  s.seq += 1;
  return prefix + "-" + s.seq;
}

function log(s: CoreState, ctx: Ctx, e: Omit<AuditEvent, "id" | "at" | "actorId" | "actorKind"> & { actorId?: Id; actorKind?: AuditEvent["actorKind"] }) {
  s.data.events.push({ ...e, id: nid(s, "e"), at: ctx.now, actorId: e.actorId || ctx.viewerId, actorKind: e.actorKind || "person" } as AuditEvent);
}

const nameOf = (s: CoreState, id?: Id | null) => s.data.people.find((p) => p.id === id)?.name || s.config.agents.find((a) => a.id === id)?.name
  || s.config.sources.find((x) => x.id === id)?.label || (id === "system" ? "Pulse" : "Unknown");

/* ── Field validation ──────────────────────────────────────────────────── */

export function validateField(def: FieldDef, v: FieldValue): string | null {
  if (isEmpty(v)) return def.required ? def.label + " is required." : null;
  if (def.kind === "number" || def.kind === "money") {
    const n = typeof v === "number" ? v : Number(v);
    if (!isFinite(n)) return def.label + " must be a number.";
    if (def.min !== undefined && n < def.min) return def.label + " must be at least " + def.min + ".";
    if (def.max !== undefined && n > def.max) return def.label + " must be at most " + def.max + ".";
  }
  if (def.kind === "email" || def.pattern) {
    const re = new RegExp(def.pattern || "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    if (!re.test(String(v))) return def.label + " is not in the expected format.";
  }
  if (def.kind === "select" && def.options && def.options.length && !def.options.some((o) => o.value === v)) {
    return def.label + " must be one of the configured options.";
  }
  if (def.kind === "date" && isNaN(Date.parse(String(v)))) return def.label + " must be a date.";
  return null;
}

export function validateFields(defs: FieldDef[], values: Record<string, FieldValue>): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const d of defs) {
    const e = validateField(d, values[d.key] ?? null);
    if (e) errs[d.key] = e;
  }
  return errs;
}

/* ── Records ───────────────────────────────────────────────────────────── */

/** Where a corrected value goes, by the field's authority rule. */
export function authorityOf(s: CoreState, r: RecordItem, field: string) {
  const m = s.config.fieldMappings.find((x) => x.recordTypeId === r.typeId && x.fieldKey === field);
  if (!m || m.authority === "pulse") return { kind: "pulse" as const, label: "Pulse is the source of truth for this field." };
  const src = s.config.sources.find((x) => x.id === m.sourceId);
  if (m.writeBack && src?.connected) return { kind: "writeback" as const, label: "Saved in Pulse and written back to " + src.label + "." };
  return { kind: "pending" as const, label: (src?.label || "The source") + " is authoritative and write-back is off, so this stays a Pulse correction pending source review." };
}

function applyField(s: CoreState, ctx: Ctx, r: RecordItem, field: string, value: FieldValue, reason: string, actor: { id: Id; kind: AuditEvent["actorKind"] }, via?: string) {
  const before = r.fields[field] ?? null;
  const auth = authorityOf(s, r, field);
  r.fields[field] = value;
  r.fieldMeta[field] = { origin: "manual", pendingSourceReview: auth.kind === "pending", sourceId: auth.kind === "pending" ? r.fieldMeta[field]?.sourceId : undefined };
  r.updatedAt = ctx.now;
  log(s, ctx, { actorId: actor.id, actorKind: actor.kind, action: "record.updated", objectType: "record", objectId: r.id, recordIds: [r.id],
    summary: "Changed " + field + " on " + r.ref + (via ? " (" + via + ")" : "") + (reason ? ": " + reason : ""),
    before: { [field]: before }, after: { [field]: value }, teamId: r.teamId, unitId: r.unitId });
  return auth;
}

export function setRecordField(s0: CoreState, ctx: Ctx, recordId: Id, field: string, value: FieldValue, reason: string): Result {
  const v = viewerOf(s0, ctx.viewerId);
  const r0 = s0.data.records.find((x) => x.id === recordId);
  if (!r0) return fail("Record not found.");
  if (!can(v, "records.edit")) return fail("Your role cannot edit records.");
  const type = s0.config.recordTypes.find((t) => t.id === r0.typeId);
  const def = type?.fields.find((f) => f.key === field);
  if (!def) return fail("Unknown field.");
  const err = validateField(def, value);
  if (err) return fail(err);
  const s = begin(s0);
  const r = s.data.records.find((x) => x.id === recordId)!;
  const auth = applyField(s, ctx, r, field, value, reason, { id: ctx.viewerId, kind: "person" });
  return { ok: true, state: s, message: "Saved. " + auth.label };
}

/* ── Requests and approvals ────────────────────────────────────────────── */

function resolveStages(s: CoreState, req: RequestItem, ctx: Ctx): { stages: ApprovalStage[]; exception?: string } {
  const rule = s.config.approvalRules.find((r) => r.id === s.config.requestForms.find((f) => f.id === req.formId)?.approvalRuleId);
  if (!rule) return { stages: [] };
  const notes: string[] = [];
  const stages = rule.stages.map((st, i): ApprovalStage => {
    const applies = !st.when || (typeof req.fields[st.when.field] === "number" && (req.fields[st.when.field] as number) > st.when.over);
    if (!applies) return { stageId: st.id, label: st.label, eligibleRoles: st.eligibleRoles, assigneeId: null, status: "skipped" };
    let pool = eligibleApprovers(s, st.eligibleRoles, st.scope, req.teamId);
    // Prefer the narrowest authority: team, then unit, then organisation.
    const rank = (pid: Id) => {
      const ras = s.data.roleAssignments.filter((ra) => ra.personId === pid && st.eligibleRoles.includes(ra.roleId));
      return Math.min(...ras.map((ra) => ra.scope.kind === "team" ? 0 : ra.scope.kind === "unit" ? 1 : 2));
    };
    pool.sort((a, b) => rank(a) - rank(b));
    if (rule.prohibitSelfApproval && pool.includes(req.requesterId)) {
      pool = pool.filter((p) => p !== req.requesterId);
      notes.push("The requester cannot approve their own request, so " + st.label.toLowerCase() + " routes to the next eligible person.");
    }
    if (!pool.length) {
      pool = eligibleApprovers(s, [rule.escalateToRole], "organisation", req.teamId).filter((p) => p !== req.requesterId);
      notes.push("No eligible " + st.label.toLowerCase() + " in scope, so it routes to the escalation owner.");
    }
    return { stageId: st.id, label: st.label, eligibleRoles: st.eligibleRoles, assigneeId: pool[0] || null, status: "waiting" };
  });
  const first = stages.find((st) => st.status === "waiting");
  if (first) {
    first.status = "pending";
    first.startedAt = ctx.now;
    const sla = s.config.slaPolicies.find((p) => p.id === rule.slaPolicyId);
    if (sla) first.dueAt = addBusinessHours(ctx.now, sla.targetHours, s.config.timezone);
  }
  return { stages, exception: notes.length ? notes.join(" ") : undefined };
}

export interface NewRequest {
  formId: string;
  title: string;
  fields: Record<string, FieldValue>;
  evidenceFileIds: Id[];
  linkedRecordIds: Id[];
  teamId?: Id;
  submit: boolean;
  createdBy?: Id;
}

export function createRequest(s0: CoreState, ctx: Ctx, n: NewRequest): Result {
  const form = s0.config.requestForms.find((f) => f.id === n.formId && f.enabled);
  if (!form) return fail("That request form is not enabled.");
  const v = viewerOf(s0, ctx.viewerId);
  if (v.person.status !== "active") return fail("Your account is not active.");
  if (!n.title.trim()) return fail("Give the request a title.");
  const errs = validateFields(form.fields, n.fields);
  if (n.submit && Object.keys(errs).length) return fail(Object.values(errs)[0]);
  if (n.submit && form.evidenceRequired && !n.evidenceFileIds.length) return fail("This form needs evidence attached before it can be submitted.");
  const teamId = n.teamId || v.memberTeamIds[0];
  const s = begin(s0);
  const id = nid(s, "req");
  const ref = "REQ-" + (200 + s.data.requests.length + 1);
  const req: RequestItem = {
    id, ref, formId: form.id, title: n.title.trim(), requesterId: ctx.viewerId, teamId,
    unitId: s.config.teams.find((t) => t.id === teamId)?.unitId, fields: { ...n.fields }, version: 1,
    versions: [{ n: 1, fields: { ...n.fields }, at: ctx.now, by: ctx.viewerId, note: n.submit ? "Submitted" : "Draft" }],
    status: "draft", evidenceFileIds: [...n.evidenceFileIds], linkedRecordIds: [...n.linkedRecordIds], taskIds: [],
    execution: { status: "not_started", effect: form.effect.label, attempts: 0, appliedKeys: [] },
    createdAt: ctx.now, updatedAt: ctx.now, createdBy: n.createdBy || ctx.viewerId
  };
  if (form.fields.some((f) => f.kind === "record") && typeof n.fields.recordId === "string" && !req.linkedRecordIds.includes(n.fields.recordId)) {
    req.linkedRecordIds.push(n.fields.recordId);
  }
  s.data.requests.push(req);
  for (const t of form.tasks) {
    const tid = nid(s, "t");
    s.data.tasks.push({ id: tid, title: t.title, teamId, unitId: req.unitId, assigneeId: null, requestId: id, linkedRecordIds: [...req.linkedRecordIds],
      priority: "normal", status: "open", dependsOn: [], checklist: (t.checklist || []).map((label, i) => ({ id: "c" + i, label, done: false })),
      notes: [], evidenceFileIds: [], createdAt: ctx.now, createdBy: ctx.viewerId, slaPolicyId: "sla-task",
      dueAt: addBusinessHours(ctx.now, 16, s.config.timezone) });
    req.taskIds.push(tid);
  }
  log(s, ctx, { action: "request.created", objectType: "request", objectId: id, recordIds: req.linkedRecordIds, summary: "Created " + ref + ": " + req.title, teamId, unitId: req.unitId,
    actorId: n.createdBy, actorKind: n.createdBy && n.createdBy.startsWith("ag-") ? "agent" : "person" });
  if (!n.submit) return { ok: true, state: s, message: "Saved as a draft.", id };
  const sub = submitRequest(s, ctx, id);
  if (!sub.ok) return sub;
  return { ok: true, state: sub.state, message: sub.message, id };
}

export function submitRequest(s0: CoreState, ctx: Ctx, requestId: Id): Result {
  const r0 = s0.data.requests.find((x) => x.id === requestId);
  if (!r0) return fail("Request not found.");
  if (r0.requesterId !== ctx.viewerId) return fail("Only the requester can submit this request.");
  if (!(r0.status === "draft" || r0.status === "changes_requested")) return fail("This request is already " + r0.status.replace("_", " ") + ".");
  const form = s0.config.requestForms.find((f) => f.id === r0.formId)!;
  const errs = validateFields(form.fields, r0.fields);
  if (Object.keys(errs).length) return fail(Object.values(errs)[0]);
  if (form.evidenceRequired && !r0.evidenceFileIds.length) return fail("Attach evidence before submitting.");
  const s = begin(s0);
  const r = s.data.requests.find((x) => x.id === requestId)!;
  const { stages, exception } = resolveStages(s, r, ctx);
  let ap = s.data.approvals.find((a) => a.id === r.approvalId);
  if (ap) {
    ap.cycle += 1;
    ap.reviewingVersion = r.version;
    ap.stages = stages;
    ap.status = "pending";
    ap.submittedAt = ctx.now;
    ap.decidedAt = undefined;
    ap.policyException = exception;
  } else {
    ap = { id: nid(s, "ap"), requestId: r.id, ruleId: form.approvalRuleId, cycle: 1, reviewingVersion: r.version, stages, decisions: [],
      status: "pending", submittedAt: ctx.now, policyException: exception };
    s.data.approvals.push(ap);
    r.approvalId = ap.id;
  }
  r.status = "submitted";
  r.updatedAt = ctx.now;
  if (r.versions[r.versions.length - 1].note === "Draft") r.versions[r.versions.length - 1].note = "Submitted";
  const first = ap.stages.find((st) => st.status === "pending");
  log(s, ctx, { action: "request.submitted", objectType: "request", objectId: r.id, recordIds: r.linkedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: "Submitted " + r.ref + " (version " + r.version + ")" + (first ? "; waiting on " + nameOf(s, first.assigneeId) : "") });
  return { ok: true, state: s, message: first ? "Submitted. " + nameOf(s, first.assigneeId) + " decides next." : "Submitted." };
}

/** Can this person decide the current stage, and on whose behalf? Checked at decision time. */
export function decisionAuthority(s: CoreState, ctx: Ctx, a: Approval): { ok: true; onBehalfOf?: Id } | { ok: false; reason: string } {
  const v = viewerOf(s, ctx.viewerId);
  const req = s.data.requests.find((r) => r.id === a.requestId)!;
  const rule = s.config.approvalRules.find((r) => r.id === a.ruleId);
  const stage = a.stages.find((st) => st.status === "pending");
  if (a.status !== "pending" || !stage) return { ok: false, reason: "Nothing is waiting for a decision." };
  if (v.person.status !== "active") return { ok: false, reason: "Your account is not active." };
  if (rule?.prohibitSelfApproval && req.requesterId === v.person.id) return { ok: false, reason: "You raised this request, so you cannot approve it." };
  if (stage.assigneeId === v.person.id) {
    if (!can(v, "approvals.decide")) return { ok: false, reason: "Your role no longer allows approval decisions." };
    const still = eligibleApprovers(s, stage.eligibleRoles, rule?.stages.find((x) => x.id === stage.stageId)?.scope || "organisation", req.teamId);
    if (!still.includes(v.person.id) && !v.isOrgWide) return { ok: false, reason: "Your authority for this team changed, so this decision is no longer yours." };
    return { ok: true };
  }
  const dg = delegatedTo(s, v.person.id, a, ctx.now);
  if (dg.length) return { ok: true, onBehalfOf: dg[0].fromId };
  return { ok: false, reason: "This decision is with " + nameOf(s, stage.assigneeId) + "." };
}

export function decide(s0: CoreState, ctx: Ctx, approvalId: Id, kind: "approve" | "decline" | "return", comment: string): Result {
  const a0 = s0.data.approvals.find((a) => a.id === approvalId);
  if (!a0) return fail("Approval not found.");
  const auth = decisionAuthority(s0, ctx, a0);
  if (!auth.ok) return fail(auth.reason);
  const req0 = s0.data.requests.find((r) => r.id === a0.requestId)!;
  if (req0.version !== a0.reviewingVersion) return fail("The request changed since this review started. Reopen it to see the current version.");
  if ((kind === "decline" || kind === "return") && !comment.trim()) return fail("Add a reason so the requester knows what to do.");
  const s = begin(s0);
  const a = s.data.approvals.find((x) => x.id === approvalId)!;
  const r = s.data.requests.find((x) => x.id === a.requestId)!;
  const stage = a.stages.find((st) => st.status === "pending")!;
  a.decisions.push({ id: nid(s, "d"), stageId: stage.stageId, actorId: ctx.viewerId, onBehalfOfId: auth.onBehalfOf, kind, comment: comment.trim(),
    at: ctx.now, requestVersion: r.version, cycle: a.cycle });
  let message = "";
  if (kind === "approve") {
    stage.status = "approved";
    const next = a.stages.find((st) => st.status === "waiting");
    if (next) {
      next.status = "pending";
      next.startedAt = ctx.now;
      const rule = s.config.approvalRules.find((x) => x.id === a.ruleId);
      const sla = s.config.slaPolicies.find((p) => p.id === rule?.slaPolicyId);
      if (sla) next.dueAt = addBusinessHours(ctx.now, sla.targetHours, s.config.timezone);
      message = "Approved this stage. " + nameOf(s, next.assigneeId) + " decides next.";
    } else {
      a.status = "approved";
      a.decidedAt = ctx.now;
      r.status = "approved";
      r.execution.status = "not_started";
      message = "Approved. The approved action has not run yet; run it from the request when ready.";
    }
  } else if (kind === "decline") {
    stage.status = "declined";
    a.status = "declined";
    a.decidedAt = ctx.now;
    r.status = "declined";
    r.execution.status = "not_applicable";
    message = "Declined. The requester has been told why.";
  } else {
    stage.status = "returned";
    a.status = "returned";
    r.status = "changes_requested";
    message = "Returned for changes. It comes back to you when resubmitted.";
  }
  r.updatedAt = ctx.now;
  syncRun(s, ctx, r);
  log(s, ctx, { action: "approval." + kind, objectType: "approval", objectId: a.id, recordIds: r.linkedRecordIds, teamId: r.teamId, unitId: r.unitId,
    onBehalfOfId: auth.onBehalfOf,
    summary: ({ approve: "Approved", decline: "Declined", return: "Returned for changes" })[kind] + " " + r.ref + " (version " + r.version + ", " + stage.label.toLowerCase() + ")"
      + (auth.onBehalfOf ? " on behalf of " + nameOf(s, auth.onBehalfOf) : "") });
  return { ok: true, state: s, message };
}

/** Hand the current stage to another eligible person. */
export function reassignStage(s0: CoreState, ctx: Ctx, approvalId: Id, toId: Id, reason: string): Result {
  const a0 = s0.data.approvals.find((a) => a.id === approvalId);
  if (!a0) return fail("Approval not found.");
  const v = viewerOf(s0, ctx.viewerId);
  const stage0 = a0.stages.find((st) => st.status === "pending");
  if (!stage0) return fail("Nothing is waiting for a decision.");
  if (!can(v, "approvals.delegate") || (stage0.assigneeId !== v.person.id && !v.isOrgWide)) return fail("Only the current decision owner or an administrator can hand this on.");
  const req = s0.data.requests.find((r) => r.id === a0.requestId)!;
  const rule = s0.config.approvalRules.find((r) => r.id === a0.ruleId);
  const scope = rule?.stages.find((x) => x.id === stage0.stageId)?.scope || "organisation";
  const pool = eligibleApprovers(s0, stage0.eligibleRoles, scope, req.teamId);
  if (!pool.includes(toId)) return fail(nameOf(s0, toId) + " does not hold an eligible role for this stage, so cannot decide it.");
  if (toId === req.requesterId && rule?.prohibitSelfApproval) return fail("The requester cannot decide their own request.");
  if (!reason.trim()) return fail("Say why you are handing it on.");
  const s = begin(s0);
  const a = s.data.approvals.find((x) => x.id === approvalId)!;
  const st = a.stages.find((x) => x.status === "pending")!;
  const from = st.assigneeId;
  st.assigneeId = toId;
  a.decisions.push({ id: nid(s, "d"), stageId: st.stageId, actorId: ctx.viewerId, kind: "delegate", comment: reason.trim() + " (to " + nameOf(s, toId) + ")", at: ctx.now,
    requestVersion: a.reviewingVersion, cycle: a.cycle });
  log(s, ctx, { action: "approval.delegate", objectType: "approval", objectId: a.id, recordIds: req.linkedRecordIds, teamId: req.teamId, unitId: req.unitId,
    summary: "Handed " + req.ref + " from " + nameOf(s, from) + " to " + nameOf(s, toId) });
  return { ok: true, state: s, message: "Handed to " + nameOf(s, toId) + "." };
}

export function isStageOverdue(a: Approval, now: string) {
  const st = a.stages.find((x) => x.status === "pending");
  return !!st && !!st.dueAt && ms(st.dueAt) < ms(now);
}

export function escalate(s0: CoreState, ctx: Ctx, approvalId: Id): Result {
  const a0 = s0.data.approvals.find((a) => a.id === approvalId);
  if (!a0) return fail("Approval not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "tasks.manage")) return fail("Escalation needs a manager or administrator.");
  if (!isStageOverdue(a0, ctx.now)) return fail("This decision is not past its deadline yet.");
  const rule = s0.config.approvalRules.find((r) => r.id === a0.ruleId)!;
  const req = s0.data.requests.find((r) => r.id === a0.requestId)!;
  const pool = eligibleApprovers(s0, [rule.escalateToRole], "organisation", req.teamId).filter((p) => p !== req.requesterId);
  const st0 = a0.stages.find((x) => x.status === "pending")!;
  const target = pool.find((p) => p !== st0.assigneeId);
  if (!target) return fail("No escalation owner is configured who is different from the current owner.");
  const s = begin(s0);
  const a = s.data.approvals.find((x) => x.id === approvalId)!;
  const st = a.stages.find((x) => x.status === "pending")!;
  st.escalatedFromId = st.assigneeId || undefined;
  st.assigneeId = target;
  const sla = s.config.slaPolicies.find((p) => p.id === rule.slaPolicyId);
  st.dueAt = addBusinessHours(ctx.now, Math.max(4, Math.round((sla?.targetHours || 16) / 2)), s.config.timezone);
  a.decisions.push({ id: nid(s, "d"), stageId: st.stageId, actorId: ctx.viewerId, kind: "escalate", comment: "Past its deadline; escalated to " + nameOf(s, target),
    at: ctx.now, requestVersion: a.reviewingVersion, cycle: a.cycle });
  log(s, ctx, { action: "approval.escalate", objectType: "approval", objectId: a.id, recordIds: req.linkedRecordIds, teamId: req.teamId, unitId: req.unitId,
    summary: "Escalated " + req.ref + " from " + nameOf(s, st.escalatedFromId) + " to " + nameOf(s, target) });
  return { ok: true, state: s, message: "Escalated to " + nameOf(s, target) + "." };
}

/** Edit a request. A material change after review forces a renewed review. */
export function editRequest(s0: CoreState, ctx: Ctx, requestId: Id, fields: Record<string, FieldValue>, note: string): Result {
  const r0 = s0.data.requests.find((x) => x.id === requestId);
  if (!r0) return fail("Request not found.");
  if (r0.requesterId !== ctx.viewerId) return fail("Only the requester can edit this request.");
  if (r0.execution.status === "succeeded") return fail("The approved action already ran. Raise a new request instead.");
  if (r0.status === "declined" || r0.status === "withdrawn") return fail("This request is closed.");
  const form = s0.config.requestForms.find((f) => f.id === r0.formId)!;
  const merged = { ...r0.fields, ...fields };
  const errs = validateFields(form.fields, merged);
  if (Object.keys(errs).length) return fail(Object.values(errs)[0]);
  const changed = form.fields.filter((f) => (r0.fields[f.key] ?? null) !== (merged[f.key] ?? null));
  if (!changed.length) return fail("Nothing changed.");
  const material = changed.some((f) => f.material);
  const s = begin(s0);
  const r = s.data.requests.find((x) => x.id === requestId)!;
  r.fields = merged;
  r.version += 1;
  r.versions.push({ n: r.version, fields: { ...merged }, at: ctx.now, by: ctx.viewerId, note: note.trim() || "Edited " + changed.map((f) => f.label.toLowerCase()).join(", ") });
  r.updatedAt = ctx.now;
  let message = "Saved as version " + r.version + ".";
  const a = s.data.approvals.find((x) => x.id === r.approvalId);
  if (a && (r.status === "submitted" || r.status === "approved")) {
    const reviewed = a.decisions.some((d) => d.cycle === a.cycle && d.kind === "approve");
    if (material || !reviewed) {
      const { stages, exception } = resolveStages(s, r, ctx);
      a.cycle += 1;
      a.stages = stages;
      a.status = "pending";
      a.reviewingVersion = r.version;
      a.decidedAt = undefined;
      a.submittedAt = ctx.now;
      a.policyException = (material && reviewed ? "A material field changed after review, so the earlier approval no longer applies. " : "") + (exception || "");
      r.status = "submitted";
      if (r.execution.status !== "succeeded") r.execution.status = "not_started";
      message += material && reviewed ? " A material field changed, so the review starts again." : " Review continues on the new version.";
    } else {
      a.reviewingVersion = r.version;
      message += " The change is not material, so the review carries on.";
    }
    syncRun(s, ctx, r);
  }
  log(s, ctx, { action: "request.edited", objectType: "request", objectId: r.id, recordIds: r.linkedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: "Edited " + r.ref + " to version " + r.version + (material ? " (material change)" : ""),
    before: Object.fromEntries(changed.map((f) => [f.key, r0.fields[f.key] ?? null])), after: Object.fromEntries(changed.map((f) => [f.key, merged[f.key] ?? null])) });
  return { ok: true, state: s, message };
}

export function withdrawRequest(s0: CoreState, ctx: Ctx, requestId: Id): Result {
  const r0 = s0.data.requests.find((x) => x.id === requestId);
  if (!r0) return fail("Request not found.");
  if (r0.requesterId !== ctx.viewerId) return fail("Only the requester can withdraw it.");
  if (r0.execution.status === "succeeded" || r0.status === "declined" || r0.status === "withdrawn") return fail("This request can no longer be withdrawn.");
  const s = begin(s0);
  const r = s.data.requests.find((x) => x.id === requestId)!;
  r.status = "withdrawn";
  r.execution.status = "not_applicable";
  const a = s.data.approvals.find((x) => x.id === r.approvalId);
  if (a && a.status === "pending") { a.status = "declined"; a.stages.forEach((st) => { if (st.status === "pending" || st.status === "waiting") st.status = "skipped"; }); }
  log(s, ctx, { action: "request.withdrawn", objectType: "request", objectId: r.id, recordIds: r.linkedRecordIds, teamId: r.teamId, unitId: r.unitId, summary: "Withdrew " + r.ref });
  return { ok: true, state: s, message: "Withdrawn." };
}

/** Run the approved action. Keyed by request version and effect, so it applies at most once. */
export function executeRequest(s0: CoreState, ctx: Ctx, requestId: Id): Result {
  const r0 = s0.data.requests.find((x) => x.id === requestId);
  if (!r0) return fail("Request not found.");
  const a0 = s0.data.approvals.find((x) => x.id === r0.approvalId);
  if (r0.status !== "approved" || a0?.status !== "approved") return fail("Only an approved request can run its action.");
  if (a0.reviewingVersion !== r0.version) return fail("The approval covers a different version. A renewed review is needed.");
  const v = viewerOf(s0, ctx.viewerId);
  const approvers = a0.decisions.filter((d) => d.cycle === a0.cycle && d.kind === "approve").map((d) => d.actorId);
  if (r0.requesterId !== v.person.id && !approvers.includes(v.person.id) && !can(v, "workflows.operate")) return fail("Only the requester, an approver or a workflow operator can run this.");
  const form = s0.config.requestForms.find((f) => f.id === r0.formId)!;
  const key = r0.id + ":v" + r0.version + ":" + form.effect.kind;
  if (r0.execution.appliedKeys.includes(key)) return { ok: true, state: s0, message: "Already applied for version " + r0.version + ". Nothing was repeated." };
  const s = begin(s0);
  const r = s.data.requests.find((x) => x.id === requestId)!;
  r.execution.attempts += 1;
  r.execution.executedAt = ctx.now;
  let message = "";
  const ok = (effect: string) => {
    r.execution.status = "succeeded";
    r.execution.effect = effect;
    r.execution.lastError = undefined;
    r.execution.appliedKeys.push(key);
    message = "Done: " + effect + ".";
  };
  switch (form.effect.kind) {
    case "apply-correction": {
      const rec = s.data.records.find((x) => x.id === r.fields.recordId);
      const field = String(r.fields.field || "");
      const type = rec && s.config.recordTypes.find((t) => t.id === rec.typeId);
      const def = type?.fields.find((f) => f.key === field);
      if (!rec || !def) { r.execution.status = "failed"; r.execution.lastError = "The record or field no longer exists."; message = r.execution.lastError; break; }
      const err = validateField(def, r.fields.newValue);
      if (err) { r.execution.status = "failed"; r.execution.lastError = err; message = err; break; }
      const auth = applyField(s, ctx, rec, field, r.fields.newValue, "approved correction " + r.ref, { id: "system", kind: "system" }, r.ref);
      // A correction that settles an open conflict on the same field resolves it.
      for (const iss of s.data.issues) {
        if (iss.recordIds.includes(rec.id) && iss.field === field && (iss.state === "open" || iss.state === "in_progress")) {
          iss.state = "resolved";
          iss.resolution = { by: ctx.viewerId, at: ctx.now, action: "Corrected through " + r.ref, reason: String(r.fields.reason || "") };
        }
      }
      ok(def.label + " set on " + rec.ref + ". " + auth.label);
      break;
    }
    case "approve-file-version": {
      const f = s.data.files.find((x) => x.id === r.fields.fileId);
      if (!f) { r.execution.status = "failed"; r.execution.lastError = "The document no longer exists."; message = r.execution.lastError; break; }
      const ver = f.versions[f.versions.length - 1];
      ver.approved = true;
      log(s, ctx, { actorId: "system", actorKind: "system", action: "file.version.approved", objectType: "file", objectId: f.id, recordIds: f.linkedRecordIds,
        summary: "Version " + ver.n + " of " + f.title + " approved through " + r.ref, teamId: f.teamId, unitId: f.unitId });
      ok("Version " + ver.n + " of " + f.title + " marked approved");
      break;
    }
    case "create-fulfilment-task": {
      const tid = nid(s, "t");
      s.data.tasks.push({ id: tid, title: "Fulfil " + r.ref + ": " + r.title, teamId: r.teamId, unitId: r.unitId, assigneeId: null, requestId: r.id,
        linkedRecordIds: [...r.linkedRecordIds], priority: "normal", status: "open", dependsOn: [], checklist: [], notes: [], evidenceFileIds: [],
        createdAt: ctx.now, createdBy: "system", slaPolicyId: "sla-task", dueAt: typeof r.fields.neededBy === "string" ? new Date(r.fields.neededBy + "T17:00:00Z").toISOString() : undefined });
      r.taskIds.push(tid);
      ok("Fulfilment task created in the " + nameTeam(s, r.teamId) + " queue");
      break;
    }
    case "record-leave": {
      const id = nid(s, "lv");
      s.data.leave.push({ id, personId: r.requesterId, kind: (String(r.fields.kind || "other") as "annual"), from: new Date(String(r.fields.from) + "T09:00:00Z").toISOString(),
        to: new Date(String(r.fields.to) + "T17:00:00Z").toISOString(), status: "approved", requestId: r.id });
      ok("Leave added for " + nameOf(s, r.requesterId) + " from " + r.fields.from + " to " + r.fields.to);
      break;
    }
    case "notify-external": {
      const email = s.config.sources.find((x) => x.id === "s-email" || x.kind === "external");
      if (!email || !email.connected) {
        r.execution.status = "failed";
        r.execution.lastError = "Email delivery is not connected. Nothing was sent.";
        message = r.execution.lastError + " Connect a provider in Settings > Systems, then run it again.";
      }
      break;
    }
  }
  syncRun(s, ctx, r);
  log(s, ctx, { action: "request.execution." + r.execution.status, objectType: "request", objectId: r.id, recordIds: r.linkedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: (r.execution.status === "succeeded" ? "Executed " + r.ref + ": " + r.execution.effect : "Execution failed for " + r.ref + ": " + r.execution.lastError) });
  return { ok: true, state: s, message };
}

const nameTeam = (s: CoreState, id?: Id) => s.config.teams.find((t) => t.id === id)?.label || "team";

/* Keep a request's workflow run in step with its approval and execution. */
function syncRun(s: CoreState, ctx: Ctx, r: RequestItem) {
  const run = s.data.runs.find((x) => x.requestId === r.id);
  if (!run || run.status === "paused") return;
  const a = s.data.approvals.find((x) => x.id === r.approvalId);
  const stepOf = (id: string) => run.steps.find((st) => st.stepId === id);
  const ap = stepOf("s-approval");
  if (ap && a) {
    if (a.status === "pending") { ap.status = "current"; run.status = "awaiting_approval"; }
    if (a.status === "returned") { ap.status = "waiting"; ap.note = "Returned for changes"; run.status = "awaiting_input"; }
    if (a.status === "declined") { ap.status = "failed"; ap.note = "Declined"; run.status = "completed"; run.steps.forEach((st) => { if (st.status === "pending") st.status = "skipped"; }); }
    if (a.status === "approved") { ap.status = "done"; ap.at = a.decidedAt; run.status = "running"; }
  }
  const apply = stepOf("s-apply");
  if (apply && r.execution.status === "succeeded" && apply.status !== "done") {
    apply.status = "done"; apply.at = ctx.now;
    const key = r.execution.appliedKeys[r.execution.appliedKeys.length - 1];
    if (key && !run.appliedEffects.some((e) => e.key === key)) run.appliedEffects.push({ key, description: r.execution.effect, at: ctx.now });
    const wb = stepOf("s-writeback");
    if (wb) { wb.status = "skipped"; wb.note = "Write-back is off for this field; correction held in Pulse pending source review."; }
    const nt = stepOf("s-notify");
    if (nt) { nt.status = "done"; nt.at = ctx.now; }
    run.status = "completed";
  }
  if (apply && r.execution.status === "failed") { apply.status = "failed"; apply.note = r.execution.lastError; run.status = "failed"; }
  run.updatedAt = ctx.now;
}

/* ── Tasks ─────────────────────────────────────────────────────────────── */

export interface NewTask { title: string; teamId?: Id; assigneeId?: Id | null; dueAt?: string; priority?: Priority; linkedRecordIds?: Id[]; checklist?: string[]; completionCriteria?: string; createdBy?: Id }

export function createTask(s0: CoreState, ctx: Ctx, n: NewTask): Result {
  if (!n.title.trim()) return fail("Give the task a title.");
  const v = viewerOf(s0, ctx.viewerId);
  const teamId = n.teamId || v.memberTeamIds[0];
  if (n.assigneeId && n.assigneeId !== ctx.viewerId && !can(v, "tasks.manage")) return fail("Only a manager can assign work to someone else.");
  if (n.assigneeId && teamId && !s0.data.memberships.some((m) => m.personId === n.assigneeId && m.teamId === teamId)) return fail(nameOf(s0, n.assigneeId) + " is not in that team.");
  const s = begin(s0);
  const id = nid(s, "t");
  const actor = n.createdBy || ctx.viewerId;
  s.data.tasks.push({ id, title: n.title.trim(), teamId, unitId: s.config.teams.find((t) => t.id === teamId)?.unitId, assigneeId: n.assigneeId ?? null,
    claimedAt: n.assigneeId ? ctx.now : undefined, linkedRecordIds: n.linkedRecordIds || [], priority: n.priority || "normal", status: "open",
    dueAt: n.dueAt, dependsOn: [], checklist: (n.checklist || []).map((label, i) => ({ id: "c" + i, label, done: false })),
    completionCriteria: n.completionCriteria, notes: [], evidenceFileIds: [], createdAt: ctx.now, createdBy: actor, slaPolicyId: "sla-task" });
  log(s, ctx, { actorId: actor, actorKind: actor.startsWith("ag-") ? "agent" : "person", action: "task.created", objectType: "task", objectId: id,
    recordIds: n.linkedRecordIds || [], teamId, summary: "Created task: " + n.title.trim() });
  return { ok: true, state: s, message: "Task created.", id };
}

export function claimTask(s0: CoreState, ctx: Ctx, taskId: Id): Result {
  const t0 = s0.data.tasks.find((t) => t.id === taskId);
  if (!t0) return fail("Task not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (t0.assigneeId === ctx.viewerId) return fail("You already have this task.");
  if (t0.assigneeId) return fail("Already claimed by " + nameOf(s0, t0.assigneeId) + ". Ask a manager to reassign it.");
  if (t0.teamId && !v.memberTeamIds.includes(t0.teamId) && !v.overseenTeamIds.includes(t0.teamId) && !v.isOrgWide) return fail("This queue belongs to a team you are not in.");
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId)!;
  t.assigneeId = ctx.viewerId;
  t.claimedAt = ctx.now;
  log(s, ctx, { action: "task.claimed", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, unitId: t.unitId, summary: "Claimed: " + t.title });
  return { ok: true, state: s, message: "Claimed. It is yours now." };
}

export function assignTask(s0: CoreState, ctx: Ctx, taskId: Id, personId: Id | null): Result {
  const t0 = s0.data.tasks.find((t) => t.id === taskId);
  if (!t0) return fail("Task not found.");
  const v = viewerOf(s0, ctx.viewerId);
  const oversees = v.isOrgWide || (!!t0.teamId && v.overseenTeamIds.includes(t0.teamId));
  if (!can(v, "tasks.manage") || !oversees) return fail("Only a manager of this team can assign its work.");
  if (personId && t0.teamId && !s0.data.memberships.some((m) => m.personId === personId && m.teamId === t0.teamId)) return fail(nameOf(s0, personId) + " is not in " + nameTeam(s0, t0.teamId) + ".");
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId)!;
  const before = t.assigneeId;
  t.assigneeId = personId;
  t.claimedAt = personId ? ctx.now : undefined;
  log(s, ctx, { action: "task.assigned", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, unitId: t.unitId,
    summary: personId ? "Assigned " + t.title + " to " + nameOf(s, personId) : "Returned " + t.title + " to the team queue", before: { assignee: before }, after: { assignee: personId } });
  return { ok: true, state: s, message: personId ? "Assigned to " + nameOf(s, personId) + "." : "Back in the team queue." };
}

export function setTaskStatus(s0: CoreState, ctx: Ctx, taskId: Id, status: TaskStatus): Result {
  const t0 = s0.data.tasks.find((t) => t.id === taskId);
  if (!t0) return fail("Task not found.");
  const v = viewerOf(s0, ctx.viewerId);
  const mine = t0.assigneeId === ctx.viewerId;
  const manages = can(v, "tasks.manage") && (v.isOrgWide || (!!t0.teamId && v.overseenTeamIds.includes(t0.teamId)));
  if (!mine && !manages) return fail(t0.assigneeId ? "This task is assigned to " + nameOf(s0, t0.assigneeId) + "." : "Claim the task first.");
  if (status === "done") {
    const open = t0.dependsOn.map((id) => s0.data.tasks.find((x) => x.id === id)).filter((x) => x && x.status !== "done" && x.status !== "cancelled") as Task[];
    if (open.length) return fail("Blocked by " + open.map((x) => "“" + x.title + "”").join(", ") + ". Finish that first.");
    const left = t0.checklist.filter((c) => !c.done);
    if (left.length) return fail(left.length + " checklist item" + (left.length === 1 ? " is" : "s are") + " still open.");
  }
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId)!;
  const before = t.status;
  t.status = status;
  t.completedAt = status === "done" ? ctx.now : undefined;
  t.waitingSince = status === "waiting" ? ctx.now : undefined;
  log(s, ctx, { action: status === "done" ? "task.completed" : "task.status", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, unitId: t.unitId,
    summary: (status === "done" ? "Completed: " : "Set " + status.replace("_", " ") + ": ") + t.title, before: { status: before }, after: { status } });
  return { ok: true, state: s, message: status === "done" ? "Done." : "Updated." };
}

export function toggleChecklist(s0: CoreState, ctx: Ctx, taskId: Id, itemId: Id): Result {
  const t0 = s0.data.tasks.find((t) => t.id === taskId);
  if (!t0) return fail("Task not found.");
  if (t0.assigneeId !== ctx.viewerId && !viewerOf(s0, ctx.viewerId).isOrgWide) return fail("Only the assignee can tick this off.");
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId)!;
  const c = t.checklist.find((x) => x.id === itemId);
  if (!c) return fail("Item not found.");
  c.done = !c.done;
  return { ok: true, state: s, message: "" };
}

export function addTaskNote(s0: CoreState, ctx: Ctx, taskId: Id, text: string): Result {
  if (!text.trim()) return fail("Write something first.");
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId);
  if (!t) return fail("Task not found.");
  t.notes.push({ id: nid(s, "n"), by: ctx.viewerId, at: ctx.now, text: text.trim() });
  log(s, ctx, { action: "task.note", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, unitId: t.unitId, summary: "Added a note to " + t.title });
  return { ok: true, state: s, message: "Note added." };
}

/** Would `taskId` depending on `onId` create a loop? */
export function wouldCycle(tasks: Task[], taskId: Id, onId: Id): boolean {
  if (taskId === onId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<Id>();
  const stack = [onId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    byId.get(cur)?.dependsOn.forEach((d) => stack.push(d));
  }
  return false;
}

export function addDependency(s0: CoreState, ctx: Ctx, taskId: Id, onId: Id): Result {
  const t0 = s0.data.tasks.find((t) => t.id === taskId);
  const on = s0.data.tasks.find((t) => t.id === onId);
  if (!t0 || !on) return fail("Task not found.");
  if (t0.dependsOn.includes(onId)) return fail("Already linked.");
  if (wouldCycle(s0.data.tasks, taskId, onId)) return fail("That would make a loop: “" + on.title + "” already waits on this task.");
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId)!;
  t.dependsOn.push(onId);
  log(s, ctx, { action: "task.dependency", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, summary: "“" + t.title + "” now waits on “" + on.title + "”" });
  return { ok: true, state: s, message: "Linked." };
}

export function removeDependency(s0: CoreState, ctx: Ctx, taskId: Id, onId: Id): Result {
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId);
  if (!t) return fail("Task not found.");
  t.dependsOn = t.dependsOn.filter((d) => d !== onId);
  log(s, ctx, { action: "task.dependency.removed", objectType: "task", objectId: t.id, recordIds: t.linkedRecordIds, teamId: t.teamId, summary: "Removed a dependency from " + t.title });
  return { ok: true, state: s, message: "Removed." };
}

export function linkTaskRecord(s0: CoreState, ctx: Ctx, taskId: Id, recordId: Id): Result {
  const s = begin(s0);
  const t = s.data.tasks.find((x) => x.id === taskId);
  if (!t) return fail("Task not found.");
  if (t.linkedRecordIds.includes(recordId)) return fail("Already linked.");
  t.linkedRecordIds.push(recordId);
  log(s, ctx, { action: "task.linked", objectType: "task", objectId: t.id, recordIds: [recordId], teamId: t.teamId, summary: "Linked " + t.title + " to a record" });
  return { ok: true, state: s, message: "Linked." };
}

export function attachEvidence(s0: CoreState, ctx: Ctx, target: { taskId?: Id; requestId?: Id }, title: string, note: string): Result {
  if (!title.trim()) return fail("Name the evidence.");
  const s = begin(s0);
  const task = target.taskId ? s.data.tasks.find((t) => t.id === target.taskId) : undefined;
  const req = target.requestId ? s.data.requests.find((r) => r.id === target.requestId) : undefined;
  if (!task && !req) return fail("Nothing to attach to.");
  const teamId = task?.teamId || req?.teamId;
  const fid = nid(s, "f");
  s.data.files.push({ id: fid, title: title.trim(), kind: "Evidence", ownerId: ctx.viewerId, teamId, unitId: s.config.teams.find((t) => t.id === teamId)?.unitId,
    visibility: "team", linkedRecordIds: [...(task?.linkedRecordIds || req?.linkedRecordIds || [])],
    versions: [{ id: nid(s, "fv"), n: 1, addedAt: ctx.now, addedBy: ctx.viewerId, note: note.trim() || "Attached as evidence", sizeKb: 0 }],
    summary: note.trim() || "Evidence note (no file uploaded in the demo).", sourceId: "pulse" });
  task?.evidenceFileIds.push(fid);
  req?.evidenceFileIds.push(fid);
  log(s, ctx, { action: "file.attached", objectType: "file", objectId: fid, recordIds: task?.linkedRecordIds || req?.linkedRecordIds || [], teamId, summary: "Attached evidence: " + title.trim() });
  return { ok: true, state: s, message: "Evidence attached.", id: fid };
}

/* ── Schedules and recurring work ──────────────────────────────────────── */

/** Occurrence key for the most recent due slot at or before now. */
export function dueKey(sc: Schedule, now: string): { key: string; at: string } | null {
  const back = sc.cadence.every === "month" ? 32 : sc.cadence.every === "week" ? 8 : 2;
  const from = addHours(now, -24 * back);
  let at = nextOccurrence(sc.cadence, from, sc.timezone);
  let last: string | null = null;
  for (let i = 0; i < 40 && ms(at) <= ms(now); i++) { last = at; at = nextOccurrence(sc.cadence, at, sc.timezone); }
  return last ? { key: sc.id + ":" + localDay(last, sc.timezone), at: last } : null;
}

/** One scheduler tick for a schedule. Safe to repeat: a key is produced once. */
export function runSchedule(s0: CoreState, ctx: Ctx, scheduleId: Id): Result {
  const sc0 = s0.data.schedules.find((x) => x.id === scheduleId);
  if (!sc0) return fail("Schedule not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "workflows.operate") && sc0.ownerId !== ctx.viewerId) return fail("Only the owner or a workflow operator can run this.");
  if (!sc0.active) return fail("This schedule is paused. Resume it to produce new instances.");
  const due = dueKey(sc0, ctx.now);
  if (!due) return fail("Nothing is due yet. Next run: " + nextOccurrence(sc0.cadence, ctx.now, sc0.timezone));
  if (sc0.producedKeys.includes(due.key)) return { ok: true, state: s0, message: "Already produced for " + due.key.split(":")[1] + ". No duplicate was created." };
  const s = begin(s0);
  const sc = s.data.schedules.find((x) => x.id === scheduleId)!;
  sc.producedKeys.push(due.key);
  sc.lastRunAt = ctx.now;
  let message = "";
  if (sc.kind === "recurring-task" && sc.task) {
    const tid = nid(s, "t");
    s.data.tasks.push({ id: tid, title: sc.task.title, teamId: sc.teamId, unitId: s.config.teams.find((t) => t.id === sc.teamId)?.unitId, assigneeId: null,
      linkedRecordIds: [], priority: sc.task.priority, status: "open", dueAt: addHours(due.at, sc.task.dueInHours), dependsOn: [],
      checklist: sc.task.checklist.map((label, i) => ({ id: "c" + i, label, done: false })), notes: [], evidenceFileIds: [],
      scheduleId: sc.id, instanceKey: due.key, createdAt: ctx.now, createdBy: "system", slaPolicyId: "sla-task" });
    message = "Created the " + due.key.split(":")[1] + " instance in the team queue.";
  } else if (sc.kind === "automation" && sc.workflowTemplateId) {
    const tpl = s.config.workflowTemplates.find((t) => t.id === sc.workflowTemplateId);
    const rid = nid(s, "run");
    s.data.runs.push({ id: rid, ref: "RUN-" + (300 + s.data.runs.length + 1), templateId: sc.workflowTemplateId, title: (tpl?.label || sc.label) + ", " + due.key.split(":")[1],
      ownerId: sc.ownerId, assigneeId: sc.ownerId, teamId: sc.teamId, unitId: s.config.teams.find((t) => t.id === sc.teamId)?.unitId, status: "queued",
      startedAt: ctx.now, updatedAt: ctx.now, affectedRecordIds: [], appliedEffects: [],
      steps: (tpl?.steps || []).map((st) => ({ stepId: st.id, label: st.label, status: "pending" as const })) });
    message = "Queued a run for " + due.key.split(":")[1] + ". In this demo it waits for you to start it from Workflows.";
  } else {
    message = "Report preview created. No scheduler or email connection is configured, so nothing was sent.";
  }
  log(s, ctx, { action: "schedule.ran", objectType: "schedule", objectId: sc.id, recordIds: [], teamId: sc.teamId, simulated: true,
    summary: "Ran " + sc.label + " for " + due.key.split(":")[1] + " (simulated tick)" });
  return { ok: true, state: s, message };
}

export function setScheduleActive(s0: CoreState, ctx: Ctx, scheduleId: Id, active: boolean): Result {
  const sc0 = s0.data.schedules.find((x) => x.id === scheduleId);
  if (!sc0) return fail("Schedule not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "workflows.operate") && sc0.ownerId !== ctx.viewerId) return fail("Only the owner or a workflow operator can change this.");
  const s = begin(s0);
  const sc = s.data.schedules.find((x) => x.id === scheduleId)!;
  sc.active = active;
  log(s, ctx, { action: active ? "schedule.resumed" : "schedule.paused", objectType: "schedule", objectId: sc.id, recordIds: [], teamId: sc.teamId,
    summary: (active ? "Resumed " : "Paused future runs of ") + sc.label });
  return { ok: true, state: s, message: active ? "Resumed. The next run is scheduled." : "Future runs paused. Runs already in progress are not affected." };
}

/* ── Workflow runs ─────────────────────────────────────────────────────── */

function runPerm(s: CoreState, ctx: Ctx, r: WorkflowRun): string | null {
  const v = viewerOf(s, ctx.viewerId);
  if (r.ownerId === v.person.id || r.assigneeId === v.person.id) return null;
  if (can(v, "workflows.operate") && (v.isOrgWide || (!!r.teamId && v.overseenTeamIds.includes(r.teamId)))) return null;
  return "Only the run owner, its assignee or a workflow operator for this team can do that.";
}

export function pauseRun(s0: CoreState, ctx: Ctx, runId: Id, paused: boolean, reason: string): Result {
  const r0 = s0.data.runs.find((x) => x.id === runId);
  if (!r0) return fail("Run not found.");
  const p = runPerm(s0, ctx, r0);
  if (p) return fail(p);
  if (paused && (r0.status === "completed" || r0.status === "failed")) return fail("A " + r0.status + " run cannot be paused.");
  if (!paused && r0.status !== "paused") return fail("This run is not paused.");
  if (paused && !reason.trim()) return fail("Say why it is paused.");
  const s = begin(s0);
  const r = s.data.runs.find((x) => x.id === runId)!;
  const cur = r.steps.find((st) => st.status === "current" || st.status === "waiting");
  if (paused) { r.status = "paused"; if (cur) { cur.status = "waiting"; cur.note = "Paused: " + reason.trim(); } }
  else {
    const req = s.data.requests.find((x) => x.id === r.requestId);
    r.status = req ? "awaiting_approval" : "running";
    if (cur) { cur.status = "current"; cur.note = undefined; }
    if (req) syncRun(s, ctx, req);
  }
  r.updatedAt = ctx.now;
  log(s, ctx, { action: paused ? "run.paused" : "run.resumed", objectType: "run", objectId: r.id, recordIds: r.affectedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: (paused ? "Paused " : "Resumed ") + r.ref + (paused ? ": " + reason.trim() : "") });
  return { ok: true, state: s, message: paused ? "This case is paused. The schedule that started it keeps running." : "Resumed." };
}

export function assignRun(s0: CoreState, ctx: Ctx, runId: Id, personId: Id): Result {
  const r0 = s0.data.runs.find((x) => x.id === runId);
  if (!r0) return fail("Run not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "workflows.operate")) return fail("Assigning a run needs a workflow operator.");
  if (!s0.data.people.some((p) => p.id === personId && p.kind === "staff" && p.status === "active")) return fail("Pick an active member of staff.");
  const s = begin(s0);
  const r = s.data.runs.find((x) => x.id === runId)!;
  r.assigneeId = personId;
  r.updatedAt = ctx.now;
  log(s, ctx, { action: "run.assigned", objectType: "run", objectId: r.id, recordIds: r.affectedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: "Assigned " + r.ref + " to " + nameOf(s, personId) });
  return { ok: true, state: s, message: "Assigned to " + nameOf(s, personId) + ". Retry when ready." };
}

/** Start a queued run or retry a failed one from its failed step. Applied effects are never repeated. */
export function retryRun(s0: CoreState, ctx: Ctx, runId: Id): Result {
  const r0 = s0.data.runs.find((x) => x.id === runId);
  if (!r0) return fail("Run not found.");
  const p = runPerm(s0, ctx, r0);
  if (p) return fail(p);
  if (r0.status !== "failed" && r0.status !== "queued") {
    return { ok: true, state: s0, message: "This run is " + r0.status.replace("_", " ") + ". Nothing to retry, and no completed step was repeated." };
  }
  const s = begin(s0);
  const r = s.data.runs.find((x) => x.id === runId)!;
  const tpl = s.config.workflowTemplates.find((t) => t.id === r.templateId);
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const st of r.steps) {
    if (st.status === "done" || st.status === "skipped") { skipped.push(st.label); continue; }
    const def = tpl?.steps.find((x) => x.id === st.stepId);
    const key = r.id + ":" + st.stepId;
    if (r.appliedEffects.some((e) => e.key === key)) { st.status = "done"; skipped.push(st.label); continue; }
    if (def?.kind === "task" && !r.assigneeId) {
      st.status = "failed"; st.at = ctx.now; st.note = "Still no owner for the review task";
      r.status = "failed";
      r.failure = { stepId: st.stepId, message: "The review task still has no owner. Assign the run first.", impact: r.failure?.impact || "Work is waiting without an owner.", at: ctx.now, cause: "missing-owner" };
      log(s, ctx, { action: "run.failed", objectType: "run", objectId: r.id, recordIds: r.affectedRecordIds, teamId: r.teamId, unitId: r.unitId, summary: r.ref + " failed again: no owner for the review task" });
      return { ok: true, state: s, message: "Still failing: assign an owner, then retry." };
    }
    if (def?.effect === "external") {
      const conn = s.config.sources.find((x) => x.kind === "external" && x.connected);
      if (!conn) {
        st.status = "failed"; st.at = ctx.now; st.note = "No connection configured; nothing sent";
        r.status = "failed";
        r.failure = { stepId: st.stepId, message: "The external connection is not configured.", impact: "The external system was not updated.", at: ctx.now, cause: "no-connection" };
        return { ok: true, state: s, message: "Still failing: no connection. Skip this step with a reason, or connect it in Settings > Systems." };
      }
    }
    if (def?.kind === "approval") { st.status = "current"; r.status = "awaiting_approval"; break; }
    if (def?.kind === "task" && def.effect === "local") {
      const tid = nid(s, "t");
      s.data.tasks.push({ id: tid, title: "Review data gaps from " + r.ref, teamId: r.teamId, unitId: r.unitId, assigneeId: r.assigneeId, linkedRecordIds: [...r.affectedRecordIds],
        priority: "normal", status: "open", dependsOn: [], checklist: [], notes: [], evidenceFileIds: [], createdAt: ctx.now, createdBy: "system", slaPolicyId: "sla-task",
        dueAt: addBusinessHours(ctx.now, 16, s.config.timezone) });
      r.appliedEffects.push({ key, description: "Created review task for " + nameOf(s, r.assigneeId), at: ctx.now });
    } else if (def?.effect === "local") {
      r.appliedEffects.push({ key, description: st.label, at: ctx.now });
    }
    st.status = "done"; st.at = ctx.now; st.note = undefined; st.effectKey = key;
    applied.push(st.label);
  }
  if (r.steps.every((st) => st.status === "done" || st.status === "skipped")) { r.status = "completed"; r.failure = undefined; }
  r.updatedAt = ctx.now;
  log(s, ctx, { action: "run.retried", objectType: "run", objectId: r.id, recordIds: r.affectedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: "Ran " + r.ref + ": " + (applied.length ? applied.join(", ") : "no new steps") + (skipped.length ? "; already done: " + skipped.join(", ") : "") });
  return { ok: true, state: s, message: r.status === "completed" ? "Recovered. " + applied.length + " step(s) ran; " + skipped.length + " already-completed step(s) were not repeated." : "Running." };
}

export function skipRunStep(s0: CoreState, ctx: Ctx, runId: Id, reason: string): Result {
  const r0 = s0.data.runs.find((x) => x.id === runId);
  if (!r0) return fail("Run not found.");
  const p = runPerm(s0, ctx, r0);
  if (p) return fail(p);
  if (r0.status !== "failed" || !r0.failure) return fail("Only a failed step can be skipped.");
  if (!reason.trim()) return fail("Give a reason for skipping.");
  const s = begin(s0);
  const r = s.data.runs.find((x) => x.id === runId)!;
  const st = r.steps.find((x) => x.stepId === r.failure!.stepId)!;
  st.status = "skipped"; st.note = "Skipped: " + reason.trim(); st.at = ctx.now;
  r.failure = undefined;
  r.status = "queued";
  log(s, ctx, { action: "run.step.skipped", objectType: "run", objectId: r.id, recordIds: r.affectedRecordIds, teamId: r.teamId, unitId: r.unitId,
    summary: "Skipped “" + st.label + "” on " + r.ref + ": " + reason.trim() });
  const next = retryRun(s, ctx, runId);
  return next.ok ? { ...next, message: "Skipped with your reason. " + next.message } : next;
}

/* ── Data quality ──────────────────────────────────────────────────────── */

function issueFor(s: CoreState, id: Id): DataIssue | undefined {
  return allIssues(s).find((i) => i.id === id);
}

function storeIssue(s: CoreState, i: DataIssue): DataIssue {
  let st = s.data.issues.find((x) => x.id === i.id);
  if (!st) { st = structuredClone(i); s.data.issues.push(st); }
  return st;
}

function canResolve(s: CoreState, ctx: Ctx, i: DataIssue): string | null {
  const v = viewerOf(s, ctx.viewerId);
  if (i.ownerId === v.person.id || v.isOrgWide) return null;
  const recs = i.recordIds.map((id) => s.data.records.find((r) => r.id === id)).filter(Boolean) as RecordItem[];
  if (can(v, "records.edit") && can(v, "tasks.manage") && recs.some((r) => r.teamId && v.overseenTeamIds.includes(r.teamId))) return null;
  return "Only the issue owner, a manager of the team or an administrator can resolve this.";
}

export function setIssueState(s0: CoreState, ctx: Ctx, issueId: Id, state: "in_progress" | "dismissed" | "open", reason: string): Result {
  const i0 = issueFor(s0, issueId);
  if (!i0) return fail("Issue not found.");
  const p = canResolve(s0, ctx, i0);
  if (p) return fail(p);
  if (state === "dismissed" && !reason.trim()) return fail("Say why this is not a problem.");
  const s = begin(s0);
  const i = storeIssue(s, i0);
  i.state = state;
  if (state === "dismissed") i.resolution = { by: ctx.viewerId, at: ctx.now, action: "Dismissed", reason: reason.trim() };
  log(s, ctx, { action: "issue." + state, objectType: "issue", objectId: i.id, recordIds: i.recordIds, summary: (state === "dismissed" ? "Dismissed: " : state === "open" ? "Reopened: " : "Started: ") + i.title + (reason ? " (" + reason.trim() + ")" : "") });
  return { ok: true, state: s, message: state === "dismissed" ? "Dismissed with your reason." : "Updated." };
}

export function assignIssue(s0: CoreState, ctx: Ctx, issueId: Id, ownerId: Id): Result {
  const i0 = issueFor(s0, issueId);
  if (!i0) return fail("Issue not found.");
  const p = canResolve(s0, ctx, i0);
  if (p) return fail(p);
  const s = begin(s0);
  const i = storeIssue(s, i0);
  i.ownerId = ownerId;
  log(s, ctx, { action: "issue.assigned", objectType: "issue", objectId: i.id, recordIds: i.recordIds, summary: "Assigned " + i.title + " to " + nameOf(s, ownerId) });
  return { ok: true, state: s, message: "Owner set to " + nameOf(s, ownerId) + "." };
}

export function resolveConflict(s0: CoreState, ctx: Ctx, issueId: Id, chosenSourceId: string, reason: string): Result {
  const i0 = issueFor(s0, issueId);
  if (!i0 || i0.kind !== "conflict" || !i0.values) return fail("Conflict not found.");
  const p = canResolve(s0, ctx, i0);
  if (p) return fail(p);
  if (!reason.trim()) return fail("Record why this value is right.");
  const chosen = i0.values.find((x) => x.sourceId === chosenSourceId);
  if (!chosen) return fail("Pick one of the compared values.");
  const s = begin(s0);
  const i = storeIssue(s, i0);
  const rec = s.data.records.find((r) => r.id === i.recordIds[0])!;
  let msg: string;
  if (chosenSourceId === "pulse") {
    const auth = applyField(s, ctx, rec, i.field!, chosen.value, "kept Pulse value: " + reason.trim(), { id: ctx.viewerId, kind: "person" });
    msg = auth.label;
  } else {
    const before = rec.fields[i.field!] ?? null;
    rec.fields[i.field!] = chosen.value;
    rec.fieldMeta[i.field!] = { origin: "source", sourceId: chosenSourceId, sourceUpdatedAt: chosen.at };
    rec.updatedAt = ctx.now;
    log(s, ctx, { action: "record.updated", objectType: "record", objectId: rec.id, recordIds: [rec.id], teamId: rec.teamId, unitId: rec.unitId,
      summary: "Accepted " + nameOf(s, chosenSourceId) + " value for " + i.field + " on " + rec.ref + ": " + reason.trim(), before: { [i.field!]: before }, after: { [i.field!]: chosen.value } });
    msg = "Record now matches " + nameOf(s, chosenSourceId) + ".";
  }
  i.state = "resolved";
  i.resolution = { by: ctx.viewerId, at: ctx.now, action: "Kept value from " + nameOf(s, chosenSourceId), reason: reason.trim() };
  log(s, ctx, { action: "issue.resolved", objectType: "issue", objectId: i.id, recordIds: i.recordIds, teamId: rec.teamId, unitId: rec.unitId, summary: "Resolved conflict on " + rec.ref + " " + i.field });
  return { ok: true, state: s, message: "Resolved. " + msg };
}

export function mapCode(s0: CoreState, ctx: Ctx, issueId: Id, to: string): Result {
  const i0 = issueFor(s0, issueId);
  if (!i0 || i0.kind !== "unmapped_value") return fail("Issue not found.");
  const v = viewerOf(s0, ctx.viewerId);
  const p = canResolve(s0, ctx, i0);
  if (p) return fail(p);
  const rec0 = s0.data.records.find((r) => r.id === i0.recordIds[0]);
  const type = rec0 && s0.config.recordTypes.find((t) => t.id === rec0.typeId);
  const def = type?.fields.find((f) => f.key === i0.field);
  if (!def || !def.options?.some((o) => o.value === to)) return fail("Pick one of the configured values.");
  const s = begin(s0);
  const i = storeIssue(s, i0);
  const mappingAdded = !!can(v, "settings.edit");
  if (mappingAdded) s.config.codeMappings.push({ id: nid(s, "cm"), sourceId: i.sourceIds[0], field: i.field!, from: i.sourceValue!, to });
  const rec = s.data.records.find((r) => r.id === i.recordIds[0])!;
  const before = rec.fields[i.field!] ?? null;
  rec.fields[i.field!] = to;
  rec.fieldMeta[i.field!] = { origin: "source", sourceId: i.sourceIds[0], sourceUpdatedAt: rec.fieldMeta[i.field!]?.sourceUpdatedAt };
  rec.updatedAt = ctx.now;
  i.state = "resolved";
  i.resolution = { by: ctx.viewerId, at: ctx.now, action: "Mapped " + i.sourceValue + " to " + to, reason: mappingAdded ? "Mapping saved for future syncs" : "Applied to this record; an administrator still needs to save the mapping" };
  log(s, ctx, { action: "record.updated", objectType: "record", objectId: rec.id, recordIds: [rec.id], teamId: rec.teamId, unitId: rec.unitId,
    summary: "Mapped source code " + i.sourceValue + " to " + to + " on " + rec.ref, before: { [i.field!]: before }, after: { [i.field!]: to } });
  return { ok: true, state: s, message: mappingAdded ? "Mapped, and saved for future syncs." : "Mapped on this record. Ask an administrator to save the mapping for future syncs." };
}

export interface MergePreview {
  survivor: RecordItem;
  other: RecordItem;
  fieldDiffs: { key: string; survivor: FieldValue; other: FieldValue }[];
  relationships: number;
  tasks: number;
  files: number;
  requests: number;
  sourceRefs: { sourceId: string; externalId: string }[];
}

export function mergePreview(s: CoreState, survivorId: Id, otherId: Id): MergePreview | null {
  const survivor = s.data.records.find((r) => r.id === survivorId);
  const other = s.data.records.find((r) => r.id === otherId);
  if (!survivor || !other) return null;
  const keys = [...new Set([...Object.keys(survivor.fields), ...Object.keys(other.fields)])];
  return {
    survivor, other,
    fieldDiffs: keys.filter((k) => (survivor.fields[k] ?? null) !== (other.fields[k] ?? null)).map((k) => ({ key: k, survivor: survivor.fields[k] ?? null, other: other.fields[k] ?? null })),
    relationships: s.data.relationships.filter((r) => r.fromId === otherId || r.toId === otherId).length,
    tasks: s.data.tasks.filter((t) => t.linkedRecordIds.includes(otherId)).length,
    files: s.data.files.filter((f) => f.linkedRecordIds.includes(otherId)).length,
    requests: s.data.requests.filter((r) => r.linkedRecordIds.includes(otherId)).length,
    sourceRefs: other.sourceRefs.map((x) => ({ sourceId: x.sourceId, externalId: x.externalId }))
  };
}

export function mergeRecords(s0: CoreState, ctx: Ctx, issueId: Id, survivorId: Id, reason: string): Result {
  const i0 = issueFor(s0, issueId);
  if (!i0 || i0.kind !== "duplicate") return fail("Duplicate issue not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "records.merge")) return fail("Merging records needs the merge permission (administrators by default).");
  if (!i0.recordIds.includes(survivorId)) return fail("Pick one of the two records to keep.");
  if (!reason.trim()) return fail("Record why these are the same.");
  const otherId = i0.recordIds.find((id) => id !== survivorId)!;
  const s = begin(s0);
  const survivor = s.data.records.find((r) => r.id === survivorId)!;
  const other = s.data.records.find((r) => r.id === otherId)!;
  const moved = { rel: [] as Id[], tasks: [] as Id[], files: [] as Id[], requests: [] as Id[], refs: [] as string[] };
  for (const rel of s.data.relationships) {
    if (rel.fromId === otherId) { rel.fromId = survivorId; moved.rel.push(rel.id); }
    if (rel.toId === otherId) { rel.toId = survivorId; moved.rel.push(rel.id); }
  }
  for (const t of s.data.tasks) if (t.linkedRecordIds.includes(otherId)) { t.linkedRecordIds = [...new Set(t.linkedRecordIds.map((x) => x === otherId ? survivorId : x))]; moved.tasks.push(t.id); }
  for (const f of s.data.files) if (f.linkedRecordIds.includes(otherId)) { f.linkedRecordIds = [...new Set(f.linkedRecordIds.map((x) => x === otherId ? survivorId : x))]; moved.files.push(f.id); }
  for (const r of s.data.requests) if (r.linkedRecordIds.includes(otherId)) { r.linkedRecordIds = [...new Set(r.linkedRecordIds.map((x) => x === otherId ? survivorId : x))]; moved.requests.push(r.id); }
  // Source references are preserved on the survivor, so both systems still match.
  for (const ref of other.sourceRefs) {
    if (survivor.sourceRefs.some((x) => x.sourceId === ref.sourceId && x.externalId === ref.externalId)) continue;
    survivor.sourceRefs.push(ref);
    moved.refs.push(ref.sourceId + "|" + ref.externalId);
  }
  for (const [k, val] of Object.entries(other.fields)) if (isEmpty(survivor.fields[k]) && !isEmpty(val)) { survivor.fields[k] = val; survivor.fieldMeta[k] = other.fieldMeta[k]; }
  other.mergedInto = survivorId;
  other.status = "inactive";
  survivor.updatedAt = other.updatedAt = ctx.now;
  const i = storeIssue(s, i0);
  i.state = "resolved";
  i.resolution = { by: ctx.viewerId, at: ctx.now, action: "Merged " + other.ref + " into " + survivor.ref, reason: reason.trim() };
  log(s, ctx, { action: "record.merged", objectType: "record", objectId: survivor.id, recordIds: [survivor.id, other.id],
    summary: "Merged " + other.ref + " into " + survivor.ref + ": " + reason.trim() + " (moved " + moved.rel.length + " relationships, " + moved.tasks.length + " tasks, " + moved.files.length + " files)",
    after: { moved: JSON.stringify(moved) } });
  return { ok: true, state: s, message: "Merged. " + other.ref + " now points to " + survivor.ref + "; its history and source references are kept. Undo is available from the record's history." };
}

export function unmergeRecord(s0: CoreState, ctx: Ctx, mergedId: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "records.merge")) return fail("Undoing a merge needs the merge permission.");
  const other0 = s0.data.records.find((r) => r.id === mergedId);
  if (!other0?.mergedInto) return fail("This record is not merged.");
  const ev = [...s0.data.events].reverse().find((e) => e.action === "record.merged" && e.recordIds.includes(mergedId));
  const moved = ev?.after?.moved ? JSON.parse(String(ev.after.moved)) as { rel: Id[]; tasks: Id[]; files: Id[]; requests: Id[]; refs: string[] }
    : { rel: [], tasks: [], files: [], requests: [], refs: [] };
  const s = begin(s0);
  const other = s.data.records.find((r) => r.id === mergedId)!;
  const survivorId = other.mergedInto!;
  const survivor = s.data.records.find((r) => r.id === survivorId)!;
  for (const rel of s.data.relationships) if (moved.rel.includes(rel.id)) { if (rel.fromId === survivorId) rel.fromId = mergedId; else if (rel.toId === survivorId) rel.toId = mergedId; }
  for (const t of s.data.tasks) if (moved.tasks.includes(t.id)) t.linkedRecordIds.push(mergedId);
  for (const f of s.data.files) if (moved.files.includes(f.id)) f.linkedRecordIds.push(mergedId);
  for (const r of s.data.requests) if (moved.requests.includes(r.id)) r.linkedRecordIds.push(mergedId);
  survivor.sourceRefs = survivor.sourceRefs.filter((x) => !(moved.refs || []).includes(x.sourceId + "|" + x.externalId));
  other.mergedInto = undefined;
  other.status = "active";
  const iss = s.data.issues.find((i) => i.kind === "duplicate" && i.recordIds.includes(mergedId));
  if (iss) { iss.state = "open"; iss.resolution = undefined; }
  log(s, ctx, { action: "record.unmerged", objectType: "record", objectId: mergedId, recordIds: [survivorId, mergedId], summary: "Undid merge of " + other.ref + " into " + survivor.ref });
  return { ok: true, state: s, message: "Merge undone." };
}

export function linkUnmatched(s0: CoreState, ctx: Ctx, issueId: Id, recordId: Id | null, title?: string): Result {
  const i0 = issueFor(s0, issueId);
  if (!i0 || i0.kind !== "unmatched") return fail("Issue not found.");
  const p = canResolve(s0, ctx, i0);
  if (p) return fail(p);
  const s = begin(s0);
  const i = storeIssue(s, i0);
  let rec: RecordItem;
  if (recordId) {
    const r = s.data.records.find((x) => x.id === recordId);
    if (!r) return fail("Record not found.");
    rec = r;
  } else {
    const typeId = s.config.recordTypes[0].id;
    const id = nid(s, "r");
    rec = { id, typeId, ref: "REC-" + (1000 + s.data.records.length + 1), title: title || i.sourceValue || "New record", status: "active", ownerId: ctx.viewerId,
      teamId: viewerOf(s, ctx.viewerId).memberTeamIds[0], visibility: "team", fields: {}, fieldMeta: {}, sourceRefs: [], createdAt: ctx.now, updatedAt: ctx.now };
    rec.unitId = s.config.teams.find((t) => t.id === rec.teamId)?.unitId;
    s.data.records.push(rec);
  }
  rec.sourceRefs.push({ sourceId: i.sourceIds[0], externalId: i.externalId || "", syncedAt: i.detectedAt });
  i.state = "resolved";
  i.recordIds = [rec.id];
  i.resolution = { by: ctx.viewerId, at: ctx.now, action: recordId ? "Linked to " + rec.ref : "Created " + rec.ref, reason: "Source row " + i.externalId };
  log(s, ctx, { action: recordId ? "record.linked" : "record.created", objectType: "record", objectId: rec.id, recordIds: [rec.id], teamId: rec.teamId, unitId: rec.unitId,
    summary: (recordId ? "Linked source row " + i.externalId + " to " + rec.ref : "Created " + rec.ref + " from source row " + i.externalId) });
  return { ok: true, state: s, message: recordId ? "Linked." : "Created " + rec.ref + ".", id: rec.id };
}

export function createRecord(s0: CoreState, ctx: Ctx, typeId: string, title: string, fields: Record<string, FieldValue>, teamId?: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "records.edit")) return fail("Your role cannot create records.");
  const type = s0.config.recordTypes.find((t) => t.id === typeId);
  if (!type) return fail("Unknown record type.");
  if (!title.trim()) return fail("Give it a title.");
  const errs = validateFields(type.fields, fields);
  if (Object.keys(errs).length) return fail(Object.values(errs)[0]);
  const s = begin(s0);
  const id = nid(s, "r");
  const team = teamId || v.memberTeamIds[0];
  const rec: RecordItem = { id, typeId, ref: (typeId === "record" ? "REC-" : typeId.slice(0, 3).toUpperCase() + "-") + (1000 + s.data.records.length + 1), title: title.trim(),
    status: type.statuses[0]?.id || "active", ownerId: ctx.viewerId, teamId: team, unitId: s.config.teams.find((t) => t.id === team)?.unitId,
    visibility: type.defaultVisibility, fields: { ...fields }, fieldMeta: Object.fromEntries(Object.keys(fields).map((k) => [k, { origin: "manual" as const }])),
    sourceRefs: [], createdAt: ctx.now, updatedAt: ctx.now };
  s.data.records.push(rec);
  log(s, ctx, { action: "record.created", objectType: "record", objectId: id, recordIds: [id], teamId: rec.teamId, unitId: rec.unitId, summary: "Created " + rec.ref + ": " + rec.title });
  return { ok: true, state: s, message: "Created " + rec.ref + ".", id };
}

export function addRelationship(s0: CoreState, ctx: Ctx, fromId: Id, toId: Id, label: string): Result {
  if (!can(viewerOf(s0, ctx.viewerId), "records.edit")) return fail("Your role cannot edit records.");
  if (fromId === toId) return fail("A record cannot relate to itself.");
  if (s0.data.relationships.some((r) => (r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId))) return fail("Already related.");
  const s = begin(s0);
  s.data.relationships.push({ id: nid(s, "rel"), fromId, toId, label: label || "relates to" });
  log(s, ctx, { action: "record.related", objectType: "record", objectId: fromId, recordIds: [fromId, toId], summary: "Related two records (" + (label || "relates to") + ")" });
  return { ok: true, state: s, message: "Related." };
}

/* ── Views and reports ─────────────────────────────────────────────────── */

export function saveView(s0: CoreState, ctx: Ctx, v: Omit<SavedView, "id" | "ownerId">): Result {
  if (!v.name.trim()) return fail("Name the view.");
  const viewer = viewerOf(s0, ctx.viewerId);
  if (v.shared && !can(viewer, "views.share")) return fail("Your role cannot share views.");
  if (v.shared && v.teamId && !viewer.memberTeamIds.includes(v.teamId) && !viewer.overseenTeamIds.includes(v.teamId) && !viewer.isOrgWide) return fail("You can only share with a team you are in.");
  const s = begin(s0);
  const id = nid(s, "v");
  s.data.views.push({ ...v, name: v.name.trim(), id, ownerId: ctx.viewerId });
  log(s, ctx, { action: "view.saved", objectType: "view", objectId: id, recordIds: [], teamId: v.teamId,
    summary: (v.shared ? "Shared view " : "Saved private view ") + "“" + v.name.trim() + "”" });
  return { ok: true, state: s, message: v.shared ? "Shared. Teammates see the same filters, but only the rows they are already allowed to see." : "Saved for you.", id };
}

export function deleteView(s0: CoreState, ctx: Ctx, viewId: Id): Result {
  const v = s0.data.views.find((x) => x.id === viewId);
  if (!v) return fail("View not found.");
  if (v.ownerId !== ctx.viewerId && !viewerOf(s0, ctx.viewerId).isOrgWide) return fail("Only the owner can delete this view.");
  const s = begin(s0);
  s.data.views = s.data.views.filter((x) => x.id !== viewId);
  return { ok: true, state: s, message: "View deleted." };
}

/** People who may receive a report for this scope: active staff who could select it themselves. */
export function eligibleRecipients(s: CoreState, scopeKeyStr: string): Person[] {
  return s.data.people.filter((p) => p.kind === "staff" && p.status === "active" && scopeOptions(s, viewerOf(s, p.id)).some((o) => o.key === scopeKeyStr || o.key === "organisation"));
}

export function createReportSchedule(s0: CoreState, ctx: Ctx, dashboardId: string, cadence: string, recipientIds: Id[]): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "export")) return fail("Your role cannot schedule reports.");
  if (!recipientIds.length) return fail("Pick at least one recipient.");
  const allowed = new Set(eligibleRecipients(s0, scopeKey(ctx.scope)).map((p) => p.id));
  const blocked = recipientIds.filter((id) => !allowed.has(id));
  if (blocked.length) return fail(blocked.map((id) => nameOf(s0, id)).join(", ") + " cannot see this scope, so cannot receive it.");
  const s = begin(s0);
  const id = nid(s, "rs");
  const d = s.config.dashboards.find((x) => x.id === dashboardId);
  s.data.reportSchedules.push({ id, dashboardId, label: (d?.label || "Dashboard") + " report", cadence, recipientIds, createdBy: ctx.viewerId, createdAt: ctx.now });
  log(s, ctx, { action: "report.scheduled", objectType: "view", objectId: id, recordIds: [], simulated: true, summary: "Scheduled " + (d?.label || "dashboard") + " report (" + cadence + ") for " + recipientIds.length + " people" });
  return { ok: true, state: s, message: "Saved as a sample schedule. No scheduler or email connection is configured, so nothing will be sent.", id };
}

export function logExport(s0: CoreState, ctx: Ctx, what: string, rows: number): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (s0.config.governance.exportRequiresPermission && !can(v, "export")) return fail("Your role cannot export data.");
  const s = begin(s0);
  log(s, ctx, { action: "export.generated", objectType: "view", objectId: "export", recordIds: [], summary: "Exported " + rows + " rows: " + what });
  return { ok: true, state: s, message: "Exported " + rows + " rows you can see." };
}

/* ── Organisation and configuration ────────────────────────────────────── */

const needSettings = (s: CoreState, ctx: Ctx) => can(viewerOf(s, ctx.viewerId), "settings.edit") ? null : "Only an administrator can change settings.";

export function updateConfig(s0: CoreState, ctx: Ctx, patch: (c: OrgConfig) => string | void, summary: string): Result {
  const p = needSettings(s0, ctx);
  if (p) return fail(p);
  const s = begin(s0);
  const err = patch(s.config);
  if (typeof err === "string" && err) return fail(err);
  log(s, ctx, { action: "config.changed", objectType: "config", objectId: "config", recordIds: [], summary });
  return { ok: true, state: s, message: "Saved." };
}

export function setMembership(s0: CoreState, ctx: Ctx, personId: Id, teamId: Id, member: boolean): Result {
  const p = needSettings(s0, ctx);
  if (p) return fail(p);
  const s = begin(s0);
  const has = s.data.memberships.some((m) => m.personId === personId && m.teamId === teamId);
  if (member && !has) s.data.memberships.push({ personId, teamId });
  if (!member) s.data.memberships = s.data.memberships.filter((m) => !(m.personId === personId && m.teamId === teamId));
  log(s, ctx, { action: "org.membership", objectType: "person", objectId: personId, recordIds: [], summary: (member ? "Added " : "Removed ") + nameOf(s, personId) + (member ? " to " : " from ") + nameTeam(s, teamId) });
  return { ok: true, state: s, message: "Saved." };
}

export function setRoleAssignment(s0: CoreState, ctx: Ctx, personId: Id, roleId: string, scope: RoleScope, add: boolean): Result {
  const p = needSettings(s0, ctx);
  if (p) return fail(p);
  if (!add && personId === ctx.viewerId && roleId === "admin" && s0.data.roleAssignments.filter((r) => r.roleId === "admin").length === 1) return fail("You are the only administrator. Add another one first.");
  const s = begin(s0);
  const same = (r: { personId: Id; roleId: string; scope: RoleScope }) => r.personId === personId && r.roleId === roleId && JSON.stringify(r.scope) === JSON.stringify(scope);
  if (add && !s.data.roleAssignments.some(same)) s.data.roleAssignments.push({ id: nid(s, "ra"), personId, roleId, scope });
  if (!add) s.data.roleAssignments = s.data.roleAssignments.filter((r) => !same(r));
  const role = s.config.roles.find((r) => r.id === roleId)?.label || roleId;
  log(s, ctx, { action: "org.role", objectType: "person", objectId: personId, recordIds: [], summary: (add ? "Gave " : "Removed ") + role + (add ? " to " : " from ") + nameOf(s, personId) });
  return { ok: true, state: s, message: add ? "Role added. It applies to their next action." : "Role removed. Decisions they no longer have authority for are blocked at the moment they try." };
}

export function invitePerson(s0: CoreState, ctx: Ctx, name: string, email: string, title: string, teamId?: Id): Result {
  const p = needSettings(s0, ctx);
  if (p) return fail(p);
  if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Give a name and a valid email.");
  if (s0.data.people.some((x) => x.email.toLowerCase() === email.toLowerCase())) return fail("Someone with that email is already here.");
  const s = begin(s0);
  const id = nid(s, "p");
  s.data.people.push({ id, name: name.trim(), email: email.trim(), title: title.trim() || "Member", kind: "staff", status: "invited" });
  s.data.roleAssignments.push({ id: nid(s, "ra"), personId: id, roleId: "contributor", scope: { kind: "organisation" } });
  if (teamId) s.data.memberships.push({ personId: id, teamId });
  log(s, ctx, { action: "org.invited", objectType: "person", objectId: id, recordIds: [], simulated: true, summary: "Added " + name.trim() + " as invited (no email sent in the demo)" });
  return { ok: true, state: s, message: "Added as invited. No invitation email is sent from this demo.", id };
}

export function setPersonStatus(s0: CoreState, ctx: Ctx, personId: Id, status: Person["status"]): Result {
  const p = needSettings(s0, ctx);
  if (p) return fail(p);
  if (personId === ctx.viewerId && status === "suspended") return fail("You cannot suspend yourself.");
  const s = begin(s0);
  const person = s.data.people.find((x) => x.id === personId);
  if (!person) return fail("Person not found.");
  person.status = status;
  log(s, ctx, { action: "org.status", objectType: "person", objectId: personId, recordIds: [], summary: "Set " + person.name + " to " + status });
  return { ok: true, state: s, message: status === "suspended" ? "Suspended. Their pending decisions are blocked until reassigned." : "Saved." };
}

export function addDelegation(s0: CoreState, ctx: Ctx, fromId: Id, toId: Id, ruleIds: string[], until: string, reason: string): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (fromId !== ctx.viewerId && !can(v, "settings.edit")) return fail("You can only delegate your own decisions.");
  if (!can(viewerOf(s0, fromId), "approvals.delegate")) return fail(nameOf(s0, fromId) + " cannot delegate approvals.");
  if (!ruleIds.length) return fail("Pick at least one approval rule.");
  if (!reason.trim()) return fail("Say why.");
  if (fromId === toId) return fail("Pick someone else.");
  const s = begin(s0);
  const id = nid(s, "dg");
  s.data.delegations.push({ id, fromId, toId, ruleIds, until, reason: reason.trim(), active: true });
  log(s, ctx, { action: "org.delegation", objectType: "person", objectId: toId, recordIds: [], summary: nameOf(s, toId) + " may decide " + ruleIds.length + " rule(s) for " + nameOf(s, fromId) + " until " + until.slice(0, 10) });
  return { ok: true, state: s, message: "Delegation saved. It covers only the rules you picked, until the date given, and never the delegate's own requests.", id };
}

export function revokeDelegation(s0: CoreState, ctx: Ctx, id: Id): Result {
  const d = s0.data.delegations.find((x) => x.id === id);
  if (!d) return fail("Not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (d.fromId !== ctx.viewerId && !can(v, "settings.edit")) return fail("Only the delegator or an administrator can revoke this.");
  const s = begin(s0);
  s.data.delegations.find((x) => x.id === id)!.active = false;
  log(s, ctx, { action: "org.delegation.revoked", objectType: "person", objectId: d.toId, recordIds: [], summary: "Revoked delegation from " + nameOf(s, d.fromId) + " to " + nameOf(s, d.toId) });
  return { ok: true, state: s, message: "Revoked." };
}

/** For page-level operations built outside this file: clone, then log against the clone. */
export const draft = begin;
export const logEvent = log;
export const _test = { resolveStages, viewerOf };
export type { Viewer };


/* ── People ────────────────────────────────────────────────────────────── */

/** Managers of the person's team (or unit), and administrators, may act on their employment record. */
function peopleAuthority(s: CoreState, ctx: Ctx, personId: Id): string | null {
  const v = viewerOf(s, ctx.viewerId);
  if (v.isOrgWide) return null;
  const e = s.data.employment.find((x) => x.personId === personId);
  if (e && can(v, "tasks.manage") && ((e.teamId && v.overseenTeamIds.includes(e.teamId)) || (e.unitId && v.overseenUnitIds.includes(e.unitId)) || e.managerId === v.person.id)) return null;
  return "Only this person's manager or an administrator can do that.";
}

function personTask(s: CoreState, ctx: Ctx, personId: Id, key: string, title: string, dueAt: string | undefined, assignee: Id | null): Id | null {
  if (s.data.tasks.some((t) => t.instanceKey === key && t.status !== "cancelled")) return null;
  const e = s.data.employment.find((x) => x.personId === personId);
  const id = nid(s, "t");
  s.data.tasks.push({ id, title, teamId: e?.teamId, unitId: e?.unitId, assigneeId: assignee, linkedRecordIds: [], priority: "normal", status: "open", dueAt,
    dependsOn: [], checklist: [], notes: [], evidenceFileIds: [], instanceKey: key, createdAt: ctx.now, createdBy: ctx.viewerId, slaPolicyId: "sla-task" });
  return id;
}

export function startChecklist(s0: CoreState, ctx: Ctx, personId: Id, which: "onboarding" | "offboarding"): Result {
  const p = peopleAuthority(s0, ctx, personId);
  if (p) return fail(p);
  const e0 = s0.data.employment.find((x) => x.personId === personId);
  if (!e0) return fail("No employment record for this person.");
  const items = which === "onboarding" ? s0.config.people.onboardingChecklist : s0.config.people.offboardingChecklist;
  if (!items.length) return fail("No " + which + " checklist is configured. Add one in Settings.");
  const s = begin(s0);
  const e = s.data.employment.find((x) => x.personId === personId)!;
  const anchor = which === "onboarding" ? e.startDate : (e.endDate || ctx.now);
  let made = 0;
  items.forEach((label, i) => {
    const id = personTask(s, ctx, personId, which + ":" + personId + ":" + i, label + ": " + nameOf(s, personId), addHours(anchor, 24 * (i + 1)), e.managerId || null);
    if (id) made++;
  });
  if (!made) return { ok: true, state: s0, message: "The " + which + " checklist already exists. Nothing was duplicated." };
  if (which === "offboarding" && e.stage !== "left") e.stage = "leaving";
  log(s, ctx, { action: "people." + which, objectType: "person", objectId: personId, recordIds: [], teamId: e.teamId, unitId: e.unitId,
    summary: "Started " + which + " for " + nameOf(s, personId) + " (" + made + " tasks)" });
  return { ok: true, state: s, message: "Created " + made + " " + which + " tasks for " + nameOf(s, personId) + "." };
}

export function bookRenewal(s0: CoreState, ctx: Ctx, personId: Id, certId: Id): Result {
  const p = peopleAuthority(s0, ctx, personId);
  if (p) return fail(p);
  const e0 = s0.data.employment.find((x) => x.personId === personId);
  const c = e0?.certifications.find((x) => x.id === certId);
  if (!e0 || !c) return fail("Certification not found.");
  const s = begin(s0);
  const due = c.expires && ms(c.expires) > ms(ctx.now) ? c.expires : addHours(ctx.now, 24 * 7);
  const id = personTask(s, ctx, personId, "cert:" + personId + ":" + certId + ":" + (c.expires || "none"), "Book " + c.name + " for " + nameOf(s, personId), due, e0.managerId || null);
  if (!id) return { ok: true, state: s0, message: "A renewal task already exists. Nothing was duplicated." };
  log(s, ctx, { action: "people.renewal", objectType: "task", objectId: id, recordIds: [], teamId: e0.teamId, unitId: e0.unitId,
    summary: "Booked " + c.name + " renewal for " + nameOf(s, personId) });
  return { ok: true, state: s, message: "Renewal task created for " + nameOf(s, e0.managerId) + ".", id };
}

export function recordCertification(s0: CoreState, ctx: Ctx, personId: Id, certId: Id, expires: string): Result {
  const p = peopleAuthority(s0, ctx, personId);
  if (p) return fail(p);
  if (isNaN(Date.parse(expires))) return fail("Give the new expiry date.");
  const s = begin(s0);
  const e = s.data.employment.find((x) => x.personId === personId);
  const c = e?.certifications.find((x) => x.id === certId);
  if (!e || !c) return fail("Certification not found.");
  const before = c.expires;
  c.expires = new Date(expires + (expires.length === 10 ? "T00:00:00Z" : "")).toISOString();
  for (const t of s.data.tasks) if (t.instanceKey && t.instanceKey.startsWith("cert:" + personId + ":" + certId + ":") && t.status !== "done") { t.status = "done"; t.completedAt = ctx.now; }
  log(s, ctx, { action: "people.certification", objectType: "person", objectId: personId, recordIds: [], teamId: e.teamId, unitId: e.unitId,
    summary: "Recorded " + c.name + " for " + nameOf(s, personId) + ", valid to " + c.expires.slice(0, 10), before: { expires: before }, after: { expires: c.expires } });
  return { ok: true, state: s, message: "Recorded. Valid to " + c.expires.slice(0, 10) + "." };
}

export function recordSignature(s0: CoreState, ctx: Ctx, personId: Id, docId: Id): Result {
  const isSelf = personId === ctx.viewerId;
  const p = isSelf ? null : peopleAuthority(s0, ctx, personId);
  if (p) return fail(p);
  const s = begin(s0);
  const e = s.data.employment.find((x) => x.personId === personId);
  const d = e?.documents.find((x) => x.id === docId);
  if (!e || !d) return fail("Document not found.");
  if (d.signedAt) return { ok: true, state: s0, message: "Already signed." };
  d.signedAt = ctx.now;
  log(s, ctx, { action: "people.signed", objectType: "person", objectId: personId, recordIds: [], teamId: e.teamId, unitId: e.unitId,
    summary: "Recorded signature of " + d.title + " by " + nameOf(s, personId) + " (no e-signature service connected)" });
  return { ok: true, state: s, message: "Signature recorded by hand. No e-signature service is connected." };
}

export function setStage(s0: CoreState, ctx: Ctx, personId: Id, stage: "probation" | "active" | "leaving", reason: string, endDate?: string): Result {
  const p = peopleAuthority(s0, ctx, personId);
  if (p) return fail(p);
  if (stage === "leaving" && (!endDate || isNaN(Date.parse(endDate)))) return fail("Give the last working day.");
  if (!reason.trim()) return fail("Add a short reason.");
  const s = begin(s0);
  const e = s.data.employment.find((x) => x.personId === personId);
  if (!e) return fail("No employment record for this person.");
  const before = e.stage;
  e.stage = stage;
  if (stage === "active") e.probationEnds = undefined;
  if (stage === "leaving" && endDate) e.endDate = new Date(endDate + "T17:00:00Z").toISOString();
  log(s, ctx, { action: "people.stage", objectType: "person", objectId: personId, recordIds: [], teamId: e.teamId, unitId: e.unitId,
    summary: nameOf(s, personId) + ": " + before + " to " + stage + " (" + reason.trim() + ")", before: { stage: before }, after: { stage } });
  return { ok: true, state: s, message: nameOf(s, personId) + " is now " + stage + "." };
}

export function recordAccessReview(s0: CoreState, ctx: Ctx, personId: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "settings.edit") && peopleAuthority(s0, ctx, personId)) return fail("Only a manager or an administrator can review access.");
  const s = begin(s0);
  const e = s.data.employment.find((x) => x.personId === personId);
  if (!e) return fail("No employment record for this person.");
  e.lastAccessReview = ctx.now;
  const roles = s.data.roleAssignments.filter((r) => r.personId === personId).map((r) => s.config.roles.find((x) => x.id === r.roleId)?.label || r.roleId);
  log(s, ctx, { action: "people.access-review", objectType: "person", objectId: personId, recordIds: [], teamId: e.teamId, unitId: e.unitId,
    summary: "Reviewed access for " + nameOf(s, personId) + ": " + (roles.join(", ") || "no roles") });
  return { ok: true, state: s, message: "Access review recorded." };
}

/* ── Schedules ─────────────────────────────────────────────────────────── */

export interface NewSchedule {
  label: string;
  teamId?: Id;
  ownerId?: Id;
  cadence: Schedule["cadence"];
  task: { title: string; priority: Priority; checklist: string[]; dueInHours: number };
}

/** A recurring task. Instances are produced one per occurrence key, so a repeated tick never duplicates. */
export function createSchedule(s0: CoreState, ctx: Ctx, n: NewSchedule): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "tasks.manage") && !can(v, "workflows.operate")) return fail("Only a manager can set up recurring work.");
  if (!n.label.trim() || !n.task.title.trim()) return fail("Give it a name and a task title.");
  if (n.teamId && !v.isOrgWide && !v.overseenTeamIds.includes(n.teamId)) return fail("You can only schedule work for teams you oversee.");
  const c = n.cadence;
  if (c.hour < 0 || c.hour > 23 || c.minute < 0 || c.minute > 59) return fail("Pick a valid time.");
  if (c.every === "week" && (c.weekday === undefined || c.weekday < 0 || c.weekday > 6)) return fail("Pick a weekday.");
  if (c.every === "month" && (!c.monthday || c.monthday < 1 || c.monthday > 28)) return fail("Pick a day of the month between 1 and 28.");
  const s = begin(s0);
  const id = nid(s, "sch");
  s.data.schedules.push({ id, label: n.label.trim(), kind: "recurring-task", ownerId: n.ownerId || ctx.viewerId, teamId: n.teamId || v.memberTeamIds[0],
    cadence: { ...c }, timezone: s.config.timezone, active: true, task: { ...n.task, title: n.task.title.trim() }, producedKeys: [] });
  log(s, ctx, { action: "schedule.created", objectType: "schedule", objectId: id, recordIds: [], teamId: n.teamId,
    summary: "Set up recurring work: " + n.label.trim() });
  return { ok: true, state: s, message: "Recurring work set up. The first instance is produced at the next occurrence.", id };
}
