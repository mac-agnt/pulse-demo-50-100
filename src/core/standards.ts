/* Standards capability (optional module).

   A requirement (config.standards.requirements) applies to people, projects,
   locations, units, records or suppliers through its explicit selector. One
   requirement applied to one subject is an Obligation, with a state:
   missing, received, under review, approved, rejected or expired.

   Rules this file keeps:
   - Receiving a file is not accepting it. Receipt records the file and the
     exact version; acceptance only happens when the canonical review request
     (form-evidence-review, the shared approval model) is approved and its
     "accept-evidence" action runs.
   - Person certificates live in People (employment.certifications). A
     requirement with certificateName reads them there; nothing is copied.
   - Renewals, rejected evidence and failed checks create one canonical Work
     task each, keyed so a repeat never duplicates it.
   - Figures are "evidence approved", never "compliant". */

import * as ops from "./ops";
import { can, canSeeFile, eligibleApprovers, viewerOf, type Viewer } from "./access";
import { registerMetric } from "./metrics";
import { moduleEnabled } from "./modules";
import { canSeeEmployment } from "./people";
import type { Q } from "./query";
import { addDays, DAY, fmtDate, iso, localDay, ms, zonedTime } from "./time";
import type {
  Certification, CheckDef, CheckRun, CoreState, Ctx, FileDoc, Id, ISO, Obligation, ObligationState, OrgConfig, PolicyAck,
  RequestItem, RequirementDef, RequirementSubject, Task, Tone, Visibility
} from "./types";

type Result = ops.Result;
const fail = (error: string): Result => ({ ok: false, error });

export const EVIDENCE_FORM = "form-evidence-review";
export const EVIDENCE_RULE = "rule-evidence-review";
/** Approved evidence this close to expiry counts as expiring and gets a renewal task. */
export const EXPIRING_DAYS = 30;

/* ── Labels ────────────────────────────────────────────────────────────── */

export const OBLIGATION_LABEL: Record<ObligationState, string> = {
  missing: "Missing", received: "Received, not reviewed", under_review: "Under review", approved: "Approved", rejected: "Rejected", expired: "Expired"
};

export const OBLIGATION_TONE: Record<ObligationState, Tone> = {
  missing: "warn", received: "warn", under_review: "accent", approved: "ok", rejected: "bad", expired: "bad"
};

export const SUBJECT_KINDS: RequirementSubject[] = ["project", "person", "location", "unit", "supplier", "record"];

export function subjectKindLabel(c: OrgConfig, k: RequirementSubject, plural = true): string {
  const T = c.terminology;
  switch (k) {
    case "project": return plural ? c.projects.plural : c.projects.label;
    case "person": return plural ? "People" : "Person";
    case "location": return plural ? "Locations" : "Location";
    case "unit": return plural ? T.units : T.unit;
    case "supplier": return plural ? "Suppliers" : "Supplier";
    case "record": return plural ? T.records : T.record;
  }
}

export const CHECK_EVERY_LABEL: Record<CheckDef["every"], string> = { week: "Weekly", month: "Monthly", quarter: "Quarterly" };

/* ── Subjects ──────────────────────────────────────────────────────────── */

export interface SubjectInfo {
  kind: RequirementSubject;
  id: Id;
  label: string;
  detail: string;
  /** Who acts on it: renewal and replacement tasks go to this person. */
  ownerId: Id | null;
  /** People attached to it for visibility and personal scope. */
  ownerIds: Id[];
  teamId?: Id;
  unitId?: Id;
  visibility: Visibility;
  projectId?: Id;
  projectTypeId?: string;
  recordTypeId?: string;
  recordIds: Id[];
  exists: boolean;
}

const unitOfTeam = (s: CoreState, teamId?: Id) => s.config.teams.find((t) => t.id === teamId)?.unitId;
const teamOfPerson = (s: CoreState, pid?: Id | null) =>
  s.data.employment.find((e) => e.personId === pid)?.teamId || s.data.memberships.find((m) => m.personId === pid)?.teamId;
const nameOf = (s: CoreState, id?: Id | null) => s.data.people.find((p) => p.id === id)?.name || (id === "system" ? "Pulse" : "Unknown");
const teamLabel = (s: CoreState, id?: Id) => s.config.teams.find((t) => t.id === id)?.label;
const unitLabel = (s: CoreState, id?: Id) => s.config.units.find((u) => u.id === id)?.label;

export function allSubjects(s: CoreState, kind: RequirementSubject): SubjectInfo[] {
  const d = s.data;
  switch (kind) {
    case "project":
      return d.projects.filter((p) => p.status !== "cancelled").map((p) => ({
        kind, id: p.id, label: p.title, detail: [s.config.projects.types.find((t) => t.id === p.typeId)?.label, teamLabel(s, p.teamId)].filter(Boolean).join(", "),
        ownerId: p.ownerId, ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId || unitOfTeam(s, p.teamId), visibility: p.visibility,
        projectId: p.id, projectTypeId: p.typeId, recordIds: [], exists: true
      }));
    case "person":
      return d.employment.filter((e) => e.stage !== "left").flatMap((e) => {
        const p = d.people.find((x) => x.id === e.personId);
        if (!p || p.kind !== "staff" || p.status === "suspended") return [];
        return [{
          kind, id: p.id, label: p.name, detail: [p.title, teamLabel(s, e.teamId)].filter(Boolean).join(", "),
          ownerId: e.managerId || p.id, ownerIds: [p.id, ...(e.managerId ? [e.managerId] : [])], teamId: e.teamId, unitId: e.unitId || unitOfTeam(s, e.teamId),
          visibility: "team" as Visibility, recordIds: [], exists: true
        }];
      });
    case "location":
      return s.config.locations.map((l) => {
        const owner = s.config.units.find((u) => u.id === l.unitId)?.ownerId || null;
        return { kind, id: l.id, label: l.label, detail: unitLabel(s, l.unitId) || "", ownerId: owner, ownerIds: owner ? [owner] : [],
          unitId: l.unitId, visibility: "unit" as Visibility, recordIds: [], exists: true };
      });
    case "unit":
      return s.config.units.filter((u) => u.status !== "planned").map((u) => ({
        kind, id: u.id, label: u.label, detail: u.group || "", ownerId: u.ownerId || null, ownerIds: u.ownerId ? [u.ownerId] : [],
        unitId: u.id, visibility: "unit" as Visibility, recordIds: [], exists: true
      }));
    case "record":
      return d.records.filter((r) => !r.mergedInto).map((r) => ({
        kind, id: r.id, label: r.ref + " " + r.title, detail: s.config.recordTypes.find((t) => t.id === r.typeId)?.label || "",
        ownerId: r.ownerId, ownerIds: [r.ownerId], teamId: r.teamId, unitId: r.unitId || unitOfTeam(s, r.teamId), visibility: r.visibility,
        recordTypeId: r.typeId, recordIds: [r.id], exists: true
      }));
    case "supplier":
      return d.suppliers.map((x) => ({
        kind, id: x.id, label: x.name, detail: x.category + (x.status !== "active" ? ", " + x.status : ""), ownerId: x.ownerId, ownerIds: [x.ownerId],
        visibility: "organisation" as Visibility, recordIds: x.recordId ? [x.recordId] : [], exists: true
      }));
  }
}

