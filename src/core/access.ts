/* Permissions and organisational scope.
   In this frontend demo these checks run in the browser. That is a preview of
   the rules, not security: a production backend must enforce the same rules
   on every query and action. */

import type {
  Approval, CoreState, Ctx, FileDoc, Id, Permission, Person, RecordItem, RequestItem,
  RoleAssignment, ScopeSel, Task, Visibility, WorkflowRun, DataIssue, AuditEvent
} from "./types";

export interface Viewer {
  person: Person;
  roles: RoleAssignment[];
  permissions: Set<Permission>;
  isOrgWide: boolean;
  memberTeamIds: Id[];
  /** Teams this person oversees through a team or unit role assignment. */
  overseenTeamIds: Id[];
  overseenUnitIds: Id[];
}

export function viewerOf(s: CoreState, personId: Id): Viewer {
  const person = s.data.people.find((p) => p.id === personId) || s.data.people[0] || {
    id: personId, name: "Unknown", email: "", title: "", kind: "staff", status: "active"
  } as Person;
  const roles = s.data.roleAssignments.filter((r) => r.personId === person.id);
  const permissions = new Set<Permission>();
  let isOrgWide = false;
  const overseenTeamIds = new Set<Id>();
  const overseenUnitIds = new Set<Id>();
  for (const ra of roles) {
    const def = s.config.roles.find((r) => r.id === ra.roleId);
    def?.permissions.forEach((p) => permissions.add(p));
    const manages = def ? def.permissions.includes("approvals.decide") || def.permissions.includes("tasks.manage") : false;
    if (ra.scope.kind === "organisation" && manages) isOrgWide = true;
    if (ra.scope.kind === "organisation" && def?.id === "admin") isOrgWide = true;
    if (manages && ra.scope.kind === "team") overseenTeamIds.add(ra.scope.teamId);
    if (manages && ra.scope.kind === "unit") {
      const unitId = ra.scope.unitId;
      overseenUnitIds.add(unitId);
      s.config.teams.filter((t) => t.unitId === unitId).forEach((t) => overseenTeamIds.add(t.id));
    }
  }
  if (person.status === "suspended") permissions.clear();
  const memberTeamIds = s.data.memberships.filter((m) => m.personId === person.id).map((m) => m.teamId);
  return { person, roles, permissions, isOrgWide, memberTeamIds, overseenTeamIds: [...overseenTeamIds], overseenUnitIds: [...overseenUnitIds] };
}

export const can = (v: Viewer, p: Permission) => v.permissions.has(p);

const unitOfTeam = (s: CoreState, teamId?: Id) => s.config.teams.find((t) => t.id === teamId)?.unitId;

/** Base visibility of an owned, team- and unit-tagged object. */
function visible(s: CoreState, v: Viewer, o: { ownerIds: Id[]; teamId?: Id; unitId?: Id; visibility: Visibility }): boolean {
  if (v.isOrgWide) return true;
  if (o.ownerIds.includes(v.person.id)) return true;
  const unitId = o.unitId || unitOfTeam(s, o.teamId);
  if (o.teamId && v.overseenTeamIds.includes(o.teamId)) return true;
  if (unitId && v.overseenUnitIds.includes(unitId)) return true;
  switch (o.visibility) {
    case "organisation": return v.person.kind === "staff";
    case "unit": {
      const myUnits = v.memberTeamIds.map((t) => unitOfTeam(s, t)).filter(Boolean);
      return !!unitId && myUnits.includes(unitId);
    }
    case "team": return !!o.teamId && v.memberTeamIds.includes(o.teamId);
    case "owner": return false;
  }
}

export function canSeeRecord(s: CoreState, v: Viewer, r: RecordItem) {
  if (!can(v, "records.view")) return false;
  return visible(s, v, { ownerIds: [r.ownerId], teamId: r.teamId, unitId: r.unitId, visibility: r.visibility });
}

export function canSeeFile(s: CoreState, v: Viewer, f: FileDoc) {
  if (!can(v, "records.view")) return false;
  // Source document permissions win: a restricted document stays restricted.
  if (f.restrictedTo && f.restrictedTo.length) {
    return f.restrictedTo.includes(v.person.id) || v.roles.some((r) => r.roleId === "admin");
  }
  return visible(s, v, { ownerIds: [f.ownerId], teamId: f.teamId, unitId: f.unitId, visibility: f.visibility });
}

export function canSeeTask(s: CoreState, v: Viewer, t: Task) {
  return visible(s, v, { ownerIds: [t.assigneeId || "", t.createdBy], teamId: t.teamId, unitId: t.unitId, visibility: "team" });
}

export function canSeeRequest(s: CoreState, v: Viewer, r: RequestItem) {
  const appr = s.data.approvals.find((a) => a.id === r.approvalId);
  const approvers = appr ? appr.stages.map((st) => st.assigneeId || "") : [];
  return visible(s, v, { ownerIds: [r.requesterId, ...approvers], teamId: r.teamId, unitId: r.unitId, visibility: "team" });
}

export function canSeeApproval(s: CoreState, v: Viewer, a: Approval) {
  const req = s.data.requests.find((r) => r.id === a.requestId);
  if (!req) return false;
  if (a.stages.some((st) => st.assigneeId === v.person.id)) return true;
  if (delegatedTo(s, v.person.id, a).length) return true;
  return canSeeRequest(s, v, req);
}

export function canSeeRun(s: CoreState, v: Viewer, r: WorkflowRun) {
  return visible(s, v, { ownerIds: [r.ownerId, r.assigneeId || ""], teamId: r.teamId, unitId: r.unitId, visibility: "team" });
}

