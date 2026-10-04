/* Sample projects, milestones, risks, project updates and project tasks. Removable with the rest of the sample fixture layer.
   applyProjects() receives the sample config and data after the base sample is
   built and adds this module's rows and configuration to them.

   Three generic projects (ids are shared with the other modules):
   - pr-svc  Service improvement, Team A. Next milestone already slipped 7 days; owner still reports on track.
   - pr-ws   Workspace upgrade, Unit North (budget bg-ws). On track; ms-ws-2 is the milestone to move, ms-ws-3 depends on it.
   - pr-doc  Document review rollout, organisation-wide. ms-doc-2 is gated on ob-doc-signoff + ob-doc-dpia (Standards). */

import type { AuditEvent, CoreData, Milestone, OrgConfig, Project, ProjectRisk, ProjectTemplateDef, Task } from "../types";

const REF = "2026-03-11T10:00:00.000Z";
/** A sample day (the sample timezone is UTC) at 17:00, or another hour. */
const D = (ymd: string, h = 17) => ymd + "T" + String(h).padStart(2, "0") + ":00:00.000Z";

const TPL_ROLLOUT: ProjectTemplateDef = {
  id: "tpl-rollout", label: "Standard rollout", typeId: "rollout", version: 2, durationDays: 88,
  description: "Plan, approve with sign-off evidence, roll out to every team, then review adoption.",
  milestones: [
    { key: "plan", label: "Plan agreed", phaseId: "plan", offsetDays: 10 },
    { key: "approved", label: "Rollout approved", phaseId: "approve", offsetDays: 25, dependsOn: ["plan"],
      gate: { label: "Sign-off evidence accepted", requirementIds: ["rq-signoff", "rq-dpia"] } },
    { key: "live", label: "Live in all teams", phaseId: "rollout", offsetDays: 55, dependsOn: ["approved"] },
    { key: "embedded", label: "Embedded and reviewed", phaseId: "embed", offsetDays: 88, dependsOn: ["live"] }
  ],
  tasks: [
    { key: "scope", title: "Agree scope and owners", phaseId: "plan", offsetDays: 0, durationDays: 5, estimateHours: 3, milestoneKey: "plan" },
    { key: "plan", title: "Draft the rollout plan", phaseId: "plan", offsetDays: 3, durationDays: 6, estimateHours: 6, milestoneKey: "plan", dependsOn: ["scope"] },
    { key: "signoff", title: "Collect sign-off from unit leads", phaseId: "approve", offsetDays: 11, durationDays: 10, estimateHours: 2, milestoneKey: "approved" },
    { key: "dpia", title: "Complete data protection assessment", phaseId: "approve", offsetDays: 11, durationDays: 12, estimateHours: 8, milestoneKey: "approved" },
    { key: "brief-prep", title: "Prepare team briefings", phaseId: "rollout", offsetDays: 26, durationDays: 10, milestoneKey: "live", dependsOn: ["signoff"] },
    { key: "brief-run", title: "Run team briefings", phaseId: "rollout", offsetDays: 36, durationDays: 15, estimateHours: 12, milestoneKey: "live", dependsOn: ["brief-prep"] },
    { key: "review", title: "Review adoption after one month", phaseId: "embed", offsetDays: 60, durationDays: 20, milestoneKey: "embedded" }
  ]
};