export function subjectInfo(s: CoreState, kind: RequirementSubject, id: Id): SubjectInfo {
  return allSubjects(s, kind).find((x) => x.id === id)
    || { kind, id, label: id + " (no longer available)", detail: "", ownerId: null, ownerIds: [], visibility: "owner", recordIds: [], exists: false };
}

/** Does this requirement apply to this subject? Only its explicit configuration decides. */
export function applies(req: RequirementDef, sub: SubjectInfo): boolean {
  if (req.appliesTo !== sub.kind || !sub.exists) return false;
  const sel = req.selector;
  if (!sel) return true;
  if (sel.subjectIds?.length && !sel.subjectIds.includes(sub.id)) return false;
  if (sel.projectTypeIds?.length && !(sub.projectTypeId && sel.projectTypeIds.includes(sub.projectTypeId))) return false;
  if (sel.teamIds?.length && !(sub.teamId && sel.teamIds.includes(sub.teamId))) return false;
  if (sel.unitIds?.length && !(sub.unitId && sel.unitIds.includes(sub.unitId))) return false;
  if (sel.recordTypeId && sub.recordTypeId !== sel.recordTypeId) return false;
  return true;
}

export function applicableSubjects(s: CoreState, req: RequirementDef): SubjectInfo[] {
  return allSubjects(s, req.appliesTo).filter((x) => applies(req, x));
}

/** Plain-language description of who a requirement applies to. */
export function selectorText(s: CoreState, req: RequirementDef): string {
  const kind = subjectKindLabel(s.config, req.appliesTo).toLowerCase();
  const sel = req.selector;
  const parts: string[] = [];
  if (sel?.subjectIds?.length) parts.push(sel.subjectIds.map((id) => subjectInfo(s, req.appliesTo, id).label).join(", "));
  if (sel?.projectTypeIds?.length) parts.push("type " + sel.projectTypeIds.map((t) => s.config.projects.types.find((x) => x.id === t)?.label || t).join(" or "));
  if (sel?.teamIds?.length) parts.push("in " + sel.teamIds.map((t) => teamLabel(s, t) || t).join(" or "));
  if (sel?.unitIds?.length) parts.push("in " + sel.unitIds.map((u) => unitLabel(s, u) || u).join(" or "));
  if (sel?.recordTypeId) parts.push("of type " + (s.config.recordTypes.find((t) => t.id === sel.recordTypeId)?.label || sel.recordTypeId));
  return parts.length ? (sel?.subjectIds?.length ? parts.join("; ") : "All " + kind + " " + parts.join(", ")) : "All " + kind;
}

/* ── Obligation state ──────────────────────────────────────────────────── */

const sameSubject = (o: Obligation, sub: { kind: RequirementSubject; id: Id }) => o.subject.kind === sub.kind && o.subject.id === sub.id;

/** State as it stands now: approved evidence past its expiry is expired; a withdrawn review falls back to received. */
export function effectiveState(s: CoreState, o: Obligation, now: ISO): ObligationState {
  if ((o.state === "approved" || o.state === "expired") && o.expiresAt && ms(o.expiresAt) <= ms(now)) return "expired";
  if (o.state === "expired" && o.expiresAt && ms(o.expiresAt) > ms(now)) return "approved";
  if (o.state === "under_review") {
    const r = s.data.requests.find((x) => x.id === o.requestId);
    if (!r || r.status === "withdrawn") return o.evidence ? "received" : "missing";
  }
  return o.state;
}

const expiringSoon = (expiresAt: ISO | undefined, now: ISO) =>
  !!expiresAt && ms(expiresAt) > ms(now) && ms(expiresAt) - ms(now) <= EXPIRING_DAYS * DAY;

export interface ObligationView {
  /** Obligation id; "new:<req>:<kind>:<id>" when no row exists yet; "cert:<req>:<person>" for certificates read from People. */
  key: string;
  source: "obligation" | "untracked" | "certificate";
  obligation?: Obligation;
  requirement: RequirementDef;
  subject: SubjectInfo;
  state: ObligationState;
  expiresAt?: ISO;
  expiring: boolean;
  /** False when the subject no longer matches the requirement's selector (the row is kept for history). */
  applies: boolean;
  certificate?: Certification;
  review?: RequestItem;
}

export const untrackedKey = (reqId: string, kind: RequirementSubject, id: Id) => "new:" + reqId + ":" + kind + ":" + id;
export const certKey = (reqId: string, personId: Id) => "cert:" + reqId + ":" + personId;

function certificateView(s: CoreState, req: RequirementDef, sub: SubjectInfo, now: ISO): ObligationView {
  const e = s.data.employment.find((x) => x.personId === sub.id);
  const c = e?.certifications.find((x) => x.name.trim().toLowerCase() === (req.certificateName || "").trim().toLowerCase());
  const state: ObligationState = !c || !c.expires ? "missing" : ms(c.expires) <= ms(now) ? "expired" : "approved";
  return { key: certKey(req.id, sub.id), source: "certificate", requirement: req, subject: sub, state, expiresAt: c?.expires || undefined,
    expiring: state === "approved" && expiringSoon(c?.expires || undefined, now), applies: true, certificate: c };
}

function storedView(s: CoreState, o: Obligation, req: RequirementDef, sub: SubjectInfo, now: ISO, ap: boolean): ObligationView {
  const state = effectiveState(s, o, now);
  return { key: o.id, source: "obligation", obligation: o, requirement: req, subject: sub, state, expiresAt: o.expiresAt,
    expiring: state === "approved" && expiringSoon(o.expiresAt, now), applies: ap, review: s.data.requests.find((r) => r.id === o.requestId) };
}

/** Every requirement against every subject it applies to, plus stored rows that no longer apply. Not permission-filtered. */
export function allViews(s: CoreState, now: ISO): ObligationView[] {
  const out: ObligationView[] = [];
  for (const req of s.config.standards.requirements) {
    const subs = allSubjects(s, req.appliesTo);
    if (req.certificateName && req.appliesTo === "person") {
      for (const sub of subs) if (applies(req, sub)) out.push(certificateView(s, req, sub, now));
      continue;
    }
    const rows = s.data.obligations.filter((o) => o.requirementId === req.id);
    for (const sub of subs) {
      const o = rows.find((x) => sameSubject(x, sub));
      const ap = applies(req, sub);
      if (o) out.push(storedView(s, o, req, sub, now, ap));
      else if (ap) out.push({ key: untrackedKey(req.id, sub.kind, sub.id), source: "untracked", requirement: req, subject: sub, state: "missing", expiring: false, applies: true });
    }
    for (const o of rows) if (!subs.some((x) => sameSubject(o, x))) out.push(storedView(s, o, req, subjectInfo(s, o.subject.kind, o.subject.id), now, false));
  }
  return out;
}

/** One view by key (obligation id, untracked key or certificate key). */
export function obligationView(s: CoreState, key: string, now: ISO): ObligationView | null {
  if (key.startsWith("new:") || key.startsWith("cert:")) return allViews(s, now).find((v) => v.key === key) || null;
  const o = s.data.obligations.find((x) => x.id === key);
  if (!o) return null;
  const req = s.config.standards.requirements.find((r) => r.id === o.requirementId);
  if (!req) return null;
  const sub = subjectInfo(s, o.subject.kind, o.subject.id);
  return storedView(s, o, req, sub, now, applies(req, sub));
}

