/* The configuration registry. Everything a client changes later lives here:
   labels, enabled capabilities, record types, roles, metrics, dashboard views,
   request forms, approval rules, service deadlines, workflow templates,
   sources and mappings. Pages read it; Settings edits it. */

import type { OrgConfig, RoleDef, MetricDef, DashboardDef, SlaPolicyDef, Terminology, RecordTypeDef, AgentToolDef, AgentTemplateDef, OrchestrationSettings, ProjectSettings } from "./types";

export const DEFAULT_TERMS: Terminology = {
  organisation: "Organisation",
  unit: "Unit", units: "Units",
  team: "Team", teams: "Teams",
  record: "Record", records: "Records",
  request: "Request", requests: "Requests",
  task: "Task", tasks: "Tasks"
};

/* Role names and permissions are defaults, editable per client. */
export const DEFAULT_ROLES: RoleDef[] = [
  { id: "contributor", label: "Contributor", description: "Works their own and their team's tasks and requests.",
    permissions: ["records.view", "records.edit", "views.share", "comments.write"] },
  { id: "team_manager", label: "Team manager", description: "Oversees a team or unit: assigns work, decides approvals in scope.",
    permissions: ["records.view", "records.edit", "tasks.manage", "approvals.decide", "approvals.delegate", "workflows.operate", "export", "views.share", "audit.view",
      "projects.manage", "finance.view", "purchasing.manage", "standards.review", "agents.run", "comments.write"] },
  { id: "admin", label: "Administrator", description: "Configures the organisation, structure, rules and connections.",
    permissions: ["records.view", "records.edit", "records.merge", "tasks.manage", "approvals.decide", "approvals.delegate",
      "workflows.operate", "settings.edit", "export", "audit.view", "agents.manage", "views.share",
      "projects.manage", "finance.view", "finance.manage", "purchasing.manage", "standards.review", "agents.run", "updates.publish", "comments.write"] }
];

/* Neutral measures any organisation has once work flows through Pulse. */
export const DEFAULT_METRICS: MetricDef[] = [
  { id: "backlog", label: "Open backlog", description: "Tasks not yet done or cancelled.", unit: "count", aggregation: "count",
    formula: "count(tasks where status is open, in progress or waiting)", entity: "task", periodDays: 0, better: "down", enabled: true },
  { id: "overdue", label: "Overdue tasks", description: "Open tasks past their due time.", unit: "count", aggregation: "count",
    formula: "count(open tasks where due < now)", entity: "task", periodDays: 0, better: "down", target: 0, enabled: true },
  { id: "ontime", label: "On-time completion", description: "Share of tasks completed by their due time.", unit: "percent", aggregation: "ratio",
    formula: "sum(completed on or before due) / sum(completed with a due time), over the period", entity: "task", periodDays: 30, better: "up", target: 85, enabled: true },
  { id: "turnaround", label: "Approval turnaround", description: "Median hours from submission to final decision.", unit: "hours", aggregation: "median",
    formula: "median(decided at - submitted at) for approvals decided in the period", entity: "approval", periodDays: 30, better: "down", target: 24, enabled: true },
  { id: "completeness", label: "Data completeness", description: "Required fields filled across records.", unit: "percent", aggregation: "ratio",
    formula: "sum(required fields filled) / sum(required fields), across records in scope", entity: "record", periodDays: 0, better: "up", target: 95, enabled: true },
  { id: "issues", label: "Open data issues", description: "Data-quality issues not yet resolved or dismissed.", unit: "count", aggregation: "count",
    formula: "count(issues where state is open or in progress)", entity: "issue", periodDays: 0, better: "down", enabled: true },
  { id: "staleRecords", label: "Stale source records", description: "Records whose source last synced more than 24 hours ago.", unit: "count", aggregation: "count",
    formula: "count(records with a source reference synced more than 24 h ago)", entity: "record", periodDays: 0, better: "down", target: 0, enabled: true },
  { id: "headcount", label: "Headcount", description: "People employed, excluding those who have left.", unit: "count", aggregation: "count",
    formula: "count(employment records in scope, stage not left)", entity: "person", periodDays: 0, better: "up", enabled: true },
  { id: "certCompliance", label: "Certificates in date", description: "Required certificates held and not expired.", unit: "percent", aggregation: "ratio",
    formula: "sum(certificates in date) / sum(certificates required), people past onboarding", entity: "person", periodDays: 0, better: "up", target: 95, enabled: true },
  { id: "awayToday", label: "Away today", description: "People on approved leave today.", unit: "count", aggregation: "count",
    formula: "count(approved leave covering today)", entity: "person", periodDays: 0, better: "down", enabled: true },
  { id: "approvedValue", label: "Approved request value", description: "Sum of the configured value field on approved requests. Shown only when a currency field is configured.",
    unit: "money", currency: "EUR", aggregation: "sum",
    formula: "sum(value) of requests approved in the period, single currency only", entity: "request", periodDays: 30, better: "up", enabled: false }
];

