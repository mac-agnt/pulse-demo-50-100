/* Shared, industry-agnostic model for Pulse.
   Everything a page shows comes from these entities through the query layer.
   IDs are stable strings; display names are never used as keys. */

export type ISO = string;
export type Id = string;

/* ── Configuration ─────────────────────────────────────────────────────── */

export type Permission =
  | "records.view" | "records.edit" | "records.merge"
  | "tasks.manage" | "approvals.decide" | "approvals.delegate"
  | "workflows.operate" | "settings.edit" | "export" | "audit.view"
  | "agents.manage" | "views.share";

export type Capability =
  | "approvals" | "workflows" | "schedules" | "dataQuality" | "files"
  | "contacts" | "ontology" | "agents" | "units" | "reportSchedules";

export type FieldKind = "text" | "number" | "money" | "date" | "select" | "person" | "email" | "record" | "file" | "longtext";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
  currency?: string;
  min?: number;
  max?: number;
  pattern?: string;
  help?: string;
  /** Material fields force a renewed review when edited after approval. */
  material?: boolean;
}

export type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

export interface StatusDef { id: string; label: string; tone: Tone; closed?: boolean }

export interface RecordTypeDef {
  id: string;
  label: string;
  plural: string;
  fields: FieldDef[];
  statuses: StatusDef[];
  defaultVisibility: Visibility;
}

export interface RoleDef {
  id: string;
  label: string;
  description: string;
  permissions: Permission[];
}

export interface TeamDef { id: Id; label: string; unitId?: Id; ownerId?: Id; queueLabel?: string }
export interface UnitDef {
  id: Id;
  label: string;
  ownerId?: Id;
  /** Optional grouping for the scope switcher, such as a region. */
  group?: string;
  /** Planned units show in the switcher but hold no work yet. */
  status?: "operating" | "planned";
  location?: string;
}

export type MetricUnit = "count" | "percent" | "hours" | "money";
export type Aggregation = "count" | "ratio" | "median" | "sum";

export interface MetricDef {
  id: string;
  label: string;
  description: string;
  unit: MetricUnit;
  currency?: string;
  aggregation: Aggregation;
  /** Human-readable formula shown in the detail panel. */
  formula: string;
  /** Which entity the figure is drawn from. */
  entity: "task" | "approval" | "record" | "issue" | "request" | "person";
  periodDays: number;
  better: "up" | "down";
  target?: number;
  enabled: boolean;
}

export interface DashboardDef {
  id: string;
  label: string;
  description: string;
  metricIds: string[];
  /** Roles that get this view by default. */
  defaultForRoles: string[];
}

export type StageScope = "requester-team" | "requester-unit" | "organisation";

export interface ApprovalStageDef {
  id: string;
  label: string;
  eligibleRoles: string[];
  scope: StageScope;
  /** Optional: only applies when a numeric field is above this value. */
  when?: { field: string; over: number };
}

export interface ApprovalRuleDef {
  id: string;
  label: string;
  formId: string;
  stages: ApprovalStageDef[];
  prohibitSelfApproval: boolean;
  slaPolicyId: string;
  escalateToRole: string;
}

export type EffectKind = "apply-correction" | "approve-file-version" | "create-fulfilment-task" | "notify-external" | "record-leave";

export interface RequestFormDef {
  id: string;
  label: string;
  description: string;
  fields: FieldDef[];
  evidenceRequired: boolean;
  approvalRuleId: string;
  /** Tasks created with the request, linked to it. */
  tasks: { title: string; checklist?: string[] }[];
  /** What runs once the request is approved. */
  effect: { kind: EffectKind; label: string };
  enabled: boolean;
}

export interface SlaPolicyDef {
  id: string;
  label: string;
  targetHours: number;
  calendar: "business" | "calendar";
  businessHours: string;
  pauseWhenWaiting: boolean;
  remindAtPercent: number;
  escalateToRole: string;
}

export interface WorkflowStepDef {
  id: string;
  label: string;
  kind: "task" | "approval" | "action" | "notify" | "check";
  /** Local effects change Pulse; external ones need a connection. */
  effect?: "local" | "external";
}

export interface WorkflowTemplateDef {
  id: string;
  label: string;
  description: string;
  ownerId: Id;
  trigger: { kind: "manual" | "schedule" | "event"; detail: string };
  steps: WorkflowStepDef[];
  enabled: boolean;
}

export interface NotificationRouteDef {
  id: string;
  event: string;
  label: string;
  channel: "in-app" | "email";
  recipients: string;
}

export interface SourceDef {
  id: string;
  label: string;
  kind: "pulse" | "sample" | "external";
  connected: boolean;
  prerequisite: string;
}

