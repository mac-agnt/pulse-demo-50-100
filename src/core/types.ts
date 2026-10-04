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
  | "agents.manage" | "views.share"
  | "projects.manage" | "finance.view" | "finance.manage" | "purchasing.manage" | "standards.review"
  | "agents.run" | "updates.publish" | "comments.write";

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
  entity: "task" | "approval" | "record" | "issue" | "request" | "person" | "project" | "invoice" | "requirement" | "agentRun";
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
  /** Capability module this view belongs to; hidden while that module is off. */
  module?: ModuleId;
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

export type EffectKind = "apply-correction" | "approve-file-version" | "create-fulfilment-task" | "notify-external" | "record-leave"
  | "create-purchase-order" | "approve-invoice" | "accept-evidence" | "agent-action" | "change-milestone";

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

/* ── Agents: definitions, coordination, tools, templates ─────────────────
   Four distinct concepts (see docs/IMPLEMENTATION_MAP.md):
   1. AgentDef: the saved definition (role, instructions, tools, limits).
   2. coordinatorId: the organisation-chart parent. Grants NO data or action authority.
   3. AgentRun: one execution, with its own steps, outputs and history.
   4. TempWorker: an execution-scoped child created under a spawn policy. Not a saved agent. */

export type AgentAvailability = "draft" | "ready" | "paused" | "connection_required";

export interface AgentLimits {
  /** Max delegation depth below a run started on this agent. */
  maxDepth: number;
  /** Max child runs or temporary workers per run. */
  maxChildren: number;
  maxConcurrentRuns: number;
  maxMinutes: number;
  /** Only enforced when the runtime reports usage; otherwise shown as Unknown. */
  maxCost?: number;
}

export interface SpawnPolicy {
  enabled: boolean;
  /** Agent templates a temporary worker may be created from. */
  templateIds: string[];
  maxWorkers: number;
}

export interface AgentDef {
  id: string;
  name: string;
  /** Short responsibility shown on the chart node. */
  purpose: string;
  /** Instructions given to the runtime. Never contains secrets. */
  instructions?: string;
  outputs?: string[];
  /** Accountable human owner. */
  responsibleId: Id;
  /** Organisation-chart parent (coordinator). Null for roots and independent agents. */
  coordinatorId?: Id | null;
  availability?: AgentAvailability;
  scope: { teamIds: Id[] | "all" };
  /** Legacy action labels, kept for Settings > Agent controls. */
  permittedActions: string[];
  approvalRequired: string[];
  /** Tool ids from config.agentTools. Restricted tools always need human approval. */
  tools?: string[];
  /** Knowledge sources the agent may read: record type ids, "files", source ids. */
  knowledge?: string[];
  trigger?: { kind: "manual" | "schedule" | "event" | "delegated"; detail: string };
  limits?: AgentLimits;
  spawn?: SpawnPolicy;
  templateId?: string;
  /** Increments on every saved change. Runs keep the version they started with. */
  version?: number;
  archived?: boolean;
  createdAt?: ISO;
  shape: string;
  tint: string;
  /** Kept for older readers: true when availability is "ready". */
  enabled: boolean;
}

export interface AgentToolDef {
  id: string;
  label: string;
  description: string;
  /** read: looks at Pulse data; write: changes Pulse data locally; external: acts in another system. */
  effect: "read" | "write" | "external";
  /** Restricted tools always route to a human approval in Work. */
  restricted: boolean;
  /** Source id that must be connected before the tool is usable. */
  requiresSourceId?: string;
  module?: ModuleId;
}

export interface AgentTemplateDef {
  id: string;
  label: string;
  description: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  defaultTrigger: AgentDef["trigger"];
  /** Can be used as a temporary worker template. */
  workerOk: boolean;
  module?: ModuleId;
}