export const DEFAULT_DASHBOARDS: DashboardDef[] = [
  { id: "overview", label: "Overview", description: "Flow of work, decisions and data health.",
    metricIds: ["backlog", "overdue", "ontime", "turnaround", "completeness"], defaultForRoles: ["admin", "team_manager"] },
  { id: "delivery", label: "Delivery", description: "Throughput and lateness of tasks.",
    metricIds: ["backlog", "overdue", "ontime"], defaultForRoles: ["contributor"] },
  { id: "people", label: "People", description: "Headcount, certificates and who is away.",
    metricIds: ["headcount", "certCompliance", "awayToday", "overdue"], defaultForRoles: [] },
  { id: "data", label: "Data quality", description: "Completeness, open issues and stale sources.",
    metricIds: ["completeness", "issues", "staleRecords"], defaultForRoles: [] }
];

export const DEFAULT_SLAS: SlaPolicyDef[] = [
  { id: "sla-standard", label: "Standard decision", targetHours: 16, calendar: "business", businessHours: "09:00-17:00, Monday to Friday",
    pauseWhenWaiting: true, remindAtPercent: 75, escalateToRole: "admin" },
  { id: "sla-task", label: "Standard task", targetHours: 40, calendar: "business", businessHours: "09:00-17:00, Monday to Friday",
    pauseWhenWaiting: true, remindAtPercent: 80, escalateToRole: "team_manager" }
];

/* One generic record type so a clean template is usable before configuration. */
export const GENERIC_RECORD: RecordTypeDef = {
  id: "record", label: "Record", plural: "Records", defaultVisibility: "team",
  fields: [
    { key: "reference", label: "Reference", kind: "text", required: true },
    { key: "category", label: "Category", kind: "select", required: true, options: [
      { value: "general", label: "General" }, { value: "review", label: "Review" }, { value: "other", label: "Other" }] },
    { key: "reviewDate", label: "Review date", kind: "date", required: true },
    { key: "contactEmail", label: "Contact email", kind: "email", required: false, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }
  ],
  statuses: [
    { id: "active", label: "Active", tone: "ok" },
    { id: "review", label: "In review", tone: "warn" },
    { id: "closed", label: "Closed", tone: "neutral", closed: true }
  ]
};

/* Tools an agent can be given. Restricted tools always wait for a human
   approval in Work; external tools stay unavailable until their source is connected. */
