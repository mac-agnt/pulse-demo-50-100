/* The configuration registry. Everything a client changes later lives here:
   labels, enabled capabilities, record types, roles, metrics, dashboard views,
   request forms, approval rules, service deadlines, workflow templates,
   sources and mappings. Pages read it; Settings edits it. */

import type { OrgConfig, RoleDef, MetricDef, DashboardDef, SlaPolicyDef, Terminology, RecordTypeDef } from "./types";

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
    permissions: ["records.view", "records.edit", "views.share"] },
  { id: "team_manager", label: "Team manager", description: "Oversees a team or unit: assigns work, decides approvals in scope.",
    permissions: ["records.view", "records.edit", "tasks.manage", "approvals.decide", "approvals.delegate", "workflows.operate", "export", "views.share", "audit.view"] },
  { id: "admin", label: "Administrator", description: "Configures the organisation, structure, rules and connections.",
    permissions: ["records.view", "records.edit", "records.merge", "tasks.manage", "approvals.decide", "approvals.delegate",
      "workflows.operate", "settings.edit", "export", "audit.view", "agents.manage", "views.share"] }
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
    }
  };
}

export const term = (c: OrgConfig, k: keyof OrgConfig["terminology"]) => c.terminology[k];
