/* The common query layer. Dashboards, tables, detail panels, search, exports
   and agent context all read through here, so permissions and the selected
   scope are applied the same way everywhere. */

import {
  canSeeApproval, canSeeEvent, canSeeFile, canSeeIssue, canSeeRecord, canSeeRequest, canSeeRun, canSeeTask,
  inScope, viewerOf, canSeeOwned, type Viewer
} from "./access";
import { allIssues } from "./quality";
import { ms } from "./time";
import type { Visibility, Approval, CoreState, Ctx, DataIssue, FileDoc, Id, RecordItem, RequestItem, Task, WorkflowRun, AuditEvent, Person, Schedule } from "./types";

export interface QueryOpts { ignoreScope?: boolean }

export interface Q {
  s: CoreState;
  ctx: Ctx;
  viewer: Viewer;
  records(o?: QueryOpts & { typeId?: string; includeMerged?: boolean }): RecordItem[];
  record(id: Id): RecordItem | undefined;
  files(o?: QueryOpts): FileDoc[];
  file(id: Id): FileDoc | undefined;
  tasks(o?: QueryOpts): Task[];
  task(id: Id): Task | undefined;
  requests(o?: QueryOpts): RequestItem[];
  request(id: Id): RequestItem | undefined;
  approvals(o?: QueryOpts): Approval[];
  approval(id: Id): Approval | undefined;
  runs(o?: QueryOpts): WorkflowRun[];
  run(id: Id): WorkflowRun | undefined;
  schedules(o?: QueryOpts): Schedule[];
  issues(o?: QueryOpts): DataIssue[];
  events(o?: QueryOpts): AuditEvent[];
  people(o?: { kind?: Person["kind"] }): Person[];
  name(id?: Id | null): string;
  initials(id?: Id | null): string;
  teamLabel(id?: Id): string;
  unitLabel(id?: Id): string;
  isOpenTask(t: Task): boolean;
  isOverdue(t: Task): boolean;
  blockers(t: Task): Task[];
  timeline(recordId: Id): AuditEvent[];
  related(recordId: Id): { record: RecordItem; label: string; direction: "out" | "in" }[];
  /** Scope test for module entities: same rule every built-in list uses. */
  inScope(o: { teamId?: Id; unitId?: Id }, people: (Id | null | undefined)[], opt?: QueryOpts): boolean;
  /** Visibility test for module entities owned by people/teams. */
  canSee(o: { ownerIds: (Id | null | undefined)[]; teamId?: Id; unitId?: Id; visibility?: Visibility }): boolean;
}

const people = (...ids: (Id | null | undefined)[]) => ids.filter(Boolean) as Id[];