const TPL_IMPROVEMENT: ProjectTemplateDef = {
  id: "tpl-improvement", label: "Service improvement", typeId: "improvement", version: 1, durationDays: 130,
  description: "Map the current service, agree a new process, pilot it with one team and review the results.",
  milestones: [
    { key: "mapped", label: "Current service mapped", phaseId: "discover", offsetDays: 18 },
    { key: "agreed", label: "New process agreed", phaseId: "design", offsetDays: 53, dependsOn: ["mapped"] },
    { key: "pilot", label: "Pilot running", phaseId: "deliver", offsetDays: 88, dependsOn: ["agreed"] },
    { key: "review", label: "Review complete", phaseId: "review", offsetDays: 130, dependsOn: ["pilot"] }
  ],
  tasks: [
    { key: "map", title: "Map the current steps", phaseId: "discover", offsetDays: 0, durationDays: 14, estimateHours: 6, milestoneKey: "mapped" },
    { key: "interview", title: "Interview the people doing the work", phaseId: "discover", offsetDays: 2, durationDays: 14, estimateHours: 8, milestoneKey: "mapped" },
    { key: "draft", title: "Draft the new process", phaseId: "design", offsetDays: 20, durationDays: 25, estimateHours: 12, milestoneKey: "agreed", dependsOn: ["map"] },
    { key: "agree", title: "Agree the new process with the team", phaseId: "design", offsetDays: 45, durationDays: 7, estimateHours: 3, milestoneKey: "agreed", dependsOn: ["draft"] },
    { key: "pilot", title: "Prepare the pilot briefing", phaseId: "deliver", offsetDays: 55, durationDays: 25, milestoneKey: "pilot", dependsOn: ["agree"] },
    { key: "measure", title: "Measure the pilot against the baseline", phaseId: "review", offsetDays: 95, durationDays: 30, milestoneKey: "review" }
  ]
};

const PROJECTS: Project[] = [
  { id: "pr-svc", ref: "PRJ-101", title: "Service improvement", typeId: "improvement",
    objective: "Shorten the time from first contact to a resolved request by redesigning the intake process with Team A.",
    ownerId: "p-jordan", teamId: "t-a", unitId: "u-north", phaseId: "design", status: "active", startDate: D("2026-01-19", 9), endDate: D("2026-05-29"),
    reportedHealth: "on_track", fields: {}, template: { id: "tpl-improvement", version: 1 }, budgetId: "bg-svc", visibility: "team",
    createdAt: D("2026-01-16", 11), updatedAt: D("2026-03-06", 15), fileIds: ["f-service"] },
  { id: "pr-ws", ref: "PRJ-102", title: "Workspace upgrade", typeId: "facilities",
    objective: "Bring Team A and Team B onto one upgraded floor in the North office without a break in service.",
    ownerId: "p-casey", unitId: "u-north", locationId: "loc-north", phaseId: "prepare", status: "active", startDate: D("2026-02-02", 9), endDate: D("2026-04-30"),
    reportedHealth: "on_track", fields: {}, budgetId: "bg-ws", visibility: "unit",
    createdAt: D("2026-01-28", 10), updatedAt: D("2026-03-09", 16), fileIds: ["f-hs"] },
  { id: "pr-doc", ref: "PRJ-103", title: "Document review rollout", typeId: "rollout",
    objective: "Every team reviews and approves documents the same way, with sign-off evidence kept for each review.",
    ownerId: "p-robin", phaseId: "approve", status: "active", startDate: D("2026-02-16", 9), endDate: D("2026-05-15"),
    reportedHealth: "at_risk", fields: {}, template: { id: "tpl-rollout", version: 1 }, visibility: "organisation",
    createdAt: D("2026-02-13", 14), updatedAt: D("2026-03-10", 12), fileIds: ["f-procedure", "f-handbook"] }
];

const M = (id: string, projectId: string, label: string, phaseId: string, due: string, extra: Partial<Milestone> = {}): Milestone =>
  ({ id, projectId, label, phaseId, dueAt: D(due), baselineAt: D(due), dependsOn: [], ...extra });