/** Can the viewer see this subject's standards state? People use the employment rule; everything else the shared rule. */
export function canSeeSubject(q: Q, sub: SubjectInfo, extra: (Id | null | undefined)[] = []): boolean {
  if (sub.kind === "person") {
    const e = q.s.data.employment.find((x) => x.personId === sub.id);
    return !!e && canSeeEmployment(q, e);
  }
  if (!sub.exists) return q.viewer.isOrgWide;
  return q.canSee({ ownerIds: [...sub.ownerIds, ...extra], teamId: sub.teamId, unitId: sub.unitId, visibility: sub.visibility });
}

const reviewerOf = (s: CoreState, v: ObligationView) => {
  const a = s.data.approvals.find((x) => x.id === v.review?.approvalId);
  return a?.stages.find((st) => st.status === "pending")?.assigneeId;
};

/** Views the viewer may see, inside the selected scope. */
export function visibleViews(q: Q, opt?: { ignoreScope?: boolean }): ObligationView[] {
  if (!moduleEnabled(q.s.config, "standards")) return [];
  return allViews(q.s, q.ctx.now).filter((v) => {
    const extra = [v.requirement.ownerId, v.obligation?.evidence?.receivedBy, reviewerOf(q.s, v)];
    return canSeeSubject(q, v.subject, extra) && q.inScope({ teamId: v.subject.teamId, unitId: v.subject.unitId }, [...v.subject.ownerIds, ...extra], opt);
  });
}

/** Short state phrase for lists: "received, not reviewed", "under review with Jordan Price". */
export function stateText(s: CoreState, v: ObligationView): string {
  const tz = s.config.timezone;
  switch (v.state) {
    case "missing": return v.source === "certificate" ? "not recorded in People" : "missing";
    case "received": return "received, not reviewed";
    case "under_review": {
      const who = reviewerOf(s, v);
      const r = v.review;
      if (r?.status === "approved") return "review approved, acceptance not applied yet";
      if (r?.status === "changes_requested") return "returned for changes";
      return "under review" + (who ? " with " + nameOf(s, who) : "");
    }
    case "approved": return "approved" + (v.expiresAt ? ", valid to " + fmtDate(v.expiresAt, tz) : "") + (v.expiring ? ", renewal due" : "");
    case "rejected": return "rejected" + (v.obligation?.rejectionReason ? ": " + v.obligation.rejectionReason : "");
    case "expired": return "expired" + (v.expiresAt ? " on " + fmtDate(v.expiresAt, tz) : "");
  }
}

/* ── Readiness and blockers ────────────────────────────────────────────── */

export interface ReadinessRow { subject: SubjectInfo; cells: (ObligationView | null)[]; gaps: number }
export interface ReadinessGroup { kind: RequirementSubject; label: string; requirements: RequirementDef[]; rows: ReadinessRow[] }

/** Subjects by kind against the requirements that apply to them. A null cell means the requirement does not apply. */
export function readiness(q: Q): ReadinessGroup[] {
  const views = visibleViews(q).filter((v) => v.applies);
  const out: ReadinessGroup[] = [];
  for (const kind of SUBJECT_KINDS) {
    const vs = views.filter((v) => v.subject.kind === kind);
    if (!vs.length) continue;
    const reqs = q.s.config.standards.requirements.filter((r) => vs.some((v) => v.requirement.id === r.id));
    const subs = [...new Map(vs.map((v) => [v.subject.id, v.subject])).values()].sort((a, b) => a.label.localeCompare(b.label));
    out.push({
      kind, label: subjectKindLabel(q.s.config, kind), requirements: reqs,
      rows: subs.map((sub) => {
        const cells = reqs.map((r) => vs.find((v) => v.subject.id === sub.id && v.requirement.id === r.id) || null);
        return { subject: sub, cells, gaps: cells.filter((c) => c && c.state !== "approved").length };
      }).sort((a, b) => b.gaps - a.gaps || a.subject.label.localeCompare(b.subject.label))
    });
  }
  return out;
}

export interface Blocker {
  key: string;
  /** What is held back, e.g. "Document review rollout: Rollout approved gate". */
  what: string;
  /** Full sentence for lists. */
  text: string;
  view: ObligationView | null;
  obligationKey: string;
  projectId?: Id;
  milestoneId?: Id;
}

/** Whether a gate's obligations are all approved, and which are not. Projects can call this; it never changes state. */
export function gateState(s: CoreState, now: ISO, obligationIds: Id[]): { satisfied: boolean; waiting: { obligationId: Id; state: ObligationState | "unknown"; label: string }[] } {
  const waiting: { obligationId: Id; state: ObligationState | "unknown"; label: string }[] = [];
  for (const id of obligationIds) {
    const v = obligationView(s, id, now);
    if (!v) waiting.push({ obligationId: id, state: "unknown", label: "Unknown requirement (" + id + ")" });
    else if (v.state !== "approved") waiting.push({ obligationId: id, state: v.state, label: v.requirement.label + ": " + stateText(s, v) });
  }
  return { satisfied: waiting.length === 0, waiting };
}

/** The exact missing requirement holding each thing back: milestone gates first, then requirements configured with "blocks". */
export function blockers(q: Q): Blocker[] {
  const s = q.s;
  if (!moduleEnabled(s.config, "standards")) return [];
  const now = q.ctx.now;
  const out: Blocker[] = [];
  for (const m of s.data.milestones) {
    if (m.completedAt || !m.gate?.obligationIds.length) continue;
    const p = s.data.projects.find((x) => x.id === m.projectId);
    if (!p) continue;
    if (!q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) continue;
    if (!q.inScope({ teamId: p.teamId, unitId: p.unitId }, [p.ownerId])) continue;
    const what = p.title + ": " + m.label + " gate";
    for (const id of m.gate.obligationIds) {
      const v = obligationView(s, id, now);
      if (v && v.state === "approved") continue;
      out.push({ key: m.id + ":" + id, what, view: v, obligationKey: id, projectId: p.id, milestoneId: m.id,
        text: v ? what + " waits on " + v.requirement.label + " evidence, " + stateText(s, v) : what + " waits on a requirement record that no longer exists (" + id + ")" });
    }
  }
  for (const v of visibleViews(q)) {
    if (!v.applies || !v.requirement.blocks || v.state === "approved") continue;
    const what = v.subject.label + ": " + v.requirement.blocks;
    out.push({ key: v.key, what, view: v, obligationKey: v.key, projectId: v.subject.projectId,
      text: what + " waits on " + v.requirement.label + " evidence, " + stateText(s, v) });
  }
  return out;
}

/** Milestone gates that reference an obligation. */
export function gatesFor(s: CoreState, obligationId: Id) {
  return s.data.milestones.filter((m) => m.gate?.obligationIds.includes(obligationId))
    .map((m) => ({ milestone: m, project: s.data.projects.find((p) => p.id === m.projectId) }));
}