export const DEFAULT_AGENT_TOOLS: AgentToolDef[] = [
  { id: "read.records", label: "Read records", description: "Look up records, fields and relationships in scope.", effect: "read", restricted: false },
  { id: "read.files", label: "Read documents", description: "Read permitted documents and cite the version used.", effect: "read", restricted: false },
  { id: "read.work", label: "Read work", description: "Read tasks, requests, approvals and runs in scope.", effect: "read", restricted: false },
  { id: "write.task", label: "Create tasks", description: "Create or update tasks in Work.", effect: "write", restricted: false },
  { id: "write.request", label: "Draft requests", description: "Draft a request for a person to submit.", effect: "write", restricted: false },
  { id: "write.record", label: "Correct record fields", description: "Change a record field.", effect: "write", restricted: true },
  { id: "write.issue", label: "Resolve data issues", description: "Resolve a data-quality issue.", effect: "write", restricted: true },
  { id: "project.update", label: "Draft project updates", description: "Write a dated progress update for an owner to post.", effect: "write", restricted: false, module: "projects" },
  { id: "project.milestone", label: "Propose milestone changes", description: "Propose a new milestone date.", effect: "write", restricted: true, module: "projects" },
  { id: "finance.read", label: "Read budgets and invoices", description: "Read budgets, payables and receivables.", effect: "read", restricted: false, module: "finance" },
  { id: "purchasing.match", label: "Match invoices", description: "Compare invoices with orders and receipts and flag differences.", effect: "write", restricted: false, module: "purchasing" },
  { id: "standards.precheck", label: "Pre-check evidence", description: "Compare received evidence with its requirement. Never accepts it.", effect: "read", restricted: false, module: "standards" },
  { id: "updates.draft", label: "Draft company updates", description: "Draft a recap for an authorised person to publish.", effect: "write", restricted: false },
  { id: "notify.email", label: "Send email", description: "Send an email from the organisation.", effect: "external", restricted: true, requiresSourceId: "s-email" }
];

/* Reusable capabilities, not departmental job titles. */
export const DEFAULT_AGENT_TEMPLATES: AgentTemplateDef[] = [
  { id: "tpl-briefing", label: "Briefing", description: "Summarises what changed in a scope and links the evidence.",
    inputs: ["Scope", "Period"], outputs: ["Briefing with links"], tools: ["read.records", "read.work", "read.files"], defaultTrigger: { kind: "schedule", detail: "Weekdays 07:30" }, workerOk: false },
  { id: "tpl-coordination", label: "Work coordination", description: "Accepts a goal, splits it into subtasks and routes them to capability agents.",
    inputs: ["Goal", "Scope"], outputs: ["Combined outcome with evidence"], tools: ["read.work", "write.task"], defaultTrigger: { kind: "manual", detail: "Started by a person" }, workerOk: false },
  { id: "tpl-project", label: "Project monitoring", description: "Watches milestones, dependencies and risks and drafts updates.",
    inputs: ["Project"], outputs: ["Risk notes", "Draft update"], tools: ["read.work", "read.records", "project.update", "project.milestone"], defaultTrigger: { kind: "event", detail: "When a milestone moves" }, workerOk: true, module: "projects" },
  { id: "tpl-docreview", label: "Document review", description: "Checks a document against its requirement and lists gaps for a reviewer.",
    inputs: ["Document", "Requirement"], outputs: ["Gap list"], tools: ["read.files", "standards.precheck"], defaultTrigger: { kind: "delegated", detail: "Delegated by a coordinator" }, workerOk: true },
  { id: "tpl-quality", label: "Data quality", description: "Finds missing, duplicate and conflicting data and proposes fixes.",
    inputs: ["Record type", "Scope"], outputs: ["Issues", "Proposed corrections"], tools: ["read.records", "write.task", "write.issue"], defaultTrigger: { kind: "schedule", detail: "Daily 06:00" }, workerOk: true },
  { id: "tpl-triage", label: "Request triage", description: "Reads new requests, checks evidence and routes them to the right queue.",
    inputs: ["Request"], outputs: ["Routing note", "Missing evidence list"], tools: ["read.work", "write.task", "write.request"], defaultTrigger: { kind: "event", detail: "When a request is submitted" }, workerOk: true }
];

export const DEFAULT_ORCHESTRATION: OrchestrationSettings = {
  adapter: "sample",
  connectionRequirement: "No agent runtime is connected. Runs use the local sample engine and are marked Simulated. To run agents for real, connect a runtime in Settings, Systems, Connections; provider keys are held server-side, never in the browser or in agent instructions.",
  defaultLimits: { maxDepth: 2, maxChildren: 3, maxConcurrentRuns: 2, maxMinutes: 15 },
  ceiling: { maxDepth: 3, maxChildren: 5, maxConcurrentRuns: 5, maxMinutes: 60 }
};