const MILESTONES: Milestone[] = [
  M("ms-svc-1", "pr-svc", "Current service mapped", "discover", "2026-02-06", { completedAt: D("2026-02-05", 15) }),
  // Slipped a week from its baseline: the computed health flags it even though the owner reports on track.
  M("ms-svc-2", "pr-svc", "New process agreed", "design", "2026-03-20", { baselineAt: D("2026-03-13"), dependsOn: ["ms-svc-1"] }),
  M("ms-svc-3", "pr-svc", "Pilot running", "deliver", "2026-04-17", { dependsOn: ["ms-svc-2"] }),
  M("ms-svc-4", "pr-svc", "Review complete", "review", "2026-05-29", { dependsOn: ["ms-svc-3"] }),

  M("ms-ws-1", "pr-ws", "Layout signed off", "scope", "2026-02-20", { completedAt: D("2026-02-19", 12) }),
  M("ms-ws-2", "pr-ws", "Fit-out complete", "prepare", "2026-03-27", { dependsOn: ["ms-ws-1"] }),
  M("ms-ws-3", "pr-ws", "Teams moved in", "move", "2026-04-10", { dependsOn: ["ms-ws-2"] }),
  M("ms-ws-4", "pr-ws", "Old space handed back", "close", "2026-04-30", { dependsOn: ["ms-ws-3"] }),

  M("ms-doc-1", "pr-doc", "Plan agreed", "plan", "2026-02-26", { completedAt: D("2026-02-26", 11) }),
  M("ms-doc-2", "pr-doc", "Rollout approved", "approve", "2026-03-13", { dependsOn: ["ms-doc-1"],
    gate: { label: "Sign-off evidence accepted", obligationIds: ["ob-doc-signoff", "ob-doc-dpia"] } }),
  M("ms-doc-3", "pr-doc", "Live in all teams", "rollout", "2026-04-10", { dependsOn: ["ms-doc-2"] }),
  M("ms-doc-4", "pr-doc", "Embedded and reviewed", "embed", "2026-05-15", { dependsOn: ["ms-doc-3"] })
];

function T(id: string, title: string, projectId: string, milestoneId: string, phaseId: string, teamId: string | undefined, assigneeId: string | null,
  o: { due: string; start?: string; est?: number; done?: string; status?: Task["status"]; deps?: string[]; tpl?: string }): Task {
  const unitId = teamId === "t-c" ? "u-south" : teamId ? "u-north" : undefined;
  const status = o.done ? "done" : o.status || "open";
  return {
    id, title, teamId, unitId, assigneeId, claimedAt: assigneeId ? D("2026-02-20", 9) : undefined, linkedRecordIds: [], priority: "normal", status,
    dueAt: D(o.due), startAt: o.start ? D(o.start, 9) : undefined, completedAt: o.done ? D(o.done, 15) : undefined,
    dependsOn: o.deps || [], checklist: [], notes: [], evidenceFileIds: [], createdAt: D("2026-02-02", 9), createdBy: assigneeId || "p-robin",
    slaPolicyId: "sla-task", projectId, milestoneId, phaseId, estimateHours: o.est,
    origin: o.tpl ? { kind: "project-template", id: o.tpl } : undefined
  };
}