export interface OrchestrationSettings {
  /** Which runtime executes runs. "sample" is the local deterministic engine. */
  adapter: "sample" | "external";
  /** Shown when adapter is "external" but not connected. */
  connectionRequirement: string;
  defaultLimits: AgentLimits;
  /** Global ceiling; an agent's own limits can only be lower. */
  ceiling: AgentLimits;
}

export interface Terminology {
  organisation: string;
  unit: string; units: string;
  team: string; teams: string;
  record: string; records: string;
  request: string; requests: string;
  task: string; tasks: string;
}

export interface RoleLayout { homeView: "personal" | "management"; dashboardId: string; homeMode?: "chat" | "today" }

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

/* ── Modules ────────────────────────────────────────────────────────────
   Capability modules can be enabled independently. Disabling one hides its
   navigation, dashboard widgets, fields, shortcuts and agent suggestions but
   keeps its data. Labels change without changing ids. */

export type ModuleId = "projects" | "people" | "finance" | "purchasing" | "standards";

export interface ModuleConfig {
  enabled: boolean;
  /** Navigation label override, e.g. "Engagements" for projects. */
  label?: string;
  /** Page tab label overrides keyed by section id. */
  sectionLabels?: Record<string, string>;
}

export interface LocationDef { id: Id; label: string; unitId?: Id; address?: string }

export interface ProjectPhaseDef { id: string; label: string }

export interface ProjectTypeDef {
  id: string;
  label: string;
  phases: ProjectPhaseDef[];
  fields: FieldDef[];
}

export interface ProjectTemplateDef {
  id: string;
  label: string;
  description: string;
  typeId: string;
  /** Increments when the template is edited. Existing projects keep their copy. */
  version: number;
  durationDays: number;
  milestones: { key: string; label: string; phaseId: string; offsetDays: number; dependsOn?: string[]; gate?: { label: string; requirementIds: string[] } }[];
  tasks: { key: string; title: string; phaseId: string; offsetDays: number; durationDays: number; estimateHours?: number; milestoneKey?: string; dependsOn?: string[] }[];
}

export interface ProjectSettings {
  /** Singular / plural labels: "Project", "Engagement", "Initiative". */
  label: string;
  plural: string;
  types: ProjectTypeDef[];
  templates: ProjectTemplateDef[];
  /** How progress is calculated. Shown with every progress figure. */
  progressBasis: "milestones" | "tasks" | "estimate-hours";
  /** A project is at risk when its next milestone has slipped by this many days or more. */
  atRiskSlipDays: number;
  /** Move dependent milestones automatically by the same number of days. */
  cascadeMilestoneMoves: boolean;
}

export interface FinanceSettings {
  reportingCurrency: string;
  /** Opening balance for the cash outlook. Without it no outlook is drawn. */
  openingBalance?: { amount: number; asOf: ISO; sourceId: string };
  /** Accounting source (read-only adapter). */
  accountingSourceId?: string;
}

export interface PurchasingSettings {
  /** Invoice may exceed its order by this percentage before it is an exception. */
  tolerancePercent: number;
  /** Require a receipt before an invoice is matched. */
  requireReceipt: boolean;
  /** Request form used for purchase requests (canonical requests in Work). */
  requestFormId?: string;
  /** Source that can send orders to suppliers. Without a connected one, orders are approved in Pulse but never sent. */
  orderingSourceId?: string;
}

export type RequirementSubject = "person" | "project" | "location" | "unit" | "record" | "supplier";

export interface RequirementDef {
  id: string;
  label: string;
  description: string;
  appliesTo: RequirementSubject;
  /** Narrow which subjects it applies to. Empty means all of that kind. */
  selector?: { projectTypeIds?: string[]; teamIds?: Id[]; unitIds?: Id[]; recordTypeId?: string; /** Explicit subjects, when a kind-wide rule is too broad. */ subjectIds?: Id[] };
  evidence: string;
  /** Renewal interval; expired evidence becomes "expired" and creates a renewal task. */
  renewEveryMonths?: number;
  reviewerRoleIds: string[];
  ownerId?: Id;
  /** Person requirements met by a certificate already held in People (employment.certifications, matched by name).
      The certificate is the one canonical record: no separate obligation rows are kept. */
  certificateName?: string;
  /** What this requirement holds back until it is approved, e.g. "New orders to this supplier". Shown, never enforced elsewhere. */
  blocks?: string;
}