export const DEFAULT_PROJECTS: ProjectSettings = {
  label: "Project", plural: "Projects",
  types: [{ id: "standard", label: "Standard", phases: [
    { id: "initiate", label: "Initiate" }, { id: "plan", label: "Plan" }, { id: "deliver", label: "Deliver" }, { id: "close", label: "Close" }], fields: [] }],
  templates: [],
  progressBasis: "milestones",
  atRiskSlipDays: 5,
  cascadeMilestoneMoves: false
};

export function baseConfig(): OrgConfig {
  return {
    workspace: { id: "workspace", name: "Your organisation", shortName: "YO" },
    referenceDate: new Date().toISOString(),
    timezone: "UTC",
    terminology: { ...DEFAULT_TERMS },
    capabilities: { approvals: true, workflows: true, schedules: true, dataQuality: true, files: true,
      contacts: true, ontology: true, agents: true, units: false, reportSchedules: true },
    units: [],
    teams: [],
    roles: DEFAULT_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] })),
    recordTypes: [structuredClone(GENERIC_RECORD)],
    metrics: DEFAULT_METRICS.map((m) => ({ ...m })),
    dashboards: DEFAULT_DASHBOARDS.map((d) => ({ ...d, metricIds: [...d.metricIds] })),
    requestForms: [],
    approvalRules: [],
    slaPolicies: DEFAULT_SLAS.map((p) => ({ ...p })),
    workflowTemplates: [],
    notificationRoutes: [
      { id: "nr-approval", event: "approval.pending", label: "Decision waiting", channel: "in-app", recipients: "Current stage owner" },
      { id: "nr-overdue", event: "task.overdue", label: "Task overdue", channel: "in-app", recipients: "Assignee, then team manager" },
      { id: "nr-failed", event: "run.failed", label: "Workflow run failed", channel: "in-app", recipients: "Run owner" },
      { id: "nr-email", event: "approval.escalated", label: "Decision escalated", channel: "email", recipients: "Escalation owner" }
    ],
    sources: [
      { id: "pulse", label: "Pulse (entered here)", kind: "pulse", connected: true, prerequisite: "" }
    ],
    fieldMappings: [],
    codeMappings: [],
    agents: [],
    roleLayouts: {
      contributor: { homeView: "personal", dashboardId: "delivery" },
      team_manager: { homeView: "management", dashboardId: "overview" },
      admin: { homeView: "management", dashboardId: "overview" }
    },
    density: "comfortable",
    governance: { auditRetentionDays: 730, exportRequiresPermission: true, restrictedDocsInAnswers: false, reviewDocumentsEveryDays: 365 },
    people: {
      requiredCertifications: [],
      onboardingChecklist: ["Contract signed", "Accounts and access set up", "Introductions to the team", "First week check-in"],
      offboardingChecklist: ["Handover notes written", "Open work reassigned", "Access removed", "Equipment returned"],
      probationMonths: 6,
      accessReviewEveryDays: 180
    },
    /* Projects and People are on in the shared build; the rest are opt-in. */
    modules: {
      projects: { enabled: true }, people: { enabled: true },
      finance: { enabled: false }, purchasing: { enabled: false }, standards: { enabled: false }
    },
    locations: [],
    projects: structuredClone(DEFAULT_PROJECTS),
    finance: { reportingCurrency: "EUR" },
    purchasing: { tolerancePercent: 2, requireReceipt: true },
    standards: { requirements: [], checks: [], acknowledgePolicyIds: [] },
    agentTools: DEFAULT_AGENT_TOOLS.map((t) => ({ ...t })),
    agentTemplates: structuredClone(DEFAULT_AGENT_TEMPLATES),
    orchestration: structuredClone(DEFAULT_ORCHESTRATION)
  };
}

export const term = (c: OrgConfig, k: keyof OrgConfig["terminology"]) => c.terminology[k];