const TASKS: Task[] = [
  T("t-svc-1", "Map the current intake steps", "pr-svc", "ms-svc-1", "discover", "t-a", "p-morgan", { start: "2026-01-19", due: "2026-02-04", est: 6, done: "2026-02-04", tpl: "tpl-improvement" }),
  T("t-svc-2", "Interview front-line staff", "pr-svc", "ms-svc-1", "discover", "t-a", "p-taylor", { start: "2026-01-21", due: "2026-02-05", est: 8, done: "2026-02-05", tpl: "tpl-improvement" }),
  T("t-svc-3", "Draft the new intake process", "pr-svc", "ms-svc-2", "design", "t-a", "p-morgan", { start: "2026-02-09", due: "2026-03-13", est: 12, status: "in_progress", deps: ["t-svc-1"], tpl: "tpl-improvement" }),
  T("t-svc-4", "Agree the new process with Team A", "pr-svc", "ms-svc-2", "design", "t-a", "p-casey", { start: "2026-03-13", due: "2026-03-18", est: 3, deps: ["t-svc-3"], tpl: "tpl-improvement" }),
  T("t-svc-5", "Prepare the pilot briefing", "pr-svc", "ms-svc-3", "deliver", "t-a", "p-taylor", { start: "2026-03-23", due: "2026-04-08", deps: ["t-svc-4"], tpl: "tpl-improvement" }),
  T("t-svc-6", "Set up the pilot feedback form", "pr-svc", "ms-svc-3", "deliver", "t-a", null, { start: "2026-03-02", due: "2026-03-10" }),

  T("t-ws-1", "Agree the floor layout", "pr-ws", "ms-ws-1", "scope", "t-a", "p-casey", { start: "2026-02-02", due: "2026-02-18", est: 4, done: "2026-02-18" }),
  T("t-ws-2", "Confirm the furniture delivery date", "pr-ws", "ms-ws-2", "prepare", "t-a", "p-casey", { start: "2026-03-09", due: "2026-03-16", est: 2 }),
  T("t-ws-3", "Check network points on the new floor", "pr-ws", "ms-ws-2", "prepare", "t-b", "p-riley", { start: "2026-03-09", due: "2026-03-20", est: 4, status: "in_progress" }),
  T("t-ws-4", "Plan the move schedule", "pr-ws", "ms-ws-3", "move", "t-a", "p-taylor", { start: "2026-03-23", due: "2026-04-03", est: 6, deps: ["t-ws-2"] }),
  T("t-ws-5", "Brief Team A and Team B on the move", "pr-ws", "ms-ws-3", "move", "t-a", "p-casey", { start: "2026-04-01", due: "2026-04-08", deps: ["t-ws-4"] }),
  T("t-ws-6", "Return keys and access cards for the old space", "pr-ws", "ms-ws-4", "close", "t-b", null, { start: "2026-04-20", due: "2026-04-29" }),

  T("t-doc-1", "Agree scope and owners", "pr-doc", "ms-doc-1", "plan", "t-a", "p-robin", { start: "2026-02-16", due: "2026-02-21", est: 3, done: "2026-02-20", tpl: "tpl-rollout" }),
  T("t-doc-2", "Collect sign-off from unit leads", "pr-doc", "ms-doc-2", "approve", "t-a", "p-casey", { start: "2026-02-27", due: "2026-03-12", est: 2, status: "in_progress", tpl: "tpl-rollout" }),
  T("t-doc-3", "Complete data protection assessment", "pr-doc", "ms-doc-2", "approve", "t-a", "p-robin", { start: "2026-02-27", due: "2026-03-10", est: 8, done: "2026-03-06", tpl: "tpl-rollout" }),
  T("t-doc-4", "Prepare team briefings", "pr-doc", "ms-doc-3", "rollout", "t-c", "p-avery", { start: "2026-03-16", due: "2026-03-27", deps: ["t-doc-2"], tpl: "tpl-rollout" }),
  T("t-doc-5", "Update the review procedure", "pr-doc", "ms-doc-3", "rollout", "t-a", "p-jordan", { start: "2026-03-16", due: "2026-04-01", est: 4 }),
  T("t-doc-6", "Run team briefings", "pr-doc", "ms-doc-3", "rollout", "t-b", null, { start: "2026-03-30", due: "2026-04-09", est: 12, deps: ["t-doc-4"], tpl: "tpl-rollout" })
];

const R = (id: string, projectId: string, kind: ProjectRisk["kind"], title: string, severity: ProjectRisk["severity"], ownerId: string, impact: string, nextAction: string,
  state: ProjectRisk["state"], created: string, requestId?: string): ProjectRisk => ({ id, projectId, kind, title, severity, impact, ownerId, nextAction, state, requestId, createdAt: D(created, 10) });

const RISKS: ProjectRisk[] = [
  R("rk-svc-1", "pr-svc", "risk", "Request volumes rise during the pilot", "medium", "p-jordan",
    "The pilot may be judged on an unusual week.", "Compare pilot weeks with the same weeks last year.", "open", "2026-02-12"),
  R("rk-svc-2", "pr-svc", "decision", "Pilot with Team A only before other teams", "low", "p-jordan",
    "Team B and Team C keep the current process until the review.", "Review after four weeks of the pilot.", "closed", "2026-02-24"),
  R("rk-ws-1", "pr-ws", "risk", "Access cards for the new floor may not arrive before the move", "medium", "p-casey",
    "People could not enter the new floor on move day.", "Get a decision on REQ-203 this week.", "open", "2026-03-04", "req-3"),
  R("rk-ws-2", "pr-ws", "decision", "Team B keeps the desks by the windows", "low", "p-casey",
    "Seating plan fixed for the move schedule.", "None", "closed", "2026-02-19"),
  R("rk-doc-1", "pr-doc", "issue", "One unit has not named a briefing lead", "low", "p-avery",
    "Briefings in Unit South could start late.", "Avery to name a lead by 18 March.", "open", "2026-03-09")
];