export interface CheckDef {
  id: string;
  label: string;
  appliesTo: RequirementSubject;
  every: "week" | "month" | "quarter";
  checklist: string[];
  ownerId?: Id;
}

export interface StandardsSettings {
  requirements: RequirementDef[];
  checks: CheckDef[];
  /** Policies (FileDoc ids) everyone in scope must acknowledge. */
  acknowledgePolicyIds: Id[];
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
  modules: Record<ModuleId, ModuleConfig>;
  locations: LocationDef[];
  projects: ProjectSettings;
  finance: FinanceSettings;
  purchasing: PurchasingSettings;
  standards: StandardsSettings;
  agentTools: AgentToolDef[];
  agentTemplates: AgentTemplateDef[];
  orchestration: OrchestrationSettings;
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
  /** Project work: the same canonical task seen in Work and in the project. */
  projectId?: Id;
  milestoneId?: Id;
  phaseId?: string;
  startAt?: ISO;
  /** Effort estimate. Tasks without one count as unestimated, never as zero. */
  estimateHours?: number;
  /** Created by an agent run, a requirement or a check. */
  origin?: { kind: "agent-run" | "requirement" | "check" | "invoice" | "project-template"; id: Id };
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
  objectType: "record" | "task" | "request" | "approval" | "run" | "schedule" | "issue" | "file" | "config" | "view" | "person"
    | "project" | "milestone" | "risk" | "budget" | "order" | "invoice" | "receivable" | "transaction" | "supplier"
    | "requirement" | "check" | "agent" | "agentRun" | "update" | "comment" | "appointment";
  /** Groups several low-level events into one story (one run, request or change). */
  storyKey?: string;
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

export type ViewPage = "tasks" | "records" | "approvals" | "dashboard" | "activity" | "projects" | "finance" | "purchasing" | "standards" | "agentRuns";

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

/* ── Projects ──────────────────────────────────────────────────────────── */

export type Health = "on_track" | "at_risk" | "off_track";

export interface Project {
  id: Id;
  ref: string;
  title: string;
  typeId: string;
  objective: string;
  ownerId: Id;
  teamId?: Id;
  unitId?: Id;
  locationId?: Id;
  phaseId: string;
  status: "planned" | "active" | "on_hold" | "completed" | "cancelled";
  startDate: ISO;
  endDate: ISO;
  /** Owner-set health. Shown next to the computed health; never silently replaced. */
  reportedHealth?: Health;
  fields: Record<string, FieldValue>;
  /** Template copy this project was created from (template edits never change it). */
  template?: { id: string; version: number };
  budgetId?: Id;
  visibility: Visibility;
  createdAt: ISO;
  updatedAt: ISO;
  /** Idempotency key of the create action, so a repeated submit creates nothing twice. */
  sourceKey?: string;
  /** Documents linked to the project (canonical files in Records). */
  fileIds?: Id[];
}

export interface Milestone {
  id: Id;
  projectId: Id;
  label: string;
  phaseId: string;
  dueAt: ISO;
  /** Date when first planned; slip = dueAt - baselineAt. */
  baselineAt: ISO;
  completedAt?: ISO;
  dependsOn: Id[];
  /** A gate blocks the next step until its requirements are approved. */
  gate?: { label: string; obligationIds: Id[] };
}

export interface ProjectRisk {
  id: Id;
  projectId: Id;
  kind: "risk" | "issue" | "decision";
  title: string;
  severity: "high" | "medium" | "low";
  impact: string;
  ownerId: Id;
  nextAction: string;
  state: "open" | "mitigating" | "closed";
  requestId?: Id;
  createdAt: ISO;
}

export interface ProjectUpdate {
  id: Id;
  projectId: Id;
  at: ISO;
  by: Id;
  text: string;
  health: Health;
}

/* ── Collaboration ─────────────────────────────────────────────────────── */

export interface Comment {
  id: Id;
  objectType: "project" | "request" | "record" | "task" | "invoice" | "agentRun";
  objectId: Id;
  by: Id;
  at: ISO;
  text: string;
  mentions: Id[];
}

/** Company updates and drafted recaps. Publishing needs updates.publish. */
export interface CompanyUpdate {
  id: Id;
  title: string;
  body: string;
  audience: { kind: "organisation" } | { kind: "unit"; id: Id } | { kind: "team"; id: Id };
  state: "draft" | "published" | "discarded";
  draftedBy: Id;
  draftedAt: ISO;
  publishedBy?: Id;
  publishedAt?: ISO;
  /** Events this update summarises. */
  eventIds: Id[];
}

/** Business appointments (not automation schedules). */
export interface Appointment {
  id: Id;
  title: string;
  startAt: ISO;
  minutes: number;
  ownerId: Id;
  attendeeIds: Id[];
  teamId?: Id;
  unitId?: Id;
  locationId?: Id;
  projectId?: Id;
  note?: string;
}

/* ── Finance (optional module) ─────────────────────────────────────────── */

export interface Budget {
  id: Id;
  label: string;
  ownerId: Id;
  projectId?: Id;
  unitId?: Id;
  teamId?: Id;
  currency: string;
  periodFrom: ISO;
  periodTo: ISO;
  /** Approved amount. Committed, invoiced and paid are derived from orders, invoices and payments. */
  approved: number;
  /** Planned spend by month (YYYY-MM to amount). */
  plan: Record<string, number>;
  lines?: { id: Id; label: string; amount: number }[];
}

/** Money owed to the organisation. */
export interface Receivable {
  id: Id;
  ref: string;
  counterparty: string;
  recordId?: Id;
  projectId?: Id;
  unitId?: Id;
  amount: number;
  currency: string;
  issuedAt: ISO;
  dueAt: ISO;
  paidAmount: number;
  status: "open" | "part_paid" | "paid" | "written_off";
  sourceId: string;
  sourceUpdatedAt?: ISO;
  ingestedAt?: ISO;
}

/** A bank or ledger movement, read from the accounting source. */
export interface Transaction {
  id: Id;
  date: ISO;
  /** Positive in, negative out. */
  amount: number;
  currency: string;
  description: string;
  counterparty: string;
  kind: "payment_out" | "payment_in" | "other";
  invoiceId?: Id;
  receivableId?: Id;
  budgetId?: Id;
  projectId?: Id;
  sourceId: string;
  sourceUpdatedAt?: ISO;
  ingestedAt?: ISO;
  /** Row id in the source, so a repeated sync never creates a second copy. */
  externalId?: string;
}

/* ── Purchasing (optional module) ──────────────────────────────────────── */

export interface Supplier {
  id: Id;
  name: string;
  recordId?: Id;
  category: string;
  ownerId: Id;
  status: "active" | "onboarding" | "blocked";
  paymentTermsDays: number;
  contactPersonId?: Id;
  notes?: string;
}

export interface OrderLine { id: Id; description: string; quantity?: number; unit?: string; unitPrice?: number; amount: number }

export interface PurchaseOrder {
  id: Id;
  ref: string;
  supplierId: Id;
  /** Canonical purchase request in Work that this order came from. */
  requestId?: Id;
  projectId?: Id;
  budgetId?: Id;
  teamId?: Id;
  unitId?: Id;
  ownerId: Id;
  lines: OrderLine[];
  total: number;
  currency: string;
  status: "draft" | "approved" | "sent" | "part_received" | "received" | "closed" | "cancelled";
  /** True only when a connector actually sent it. Sample mode never sends. */
  sentExternally: boolean;
  createdAt: ISO;
  expectedAt?: ISO;
}

export interface GoodsReceipt {
  id: Id;
  orderId: Id;
  at: ISO;
  by: Id;
  lines: { lineId: Id; quantity?: number; note?: string }[];
  fileId?: Id;
}

export type MatchFlag = "over_order" | "no_receipt" | "duplicate" | "no_order" | "currency_mismatch";

/** Supplier invoice (payable). */
export interface SupplierInvoice {
  id: Id;
  ref: string;
  supplierId: Id;
  orderId?: Id;
  amount: number;
  currency: string;
  issuedAt: ISO;
  dueAt: ISO;
  status: "received" | "matched" | "exception" | "in_review" | "approved" | "rejected" | "paid";
  flags: MatchFlag[];
  fileId?: Id;
  /** Review request in Work when the invoice is an exception. */
  requestId?: Id;
  /** Approval to pay is recorded here; payment itself only arrives from the accounting source. */
  approvedAt?: ISO;
  paidAt?: ISO;
  sourceId: string;
  sourceUpdatedAt?: ISO;
  ingestedAt?: ISO;
  /** Row id in the source, so a repeated sync never creates a second copy. */
  externalId?: string;
}

/* ── Standards (optional module) ───────────────────────────────────────── */

export type ObligationState = "missing" | "received" | "under_review" | "approved" | "rejected" | "expired";

/** One requirement applied to one subject. */
export interface Obligation {
  id: Id;
  requirementId: string;
  subject: { kind: RequirementSubject; id: Id };
  state: ObligationState;
  dueAt?: ISO;
  /** Evidence: the file and exact version received. Receiving is not accepting. */
  evidence?: { fileId: Id; version: number; receivedAt: ISO; receivedBy: Id };
  /** Review request in Work (same approval model as every other review). */
  requestId?: Id;
  decidedAt?: ISO;
  decidedBy?: Id;
  expiresAt?: ISO;
  rejectionReason?: string;
  renewalTaskId?: Id;
}

export interface CheckRun {
  id: Id;
  checkId: string;
  subject: { kind: RequirementSubject; id: Id };
  dueAt: ISO;
  /** One per check, subject and period. */
  periodKey: string;
  result: "pending" | "passed" | "failed";
  completedAt?: ISO;
  by?: Id;
  notes?: string;
  taskId?: Id;
  followUpTaskId?: Id;
}

export interface PolicyAck { id: Id; fileId: Id; version: number; personId: Id; at: ISO }

/* ── Agent runs ────────────────────────────────────────────────────────── */

export type AgentRunState = "queued" | "planning" | "delegated" | "running" | "waiting_input" | "waiting_approval"
  | "stop_requested" | "completed" | "failed" | "cancelled";

export type AgentStepKind = "queued" | "planning" | "delegated" | "spawned" | "tool_call" | "proposed_action" | "waiting_input"
  | "waiting_approval" | "approved" | "executed" | "output" | "completed" | "failed" | "retried" | "cancelled" | "stop_requested" | "paused";

export interface AgentRunStep {
  id: Id;
  at: ISO;
  kind: AgentStepKind;
  /** Who did it: a saved agent, a temporary worker or a person. */
  actor: { kind: "agent" | "worker" | "person" | "system"; id: Id };
  summary: string;
  status: "done" | "current" | "failed" | "pending" | "skipped";
  childRunId?: Id;
  workerId?: Id;
  toolId?: string;
  input?: string;
  output?: string;
  sourceRefs: { kind: "record" | "task" | "file" | "request" | "approval" | "project" | "invoice" | "issue" | "obligation"; id: Id }[];
  /** Business explanation first; technical detail only in the detail view. */
  error?: { business: string; technical: string; retryable: boolean };
  /** Effects are keyed so a retry never applies one twice. */
  effectKey?: string;
  attempt?: number;
}

export interface TempWorker {
  id: Id;
  runId: Id;
  templateId: string;
  label: string;
  /** Intersection of parent agent scope and template needs. Never wider than the parent. */
  scopeTeamIds: Id[] | "all";
  tools: string[];
  depth: number;
  state: "active" | "completed" | "failed" | "cancelled";
  createdAt: ISO;
  endedAt?: ISO;
  output?: string;
}

export interface AgentRun {
  id: Id;
  ref: string;
  agentId: Id;
  /** Agent definition version the run started with. Later edits do not change it. */
  agentVersion: number;
  parentRunId?: Id;
  depth: number;
  goal: string;
  scopeTeamIds: Id[] | "all";
  initiator: { kind: "person" | "agent" | "schedule" | "event"; id: Id };
  idempotencyKey: string;
  state: AgentRunState;
  startedAt: ISO;
  endedAt?: ISO;
  steps: AgentRunStep[];
  workers: TempWorker[];
  childRunIds: Id[];
  inputs: { kind: string; id: Id }[];
  outputs: { label: string; kind?: string; id?: Id; text?: string }[];
  /** Restricted action waiting on a human: the canonical request in Work. */
  approvalRequestId?: Id;
  waitingOwnerId?: Id;
  appliedEffects: { key: string; description: string; at: ISO }[];
  /** Only filled when the runtime reports it. */
  usage?: { reported: boolean; tokens?: number; cost?: number; currency?: string };
  /** Sample engine runs are always simulated. */
  simulated: boolean;
  /** Test runs use isolated inputs and never apply effects. */
  test?: boolean;
  /** Planned units of work the engine works through (see src/core/orchestration.ts). */
  plan?: AgentPlanItem[];
  /** Definition and policy the run started with. Execution uses this, narrowed by later revocations, never widened. */
  snapshot?: { name: string; tools: string[]; limits: AgentLimits; spawn?: SpawnPolicy };
  /** A person asked the run to stop. It shows as Stop requested until the engine acknowledges at a safe checkpoint. */
  stop?: { requestedAt: ISO; by: Id; acknowledgedAt?: ISO };
}

export type AgentSourceKind = AgentRunStep["sourceRefs"][number]["kind"];

/** One planned unit of work inside an agent run. */
export interface AgentPlanItem {
  id: Id;
  kind: "tool" | "delegate" | "spawn" | "action";
  label: string;
  /** waiting: on a child run or a human decision; approved: decided, execution not yet run. */
  status: "pending" | "waiting" | "approved" | "done" | "failed" | "skipped";
  toolId?: string;
  agentId?: Id;
  templateId?: string;
  target?: { kind: AgentSourceKind; id: Id };
  /** Small named parameters for the step, e.g. the field a task is about. */
  args?: Record<string, string>;
  /** Canonical object the step created (a task, a request). */
  created?: { kind: AgentSourceKind; id: Id };
  /** Restricted action: proposed, approved in Work, then executed once. */
  action?: { kind: "record-field"; recordId: Id; field: string; value: string; basis: string } | { kind: "email"; to: string; subject: string };
  childRunId?: Id;
  workerId?: Id;
  requestId?: Id;
  effectKey?: string;
  attempts: number;
  output?: string;
  note?: string;
  error?: { business: string; technical: string; retryable: boolean };
}

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
  projects: Project[];
  milestones: Milestone[];
  risks: ProjectRisk[];
  projectUpdates: ProjectUpdate[];
  comments: Comment[];
  companyUpdates: CompanyUpdate[];
  appointments: Appointment[];
  budgets: Budget[];
  receivables: Receivable[];
  transactions: Transaction[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  receipts: GoodsReceipt[];
  invoices: SupplierInvoice[];
  obligations: Obligation[];
  checkRuns: CheckRun[];
  policyAcks: PolicyAck[];
  agentRuns: AgentRun[];
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