export function canSeeIssue(s: CoreState, v: Viewer, i: DataIssue) {
  if (i.ownerId === v.person.id) return true;
  const recs = i.recordIds.map((id) => s.data.records.find((r) => r.id === id)).filter(Boolean) as RecordItem[];
  return recs.length > 0 && recs.every((r) => canSeeRecord(s, v, r));
}

export function canSeeEvent(s: CoreState, v: Viewer, e: AuditEvent) {
  if (v.isOrgWide) return true;
  if (e.actorId === v.person.id) return true;
  // An event is visible when every record it touches is visible and its team is in reach.
  for (const id of e.recordIds) {
    const r = s.data.records.find((x) => x.id === id);
    if (r && !canSeeRecord(s, v, r)) return false;
  }
  if (e.teamId) return v.overseenTeamIds.includes(e.teamId) || v.memberTeamIds.includes(e.teamId);
  // Organisation-level changes (settings, sources) stay with org-wide viewers.
  return e.recordIds.length > 0;
}

/** Delegations that let `personId` act on this approval's current stage. */
export function delegatedTo(s: CoreState, personId: Id, a: Approval, now?: string) {
  const stage = a.stages.find((st) => st.status === "pending");
  if (!stage) return [];
  return s.data.delegations.filter((d) =>
    d.active && d.toId === personId && d.fromId === stage.assigneeId && d.ruleIds.includes(a.ruleId)
    && (!now || d.until >= now));
}

/* ── Scope selection ───────────────────────────────────────────────────── */

export interface ScopeOption { sel: ScopeSel; key: string; label: string; detail: string }

export const scopeKey = (s: ScopeSel) => s.kind === "team" || s.kind === "unit" ? s.kind + ":" + s.id : s.kind;

export function scopeOptions(s: CoreState, v: Viewer): ScopeOption[] {
  const T = s.config.terminology;
  const out: ScopeOption[] = [{ sel: { kind: "personal" }, key: "personal", label: "My work", detail: "Assigned to, owned or requested by you" }];
  const teamIds = new Set<Id>([...v.memberTeamIds, ...v.overseenTeamIds]);
  if (v.isOrgWide) s.config.teams.forEach((t) => teamIds.add(t.id));
  if (s.config.capabilities.units) {
    const unitIds = v.isOrgWide ? s.config.units.map((u) => u.id) : v.overseenUnitIds;
    for (const id of unitIds) {
      const u = s.config.units.find((x) => x.id === id);
      if (u) out.push({ sel: { kind: "unit", id }, key: "unit:" + id, label: u.label, detail: T.unit + " · " + s.config.teams.filter((t) => t.unitId === id).length + " " + T.teams.toLowerCase() });
    }
  }
  for (const id of teamIds) {
    const t = s.config.teams.find((x) => x.id === id);
    if (t) out.push({ sel: { kind: "team", id }, key: "team:" + id, label: t.label, detail: v.overseenTeamIds.includes(id) || v.isOrgWide ? T.team + " you oversee" : T.team + " you belong to" });
  }
  if (v.isOrgWide) out.push({ sel: { kind: "organisation" }, key: "organisation", label: "Whole " + T.organisation.toLowerCase(), detail: "Everything you are allowed to see" });
  return out;
}

/** A selection the viewer may no longer use falls back to their widest valid scope. */
export function validScope(s: CoreState, v: Viewer, sel: ScopeSel): { sel: ScopeSel; changed: boolean } {
  const opts = scopeOptions(s, v);
  if (opts.some((o) => o.key === scopeKey(sel))) return { sel, changed: false };
  return { sel: opts[opts.length - 1].sel, changed: true };
}

/** Team ids a scope covers, or null for "no team restriction". */
export function scopeTeams(s: CoreState, sel: ScopeSel): Id[] | null {
  if (sel.kind === "team") return [sel.id];
  if (sel.kind === "unit") return s.config.teams.filter((t) => t.unitId === sel.id).map((t) => t.id);
  return null;
}

/** Does an object belong to the selected scope? Personal scope uses the people attached to it. */
export function inScope(s: CoreState, ctx: Ctx, o: { teamId?: Id; unitId?: Id; people: Id[] }): boolean {
  const sel = ctx.scope;
  if (sel.kind === "organisation") return true;
  if (sel.kind === "personal") return o.people.includes(ctx.viewerId);
  if (sel.kind === "unit") return o.unitId === sel.id || (!!o.teamId && unitOfTeam(s, o.teamId) === sel.id);
  return o.teamId === sel.id;
}

export function scopeLabel(s: CoreState, sel: ScopeSel): string {
  if (sel.kind === "personal") return "My work";
  if (sel.kind === "organisation") return "Whole " + s.config.terminology.organisation.toLowerCase();
  if (sel.kind === "unit") return s.config.units.find((u) => u.id === sel.id)?.label || "Unknown";
  return s.config.teams.find((t) => t.id === sel.id)?.label || "Unknown";
}

/** People who could take a stage: eligible role covering the requester's team or unit. */
export function eligibleApprovers(s: CoreState, roleIds: string[], scope: "requester-team" | "requester-unit" | "organisation", teamId?: Id) {
  const unitId = unitOfTeam(s, teamId);
  return s.data.roleAssignments.filter((ra) => {
    if (!roleIds.includes(ra.roleId)) return false;
    const person = s.data.people.find((p) => p.id === ra.personId);
    if (!person || person.status !== "active") return false;
    if (ra.scope.kind === "organisation") return true;
    if (scope === "organisation") return false;
    if (ra.scope.kind === "team") return scope === "requester-team" && ra.scope.teamId === teamId;
    if (ra.scope.kind === "unit") return ra.scope.unitId === unitId;
    return false;
  }).map((ra) => ra.personId);
}