/* ── Checks ────────────────────────────────────────────────────────────── */

/** Period of a check that contains `now`, in the organisation's timezone. */
export function periodOf(every: CheckDef["every"], now: ISO, tz: string): { key: string; label: string; start: ISO; dueAt: ISO } {
  const [y, m, d] = localDay(now, tz).split("-").map(Number);
  if (every === "month") {
    const start = zonedTime(y, m, 1, 0, 0, tz);
    const next = m === 12 ? zonedTime(y + 1, 1, 1, 0, 0, tz) : zonedTime(y, m + 1, 1, 0, 0, tz);
    return { key: y + "-" + String(m).padStart(2, "0"), label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15))), start, dueAt: iso(ms(next) - 60000) };
  }
  if (every === "quarter") {
    const qn = Math.floor((m - 1) / 3) + 1;
    const start = zonedTime(y, (qn - 1) * 3 + 1, 1, 0, 0, tz);
    const next = qn === 4 ? zonedTime(y + 1, 1, 1, 0, 0, tz) : zonedTime(y, qn * 3 + 1, 1, 0, 0, tz);
    return { key: y + "-Q" + qn, label: "Q" + qn + " " + y, start, dueAt: iso(ms(next) - 60000) };
  }
  // ISO week, Monday to Sunday.
  const day = new Date(Date.UTC(y, m - 1, d));
  const wd = (day.getUTCDay() + 6) % 7;
  const monday = new Date(day.getTime() - wd * DAY);
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const wy = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(wy, 0, 1)) / (7 * DAY)) + 1;
  const start = zonedTime(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0, 0, tz);
  return { key: wy + "-W" + String(week).padStart(2, "0"), label: "Week " + week + ", " + wy, start, dueAt: iso(ms(start) + 7 * DAY - 60000) };
}

export const checkRunKey = (checkId: string, kind: RequirementSubject, subjectId: Id, period: string) => checkId + "|" + kind + ":" + subjectId + "|" + period;
/** The period part of a check run key ("2026-03", "2026-Q1", "2026-W11"). */
export const periodOfKey = (k: string) => k.split("|")[2] || k;

export type CheckRunState = "due" | "overdue" | "passed" | "failed";
export function checkRunState(r: CheckRun, now: ISO): CheckRunState {
  if (r.result === "passed" || r.result === "failed") return r.result;
  return ms(r.dueAt) < ms(now) ? "overdue" : "due";
}

/** Check runs the viewer may see, inside the selected scope. */
export function visibleCheckRuns(q: Q, opt?: { ignoreScope?: boolean }): { run: CheckRun; check?: CheckDef; subject: SubjectInfo; state: CheckRunState }[] {
  if (!moduleEnabled(q.s.config, "standards")) return [];
  return q.s.data.checkRuns.map((run) => ({ run, check: q.s.config.standards.checks.find((c) => c.id === run.checkId), subject: subjectInfo(q.s, run.subject.kind, run.subject.id), state: checkRunState(run, q.ctx.now) }))
    .filter((x) => {
      const extra = [x.check?.ownerId, x.run.by];
      return canSeeSubject(q, x.subject, extra) && q.inScope({ teamId: x.subject.teamId, unitId: x.subject.unitId }, [...x.subject.ownerIds, ...extra], opt);
    });
}

/* ── Policies ──────────────────────────────────────────────────────────── */

export interface PolicyProgress {
  file: FileDoc;
  version: number;
  requiresAck: boolean;
  /** People asked to acknowledge: active staff who can see the policy. */
  required: Id[];
  acknowledged: Id[];
  outstanding: Id[];
  byVersion: { n: number; acknowledged: number }[];
  reviewOverdue: boolean;
}

export function policyFiles(s: CoreState): FileDoc[] {
  return s.data.files.filter((f) => f.kind === "Policy" || s.config.standards.acknowledgePolicyIds.includes(f.id));
}

export function policyProgress(s: CoreState, f: FileDoc, now: ISO): PolicyProgress {
  const version = f.versions[f.versions.length - 1]?.n || 0;
  const requiresAck = s.config.standards.acknowledgePolicyIds.includes(f.id);
  const required = requiresAck ? s.data.people.filter((p) => p.kind === "staff" && p.status === "active" && canSeeFile(s, viewerOf(s, p.id), f)).map((p) => p.id) : [];
  const acks = s.data.policyAcks.filter((a) => a.fileId === f.id);
  const acknowledged = required.filter((pid) => acks.some((a) => a.personId === pid && a.version === version));
  return {
    file: f, version, requiresAck, required, acknowledged, outstanding: required.filter((pid) => !acknowledged.includes(pid)),
    byVersion: f.versions.map((v) => ({ n: v.n, acknowledged: new Set(acks.filter((a) => a.version === v.n).map((a) => a.personId)).size })),
    reviewOverdue: !!f.reviewDate && ms(f.reviewDate) < ms(now)
  };
}

/* ── Authority ─────────────────────────────────────────────────────────── */

/** May this viewer record evidence or start a review for this subject? */
function handles(v: Viewer, sub: SubjectInfo, req?: RequirementDef): boolean {
  if (v.isOrgWide) return true;
  const me = v.person.id;
  if (sub.ownerIds.includes(me) || sub.ownerId === me || req?.ownerId === me) return true;
  if (can(v, "standards.review")) {
    if (sub.teamId && v.overseenTeamIds.includes(sub.teamId)) return true;
    if (sub.unitId && v.overseenUnitIds.includes(sub.unitId)) return true;
    if (!sub.teamId && !sub.unitId && sub.visibility === "organisation") return true;
  }
  return false;
}

export function canHandleSubject(s: CoreState, viewerId: Id, sub: SubjectInfo, req?: RequirementDef): boolean {
  return handles(viewerOf(s, viewerId), sub, req);
}

const opsPermission = (v: Viewer) => can(v, "standards.review") || can(v, "workflows.operate") || can(v, "settings.edit");

/* ── Helpers inside a draft ────────────────────────────────────────────── */

function logStd(s: CoreState, ctx: Ctx, o: Obligation, sub: SubjectInfo, action: string, summary: string, extra: { before?: Record<string, string | null>; after?: Record<string, string | null>; actorId?: Id; system?: boolean } = {}) {
  const base = { actorId: extra.system ? "system" : extra.actorId, actorKind: extra.system ? "system" as const : undefined,
    teamId: sub.teamId, unitId: sub.unitId, recordIds: sub.recordIds };
  ops.logEvent(s, ctx, { ...base, action, objectType: "requirement", objectId: o.id, storyKey: "obligation:" + o.id, summary, before: extra.before, after: extra.after });
  // Project history shows evidence moving too, under the project's own story.
  if (sub.kind === "project" && sub.exists) {
    ops.logEvent(s, ctx, { ...base, action: "project." + action, objectType: "project", objectId: sub.id, storyKey: "project:" + sub.id, summary });
  }
}