export function applyProjects(c: OrgConfig, d: CoreData): void {
  c.projects = {
    label: "Project", plural: "Projects",
    types: [
      { id: "improvement", label: "Improvement", fields: [], phases: [
        { id: "discover", label: "Discover" }, { id: "design", label: "Design" }, { id: "deliver", label: "Deliver" }, { id: "review", label: "Review" }] },
      { id: "facilities", label: "Facilities", fields: [], phases: [
        { id: "scope", label: "Scope" }, { id: "prepare", label: "Prepare" }, { id: "move", label: "Move" }, { id: "close", label: "Close" }] },
      { id: "rollout", label: "Rollout", fields: [], phases: [
        { id: "plan", label: "Plan" }, { id: "approve", label: "Approve" }, { id: "rollout", label: "Roll out" }, { id: "embed", label: "Embed" }] }
    ],
    templates: [structuredClone(TPL_ROLLOUT), structuredClone(TPL_IMPROVEMENT)],
    progressBasis: "milestones",
    atRiskSlipDays: 5,
    cascadeMilestoneMoves: false
  };

  /* Canonical change request for milestone moves the viewer cannot make directly. */
  c.requestForms.push({
    id: "form-milestone-change", label: "Milestone change", description: "Ask to move a milestone date when you are not its owner, or when the new date is after the end date.",
    fields: [
      { key: "projectId", label: "Project", kind: "text", required: true, material: true, help: "Filled in from the project plan." },
      { key: "milestoneId", label: "Milestone", kind: "text", required: true, material: true, help: "Filled in from the project plan." },
      { key: "newDate", label: "New date", kind: "date", required: true, material: true },
      { key: "reason", label: "Reason", kind: "longtext", required: true }
    ],
    evidenceRequired: false, approvalRuleId: "rule-milestone-change", tasks: [],
    effect: { kind: "change-milestone", label: "Move the milestone, and the end date if the new date is later" }, enabled: true
  });
  c.approvalRules.push({
    id: "rule-milestone-change", label: "Milestone change", formId: "form-milestone-change", prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
    stages: [{ id: "st-lead", label: "Unit lead", eligibleRoles: ["team_manager", "admin"], scope: "requester-unit" }]
  });

  c.metrics.push(
    { id: "projectsAtRisk", label: "Projects at risk", description: "Active projects whose computed health is at risk or off track.", unit: "count", aggregation: "count",
      formula: "count(active projects where computed health is at risk or off track)", entity: "project", periodDays: 0, better: "down", target: 0, enabled: true },
    { id: "milestonesOnTime", label: "Next milestones on schedule", description: "Share of active projects whose next milestone is not overdue and has not slipped past the at-risk threshold.",
      unit: "percent", aggregation: "ratio", formula: "sum(projects whose next milestone is on schedule) / sum(active projects with an open milestone)",
      entity: "project", periodDays: 0, better: "up", target: 80, enabled: true }
  );
  c.dashboards.push({ id: "projects", module: "projects", label: "Projects", description: "Projects at risk, milestone schedule and the work behind them.",
    metricIds: ["projectsAtRisk", "milestonesOnTime", "overdue", "backlog"], defaultForRoles: [] });

  d.projects.push(...structuredClone(PROJECTS));
  d.milestones.push(...structuredClone(MILESTONES));
  d.tasks.push(...structuredClone(TASKS));
  d.risks.push(...structuredClone(RISKS));
  d.projectUpdates.push(
    { id: "pu-ws-1", projectId: "pr-ws", at: D("2026-02-23", 16), by: "p-casey", health: "on_track", text: "Layout signed off with both team managers. Furniture order is next." },
    { id: "pu-svc-1", projectId: "pr-svc", at: D("2026-03-06", 15), by: "p-jordan", health: "on_track",
      text: "Mapping is done. Morgan has the process draft; agreeing it with Team A moved a week to fit the team meeting." },
    { id: "pu-ws-2", projectId: "pr-ws", at: D("2026-03-09", 16), by: "p-casey", health: "on_track",
      text: "Furniture is ordered; the delivery date is not confirmed yet. Network check on the new floor starts this week." },
    { id: "pu-doc-1", projectId: "pr-doc", at: D("2026-03-10", 12), by: "p-robin", health: "at_risk",
      text: "Data protection assessment is approved. The unit leads' sign-off file arrived yesterday and still needs review before Friday's approval." }
  );
  d.comments.push(
    { id: "cm-pr-1", objectType: "project", objectId: "pr-ws", by: "p-riley", at: D("2026-03-10", 9), text: "@Casey Lund the network survey is booked for Thursday morning.", mentions: ["p-casey"] },
    { id: "cm-pr-2", objectType: "project", objectId: "pr-doc", by: "p-casey", at: D("2026-03-10", 14), text: "@Robin Hale the sign-off file is in. Can it be reviewed before Friday?", mentions: ["p-robin"] },
    { id: "cm-pr-3", objectType: "project", objectId: "pr-svc", by: "p-morgan", at: D("2026-03-09", 11), text: "Draft is nearly there. Two steps still need a decision from Jordan.", mentions: [] }
  );

  /* Past story events, so Activity and each project's history have a beginning. */
  const ev: AuditEvent[] = [];
  const push = (id: string, at: string, actorId: string, action: string, objectType: AuditEvent["objectType"], objectId: string, p: Project, summary: string) =>
    ev.push({ id, at, actorId, actorKind: "person", action, objectType, objectId, recordIds: [], summary, teamId: p.teamId, unitId: p.unitId, storyKey: "project:" + p.id });
  const [svc, ws, doc] = PROJECTS;
  push("e-prj-1", svc.createdAt, "p-jordan", "project.created", "project", "pr-svc", svc, "Created PRJ-101 “Service improvement” from template “Service improvement” version 1");
  push("e-prj-2", ws.createdAt, "p-casey", "project.created", "project", "pr-ws", ws, "Created PRJ-102 “Workspace upgrade”");
  push("e-prj-3", doc.createdAt, "p-robin", "project.created", "project", "pr-doc", doc, "Created PRJ-103 “Document review rollout” from template “Standard rollout” version 1");
  push("e-prj-4", D("2026-02-05", 15), "p-jordan", "milestone.completed", "milestone", "ms-svc-1", svc, "Completed “Current service mapped”.");
  push("e-prj-5", D("2026-02-19", 12), "p-casey", "milestone.completed", "milestone", "ms-ws-1", ws, "Completed “Layout signed off”.");
  push("e-prj-6", D("2026-02-26", 11), "p-robin", "milestone.completed", "milestone", "ms-doc-1", doc, "Completed “Plan agreed”.");
  ev.push({ id: "e-prj-7", at: D("2026-03-02", 10), actorId: "p-jordan", actorKind: "person", action: "milestone.moved", objectType: "milestone", objectId: "ms-svc-2", recordIds: [],
    summary: "Moved “New process agreed” from 13 Mar to 20 Mar (+7 days). Dependants not moved (proposed only): “Pilot running”. Reason: fit the Team A meeting.",
    before: { dueAt: D("2026-03-13") }, after: { dueAt: D("2026-03-20") }, teamId: "t-a", unitId: "u-north", storyKey: "project:pr-svc" });
  push("e-prj-8", D("2026-03-06", 15), "p-jordan", "project.update.posted", "update", "pu-svc-1", svc, "Posted an update on PRJ-101 (reported on track)");
  push("e-prj-9", D("2026-03-09", 16), "p-casey", "project.update.posted", "update", "pu-ws-2", ws, "Posted an update on PRJ-102 (reported on track)");
  push("e-prj-10", D("2026-03-10", 12), "p-robin", "project.update.posted", "update", "pu-doc-1", doc, "Posted an update on PRJ-103 (reported at risk)");
  d.events.push(...ev.filter((e) => e.at <= REF));
  d.events.sort((a, b) => a.at.localeCompare(b.at));
}