export interface FieldMappingDef {
  id: string;
  recordTypeId: string;
  fieldKey: string;
  sourceId: string;
  sourceField: string;
  authority: "source" | "pulse";
  writeBack: boolean;
}

export interface CodeMappingDef { id: string; sourceId: string; field: string; from: string; to: string }

export interface AgentDef {
  id: string;
  name: string;
  purpose: string;
  responsibleId: Id;
  scope: { teamIds: Id[] | "all" };
  permittedActions: string[];
  approvalRequired: string[];
  shape: string;
  tint: string;
  enabled: boolean;
}

export interface Terminology {
  organisation: string;
  unit: string; units: string;
  team: string; teams: string;
  record: string; records: string;
  request: string; requests: string;
  task: string; tasks: string;
}

export interface RoleLayout { homeView: "personal" | "management"; dashboardId: string }

export interface GovernancePolicy {
  auditRetentionDays: number;
  exportRequiresPermission: boolean;
  restrictedDocsInAnswers: boolean;
  reviewDocumentsEveryDays: number;
}

/* ── People (employee management) ──────────────────────────────────────── */

export type EmploymentStage = "onboarding" | "probation" | "active" | "leaving" | "left";

export interface Certification { id: Id; name: string; expires: ISO | null; renewEveryMonths?: number }
export interface SignDocument { id: Id; title: string; sentAt: ISO; signedAt: ISO | null }

export interface Employment {
  personId: Id;
  teamId?: Id;
  unitId?: Id;
  managerId?: Id;
  contract: "full-time" | "part-time" | "contractor" | "temporary";
  hoursPerWeek: number;
  stage: EmploymentStage;
  startDate: ISO;
  endDate?: ISO;
  probationEnds?: ISO;
  certifications: Certification[];
  documents: SignDocument[];
  lastAccessReview?: ISO;
}

export interface LeaveEntry {
  id: Id;
  personId: Id;
  kind: "annual" | "sick" | "training" | "other";
  from: ISO;
  to: ISO;
  status: "requested" | "approved" | "declined";
  requestId?: Id;
}

export interface PeopleSettings {
  requiredCertifications: { name: string; everyMonths: number }[];
  onboardingChecklist: string[];
  offboardingChecklist: string[];
  probationMonths: number;
  accessReviewEveryDays: number;
}

export interface OrgConfig {
  workspace: { id: string; name: string; shortName: string };
  referenceDate: ISO;
  timezone: string;
  terminology: Terminology;
  capabilities: Record<Capability, boolean>;
  units: UnitDef[];
  teams: TeamDef[];
  roles: RoleDef[];
  recordTypes: RecordTypeDef[];
  metrics: MetricDef[];
  dashboards: DashboardDef[];
  requestForms: RequestFormDef[];
  approvalRules: ApprovalRuleDef[];
  slaPolicies: SlaPolicyDef[];
  workflowTemplates: WorkflowTemplateDef[];
  notificationRoutes: NotificationRouteDef[];
  sources: SourceDef[];
  fieldMappings: FieldMappingDef[];
  codeMappings: CodeMappingDef[];
  agents: AgentDef[];
  roleLayouts: Record<string, RoleLayout>;
  density: "comfortable" | "compact";
  governance: GovernancePolicy;
  people: PeopleSettings;
}

/* ── Organisation ──────────────────────────────────────────────────────── */

export interface Person {
  id: Id;
  name: string;
  email: string;
  title: string;
  kind: "staff" | "external";
  status: "active" | "invited" | "suspended";
  organisation?: string;
}

export interface Membership { personId: Id; teamId: Id }

export type RoleScope = { kind: "organisation" } | { kind: "unit"; unitId: Id } | { kind: "team"; teamId: Id };

export interface RoleAssignment { id: Id; personId: Id; roleId: string; scope: RoleScope }

export interface Delegation {
  id: Id;
  fromId: Id;
  toId: Id;
  /** Approval rules the delegate may decide on behalf of fromId. */
  ruleIds: string[];
  until: ISO;
  reason: string;
  active: boolean;
}

/* ── Records and files ─────────────────────────────────────────────────── */

export type Visibility = "organisation" | "unit" | "team" | "owner";
export type FieldValue = string | number | null;

export interface FieldMeta {
  origin: "source" | "manual" | "estimate";
  sourceId?: string;
  sourceUpdatedAt?: ISO;
  /** A Pulse correction waiting for the authoritative source to accept it. */
  pendingSourceReview?: boolean;
}

export interface SourceRef { sourceId: string; externalId: string; syncedAt: ISO | null }

