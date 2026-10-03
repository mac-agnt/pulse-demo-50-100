/* Neutral sample organisation. Removable: nothing outside src/core/fixtures
   refers to these ids. Every count and figure the app shows is derived from
   these rows; nothing on screen is typed in separately. */

import { baseConfig, GENERIC_RECORD } from "../config";
import { addBusinessHours, addHours, DAY, HOUR, iso, ms } from "../time";
import type {
  Employment, LeaveEntry,
  Approval, AuditEvent, CoreData, CoreState, DataIssue, FileDoc, OrgConfig, Person, RecordItem,
  RequestItem, Schedule, Task, WorkflowRun, Id, FieldValue, FieldMeta
} from "../types";

export const SAMPLE_REFERENCE = "2026-03-11T10:00:00.000Z"; // a Wednesday
const TZ = "UTC";
const at = (h: number) => addHours(SAMPLE_REFERENCE, h);

function sampleConfig(): OrgConfig {
  const c = baseConfig();
  c.workspace = { id: "example-org", name: "Example Organisation", shortName: "EO" };
  c.referenceDate = SAMPLE_REFERENCE;
  c.timezone = TZ;
  c.capabilities.units = true;
  c.units = [
    { id: "u-north", label: "Unit North", ownerId: "p-casey", group: "Region A", status: "operating", location: "North office" },
    { id: "u-south", label: "Unit South", ownerId: "p-avery", group: "Region B", status: "operating", location: "South office" },
    { id: "u-east", label: "Unit East", ownerId: "p-robin", group: "Region A", status: "planned", location: "Opening next quarter" }
  ];
  c.people = {
    requiredCertifications: [{ name: "Health and safety induction", everyMonths: 36 }, { name: "Data protection", everyMonths: 12 }, { name: "First aid", everyMonths: 24 }],
    onboardingChecklist: ["Contract signed", "Accounts and access set up", "Introductions to the team", "First week check-in", "Required training booked"],
    offboardingChecklist: ["Handover notes written", "Open work reassigned", "Access removed", "Equipment returned", "Exit conversation"],
    probationMonths: 6,
    accessReviewEveryDays: 180
  };
  c.teams = [
    { id: "t-a", label: "Team A", unitId: "u-north", ownerId: "p-jordan", queueLabel: "Team A queue" },
    { id: "t-b", label: "Team B", unitId: "u-north", ownerId: "p-riley", queueLabel: "Team B queue" },
    { id: "t-c", label: "Team C", unitId: "u-south", ownerId: "p-avery", queueLabel: "Team C queue" }
  ];
  const rec = structuredClone(GENERIC_RECORD);
  rec.fields.find((f) => f.key === "category")!.options = [
    { value: "general", label: "General" }, { value: "review", label: "Review" },
    { value: "operational", label: "Operational" }, { value: "policy", label: "Policy" }
  ];
  c.recordTypes = [
    rec,
    { id: "organisation", label: "Organisation", plural: "Organisations", defaultVisibility: "organisation",
      fields: [
        { key: "reference", label: "Reference", kind: "text", required: true },
        { key: "contactEmail", label: "Contact email", kind: "email", required: true, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
        { key: "category", label: "Category", kind: "select", required: false, options: rec.fields[1].options }
      ],
      statuses: [{ id: "active", label: "Active", tone: "ok" }, { id: "inactive", label: "Inactive", tone: "neutral", closed: true }] }
  ];
  c.requestForms = [
    { id: "form-doc-review", label: "Document review", description: "Ask for a document version to be reviewed and approved.",
      fields: [
        { key: "fileId", label: "Document", kind: "file", required: true, material: true },
        { key: "summary", label: "What changed", kind: "longtext", required: true },
        { key: "neededBy", label: "Needed by", kind: "date", required: false }
      ],
      evidenceRequired: false, approvalRuleId: "rule-doc",
      tasks: [{ title: "Read and annotate the document", checklist: ["Check against the previous version", "Note any open questions"] }],
      effect: { kind: "approve-file-version", label: "Mark the reviewed version as approved" }, enabled: true },
    { id: "form-correction", label: "Information correction", description: "Correct a value on a record, with evidence.",
      fields: [
        { key: "recordId", label: "Record", kind: "record", required: true, material: true },
        { key: "field", label: "Field", kind: "text", required: true, material: true },
        { key: "newValue", label: "Correct value", kind: "text", required: true, material: true },
        { key: "reason", label: "Reason", kind: "longtext", required: true }
      ],
      evidenceRequired: true, approvalRuleId: "rule-correction",
      tasks: [{ title: "Check the source for the same value", checklist: ["Compare with the source system", "Attach what you found"] }],
      effect: { kind: "apply-correction", label: "Apply the correction to the record" }, enabled: true },
    { id: "form-internal", label: "Internal request", description: "Ask another part of the organisation for something.",
      fields: [
        { key: "description", label: "What is needed", kind: "longtext", required: true, material: true },
        { key: "neededBy", label: "Needed by", kind: "date", required: true },
        { key: "value", label: "Estimated value", kind: "money", currency: "EUR", required: false, material: true, min: 0,
          help: "Above 1,000 a second decision from the unit lead is needed." }
      ],
      evidenceRequired: false, approvalRuleId: "rule-internal",
      tasks: [{ title: "Confirm the request details with the requester" }],
      effect: { kind: "create-fulfilment-task", label: "Create a fulfilment task for the team" }, enabled: true },
    { id: "form-leave", label: "Leave request", description: "Ask for time off. Your team manager decides.",
      fields: [
        { key: "kind", label: "Type", kind: "select", required: true, material: true,
          options: [{ value: "annual", label: "Annual leave" }, { value: "training", label: "Training" }, { value: "other", label: "Other" }] },
        { key: "from", label: "From", kind: "date", required: true, material: true },
        { key: "to", label: "To", kind: "date", required: true, material: true },
        { key: "note", label: "Note", kind: "longtext", required: false }
      ],
      evidenceRequired: false, approvalRuleId: "rule-leave", tasks: [],
      effect: { kind: "record-leave", label: "Add the leave to the team calendar" }, enabled: true },
    { id: "form-external", label: "External confirmation", description: "Send a confirmation to an external contact once approved.",
      fields: [
        { key: "contactId", label: "Contact", kind: "person", required: true, material: true },
        { key: "message", label: "Message", kind: "longtext", required: true, material: true }
      ],
      evidenceRequired: false, approvalRuleId: "rule-external", tasks: [],
      effect: { kind: "notify-external", label: "Send the message through the email connection" }, enabled: true }
  ];
  c.approvalRules = [
    { id: "rule-doc", label: "Document review", formId: "form-doc-review", prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
      stages: [{ id: "st-mgr", label: "Team manager", eligibleRoles: ["team_manager"], scope: "requester-team" }] },
    { id: "rule-correction", label: "Information correction", formId: "form-correction", prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
      stages: [
        { id: "st-mgr", label: "Team manager", eligibleRoles: ["team_manager"], scope: "requester-team" },
        { id: "st-owner", label: "Data owner", eligibleRoles: ["admin"], scope: "organisation" }
      ] },
    { id: "rule-internal", label: "Internal request", formId: "form-internal", prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
      stages: [
        { id: "st-mgr", label: "Team manager", eligibleRoles: ["team_manager"], scope: "requester-team" },
        { id: "st-unit", label: "Unit lead", eligibleRoles: ["team_manager", "admin"], scope: "requester-unit", when: { field: "value", over: 1000 } }
      ] },
    { id: "rule-leave", label: "Leave request", formId: "form-leave", prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
      stages: [{ id: "st-mgr", label: "Team manager", eligibleRoles: ["team_manager"], scope: "requester-team" }] },
    { id: "rule-external", label: "External confirmation", formId: "form-external", prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
      stages: [{ id: "st-mgr", label: "Team manager", eligibleRoles: ["team_manager"], scope: "requester-team" }] }
  ];
  c.workflowTemplates = [
    { id: "wf-doc-review", label: "Document review", description: "Review a document version and record the decision.", ownerId: "p-jordan",
      trigger: { kind: "event", detail: "A document review request is submitted" }, enabled: true,
      steps: [
        { id: "s-task", label: "Create review task", kind: "task", effect: "local" },
        { id: "s-approval", label: "Collect decision", kind: "approval" },
        { id: "s-apply", label: "Mark version approved", kind: "action", effect: "local" },
        { id: "s-notify", label: "Notify requester in Pulse", kind: "notify", effect: "local" }
      ] },
    { id: "wf-correction", label: "Information correction", description: "Validate, approve and apply a correction, then offer it to the source.", ownerId: "p-robin",
      trigger: { kind: "event", detail: "An information correction request is submitted" }, enabled: true,
      steps: [
        { id: "s-validate", label: "Validate the field", kind: "check" },
        { id: "s-approval", label: "Collect decisions", kind: "approval" },
        { id: "s-apply", label: "Apply correction in Pulse", kind: "action", effect: "local" },
        { id: "s-writeback", label: "Write back to source", kind: "action", effect: "external" },
        { id: "s-notify", label: "Notify requester in Pulse", kind: "notify", effect: "local" }
      ] },
    { id: "wf-weekly-check", label: "Weekly data check", description: "Find missing required fields and give each gap an owner.", ownerId: "p-robin",
      trigger: { kind: "schedule", detail: "Every Monday at 09:00 (UTC)" }, enabled: true,
      steps: [
        { id: "s-scan", label: "Scan required fields", kind: "check" },
        { id: "s-open", label: "Open issues for gaps", kind: "action", effect: "local" },
        { id: "s-assign", label: "Create review task for the team", kind: "task", effect: "local" },
        { id: "s-summary", label: "Post summary in Pulse", kind: "notify", effect: "local" }
      ] }
  ];
  c.sources = [
    { id: "pulse", label: "Pulse (entered here)", kind: "pulse", connected: true, prerequisite: "" },
    { id: "s-sample", label: "Sample source system", kind: "sample", connected: false,
      prerequisite: "Simulated in sample mode. A real connection needs credentials and a field mapping, set up in Settings > Systems." },
    { id: "s-import", label: "Sample spreadsheet import", kind: "sample", connected: false,
      prerequisite: "Simulated in sample mode. A real import needs a file and a column mapping." },
    { id: "s-email", label: "Email delivery", kind: "external", connected: false,
      prerequisite: "Not connected. Sending needs an email provider and a verified sender. Nothing is sent from this demo." }
  ];
  c.fieldMappings = [
    { id: "fm-1", recordTypeId: "record", fieldKey: "contactEmail", sourceId: "s-sample", sourceField: "contact_email", authority: "source", writeBack: false },
    { id: "fm-2", recordTypeId: "record", fieldKey: "category", sourceId: "s-sample", sourceField: "category_code", authority: "source", writeBack: false },
    { id: "fm-3", recordTypeId: "record", fieldKey: "reviewDate", sourceId: "pulse", sourceField: "", authority: "pulse", writeBack: false },
    { id: "fm-4", recordTypeId: "record", fieldKey: "reference", sourceId: "s-sample", sourceField: "ref", authority: "source", writeBack: false }
  ];
  c.codeMappings = [
    { id: "cm-1", sourceId: "s-sample", field: "category", from: "GEN", to: "general" },
    { id: "cm-2", sourceId: "s-sample", field: "category", from: "REV", to: "review" },
    { id: "cm-3", sourceId: "s-sample", field: "category", from: "OPS", to: "operational" }
  ];
  c.agents = [
    { id: "ag-briefing", name: "Briefing assistant", purpose: "Summarises what changed in your scope and links the evidence.",
      responsibleId: "p-casey", scope: { teamIds: "all" }, permittedActions: ["Read records, tasks and approvals in the asker's scope"],
      approvalRequired: [], shape: "crown-pebble", tint: "#191c1f", enabled: true },
    { id: "ag-steward", name: "Data steward", purpose: "Finds missing and conflicting data and opens review tasks.",
      responsibleId: "p-robin", scope: { teamIds: "all" }, permittedActions: ["Read records", "Open data issues", "Create review tasks"],
      approvalRequired: ["Change a record value", "Merge records"], shape: "executive-capsule", tint: "#2a2118", enabled: true },
    { id: "ag-intake", name: "Request intake", purpose: "Drafts requests from a conversation for a person to check and submit.",
      responsibleId: "p-jordan", scope: { teamIds: ["t-a", "t-b"] }, permittedActions: ["Draft requests"],
      approvalRequired: ["Submit a request"], shape: "rim-capsule", tint: "#1b2430", enabled: true }
  ];
  c.metrics.find((m) => m.id === "approvedValue")!.enabled = true;
  return c;
}

/* ── People ────────────────────────────────────────────────────────────── */

const P = (id: string, name: string, title: string, kind: Person["kind"] = "staff", organisation?: string): Person => ({
  id, name, title, kind, status: "active", organisation,
  email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.org"
});

const PEOPLE: Person[] = [
  P("p-robin", "Robin Hale", "Operations administrator"),
  P("p-casey", "Casey Lund", "Unit North lead"),
  P("p-jordan", "Jordan Price", "Team A manager"),
  P("p-riley", "Riley Shaw", "Team B manager"),
  P("p-avery", "Avery Cole", "Team C manager"),
  P("p-morgan", "Morgan Ellis", "Coordinator"),
  P("p-taylor", "Taylor Brooks", "Coordinator"),
  P("p-jamie", "Jamie Reed", "Analyst"),
  P("p-sam", "Sam Okafor", "Analyst"),
  P("p-quinn", "Quinn Foster", "Coordinator"),
  P("p-drew", "Drew Patel", "Analyst"),
  P("x-lee", "Lee Carter", "External contact", "external", "Partner organisation 1"),
  P("x-ari", "Ari Novak", "External contact", "external", "Partner organisation 2"),
  P("x-kim", "Kim Larsen", "External contact", "external", "Partner organisation 3")
];
PEOPLE.find((p) => p.id === "p-sam")!.status = "invited";

const MEMBERSHIPS = [
  ["p-robin", "t-a"], ["p-casey", "t-a"], ["p-jordan", "t-a"], ["p-morgan", "t-a"], ["p-taylor", "t-a"], ["p-taylor", "t-b"],
  ["p-riley", "t-b"], ["p-jamie", "t-b"], ["p-sam", "t-b"], ["p-avery", "t-c"], ["p-quinn", "t-c"], ["p-drew", "t-c"]
].map(([personId, teamId]) => ({ personId, teamId }));

const ROLE_ASSIGNMENTS = [
  { id: "ra-1", personId: "p-robin", roleId: "admin", scope: { kind: "organisation" as const } },
  { id: "ra-2", personId: "p-casey", roleId: "team_manager", scope: { kind: "unit" as const, unitId: "u-north" } },
  { id: "ra-3", personId: "p-jordan", roleId: "team_manager", scope: { kind: "team" as const, teamId: "t-a" } },
  { id: "ra-4", personId: "p-riley", roleId: "team_manager", scope: { kind: "team" as const, teamId: "t-b" } },
  { id: "ra-5", personId: "p-avery", roleId: "team_manager", scope: { kind: "team" as const, teamId: "t-c" } },
  ...["p-morgan", "p-taylor", "p-jamie", "p-sam", "p-quinn", "p-drew"].map((personId, i) =>
    ({ id: "ra-c" + i, personId, roleId: "contributor", scope: { kind: "organisation" as const } }))
];

/* ── Employment ────────────────────────────────────────────────────────── */

const CERT = (name: string, h: number | null, every?: number) => ({ id: "c-" + name.toLowerCase().replace(/[^a-z]+/g, "-"), name, expires: h === null ? null : at(h), renewEveryMonths: every });
const SAFETY = (h: number | null) => CERT("Health and safety induction", h, 36);
const DATA = (h: number | null) => CERT("Data protection", h, 12);
const AID = (h: number | null) => CERT("First aid", h, 24);
const DOC = (id: string, title: string, sentH: number, signedH: number | null) => ({ id, title, sentAt: at(sentH), signedAt: signedH === null ? null : at(signedH) });
const DY = 24;

const EMPLOYMENT: Employment[] = [
  { personId: "p-robin", teamId: "t-a", unitId: "u-north", contract: "full-time", hoursPerWeek: 39, stage: "active", startDate: at(-DY * 2900),
    certifications: [SAFETY(DY * 400), DATA(DY * 120), AID(DY * 300)], documents: [DOC("d-hb-r", "Staff handbook, current edition", -DY * 20, -DY * 19)], lastAccessReview: at(-DY * 40) },
  { personId: "p-casey", teamId: "t-a", unitId: "u-north", managerId: "p-robin", contract: "full-time", hoursPerWeek: 39, stage: "active", startDate: at(-DY * 2100),
    certifications: [SAFETY(DY * 200), DATA(DY * 18), AID(DY * 500)], documents: [DOC("d-hb-c", "Staff handbook, current edition", -DY * 20, -DY * 18)], lastAccessReview: at(-DY * 40) },
  { personId: "p-jordan", teamId: "t-a", unitId: "u-north", managerId: "p-casey", contract: "full-time", hoursPerWeek: 39, stage: "active", startDate: at(-DY * 1500),
    certifications: [SAFETY(DY * 640), DATA(DY * 9), AID(null)], documents: [DOC("d-hb-j", "Staff handbook, current edition", -DY * 20, -DY * 15)], lastAccessReview: at(-DY * 200) },
  { personId: "p-riley", teamId: "t-b", unitId: "u-north", managerId: "p-casey", contract: "full-time", hoursPerWeek: 39, stage: "active", startDate: at(-DY * 1300),
    certifications: [SAFETY(DY * 90), DATA(DY * 200), AID(DY * 60)], documents: [DOC("d-hb-ri", "Staff handbook, current edition", -DY * 20, null)], lastAccessReview: at(-DY * 60) },
  { personId: "p-avery", teamId: "t-c", unitId: "u-south", managerId: "p-robin", contract: "full-time", hoursPerWeek: 39, stage: "active", startDate: at(-DY * 1800),
    certifications: [SAFETY(DY * 700), DATA(-DY * 6), AID(DY * 400)], documents: [DOC("d-hb-a", "Staff handbook, current edition", -DY * 20, -DY * 17)], lastAccessReview: at(-DY * 210) },
  { personId: "p-morgan", teamId: "t-a", unitId: "u-north", managerId: "p-jordan", contract: "full-time", hoursPerWeek: 39, stage: "active", startDate: at(-DY * 900),
    certifications: [SAFETY(DY * 300), DATA(DY * 25), AID(null)], documents: [DOC("d-hb-m", "Staff handbook, current edition", -DY * 20, -DY * 16)], lastAccessReview: at(-DY * 60) },
  { personId: "p-taylor", teamId: "t-a", unitId: "u-north", managerId: "p-jordan", contract: "part-time", hoursPerWeek: 24, stage: "probation", startDate: at(-DY * 160),
    probationEnds: at(DY * 22), certifications: [SAFETY(DY * 900), DATA(DY * 200), AID(null)],
    documents: [DOC("d-hb-t", "Staff handbook, current edition", -DY * 20, null), DOC("d-ct-t", "Employment contract", -DY * 170, -DY * 165)], lastAccessReview: at(-DY * 150) },
  { personId: "p-jamie", teamId: "t-b", unitId: "u-north", managerId: "p-riley", contract: "full-time", hoursPerWeek: 39, stage: "leaving", startDate: at(-DY * 700), endDate: at(DY * 16),
    certifications: [SAFETY(DY * 100), DATA(DY * 5), AID(null)], documents: [DOC("d-hb-ja", "Staff handbook, current edition", -DY * 20, -DY * 19)], lastAccessReview: at(-DY * 90) },
  { personId: "p-sam", teamId: "t-b", unitId: "u-north", managerId: "p-riley", contract: "full-time", hoursPerWeek: 39, stage: "onboarding", startDate: at(DY * 5),
    certifications: [SAFETY(null), DATA(null), AID(null)],
    documents: [DOC("d-ct-s", "Employment contract", -DY * 6, null), DOC("d-hb-s", "Staff handbook, current edition", -DY * 6, null)] },
  { personId: "p-quinn", teamId: "t-c", unitId: "u-south", managerId: "p-avery", contract: "part-time", hoursPerWeek: 20, stage: "probation", startDate: at(-DY * 140),
    probationEnds: at(DY * 41), certifications: [SAFETY(DY * 950), DATA(DY * 230), AID(null)], documents: [DOC("d-hb-q", "Staff handbook, current edition", -DY * 20, -DY * 12)], lastAccessReview: at(-DY * 140) },
  { personId: "p-drew", teamId: "t-c", unitId: "u-south", managerId: "p-avery", contract: "contractor", hoursPerWeek: 30, stage: "active", startDate: at(-DY * 420),
    certifications: [SAFETY(DY * 14), DATA(-DY * 30), AID(null)], documents: [DOC("d-hb-d", "Staff handbook, current edition", -DY * 20, null)], lastAccessReview: at(-DY * 300) }
];

const LEAVE: LeaveEntry[] = [
  { id: "lv-1", personId: "p-riley", kind: "annual", from: at(DY * 2), to: at(DY * 6), status: "approved" },
  { id: "lv-2", personId: "p-morgan", kind: "training", from: at(DY * 8), to: at(DY * 8), status: "approved" },
  { id: "lv-3", personId: "p-quinn", kind: "sick", from: at(-DY * 1), to: at(DY * 1), status: "approved" },
  { id: "lv-4", personId: "p-drew", kind: "annual", from: at(DY * 20), to: at(DY * 27), status: "approved" }
];

/* ── Records ───────────────────────────────────────────────────────────── */

const TITLES = ["Quarterly review", "Information request log", "Service record", "Policy acknowledgement", "Training record",
  "Incident report", "Audit finding", "Improvement idea", "Meeting outcome", "Access request", "Service agreement",
  "Annual review", "Change request", "Risk register entry", "Supplier-neutral contract record", "Onboarding checklist",
  "Feedback summary", "Procedure exception", "Inspection note", "Handover note"];
TITLES[14] = "Contract record";

function rec(i: number, team: Id, owner: Id, opts: Partial<RecordItem> & { fields?: Record<string, FieldValue>; src?: string; syncedH?: number } = {}): RecordItem {
  const n = 1001 + i;
  const unitId = team === "t-c" ? "u-south" : "u-north";
  const src = opts.src || (i % 3 === 0 ? "pulse" : "s-sample");
  const syncedAt = src === "pulse" ? null : at(opts.syncedH ?? -2);
  const cats = ["general", "review", "operational", "policy"];
  const fields: Record<string, FieldValue> = {
    reference: "REF-" + n, category: cats[i % 4], reviewDate: at(24 * (20 + i * 3)).slice(0, 10),
    contactEmail: "records" + n + "@example.org", ...(opts.fields || {})
  };
  const { fields: _f, src: _s, syncedH: _h, ...rest } = opts;
  void _f; void _s; void _h;
  const fieldMeta: Record<string, FieldMeta> = {};
  for (const k of Object.keys(fields)) {
    fieldMeta[k] = src === "pulse" || k === "reviewDate" ? { origin: "manual" } : { origin: "source", sourceId: src, sourceUpdatedAt: syncedAt || undefined };
  }
  return {
    id: "r-" + n, typeId: "record", ref: "REC-" + n, title: TITLES[i % TITLES.length], status: i % 7 === 6 ? "closed" : i % 5 === 4 ? "review" : "active",
    ownerId: owner, teamId: team, unitId, visibility: "team", fields, fieldMeta,
    sourceRefs: src === "pulse" ? [] : [{ sourceId: src, externalId: "SRC-" + (700 + i), syncedAt }],
    createdAt: at(-24 * (60 - i)), updatedAt: at(-24 * (i % 9) - 3), ...rest
  } as RecordItem;
}

const RECORDS: RecordItem[] = [
  rec(0, "t-a", "p-morgan"),
  rec(1, "t-a", "p-jordan"),
  rec(2, "t-a", "p-morgan", { fields: { reviewDate: null } }),
  rec(3, "t-a", "p-taylor", { fields: { category: null } }),
  rec(4, "t-b", "p-jamie", { fields: { contactEmail: "records-team@example.org" } }),
  rec(5, "t-b", "p-riley"),
  rec(6, "t-b", "p-taylor"),
  rec(7, "t-a", "p-casey"),
  rec(8, "t-b", "p-jamie", { fields: { reviewDate: null } }),
  rec(9, "t-a", "p-jordan"),
  rec(10, "t-b", "p-sam"),
  rec(11, "t-a", "p-morgan"),
  rec(12, "t-c", "p-quinn", { src: "s-sample", syncedH: -98 }),
  rec(13, "t-c", "p-drew", { src: "s-sample", syncedH: -98, fields: { category: null } }),
  rec(14, "t-c", "p-avery", { src: "s-sample", syncedH: -98 }),
  rec(15, "t-c", "p-quinn", { src: "s-sample", syncedH: -98, fields: { reference: null } }),
  rec(16, "t-b", "p-riley"),
  rec(17, "t-a", "p-robin", { visibility: "owner" }),
  rec(18, "t-c", "p-drew", { src: "s-sample", syncedH: -98 }),
  rec(19, "t-b", "p-jamie")
];
// The unmapped code arrives raw from the source and is kept, not guessed.
RECORDS[3].fields.category = null;
RECORDS[3].fieldMeta.category = { origin: "source", sourceId: "s-sample", sourceUpdatedAt: at(-2) };
// Conflict: Pulse holds a manual correction, the source holds a newer value.
RECORDS[4].fields.contactEmail = "records-team@example.org";
RECORDS[4].fieldMeta.contactEmail = { origin: "manual" };

const org = (i: number, title: string, email: string | null, extra: Partial<RecordItem> = {}): RecordItem => ({
  id: "o-0" + i, typeId: "organisation", ref: "ORG-0" + i, title, status: "active", ownerId: "p-robin",
  visibility: "organisation", fields: { reference: "ORG-0" + i, contactEmail: email, category: "general" },
  fieldMeta: { reference: { origin: "source", sourceId: "s-import", sourceUpdatedAt: at(-2) }, contactEmail: { origin: "source", sourceId: "s-import", sourceUpdatedAt: at(-2) } },
  sourceRefs: [{ sourceId: "s-import", externalId: "IMP-" + (40 + i), syncedAt: at(-2) }],
  createdAt: at(-24 * 90), updatedAt: at(-24 * 4), ...extra
});
const ORGS: RecordItem[] = [
  org(1, "Partner organisation 1", "hello@partner-one.example"),
  org(2, "Partner organisation 2", "office@partner-two.example"),
  org(3, "Partner organisation 3", "contact@partner-three.example"),
  org(4, "Partner Organisation One", "hello@partner-one.example", {
    fieldMeta: { reference: { origin: "manual" }, contactEmail: { origin: "manual" } }, sourceRefs: [] })
];

const RELATIONSHIPS = [
  ["r-1001", "r-1002", "relates to"], ["r-1002", "r-1003", "follows up"], ["r-1005", "o-01", "belongs to"],
  ["r-1006", "o-02", "belongs to"], ["r-1013", "o-03", "belongs to"], ["r-1008", "r-1001", "relates to"],
  ["r-1010", "o-01", "belongs to"]
].map(([fromId, toId, label], i) => ({ id: "rel-" + i, fromId, toId, label }));

/* ── Files ─────────────────────────────────────────────────────────────── */

const V = (id: string, n: number, h: number, by: Id, note: string, sizeKb: number, approved?: boolean) => ({ id, n, addedAt: at(h), addedBy: by, note, sizeKb, approved });
const FILES: FileDoc[] = [
  { id: "f-handbook", title: "Team handbook", kind: "Document", ownerId: "p-robin", visibility: "organisation", linkedRecordIds: ["r-1001"],
    versions: [V("fv-1", 1, -24 * 200, "p-robin", "First issue", 220, true), V("fv-2", 2, -24 * 90, "p-robin", "Added escalation section", 236, true),
      V("fv-3", 3, -24 * 6, "p-casey", "Updated contacts", 241, true)],
    effectiveDate: at(-24 * 6), reviewDate: at(24 * 180), summary: "How teams share work, raise requests and escalate decisions.", sourceId: "pulse" },
  { id: "f-procedure", title: "Review procedure", kind: "Procedure", ownerId: "p-jordan", teamId: "t-a", unitId: "u-north", visibility: "team",
    linkedRecordIds: ["r-1002", "r-1003"],
    versions: [V("fv-4", 1, -24 * 120, "p-jordan", "Approved procedure", 88, true), V("fv-5", 2, -5, "p-morgan", "Revised steps 3 to 5", 92)],
    effectiveDate: at(-24 * 120), reviewDate: at(-24 * 2), summary: "Steps for reviewing a record before it is closed.", sourceId: "pulse" },
  { id: "f-minutes", title: "Meeting notes, March", kind: "Notes", ownerId: "p-riley", teamId: "t-b", unitId: "u-north", visibility: "team",
    linkedRecordIds: ["r-1009"], versions: [V("fv-6", 1, -24 * 3, "p-jamie", "Draft notes", 34)],
    effectiveDate: at(-24 * 3), summary: "Notes from the Team B planning meeting.", sourceId: "pulse" },
  { id: "f-evidence", title: "Correction evidence, source extract", kind: "Evidence", ownerId: "p-taylor", teamId: "t-b", unitId: "u-north", visibility: "team",
    linkedRecordIds: ["r-1005"], versions: [V("fv-7", 1, -31, "p-taylor", "Extract from the source system", 12)],
    summary: "Extract showing the contact email held in the source system.", sourceId: "s-sample" },
  { id: "f-report", title: "Quarterly report draft", kind: "Report", ownerId: "p-avery", teamId: "t-c", unitId: "u-south", visibility: "team",
    linkedRecordIds: ["r-1013"], versions: [V("fv-8", 1, -24 * 2, "p-quinn", "Draft for review", 410)],
    summary: "Unit South quarterly summary, draft.", sourceId: "pulse" },
  { id: "f-access", title: "Access policy", kind: "Policy", ownerId: "p-robin", visibility: "organisation", restrictedTo: ["p-robin"],
    linkedRecordIds: ["r-1018"], versions: [V("fv-9", 1, -24 * 40, "p-robin", "Restricted policy", 64, true)],
    effectiveDate: at(-24 * 40), reviewDate: at(24 * 325), summary: "Who may grant access to restricted records. Restricted at source.", sourceId: "pulse" }
];

const MORE_FILES: [string, string, string, Id, Id | undefined, number, number | null, string, Id[]][] = [
  ["f-conduct", "Code of conduct", "Policy", "p-robin", undefined, 3, 24 * 200, "How everyone is expected to work with colleagues and the people we serve.", ["r-1004"]],
  ["f-leave", "Leave policy", "Policy", "p-robin", undefined, 2, 24 * 140, "Annual leave, training days and how leave requests are approved.", []],
  ["f-hs", "Health and safety statement", "Policy", "p-robin", undefined, 4, -24 * 5, "Responsibilities, the induction and how incidents are reported.", ["r-1006"]],
  ["f-incident", "Incident report template", "Template", "p-avery", "t-c", 1, null, "The form used to record an incident and the follow-up.", ["r-1006"]],
  ["f-handover", "Handover note template", "Template", "p-jordan", "t-a", 2, null, "Open items, blockers and the first job for tomorrow.", ["r-1020"]],
  ["f-minutes-feb", "Meeting notes, February", "Notes", "p-riley", "t-b", 1, null, "Notes from the Team B planning meeting in February.", ["r-1009"]],
  ["f-risk", "Risk register export", "Report", "p-casey", "t-a", 3, 24 * 30, "Open risks with owners and review dates, exported from the register.", ["r-1014"]],
  ["f-service", "Service levels", "Procedure", "p-casey", "t-a", 2, 24 * 90, "Response and resolution targets the teams work to.", ["r-1003", "r-1011"]],
  ["f-onboard", "Onboarding guide", "Procedure", "p-robin", undefined, 2, 24 * 220, "The first two weeks for a new starter, step by step.", ["r-1016"]],
  ["f-southreport", "Unit South monthly summary", "Report", "p-avery", "t-c", 1, null, "Monthly summary for Unit South.", ["r-1013"]]
];
MORE_FILES.forEach(([id, title, kind, owner, team, versions, reviewH, summary, linked], k) => FILES.push({
  id, title, kind, ownerId: owner, teamId: team, unitId: team === "t-c" ? "u-south" : team ? "u-north" : undefined, visibility: team ? "team" : "organisation",
  linkedRecordIds: linked,
  versions: Array.from({ length: versions }, (_, i) => V("fv-" + id + "-" + (i + 1), i + 1, -24 * (40 * (versions - i) + k), owner, i === 0 ? "First issue" : "Revised", 40 + i * 6, i < versions - 1 || kind === "Policy")),
  effectiveDate: at(-24 * (20 + k * 3)), reviewDate: reviewH === null ? undefined : at(reviewH), summary, sourceId: "pulse" }));

/* ── Requests and approvals ────────────────────────────────────────────── */

let decisionN = 0;
const D = (stageId: string, actorId: Id, kind: Approval["decisions"][number]["kind"], comment: string, h: number, requestVersion = 1, cycle = 1, onBehalfOfId?: Id) =>
  ({ id: "d-" + (++decisionN), stageId, actorId, kind, comment, at: at(h), requestVersion, cycle, onBehalfOfId });

function request(n: number, formId: string, title: string, requesterId: Id, teamId: Id, fields: Record<string, FieldValue>, h: number, extra: Partial<RequestItem> = {}): RequestItem {
  const unitId = teamId === "t-c" ? "u-south" : "u-north";
  return {
    id: "req-" + n, ref: "REQ-" + (200 + n), formId, title, requesterId, teamId, unitId, fields, version: 1,
    versions: [{ n: 1, fields: { ...fields }, at: at(h), by: requesterId, note: "Submitted" }],
    status: "submitted", evidenceFileIds: [], linkedRecordIds: [], taskIds: [],
    execution: { status: "not_started", effect: "", attempts: 0, appliedKeys: [] },
    createdAt: at(h - 0.5), updatedAt: at(h), createdBy: requesterId, ...extra
  };
}

const sla = (h: number, hours = 16) => addBusinessHours(at(h), hours, TZ);

const REQUESTS: RequestItem[] = [
  request(1, "form-doc-review", "Review of Review procedure v2", "p-morgan", "t-a", { fileId: "f-procedure", summary: "Steps 3 to 5 rewritten after the March audit.", neededBy: at(24 * 3).slice(0, 10) }, -3,
    { linkedRecordIds: ["r-1002"], approvalId: "ap-1", taskIds: ["t-req1"] }),
  request(2, "form-correction", "Correct contact email on REC-1005", "p-taylor", "t-b", { recordId: "r-1005", field: "contactEmail", newValue: "records.b@example.org", reason: "The source extract shows a different address to Pulse." }, -30,
    { linkedRecordIds: ["r-1005"], evidenceFileIds: ["f-evidence"], approvalId: "ap-2", taskIds: ["t-req2"] }),
  request(3, "form-internal", "Replacement access cards", "p-jamie", "t-b", { description: "Six replacement access cards for new starters.", neededBy: at(24 * 6).slice(0, 10), value: 1450 }, -124,
    { approvalId: "ap-3", taskIds: ["t-req3"] }),
  request(4, "form-internal", "Room booking for training day", "p-quinn", "t-c", { description: "Training room for one day.", neededBy: at(24 * 12).slice(0, 10), value: 200 }, -50,
    { approvalId: "ap-4", status: "changes_requested", taskIds: [] }),
  request(5, "form-correction", "Correct category on REC-1002", "p-morgan", "t-a", { recordId: "r-1002", field: "category", newValue: "review", reason: "Record is a review item." }, -24 * 9,
    { linkedRecordIds: ["r-1002"], approvalId: "ap-5", status: "approved", evidenceFileIds: ["f-procedure"],
      execution: { status: "succeeded", effect: "Category set to review on REC-1002", attempts: 1, appliedKeys: ["req-5:v1:apply-correction"], executedAt: at(-24 * 8) } }),
  request(6, "form-doc-review", "Review of Meeting notes, March", "p-jamie", "t-b", { fileId: "f-minutes", summary: "Draft notes ready." }, -24 * 2,
    { approvalId: "ap-6", status: "declined", linkedRecordIds: ["r-1009"] }),
  request(7, "form-external", "Confirm arrangements with Lee Carter", "p-drew", "t-c", { contactId: "x-lee", message: "Confirming the meeting on the 18th." }, -26,
    { approvalId: "ap-7", status: "approved",
      execution: { status: "failed", effect: "Send the message through the email connection", attempts: 1, appliedKeys: [],
        lastError: "Email delivery is not connected. Nothing was sent.", executedAt: at(-6) } }),
  request(8, "form-internal", "Desk equipment for new starter", "p-morgan", "t-a", { description: "Monitor and keyboard.", neededBy: at(-24 * 2).slice(0, 10), value: 300 }, -24 * 6,
    { approvalId: "ap-8", status: "approved", taskIds: ["t-ful8"],
      execution: { status: "succeeded", effect: "Fulfilment task created for Team A", attempts: 1, appliedKeys: ["req-8:v1:create-fulfilment-task"], executedAt: at(-24 * 5) } }),
  request(9, "form-correction", "Correct reference on REC-1009", "p-taylor", "t-a", { recordId: "r-1009", field: "reference", newValue: "REF-1009-A", reason: "Reference changed after re-filing." }, -24 * 3,
    { linkedRecordIds: ["r-1009"], approvalId: "ap-9", version: 2, evidenceFileIds: ["f-procedure"] }),
  request(10, "form-doc-review", "Review of Quarterly report draft", "p-quinn", "t-c", { fileId: "f-report", summary: "First draft for Unit South." }, -7,
    { approvalId: "ap-10", linkedRecordIds: ["r-1013"] }),
  request(11, "form-internal", "Shared planning software seats", "p-casey", "t-a", { description: "Four seats for the planning tool.", neededBy: at(24 * 14).slice(0, 10), value: 2500 }, -5,
    { approvalId: "ap-11" }),
  request(12, "form-internal", "Replacement laptops for Team B", "p-taylor", "t-b", { description: "Two laptops past their replacement date.", neededBy: at(24 * 10).slice(0, 10), value: 1800 }, -28,
    { approvalId: "ap-12" })
];
REQUESTS[8].versions.push({ n: 2, fields: { ...REQUESTS[8].fields, newValue: "REF-1009-B" }, at: at(-24 * 1), by: "p-taylor", note: "Changed the correct value after approval" });
REQUESTS[8].fields.newValue = "REF-1009-B";

const stage = (stageId: string, label: string, roles: string[], assigneeId: Id | null, status: Approval["stages"][number]["status"], startedH?: number, extra = {}) =>
  ({ stageId, label, eligibleRoles: roles, assigneeId, status, startedAt: startedH === undefined ? undefined : at(startedH), dueAt: startedH === undefined ? undefined : sla(startedH), ...extra });

const APPROVALS: Approval[] = [
  { id: "ap-1", requestId: "req-1", ruleId: "rule-doc", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-3), decisions: [],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-jordan", "pending", -3)] },
  { id: "ap-2", requestId: "req-2", ruleId: "rule-correction", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-30),
    decisions: [D("st-mgr", "p-riley", "approve", "Evidence matches the source extract.", -27)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-riley", "approved", -30),
      stage("st-owner", "Data owner", ["admin"], "p-robin", "pending", -27)] },
  { id: "ap-3", requestId: "req-3", ruleId: "rule-internal", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-124), decisions: [],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-riley", "pending", -124),
      stage("st-unit", "Unit lead", ["team_manager", "admin"], "p-casey", "waiting")] },
  { id: "ap-4", requestId: "req-4", ruleId: "rule-internal", cycle: 1, reviewingVersion: 1, status: "returned", submittedAt: at(-50),
    decisions: [D("st-mgr", "p-avery", "return", "Add the date and expected numbers, then resubmit.", -44)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-avery", "returned", -50)] },
  { id: "ap-5", requestId: "req-5", ruleId: "rule-correction", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-24 * 9), decidedAt: at(-24 * 8 - 2),
    decisions: [D("st-mgr", "p-jordan", "approve", "Agreed.", -24 * 9 + 4), D("st-owner", "p-robin", "approve", "Category list allows it.", -24 * 8 - 2)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-jordan", "approved", -24 * 9), stage("st-owner", "Data owner", ["admin"], "p-robin", "approved", -24 * 9 + 4)] },
  { id: "ap-6", requestId: "req-6", ruleId: "rule-doc", cycle: 1, reviewingVersion: 1, status: "declined", submittedAt: at(-24 * 2), decidedAt: at(-24 * 2 + 5),
    decisions: [D("st-mgr", "p-riley", "decline", "Superseded by the updated notes due Friday.", -24 * 2 + 5)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-riley", "declined", -24 * 2)] },
  { id: "ap-7", requestId: "req-7", ruleId: "rule-external", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-26), decidedAt: at(-7),
    decisions: [D("st-mgr", "p-avery", "approve", "Fine to send.", -7)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-avery", "approved", -26)] },
  { id: "ap-8", requestId: "req-8", ruleId: "rule-internal", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-24 * 6), decidedAt: at(-24 * 5 - 3),
    decisions: [D("st-mgr", "p-jordan", "approve", "Approved.", -24 * 5 - 3)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-jordan", "approved", -24 * 6), stage("st-unit", "Unit lead", ["team_manager", "admin"], null, "skipped")] },
  { id: "ap-9", requestId: "req-9", ruleId: "rule-correction", cycle: 2, reviewingVersion: 2, status: "pending", submittedAt: at(-24 * 1),
    policyException: "A material field changed after approval, so the earlier approval no longer applies.",
    decisions: [D("st-mgr", "p-jordan", "approve", "Agreed.", -24 * 3 + 3), D("st-owner", "p-robin", "approve", "Fine.", -24 * 2)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-jordan", "pending", -24 * 1), stage("st-owner", "Data owner", ["admin"], "p-robin", "waiting")] },
  { id: "ap-10", requestId: "req-10", ruleId: "rule-doc", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-7), decisions: [],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-avery", "pending", -7)] },
  { id: "ap-11", requestId: "req-11", ruleId: "rule-internal", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-5), decisions: [],
    policyException: "The requester is also the unit lead, so the unit lead stage routes to an administrator.",
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-jordan", "pending", -5),
      stage("st-unit", "Unit lead", ["team_manager", "admin"], "p-robin", "waiting")] },
  { id: "ap-12", requestId: "req-12", ruleId: "rule-internal", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-28),
    decisions: [D("st-mgr", "p-riley", "approve", "Both machines are out of warranty.", -26)],
    stages: [stage("st-mgr", "Team manager", ["team_manager"], "p-riley", "approved", -28),
      stage("st-unit", "Unit lead", ["team_manager", "admin"], "p-casey", "pending", -26)] }
];

/* ── Tasks ─────────────────────────────────────────────────────────────── */

let taskN = 0;
function task(title: string, teamId: Id, assigneeId: Id | null, opts: Partial<Task> & { dueH?: number; doneH?: number; createdH?: number } = {}): Task {
  const id = opts.id || "t-" + String(++taskN).padStart(2, "0");
  const { dueH, doneH, createdH, ...rest } = opts;
  return {
    id, title, teamId, unitId: teamId === "t-c" ? "u-south" : "u-north", assigneeId,
    linkedRecordIds: [], priority: "normal", status: doneH !== undefined ? "done" : "open",
    dueAt: dueH === undefined ? undefined : at(dueH), completedAt: doneH === undefined ? undefined : at(doneH),
    dependsOn: [], checklist: [], notes: [], evidenceFileIds: [], createdAt: at(createdH ?? (dueH !== undefined ? dueH - 24 * 5 : -24 * 3)),
    createdBy: assigneeId || "p-robin", slaPolicyId: "sla-task", claimedAt: assigneeId ? at(-24 * 4) : undefined, ...rest
  };
}
const cl = (labels: string[], done = 0) => labels.map((label, i) => ({ id: "c" + i, label, done: i < done }));

const TASKS: Task[] = [
  // Open, overdue and upcoming
  task("Update the review checklist", "t-a", "p-morgan", { dueH: -26, priority: "high", linkedRecordIds: ["r-1001"], checklist: cl(["Draft changes", "Share with team"], 1) }),
  task("Confirm attendee list for planning day", "t-b", "p-jamie", { dueH: -4, status: "in_progress" }),
  task("Chase missing review dates", "t-c", "p-quinn", { dueH: -50, priority: "high", linkedRecordIds: ["r-1013", "r-1016"] }),
  task("Publish revised procedure", "t-a", "p-morgan", { id: "t-publish", dueH: 30, dependsOn: ["t-signoff"], linkedRecordIds: ["r-1002"],
    completionCriteria: "Version 2 approved and linked to the procedure record." }),
  task("Collect sign-off on procedure draft", "t-a", "p-jordan", { id: "t-signoff", dueH: 6, priority: "high", linkedRecordIds: ["r-1002"] }),
  task("Triage new information requests", "t-b", null, { dueH: 20 }),
  task("Check incoming documents", "t-a", null, { dueH: 44, priority: "low" }),
  task("Wait for reply from Partner organisation 2", "t-a", "p-taylor", { dueH: 28, status: "waiting", waitingSince: at(-20), linkedRecordIds: ["o-02"] }),
  task("Prepare handover notes", "t-b", "p-taylor", { dueH: 70 }),
  task("Reconcile training records", "t-c", "p-drew", { dueH: 18, status: "in_progress", linkedRecordIds: ["r-1015"] }),
  task("Archive closed records", "t-b", "p-riley", { dueH: 96, priority: "low" }),
  task("Draft team objectives", "t-a", "p-casey", { dueH: 52 }),
  task("Review open data issues", "t-a", "p-robin", { dueH: 8, linkedRecordIds: ["r-1004"] }),
  task("Fill missing review date on REC-1003", "t-a", "p-morgan", { id: "t-agent-1", dueH: 22, createdBy: "ag-steward", linkedRecordIds: ["r-1003"],
    notes: [{ id: "n1", by: "ag-steward", at: at(-26), text: "Opened by the Data steward from the weekly data check." }] }),
  task("Fix category code on REC-1004", "t-a", "p-taylor", { dueH: -2, linkedRecordIds: ["r-1004"] }),
  // Request-linked tasks
  task("Read and annotate the document", "t-a", "p-jordan", { id: "t-req1", requestId: "req-1", dueH: 13, linkedRecordIds: ["r-1002"],
    checklist: cl(["Check against the previous version", "Note any open questions"]) }),
  task("Check the source for the same value", "t-b", "p-taylor", { id: "t-req2", requestId: "req-2", doneH: -29, dueH: -10, linkedRecordIds: ["r-1005"], evidenceFileIds: ["f-evidence"],
    checklist: cl(["Compare with the source system", "Attach what you found"], 2) }),
  task("Confirm the request details with the requester", "t-b", "p-riley", { id: "t-req3", requestId: "req-3", dueH: 4 }),
  task("Order desk equipment", "t-a", "p-morgan", { id: "t-ful8", requestId: "req-8", dueH: -24 * 3, doneH: -24 * 3 - 5, createdBy: "system" }),
  // Recurring instances
  task("Review team access list", "t-a", "p-jordan", { id: "t-rec-0201", scheduleId: "sch-access", instanceKey: "sch-access:2026-02-01", dueH: -24 * 38 + 72 - 24, doneH: -24 * 37, createdH: -24 * 38 }),
  task("Review team access list", "t-a", "p-jordan", { id: "t-rec-0301", scheduleId: "sch-access", instanceKey: "sch-access:2026-03-01", dueH: -24 * 10 + 72 - 24, createdH: -24 * 10,
    checklist: cl(["Export current access list", "Remove leavers", "Confirm with the team"], 1) })
];

// Completed in the last 30 days (current period) and 30-60 days ago (previous period).
const done: [string, Id, Id, number, number][] = [
  ["Close March onboarding checklist", "t-a", "p-morgan", -24 * 2, -24 * 2 - 6],
  ["Send minutes to Team B", "t-b", "p-jamie", -24 * 3, -24 * 3 - 2],
  ["Review access request", "t-a", "p-jordan", -24 * 4, -24 * 4 + 20],
  ["Update service record", "t-b", "p-taylor", -24 * 6, -24 * 6 - 1],
  ["File inspection note", "t-c", "p-drew", -24 * 7, -24 * 7 + 30],
  ["Check feedback summary", "t-c", "p-quinn", -24 * 9, -24 * 9 - 3],
  ["Agree improvement idea owner", "t-a", "p-casey", -24 * 11, -24 * 11 - 8],
  ["Record meeting outcome", "t-b", "p-riley", -24 * 13, -24 * 13 + 12],
  ["Collect training evidence", "t-c", "p-avery", -24 * 15, -24 * 15 - 4],
  ["Confirm policy acknowledgement", "t-a", "p-morgan", -24 * 18, -24 * 18 - 2],
  ["Respond to information request", "t-b", "p-jamie", -24 * 21, -24 * 21 - 9],
  ["Prepare quarterly review pack", "t-a", "p-jordan", -24 * 25, -24 * 25 - 1],
  ["Tidy shared folder", "t-c", "p-quinn", -24 * 33, -24 * 33 + 26],
  ["Handover to new coordinator", "t-a", "p-taylor", -24 * 36, -24 * 36 - 3],
  ["Review change request", "t-b", "p-riley", -24 * 40, -24 * 40 + 40],
  ["Agree audit actions", "t-a", "p-casey", -24 * 44, -24 * 44 - 6],
  ["Check risk register entries", "t-c", "p-avery", -24 * 48, -24 * 48 + 8],
  ["Update contact list", "t-b", "p-sam", -24 * 52, -24 * 52 - 2],
  ["Close procedure exception", "t-a", "p-morgan", -24 * 55, -24 * 55 + 30],
  ["File handover note", "t-c", "p-drew", -24 * 58, -24 * 58 - 1]
];
done.forEach(([title, team, who, dueH, doneH]) => TASKS.push(task(title, team, who, { dueH, doneH })));

/* ── Workflow runs and schedules ───────────────────────────────────────── */

const step = (stepId: string, label: string, status: WorkflowRun["steps"][number]["status"], h?: number, note?: string, effectKey?: string) =>
  ({ stepId, label, status, at: h === undefined ? undefined : at(h), note, effectKey });

const RUNS: WorkflowRun[] = [
  { id: "run-1", ref: "RUN-301", templateId: "wf-doc-review", title: "Document review: Review procedure v2", ownerId: "p-jordan", assigneeId: "p-jordan",
    teamId: "t-a", unitId: "u-north", status: "awaiting_approval", startedAt: at(-3), updatedAt: at(-3), affectedRecordIds: ["r-1002"], requestId: "req-1",
    appliedEffects: [{ key: "run-1:s-task", description: "Created task: Read and annotate the document", at: at(-3) }],
    steps: [step("s-task", "Create review task", "done", -3, undefined, "run-1:s-task"), step("s-approval", "Collect decision", "current", -3),
      step("s-apply", "Mark version approved", "pending"), step("s-notify", "Notify requester in Pulse", "pending")] },
  { id: "run-2", ref: "RUN-302", templateId: "wf-correction", title: "Information correction: REC-1002 category", ownerId: "p-robin", assigneeId: "p-robin",
    teamId: "t-a", unitId: "u-north", status: "completed", startedAt: at(-24 * 9), updatedAt: at(-24 * 8), affectedRecordIds: ["r-1002"], requestId: "req-5",
    appliedEffects: [{ key: "req-5:v1:apply-correction", description: "Category set to review on REC-1002", at: at(-24 * 8) }],
    steps: [step("s-validate", "Validate the field", "done", -24 * 9), step("s-approval", "Collect decisions", "done", -24 * 8 - 2),
      step("s-apply", "Apply correction in Pulse", "done", -24 * 8, undefined, "req-5:v1:apply-correction"),
      step("s-writeback", "Write back to source", "skipped", -24 * 8, "Source is authoritative and write-back is off, so the correction is held in Pulse pending source review."),
      step("s-notify", "Notify requester in Pulse", "done", -24 * 8)] },
  { id: "run-3", ref: "RUN-303", templateId: "wf-weekly-check", title: "Weekly data check, 9 March", ownerId: "p-robin", assigneeId: null,
    teamId: "t-b", unitId: "u-north", status: "failed", startedAt: at(-49), updatedAt: at(-49), affectedRecordIds: ["r-1009", "r-1017"],
    appliedEffects: [{ key: "run-3:s-open", description: "Opened 2 data issues for missing fields", at: at(-49) }],
    failure: { stepId: "s-assign", message: "No reviewer is set for Team B data checks, so the review task has no owner.",
      impact: "Two records in Team B have missing required fields and nobody is assigned to fix them.", at: at(-49), cause: "missing-owner" },
    steps: [step("s-scan", "Scan required fields", "done", -49), step("s-open", "Open issues for gaps", "done", -49, undefined, "run-3:s-open"),
      step("s-assign", "Create review task for the team", "failed", -49, "No reviewer set for Team B"), step("s-summary", "Post summary in Pulse", "pending")] },
  { id: "run-4", ref: "RUN-304", templateId: "wf-correction", title: "Information correction: REC-1005 contact email", ownerId: "p-robin", assigneeId: "p-robin",
    teamId: "t-b", unitId: "u-north", status: "awaiting_approval", startedAt: at(-30), updatedAt: at(-27), affectedRecordIds: ["r-1005"], requestId: "req-2", appliedEffects: [],
    steps: [step("s-validate", "Validate the field", "done", -30), step("s-approval", "Collect decisions", "current", -27),
      step("s-apply", "Apply correction in Pulse", "pending"), step("s-writeback", "Write back to source", "pending"), step("s-notify", "Notify requester in Pulse", "pending")] },
  { id: "run-5", ref: "RUN-305", templateId: "wf-doc-review", title: "Document review: Quarterly report draft", ownerId: "p-avery", assigneeId: "p-avery",
    teamId: "t-c", unitId: "u-south", status: "paused", startedAt: at(-7), updatedAt: at(-6), affectedRecordIds: ["r-1013"], requestId: "req-10", appliedEffects: [],
    steps: [step("s-task", "Create review task", "waiting", -7, "Paused by Avery Cole until the figures are final"), step("s-approval", "Collect decision", "pending"),
      step("s-apply", "Mark version approved", "pending"), step("s-notify", "Notify requester in Pulse", "pending")] },
  { id: "run-6", ref: "RUN-306", templateId: "wf-weekly-check", title: "Weekly data check, 2 March", ownerId: "p-robin", assigneeId: "p-robin",
    teamId: "t-a", unitId: "u-north", status: "completed", startedAt: at(-24 * 9 - 1), updatedAt: at(-24 * 9 - 1), affectedRecordIds: ["r-1003"],
    appliedEffects: [{ key: "run-6:s-open", description: "Opened 1 data issue", at: at(-24 * 9 - 1) }, { key: "run-6:s-assign", description: "Created review task", at: at(-24 * 9 - 1) }],
    steps: [step("s-scan", "Scan required fields", "done", -24 * 9 - 1), step("s-open", "Open issues for gaps", "done", -24 * 9 - 1),
      step("s-assign", "Create review task for the team", "done", -24 * 9 - 1), step("s-summary", "Post summary in Pulse", "done", -24 * 9 - 1)] }
];

const SCHEDULES: Schedule[] = [
  { id: "sch-weekly-check", label: "Weekly data check", kind: "automation", ownerId: "p-robin", teamId: "t-a", workflowTemplateId: "wf-weekly-check",
    cadence: { every: "week", weekday: 1, hour: 9, minute: 0 }, timezone: TZ, active: true, lastRunAt: at(-49),
    producedKeys: ["sch-weekly-check:2026-03-02", "sch-weekly-check:2026-03-09"] },
  { id: "sch-access", label: "Monthly access review", kind: "recurring-task", ownerId: "p-jordan", teamId: "t-a",
    cadence: { every: "month", monthday: 1, hour: 9, minute: 0 }, timezone: TZ, active: true, lastRunAt: at(-24 * 10),
    task: { title: "Review team access list", priority: "normal", checklist: ["Export current access list", "Remove leavers", "Confirm with the team"], dueInHours: 48 },
    producedKeys: ["sch-access:2026-02-01", "sch-access:2026-03-01"] },
  { id: "sch-queue", label: "Daily queue check", kind: "recurring-task", ownerId: "p-riley", teamId: "t-b",
    cadence: { every: "day", hour: 9, minute: 30 }, timezone: TZ, active: false,
    task: { title: "Check the Team B queue", priority: "normal", checklist: ["Assign anything unclaimed"], dueInHours: 4 }, producedKeys: [] },
  { id: "sch-handover", label: "End of day handover", kind: "recurring-task", ownerId: "p-jordan", teamId: "t-a",
    cadence: { every: "day", hour: 16, minute: 30 }, timezone: TZ, active: true, lastRunAt: at(-17.5),
    task: { title: "Write the end of day handover", priority: "normal", checklist: ["Open items", "Blockers", "Tomorrow's first job"], dueInHours: 2 },
    producedKeys: ["sch-handover:2026-03-09", "sch-handover:2026-03-10"] },
  { id: "sch-walk", label: "Weekly workplace check", kind: "recurring-task", ownerId: "p-avery", teamId: "t-c",
    cadence: { every: "week", weekday: 3, hour: 11, minute: 0 }, timezone: TZ, active: true, lastRunAt: at(-24 * 7 + 1),
    task: { title: "Walk round and record the workplace check", priority: "normal", checklist: ["Exits clear", "First aid kit stocked", "Issues logged"], dueInHours: 6 },
    producedKeys: ["sch-walk:2026-03-04"] },
  { id: "sch-certs", label: "Monthly certificate review", kind: "recurring-task", ownerId: "p-robin", teamId: "t-a",
    cadence: { every: "month", monthday: 15, hour: 9, minute: 0 }, timezone: TZ, active: true, lastRunAt: at(-24 * 24),
    task: { title: "Review certificates due in the next 60 days", priority: "normal", checklist: ["Book renewals", "Chase missing records"], dueInHours: 48 },
    producedKeys: ["sch-certs:2026-02-15"] },
  { id: "sch-1to1", label: "Weekly one-to-ones", kind: "recurring-task", ownerId: "p-riley", teamId: "t-b",
    cadence: { every: "week", weekday: 4, hour: 14, minute: 0 }, timezone: TZ, active: true, lastRunAt: at(-24 * 7 + 4),
    task: { title: "Hold one-to-ones with the team", priority: "normal", checklist: ["Notes recorded"], dueInHours: 4 },
    producedKeys: ["sch-1to1:2026-03-05"] },
  { id: "sch-report", label: "Weekly summary report", kind: "report", ownerId: "p-casey", teamId: "t-a", dashboardId: "overview", recipients: ["p-casey", "p-jordan", "p-riley"],
    cadence: { every: "week", weekday: 5, hour: 16, minute: 0 }, timezone: TZ, active: true, producedKeys: [] }
];

/* ── Data issues (stored); missing-field issues are derived at load ───── */

const ISSUES: DataIssue[] = [
  { id: "iss-dup", kind: "duplicate", severity: "medium", title: "Possible duplicate organisation", recordIds: ["o-01", "o-04"], ownerId: "p-robin",
    state: "open", detectedAt: at(-24 * 4), sourceIds: ["s-import", "pulse"] },
  { id: "iss-unmapped", kind: "unmapped_value", severity: "medium", title: "Unmapped category code", recordIds: ["r-1004"], field: "category",
    ownerId: "p-jordan", state: "open", detectedAt: at(-2), sourceIds: ["s-sample"], sourceValue: "X-17" },
  { id: "iss-conflict", kind: "conflict", severity: "high", title: "Contact email differs from source", recordIds: ["r-1005"], field: "contactEmail",
    ownerId: "p-riley", state: "open", detectedAt: at(-24), sourceIds: ["pulse", "s-sample"],
    values: [{ sourceId: "pulse", value: "records-team@example.org", at: at(-24 * 3) }, { sourceId: "s-sample", value: "records.b@example.org", at: at(-24) }] },
  { id: "iss-unmatched", kind: "unmatched", severity: "low", title: "Source row with no matching record", recordIds: [], ownerId: "p-robin",
    state: "open", detectedAt: at(-24 * 2), sourceIds: ["s-sample"], externalId: "SRC-884", sourceValue: "Annual review (source row)" }
];

/* Issues found and resolved over the last eight weeks, so trends have real history. */
const PAST: [string, DataIssue["kind"], string, string, string | undefined, number, number, DataIssue["severity"]][] = [
  ["hist-1", "missing_field", "Review date was missing", "r-1002", "reviewDate", -24 * 52, -24 * 50, "medium"],
  ["hist-2", "conflict", "Contact email differed from source", "r-1006", "contactEmail", -24 * 45, -24 * 44, "high"],
  ["hist-3", "unmapped_value", "Unmapped category code", "r-1007", "category", -24 * 40, -24 * 38, "medium"],
  ["hist-4", "missing_field", "Reference was missing", "r-1011", "reference", -24 * 33, -24 * 31, "high"],
  ["hist-5", "duplicate", "Possible duplicate record", "r-1012", undefined, -24 * 30, -24 * 23, "medium"],
  ["hist-6", "missing_field", "Category was missing", "r-1014", "category", -24 * 26, -24 * 19, "medium"],
  ["hist-7", "conflict", "Reference differed from source", "r-1010", "reference", -24 * 18, -24 * 16, "high"],
  ["hist-8", "missing_field", "Review date was missing", "r-1017", "reviewDate", -24 * 12, -24 * 9, "medium"],
  ["hist-9", "unmatched", "Source row with no matching record", "r-1019", undefined, -24 * 9, -24 * 8, "low"],
  ["hist-10", "missing_field", "Contact email was missing", "r-1020", "contactEmail", -24 * 6, -24 * 3, "low"]
];
PAST.forEach(([id, kind, title, rec, field, foundH, fixedH, severity]) => ISSUES.push({ id, kind, severity, title, recordIds: [rec], field, ownerId: "p-robin",
  state: "resolved", detectedAt: at(foundH), sourceIds: [kind === "missing_field" ? "pulse" : "s-sample"],
  resolution: { by: "p-robin", at: at(fixedH), action: kind === "duplicate" ? "Marked as distinct" : "Corrected", reason: "Checked against the source" } }));

/* ── History ───────────────────────────────────────────────────────────── */

function history(): AuditEvent[] {
  const ev: AuditEvent[] = [];
  let n = 0;
  const push = (e: Omit<AuditEvent, "id">) => ev.push({ id: "e-" + String(++n).padStart(3, "0"), ...e });
  for (const r of REQUESTS) {
    const ap = APPROVALS.find((a) => a.id === r.approvalId)!;
    push({ at: r.versions[0].at, actorId: r.requesterId, actorKind: "person", action: "request.submitted", objectType: "request", objectId: r.id,
      recordIds: r.linkedRecordIds, summary: "Submitted " + r.ref + ": " + r.title, teamId: r.teamId, unitId: r.unitId });
    for (const d of ap.decisions) {
      push({ at: d.at, actorId: d.actorId, actorKind: "person", action: "approval." + d.kind, objectType: "approval", objectId: ap.id,
        recordIds: r.linkedRecordIds, summary: ({ approve: "Approved", decline: "Declined", return: "Returned for changes", delegate: "Delegated", escalate: "Escalated" })[d.kind] + " " + r.ref + " (version " + d.requestVersion + ")", teamId: r.teamId, unitId: r.unitId });
    }
    if (r.versions.length > 1) {
      push({ at: r.versions[1].at, actorId: r.requesterId, actorKind: "person", action: "request.edited", objectType: "request", objectId: r.id,
        recordIds: r.linkedRecordIds, summary: "Changed a material field on " + r.ref + " after approval; review restarted", teamId: r.teamId, unitId: r.unitId,
        before: { newValue: r.versions[0].fields.newValue }, after: { newValue: r.versions[1].fields.newValue } });
    }
    if (r.execution.status === "succeeded" || r.execution.status === "failed") {
      push({ at: r.execution.executedAt!, actorId: "system", actorKind: "system", action: "request.execution." + r.execution.status, objectType: "request", objectId: r.id,
        recordIds: r.linkedRecordIds, summary: (r.execution.status === "succeeded" ? "Executed: " + r.execution.effect : "Execution failed: " + r.execution.lastError), teamId: r.teamId, unitId: r.unitId });
    }
  }
  push({ at: at(-24 * 8), actorId: "system", actorKind: "system", action: "record.updated", objectType: "record", objectId: "r-1002", recordIds: ["r-1002"],
    summary: "Category changed by approved correction REQ-205", before: { category: "general" }, after: { category: "review" }, teamId: "t-a", unitId: "u-north" });
  push({ at: at(-49), actorId: "system", actorKind: "system", action: "run.failed", objectType: "run", objectId: "run-3", recordIds: ["r-1009", "r-1017"],
    summary: "RUN-303 failed: no reviewer set for Team B data checks", teamId: "t-b", unitId: "u-north" });
  push({ at: at(-26), actorId: "ag-steward", actorKind: "agent", action: "task.created", objectType: "task", objectId: "t-agent-1", recordIds: ["r-1003"],
    summary: "Data steward opened a task to fill the missing review date on REC-1003", teamId: "t-a", unitId: "u-north" });
  push({ at: at(-24 * 4), actorId: "ag-steward", actorKind: "agent", action: "issue.opened", objectType: "issue", objectId: "iss-dup", recordIds: ["o-01", "o-04"],
    summary: "Data steward flagged a possible duplicate organisation" });
  push({ at: at(-24), actorId: "s-sample", actorKind: "source", action: "sync.completed", objectType: "record", objectId: "r-1005", recordIds: ["r-1005"],
    summary: "Sample source system sent a new contact email for REC-1005", after: { contactEmail: "records.b@example.org" }, teamId: "t-b", unitId: "u-north" });
  push({ at: at(-98), actorId: "s-sample", actorKind: "source", action: "sync.completed", objectType: "record", objectId: "r-1013", recordIds: ["r-1013", "r-1014", "r-1015", "r-1016", "r-1019"],
    summary: "Last successful sync for Unit South records", teamId: "t-c", unitId: "u-south" });
  push({ at: at(-6), actorId: "p-avery", actorKind: "person", action: "run.paused", objectType: "run", objectId: "run-5", recordIds: ["r-1013"],
    summary: "Paused RUN-305 until the figures are final", teamId: "t-c", unitId: "u-south" });
  push({ at: at(-24 * 6), actorId: "p-casey", actorKind: "person", action: "file.version.added", objectType: "file", objectId: "f-handbook", recordIds: ["r-1001"],
    summary: "Added version 3 of Team handbook" });
  for (const t of TASKS.filter((x) => x.status === "done" && x.completedAt)) {
    push({ at: t.completedAt!, actorId: t.assigneeId || "system", actorKind: "person", action: "task.completed", objectType: "task", objectId: t.id,
      recordIds: t.linkedRecordIds, summary: "Completed: " + t.title, teamId: t.teamId, unitId: t.unitId });
  }
  return ev.sort((a, b) => a.at.localeCompare(b.at));
}

export function sampleState(): CoreState {
  const data: CoreData = {
    people: structuredClone(PEOPLE),
    employment: structuredClone(EMPLOYMENT),
    leave: structuredClone(LEAVE),
    memberships: structuredClone(MEMBERSHIPS),
    roleAssignments: structuredClone(ROLE_ASSIGNMENTS),
    delegations: [{ id: "dg-1", fromId: "p-jordan", toId: "p-morgan", ruleIds: ["rule-doc"], until: at(24 * 9), reason: "Covering document reviews while Jordan is away", active: true }],
    records: structuredClone([...RECORDS, ...ORGS]),
    relationships: structuredClone(RELATIONSHIPS),
    files: structuredClone(FILES),
    tasks: structuredClone(TASKS),
    requests: structuredClone(REQUESTS),
    approvals: structuredClone(APPROVALS),
    runs: structuredClone(RUNS),
    schedules: structuredClone(SCHEDULES),
    issues: structuredClone(ISSUES),
    events: history(),
    views: [
      { id: "v-1", page: "tasks", name: "Team A overdue", ownerId: "p-jordan", shared: true, teamId: "t-a", state: { filters: { status: "overdue" }, sort: { key: "due", dir: "asc" } } },
      { id: "v-2", page: "tasks", name: "My high priority", ownerId: "p-casey", shared: false, state: { filters: { priority: "high" } } },
      { id: "v-3", page: "records", name: "Needs review", ownerId: "p-casey", shared: true, teamId: "t-a", state: { filters: { status: "review" } } }
    ],
    reportSchedules: [],
    sync: [
      { sourceId: "pulse", lastAttemptAt: null, lastSuccessAt: null, status: "ok", message: "Entered in Pulse" },
      { sourceId: "s-sample", lastAttemptAt: at(-2), lastSuccessAt: at(-2), status: "sample",
        message: "Simulated. Team A and B rows synced 2 h ago; Unit South rows last synced 4 days ago." },
      { sourceId: "s-import", lastAttemptAt: at(-2), lastSuccessAt: at(-2), status: "sample", message: "Simulated import" },
      { sourceId: "s-email", lastAttemptAt: at(-6), lastSuccessAt: null, status: "not_connected", message: "No email provider configured" }
    ]
  };
  return { mode: "sample", config: sampleConfig(), data, seq: 1000 };
}

export const SAMPLE_DEFAULT_VIEWER = "p-casey";
export const SAMPLE_PREVIEW_PEOPLE = ["p-robin", "p-casey", "p-jordan", "p-morgan", "p-avery"];
void DAY; void HOUR; void iso; void ms;
