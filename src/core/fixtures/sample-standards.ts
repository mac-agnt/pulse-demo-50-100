/* Sample requirements, obligations, checks and policy acknowledgements. Removable with the rest of the sample fixture layer.
   applyStandards() receives the sample config and data after the base sample is
   built (projects and finance already applied) and adds this module's rows and configuration.

   The story it sets up:
   - pr-doc "Rollout approved" (ms-doc-2) is gated on ob-doc-signoff and ob-doc-dpia.
     The data protection assessment is approved; the sign-off sheet arrived (version 2) but its review
     has not started, so the gate is still closed.
   - pr-svc still needs its data protection assessment (missing).
   - South office fire inspection expired on 1 March; one renewal task exists.
   - February's safety walk failed at the South office, with its follow-up task.
   - Supplier insurance: one approved, one under review, one rejected with a reason, one expiring soon, one missing
     (which holds back new orders), when Finance has added suppliers.
   - Code of conduct has a new version 3 that four people have not acknowledged yet. */

import { EVIDENCE_FORM, EVIDENCE_RULE, applies, allSubjects, checkRunKey, periodOf } from "../standards";
import { addBusinessHours } from "../time";
import type {
  Approval, AuditEvent, CheckRun, CoreData, FileDoc, Id, Obligation, OrgConfig, PolicyAck, RequestItem, RequirementDef, Task
} from "../types";

const REF = "2026-03-11T10:00:00.000Z";
const H = 3600_000;
const D = (ymd: string, hour = 10) => ymd + "T" + String(hour).padStart(2, "0") + ":00:00.000Z";
const TZ = "UTC";