export interface RecordItem {
  id: Id;
  typeId: string;
  ref: string;
  title: string;
  status: string;
  ownerId: Id;
  teamId?: Id;
  unitId?: Id;
  visibility: Visibility;
  fields: Record<string, FieldValue>;
  fieldMeta: Record<string, FieldMeta>;
  sourceRefs: SourceRef[];
  createdAt: ISO;
  updatedAt: ISO;
  mergedInto?: Id;
}

export interface Relationship { id: Id; fromId: Id; toId: Id; label: string }

export interface FileVersion { id: Id; n: number; addedAt: ISO; addedBy: Id; note: string; sizeKb: number; approved?: boolean }

export interface FileDoc {
  id: Id;
  title: string;
  kind: string;
  ownerId: Id;
  teamId?: Id;
  unitId?: Id;
  visibility: Visibility;
  /** Source permission: restricted documents are readable only by these people and admins. */
  restrictedTo?: Id[];
  linkedRecordIds: Id[];
  versions: FileVersion[];
  effectiveDate?: ISO;
  reviewDate?: ISO;
  summary: string;
  sourceId: string;
}

/* ── Work ──────────────────────────────────────────────────────────────── */

export type TaskStatus = "open" | "in_progress" | "waiting" | "done" | "cancelled";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface ChecklistItem { id: Id; label: string; done: boolean }
export interface Note { id: Id; by: Id; at: ISO; text: string }

export interface Task {
  id: Id;
  title: string;
  teamId?: Id;
  unitId?: Id;
  assigneeId: Id | null;
  claimedAt?: ISO;
  requestId?: Id;
  linkedRecordIds: Id[];
  priority: Priority;
  status: TaskStatus;
  dueAt?: ISO;
  completedAt?: ISO;
  dependsOn: Id[];
  checklist: ChecklistItem[];
  completionCriteria?: string;
  notes: Note[];
  evidenceFileIds: Id[];
  scheduleId?: Id;
  /** Recurring instances: scheduleId + local date. One per key, ever. */
  instanceKey?: string;
  slaPolicyId?: string;
  createdAt: ISO;
  createdBy: Id;
  waitingSince?: ISO;
}

export type RequestStatus = "draft" | "submitted" | "changes_requested" | "approved" | "declined" | "withdrawn";
export type ExecutionStatus = "not_started" | "running" | "succeeded" | "failed" | "not_applicable";

export interface RequestVersion { n: number; fields: Record<string, FieldValue>; at: ISO; by: Id; note: string }

export interface RequestItem {
  id: Id;
  ref: string;
  formId: string;
  title: string;
  requesterId: Id;
  teamId?: Id;
  unitId?: Id;
  fields: Record<string, FieldValue>;
  version: number;
  versions: RequestVersion[];
  status: RequestStatus;
  evidenceFileIds: Id[];
  linkedRecordIds: Id[];
  taskIds: Id[];
  approvalId?: Id;
  execution: {
    status: ExecutionStatus;
    effect: string;
    attempts: number;
    lastError?: string;
    /** Applied effects, keyed so a repeat never applies twice. */
    appliedKeys: string[];
    executedAt?: ISO;
  };
  createdAt: ISO;
  updatedAt: ISO;
  createdBy: Id;
}

export type StageStatus = "waiting" | "pending" | "approved" | "declined" | "returned" | "skipped";

export interface ApprovalStage {
  stageId: string;
  label: string;
  eligibleRoles: string[];
  assigneeId: Id | null;
  dueAt?: ISO;
  startedAt?: ISO;
  status: StageStatus;
  escalatedFromId?: Id;
}

export type DecisionKind = "approve" | "decline" | "return" | "delegate" | "escalate";

export interface Decision {
  id: Id;
  stageId: string;
  actorId: Id;
  onBehalfOfId?: Id;
  kind: DecisionKind;
  comment: string;
  at: ISO;
  requestVersion: number;
  cycle: number;
}

export type ApprovalStatus = "pending" | "approved" | "declined" | "returned" | "stale";

export interface Approval {
  id: Id;
  requestId: Id;
  ruleId: string;
  /** Increments each time the request is resubmitted. */
  cycle: number;
  reviewingVersion: number;
  stages: ApprovalStage[];
  decisions: Decision[];
  status: ApprovalStatus;
  submittedAt: ISO;
  decidedAt?: ISO;
  policyException?: string;
}

export type RunStatus = "queued" | "running" | "awaiting_input" | "awaiting_approval" | "completed" | "failed" | "paused";
export type RunStepStatus = "done" | "current" | "waiting" | "failed" | "pending" | "skipped";

export interface RunStep { stepId: string; label: string; status: RunStepStatus; at?: ISO; note?: string; effectKey?: string }