function makeTask(s: CoreState, ctx: Ctx, t: { title: string; key: string; sub: SubjectInfo; due?: ISO; origin: Task["origin"]; note?: string; priority?: Task["priority"] }): Id | null {
  if (s.data.tasks.some((x) => x.instanceKey === t.key && x.status !== "cancelled")) return null;
  const id = ops.nid(s, "t");
  const teamId = t.sub.teamId || teamOfPerson(s, t.sub.ownerId);
  s.data.tasks.push({
    id, title: t.title, teamId, unitId: t.sub.unitId || unitOfTeam(s, teamId), assigneeId: t.sub.ownerId, claimedAt: t.sub.ownerId ? ctx.now : undefined,
    linkedRecordIds: [...t.sub.recordIds], priority: t.priority || "normal", status: "open", dueAt: t.due, dependsOn: [], checklist: [],
    notes: t.note ? [{ id: ops.nid(s, "n"), by: ctx.viewerId, at: ctx.now, text: t.note }] : [], evidenceFileIds: [],
    instanceKey: t.key, createdAt: ctx.now, createdBy: "system", slaPolicyId: "sla-task", projectId: t.sub.projectId, origin: t.origin
  });
  ops.logEvent(s, ctx, { actorId: "system", actorKind: "system", action: "task.created", objectType: "task", objectId: id, recordIds: t.sub.recordIds,
    teamId, unitId: t.sub.unitId, summary: "Created task: " + t.title + (t.sub.ownerId ? " for " + nameOf(s, t.sub.ownerId) : ""),
    storyKey: t.origin?.kind === "check" ? "check:" + t.origin.id : t.origin ? "obligation:" + t.origin.id : undefined });
  return id;
}

/** Parse a view key into requirement, subject and the stored row if any (read-only). */
function target(s: CoreState, key: string): { req: RequirementDef; sub: SubjectInfo; o?: Obligation } | string {
  if (key.startsWith("cert:")) return "This requirement reads the certificate held in People. Record or renew it there; it is not copied here.";
  if (key.startsWith("new:")) {
    const [, reqId, kind, ...rest] = key.split(":");
    const req = s.config.standards.requirements.find((r) => r.id === reqId);
    if (!req) return "Requirement not found.";
    const sub = subjectInfo(s, kind as RequirementSubject, rest.join(":"));
    if (!applies(req, sub)) return "This requirement does not apply to " + sub.label + ".";
    const o = s.data.obligations.find((x) => x.requirementId === req.id && sameSubject(x, sub));
    return { req, sub, o };
  }
  const o = s.data.obligations.find((x) => x.id === key);
  if (!o) return "Requirement record not found.";
  const req = s.config.standards.requirements.find((r) => r.id === o.requirementId);
  if (!req) return "The requirement this belonged to has been removed.";
  return { req, sub: subjectInfo(s, o.subject.kind, o.subject.id), o };
}

/** The stored row for a target inside a draft, creating it if it does not exist yet. */
function rowIn(s: CoreState, req: RequirementDef, sub: SubjectInfo): Obligation {
  let o = s.data.obligations.find((x) => x.requirementId === req.id && sameSubject(x, sub));
  if (!o) {
    o = { id: ops.nid(s, "ob"), requirementId: req.id, subject: { kind: sub.kind, id: sub.id }, state: "missing" };
    s.data.obligations.push(o);
  }
  return o;
}

const addMonths = (at: ISO, n: number) => {
  const d = new Date(at);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString();
};

/* ── Operations ────────────────────────────────────────────────────────── */