export function applyStandards(c: OrgConfig, d: CoreData): void {
  const docType = d.projects.find((p) => p.id === "pr-doc")?.typeId;

  /* ── Requirements, checks, policies ── */
  const requirements: RequirementDef[] = [
    { id: "rq-signoff", label: "Document sign-off", description: "Signed agreement from the accountable leads before a rollout is approved.",
      appliesTo: "project", selector: docType ? { projectTypeIds: [docType] } : { subjectIds: ["pr-doc"] },
      evidence: "Sign-off sheet signed by each unit lead", reviewerRoleIds: ["team_manager", "admin"], ownerId: "p-robin" },
    { id: "rq-dpia", label: "Data protection assessment", description: "An assessment of how personal information is handled, before a change goes live.",
      appliesTo: "project", selector: { subjectIds: ["pr-doc", "pr-svc"] },
      evidence: "Completed assessment with the data owner's comments", renewEveryMonths: 12, reviewerRoleIds: ["team_manager", "admin"], ownerId: "p-robin" },
    { id: "rq-induction", label: "Safety induction", description: "Everyone completes the health and safety induction and renews it every three years.",
      appliesTo: "person", certificateName: "Health and safety induction", evidence: "Induction certificate, recorded in People",
      renewEveryMonths: 36, reviewerRoleIds: ["team_manager", "admin"], blocks: "Working without supervision" },
    { id: "rq-insurance", label: "Insurance certificate", description: "Suppliers hold current liability insurance before they are given new orders.",
      appliesTo: "supplier", evidence: "Current liability insurance certificate", renewEveryMonths: 12, reviewerRoleIds: ["admin"],
      ownerId: "p-robin", blocks: "New orders to this supplier" },
    { id: "rq-firecheck", label: "Fire safety inspection", description: "Each location has an inspection report from a qualified inspector, renewed every year.",
      appliesTo: "location", evidence: "Inspection report", renewEveryMonths: 12, reviewerRoleIds: ["team_manager", "admin"], ownerId: "p-robin" }
  ];
  c.standards = {
    requirements,
    checks: [
      { id: "chk-safety-walk", label: "Location safety walk", appliesTo: "location", every: "month", ownerId: "p-robin",
        checklist: ["Exits clear and signed", "Fire equipment in place and in date", "First aid kit stocked", "New hazards reported"] },
      { id: "chk-access-review", label: "Access review", appliesTo: "unit", every: "quarter", ownerId: "p-robin",
        checklist: ["Leavers have no access", "Restricted records reviewed", "Role assignments match current jobs"] }
    ],
    acknowledgePolicyIds: ["f-conduct", "f-hs"]
  };

  /* ── The canonical review form and its approval rule ── */
  c.requestForms.push({
    id: EVIDENCE_FORM, label: "Evidence review",
    description: "Review evidence received against a requirement. Approval is the decision; the evidence is accepted when the approved action runs.",
    fields: [
      { key: "obligationId", label: "Requirement record", kind: "text", required: true, material: true },
      { key: "fileId", label: "Evidence document", kind: "file", required: true, material: true },
      { key: "version", label: "Document version", kind: "number", required: true, material: true, min: 1 },
      { key: "note", label: "What was received", kind: "longtext", required: false }
    ],
    evidenceRequired: true, approvalRuleId: EVIDENCE_RULE, tasks: [],
    effect: { kind: "accept-evidence", label: "Accept the evidence" }, enabled: true
  });
  c.approvalRules.push({
    id: EVIDENCE_RULE, label: "Evidence review", formId: EVIDENCE_FORM, prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
    stages: [{ id: "st-review", label: "Evidence reviewer", eligibleRoles: ["team_manager", "admin"], scope: "requester-team" }]
  });

  /* ── Metrics and the Standards dashboard view ── */
  c.metrics.push(
    { id: "requirementsApproved", label: "Evidence approved", description: "Share of applicable requirements whose evidence has been reviewed and accepted. Not a measure of legal compliance.",
      unit: "percent", aggregation: "ratio", formula: "sum(requirements with accepted, in-date evidence) / sum(requirements that apply), subjects in scope",
      entity: "requirement", periodDays: 0, better: "up", target: 90, enabled: true },
    { id: "evidenceAwaitingReview", label: "Evidence awaiting review", description: "Evidence received or under review, not yet accepted or rejected.",
      unit: "count", aggregation: "count", formula: "count(requirements where state is received or under review)", entity: "requirement", periodDays: 0, better: "down", enabled: true },
    { id: "checksOverdue", label: "Checks overdue", description: "Repeatable checks still pending after their period ended.",
      unit: "count", aggregation: "count", formula: "count(check runs pending where due < now)", entity: "requirement", periodDays: 0, better: "down", target: 0, enabled: true }
  );
  c.dashboards.push({ id: "standards", module: "standards", label: "Standards", description: "Evidence approved, reviews waiting and overdue checks. Not a statement of legal compliance.",
    metricIds: ["requirementsApproved", "evidenceAwaitingReview", "checksOverdue", "certCompliance"], defaultForRoles: [] });

  /* ── Files used as evidence ── */
  const file = (id: string, title: string, ownerId: Id, versions: [string, string][], summary: string, extra: Partial<FileDoc> = {}): FileDoc => ({
    id, title, kind: "Evidence", ownerId, visibility: "organisation", linkedRecordIds: [], summary, sourceId: "pulse",
    versions: versions.map(([when, note], i) => ({ id: "fv-" + id + "-" + (i + 1), n: i + 1, addedAt: when, addedBy: ownerId, note, sizeKb: 60 + i * 8 })),
    ...extra
  });
  const files: FileDoc[] = [
    file("f-doc-signoff", "Rollout sign-off sheet", "p-casey", [[D("2026-03-04", 15), "Two of three signatures"], [D("2026-03-10", 9), "Signed by all unit leads"]],
      "Sign-off sheet for the document review rollout, signed by the unit leads."),
    file("f-doc-dpia", "Data protection assessment, document review rollout", "p-robin", [[D("2026-03-06", 14), "Completed assessment"]],
      "How personal information in reviewed documents is handled, with the data owner's comments."),
    file("f-fire-north", "Fire inspection report, North office", "p-casey", [[D("2025-08-20"), "Annual inspection"]], "Inspection report for the North office.",
      { unitId: "u-north", visibility: "unit" }),
    file("f-fire-south", "Fire inspection report, South office", "p-avery", [[D("2025-03-01"), "Annual inspection"]], "Inspection report for the South office, 2025.",
      { unitId: "u-south", visibility: "unit" })
  ];

  /* ── Requests and approvals for reviews already in the system ── */
  const requests: RequestItem[] = [];
  const approvals: Approval[] = [];
  const tasks: Task[] = [];
  const events: AuditEvent[] = [];
  let evN = 0;
  const ev = (when: string, actorId: Id, action: string, objectType: AuditEvent["objectType"], objectId: Id, storyKey: string, summary: string, extra: Partial<AuditEvent> = {}) =>
    events.push({ id: "e-std-" + (++evN), at: when, actorId, actorKind: actorId === "system" ? "system" : "person", action, objectType, objectId, recordIds: [], storyKey, summary, ...extra });

  const review = (n: number, o: { id: Id; label: string; fileId: Id; version: number; subject: string }, requesterId: Id, teamId: Id, reviewerId: Id,
    submitted: string, outcome: { kind: "pending" } | { kind: "approved"; at: string } | { kind: "declined"; at: string; reason: string }) => {
    const id = "req-std-" + n, apId = "ap-std-" + n;
    const unitId = c.teams.find((t) => t.id === teamId)?.unitId;
    const fields = { obligationId: o.id, fileId: o.fileId, version: o.version, note: o.label + " evidence for " + o.subject };
    const approved = outcome.kind === "approved", declined = outcome.kind === "declined";
    requests.push({
      id, ref: "REQ-" + (400 + n), formId: EVIDENCE_FORM, title: "Review " + o.label + " evidence: " + o.subject, requesterId, teamId, unitId, fields, version: 1,
      versions: [{ n: 1, fields: { ...fields }, at: submitted, by: requesterId, note: "Submitted" }],
      status: approved ? "approved" : declined ? "declined" : "submitted", evidenceFileIds: [o.fileId], linkedRecordIds: [], taskIds: [], approvalId: apId,
      execution: approved
        ? { status: "succeeded", effect: "Accepted " + o.label + " evidence for " + o.subject, attempts: 1, appliedKeys: [id + ":v1:accept-evidence"], executedAt: outcome.at }
        : { status: declined ? "not_applicable" : "not_started", effect: "Accept the evidence", attempts: 0, appliedKeys: [] },
      createdAt: submitted, updatedAt: outcome.kind === "pending" ? submitted : outcome.at, createdBy: requesterId
    });
    approvals.push({
      id: apId, requestId: id, ruleId: EVIDENCE_RULE, cycle: 1, reviewingVersion: 1, submittedAt: submitted,
      status: approved ? "approved" : declined ? "declined" : "pending", decidedAt: outcome.kind === "pending" ? undefined : outcome.at,
      decisions: outcome.kind === "pending" ? [] : [{ id: "d-std-" + n, stageId: "st-review", actorId: reviewerId, kind: approved ? "approve" : "decline",
        comment: declined ? outcome.reason : "Matches the requirement.", at: outcome.at, requestVersion: 1, cycle: 1 }],
      stages: [{ stageId: "st-review", label: "Evidence reviewer", eligibleRoles: ["team_manager", "admin"], assigneeId: reviewerId,
        status: approved ? "approved" : declined ? "declined" : "pending", startedAt: submitted, dueAt: addBusinessHours(submitted, 16, TZ) }]
    });
    ev(submitted, requesterId, "request.submitted", "request", id, "obligation:" + o.id, "Submitted REQ-" + (400 + n) + " to review " + o.label + " evidence for " + o.subject, { teamId, unitId });
    return id;
  };

  /* ── Obligations ── */
  const obligations: Obligation[] = [];

  // pr-doc: the DPIA is approved; the sign-off sheet arrived and waits for its review to start.
  const dpiaReq = review(1, { id: "ob-doc-dpia", label: "Data protection assessment", fileId: "f-doc-dpia", version: 1, subject: "Document review rollout" },
    "p-robin", "t-a", "p-jordan", D("2026-03-06", 15), { kind: "approved", at: D("2026-03-07", 11) });
  obligations.push(
    { id: "ob-doc-signoff", requirementId: "rq-signoff", subject: { kind: "project", id: "pr-doc" }, state: "received", dueAt: D("2026-03-13", 17),
      evidence: { fileId: "f-doc-signoff", version: 2, receivedAt: D("2026-03-10", 9), receivedBy: "p-casey" } },
    { id: "ob-doc-dpia", requirementId: "rq-dpia", subject: { kind: "project", id: "pr-doc" }, state: "approved", dueAt: D("2026-03-13", 17),
      evidence: { fileId: "f-doc-dpia", version: 1, receivedAt: D("2026-03-06", 14), receivedBy: "p-robin" }, requestId: dpiaReq,
      decidedAt: D("2026-03-07", 11), decidedBy: "p-jordan", expiresAt: D("2027-03-07", 11) },
    { id: "ob-svc-dpia", requirementId: "rq-dpia", subject: { kind: "project", id: "pr-svc" }, state: "missing", dueAt: D("2026-03-27", 17) },
    { id: "ob-fire-north", requirementId: "rq-firecheck", subject: { kind: "location", id: "loc-north" }, state: "approved",
      evidence: { fileId: "f-fire-north", version: 1, receivedAt: D("2025-08-20"), receivedBy: "p-casey" }, decidedAt: D("2025-08-22"), decidedBy: "p-robin", expiresAt: D("2026-08-22") },
    { id: "ob-fire-south", requirementId: "rq-firecheck", subject: { kind: "location", id: "loc-south" }, state: "expired",
      evidence: { fileId: "f-fire-south", version: 1, receivedAt: D("2025-03-01"), receivedBy: "p-avery" }, decidedAt: D("2025-03-01", 14), decidedBy: "p-robin",
      expiresAt: D("2026-03-01", 14), renewalTaskId: "t-std-1" }
  );
  ev(D("2026-03-06", 14), "p-robin", "obligation.received", "requirement", "ob-doc-dpia", "obligation:ob-doc-dpia",
    "Received Data protection assessment, document review rollout (version 1) as Data protection assessment evidence for Document review rollout. Not reviewed yet");
  ev(D("2026-03-07", 11), "p-jordan", "obligation.approved", "requirement", "ob-doc-dpia", "obligation:ob-doc-dpia",
    "Accepted Data protection assessment evidence for Document review rollout, valid to 7 Mar 2027");
  ev(D("2026-03-10", 9), "p-casey", "obligation.received", "requirement", "ob-doc-signoff", "obligation:ob-doc-signoff",
    "Received Rollout sign-off sheet (version 2) as Document sign-off evidence for Document review rollout. Not reviewed yet");
  ev(D("2026-03-10", 9), "p-casey", "project.obligation.received", "project", "pr-doc", "project:pr-doc",
    "Received Rollout sign-off sheet (version 2) as Document sign-off evidence for Document review rollout. Not reviewed yet");
  ev(D("2026-03-01", 14), "system", "obligation.expired", "requirement", "ob-fire-south", "obligation:ob-fire-south",
    "Fire safety inspection evidence for South office expired on 1 Mar", { unitId: "u-south" });

  const task = (id: Id, title: string, assigneeId: Id, teamId: Id, created: string, due: string, origin: Task["origin"], key: string, note: string, priority: Task["priority"] = "high"): Task => ({
    id, title, teamId, unitId: c.teams.find((t) => t.id === teamId)?.unitId, assigneeId, claimedAt: created, linkedRecordIds: [], priority, status: "open",
    dueAt: due, dependsOn: [], checklist: [], notes: [{ id: "n-" + id, by: "system", at: created, text: note }], evidenceFileIds: [], instanceKey: key,
    createdAt: created, createdBy: "system", slaPolicyId: "sla-task", origin
  });
  tasks.push(task("t-std-1", "Renew Fire safety inspection: South office", "p-avery", "t-c", D("2026-03-01", 14), D("2026-03-18", 17),
    { kind: "requirement", id: "ob-fire-south" }, "std:renew:ob-fire-south:" + D("2026-03-01", 14),
    "Expired on 1 Mar. Receive the renewed evidence in Standards, then start its review."));
  ev(D("2026-03-01", 14), "system", "task.created", "task", "t-std-1", "obligation:ob-fire-south", "Created task: Renew Fire safety inspection: South office for Avery Cole",
    { teamId: "t-c", unitId: "u-south" });

  // Suppliers come from the Finance and Purchasing sample when it is present.
  const sups = d.suppliers;
  const insFile = (i: number, when: string, note: string) => {
    const s = sups[i];
    const f = file("f-ins-" + s.id, "Insurance certificate, " + s.name, s.ownerId, [[when, note]], "Liability insurance certificate supplied by " + s.name + ".");
    files.push(f);
    return f.id;
  };
  sups.forEach((s, i) => {
    const id = "ob-ins-" + s.id;
    const base = { id, requirementId: "rq-insurance", subject: { kind: "supplier" as const, id: s.id } };
    if (i === 0) {
      const f = insFile(i, D("2025-09-30"), "Certificate for the year from October");
      obligations.push({ ...base, state: "approved", evidence: { fileId: f, version: 1, receivedAt: D("2025-09-30"), receivedBy: s.ownerId },
        decidedAt: D("2025-10-02"), decidedBy: "p-robin", expiresAt: D("2026-10-02") });
    } else if (i === 1) {
      const f = insFile(i, D("2026-03-09", 11), "Renewed certificate");
      const r = review(2, { id, label: "Insurance certificate", fileId: f, version: 1, subject: s.name }, "p-morgan", "t-a", "p-robin", D("2026-03-09", 15), { kind: "pending" });
      obligations.push({ ...base, state: "under_review", evidence: { fileId: f, version: 1, receivedAt: D("2026-03-09", 11), receivedBy: "p-morgan" }, requestId: r });
    } else if (i === 2) {
      const f = insFile(i, D("2026-03-03", 10), "Certificate sent by the supplier");
      const reason = "The certificate ended on 31 January 2026. Ask the supplier for the current one.";
      const r = review(3, { id, label: "Insurance certificate", fileId: f, version: 1, subject: s.name }, "p-morgan", "t-a", "p-robin", D("2026-03-03", 14),
        { kind: "declined", at: D("2026-03-04", 10), reason });
      obligations.push({ ...base, state: "rejected", evidence: { fileId: f, version: 1, receivedAt: D("2026-03-03", 10), receivedBy: "p-morgan" }, requestId: r,
        decidedAt: D("2026-03-04", 10), decidedBy: "p-robin", rejectionReason: reason });
      const team = d.employment.find((e) => e.personId === s.ownerId)?.teamId || "t-a";
      tasks.push(task("t-std-3", "Replace Insurance certificate evidence: " + s.name, s.ownerId, team, D("2026-03-04", 10), D("2026-03-13", 17),
        { kind: "requirement", id }, "std:reject:" + id + ":" + r, "Rejected by Robin Hale: " + reason, "normal"));
      ev(D("2026-03-04", 10), "p-robin", "obligation.rejected", "requirement", id, "obligation:" + id, "Rejected Insurance certificate evidence for " + s.name + ": " + reason);
    } else if (i === 3) {
      const f = insFile(i, D("2025-03-28"), "Certificate for the year from April");
      obligations.push({ ...base, state: "approved", evidence: { fileId: f, version: 1, receivedAt: D("2025-03-28"), receivedBy: s.ownerId },
        decidedAt: D("2025-03-31"), decidedBy: "p-robin", expiresAt: D("2026-03-31") });
    } else {
      obligations.push({ ...base, state: "missing" });
    }
  });

  /* Any other subject a requirement applies to gets a missing row, so the sample needs no setup step. */
  const probe = { mode: "sample" as const, config: c, data: d, seq: 0 };
  for (const req of requirements) {
    if (req.certificateName) continue;
    for (const sub of allSubjects(probe, req.appliesTo)) {
      if (!applies(req, sub) || obligations.some((o) => o.requirementId === req.id && o.subject.kind === sub.kind && o.subject.id === sub.id)) continue;
      obligations.push({ id: "ob-" + req.id.replace(/^rq-/, "") + "-" + sub.id, requirementId: req.id, subject: { kind: sub.kind, id: sub.id }, state: "missing" });
    }
  }

  /* ── Check runs ── */
  const run = (id: Id, checkId: string, every: "month" | "quarter", kind: "location" | "unit", subjectId: Id, inPeriod: string, extra: Partial<CheckRun> = {}): CheckRun => {
    const p = periodOf(every, inPeriod, TZ);
    return { id, checkId, subject: { kind, id: subjectId }, dueAt: p.dueAt, periodKey: checkRunKey(checkId, kind, subjectId, p.key), result: "pending", ...extra };
  };
  const failNote = "Fire exit on the ground floor partly blocked by stored boxes.";
  const checkRuns: CheckRun[] = [
    run("chk-1", "chk-safety-walk", "month", "location", "loc-north", D("2026-02-15"), { result: "passed", completedAt: D("2026-02-20", 11), by: "p-casey" }),
    run("chk-2", "chk-safety-walk", "month", "location", "loc-south", D("2026-02-15"), { result: "failed", completedAt: D("2026-02-24", 15), by: "p-avery", notes: failNote, followUpTaskId: "t-std-2" }),
    run("chk-3", "chk-safety-walk", "month", "location", "loc-north", D("2026-03-15")),
    run("chk-4", "chk-safety-walk", "month", "location", "loc-south", D("2026-03-15")),
    run("chk-5", "chk-access-review", "quarter", "unit", "u-north", D("2025-11-15"), { result: "passed", completedAt: D("2025-12-18", 12), by: "p-casey" }),
    run("chk-6", "chk-access-review", "quarter", "unit", "u-south", D("2025-11-15")),
    run("chk-7", "chk-access-review", "quarter", "unit", "u-north", D("2026-02-15")),
    run("chk-8", "chk-access-review", "quarter", "unit", "u-south", D("2026-02-15"))
  ];
  tasks.push(task("t-std-2", "Follow up: Location safety walk failed at South office", "p-avery", "t-c", D("2026-02-24", 15), D("2026-02-27", 17),
    { kind: "check", id: "chk-2" }, "std:check:chk-2", failNote));
  ev(D("2026-02-24", 15), "p-avery", "check.failed", "check", "chk-2", "check:chk-2", "Location safety walk (2026-02) at South office failed: " + failNote, { unitId: "u-south" });
  ev(D("2026-02-20", 11), "p-casey", "check.passed", "check", "chk-1", "check:chk-1", "Location safety walk (2026-02) at North office passed", { unitId: "u-north" });

  /* ── Policy acknowledgements ── */
  const staff = ["p-robin", "p-casey", "p-jordan", "p-riley", "p-avery", "p-morgan", "p-taylor", "p-jamie", "p-quinn", "p-drew"]
    .filter((id) => d.people.some((p) => p.id === id && p.status === "active"));
  const acks: PolicyAck[] = [];
  const ack = (fileId: Id, version: number, people: Id[], from: string) =>
    people.forEach((personId, i) => acks.push({ id: "pa-" + (acks.length + 1), fileId, version, personId, at: new Date(new Date(from).getTime() + i * 5 * H).toISOString() }));
  ack("f-conduct", 2, staff, D("2025-12-22"));
  ack("f-conduct", 3, ["p-robin", "p-casey", "p-jordan", "p-riley", "p-morgan", "p-quinn"].filter((x) => staff.includes(x)), D("2026-02-02"));
  ack("f-hs", 3, staff, D("2025-12-01"));
  ack("f-hs", 4, staff.filter((x) => x !== "p-drew"), D("2026-01-29"));

  d.files.push(...files);
  d.requests.push(...requests);
  d.approvals.push(...approvals);
  d.tasks.push(...tasks);
  d.obligations.push(...obligations);
  d.checkRuns.push(...checkRuns);
  d.policyAcks.push(...acks);
  d.events.push(...events.filter((e) => e.at <= REF));
  d.events.sort((a, b) => a.at.localeCompare(b.at));
}