export interface WorkflowRun {
  id: Id;
  ref: string;
  templateId: string;
  title: string;
  ownerId: Id;
  assigneeId: Id | null;
  teamId?: Id;
  unitId?: Id;
  status: RunStatus;
  startedAt: ISO;
  updatedAt: ISO;
  steps: RunStep[];
  affectedRecordIds: Id[];
  /** Ledger of business effects already applied by this run. */
  appliedEffects: { key: string; description: string; at: ISO }[];
  failure?: { stepId: string; message: string; impact: string; at: ISO; cause: "missing-owner" | "no-connection" | "validation" };
  requestId?: Id;
}

export interface Schedule {
  id: Id;
  label: string;
  kind: "recurring-task" | "automation" | "report";
  ownerId: Id;
  teamId?: Id;
  cadence: { every: "day" | "week" | "month"; weekday?: number; monthday?: number; hour: number; minute: number };
  timezone: string;
  active: boolean;
  task?: { title: string; priority: Priority; checklist: string[]; dueInHours: number };
  workflowTemplateId?: string;
  dashboardId?: string;
  recipients?: Id[];
  /** Keys of instances already produced, so a repeated tick never duplicates. */
  producedKeys: string[];
  lastRunAt?: ISO;
}

/* ── Data quality ──────────────────────────────────────────────────────── */

export type IssueKind = "missing_field" | "duplicate" | "unmapped_value" | "conflict" | "unmatched";
export type IssueState = "open" | "in_progress" | "resolved" | "dismissed";

export interface DataIssue {
  id: Id;
  kind: IssueKind;
  severity: "high" | "medium" | "low";
  title: string;
  recordIds: Id[];
  field?: string;
  ownerId: Id;
  state: IssueState;
  detectedAt: ISO;
  sourceIds: string[];
  /** Conflicts: the competing values. */
  values?: { sourceId: string; value: FieldValue; at: ISO }[];
  /** Unmapped codes and unmatched source rows. */
  sourceValue?: string;
  externalId?: string;
  resolution?: { by: Id; at: ISO; action: string; reason: string };
  derived?: boolean;
}

/* ── Activity, views, session ──────────────────────────────────────────── */

export type ActorKind = "person" | "agent" | "system" | "source";

export interface AuditEvent {
  id: Id;
  at: ISO;
  actorId: Id;
  actorKind: ActorKind;
  action: string;
  objectType: "record" | "task" | "request" | "approval" | "run" | "schedule" | "issue" | "file" | "config" | "view" | "person";
  objectId: Id;
  recordIds: Id[];
  summary: string;
  before?: Record<string, FieldValue>;
  after?: Record<string, FieldValue>;
  teamId?: Id;
  unitId?: Id;
  simulated?: boolean;
  onBehalfOfId?: Id;
}

export type ViewPage = "tasks" | "records" | "approvals" | "dashboard" | "activity";

export interface SavedView {
  id: Id;
  page: ViewPage;
  name: string;
  ownerId: Id;
  shared: boolean;
  teamId?: Id;
  state: {
    query?: string;
    filters?: Record<string, string>;
    columns?: string[];
    sort?: { key: string; dir: "asc" | "desc" };
    group?: string;
    range?: string;
    dashboardId?: string;
    recordTypeId?: string;
  };
}

export interface ReportSchedule {
  id: Id;
  dashboardId: string;
  label: string;
  cadence: string;
  recipientIds: Id[];
  createdBy: Id;
  createdAt: ISO;
}

export interface SyncState {
  sourceId: string;
  lastAttemptAt: ISO | null;
  lastSuccessAt: ISO | null;
  status: "not_connected" | "sample" | "ok" | "stale" | "error";
  message: string;
}

export type ScopeSel =
  | { kind: "personal" }
  | { kind: "team"; id: Id }
  | { kind: "unit"; id: Id }
  | { kind: "organisation" };

export interface CoreData {
  people: Person[];
  employment: Employment[];
  leave: LeaveEntry[];
  memberships: Membership[];
  roleAssignments: RoleAssignment[];
  delegations: Delegation[];
  records: RecordItem[];
  relationships: Relationship[];
  files: FileDoc[];
  tasks: Task[];
  requests: RequestItem[];
  approvals: Approval[];
  runs: WorkflowRun[];
  schedules: Schedule[];
  issues: DataIssue[];
  events: AuditEvent[];
  views: SavedView[];
  reportSchedules: ReportSchedule[];
  sync: SyncState[];
}

export interface CoreState {
  mode: "sample" | "clean";
  config: OrgConfig;
  data: CoreData;
  seq: number;
}

/** Who is acting and where. Every query and action takes one. */
export interface Ctx {
  viewerId: Id;
  scope: ScopeSel;
  now: ISO;
}