/** Create the missing obligation rows for every subject a requirement applies to. Safe to repeat. */
export function ensureObligations(s0: CoreState, ctx: Ctx): Result {
  if (!moduleEnabled(s0.config, "standards")) return fail("The Standards module is off.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "settings.edit") && !can(v, "standards.review")) return fail("Only a reviewer or an administrator can apply requirements to subjects.");
  const todo = allViews(s0, ctx.now).filter((x) => x.source === "untracked" && handles(v, x.subject, x.requirement));
  if (!todo.length) return { ok: true, state: s0, message: "Every subject in your reach already has its requirement records. Nothing was duplicated." };
  const s = ops.draft(s0);
  const byReq = new Map<string, number>();
  for (const x of todo) {
    rowIn(s, x.requirement, x.subject);
    byReq.set(x.requirement.id, (byReq.get(x.requirement.id) || 0) + 1);
  }
  for (const [reqId, n] of byReq) {
    const req = s.config.standards.requirements.find((r) => r.id === reqId)!;
    ops.logEvent(s, ctx, { action: "requirement.applied", objectType: "requirement", objectId: reqId, recordIds: [], storyKey: "requirement:" + reqId,
      summary: "Applied " + req.label + " to " + n + " " + subjectKindLabel(s.config, req.appliesTo, n !== 1).toLowerCase() + ", each marked missing until evidence arrives" });
  }
  return { ok: true, state: s, message: "Created " + todo.length + " requirement record" + (todo.length === 1 ? "" : "s") + ", each marked missing until evidence is received." };
}

/** Record a file (and its current version) as received evidence. Receiving is not accepting. */
export function receiveEvidence(s0: CoreState, ctx: Ctx, key: string, fileId: Id): Result {
  if (!moduleEnabled(s0.config, "standards")) return fail("The Standards module is off.");
  const t = target(s0, key);
  if (typeof t === "string") return fail(t);
  const v = viewerOf(s0, ctx.viewerId);
  if (!handles(v, t.sub, t.req)) return fail("Only the owner of " + t.sub.label + ", the requirement owner or a reviewer in scope can record evidence for it.");
  const f = s0.data.files.find((x) => x.id === fileId);
  if (!f || !canSeeFile(s0, v, f)) return fail("Choose a document you can see.");
  const ver = f.versions[f.versions.length - 1];
  if (!ver) return fail(f.title + " has no versions yet.");
  const st = t.o ? effectiveState(s0, t.o, ctx.now) : "missing";
  if (st === "under_review") {
    const r = s0.data.requests.find((x) => x.id === t.o?.requestId);
    return fail("A review is in progress" + (r ? " (" + r.ref + ")" : "") + ". Decide or withdraw it before receiving different evidence.");
  }
  if (st === "approved" && !expiringSoon(t.o?.expiresAt, ctx.now)) {
    return fail("Already approved" + (t.o?.expiresAt ? " until " + fmtDate(t.o.expiresAt, s0.config.timezone) : "") + ". New evidence can be received when renewal is due.");
  }
  if (st === "received" && t.o?.evidence?.fileId === f.id && t.o.evidence.version === ver.n) {
    return { ok: true, state: s0, message: "Version " + ver.n + " of " + f.title + " is already recorded as received. Nothing changed.", id: t.o.id };
  }
  const s = ops.draft(s0);
  const o = rowIn(s, t.req, t.sub);
  const oldReq = s.data.requests.find((r) => r.id === o.requestId);
  o.state = "received";
  o.evidence = { fileId: f.id, version: ver.n, receivedAt: ctx.now, receivedBy: ctx.viewerId };
  if (!oldReq || oldReq.status === "declined" || oldReq.status === "withdrawn" || oldReq.execution.status === "succeeded") o.requestId = undefined;
  logStd(s, ctx, o, t.sub, "obligation.received",
    "Received " + f.title + " (version " + ver.n + ") as " + t.req.label + " evidence for " + t.sub.label + ". Not reviewed yet",
    { before: { state: st }, after: { state: "received" } });
  return { ok: true, state: s, message: "Recorded as received. It is not accepted until a reviewer approves it.", id: o.id };
}

/** Add a new evidence file record (no upload in the demo) and record it as received. */
export function attachEvidenceFile(s0: CoreState, ctx: Ctx, key: string, title: string, note: string): Result {
  if (!title.trim()) return fail("Name the evidence file.");
  const t = target(s0, key);
  if (typeof t === "string") return fail(t);
  const v = viewerOf(s0, ctx.viewerId);
  if (!handles(v, t.sub, t.req)) return fail("Only the owner of " + t.sub.label + ", the requirement owner or a reviewer in scope can record evidence for it.");
  const s1 = ops.draft(s0);
  const fid = ops.nid(s1, "f");
  const teamId = t.sub.teamId;
  s1.data.files.push({
    id: fid, title: title.trim(), kind: "Evidence", ownerId: ctx.viewerId, teamId, unitId: t.sub.unitId,
    visibility: teamId ? "team" : t.sub.unitId ? "unit" : "organisation", linkedRecordIds: [...t.sub.recordIds],
    versions: [{ id: ops.nid(s1, "fv"), n: 1, addedAt: ctx.now, addedBy: ctx.viewerId, note: note.trim() || "Added as evidence", sizeKb: 0 }],
    summary: (note.trim() ? note.trim() + ". " : "") + "Sample file record: no file is uploaded in the demo.", sourceId: "pulse"
  });
  ops.logEvent(s1, ctx, { action: "file.attached", objectType: "file", objectId: fid, recordIds: t.sub.recordIds, teamId, unitId: t.sub.unitId,
    summary: "Added evidence file " + title.trim() + " for " + t.req.label, storyKey: t.o ? "obligation:" + t.o.id : undefined });
  const res = receiveEvidence(s1, ctx, key, fid);
  if (!res.ok) return res;
  return { ...res, message: "Added " + title.trim() + " and recorded it as received. It is not accepted until a reviewer approves it." };
}

const OPEN_REVIEW = (r: RequestItem) => r.status === "draft" || r.status === "submitted" || r.status === "changes_requested" || (r.status === "approved" && r.execution.status !== "succeeded");

/** Start the one canonical review: a form-evidence-review request in Work, routed to the requirement's reviewer roles. */
export function startReview(s0: CoreState, ctx: Ctx, obligationId: Id): Result {
  if (!moduleEnabled(s0.config, "standards")) return fail("The Standards module is off.");
  const t = target(s0, obligationId);
  if (typeof t === "string") return fail(t);
  if (!t.o) return fail("Receive evidence first; there is nothing to review yet.");
  const o0 = t.o;
  const v = viewerOf(s0, ctx.viewerId);
  if (!handles(v, t.sub, t.req)) return fail("Only the owner of " + t.sub.label + ", the requirement owner or a reviewer in scope can start this review.");
  const existing = s0.data.requests.find((r) => r.id === o0.requestId);
  if (existing && OPEN_REVIEW(existing)) return { ok: true, state: s0, message: "The review is already open as " + existing.ref + ". Nothing was duplicated.", id: existing.id };
  const st = effectiveState(s0, o0, ctx.now);
  if (st !== "received" || !o0.evidence) {
    return fail(st === "missing" ? "Receive evidence first; there is nothing to review yet."
      : st === "approved" ? "This evidence is already approved."
      : st === "rejected" || st === "expired" ? "Receive new evidence first. The earlier evidence was " + st + "." : "This cannot be reviewed now.");
  }
  const form = s0.config.requestForms.find((f) => f.id === EVIDENCE_FORM && f.enabled);
  if (!form) return fail("The evidence review form is not set up. An administrator can add it in Settings, Request forms.");
  const file = s0.data.files.find((f) => f.id === o0.evidence!.fileId);
  const teamId = t.sub.teamId || teamOfPerson(s0, ctx.viewerId);
  const roles = t.req.reviewerRoleIds.length ? t.req.reviewerRoleIds : ["admin"];
  const rule = s0.config.approvalRules.find((r) => r.id === form.approvalRuleId);
  const scope = rule?.stages[0]?.scope || "requester-team";
  // Reviewers: an eligible role for this subject, the standards.review permission, and not the person asking.
  const rank = (pid: Id) => Math.min(...s0.data.roleAssignments.filter((ra) => ra.personId === pid && roles.includes(ra.roleId))
    .map((ra) => ra.scope.kind === "team" ? 0 : ra.scope.kind === "unit" ? 1 : 2));
  const pool = [...new Set(eligibleApprovers(s0, roles, scope, teamId))]
    .filter((p) => p !== ctx.viewerId && can(viewerOf(s0, p), "standards.review")).sort((a, b) => rank(a) - rank(b));
  if (!pool.length) return fail("No one holding a reviewer role for this requirement (" + roles.map((r) => s0.config.roles.find((x) => x.id === r)?.label || r).join(", ") + ") can review it, apart from you. Add a reviewer in Settings, Standards.");
  const before = s0.data.events.length;
  const res = ops.createRequest(s0, ctx, {
    formId: form.id, title: "Review " + t.req.label + " evidence: " + t.sub.label,
    fields: { obligationId: o0.id, fileId: o0.evidence.fileId, version: o0.evidence.version, note: (file ? file.title + ", version " + o0.evidence.version : "Evidence") + " for " + t.sub.label },
    evidenceFileIds: [o0.evidence.fileId], linkedRecordIds: [...t.sub.recordIds], teamId, submit: true
  });
  if (!res.ok || !res.id) return res.ok ? fail("The review request could not be created.") : res;
  const s = res.state;
  const r = s.data.requests.find((x) => x.id === res.id)!;
  const a = s.data.approvals.find((x) => x.id === r.approvalId);
  const stage = a?.stages.find((x) => x.status === "pending");
  if (!stage) return fail("The evidence review rule has no decision stage. An administrator can fix it in Settings, Approval routing.");
  stage.eligibleRoles = [...roles];
  stage.assigneeId = pool[0];
  for (const e of s.data.events.slice(before)) if (!e.storyKey) e.storyKey = "obligation:" + o0.id;
  const o = s.data.obligations.find((x) => x.id === o0.id)!;
  o.state = "under_review";
  o.requestId = r.id;
  logStd(s, ctx, o, t.sub, "obligation.review.started",
    "Started review " + r.ref + " of " + t.req.label + " evidence for " + t.sub.label + "; " + nameOf(s, pool[0]) + " decides",
    { before: { state: "received" }, after: { state: "under_review" } });
  return { ok: true, state: s, message: "Review started as " + r.ref + ". " + nameOf(s, pool[0]) + " decides in Work.", id: r.id };
}

/** Mark lapsed approvals expired and create one renewal task per expiring or expired obligation. Safe to repeat. */
export function raiseRenewals(s0: CoreState, ctx: Ctx): Result {
  if (!moduleEnabled(s0.config, "standards")) return fail("The Standards module is off.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!opsPermission(v)) return fail("Only a reviewer, workflow operator or administrator can run this.");
  const s = ops.draft(s0);
  let expired = 0, tasks = 0;
  for (const o of s.data.obligations) {
    const req = s.config.standards.requirements.find((r) => r.id === o.requirementId);
    if (!req || !o.expiresAt) continue;
    const st = effectiveState(s, o, ctx.now);
    const soon = st === "approved" && expiringSoon(o.expiresAt, ctx.now);
    if (st !== "expired" && !soon) continue;
    const sub = subjectInfo(s, o.subject.kind, o.subject.id);
    if (!applies(req, sub)) continue;
    if (st === "expired" && o.state !== "expired") {
      o.state = "expired";
      expired++;
      logStd(s, ctx, o, sub, "obligation.expired", req.label + " evidence for " + sub.label + " expired on " + fmtDate(o.expiresAt, s.config.timezone),
        { before: { state: "approved" }, after: { state: "expired" }, system: true });
    }
    const id = makeTask(s, ctx, {
      title: "Renew " + req.label + ": " + sub.label, key: "std:renew:" + o.id + ":" + o.expiresAt, sub,
      due: ms(o.expiresAt) > ms(ctx.now) ? o.expiresAt : addDays(ctx.now, 7), origin: { kind: "requirement", id: o.id },
      note: st === "expired" ? "Expired on " + fmtDate(o.expiresAt, s.config.timezone) + ". Receive the renewed evidence in Standards, then start its review." : undefined,
      priority: st === "expired" ? "high" : "normal"
    });
    if (id) { o.renewalTaskId = id; tasks++; }
  }
  if (!expired && !tasks) return { ok: true, state: s0, message: "No renewals due. Nothing was duplicated." };
  return { ok: true, state: s, message: [expired ? expired + " marked expired" : "", tasks ? tasks + " renewal task" + (tasks === 1 ? "" : "s") + " created" : ""].filter(Boolean).join(", ") + "." };
}

/** Create this period's check runs. One per check, subject and period, so repeating never duplicates. */
export function runDueChecks(s0: CoreState, ctx: Ctx): Result {
  if (!moduleEnabled(s0.config, "standards")) return fail("The Standards module is off.");
  const v = viewerOf(s0, ctx.viewerId);
  if (!opsPermission(v)) return fail("Only a reviewer, workflow operator or administrator can run this.");
  const s = ops.draft(s0);
  let made = 0;
  for (const c of s.config.standards.checks) {
    const p = periodOf(c.every, ctx.now, s.config.timezone);
    for (const sub of allSubjects(s, c.appliesTo)) {
      const key = checkRunKey(c.id, sub.kind, sub.id, p.key);
      if (s.data.checkRuns.some((r) => r.periodKey === key)) continue;
      s.data.checkRuns.push({ id: ops.nid(s, "chk"), checkId: c.id, subject: { kind: sub.kind, id: sub.id }, dueAt: p.dueAt, periodKey: key, result: "pending" });
      made++;
    }
  }
  if (!made) return { ok: true, state: s0, message: "This period's checks already exist. Nothing was duplicated." };
  ops.logEvent(s, ctx, { action: "check.scheduled", objectType: "check", objectId: "checks", recordIds: [], storyKey: "checks",
    summary: "Created " + made + " due check" + (made === 1 ? "" : "s") + " for the current period" });
  return { ok: true, state: s, message: "Created " + made + " due check" + (made === 1 ? "" : "s") + "." };
}

/** One manual tick: this period's checks and any renewals. There is no scheduler in the demo, so a person runs it. */
export function runStandardsDue(s0: CoreState, ctx: Ctx): Result {
  const a = runDueChecks(s0, ctx);
  if (!a.ok) return a;
  const b = raiseRenewals(a.state, ctx);
  if (!b.ok) return b;
  const parts = [a.state !== s0 ? a.message : "", b.state !== a.state ? b.message : ""].filter(Boolean);
  return { ok: true, state: b.state, message: parts.length ? parts.join(" ") : "Nothing new is due. Checks and renewals are up to date." };
}

/** Record a check result. A failure needs notes and creates one follow-up task. */
export function completeCheck(s0: CoreState, ctx: Ctx, runId: Id, result: "passed" | "failed", notes: string): Result {
  if (!moduleEnabled(s0.config, "standards")) return fail("The Standards module is off.");
  const r0 = s0.data.checkRuns.find((x) => x.id === runId);
  if (!r0) return fail("Check not found.");
  if (r0.result !== "pending") return fail("Already recorded as " + r0.result + " by " + nameOf(s0, r0.by) + ".");
  const c = s0.config.standards.checks.find((x) => x.id === r0.checkId);
  const sub = subjectInfo(s0, r0.subject.kind, r0.subject.id);
  const v = viewerOf(s0, ctx.viewerId);
  const mine = c?.ownerId === ctx.viewerId || sub.ownerIds.includes(ctx.viewerId);
  if (!mine && !handles(v, sub)) return fail("Only the check owner, the owner of " + sub.label + " or a reviewer in scope can record this check.");
  if (result === "failed" && !notes.trim()) return fail("Say what failed, so the follow-up is clear.");
  const s = ops.draft(s0);
  const r = s.data.checkRuns.find((x) => x.id === runId)!;
  r.result = result;
  r.completedAt = ctx.now;
  r.by = ctx.viewerId;
  r.notes = notes.trim() || undefined;
  const label = (c?.label || "Check") + " (" + periodOfKey(r.periodKey) + ")";
  ops.logEvent(s, ctx, { action: "check." + result, objectType: "check", objectId: r.id, recordIds: sub.recordIds, teamId: sub.teamId, unitId: sub.unitId,
    storyKey: "check:" + r.id, summary: label + " at " + sub.label + " " + result + (notes.trim() ? ": " + notes.trim() : ""), after: { result } });
  let message = "Recorded as passed.";
  if (result === "failed") {
    const task = makeTask(s, ctx, { title: "Follow up: " + (c?.label || "check") + " failed at " + sub.label, key: "std:check:" + r.id, sub: { ...sub, ownerId: sub.ownerId || c?.ownerId || ctx.viewerId },
      due: addDays(ctx.now, 3), origin: { kind: "check", id: r.id }, note: notes.trim(), priority: "high" });
    if (task) r.followUpTaskId = task;
    message = "Recorded as failed. A follow-up task went to " + nameOf(s, sub.ownerId || c?.ownerId || ctx.viewerId) + ".";
  }
  return { ok: true, state: s, message, id: r.id };
}

/** Acknowledge the current version of a policy for yourself. One acknowledgement per person and version. */
export function acknowledgePolicy(s0: CoreState, ctx: Ctx, fileId: Id): Result {
  const f = s0.data.files.find((x) => x.id === fileId);
  if (!f) return fail("Policy not found.");
  const v = viewerOf(s0, ctx.viewerId);
  if (v.person.kind !== "staff" || v.person.status !== "active") return fail("Only active staff acknowledge policies.");
  if (!canSeeFile(s0, v, f)) return fail("You cannot see this policy.");
  const ver = f.versions[f.versions.length - 1];
  if (!ver) return fail("This policy has no versions yet.");
  if (s0.data.policyAcks.some((a) => a.fileId === f.id && a.version === ver.n && a.personId === v.person.id)) {
    return { ok: true, state: s0, message: "You already acknowledged version " + ver.n + ". Nothing changed." };
  }
  const s = ops.draft(s0);
  const ack: PolicyAck = { id: ops.nid(s, "pa"), fileId: f.id, version: ver.n, personId: v.person.id, at: ctx.now };
  s.data.policyAcks.push(ack);
  ops.logEvent(s, ctx, { action: "policy.acknowledged", objectType: "file", objectId: f.id, recordIds: f.linkedRecordIds, teamId: f.teamId, unitId: f.unitId,
    storyKey: "policy:" + f.id, summary: v.person.name + " acknowledged " + f.title + " version " + ver.n });
  return { ok: true, state: s, message: "Acknowledged " + f.title + " version " + ver.n + ".", id: ack.id };
}

/* ── Shared approval model hooks ───────────────────────────────────────── */

const obligationOfRequest = (s: CoreState, r: RequestItem) => {
  if (r.formId !== EVIDENCE_FORM) return undefined;
  const o = s.data.obligations.find((x) => x.id === r.fields.obligationId);
  return o && o.requestId === r.id ? o : undefined;
};

/* Accepting is the approved action. It checks the evidence is still the one reviewed, so a later file never rides on an earlier approval. */
ops.registerEffect("accept-evidence", (s, ctx, r) => {
  const o = s.data.obligations.find((x) => x.id === r.fields.obligationId);
  if (!o) return { ok: false, error: "The requirement record no longer exists." };
  if (o.requestId !== r.id) return { ok: false, error: "This is no longer the current review for that requirement." };
  if (!o.evidence || o.evidence.fileId !== r.fields.fileId || o.evidence.version !== Number(r.fields.version)) {
    return { ok: false, error: "Different evidence was received after this review started, so it needs its own review." };
  }
  const req = s.config.standards.requirements.find((x) => x.id === o.requirementId);
  if (!req) return { ok: false, error: "The requirement has been removed from configuration." };
  const sub = subjectInfo(s, o.subject.kind, o.subject.id);
  const a = s.data.approvals.find((x) => x.id === r.approvalId);
  const approver = a ? [...a.decisions].reverse().find((d) => d.cycle === a.cycle && d.kind === "approve") : undefined;
  const before = o.state;
  o.state = "approved";
  o.decidedAt = a?.decidedAt || ctx.now;
  o.decidedBy = approver?.actorId || ctx.viewerId;
  o.rejectionReason = undefined;
  o.expiresAt = req.renewEveryMonths ? addMonths(ctx.now, req.renewEveryMonths) : undefined;
  // Renewal and replacement tasks for this obligation are now done.
  for (const t of s.data.tasks) {
    if (t.origin?.kind === "requirement" && t.origin.id === o.id && t.status !== "done" && t.status !== "cancelled") { t.status = "done"; t.completedAt = ctx.now; }
  }
  const released = gatesFor(s, o.id).filter((g) => !g.milestone.completedAt && gateState(s, ctx.now, g.milestone.gate!.obligationIds).satisfied);
  const tz = s.config.timezone;
  const summary = "Accepted " + req.label + " evidence for " + sub.label + (o.expiresAt ? ", valid to " + fmtDate(o.expiresAt, tz) : "")
    + (released.length ? ". Gate now satisfied: " + released.map((g) => (g.project?.title || "") + ", " + g.milestone.label).join("; ") : "");
  logStd(s, ctx, o, sub, "obligation.approved", summary, { before: { state: before }, after: { state: "approved" } });
  return { ok: true, effect: summary };
});

/* A decline rejects the evidence with the reviewer's reason and hands it back to the subject owner. */
ops.registerDecisionHook((s, ctx, r, a, kind, final) => {
  const o = obligationOfRequest(s, r);
  if (!o) return;
  const req = s.config.standards.requirements.find((x) => x.id === o.requirementId);
  const sub = subjectInfo(s, o.subject.kind, o.subject.id);
  const label = req?.label || "Requirement";
  const comment = [...a.decisions].reverse().find((d) => d.cycle === a.cycle)?.comment || "";
  if (kind === "decline" && final) {
    o.state = "rejected";
    o.rejectionReason = comment || "No reason given";
    o.decidedAt = ctx.now;
    o.decidedBy = ctx.viewerId;
    logStd(s, ctx, o, sub, "obligation.rejected", "Rejected " + label + " evidence for " + sub.label + ": " + o.rejectionReason,
      { before: { state: "under_review" }, after: { state: "rejected" } });
    makeTask(s, ctx, { title: "Replace " + label + " evidence: " + sub.label, key: "std:reject:" + o.id + ":" + r.id, sub,
      due: o.dueAt && ms(o.dueAt) > ms(ctx.now) ? o.dueAt : addDays(ctx.now, 5), origin: { kind: "requirement", id: o.id },
      note: "Rejected by " + nameOf(s, ctx.viewerId) + ": " + o.rejectionReason });
  } else if (kind === "approve" && final) {
    logStd(s, ctx, o, sub, "obligation.review.approved", "Review of " + label + " evidence for " + sub.label + " approved; acceptance applies when the approved action runs");
  } else if (kind === "return") {
    logStd(s, ctx, o, sub, "obligation.review.returned", "Review of " + label + " evidence for " + sub.label + " returned for changes" + (comment ? ": " + comment : ""));
  }
});

/* Evidence decisions need standards.review, checked every time a decision is made. */
ops.registerDecisionGuard((s, ctx, r) => {
  if (r.formId !== EVIDENCE_FORM) return null;
  return can(viewerOf(s, ctx.viewerId), "standards.review") ? null : "Deciding on evidence needs the Review evidence permission, which your role does not have.";
});

/* ── Metrics ───────────────────────────────────────────────────────────── */

const OFF = { value: null, ids: [], notes: ["The Standards module is off."] };

registerMetric("requirementsApproved", (q) => {
  if (!moduleEnabled(q.s.config, "standards")) return OFF;
  const views = visibleViews(q).filter((v) => v.applies);
  const ok = views.filter((v) => v.state === "approved");
  const certs = views.filter((v) => v.source === "certificate").length;
  return {
    value: views.length ? (100 * ok.length) / views.length : null, num: ok.length, den: views.length, ids: views.map((v) => v.key),
    notes: ["Share of applicable requirements whose evidence was reviewed and accepted in Pulse. It is not a statement of legal compliance.",
      ...(certs ? [certs + " of these are certificates read from People, where a recorded, in-date certificate counts as approved."] : [])]
  };
});

registerMetric("evidenceAwaitingReview", (q) => {
  if (!moduleEnabled(q.s.config, "standards")) return OFF;
  const views = visibleViews(q).filter((v) => v.state === "received" || v.state === "under_review");
  return { value: views.length, ids: views.map((v) => v.key), notes: ["Received evidence is counted until it is accepted or rejected."] };
});

registerMetric("checksOverdue", (q, _def, _start, end) => {
  if (!moduleEnabled(q.s.config, "standards")) return OFF;
  const runs = visibleCheckRuns(q).filter((x) => x.run.result === "pending" && ms(x.run.dueAt) < ms(end));
  return { value: runs.length, ids: runs.map((x) => x.run.id), notes: ["Pending checks past the end of their period."] };
});