export function query(s: CoreState, ctx: Ctx): Q {
  const viewer = viewerOf(s, ctx.viewerId);
  const now = ms(ctx.now);
  const teamUnit = (teamId?: Id) => s.config.teams.find((t) => t.id === teamId)?.unitId;

  /* Objects that belong to no team (organisation-wide records) are shared:
     they appear in every team and unit scope, but not in "My work" unless owned. */
  const scoped = (o: { teamId?: Id; unitId?: Id }, who: Id[], opt?: QueryOpts) =>
    opt?.ignoreScope || (!o.teamId && !o.unitId && ctx.scope.kind !== "personal")
      || inScope(s, ctx, { teamId: o.teamId, unitId: o.unitId || teamUnit(o.teamId), people: who });

  const isOpenTask = (t: Task) => t.status !== "done" && t.status !== "cancelled";
  const taskById = new Map(s.data.tasks.map((t) => [t.id, t]));

  const q: Q = {
    s, ctx, viewer,
    records: (o) => s.data.records.filter((r) =>
      (o?.includeMerged || !r.mergedInto) && (!o?.typeId || r.typeId === o.typeId)
      && canSeeRecord(s, viewer, r) && scoped(r, [r.ownerId], o)),
    record: (id) => {
      const r = s.data.records.find((x) => x.id === id);
      return r && canSeeRecord(s, viewer, r) ? r : undefined;
    },
    files: (o) => s.data.files.filter((f) => canSeeFile(s, viewer, f) && scoped(f, [f.ownerId], o)),
    file: (id) => {
      const f = s.data.files.find((x) => x.id === id);
      return f && canSeeFile(s, viewer, f) ? f : undefined;
    },
    tasks: (o) => s.data.tasks.filter((t) => canSeeTask(s, viewer, t) && scoped(t, people(t.assigneeId, t.createdBy), o)),
    task: (id) => {
      const t = taskById.get(id);
      return t && canSeeTask(s, viewer, t) ? t : undefined;
    },
    requests: (o) => s.data.requests.filter((r) => {
      if (!canSeeRequest(s, viewer, r)) return false;
      const ap = s.data.approvals.find((a) => a.id === r.approvalId);
      const current = ap?.stages.find((st) => st.status === "pending")?.assigneeId;
      return scoped(r, people(r.requesterId, current), o);
    }),
    request: (id) => {
      const r = s.data.requests.find((x) => x.id === id);
      return r && canSeeRequest(s, viewer, r) ? r : undefined;
    },
    approvals: (o) => s.data.approvals.filter((a) => {
      if (!canSeeApproval(s, viewer, a)) return false;
      const r = s.data.requests.find((x) => x.id === a.requestId)!;
      const current = a.stages.find((st) => st.status === "pending")?.assigneeId;
      return scoped(r, people(r.requesterId, current), o);
    }),
    approval: (id) => {
      const a = s.data.approvals.find((x) => x.id === id);
      return a && canSeeApproval(s, viewer, a) ? a : undefined;
    },
    runs: (o) => s.data.runs.filter((r) => canSeeRun(s, viewer, r) && scoped(r, people(r.ownerId, r.assigneeId), o)),
    run: (id) => {
      const r = s.data.runs.find((x) => x.id === id);
      return r && canSeeRun(s, viewer, r) ? r : undefined;
    },
    schedules: (o) => s.data.schedules.filter((x) =>
      (viewer.isOrgWide || x.ownerId === viewer.person.id || (!!x.teamId && (viewer.overseenTeamIds.includes(x.teamId) || viewer.memberTeamIds.includes(x.teamId))))
      && scoped(x, [x.ownerId], o)),
    issues: (o) => allIssues(s).filter((i) => {
      if (!canSeeIssue(s, viewer, i) && !viewer.isOrgWide) return false;
      const rec = i.recordIds.map((id) => s.data.records.find((r) => r.id === id)).find(Boolean);
      return scoped({ teamId: rec?.teamId, unitId: rec?.unitId }, [i.ownerId], o);
    }),
    events: (o) => s.data.events.filter((e) => canSeeEvent(s, viewer, e) && scoped(e, [e.actorId], o)),
    people: (o) => s.data.people.filter((p) => !o?.kind || p.kind === o.kind),
    name: (id) => {
      if (!id) return "Unassigned";
      if (id === "system") return "Pulse";
      const p = s.data.people.find((x) => x.id === id);
      if (p) return p.name;
      const a = s.config.agents.find((x) => x.id === id);
      if (a) return a.name;
      const src = s.config.sources.find((x) => x.id === id);
      if (src) return src.label;
      return "Unknown";
    },
    initials: (id) => {
      const n = q.name(id);
      return n === "Unassigned" ? "?" : n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    },
    teamLabel: (id) => s.config.teams.find((t) => t.id === id)?.label || (id ? "Unknown" : "No team"),
    unitLabel: (id) => s.config.units.find((u) => u.id === id)?.label || "",
    isOpenTask,
    isOverdue: (t) => isOpenTask(t) && !!t.dueAt && ms(t.dueAt) < now,
    blockers: (t) => t.dependsOn.map((id) => taskById.get(id)).filter((x): x is Task => !!x && isOpenTask(x)),
    timeline: (recordId) => s.data.events.filter((e) => (e.recordIds.includes(recordId) || e.objectId === recordId) && canSeeEvent(s, viewer, e))
      .sort((a, b) => b.at.localeCompare(a.at)),
    related: (recordId) => {
      const out: { record: RecordItem; label: string; direction: "out" | "in" }[] = [];
      for (const rel of s.data.relationships) {
        const otherId = rel.fromId === recordId ? rel.toId : rel.toId === recordId ? rel.fromId : null;
        if (!otherId) continue;
        const other = q.record(otherId);
        if (other && !other.mergedInto) out.push({ record: other, label: rel.label, direction: rel.fromId === recordId ? "out" : "in" });
      }
      return out;
    },
    inScope: (o, who, opt) => scoped(o, people(...who), opt),
    canSee: (o) => canSeeOwned(s, viewer, { ownerIds: people(...o.ownerIds), teamId: o.teamId, unitId: o.unitId, visibility: o.visibility || "team" })
  };
  return q;
}

/** CSV of permitted rows only. Callers pass rows that already came through the query layer. */
export function toCsv(cols: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const str = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  return [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(","))].join("\n");
}

/** A readable name for an object id stored in a plain text field (module request forms keep
    ids such as invoiceId or milestoneId). Null when the id is not a known object. */
export function objectLabel(s: CoreState, id: string): string | null {
  const d = s.data;
  const inv = d.invoices.find((x) => x.id === id);
  if (inv) return inv.ref + ", " + (d.suppliers.find((x) => x.id === inv.supplierId)?.name || "supplier");
  const po = d.orders.find((x) => x.id === id);
  if (po) return po.ref;
  const pr = d.projects.find((x) => x.id === id);
  if (pr) return pr.title;
  const ms = d.milestones.find((x) => x.id === id);
  if (ms) return ms.label + " (" + (d.projects.find((x) => x.id === ms.projectId)?.title || "project") + ")";
  const ob = d.obligations.find((x) => x.id === id);
  if (ob) return s.config.standards.requirements.find((r) => r.id === ob.requirementId)?.label || "Requirement";
  const run = d.agentRuns.find((x) => x.id === id);
  if (run) return run.ref + ": " + run.goal;
  const sup = d.suppliers.find((x) => x.id === id);
  if (sup) return sup.name;
  const bg = d.budgets.find((x) => x.id === id);
  if (bg) return bg.label;
  const rq = d.requests.find((x) => x.id === id);
  if (rq) return rq.ref + " " + rq.title;
  return null;
}
