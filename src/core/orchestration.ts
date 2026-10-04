/* Agent orchestration.

   Four concepts stay distinct here:
   1. Agent definition (config.agents): role, tools, limits, owner. Versioned.
   2. Coordination relationship (coordinatorId): the organisation chart. It
      grants no data or action authority; delegation can only narrow.
   3. Agent run (data.agentRuns): one execution with steps, outputs, history.
   4. Temporary worker (run.workers): created inside one run under the agent's
      spawn policy. Never a saved agent unless a person saves it on purpose.

   The runtime sits behind OrchestrationAdapter. The only adapter in this
   build is the local sample engine: deterministic, every run marked
   simulated, timestamps from ctx.now. It advances a run synchronously to its
   next wait point (a human approval, delegated work, or the end). External
   tools fail honestly: nothing is sent and nothing leaves Pulse.

   Restricted tools never act directly. They become a proposed action plus a
   canonical request in Work (form-agent-action). Approval resumes the run,
   decline stops that step, and execution is a separate step run through the
   shared executeRequest, keyed so it happens at most once. */

import * as ops from "./ops";
import type { Result, EffectOutcome } from "./ops";
import { query, type Q } from "./query";
import { can, viewerOf, scopeTeams } from "./access";
import { moduleEnabled } from "./modules";
import { addBusinessHours, fmtDate, localDay, ms } from "./time";
import type {
  AgentAvailability, AgentDef, AgentLimits, AgentPlanItem, AgentRun, AgentRunState, AgentRunStep, AgentSourceKind,
  AgentTemplateDef, AgentToolDef, Approval, ApprovalRuleDef, CoreState, Ctx, FieldValue, Id, ModuleId, RecordItem, RequestFormDef,
  RequestItem, SourceDef, SpawnPolicy, Task, TempWorker, Tone
} from "./types";

const fail = (error: string): Result => ({ ok: false, error });
type Ref = { kind: AgentSourceKind; id: Id };
type Scope = Id[] | "all";

/* ── Labels and small helpers ──────────────────────────────────────────── */

export const AGENT_ACTION_FORM = "form-agent-action";
export const AGENT_ACTION_RULE = "rule-agent-action";

export const RUN_STATE_LABEL: Record<AgentRunState, string> = {
  queued: "Queued", planning: "Planning", delegated: "Waiting on delegated work", running: "Running",
  waiting_input: "Waiting for input", waiting_approval: "Waiting for approval", stop_requested: "Stop requested",
  completed: "Completed", failed: "Failed", cancelled: "Cancelled"
};

export function runTone(state: AgentRunState): Tone {
  if (state === "completed") return "ok";
  if (state === "failed") return "bad";
  if (state === "cancelled") return "neutral";
  if (state === "waiting_approval" || state === "waiting_input" || state === "stop_requested") return "warn";
  return "accent";
}

export const AVAILABILITY_LABEL: Record<AgentAvailability, string> = {
  draft: "Draft", ready: "Ready", paused: "Paused", connection_required: "Connection required"
};

export const AVAILABILITY_TONE: Record<AgentAvailability, Tone> = {
  draft: "neutral", ready: "ok", paused: "neutral", connection_required: "warn"
};

export const TRIGGER_LABEL: Record<NonNullable<AgentDef["trigger"]>["kind"], string> = {
  manual: "Started by a person", schedule: "On a schedule", event: "When something happens", delegated: "Delegated by its coordinator"
};

const TERMINAL = new Set<AgentRunState>(["completed", "failed", "cancelled"]);
/** Not yet finished. Failed runs are finished until someone retries them. */
export const isRunActive = (r: AgentRun) => !TERMINAL.has(r.state);

const MODULE_NAME: Record<ModuleId, string> = { projects: "Projects", people: "People", finance: "Finance", purchasing: "Purchasing", standards: "Standards" };

export const availabilityOf = (a: AgentDef): AgentAvailability => a.availability || (a.enabled ? "ready" : "paused");
export const toolsOf = (a: AgentDef): string[] => a.tools || [];
export const versionOf = (a: AgentDef): number => a.version || 1;
export const agentById = (s: CoreState, id?: Id | null) => (id ? s.config.agents.find((a) => a.id === id) : undefined);
export const runById = (s: CoreState, id?: Id | null) => (id ? s.data.agentRuns.find((r) => r.id === id) : undefined);
const personName = (s: CoreState, id?: Id | null) => s.data.people.find((p) => p.id === id)?.name || agentById(s, id)?.name || (id === "system" ? "Pulse" : "Unknown");

export function agentLimits(s: CoreState, a?: AgentDef | null, own?: AgentLimits): AgentLimits {
  const d = s.config.orchestration.defaultLimits;
  const c = s.config.orchestration.ceiling;
  const l = own || a?.limits || d;
  return {
    maxDepth: Math.min(l.maxDepth, c.maxDepth),
    maxChildren: Math.min(l.maxChildren, c.maxChildren),
    maxConcurrentRuns: Math.min(l.maxConcurrentRuns, c.maxConcurrentRuns),
    maxMinutes: Math.min(l.maxMinutes, c.maxMinutes),
    maxCost: l.maxCost
  };
}

export function intersectScope(a: Scope, b: Scope): Scope {
  if (a === "all") return b === "all" ? "all" : [...b];
  if (b === "all") return [...a];
  return a.filter((x) => b.includes(x));
}

export function scopeText(s: CoreState, sc: Scope): string {
  if (sc === "all") return "All " + s.config.terminology.teams.toLowerCase();
  if (!sc.length) return "No " + s.config.terminology.teams.toLowerCase();
  return sc.map((id) => s.config.teams.find((t) => t.id === id)?.label || "Unknown").join(", ");
}

const toolLabel = (s: CoreState, id: string) => s.config.agentTools.find((t) => t.id === id)?.label || id;
const isRestricted = (s: CoreState, id: string) => !!s.config.agentTools.find((t) => t.id === id)?.restricted;

export interface ToolStatus { tool?: AgentToolDef; usable: boolean; reason?: string; connection?: SourceDef; module?: ModuleId }

/** Can this tool be used right now? Module switched on, required source connected. */
export function toolStatus(s: CoreState, toolId: string): ToolStatus {
  const tool = s.config.agentTools.find((t) => t.id === toolId);
  if (!tool) return { usable: false, reason: "This tool is no longer configured." };
  if (tool.module && !moduleEnabled(s.config, tool.module)) {
    return { tool, usable: false, module: tool.module, reason: "Needs the " + (s.config.modules[tool.module]?.label || MODULE_NAME[tool.module]) + " module switched on." };
  }
  if (tool.requiresSourceId) {
    const src = s.config.sources.find((x) => x.id === tool.requiresSourceId);
    if (!src || !src.connected) {
      return { tool, usable: false, connection: src, reason: "Needs " + (src?.label || tool.requiresSourceId) + " connected." + (src?.prerequisite ? " " + src.prerequisite : "") };
    }
  }
  return { tool, usable: true };
}

/* ── Organisation chart ────────────────────────────────────────────────── */

export const childrenOf = (s: CoreState, id: Id | null) =>
  s.config.agents.filter((a) => (a.coordinatorId || null) === id && !a.archived);

export function descendantsOf(s: CoreState, id: Id): AgentDef[] {
  const out: AgentDef[] = [];
  const walk = (pid: Id) => { for (const c of s.config.agents.filter((a) => a.coordinatorId === pid)) { if (!out.includes(c)) { out.push(c); walk(c.id); } } };
  walk(id);
  return out;
}

/** True when putting agentId under coordinatorId would make a loop (or is self-parenting). */
export function wouldCreateCycle(s: CoreState, agentId: Id, coordinatorId: Id | null): boolean {
  let cur: Id | null = coordinatorId;
  const seen = new Set<Id>();
  while (cur) {
    if (cur === agentId || seen.has(cur)) return true;
    seen.add(cur);
    cur = agentById(s, cur)?.coordinatorId || null;
  }
  return false;
}

/* ── Readiness: what must be true before an agent takes work ───────────── */

export interface Prereq { key: string; label: string; ok: boolean; detail?: string }
export interface Readiness { ok: boolean; items: Prereq[]; connections: SourceDef[]; onlyConnectionsMissing: boolean }

export function lastTest(s: CoreState, agentId: Id): AgentRun | undefined {
  return [...s.data.agentRuns].reverse().find((r) => r.agentId === agentId && r.test);
}

export function agentReadiness(s: CoreState, a: AgentDef): Readiness {
  const items: Prereq[] = [];
  const owner = s.data.people.find((p) => p.id === a.responsibleId);
  items.push({ key: "owner", label: "Accountable owner", ok: !!owner && owner.kind === "staff" && owner.status === "active",
    detail: owner ? (owner.status === "active" ? owner.name : owner.name + " is not active.") : "Choose the person who answers for this agent." });
  items.push({ key: "purpose", label: "Responsibility described", ok: !!a.purpose.trim(), detail: a.purpose.trim() ? undefined : "Say what it is responsible for." });
  items.push({ key: "scope", label: "Scope set", ok: a.scope.teamIds === "all" || a.scope.teamIds.length > 0, detail: scopeText(s, a.scope.teamIds) });
  if (a.coordinatorId) {
    const c = agentById(s, a.coordinatorId);
    items.push({ key: "coordinator", label: "Coordinator in place", ok: !!c && !c.archived && !wouldCreateCycle(s, a.id, a.coordinatorId),
      detail: c ? (c.archived ? c.name + " is archived." : c.name) : "The coordinator no longer exists." });
  }
  const tools = toolsOf(a);
  items.push({ key: "tools", label: "At least one tool", ok: tools.length > 0, detail: tools.length ? tools.length + " chosen" : "Without a tool it cannot do anything." });
  const connections: SourceDef[] = [];
  let otherToolProblem = false;
  for (const t of tools) {
    const st = toolStatus(s, t);
    if (st.usable) continue;
    if (st.connection || (st.tool?.requiresSourceId && !st.module)) {
      if (st.connection && !connections.includes(st.connection)) connections.push(st.connection);
      items.push({ key: "conn:" + t, label: (st.connection?.label || "Connection") + " connected", ok: false, detail: toolLabel(s, t) + ": " + st.reason });
    } else {
      otherToolProblem = true;
      items.push({ key: "tool:" + t, label: toolLabel(s, t) + " available", ok: false, detail: st.reason });
    }
  }
  const c = s.config.orchestration.ceiling;
  const l = a.limits || s.config.orchestration.defaultLimits;
  const over = (["maxDepth", "maxChildren", "maxConcurrentRuns", "maxMinutes"] as const).filter((k) => l[k] > c[k]);
  items.push({ key: "limits", label: "Limits within the organisation ceiling", ok: !over.length, detail: over.length ? "Above the ceiling: " + over.join(", ") : undefined });
  if (a.spawn?.enabled) {
    const bad = a.spawn.templateIds.filter((id) => !s.config.agentTemplates.find((t) => t.id === id && t.workerOk));
    items.push({ key: "spawn", label: "Spawn policy uses worker templates", ok: !bad.length && a.spawn.templateIds.length > 0,
      detail: bad.length ? "Not usable as workers: " + bad.join(", ") : a.spawn.templateIds.length ? undefined : "Choose at least one template, or turn spawning off." });
  }
  if (tools.some((t) => isRestricted(s, t))) {
    const form = s.config.requestForms.find((f) => f.id === AGENT_ACTION_FORM);
    items.push({ key: "route", label: "Approval route for restricted actions", ok: !form || form.enabled,
      detail: !form ? "Added automatically when the agent is saved." : form.enabled ? form.label : "The Agent action form is switched off in Settings, Request forms." });
  }
  if (availabilityOf(a) === "draft") {
    const t = lastTest(s, a.id);
    const passed = !!t && t.agentVersion === versionOf(a) && t.state === "completed";
    items.push({ key: "test", label: "Test run passed on this version", ok: passed,
      detail: passed ? t!.ref : t && t.agentVersion === versionOf(a) ? "The last test did not pass: " + (failureOf(t)?.business || RUN_STATE_LABEL[t.state]) : "Run a test. It uses isolated inputs and changes nothing." });
  }
  const failing = items.filter((i) => !i.ok);
  const onlyConn = failing.length > 0 && failing.every((i) => i.key.startsWith("conn:")) && !otherToolProblem;
  return { ok: failing.length === 0, items, connections, onlyConnectionsMissing: onlyConn };
}

/* ── Approval route for agent actions ──────────────────────────────────── */

export function agentActionForm(): RequestFormDef {
  return {
    id: AGENT_ACTION_FORM, label: "Agent action",
    description: "A restricted action an agent proposed. A person decides; running it is a separate step.",
    fields: [
      { key: "agentRunId", label: "Agent run", kind: "text", required: true },
      { key: "agentId", label: "Agent", kind: "text", required: true },
      { key: "toolId", label: "Tool", kind: "text", required: true },
      { key: "action", label: "Proposed action", kind: "longtext", required: true },
      { key: "effectKey", label: "Effect key", kind: "text", required: true }
    ],
    evidenceRequired: false, approvalRuleId: AGENT_ACTION_RULE, tasks: [],
    effect: { kind: "agent-action", label: "Let the agent carry out its proposed action" }, enabled: true
  };
}

export function agentActionRule(): ApprovalRuleDef {
  return {
    id: AGENT_ACTION_RULE, label: "Agent action", formId: AGENT_ACTION_FORM, prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
    stages: [{ id: "st-mgr", label: "Team manager or administrator", eligibleRoles: ["team_manager", "admin"], scope: "requester-team" }]
  };
}

function ensureActionRoute(s: CoreState, ctx: Ctx) {
  const addForm = !s.config.requestForms.some((f) => f.id === AGENT_ACTION_FORM);
  const addRule = !s.config.approvalRules.some((r) => r.id === AGENT_ACTION_RULE);
  if (!addForm && !addRule) return;
  if (addForm) s.config.requestForms.push(agentActionForm());
  if (addRule) s.config.approvalRules.push(agentActionRule());
  ops.logEvent(s, ctx, { action: "config.changed", objectType: "config", objectId: "config", recordIds: [],
    summary: "Added the Agent action approval route: one stage, a team manager or administrator, no self approval" });
}

/** Copy objects a nested op created (requests, approvals, tasks, events) into the working state, keeping every existing object as it is. */
function mergeAdded(s: CoreState, n: CoreState) {
  const merge = <T extends { id: Id }>(into: T[], from: T[]) => { const have = new Set(into.map((x) => x.id)); for (const x of from) if (!have.has(x.id)) into.push(x); };
  merge(s.data.requests, n.data.requests);
  merge(s.data.approvals, n.data.approvals);
  merge(s.data.tasks, n.data.tasks);
  merge(s.data.events, n.data.events);
  s.seq = Math.max(s.seq, n.seq);
}

/* ── Run plumbing ──────────────────────────────────────────────────────── */

function rootRun(s: CoreState, run: AgentRun): AgentRun {
  let r = run;
  const seen = new Set<Id>();
  while (r.parentRunId && !seen.has(r.id)) { seen.add(r.id); const p = runById(s, r.parentRunId); if (!p) break; r = p; }
  return r;
}

/** The person on whose behalf the run works: the root initiator, else the agent's accountable owner. */
export function runPerson(s: CoreState, run: AgentRun): Id {
  const root = rootRun(s, run);
  if (root.initiator.kind === "person" && s.data.people.some((p) => p.id === root.initiator.id)) return root.initiator.id;
  return agentById(s, root.agentId)?.responsibleId || run.initiator.id;
}

function addStep(run: AgentRun, ctx: Ctx, kind: AgentRunStep["kind"], actor: AgentRunStep["actor"], summary: string, extra?: Partial<AgentRunStep>): AgentRunStep {
  const st: AgentRunStep = { id: run.id + "-s" + (run.steps.length + 1), at: ctx.now, kind, actor, summary, status: "done", sourceRefs: [], ...extra };
  run.steps.push(st);
  return st;
}

const agentActor = (run: AgentRun): AgentRunStep["actor"] => ({ kind: "agent", id: run.agentId });

function teamTags(s: CoreState, sc: Scope): { teamId?: Id; unitId?: Id } {
  if (sc === "all" || !sc.length) return {};
  if (sc.length === 1) return { teamId: sc[0], unitId: s.config.teams.find((t) => t.id === sc[0])?.unitId };
  const units = [...new Set(sc.map((id) => s.config.teams.find((t) => t.id === id)?.unitId))];
  return units.length === 1 && units[0] ? { unitId: units[0] } : {};
}

function logRun(s: CoreState, ctx: Ctx, run: AgentRun, action: string, summary: string, opts?: { actorId?: Id; actorKind?: "person" | "agent" | "system"; refs?: Ref[] }) {
  const tags = teamTags(s, run.scopeTeamIds);
  const actorId = opts?.actorId || run.agentId;
  ops.logEvent(s, ctx, {
    action, objectType: "agentRun", objectId: run.id, storyKey: "agentRun:" + rootRun(s, run).id,
    recordIds: (opts?.refs || []).filter((r) => r.kind === "record").map((r) => r.id),
    summary: run.ref + ": " + summary, teamId: tags.teamId, unitId: tags.unitId, simulated: run.simulated,
    actorId, actorKind: opts?.actorKind || (actorId.startsWith("ag-") ? "agent" : actorId === "system" ? "system" : "person")
  });
}

function logAgent(s: CoreState, ctx: Ctx, a: AgentDef, action: string, summary: string, before?: Record<string, FieldValue>, after?: Record<string, FieldValue>) {
  ops.logEvent(s, ctx, { action, objectType: "agent", objectId: a.id, storyKey: "agent:" + a.id, recordIds: [], summary, before, after });
}

/** The tools a run may use now: what it started with, narrowed by any later revocation. Never widened. */
function runTools(s: CoreState, run: AgentRun): string[] {
  const a = agentById(s, run.agentId);
  if (!a || a.archived) return [];
  const now = toolsOf(a);
  return (run.snapshot?.tools || now).filter((t) => now.includes(t));
}

/** May a new run or worker be created at this depth under `run`? Every ancestor's own depth limit and the ceiling apply. */
function depthAllowed(s: CoreState, run: AgentRun, depth: number): { ok: boolean; limit: number } {
  const ceiling = s.config.orchestration.ceiling.maxDepth;
  if (depth > ceiling) return { ok: false, limit: ceiling };
  let r: AgentRun | undefined = run;
  while (r) {
    const lim = agentLimits(s, agentById(s, r.agentId), r.snapshot?.limits).maxDepth;
    if (depth - r.depth > lim) return { ok: false, limit: r.depth + lim };
    r = runById(s, r.parentRunId);
  }
  return { ok: true, limit: ceiling };
}

const activeRunsOf = (s: CoreState, agentId: Id) => s.data.agentRuns.filter((r) => r.agentId === agentId && !r.test && isRunActive(r));

/* ── Reading data on the run's behalf ──────────────────────────────────── */

/** Reads go through the query layer as the person the run works for, then narrow to the run's scope. */
function lens(s: CoreState, ctx: Ctx, run: AgentRun) {
  const q = query(s, { viewerId: runPerson(s, run), scope: { kind: "organisation" }, now: ctx.now });
  const sc = run.scopeTeamIds;
  const inRun = (o: { teamId?: Id; unitId?: Id }) => sc === "all" || (!!o.teamId && sc.includes(o.teamId))
    || (!o.teamId && (!o.unitId || s.config.teams.some((t) => sc.includes(t.id) && t.unitId === o.unitId)));
  return { q, inRun };
}

const refLabel = (s: CoreState, r: { kind: string; id: Id }): string => {
  switch (r.kind) {
    case "record": return s.data.records.find((x) => x.id === r.id)?.ref || r.id;
    case "project": return s.data.projects.find((x) => x.id === r.id)?.title || r.id;
    case "file": return s.data.files.find((x) => x.id === r.id)?.title || r.id;
    case "invoice": return s.data.invoices.find((x) => x.id === r.id)?.ref || r.id;
    case "request": return s.data.requests.find((x) => x.id === r.id)?.ref || r.id;
    case "task": return s.data.tasks.find((x) => x.id === r.id)?.title || r.id;
    case "obligation": {
      const o = s.data.obligations.find((x) => x.id === r.id);
      return o ? (s.config.standards.requirements.find((q) => q.id === o.requirementId)?.label || o.requirementId) : r.id;
    }
    default: return r.id;
  }
};
export const describeRef = refLabel;

function requiredGaps(s: CoreState, r: RecordItem) {
  const type = s.config.recordTypes.find((t) => t.id === r.typeId);
  return (type?.fields || []).filter((f) => f.required && (r.fields[f.key] === null || r.fields[f.key] === undefined || r.fields[f.key] === ""));
}

const money = (n: number, cur: string) => {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); } catch { return cur + " " + Math.round(n); }
};

interface ToolOut {
  ok: boolean;
  input: string;
  output: string;
  refs: Ref[];
  error?: { business: string; technical: string; retryable: boolean };
  effect?: { key: string; description: string; apply: (s: CoreState) => Ref | undefined };
}

const missing = (what: string, id: string): ToolOut => ({ ok: false, input: id, output: "", refs: [],
  error: { business: "The " + what + " it was asked to work on could not be found. It may have been removed, or its module is switched off.", technical: what + " " + id + " not found in the data visible to this run", retryable: true } });

/** Run one tool for real against the data the run may see. Pure: effects are returned, not applied. */
function execTool(s: CoreState, ctx: Ctx, run: AgentRun, toolId: string, target: Ref | undefined, args: Record<string, string> | undefined, actorId: Id): ToolOut {
  const tz = s.config.timezone;
  const { q, inRun } = lens(s, ctx, run);
  const scope = scopeText(s, run.scopeTeamIds);
  switch (toolId) {
    case "read.work": {
      if (target?.kind === "project") return projectRead(s, ctx, target.id, false);
      const tasks = q.tasks({ ignoreScope: true }).filter((t) => inRun(t) && q.isOpenTask(t));
      const late = tasks.filter((t) => q.isOverdue(t)).sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));
      const pending = q.approvals({ ignoreScope: true }).filter((a) => a.status === "pending" && inRun(s.data.requests.find((r) => r.id === a.requestId) || {}));
      return { ok: true, input: "Open tasks and pending decisions in " + scope,
        output: tasks.length + " open task" + (tasks.length === 1 ? "" : "s") + ", " + late.length + " overdue, " + pending.length + " decision" + (pending.length === 1 ? "" : "s") + " pending in " + scope + "."
          + (late[0] ? " Oldest overdue: " + late[0].title + "." : ""),
        refs: [...late.slice(0, 3).map((t) => ({ kind: "task" as const, id: t.id })), ...pending.slice(0, 2).map((a) => ({ kind: "request" as const, id: a.requestId }))] };
    }
    case "read.records": {
      const recs = q.records({ ignoreScope: true }).filter(inRun);
      const gaps = recs.map((r) => ({ r, g: requiredGaps(s, r) })).filter((x) => x.g.length);
      return { ok: true, input: "Records in " + scope,
        output: recs.length + " records in scope; " + (gaps.length ? gaps.length + " with a required field missing: " + gaps.slice(0, 3).map((x) => x.r.ref + " (" + x.g.map((f) => f.label.toLowerCase()).join(", ") + ")").join(", ") + "." : "no required field is missing."),
        refs: gaps.slice(0, 3).map((x) => ({ kind: "record" as const, id: x.r.id })) };
    }
    case "read.files": {
      if (target?.kind === "file") {
        const f = q.file(target.id);
        if (!f) return missing("document", target.id);
        const v = f.versions[f.versions.length - 1];
        return { ok: true, input: f.title, output: f.title + ", version " + (v?.n ?? 0) + (v?.approved ? " (approved)" : " (not approved)") + ". Review date " + fmtDate(f.reviewDate, tz) + ".",
          refs: [{ kind: "file", id: f.id }] };
      }
      const files = q.files({ ignoreScope: true }).filter(inRun);
      const due = files.filter((f) => f.reviewDate && ms(f.reviewDate) < ms(ctx.now));
      return { ok: true, input: "Documents in " + scope, output: files.length + " documents in scope; " + due.length + " past their review date.",
        refs: due.slice(0, 3).map((f) => ({ kind: "file" as const, id: f.id })) };
    }
    case "write.task": {
      const rec = target?.kind === "record" ? q.record(target.id) : undefined;
      if (!rec) return missing("record", target?.id || "none");
      const field = args?.field || "";
      const def = s.config.recordTypes.find((t) => t.id === rec.typeId)?.fields.find((f) => f.key === field);
      const title = "Fill missing " + (def?.label || field).toLowerCase() + " on " + rec.ref;
      const key = "task:" + rec.id + ":" + field;
      const instanceKey = "agent-gap:" + rec.id + ":" + field;
      const dup = s.data.tasks.find((t) => (t.instanceKey === instanceKey || t.title.toLowerCase() === title.toLowerCase()) && t.status !== "done" && t.status !== "cancelled");
      if (dup) return { ok: true, input: title, output: "A task for this is already open: " + dup.title + ". No second task created.", refs: [{ kind: "task", id: dup.id }, { kind: "record", id: rec.id }] };
      return { ok: true, input: title, output: "Created task: " + title + ", in the " + q.teamLabel(rec.teamId) + " queue.", refs: [{ kind: "record", id: rec.id }],
        effect: { key, description: "Created task: " + title, apply: (st) => {
          const id = ops.nid(st, "t");
          const task: Task = { id, title, teamId: rec.teamId, unitId: rec.unitId, assigneeId: null, linkedRecordIds: [rec.id], priority: "normal", status: "open",
            dueAt: addBusinessHours(ctx.now, 16, tz), dependsOn: [], checklist: [], notes: [], evidenceFileIds: [], instanceKey, createdAt: ctx.now, createdBy: actorId,
            slaPolicyId: "sla-task", origin: { kind: "agent-run", id: run.id } };
          st.data.tasks.push(task);
          ops.logEvent(st, ctx, { actorId, actorKind: "agent", action: "task.created", objectType: "task", objectId: id, recordIds: [rec.id], teamId: rec.teamId, unitId: rec.unitId,
            summary: "Created task: " + title, storyKey: "agentRun:" + rootRun(st, run).id, simulated: true });
          return { kind: "task", id };
        } } };
    }
    case "project.update": {
      if (target?.kind !== "project") return missing("project", target?.id || "none");
      return projectRead(s, ctx, target.id, true);
    }
    case "standards.precheck": {
      if (target?.kind === "file") return execTool(s, ctx, run, "read.files", target, args, actorId);
      const o = target?.kind === "obligation" ? s.data.obligations.find((x) => x.id === target.id) : undefined;
      if (!o) return missing("requirement", target?.id || "none");
      const req = s.config.standards.requirements.find((r) => r.id === o.requirementId);
      const f = o.evidence ? s.data.files.find((x) => x.id === o.evidence!.fileId) : undefined;
      const name = req?.label || o.requirementId;
      const refs: Ref[] = [{ kind: "obligation", id: o.id }, ...(f ? [{ kind: "file" as const, id: f.id }] : [])];
      let out: string;
      if (o.state === "approved") out = name + " is already accepted" + (o.decidedAt ? " (" + fmtDate(o.decidedAt, tz) + ")" : "") + ". Nothing to check.";
      else if (o.state === "missing" || !o.evidence) out = name + ": no evidence received yet. Expected: " + (req?.evidence || "the evidence the requirement names") + ".";
      else {
        const gaps: string[] = [];
        if (!f) gaps.push("the evidence file is not visible");
        if (o.dueAt && ms(o.dueAt) < ms(ctx.now)) gaps.push("it is past its due date");
        out = name + ": evidence received (" + (f?.title || "file") + ", version " + o.evidence.version + "), not yet reviewed. Compared with the requirement"
          + (req?.evidence ? " (" + req.evidence + ")" : "") + (gaps.length ? "; check: " + gaps.join(", ") : "; no obvious gaps") + ". A reviewer still decides; a pre-check never accepts evidence.";
      }
      return { ok: true, input: name, output: out, refs };
    }
    case "purchasing.match": {
      const inv = target?.kind === "invoice" ? s.data.invoices.find((x) => x.id === target.id) : undefined;
      if (!inv) return missing("invoice", target?.id || "none");
      const po = s.data.orders.find((o) => o.id === inv.orderId);
      const refs: Ref[] = [{ kind: "invoice", id: inv.id }, ...(inv.requestId ? [{ kind: "request" as const, id: inv.requestId }] : [])];
      if (!po) return { ok: true, input: inv.ref, output: inv.ref + " has no matching order, so it cannot be matched. It needs a person to review it.", refs };
      if (po.currency !== inv.currency) return { ok: true, input: inv.ref + " against " + po.ref, output: "The invoice is in " + inv.currency + " and the order in " + po.currency + ". Currencies are not converted, so they were not compared.", refs };
      const diff = inv.amount - po.total;
      const pct = po.total ? (diff / po.total) * 100 : 0;
      const tol = s.config.purchasing.tolerancePercent;
      return { ok: true, input: inv.ref + " against " + po.ref,
        output: inv.ref + " is " + money(inv.amount, inv.currency) + "; order " + po.ref + " is " + money(po.total, po.currency) + ". "
          + (diff > 0 ? "It is " + money(diff, inv.currency) + " (" + pct.toFixed(1) + "%) above the order, " + (pct > tol ? "beyond" : "within") + " the " + tol + "% tolerance." : diff < 0 ? "It is below the order." : "It matches the order.")
          + " Matching notes only: approval to pay stays with a person in Work.", refs };
    }
    case "finance.read": {
      const budgets = s.data.budgets.filter((b) => inRun({ teamId: b.teamId, unitId: b.unitId }));
      return { ok: true, input: "Budgets in " + scope, output: budgets.length + " budget" + (budgets.length === 1 ? "" : "s") + " in scope. Figures are read, never combined across currencies.",
        refs: budgets.slice(0, 2).filter((b) => b.projectId).map((b) => ({ kind: "project" as const, id: b.projectId! })) };
    }
    case "write.request": case "updates.draft": case "write.issue": case "write.record": case "project.milestone":
      return { ok: true, input: toolLabel(s, toolId), output: "Prepared a draft for a person to check. Nothing was submitted or changed.", refs: target ? [target] : [] };
    case "notify.email":
      return { ok: false, input: "Email", output: "", refs: [], error: { business: "Email delivery is not connected. Nothing was sent.", technical: "notify.email: source s-email not connected; the sample engine never sends", retryable: true } };
    default:
      return { ok: false, input: toolId, output: "", refs: [], error: { business: "This tool has no sample behaviour, so the step did not run.", technical: "no executor for " + toolId, retryable: false } };
  }
}

function projectRead(s: CoreState, ctx: Ctx, projectId: Id, draftUpdate: boolean): ToolOut {
  const tz = s.config.timezone;
  const p = s.data.projects.find((x) => x.id === projectId);
  if (!p) return missing("project", projectId);
  const ms_ = s.data.milestones.filter((m) => m.projectId === p.id).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const done = ms_.filter((m) => m.completedAt).length;
  const next = ms_.find((m) => !m.completedAt);
  const slip = next ? Math.round((ms(next.dueAt) - ms(next.baselineAt)) / 86_400_000) : 0;
  const tasks = s.data.tasks.filter((t) => t.projectId === p.id && t.status !== "done" && t.status !== "cancelled");
  const late = tasks.filter((t) => t.dueAt && ms(t.dueAt) < ms(ctx.now));
  const nextText = next ? "Next milestone: " + next.label + ", due " + fmtDate(next.dueAt, tz) + (slip > 0 ? ", " + slip + " days later than planned" : slip < 0 ? ", ahead of plan" : ", on plan") + "." : "No open milestones.";
  const body = done + " of " + ms_.length + " milestones complete. " + nextText + " " + tasks.length + " open tasks, " + late.length + " overdue.";
  const refs: Ref[] = [{ kind: "project", id: p.id }, ...late.slice(0, 2).map((t) => ({ kind: "task" as const, id: t.id }))];
  return draftUpdate
    ? { ok: true, input: p.title, output: "Draft update for " + p.title + ": " + body + " Not posted: the project owner decides whether to post it.", refs }
    : { ok: true, input: p.title, output: p.title + ": " + body, refs };
}

/* ── Planning ──────────────────────────────────────────────────────────── */

type Role = "coordinator" | "briefing" | "project" | "docreview" | "quality" | "triage" | "invoice" | "general";

const ROLE_BY_TEMPLATE: Record<string, Role> = {
  "tpl-coordination": "coordinator", "tpl-briefing": "briefing", "tpl-project": "project", "tpl-docreview": "docreview",
  "tpl-quality": "quality", "tpl-triage": "triage", "tpl-invoice": "invoice"
};

const KEYWORDS: Record<Role, string[]> = {
  coordinator: ["coordinate", "work", "queue", "clear", "route"],
  briefing: ["brief", "summary", "summar", "status", "week", "changed", "digest", "update"],
  project: ["project", "milestone", "risk", "deadline", "timeline", "status", "readiness", "rollout"],
  docreview: ["document", "evidence", "sign-off", "signoff", "assessment", "requirement", "pre-check", "precheck"],
  quality: ["data", "quality", "missing", "duplicate", "gap", "field", "correct"],
  triage: ["request", "triage", "intake", "incoming"],
  invoice: ["invoice", "order", "supplier", "match", "payable"],
  general: []
};

const INPUT_ROLE: Record<string, Role> = { project: "project", obligation: "docreview", file: "docreview", invoice: "invoice", record: "quality", request: "triage" };
const TEMPLATE_FOR_INPUT: Record<string, string> = { project: "tpl-project", obligation: "tpl-docreview", file: "tpl-docreview", record: "tpl-quality", request: "tpl-triage" };

function roleOf(s: CoreState, a: AgentDef): Role {
  if (childrenOf(s, a.id).length) return "coordinator";
  if (a.templateId && ROLE_BY_TEMPLATE[a.templateId]) return ROLE_BY_TEMPLATE[a.templateId];
  const t = (a.name + " " + a.purpose).toLowerCase();
  for (const r of ["briefing", "project", "docreview", "quality", "triage", "invoice"] as Role[]) if (KEYWORDS[r].some((w) => t.includes(w))) return r;
  return "general";
}

function relevance(s: CoreState, a: AgentDef, goal: string, inputs: { kind: string }[], depth = 0): number {
  const role = roleOf(s, a);
  const g = goal.toLowerCase();
  let score = KEYWORDS[role].filter((w) => g.includes(w)).length;
  score += inputs.filter((i) => INPUT_ROLE[i.kind] === role).length * 3;
  if (role === "coordinator" && depth < 4) score += Math.max(0, ...childrenOf(s, a.id).map((c) => relevance(s, c, goal, inputs, depth + 1)));
  return score;
}

function covers(s: CoreState, a: AgentDef, input: { kind: string }, depth = 0): boolean {
  const role = roleOf(s, a);
  if (INPUT_ROLE[input.kind] === role) return true;
  return role === "coordinator" && depth < 4 && childrenOf(s, a.id).some((c) => covers(s, c, input, depth + 1));
}

const scopesOverlap = (a: Scope, b: Scope) => { const x = intersectScope(a, b); return x === "all" || x.length > 0; };

function pickChildren(s: CoreState, run: AgentRun, a: AgentDef): { picks: AgentDef[]; notes: string[] } {
  const lim = agentLimits(s, a, run.snapshot?.limits);
  const notes: string[] = [];
  const kids = childrenOf(s, a.id).filter((k) => {
    if (availabilityOf(k) !== "ready") { notes.push(k.name + " is " + AVAILABILITY_LABEL[availabilityOf(k)].toLowerCase() + ", so it was not asked."); return false; }
    if (!scopesOverlap(k.scope.teamIds, run.scopeTeamIds)) { notes.push(k.name + " has no scope in common with this run."); return false; }
    return true;
  });
  const scored = kids.map((k, i) => ({ k, i, n: relevance(s, k, run.goal, run.inputs) })).sort((x, y) => y.n - x.n || x.i - y.i);
  let picks = scored.filter((x) => x.n > 0).map((x) => x.k);
  if (!picks.length) picks = scored.slice(0, 2).map((x) => x.k);
  if (picks.length > lim.maxChildren) { notes.push("Limited to " + lim.maxChildren + " delegations by its child limit."); picks = picks.slice(0, lim.maxChildren); }
  return { picks, notes };
}

function buildPlan(s: CoreState, ctx: Ctx, run: AgentRun, a: AgentDef): { plan: AgentPlanItem[]; summary: string } {
  const tools = run.snapshot?.tools || toolsOf(a);
  const has = (t: string) => tools.includes(t);
  const plan: AgentPlanItem[] = [];
  const add = (p: Omit<AgentPlanItem, "id" | "status" | "attempts">) => plan.push({ id: "p" + (plan.length + 1), status: "pending", attempts: 0, ...p });
  const role = roleOf(s, a);
  const notes: string[] = [];
  const asRef = (i: { kind: string; id: Id }): Ref | undefined =>
    (["record", "task", "file", "request", "approval", "project", "invoice", "issue", "obligation"] as string[]).includes(i.kind) ? { kind: i.kind as AgentSourceKind, id: i.id } : undefined;
  const { q, inRun } = lens(s, ctx, run);
  const firstTool = (...ids: string[]) => ids.find(has);

  if (role === "coordinator") {
    const { picks, notes: n } = pickChildren(s, run, a);
    notes.push(...n);
    for (const k of picks) add({ kind: "delegate", agentId: k.id, label: "Delegate to " + k.name });
    const uncovered = run.inputs.filter((i) => !picks.some((p) => covers(s, p, i)));
    const spawn = run.snapshot?.spawn;
    for (const i of uncovered) {
      const tpl = TEMPLATE_FOR_INPUT[i.kind];
      const ref = asRef(i);
      if (tpl && ref && spawn?.enabled && spawn.templateIds.includes(tpl)) add({ kind: "spawn", templateId: tpl, target: ref, label: "Temporary worker for " + refLabel(s, ref) });
      else if (ref) notes.push("No capability agent or allowed worker covers " + refLabel(s, ref) + ".");
    }
    if (picks.length) notes.unshift("Chose " + picks.map((p) => p.name).join(" and ") + (relevance(s, picks[0], run.goal, run.inputs) > 0 ? ": their responsibilities match the goal and inputs." : ": no child matched the goal closely, so the first ready ones were asked."));
    if (!plan.length) { const t = firstTool("read.work", "read.records"); if (t) add({ kind: "tool", toolId: t, label: "Read " + toolLabel(s, t).toLowerCase().replace(/^read /, "") + " in scope" }); }
  } else if (role === "briefing") {
    for (const t of ["read.work", "read.records", "read.files"]) if (has(t)) add({ kind: "tool", toolId: t, label: toolLabel(s, t) + " in scope" });
  } else if (role === "project") {
    const inputs = run.inputs.filter((i) => i.kind === "project");
    const targets = inputs.length ? inputs.map((i) => i.id)
      : s.data.projects.filter((p) => (p.status === "active" || p.status === "planned") && inRun(p) && q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })).slice(0, 1).map((p) => p.id);
    for (const id of targets.slice(0, 2)) {
      const ref: Ref = { kind: "project", id };
      if (has("read.work")) add({ kind: "tool", toolId: "read.work", target: ref, label: "Read milestones and tasks for " + refLabel(s, ref) });
      if (has("project.update")) add({ kind: "tool", toolId: "project.update", target: ref, label: "Draft a progress update for " + refLabel(s, ref) });
    }
    if (!targets.length) { notes.push("No active project is in this run's scope."); if (has("read.work")) add({ kind: "tool", toolId: "read.work", label: "Read work in scope" }); }
  } else if (role === "docreview") {
    let targets = run.inputs.filter((i) => i.kind === "obligation" || i.kind === "file").map(asRef).filter((x): x is Ref => !!x);
    if (!targets.length) targets = s.data.obligations.filter((o) => o.state === "received").slice(0, 2).map((o) => ({ kind: "obligation" as const, id: o.id }));
    const tool = firstTool("standards.precheck", "read.files");
    const spawn = run.snapshot?.spawn;
    targets.forEach((t, i) => {
      const toolFor = t.kind === "file" ? firstTool("read.files", "standards.precheck") : tool;
      if (i > 0 && spawn?.enabled && spawn.templateIds.includes("tpl-docreview")) add({ kind: "spawn", templateId: "tpl-docreview", target: t, label: "Temporary worker to pre-check " + refLabel(s, t) });
      else if (toolFor) add({ kind: "tool", toolId: toolFor, target: t, label: "Pre-check " + refLabel(s, t) });
    });
    if (!targets.length) notes.push("No received evidence is waiting for a pre-check.");
  } else if (role === "quality") {
    if (has("read.records")) add({ kind: "tool", toolId: "read.records", label: "Scan records in scope for missing required fields" });
    const recs = q.records({ ignoreScope: true }).filter(inRun).filter((r) => !run.inputs.some((i) => i.kind === "record") || run.inputs.some((i) => i.kind === "record" && i.id === r.id));
    let n = 0;
    for (const r of recs) {
      for (const f of requiredGaps(s, r)) {
        if (n >= 2) break;
        const linked = s.data.files.find((x) => x.linkedRecordIds.includes(r.id) && x.reviewDate);
        if (f.kind === "date" && f.key === "reviewDate" && linked && has("write.record")) {
          const value = localDay(linked.reviewDate!, s.config.timezone);
          add({ kind: "action", toolId: "write.record", target: { kind: "record", id: r.id }, label: "Set " + f.label.toLowerCase() + " on " + r.ref,
            action: { kind: "record-field", recordId: r.id, field: f.key, value, basis: "the review date of the linked document " + linked.title + " (" + linked.id + ")" },
            effectKey: "record:" + r.id + ":" + f.key + "=" + value });
          n++;
        } else if (has("write.task")) {
          add({ kind: "tool", toolId: "write.task", target: { kind: "record", id: r.id }, args: { field: f.key }, label: "Create a task to fill " + f.label.toLowerCase() + " on " + r.ref });
          n++;
        }
      }
      if (n >= 2) break;
    }
  } else if (role === "triage") {
    if (has("read.work")) add({ kind: "tool", toolId: "read.work", label: "Read new requests and decisions in scope" });
  } else if (role === "invoice") {
    let targets = run.inputs.filter((i) => i.kind === "invoice").map((i) => i.id);
    if (!targets.length) targets = s.data.invoices.filter((i) => i.status === "exception" || i.status === "received").slice(0, 1).map((i) => i.id);
    for (const id of targets) if (has("purchasing.match")) add({ kind: "tool", toolId: "purchasing.match", target: { kind: "invoice", id }, label: "Match " + refLabel(s, { kind: "invoice", id }) + " with its order" });
    if (!targets.length) notes.push("No invoice is waiting to be matched.");
  } else {
    for (const t of tools.filter((t) => t.startsWith("read."))) add({ kind: "tool", toolId: t, label: toolLabel(s, t) + " in scope" });
    if (has("notify.email")) add({ kind: "action", toolId: "notify.email", label: "Send an email summary", action: { kind: "email", to: "Accountable owner", subject: run.goal }, effectKey: "email:" + run.id });
  }
  const summary = plan.length
    ? "Planned " + plan.length + " step" + (plan.length === 1 ? "" : "s") + ": " + plan.map((p) => p.label.charAt(0).toLowerCase() + p.label.slice(1)).join("; ") + "." + (notes.length ? " " + notes.join(" ") : "")
    : "Nothing to do for this goal in this scope." + (notes.length ? " " + notes.join(" ") : "");
  return { plan, summary };
}

/* ── The engine ────────────────────────────────────────────────────────── */

interface NewRunOpts {
  agent: AgentDef; goal: string; inputs: { kind: string; id: Id }[]; scope: Scope; initiator: AgentRun["initiator"];
  parent?: AgentRun; key: string; tools: string[]; test?: boolean;
}

function newRun(s: CoreState, ctx: Ctx, o: NewRunOpts): AgentRun {
  const id = ops.nid(s, "run");
  const run: AgentRun = {
    id, ref: "AGR-" + (100 + s.data.agentRuns.length + 1), agentId: o.agent.id, agentVersion: versionOf(o.agent), parentRunId: o.parent?.id,
    depth: o.parent ? o.parent.depth + 1 : 0, goal: o.goal, scopeTeamIds: o.scope, initiator: o.initiator, idempotencyKey: o.key, state: "queued",
    startedAt: ctx.now, steps: [], workers: [], childRunIds: [], inputs: o.inputs, outputs: [], appliedEffects: [], usage: { reported: false },
    simulated: true, test: o.test || undefined,
    snapshot: { name: o.agent.name, tools: [...o.tools], limits: agentLimits(s, o.agent), spawn: o.agent.spawn ? structuredClone(o.agent.spawn) : undefined }
  };
  s.data.agentRuns.push(run);
  const who = o.initiator.kind === "person" ? personName(s, o.initiator.id) : o.initiator.kind === "agent" ? personName(s, o.initiator.id) + (o.parent ? " (" + o.parent.ref + ")" : "") : o.initiator.kind;
  addStep(run, ctx, "queued", o.initiator.kind === "person" ? { kind: "person", id: o.initiator.id } : o.initiator.kind === "agent" ? { kind: "agent", id: o.initiator.id } : { kind: "system", id: "system" },
    (o.test ? "Test run queued by " : o.parent ? "Delegated by " : "Queued by ") + who + ". Scope: " + scopeText(s, o.scope) + "." + (o.test ? " Isolated: nothing it does is applied." : ""));
  const { plan, summary } = buildPlan(s, ctx, run, o.agent);
  run.plan = plan;
  run.state = "planning";
  addStep(run, ctx, "planning", agentActor(run), summary);
  return run;
}

/** Runs being advanced right now, so a child finishing does not re-enter its parent's loop. */
const busy = new Set<Id>();

function advance(s: CoreState, ctx: Ctx, runId: Id) {
  if (busy.has(runId)) return;
  busy.add(runId);
  try {
    for (let guard = 0; guard < 80; guard++) {
      const run = runById(s, runId);
      if (!run || TERMINAL.has(run.state)) return;
      const plan = run.plan || [];
      reconcile(s, ctx, run);
      if (run.stop && !run.stop.acknowledgedAt) {
        if (unresolvedWait(s, run)) { run.state = "stop_requested"; return; }
        acknowledgeStop(s, ctx, run);
        return;
      }
      const next = plan.find((i) => i.status === "pending");
      if (next) {
        run.state = "running";
        execItem(s, ctx, run, next);
        if (next.status === "failed") { markFailed(s, ctx, run, next); return; }
        continue;
      }
      const failed = plan.find((i) => i.status === "failed");
      if (failed) { markFailed(s, ctx, run, failed); return; }
      const waitingAp = plan.find((i) => i.kind === "action" && i.status === "waiting");
      const approved = plan.find((i) => i.status === "approved");
      const waitingChild = plan.find((i) => i.kind === "delegate" && i.status === "waiting");
      if (waitingAp) {
        const req = s.data.requests.find((r) => r.id === waitingAp.requestId);
        const ap = s.data.approvals.find((a) => a.id === req?.approvalId);
        run.state = req?.status === "changes_requested" ? "waiting_input" : "waiting_approval";
        run.approvalRequestId = waitingAp.requestId;
        run.waitingOwnerId = req?.status === "changes_requested" ? req.requesterId : ap?.stages.find((st) => st.status === "pending")?.assigneeId || undefined;
        return;
      }
      if (approved) {
        run.state = "waiting_input";
        run.waitingOwnerId = s.data.requests.find((r) => r.id === approved.requestId)?.requesterId;
        return;
      }
      if (waitingChild) { run.state = "delegated"; run.waitingOwnerId = undefined; return; }
      finish(s, ctx, run);
      return;
    }
  } finally {
    busy.delete(runId);
  }
}

/** Pick up changes made outside a decision: a withdrawn request, a child that ended. */
function reconcile(s: CoreState, ctx: Ctx, run: AgentRun) {
  for (const it of run.plan || []) {
    if (it.kind === "action" && it.status === "waiting") {
      const req = s.data.requests.find((r) => r.id === it.requestId);
      if (req && (req.status === "withdrawn" || req.status === "declined")) {
        it.status = "skipped";
        it.note = req.status === "withdrawn" ? "Request withdrawn" : "Declined";
        addStep(run, ctx, "cancelled", { kind: "person", id: req.requesterId }, req.ref + " was " + req.status + ", so the proposed action was not carried out.", { status: "skipped", sourceRefs: [{ kind: "request", id: req.id }] });
      }
    }
    if (it.kind === "delegate" && it.status === "waiting") {
      const child = runById(s, it.childRunId);
      if (child && TERMINAL.has(child.state)) applyChildResult(s, ctx, run, it, child);
    }
  }
}

function unresolvedWait(s: CoreState, run: AgentRun): boolean {
  return (run.plan || []).some((it) => {
    if (it.status !== "waiting") return false;
    if (it.kind === "action") { const r = s.data.requests.find((x) => x.id === it.requestId); return !!r && (r.status === "submitted" || r.status === "changes_requested"); }
    if (it.kind === "delegate") { const c = runById(s, it.childRunId); return !!c && !TERMINAL.has(c.state); }
    return false;
  });
}

function acknowledgeStop(s: CoreState, ctx: Ctx, run: AgentRun) {
  const skipped: string[] = [];
  for (const it of run.plan || []) {
    if (it.status === "pending" || it.status === "approved" || it.status === "waiting") {
      if (it.status === "approved") it.note = "Approved, but the run stopped before it ran";
      it.status = "skipped";
      skipped.push(it.label.charAt(0).toLowerCase() + it.label.slice(1));
    }
  }
  for (const w of run.workers) if (w.state === "active") { w.state = "cancelled"; w.endedAt = ctx.now; }
  run.state = "cancelled";
  run.endedAt = ctx.now;
  run.waitingOwnerId = undefined;
  if (run.stop) run.stop.acknowledgedAt = ctx.now;
  const applied = run.appliedEffects.length ? " Already applied and kept: " + run.appliedEffects.map((e) => e.description).join("; ") + "." : " Nothing had been applied.";
  addStep(run, ctx, "cancelled", { kind: "system", id: "system" }, "Stopped at a safe checkpoint." + (skipped.length ? " Not run: " + skipped.join("; ") + "." : "") + applied, { status: "skipped" });
  logRun(s, ctx, run, "agentRun.cancelled", "stopped at a safe checkpoint", { actorId: "system", actorKind: "system" });
  childEnded(s, ctx, run);
}

function markFailed(s: CoreState, ctx: Ctx, run: AgentRun, item: AgentPlanItem) {
  run.state = "failed";
  run.waitingOwnerId = agentById(s, run.agentId)?.responsibleId;
  logRun(s, ctx, run, "agentRun.failed", "step failed: " + (item.error?.business || item.label));
  childEnded(s, ctx, run);
}

function failItem(run: AgentRun, ctx: Ctx, item: AgentPlanItem, error: { business: string; technical: string; retryable: boolean }, actor: AgentRunStep["actor"]) {
  item.status = "failed";
  item.error = error;
  addStep(run, ctx, "failed", actor, item.label + " failed. " + error.business, { status: "failed", error, toolId: item.toolId, attempt: item.attempts });
}

function execItem(s: CoreState, ctx: Ctx, run: AgentRun, item: AgentPlanItem) {
  const a = agentById(s, run.agentId);
  if (!a || a.archived) {
    failItem(run, ctx, item, { business: (a?.name || "The agent") + " was archived, so no further steps run.", technical: "agent_archived: " + run.agentId, retryable: false }, agentActor(run));
    return;
  }
  item.attempts += 1;
  if (item.kind === "tool") return execToolItem(s, ctx, run, item, a);
  if (item.kind === "delegate") return execDelegate(s, ctx, run, item, a);
  if (item.kind === "spawn") return execSpawn(s, ctx, run, item, a);
  return proposeAction(s, ctx, run, item, a);
}

function toolCheck(s: CoreState, run: AgentRun, a: AgentDef, toolId: string): { business: string; technical: string; retryable: boolean } | null {
  if (!runTools(s, run).includes(toolId)) {
    return { business: a.name + " no longer has the " + toolLabel(s, toolId) + " tool, so this step did not run.",
      technical: "tool_not_permitted: " + toolId + " (run started on version " + run.agentVersion + ", definition now version " + versionOf(a) + ")", retryable: true };
  }
  const st = toolStatus(s, toolId);
  if (!st.usable) return { business: st.reason || "The tool is not available.", technical: "tool_unavailable: " + toolId, retryable: true };
  return null;
}

function execToolItem(s: CoreState, ctx: Ctx, run: AgentRun, item: AgentPlanItem, a: AgentDef) {
  const toolId = item.toolId || "";
  const bad = toolCheck(s, run, a, toolId);
  if (bad) return failItem(run, ctx, item, bad, agentActor(run));
  const out = execTool(s, ctx, run, toolId, item.target, item.args, a.id);
  if (!out.ok) return failItem(run, ctx, item, out.error!, agentActor(run));
  let summary = item.label;
  let effectKey: string | undefined;
  let output = out.output;
  if (out.effect) {
    effectKey = out.effect.key;
    if (run.test) { output = "Would apply: " + out.effect.description + ". Test run, so nothing was changed."; }
    else if (run.appliedEffects.some((e) => e.key === out.effect!.key)) { output = out.effect.description + ". Already applied earlier in this run; not repeated."; }
    else {
      const created = out.effect.apply(s);
      if (created) { item.created = created; out.refs.unshift(created); }
      run.appliedEffects.push({ key: out.effect.key, description: out.effect.description, at: ctx.now });
    }
  }
  item.status = "done";
  item.output = output;
  addStep(run, ctx, "tool_call", agentActor(run), summary, { toolId, input: out.input, output, sourceRefs: out.refs, effectKey, attempt: item.attempts });
}

function execDelegate(s: CoreState, ctx: Ctx, run: AgentRun, item: AgentPlanItem, a: AgentDef) {
  const target = agentById(s, item.agentId);
  const skip = (why: string) => { item.status = "skipped"; item.note = why; addStep(run, ctx, "delegated", agentActor(run), "Not delegated: " + why, { status: "skipped" }); };
  if (!target || target.archived) return skip((target?.name || "The agent") + " is no longer available.");
  if (run.test) {
    item.status = "done";
    item.output = "Would delegate to " + target.name + ".";
    addStep(run, ctx, "delegated", agentActor(run), "Would delegate to " + target.name + ". Test run, so no child run was started.");
    return;
  }
  const key = run.idempotencyKey + "/" + item.id;
  const existing = s.data.agentRuns.find((r) => r.idempotencyKey === key);
  if (existing) { item.childRunId = existing.id; item.status = "waiting"; advance(s, ctx, existing.id); return; }
  if (availabilityOf(target) !== "ready") return skip(target.name + " is " + AVAILABILITY_LABEL[availabilityOf(target)].toLowerCase() + ", so it takes no new work.");
  const lim = agentLimits(s, a, run.snapshot?.limits);
  const depth = depthAllowed(s, run, run.depth + 1);
  if (!depth.ok) return skip("the delegation depth limit of " + depth.limit + " is reached.");
  if (run.childRunIds.length + run.workers.length >= lim.maxChildren) return skip("this run already has " + lim.maxChildren + " child runs or workers, its limit.");
  const tl = agentLimits(s, target);
  if (activeRunsOf(s, target.id).length >= tl.maxConcurrentRuns) {
    return failItem(run, ctx, item, { business: target.name + " is already running " + tl.maxConcurrentRuns + " run" + (tl.maxConcurrentRuns === 1 ? "" : "s") + ", its limit. Retry once one finishes.",
      technical: "concurrency_limit: " + target.id + " maxConcurrentRuns=" + tl.maxConcurrentRuns, retryable: true }, agentActor(run));
  }
  const scope = intersectScope(run.scopeTeamIds, target.scope.teamIds);
  if (scope !== "all" && !scope.length) return skip(target.name + " has no scope in common with this run.");
  const parentTools = runTools(s, run);
  const tools = toolsOf(target).filter((t) => parentTools.includes(t));
  const dropped = toolsOf(target).filter((t) => !parentTools.includes(t));
  const inputs = run.inputs.filter((i) => covers(s, target, i));
  const child = newRun(s, ctx, { agent: target, goal: run.goal, inputs: inputs.length ? inputs : run.inputs, scope, initiator: { kind: "agent", id: a.id }, parent: run, key, tools });
  run.childRunIds.push(child.id);
  item.childRunId = child.id;
  item.status = "waiting";
  addStep(run, ctx, "delegated", agentActor(run), "Delegated to " + target.name + " (" + child.ref + "). It works within " + scopeText(s, scope) + " with the tools both agents hold"
    + (dropped.length ? "; not passed on: " + dropped.map((t) => toolLabel(s, t)).join(", ") : "") + ".", { childRunId: child.id, status: "current" });
  logRun(s, ctx, run, "agentRun.delegated", "delegated to " + target.name + " (" + child.ref + ")");
  advance(s, ctx, child.id);
}

function execSpawn(s: CoreState, ctx: Ctx, run: AgentRun, item: AgentPlanItem, a: AgentDef) {
  const skip = (why: string) => { item.status = "skipped"; item.note = why; addStep(run, ctx, "spawned", agentActor(run), "No temporary worker created: " + why, { status: "skipped" }); };
  const policy = run.snapshot?.spawn;
  const nowPolicy = a.spawn;
  const tpl: AgentTemplateDef | undefined = s.config.agentTemplates.find((t) => t.id === item.templateId);
  if (!policy?.enabled || !nowPolicy?.enabled) return skip(a.name + "'s spawn policy is off.");
  if (!item.templateId || !policy.templateIds.includes(item.templateId) || !nowPolicy.templateIds.includes(item.templateId)) return skip("the " + (tpl?.label || "chosen") + " template is not allowed by its spawn policy.");
  if (!tpl || !tpl.workerOk) return skip("the " + (tpl?.label || "chosen") + " template cannot be used for workers.");
  const maxWorkers = Math.min(policy.maxWorkers, nowPolicy.maxWorkers);
  if (run.workers.length >= maxWorkers) return skip("the worker limit of " + maxWorkers + " is reached.");
  const lim = agentLimits(s, a, run.snapshot?.limits);
  if (run.childRunIds.length + run.workers.length >= lim.maxChildren) return skip("this run already has " + lim.maxChildren + " child runs or workers, its limit.");
  const depth = depthAllowed(s, run, run.depth + 1);
  if (!depth.ok) return skip("the delegation depth limit of " + depth.limit + " is reached.");
  const parentTools = runTools(s, run);
  const tools = tpl.tools.filter((t) => parentTools.includes(t) && !isRestricted(s, t));
  const target = item.target;
  const pick = target?.kind === "obligation" ? ["standards.precheck", "read.files"] : target?.kind === "file" ? ["read.files", "standards.precheck"]
    : target?.kind === "project" ? ["read.work", "project.update"] : target?.kind === "record" ? ["read.records"] : target?.kind === "invoice" ? ["purchasing.match"] : ["read.work", "read.records", "read.files"];
  const toolId = pick.find((t) => tools.includes(t) && toolStatus(s, t).usable);
  if (run.test) {
    item.status = "done";
    item.output = "Would create a " + tpl.label + " worker with " + (tools.map((t) => toolLabel(s, t)).join(", ") || "no tools") + ".";
    addStep(run, ctx, "spawned", agentActor(run), item.output + " Test run, so no worker was created.");
    return;
  }
  const worker: TempWorker = {
    id: run.id + "-w" + (run.workers.length + 1), runId: run.id, templateId: tpl.id, label: tpl.label + " worker " + (run.workers.length + 1),
    scopeTeamIds: run.scopeTeamIds === "all" ? "all" : [...run.scopeTeamIds], tools, depth: run.depth + 1, state: "active", createdAt: ctx.now
  };
  run.workers.push(worker);
  item.workerId = worker.id;
  addStep(run, ctx, "spawned", agentActor(run), "Created temporary worker " + worker.label + (target ? " for " + refLabel(s, target) : "") + ". Tools: "
    + (tools.map((t) => toolLabel(s, t)).join(", ") || "none") + " (its template and this run's tools in common, restricted tools excluded). Scope: " + scopeText(s, worker.scopeTeamIds) + ". It ends with this task.",
    { workerId: worker.id, sourceRefs: target ? [target] : [] });
  logRun(s, ctx, run, "agentRun.worker", "created temporary worker " + worker.label);
  if (!toolId) {
    worker.state = "failed"; worker.endedAt = ctx.now; worker.output = "No permitted tool fits this task.";
    item.status = "skipped"; item.note = worker.output;
    addStep(run, ctx, "output", { kind: "worker", id: worker.id }, worker.label + " stopped: no permitted tool fits this task.", { workerId: worker.id, status: "skipped" });
    return;
  }
  const out = execTool(s, ctx, run, toolId, target, item.args, a.id);
  if (!out.ok) {
    worker.state = "failed"; worker.endedAt = ctx.now; worker.output = out.error!.business;
    return failItem(run, ctx, item, out.error!, { kind: "worker", id: worker.id });
  }
  addStep(run, ctx, "tool_call", { kind: "worker", id: worker.id }, toolLabel(s, toolId) + (target ? ": " + refLabel(s, target) : ""), { workerId: worker.id, toolId, input: out.input, output: out.output, sourceRefs: out.refs });
  worker.state = "completed";
  worker.endedAt = ctx.now;
  worker.output = out.output;
  item.status = "done";
  item.output = out.output;
}

/** A restricted tool use becomes a proposed action and a canonical request in Work. The run then waits. */
function proposeAction(s: CoreState, ctx: Ctx, run: AgentRun, item: AgentPlanItem, a: AgentDef) {
  const toolId = item.toolId || "";
  const desc = actionText(s, item);
  const refs: Ref[] = item.target ? [item.target] : [];
  if (item.action?.kind === "record-field") { const fid = item.action.basis.match(/\((f-[^)]+)\)/)?.[1]; if (fid) refs.push({ kind: "file", id: fid }); }
  if (run.test) {
    item.status = "done";
    item.output = "Would propose: " + desc + ". It would wait for a person to approve it in Work.";
    addStep(run, ctx, "proposed_action", agentActor(run), item.output + " Test run, so no request was raised.", { toolId, sourceRefs: refs });
    return;
  }
  // Permission is checked when the action is proposed, never only when it is executed. External tools fail at execution, honestly.
  if (!runTools(s, run).includes(toolId)) {
    return failItem(run, ctx, item, { business: a.name + " no longer has the " + toolLabel(s, toolId) + " tool, so it cannot propose this action.", technical: "tool_not_permitted: " + toolId, retryable: true }, agentActor(run));
  }
  addStep(run, ctx, "proposed_action", agentActor(run), "Proposed: " + desc + ". " + toolLabel(s, toolId) + " is restricted, so a person decides first.", { toolId, input: desc, sourceRefs: refs, effectKey: item.effectKey });
  const dup = s.data.requests.find((r) => r.formId === AGENT_ACTION_FORM && r.fields.effectKey === item.effectKey && (r.status === "submitted" || r.status === "changes_requested"));
  if (dup) {
    item.requestId = dup.id;
    item.status = "waiting";
    addStep(run, ctx, "waiting_approval", { kind: "system", id: "system" }, "The same action is already waiting for approval in " + dup.ref + ", so no second request was raised.", { sourceRefs: [{ kind: "request", id: dup.id }] });
    return;
  }
  ensureActionRoute(s, ctx);
  const requester = runPerson(s, run);
  const rec = item.target?.kind === "record" ? s.data.records.find((r) => r.id === item.target!.id) : undefined;
  const requesterTeams = s.data.memberships.filter((m) => m.personId === requester).map((m) => m.teamId);
  const teamId = rec?.teamId || (run.scopeTeamIds !== "all" ? run.scopeTeamIds[0] : undefined) || requesterTeams[0];
  const res = ops.createRequest(s, { ...ctx, viewerId: requester }, {
    formId: AGENT_ACTION_FORM, title: "Agent action: " + desc,
    fields: { agentRunId: run.id, agentId: a.id, toolId, action: desc + ". Proposed by " + a.name + " in " + run.ref + ".", effectKey: item.effectKey || run.id + ":" + item.id },
    evidenceFileIds: [], linkedRecordIds: rec ? [rec.id] : [], teamId, submit: true, createdBy: a.id
  });
  if (!res.ok) {
    return failItem(run, ctx, item, { business: "The approval request could not be raised: " + res.error, technical: "createRequest(" + AGENT_ACTION_FORM + ") failed", retryable: true }, agentActor(run));
  }
  mergeAdded(s, res.state);
  const req = s.data.requests.find((r) => r.id === res.id)!;
  const ap = s.data.approvals.find((x) => x.id === req.approvalId);
  const owner = ap?.stages.find((st) => st.status === "pending")?.assigneeId || undefined;
  item.requestId = req.id;
  item.created = { kind: "request", id: req.id };
  item.status = "waiting";
  run.approvalRequestId = req.id;
  run.waitingOwnerId = owner;
  addStep(run, ctx, "waiting_approval", { kind: "system", id: "system" }, "Waiting for " + personName(s, owner) + " to decide " + req.ref + " in Work. Nothing changes until it is approved and then run.",
    { status: "current", sourceRefs: [{ kind: "request", id: req.id }, ...(ap ? [{ kind: "approval" as const, id: ap.id }] : [])] });
  logRun(s, ctx, run, "agentRun.waiting_approval", "waiting for " + personName(s, owner) + " to approve " + req.ref, { refs });
}

export function actionText(s: CoreState, item: AgentPlanItem): string {
  const act = item.action;
  if (!act) return item.label;
  if (act.kind === "record-field") {
    const r = s.data.records.find((x) => x.id === act.recordId);
    const def = r && s.config.recordTypes.find((t) => t.id === r.typeId)?.fields.find((f) => f.key === act.field);
    return "Set " + (def?.label || act.field).toLowerCase() + " on " + (r?.ref || act.recordId) + " to " + act.value + ", from " + act.basis;
  }
  return "Email " + act.to + ": " + act.subject;
}

function applyChildResult(s: CoreState, ctx: Ctx, parent: AgentRun, item: AgentPlanItem, child: AgentRun) {
  const name = agentById(s, child.agentId)?.name || "The agent";
  if (child.state === "completed") {
    item.status = "done";
    item.output = mainOutput(child);
    addStep(parent, ctx, "output", { kind: "agent", id: child.agentId }, name + " returned (" + child.ref + "): " + item.output, { childRunId: child.id, sourceRefs: runRefs(child).slice(0, 6) });
  } else if (child.state === "failed") {
    const e = failureOf(child);
    item.status = "failed";
    item.error = { business: name + " could not finish: " + (e?.business || "a step failed") , technical: child.ref + ": " + (e?.technical || "failed"), retryable: e?.retryable ?? true };
    addStep(parent, ctx, "failed", { kind: "agent", id: child.agentId }, name + " could not finish (" + child.ref + "). " + (e?.business || ""), { childRunId: child.id, status: "failed", error: item.error });
  } else if (child.state === "cancelled") {
    item.status = "skipped";
    item.note = "Stopped";
    addStep(parent, ctx, "output", { kind: "agent", id: child.agentId }, name + " was stopped (" + child.ref + ") before it finished.", { childRunId: child.id, status: "skipped" });
  }
}

function childEnded(s: CoreState, ctx: Ctx, child: AgentRun) {
  const parent = runById(s, child.parentRunId);
  if (!parent) return;
  const item = parent.plan?.find((i) => i.childRunId === child.id);
  if (!item || item.status !== "waiting") return;
  applyChildResult(s, ctx, parent, item, child);
  advance(s, ctx, parent.id);
}

export function failureOf(run: AgentRun) {
  return (run.plan || []).find((i) => i.status === "failed")?.error || [...run.steps].reverse().find((st) => st.kind === "failed")?.error;
}

/** Drop texts that another text already contains (a draft update repeats what was read). */
export function dedupeTexts(texts: string[]): string[] {
  const t = texts.map((x) => x.trim()).filter(Boolean);
  return t.filter((x, i) => !t.some((y, j) => j !== i && y.length > x.length && y.includes(x.replace(/\.$/, ""))) && t.indexOf(x) === i);
}

function mainOutput(run: AgentRun): string {
  const combined = run.outputs.find((o) => o.label === "Combined outcome");
  if (combined?.text) return combined.text;
  const texts = dedupeTexts((run.plan || []).filter((i) => i.status === "done" && i.output).map((i) => i.output!));
  return texts.length ? texts.join(" ") : "Finished with nothing to report.";
}

export function runRefs(run: AgentRun): Ref[] {
  const seen = new Set<string>();
  const out: Ref[] = [];
  for (const st of run.steps) for (const r of st.sourceRefs) { const k = r.kind + ":" + r.id; if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

function finish(s: CoreState, ctx: Ctx, run: AgentRun) {
  const plan = run.plan || [];
  const outs: AgentRun["outputs"] = [];
  const notDone = plan.filter((i) => i.status === "skipped").map((i) => i.label + (i.note ? " (" + i.note.toLowerCase().replace(/\.$/, "") + ")" : ""));
  const delegated = plan.filter((i) => (i.kind === "delegate" || i.kind === "spawn") && i.status === "done");
  if (delegated.length && !run.test) {
    for (const i of delegated) {
      if (i.kind === "delegate") outs.push({ label: agentById(s, i.agentId)?.name || "Agent", kind: "agentRun", id: i.childRunId, text: i.output });
      else { const w = run.workers.find((x) => x.id === i.workerId); outs.push({ label: (w?.label || "Worker") + " (temporary)", text: i.output, ...(i.target ? { kind: i.target.kind, id: i.target.id } : {}) }); }
    }
    const names = delegated.map((i) => i.kind === "delegate" ? agentById(s, i.agentId)?.name || "an agent" : run.workers.find((x) => x.id === i.workerId)?.label || "a worker");
    const own = plan.filter((i) => i.kind === "tool" && i.status === "done" && i.output).map((i) => i.output!);
    outs.unshift({ label: "Combined outcome", text: "Combined from " + names.join(" and ") + ". " + dedupeTexts([...own, ...delegated.map((i) => i.output || "")]).join(" ")
      + (notDone.length ? " Not done: " + notDone.join("; ") + "." : "") });
  } else {
    for (const i of plan.filter((x) => x.status === "done")) {
      outs.push({ label: i.label, text: i.output, ...(i.created ? { kind: i.created.kind, id: i.created.id } : i.target ? { kind: i.target.kind, id: i.target.id } : {}) });
    }
    if (notDone.length) outs.push({ label: "Not done", text: notDone.join("; ") + "." });
  }
  run.outputs = outs;
  run.state = "completed";
  run.endedAt = ctx.now;
  run.waitingOwnerId = undefined;
  const doneCount = plan.filter((i) => i.status === "done").length;
  addStep(run, ctx, "completed", agentActor(run), (run.test ? "Test run finished: " : "Completed: ") + doneCount + " of " + plan.length + " planned step" + (plan.length === 1 ? "" : "s") + " done"
    + (notDone.length ? ", " + notDone.length + " not done" : "") + "." + (run.test ? " Nothing was changed." : run.appliedEffects.length ? " Applied once: " + run.appliedEffects.map((e) => e.description).join("; ") + "." : ""),
    { sourceRefs: runRefs(run).slice(0, 8) });
  if (!run.test) logRun(s, ctx, run, "agentRun.completed", "completed" + (delegated.length ? " with a combined outcome from " + delegated.length + " part" + (delegated.length === 1 ? "" : "s") : ""), { refs: runRefs(run) });
  childEnded(s, ctx, run);
}

/* ── Operations: runs ──────────────────────────────────────────────────── */

export interface StartRunInput {
  goal: string;
  inputs?: { kind: string; id: Id }[];
  /** Narrower scope than the agent's; defaults to the agent's scope within the selected scope. */
  scopeTeamIds?: Scope;
  /** Same key returns the existing run instead of starting another. */
  idempotencyKey?: string;
}

function personOnly(s: CoreState, ctx: Ctx): string | null {
  const p = s.data.people.find((x) => x.id === ctx.viewerId);
  if (!p || p.kind !== "staff" || p.status !== "active") return "Only an active member of staff can do this.";
  return null;
}

function runScopeFor(s: CoreState, ctx: Ctx, a: AgentDef, requested?: Scope): { scope: Scope } | { error: string } {
  const v = viewerOf(s, ctx.viewerId);
  const reach: Scope = v.isOrgWide ? "all" : [...new Set([...v.memberTeamIds, ...v.overseenTeamIds])];
  const sel = scopeTeams(s, ctx.scope);
  const wanted: Scope = requested || (sel ? sel : "all");
  const sc = intersectScope(intersectScope(a.scope.teamIds, reach), wanted);
  if (sc !== "all" && !sc.length) return { error: "Nothing in " + a.name + "'s scope (" + scopeText(s, a.scope.teamIds) + ") is within your reach and the selected scope." };
  return { scope: sc };
}

function inputsCheck(s: CoreState, ctx: Ctx, inputs: { kind: string; id: Id }[]): string | null {
  const q = query(s, { ...ctx, scope: { kind: "organisation" } });
  for (const i of inputs) {
    let ok = false;
    switch (i.kind) {
      case "record": ok = !!q.record(i.id); break;
      case "file": ok = !!q.file(i.id); break;
      case "task": ok = !!q.task(i.id); break;
      case "request": ok = !!q.request(i.id); break;
      case "project": { const p = s.data.projects.find((x) => x.id === i.id); ok = !!p && q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility }); break; }
      case "invoice": ok = !!s.data.invoices.find((x) => x.id === i.id) && can(q.viewer, "purchasing.manage"); break;
      case "obligation": ok = !!s.data.obligations.find((x) => x.id === i.id); break;
      default: ok = false;
    }
    if (!ok) return "You cannot give it " + i.kind + " " + i.id + ": it does not exist or is not visible to you.";
  }
  return null;
}

export function startRun(s0: CoreState, ctx: Ctx, agentId: Id, input: StartRunInput): Result {
  const who = personOnly(s0, ctx);
  if (who) return fail(who);
  if (!can(viewerOf(s0, ctx.viewerId), "agents.run")) return fail("Your role cannot start agent runs. It needs the Start agent runs permission.");
  if (s0.config.orchestration.adapter !== "sample") return fail(s0.config.orchestration.connectionRequirement + " Nothing was started.");
  const a = agentById(s0, agentId);
  if (!a) return fail("Agent not found.");
  if (a.archived) return fail(a.name + " is archived. It keeps its history but takes no new work.");
  const av = availabilityOf(a);
  if (av === "paused") return fail(a.name + " is paused, so it takes no new work. Resume it first.");
  if (av === "draft") return fail(a.name + " is a draft. Test it and activate it before it takes work.");
  if (av === "connection_required") {
    const r = agentReadiness(s0, a);
    return fail(a.name + " cannot take work yet. " + (r.items.find((i) => !i.ok)?.detail || "A connection is missing."));
  }
  const goal = input.goal.trim();
  if (!goal) return fail("Say what the run should achieve.");
  const inputs = input.inputs || [];
  const key = (input.idempotencyKey || "").trim() || agentId + "|" + goal.toLowerCase() + "|" + inputs.map((i) => i.kind + ":" + i.id).join(",") + "|" + localDay(ctx.now, s0.config.timezone);
  const existing = s0.data.agentRuns.find((r) => r.idempotencyKey === key && !r.parentRunId && !r.test);
  if (existing) return { ok: true, state: s0, message: "Already started as " + existing.ref + ". Nothing was repeated.", id: existing.id };
  const bad = inputsCheck(s0, ctx, inputs);
  if (bad) return fail(bad);
  const lim = agentLimits(s0, a);
  const active = activeRunsOf(s0, a.id).length;
  if (active >= lim.maxConcurrentRuns) return fail(a.name + " is already running " + active + " run" + (active === 1 ? "" : "s") + ", its limit. Wait for one to finish or change the limit in Settings, Agent controls.");
  const scr = runScopeFor(s0, ctx, a, input.scopeTeamIds);
  if ("error" in scr) return fail(scr.error);
  const sc = scr.scope;
  const s = ops.draft(s0);
  const run = newRun(s, ctx, { agent: agentById(s, agentId)!, goal, inputs, scope: sc, initiator: { kind: "person", id: ctx.viewerId }, key, tools: toolsOf(a) });
  logRun(s, ctx, run, "agentRun.started", "started " + a.name + ": " + goal, { actorId: ctx.viewerId, actorKind: "person" });
  advance(s, ctx, run.id);
  const r = runById(s, run.id)!;
  const msg: Record<AgentRunState, string> = {
    completed: run.ref + " completed. This is a simulated run; see its outcome in Runs.",
    waiting_approval: run.ref + " is waiting for " + personName(s, r.waitingOwnerId) + " to approve an action in Work.",
    waiting_input: run.ref + " is waiting for " + personName(s, r.waitingOwnerId) + ".",
    delegated: run.ref + " started. Delegated work is waiting: " + childWaitText(s, r) + ".",
    failed: run.ref + " started, but a step failed: " + (failureOf(r)?.business || "see the run") ,
    running: run.ref + " is running.", queued: run.ref + " is queued.", planning: run.ref + " is planning.",
    stop_requested: run.ref + ": stop requested.", cancelled: run.ref + " was cancelled."
  };
  return { ok: true, state: s, message: msg[r.state], id: run.id };
}

function childWaitText(s: CoreState, run: AgentRun): string {
  const kids = run.childRunIds.map((id) => runById(s, id)).filter((x): x is AgentRun => !!x && isRunActive(x));
  return kids.map((k) => (agentById(s, k.agentId)?.name || "agent") + " " + RUN_STATE_LABEL[k.state].toLowerCase()).join(", ") || "child runs";
}

/** An isolated test: reads real data in scope, but applies nothing, raises no request and starts no child run. Works on drafts. */
export function testRun(s0: CoreState, ctx: Ctx, agentId: Id, input: StartRunInput): Result {
  const who = personOnly(s0, ctx);
  if (who) return fail(who);
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "agents.manage") && !can(v, "agents.run")) return fail("Testing an agent needs the Manage agents or Start agent runs permission.");
  if (s0.config.orchestration.adapter !== "sample") return fail(s0.config.orchestration.connectionRequirement + " Nothing was tested.");
  const a = agentById(s0, agentId);
  if (!a) return fail("Agent not found.");
  if (a.archived) return fail(a.name + " is archived.");
  if (!toolsOf(a).length) return fail("Give " + a.name + " at least one tool before testing it.");
  const goal = input.goal.trim() || "Test: " + a.purpose;
  const inputs = input.inputs || [];
  const bad = inputsCheck(s0, ctx, inputs);
  if (bad) return fail(bad);
  const scr = runScopeFor(s0, ctx, a, input.scopeTeamIds);
  if ("error" in scr) return fail(scr.error);
  const sc = scr.scope;
  const s = ops.draft(s0);
  const n = s.data.agentRuns.filter((r) => r.agentId === agentId && r.test).length + 1;
  const run = newRun(s, ctx, { agent: agentById(s, agentId)!, goal, inputs, scope: sc, initiator: { kind: "person", id: ctx.viewerId }, key: "test:" + agentId + ":" + n + ":" + ctx.now, tools: toolsOf(a), test: true });
  advance(s, ctx, run.id);
  logAgent(s, ctx, a, "agent.tested", "Test run " + run.ref + " for " + a.name + " (version " + versionOf(a) + "): " + RUN_STATE_LABEL[runById(s, run.id)!.state].toLowerCase());
  const r = runById(s, run.id)!;
  return { ok: true, state: s, id: run.id,
    message: r.state === "completed" ? "Test passed (" + run.ref + "). Nothing was changed." : "The test found a problem: " + (failureOf(r)?.business || RUN_STATE_LABEL[r.state]) };
}

function canOperate(s: CoreState, ctx: Ctx, run: AgentRun): string | null {
  const who = personOnly(s, ctx);
  if (who) return who;
  const v = viewerOf(s, ctx.viewerId);
  const owner = agentById(s, run.agentId)?.responsibleId;
  if (can(v, "agents.manage") || (can(v, "agents.run") && (runPerson(s, run) === ctx.viewerId || owner === ctx.viewerId || v.isOrgWide))) return null;
  if (can(v, "agents.run") && run.scopeTeamIds !== "all" && run.scopeTeamIds.some((t) => v.overseenTeamIds.includes(t))) return null;
  return "Only the person who started this run, the agent's owner or someone who manages agents can do that.";
}

/** Ask a run to stop. It shows Stop requested until the engine acknowledges at a safe checkpoint. */
export function requestStop(s0: CoreState, ctx: Ctx, runId: Id): Result {
  const r0 = runById(s0, runId);
  if (!r0) return fail("Run not found.");
  const no = canOperate(s0, ctx, r0);
  if (no) return fail(no);
  if (r0.state === "completed" || r0.state === "cancelled") return fail(r0.ref + " has already finished.");
  if (r0.stop && !r0.stop.acknowledgedAt) return fail("A stop is already requested for " + r0.ref + ".");
  const s = ops.draft(s0);
  stopIn(s, ctx, runById(s, runId)!);
  const r = runById(s, runId)!;
  const waitReq = (r.plan || []).find((i) => i.kind === "action" && i.status === "waiting");
  const req = s.data.requests.find((x) => x.id === waitReq?.requestId);
  return { ok: true, state: s, message: r.state === "cancelled" ? r.ref + " stopped. Nothing further will run."
    : "Stop requested. " + r.ref + " stops at its next safe checkpoint" + (req ? ", once " + req.ref + " is decided or withdrawn" : ", once its delegated work reaches one") + ". Nothing new starts meanwhile." };
}

function stopIn(s: CoreState, ctx: Ctx, run: AgentRun) {
  run.stop = { requestedAt: ctx.now, by: ctx.viewerId };
  addStep(run, ctx, "stop_requested", { kind: "person", id: ctx.viewerId }, "Stop requested by " + personName(s, ctx.viewerId) + ". Nothing new starts; it stops at the next safe checkpoint.", { status: "current" });
  logRun(s, ctx, run, "agentRun.stop_requested", "stop requested", { actorId: ctx.viewerId, actorKind: "person" });
  for (const id of run.childRunIds) { const c = runById(s, id); if (c && isRunActive(c) && !c.stop) stopIn(s, ctx, c); }
  if (run.state === "failed") { acknowledgeStop(s, ctx, run); return; }
  advance(s, ctx, run.id);
}

/** Retry only the failed portion. Steps already done and effects already applied are never repeated. */
export function retryRun(s0: CoreState, ctx: Ctx, runId: Id): Result {
  const r0 = runById(s0, runId);
  if (!r0) return fail("Run not found.");
  const no = canOperate(s0, ctx, r0);
  if (no) return fail(no);
  if (r0.state !== "failed") return fail("Only a failed run can be retried.");
  if (s0.config.orchestration.adapter !== "sample") return fail(s0.config.orchestration.connectionRequirement);
  const item0 = (r0.plan || []).find((i) => i.status === "failed");
  if (!item0) return fail("Nothing failed in this run.");
  if (item0.error && !item0.error.retryable) return fail("This step cannot be retried: " + item0.error.business);
  const a = agentById(s0, r0.agentId);
  if (!a || a.archived) return fail("The agent is archived, so the run cannot continue.");
  let s = ops.draft(s0);
  const run = runById(s, runId)!;
  const item = run.plan!.find((i) => i.id === item0.id)!;
  const done = run.plan!.filter((i) => i.status === "done").length;
  addStep(run, ctx, "retried", { kind: "person", id: ctx.viewerId }, "Retry of " + item.label.charAt(0).toLowerCase() + item.label.slice(1) + " (attempt " + (item.attempts + 1) + ") by " + personName(s, ctx.viewerId)
    + ". " + done + " step" + (done === 1 ? "" : "s") + " already done " + (done === 1 ? "is" : "are") + " not repeated.");
  logRun(s, ctx, run, "agentRun.retried", "retried " + item.label.toLowerCase(), { actorId: ctx.viewerId, actorKind: "person" });
  if (item.kind === "delegate" && item.childRunId) {
    const child = runById(s, item.childRunId);
    if (child?.state === "failed") {
      item.status = "waiting";
      item.error = undefined;
      run.state = "delegated";
      const res = retryRun(s, ctx, child.id);
      if (!res.ok) return res;
      s = res.state;
      const after = runById(s, runId)!;
      advance(s, ctx, after.id);
      return { ok: true, state: s, message: "Retried. " + after.ref + " is now " + RUN_STATE_LABEL[runById(s, runId)!.state].toLowerCase() + "." };
    }
  }
  if (item.kind === "action" && item.requestId) {
    const req = s.data.requests.find((x) => x.id === item.requestId);
    if (req?.status === "approved") {
      item.status = "approved";
      run.state = "waiting_input";
      const res = ops.executeRequest(s, ctx, req.id);
      if (!res.ok) return res;
      s = res.state;
      const after = runById(s, runId)!;
      return { ok: true, state: s, message: after.state === "failed" ? "Retried, but it failed again: " + (failureOf(after)?.business || "") : "Retried. " + after.ref + " is now " + RUN_STATE_LABEL[after.state].toLowerCase() + "." };
    }
  }
  item.status = "pending";
  item.error = undefined;
  run.state = "running";
  run.endedAt = undefined;
  advance(s, ctx, runId);
  const after = runById(s, runId)!;
  return { ok: true, state: s, message: after.state === "failed" ? "Retried, but it failed again: " + (failureOf(after)?.business || "") : "Retried. " + after.ref + " is now " + RUN_STATE_LABEL[after.state].toLowerCase() + "." };
}

/** Let the engine look again: picks up a withdrawn request or finished child and moves to the next wait point. */
export function resumeRun(s0: CoreState, ctx: Ctx, runId: Id): Result {
  const r0 = runById(s0, runId);
  if (!r0) return fail("Run not found.");
  const no = canOperate(s0, ctx, r0);
  if (no) return fail(no);
  if (!isRunActive(r0)) return fail(r0.ref + " has finished.");
  const s = ops.draft(s0);
  advance(s, ctx, runId);
  const r = runById(s, runId)!;
  return { ok: true, state: s, message: r.ref + " is " + RUN_STATE_LABEL[r.state].toLowerCase() + "." };
}

/** Hand a subtask to one of the agents this run's agent coordinates. */
export function delegateTask(s0: CoreState, ctx: Ctx, runId: Id, toAgentId: Id): Result {
  const r0 = runById(s0, runId);
  if (!r0) return fail("Run not found.");
  const no = canOperate(s0, ctx, r0);
  if (no) return fail(no);
  if (!isRunActive(r0) || r0.stop) return fail(r0.ref + " is not taking new work.");
  const to = agentById(s0, toAgentId);
  if (!to || to.coordinatorId !== r0.agentId) return fail("A run can only delegate to an agent its own agent coordinates.");
  const s = ops.draft(s0);
  const run = runById(s, runId)!;
  run.plan = run.plan || [];
  run.plan.push({ id: "p" + (run.plan.length + 1), kind: "delegate", agentId: to.id, label: "Delegate to " + to.name, status: "pending", attempts: 0 });
  advance(s, ctx, runId);
  return { ok: true, state: s, message: "Delegated to " + to.name + "." };
}

/** Ask for a temporary worker inside a run, under the agent's spawn policy. */
export function spawnWorker(s0: CoreState, ctx: Ctx, runId: Id, templateId: string, target?: Ref): Result {
  const r0 = runById(s0, runId);
  if (!r0) return fail("Run not found.");
  const no = canOperate(s0, ctx, r0);
  if (no) return fail(no);
  if (!isRunActive(r0) || r0.stop) return fail(r0.ref + " is not taking new work.");
  const s = ops.draft(s0);
  const run = runById(s, runId)!;
  run.plan = run.plan || [];
  const tpl = s.config.agentTemplates.find((t) => t.id === templateId);
  run.plan.push({ id: "p" + (run.plan.length + 1), kind: "spawn", templateId, target, label: "Temporary worker: " + (tpl?.label || templateId), status: "pending", attempts: 0 });
  advance(s, ctx, runId);
  const it = run.plan[run.plan.length - 1];
  const after = runById(s, runId)!.plan!.find((i) => i.id === it.id)!;
  return after.status === "skipped" ? fail("No worker created: " + (after.note || "the spawn policy does not allow it.")) : { ok: true, state: s, message: "Temporary worker created and finished its task." };
}

/** Raise (again) the approval for a proposed action whose request could not be raised. */
export function requestApproval(s0: CoreState, ctx: Ctx, runId: Id, itemId: Id): Result {
  const r0 = runById(s0, runId);
  if (!r0) return fail("Run not found.");
  const no = canOperate(s0, ctx, r0);
  if (no) return fail(no);
  const it0 = r0.plan?.find((i) => i.id === itemId);
  if (!it0 || it0.kind !== "action") return fail("That step is not a proposed action.");
  if (it0.status !== "failed" || it0.requestId) return fail("This action already has its approval request.");
  return retryRun(s0, ctx, runId);
}

/* ── Decision and execution hooks (shared Work approval model) ─────────── */

/** Other runs that proposed the same action and are waiting on this one request (no second request was raised). */
function followersOf(s: CoreState, r: RequestItem, primaryId: Id): { run: AgentRun; item: AgentPlanItem }[] {
  const out: { run: AgentRun; item: AgentPlanItem }[] = [];
  for (const run of s.data.agentRuns) {
    if (run.id === primaryId) continue;
    const item = run.plan?.find((i) => i.requestId === r.id && i.status !== "done" && i.status !== "skipped");
    if (item) out.push({ run, item });
  }
  return out;
}

function onDecision(s: CoreState, ctx: Ctx, r: RequestItem, a: Approval, kind: "approve" | "decline" | "return", final: boolean) {
  if (r.formId !== AGENT_ACTION_FORM) return;
  const primaryId = String(r.fields.agentRunId || "");
  for (const f of followersOf(s, r, primaryId)) {
    if (kind === "approve" && final && a.status === "approved") {
      f.item.status = "approved";
      addStep(f.run, ctx, "approved", { kind: "person", id: ctx.viewerId }, r.ref + " was approved. It is carried out once, through the run that raised it.", { sourceRefs: [{ kind: "request", id: r.id }] });
    } else if (kind === "decline") {
      f.item.status = "skipped";
      f.item.note = "Declined";
      addStep(f.run, ctx, "cancelled", { kind: "person", id: ctx.viewerId }, r.ref + " was declined, so this action was not carried out.", { sourceRefs: [{ kind: "request", id: r.id }], status: "skipped" });
      advance(s, ctx, f.run.id);
    }
  }
  const run = runById(s, primaryId);
  const item = run?.plan?.find((i) => i.requestId === r.id);
  if (!run || !item || item.status !== "waiting") return;
  const who = { kind: "person" as const, id: ctx.viewerId };
  const comment = a.decisions[a.decisions.length - 1]?.comment || "";
  const refs: Ref[] = [{ kind: "request", id: r.id }, { kind: "approval", id: a.id }];
  if (kind === "approve" && final && a.status === "approved") {
    item.status = "approved";
    addStep(run, ctx, "approved", who, "Approved by " + personName(s, ctx.viewerId) + " (" + r.ref + "). The decision is recorded; the action has not run yet.", { sourceRefs: refs });
    logRun(s, ctx, run, "agentRun.approved", r.ref + " approved by " + personName(s, ctx.viewerId), { actorId: ctx.viewerId, actorKind: "person" });
  } else if (kind === "approve") {
    addStep(run, ctx, "waiting_approval", who, personName(s, ctx.viewerId) + " approved one stage of " + r.ref + "; the next stage decides.", { sourceRefs: refs, status: "current" });
  } else if (kind === "decline") {
    item.status = "skipped";
    item.note = "Declined";
    addStep(run, ctx, "cancelled", who, "Declined by " + personName(s, ctx.viewerId) + (comment ? ": " + comment : "") + ". The proposed action was not carried out.", { sourceRefs: refs, status: "skipped" });
    logRun(s, ctx, run, "agentRun.declined", r.ref + " declined; the action was not carried out", { actorId: ctx.viewerId, actorKind: "person" });
  } else {
    addStep(run, ctx, "waiting_input", who, "Returned to " + personName(s, r.requesterId) + " for changes" + (comment ? ": " + comment : "") + ". The run keeps waiting.", { sourceRefs: refs, status: "current" });
  }
  advance(s, ctx, run.id);
}

/** Execution of an approved agent action. Runs inside executeRequest; keyed so it applies at most once. */
function agentActionEffect(s: CoreState, ctx: Ctx, r: RequestItem): EffectOutcome {
  const run = runById(s, String(r.fields.agentRunId || ""));
  if (!run) return { ok: false, error: "The agent run behind this request no longer exists. Nothing was changed." };
  const item = run.plan?.find((i) => i.requestId === r.id);
  if (!item) return { ok: false, error: "The run has no step for this request. Nothing was changed." };
  if (item.status === "done") return { ok: true, effect: "Already carried out in " + run.ref + "; nothing was repeated" };
  if (run.state === "cancelled" || item.status === "skipped") return { ok: false, error: run.ref + " was stopped before this action ran, so nothing was changed." };
  if (item.status !== "approved" && item.status !== "failed") return { ok: false, error: "The action is not approved yet." };
  const a = agentById(s, run.agentId);
  const fail2 = (business: string, technical: string, retryable: boolean): EffectOutcome => {
    item.status = "failed";
    item.error = { business, technical, retryable };
    addStep(run, ctx, "failed", agentActor(run), "The approved action did not run. " + business, { status: "failed", error: item.error, toolId: item.toolId, sourceRefs: [{ kind: "request", id: r.id }] });
    markFailed(s, ctx, run, item);
    return { ok: false, error: business };
  };
  if (!a || a.archived) return fail2((a?.name || "The agent") + " was archived, so the action did not run.", "agent_archived", false);
  if (!runTools(s, run).includes(item.toolId || "")) return fail2(a.name + " no longer has the " + toolLabel(s, item.toolId || "") + " tool, so the action did not run.", "tool_revoked: " + item.toolId, true);
  const key = item.effectKey || run.id + ":" + item.id;
  if (run.appliedEffects.some((e) => e.key === key)) { item.status = "done"; advance(s, ctx, run.id); return { ok: true, effect: "Already applied; nothing was repeated" }; }
  item.attempts += 1;
  const act = item.action;
  let effect = "";
  if (act?.kind === "record-field") {
    const rec = s.data.records.find((x) => x.id === act.recordId);
    const def = rec && s.config.recordTypes.find((t) => t.id === rec.typeId)?.fields.find((f) => f.key === act.field);
    if (!rec || !def) return fail2("The record or field no longer exists.", "record " + act.recordId + " field " + act.field + " missing", false);
    const err = ops.validateField(def, act.value);
    if (err) return fail2(err, "validateField: " + err, false);
    const before = rec.fields[act.field] ?? null;
    const auth = ops.authorityOf(s, rec, act.field);
    rec.fields[act.field] = act.value;
    rec.fieldMeta[act.field] = { origin: "manual", pendingSourceReview: auth.kind === "pending" };
    rec.updatedAt = ctx.now;
    ops.logEvent(s, ctx, { actorId: a.id, actorKind: "agent", action: "record.updated", objectType: "record", objectId: rec.id, recordIds: [rec.id], teamId: rec.teamId, unitId: rec.unitId,
      summary: "Changed " + act.field + " on " + rec.ref + " (approved agent action " + r.ref + ")", before: { [act.field]: before }, after: { [act.field]: act.value },
      storyKey: "agentRun:" + rootRun(s, run).id, simulated: true });
    effect = def.label + " set to " + act.value + " on " + rec.ref + ". " + auth.label;
  } else if (act?.kind === "email") {
    return fail2("Email delivery is not connected. Nothing was sent.", "notify.email: source s-email not connected; the sample engine never sends", true);
  } else {
    return fail2("This action has no local effect defined, so nothing was changed.", "no action payload", false);
  }
  item.status = "done";
  item.output = effect;
  item.error = undefined;
  run.appliedEffects.push({ key, description: effect, at: ctx.now });
  addStep(run, ctx, "executed", agentActor(run), "Carried out the approved action: " + effect, { effectKey: key, toolId: item.toolId, attempt: item.attempts,
    sourceRefs: [{ kind: "request", id: r.id }, ...(item.target ? [item.target] : [])] });
  logRun(s, ctx, run, "agentRun.executed", "carried out the approved action from " + r.ref, { refs: item.target ? [item.target] : [] });
  if (run.state === "failed") run.state = "running";
  advance(s, ctx, run.id);
  // Runs that were waiting on the same request: done, without applying the effect a second time.
  for (const f of followersOf(s, r, run.id)) {
    f.item.status = "done";
    f.item.output = "Carried out once in " + run.ref + ": " + effect;
    addStep(f.run, ctx, "output", { kind: "system", id: "system" }, "The approved action was carried out once, in " + run.ref + ". Nothing was repeated here.", { sourceRefs: [{ kind: "request", id: r.id }] });
    advance(s, ctx, f.run.id);
  }
  return { ok: true, effect };
}

ops.registerEffect("agent-action", agentActionEffect);
ops.registerDecisionHook(onDecision);

/* ── Operations: definitions ───────────────────────────────────────────── */

export interface NewAgent {
  name: string;
  purpose: string;
  outputs?: string[];
  responsibleId: Id;
  coordinatorId?: Id | null;
  scope: { teamIds: Scope };
  tools: string[];
  knowledge?: string[];
  trigger?: AgentDef["trigger"];
  limits?: AgentLimits;
  spawn?: SpawnPolicy;
  templateId?: string;
  instructions?: string;
}

const SECRET = /(api[_ -]?key|secret|password|passwd|bearer|token)\s*[:=]|sk-[a-z0-9]{12,}|-----BEGIN/i;
const SHAPES = ["crown-pebble", "executive-capsule", "rim-capsule", "glass-visor", "shield", "control-cube", "low-dome", "offset-pebble", "wide-eyed", "precision-brow", "tall-unit", "soft-asymmetric"];
const TINTS = ["#191c1f", "#2a2118", "#1b2430"];

function needManage(s: CoreState, ctx: Ctx): string | null {
  const who = personOnly(s, ctx);
  if (who) return who;
  return can(viewerOf(s, ctx.viewerId), "agents.manage") ? null : "Only people who manage agents can change agent definitions. It needs the Manage agents permission.";
}

function checkDef(s: CoreState, d: NewAgent, selfId?: Id): string | null {
  const name = d.name.trim();
  if (name.length < 2) return "Give the agent a name.";
  if (name.length > 60) return "Keep the name under 60 characters.";
  if (s.config.agents.some((a) => a.id !== selfId && !a.archived && a.name.trim().toLowerCase() === name.toLowerCase())) return "Another agent is already called " + name + ".";
  if (!d.purpose.trim()) return "Say what the agent is responsible for.";
  const owner = s.data.people.find((p) => p.id === d.responsibleId);
  if (!owner || owner.kind !== "staff" || owner.status !== "active") return "Choose an active member of staff as the accountable owner.";
  if (d.coordinatorId) {
    const c = agentById(s, d.coordinatorId);
    if (!c || c.archived) return "The chosen coordinator is not available.";
    if (selfId && wouldCreateCycle(s, selfId, d.coordinatorId)) return "That coordinator sits below this agent, which would make a loop.";
  }
  if (d.scope.teamIds !== "all") {
    if (!d.scope.teamIds.length) return "Choose at least one " + s.config.terminology.team.toLowerCase() + " for its scope.";
    if (d.scope.teamIds.some((t) => !s.config.teams.some((x) => x.id === t))) return "The scope includes a " + s.config.terminology.team.toLowerCase() + " that no longer exists.";
  }
  for (const t of d.tools) {
    const def = s.config.agentTools.find((x) => x.id === t);
    if (!def) return "Unknown tool: " + t + ".";
    if (def.module && !moduleEnabled(s.config, def.module)) return def.label + " needs the " + MODULE_NAME[def.module] + " module, which is switched off.";
  }
  if (d.trigger) {
    if (d.trigger.kind === "delegated" && !d.coordinatorId) return "Work that starts by delegation needs a coordinator.";
    if ((d.trigger.kind === "schedule" || d.trigger.kind === "event") && !d.trigger.detail.trim()) return "Say when it should start.";
  }
  if (d.limits) {
    const c = s.config.orchestration.ceiling;
    const names = { maxDepth: "Delegation depth", maxChildren: "Child runs per run", maxConcurrentRuns: "Runs at once", maxMinutes: "Minutes per run" } as const;
    for (const k of Object.keys(names) as (keyof typeof names)[]) {
      const v = d.limits[k];
      if (!Number.isInteger(v) || v < (k === "maxDepth" ? 0 : 1)) return names[k] + " must be a whole number" + (k === "maxDepth" ? " of 0 or more." : " of 1 or more.");
      if (v > c[k]) return names[k] + " can be at most " + c[k] + ", the organisation ceiling.";
    }
  }
  if (d.spawn?.enabled) {
    if (!d.spawn.templateIds.length) return "Choose which templates temporary workers may use, or turn spawning off.";
    const bad = d.spawn.templateIds.find((id) => !s.config.agentTemplates.some((t) => t.id === id && t.workerOk));
    if (bad) return "Template " + bad + " cannot be used for temporary workers.";
    if (!Number.isInteger(d.spawn.maxWorkers) || d.spawn.maxWorkers < 1) return "Allow at least one worker, or turn spawning off.";
    if (d.spawn.maxWorkers > s.config.orchestration.ceiling.maxChildren) return "Workers per run can be at most " + s.config.orchestration.ceiling.maxChildren + ", the organisation ceiling.";
  }
  if (d.instructions && SECRET.test(d.instructions)) return "Instructions must not contain keys, passwords or tokens. Provider keys are held server-side, never in Pulse.";
  return null;
}

/** Legacy fields Settings and older readers still show, kept in step with the tools. */
function syncLegacy(s: CoreState, a: AgentDef) {
  const tools = toolsOf(a);
  a.permittedActions = tools.filter((t) => !isRestricted(s, t)).map((t) => toolLabel(s, t));
  a.approvalRequired = tools.filter((t) => isRestricted(s, t)).map((t) => toolLabel(s, t));
  a.enabled = availabilityOf(a) === "ready" && !a.archived;
}

/** Create a definition. It is saved immediately as a Draft and placed in the chart. It does nothing until tested and activated. */
export function createAgent(s0: CoreState, ctx: Ctx, d: NewAgent): Result {
  const no = needManage(s0, ctx);
  if (no) return fail(no);
  const err = checkDef(s0, d);
  if (err) return fail(err);
  const s = ops.draft(s0);
  const base = "ag-" + (d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "agent");
  let id = base, n = 2;
  while (s.config.agents.some((a) => a.id === id)) id = base + "-" + n++;
  const used = new Set(s.config.agents.map((a) => a.shape));
  const shape = SHAPES.find((x) => !used.has(x)) || SHAPES[s.config.agents.length % SHAPES.length];
  const a: AgentDef = {
    id, name: d.name.trim(), purpose: d.purpose.trim(), instructions: d.instructions?.trim() || undefined, outputs: (d.outputs || []).map((x) => x.trim()).filter(Boolean),
    responsibleId: d.responsibleId, coordinatorId: d.coordinatorId || null, availability: "draft", scope: { teamIds: d.scope.teamIds === "all" ? "all" : [...d.scope.teamIds] },
    permittedActions: [], approvalRequired: [], tools: [...new Set(d.tools)], knowledge: d.knowledge || [], trigger: d.trigger || { kind: "manual", detail: "Started by a person" },
    limits: d.limits ? { ...d.limits } : { ...s.config.orchestration.defaultLimits }, spawn: d.spawn ? { ...d.spawn, templateIds: [...d.spawn.templateIds] } : { enabled: false, templateIds: [], maxWorkers: 1 },
    templateId: d.templateId, version: 1, createdAt: ctx.now, shape, tint: TINTS[s.config.agents.length % TINTS.length], enabled: false
  };
  syncLegacy(s, a);
  s.config.agents.push(a);
  if (a.tools!.some((t) => isRestricted(s, t))) ensureActionRoute(s, ctx);
  logAgent(s, ctx, a, "agent.created", "Created " + a.name + " as a draft" + (a.coordinatorId ? " under " + agentById(s, a.coordinatorId)?.name : " at the top level") + " (version 1)");
  return { ok: true, state: s, id, message: a.name + " saved as a draft and placed in the chart. Test it, then activate it." };
}

export type AgentPatch = Partial<Pick<AgentDef, "name" | "purpose" | "instructions" | "outputs" | "responsibleId" | "scope" | "tools" | "knowledge" | "trigger" | "limits" | "spawn">>;

/** Change a definition. The version goes up; runs already started keep the version they started with. */
export function updateAgent(s0: CoreState, ctx: Ctx, agentId: Id, patch: AgentPatch): Result {
  const no = needManage(s0, ctx);
  if (no) return fail(no);
  const a0 = agentById(s0, agentId);
  if (!a0) return fail("Agent not found.");
  if (a0.archived) return fail(a0.name + " is archived. Archived definitions are kept as they were.");
  const merged: AgentDef = { ...structuredClone(a0), ...structuredClone(patch) };
  const err = checkDef(s0, { ...merged, tools: toolsOf(merged), scope: merged.scope }, agentId);
  if (err) return fail(err);
  const keys = (Object.keys(patch) as (keyof AgentPatch)[]).filter((k) => JSON.stringify(a0[k]) !== JSON.stringify(merged[k]));
  if (!keys.length) return fail("Nothing changed.");
  const s = ops.draft(s0);
  const a = agentById(s, agentId)!;
  Object.assign(a, structuredClone(patch));
  a.version = versionOf(a0) + 1;
  if (patch.tools) a.tools = [...new Set(patch.tools)];
  if (availabilityOf(a) === "ready" && !agentReadiness(s, a).ok) {
    const r = agentReadiness(s, a);
    if (r.onlyConnectionsMissing) a.availability = "connection_required";
  }
  if (availabilityOf(a) === "connection_required" && agentReadiness(s, a).ok) a.availability = "ready";
  syncLegacy(s, a);
  if (toolsOf(a).some((t) => isRestricted(s, t))) ensureActionRoute(s, ctx);
  const active = activeRunsOf(s, a.id).length;
  const show = (v: unknown) => (v === undefined ? null : typeof v === "string" || typeof v === "number" ? v : JSON.stringify(v));
  logAgent(s, ctx, a, "agent.updated", "Changed " + keys.join(", ") + " on " + a.name + " (version " + a.version + ")" + (active ? "; " + active + " run" + (active === 1 ? "" : "s") + " in progress keep version " + versionOf(a0) : ""),
    Object.fromEntries(keys.map((k) => [k, show(a0[k])])), Object.fromEntries(keys.map((k) => [k, show(a[k])])));
  return { ok: true, state: s, message: "Saved as version " + a.version + "." + (active ? " Runs already in progress keep the version they started with." : "") + (a.availability === "connection_required" ? " It now needs a connection before it takes work." : "") };
}

export interface MoveImpact {
  ok: boolean;
  reason?: string;
  from: string;
  to: string;
  carried: string[];
  unchanged: string[];
  narrowedTools: string[];
  inFlight: { id: Id; ref: string }[];
  notes: string[];
}

/** What a move would change. Coordination grants nothing, so scope, tools and approvals never change; only delegation through the new coordinator can be narrower. */
export function moveImpact(s: CoreState, agentId: Id, to: Id | null): MoveImpact {
  const a = agentById(s, agentId);
  const empty: MoveImpact = { ok: false, from: "", to: "", carried: [], unchanged: [], narrowedTools: [], inFlight: [], notes: [] };
  if (!a) return { ...empty, reason: "Agent not found." };
  const from = a.coordinatorId ? agentById(s, a.coordinatorId)?.name || "Unknown" : "Top level";
  const target = to ? agentById(s, to) : undefined;
  const toName = to ? target?.name || "Unknown" : "Top level";
  if (a.archived) return { ...empty, from, to: toName, reason: a.name + " is archived." };
  if (to === agentId) return { ...empty, from, to: toName, reason: "An agent cannot coordinate itself." };
  if (to && (!target || target.archived)) return { ...empty, from, to: toName, reason: "That coordinator is not available." };
  if (to && wouldCreateCycle(s, agentId, to)) return { ...empty, from, to: toName, reason: toName + " sits below " + a.name + ", so this move would make a loop." };
  if ((a.coordinatorId || null) === to) return { ...empty, from, to: toName, reason: a.name + " is already there." };
  const carried = descendantsOf(s, agentId).filter((x) => !x.archived).map((x) => x.name);
  const narrowed = target ? toolsOf(a).filter((t) => !toolsOf(target).includes(t)).map((t) => toolLabel(s, t)) : [];
  const inFlight = s.data.agentRuns.filter((r) => isRunActive(r) && !r.test && (r.agentId === agentId || (a.coordinatorId && r.agentId === a.coordinatorId))).map((r) => ({ id: r.id, ref: r.ref }));
  const notes: string[] = [];
  if (a.trigger?.kind === "delegated" && !to) notes.push(a.name + " starts work by delegation; at the top level nothing will delegate to it until it gets a coordinator or another trigger.");
  if (target && !scopesOverlap(target.scope.teamIds, a.scope.teamIds)) notes.push(toName + " has no scope in common with " + a.name + ", so it cannot delegate any work to it.");
  return {
    ok: true, from, to: toName, carried,
    unchanged: ["Scope: " + scopeText(s, a.scope.teamIds), "Tools: " + (toolsOf(a).map((t) => toolLabel(s, t)).join(", ") || "none"), "Approvals: restricted actions still go to a person", "Accountable owner: " + personName(s, a.responsibleId)],
    narrowedTools: narrowed, inFlight, notes
  };
}

export function moveAgent(s0: CoreState, ctx: Ctx, agentId: Id, to: Id | null): Result {
  const no = needManage(s0, ctx);
  if (no) return fail(no);
  const imp = moveImpact(s0, agentId, to);
  if (!imp.ok) return fail(imp.reason || "That move is not possible.");
  const s = ops.draft(s0);
  const a = agentById(s, agentId)!;
  const before = a.coordinatorId || null;
  a.coordinatorId = to;
  a.version = versionOf(a) + 1;
  logAgent(s, ctx, a, "agent.moved", "Moved " + a.name + " from " + imp.from + " to " + imp.to + (imp.carried.length ? " with " + imp.carried.length + " agent" + (imp.carried.length === 1 ? "" : "s") + " below it" : "")
    + ". Scope, tools and approvals unchanged; runs in progress unchanged.", { coordinatorId: before }, { coordinatorId: to });
  return { ok: true, state: s, message: "Moved under " + imp.to + ". Scope, tools and approvals did not change, and runs in progress carry on as they started." };
}

export interface ArchiveImpact { ok: boolean; reason?: string; inFlight: { id: Id; ref: string }[]; childrenMoveTo: string; children: string[]; runs: number }

export function archiveImpact(s: CoreState, agentId: Id): ArchiveImpact {
  const a = agentById(s, agentId);
  if (!a) return { ok: false, reason: "Agent not found.", inFlight: [], childrenMoveTo: "", children: [], runs: 0 };
  const inFlight = activeRunsOf(s, agentId).map((r) => ({ id: r.id, ref: r.ref }));
  const children = childrenOf(s, agentId).map((c) => c.name);
  const childrenMoveTo = a.coordinatorId ? agentById(s, a.coordinatorId)?.name || "Top level" : "Top level";
  const runs = s.data.agentRuns.filter((r) => r.agentId === agentId).length;
  if (a.archived) return { ok: false, reason: a.name + " is already archived.", inFlight, childrenMoveTo, children, runs };
  if (inFlight.length) return { ok: false, reason: a.name + " has " + inFlight.length + " run" + (inFlight.length === 1 ? "" : "s") + " in progress (" + inFlight.map((r) => r.ref).join(", ") + "). Stop or finish them first.", inFlight, childrenMoveTo, children, runs };
  return { ok: true, inFlight, childrenMoveTo, children, runs };
}

/** Archive keeps the definition, its versions and every run for history; it takes no new work. */
export function archiveAgent(s0: CoreState, ctx: Ctx, agentId: Id): Result {
  const no = needManage(s0, ctx);
  if (no) return fail(no);
  const imp = archiveImpact(s0, agentId);
  if (!imp.ok) return fail(imp.reason || "It cannot be archived.");
  const s = ops.draft(s0);
  const a = agentById(s, agentId)!;
  for (const c of childrenOf(s, agentId)) {
    const before = c.coordinatorId || null;
    c.coordinatorId = a.coordinatorId || null;
    c.version = versionOf(c) + 1;
    logAgent(s, ctx, c, "agent.moved", "Moved " + c.name + " to " + imp.childrenMoveTo + " because " + a.name + " was archived", { coordinatorId: before }, { coordinatorId: c.coordinatorId });
  }
  a.archived = true;
  a.availability = "paused";
  a.version = versionOf(a) + 1;
  syncLegacy(s, a);
  logAgent(s, ctx, a, "agent.archived", "Archived " + a.name + ". Its " + imp.runs + " run" + (imp.runs === 1 ? "" : "s") + " stay in history.");
  return { ok: true, state: s, message: a.name + " archived. Its history is kept" + (imp.children.length ? "; " + imp.children.join(", ") + " now sit under " + imp.childrenMoveTo : "") + "." };
}

/** Activate (only when prerequisites pass) or pause. Pausing never interrupts silently: the caller chooses what happens to runs in progress. */
export function setAvailability(s0: CoreState, ctx: Ctx, agentId: Id, to: "ready" | "paused", inFlight: "allow" | "stop" = "allow"): Result {
  const no = needManage(s0, ctx);
  if (no) return fail(no);
  const a0 = agentById(s0, agentId);
  if (!a0) return fail("Agent not found.");
  if (a0.archived) return fail(a0.name + " is archived.");
  if (to === "ready") {
    if (availabilityOf(a0) === "ready") return fail(a0.name + " is already ready.");
    const r = agentReadiness(s0, a0);
    if (!r.ok && !r.onlyConnectionsMissing) return fail("Not activated. Still needed: " + r.items.filter((i) => !i.ok).map((i) => i.label.toLowerCase() + (i.detail ? " (" + i.detail + ")" : "")).join("; ") + ".");
    const s = ops.draft(s0);
    const a = agentById(s, agentId)!;
    if (!r.ok) {
      a.availability = "connection_required";
      syncLegacy(s, a);
      const c = r.connections[0];
      logAgent(s, ctx, a, "agent.connection_required", a.name + " needs " + (c?.label || "a connection") + " before it can be activated");
      return { ok: true, state: s, message: "Not activated: " + a.name + " needs " + r.connections.map((x) => x.label).join(" and ") + " connected. " + (c?.prerequisite || "") };
    }
    a.availability = "ready";
    syncLegacy(s, a);
    logAgent(s, ctx, a, "agent.activated", "Activated " + a.name + " (version " + versionOf(a) + "). It can now receive permitted work.");
    return { ok: true, state: s, message: a.name + " is ready. It takes permitted work when asked; nothing starts on its own in this demo." };
  }
  if (availabilityOf(a0) === "paused") return fail(a0.name + " is already paused.");
  const s = ops.draft(s0);
  const a = agentById(s, agentId)!;
  a.availability = "paused";
  syncLegacy(s, a);
  const runs = activeRunsOf(s, agentId);
  logAgent(s, ctx, a, "agent.paused", "Paused " + a.name + (runs.length ? "; " + runs.length + " run" + (runs.length === 1 ? "" : "s") + " in progress " + (inFlight === "stop" ? "asked to stop at the next safe checkpoint" : "allowed to finish") : ""));
  if (inFlight === "stop") for (const r of runs) if (!r.stop) stopIn(s, ctx, r);
  return { ok: true, state: s, message: "Paused. " + a.name + " takes no new work." + (runs.length ? (inFlight === "stop" ? " Runs in progress stop at their next safe checkpoint." : " Runs in progress are allowed to finish.") : "") };
}

/** Saving a temporary worker as a permanent agent is an explicit act. It creates a Draft for review; nothing runs. */
export function saveWorkerAsAgent(s0: CoreState, ctx: Ctx, runId: Id, workerId: Id, name?: string): Result {
  const run = runById(s0, runId);
  const w = run?.workers.find((x) => x.id === workerId);
  if (!run || !w) return fail("Temporary worker not found.");
  const tpl = s0.config.agentTemplates.find((t) => t.id === w.templateId);
  const owner = agentById(s0, run.agentId);
  return createAgent(s0, ctx, {
    name: (name || "").trim() || (tpl?.label || "Worker") + " agent", purpose: tpl?.description || "Saved from a temporary worker in " + run.ref + ".",
    outputs: tpl?.outputs || [], responsibleId: owner?.responsibleId || ctx.viewerId, coordinatorId: owner && !owner.archived ? owner.id : null,
    scope: { teamIds: w.scopeTeamIds }, tools: w.tools, templateId: w.templateId,
    trigger: owner && !owner.archived ? { kind: "delegated", detail: "Delegated by " + owner.name } : { kind: "manual", detail: "Started by a person" }
  });
}

/* ── Adapter ───────────────────────────────────────────────────────────── */

export interface OrchestrationAdapter {
  readonly id: "sample" | "external";
  readonly label: string;
  status(s: CoreState): { connected: boolean; simulated: boolean; requirement: string };
  register(s: CoreState, ctx: Ctx, d: NewAgent): Result;
  update(s: CoreState, ctx: Ctx, agentId: Id, patch: AgentPatch): Result;
  validate(s: CoreState, agentId: Id): Readiness | null;
  testRun(s: CoreState, ctx: Ctx, agentId: Id, input: StartRunInput): Result;
  startRun(s: CoreState, ctx: Ctx, agentId: Id, input: StartRunInput): Result;
  delegate(s: CoreState, ctx: Ctx, runId: Id, toAgentId: Id): Result;
  spawnWorker(s: CoreState, ctx: Ctx, runId: Id, templateId: string, target?: Ref): Result;
  requestApproval(s: CoreState, ctx: Ctx, runId: Id, itemId: Id): Result;
  observe(s: CoreState, runId: Id): { state: AgentRunState; steps: AgentRunStep[]; outputs: AgentRun["outputs"] } | null;
  pause(s: CoreState, ctx: Ctx, agentId: Id, inFlight: "allow" | "stop"): Result;
  resume(s: CoreState, ctx: Ctx, agentId: Id): Result;
  cancel(s: CoreState, ctx: Ctx, runId: Id): Result;
  retry(s: CoreState, ctx: Ctx, runId: Id): Result;
  archive(s: CoreState, ctx: Ctx, agentId: Id): Result;
}

const definitions = {
  register: createAgent,
  update: updateAgent,
  validate: (s: CoreState, id: Id) => { const a = agentById(s, id); return a ? agentReadiness(s, a) : null; },
  observe: (s: CoreState, runId: Id) => { const r = runById(s, runId); return r ? { state: r.state, steps: r.steps, outputs: r.outputs } : null; },
  pause: (s: CoreState, ctx: Ctx, id: Id, inFlight: "allow" | "stop") => setAvailability(s, ctx, id, "paused", inFlight),
  resume: (s: CoreState, ctx: Ctx, id: Id) => setAvailability(s, ctx, id, "ready"),
  archive: archiveAgent
};

/** The local deterministic engine. Every run it produces is marked simulated. */
export const sampleAdapter: OrchestrationAdapter = {
  id: "sample", label: "Local sample engine",
  status: (s) => ({ connected: false, simulated: true, requirement: s.config.orchestration.connectionRequirement }),
  ...definitions,
  testRun, startRun, delegate: delegateTask, spawnWorker, requestApproval, cancel: requestStop, retry: retryRun
};

const notConnected = (s: CoreState): Result => fail(s.config.orchestration.connectionRequirement + " Nothing was started.");

/** Placeholder for a real runtime. Definitions still live in Pulse; execution fails honestly until a runtime is connected. */
export const externalAdapter: OrchestrationAdapter = {
  id: "external", label: "External runtime",
  status: (s) => ({ connected: false, simulated: false, requirement: s.config.orchestration.connectionRequirement }),
  ...definitions,
  testRun: (s) => notConnected(s), startRun: (s) => notConnected(s), delegate: (s) => notConnected(s), spawnWorker: (s) => notConnected(s),
  requestApproval: (s) => notConnected(s), cancel: requestStop, retry: (s) => notConnected(s)
};

export function adapterFor(s: CoreState): OrchestrationAdapter {
  return s.config.orchestration.adapter === "sample" ? sampleAdapter : externalAdapter;
}

/* ── Selectors for pages (Agents, Home, Activity) ──────────────────────── */

/** Runs the viewer may see in the selected scope. Test runs only for the person who ran them, unless asked. */
export function visibleRuns(q: Q, o?: { includeTests?: boolean; ignoreScope?: boolean }): AgentRun[] {
  const s = q.s;
  const v = q.viewer;
  const reach = new Set([...v.memberTeamIds, ...v.overseenTeamIds]);
  const sel = scopeTeams(s, q.ctx.scope);
  return s.data.agentRuns.filter((r) => {
    if (r.test && !(o?.includeTests && (r.initiator.id === v.person.id || v.isOrgWide))) return false;
    const people = [runPerson(s, r), agentById(s, r.agentId)?.responsibleId, r.waitingOwnerId];
    const involved = people.includes(v.person.id);
    const see = v.isOrgWide || involved || (r.scopeTeamIds !== "all" && r.scopeTeamIds.some((t) => reach.has(t)));
    if (!see) return false;
    if (o?.ignoreScope || q.ctx.scope.kind === "organisation") return true;
    if (q.ctx.scope.kind === "personal") return involved;
    return r.scopeTeamIds === "all" || r.scopeTeamIds.some((t) => sel?.includes(t));
  });
}

export interface AgentActivity { running: number; waitingApproval: number; waitingInput: number; failed: number; stopRequested: number; activeWorkers: number; idle: boolean }

/** Live work for one agent, from the runs the viewer can see. */
export function agentState(q: Q, agentId: Id): AgentActivity {
  const runs = visibleRuns(q, { ignoreScope: true }).filter((r) => r.agentId === agentId);
  const n = (f: (r: AgentRun) => boolean) => runs.filter(f).length;
  const out = {
    running: n((r) => r.state === "queued" || r.state === "planning" || r.state === "running" || r.state === "delegated"),
    waitingApproval: n((r) => r.state === "waiting_approval"),
    waitingInput: n((r) => r.state === "waiting_input"),
    failed: n((r) => r.state === "failed"),
    stopRequested: n((r) => r.state === "stop_requested"),
    activeWorkers: runs.reduce((k, r) => k + r.workers.filter((w) => w.state === "active").length, 0),
    idle: false
  };
  out.idle = !out.running && !out.waitingApproval && !out.waitingInput && !out.failed && !out.stopRequested;
  return out;
}

export interface AgentAttentionItem {
  runId: Id;
  ref: string;
  agentId: Id;
  agentName: string;
  kind: "waiting_approval" | "waiting_input" | "failed" | "stop_requested";
  title: string;
  ownerId?: Id;
  reason: string;
  nextAction: string;
  requestId?: Id;
  at: string;
}

/** The next thing a person must do for a run, in plain words. */
export function nextActionOf(s: CoreState, run: AgentRun): string {
  const plan = run.plan || [];
  const req = s.data.requests.find((r) => r.id === (plan.find((i) => i.kind === "action" && (i.status === "waiting" || i.status === "approved"))?.requestId || run.approvalRequestId));
  switch (run.state) {
    case "waiting_approval": return "Decide " + (req?.ref || "the request") + " in Work";
    case "waiting_input": return req?.status === "changes_requested" ? "Change and resubmit " + req.ref : "Run the approved action from " + (req?.ref || "the request");
    case "failed": { const e = failureOf(run); return e?.retryable === false ? "Review the failure; it cannot be retried as it is" : "Retry the failed step"; }
    case "stop_requested": return req ? "Decide or withdraw " + req.ref + " so the stop completes" : "Waiting for delegated work to reach a checkpoint";
    case "delegated": return "Waiting on " + childWaitText(s, run);
    case "completed": case "cancelled": return "None";
    default: return "None, it is working";
  }
}

/** Runs that need a person: waiting for approval or input, failed, or stopping. Parents whose only problem is a child are left out. */
export function agentAttention(q: Q): AgentAttentionItem[] {
  const s = q.s;
  const out: AgentAttentionItem[] = [];
  for (const r of visibleRuns(q)) {
    if (!["waiting_approval", "waiting_input", "failed", "stop_requested"].includes(r.state)) continue;
    const a = agentById(s, r.agentId);
    const plan = r.plan || [];
    if (r.state === "failed" && plan.find((i) => i.status === "failed")?.kind === "delegate") continue;
    const actionItem = plan.find((i) => i.kind === "action" && (i.status === "waiting" || i.status === "approved"));
    const req = s.data.requests.find((x) => x.id === (actionItem?.requestId || r.approvalRequestId));
    const last = r.steps[r.steps.length - 1];
    const reason = r.state === "failed" ? failureOf(r)?.business || "A step failed."
      : r.state === "waiting_approval" ? "Proposed: " + (actionItem ? actionText(s, actionItem) : "an action") + "."
      : r.state === "waiting_input" ? (req?.status === "changes_requested" ? req.ref + " was returned for changes." : (req?.ref || "The action") + " is approved but has not run.")
      : "Stop requested; it stops at the next safe checkpoint.";
    out.push({ runId: r.id, ref: r.ref, agentId: r.agentId, agentName: a?.name || "Agent", kind: r.state as AgentAttentionItem["kind"],
      title: (a?.name || "Agent") + ": " + r.goal, ownerId: r.waitingOwnerId || a?.responsibleId, reason, nextAction: nextActionOf(s, r), requestId: req?.id, at: last?.at || r.startedAt });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

/** Delegation edges of a run tree, for the chart overlay (runtime delegation, never reporting lines). */
export function runTree(s: CoreState, runId: Id): { runs: AgentRun[]; edges: { from: Id; to: Id; runId: Id }[]; workers: TempWorker[] } {
  const root = runById(s, runId);
  if (!root) return { runs: [], edges: [], workers: [] };
  const runs: AgentRun[] = [];
  const edges: { from: Id; to: Id; runId: Id }[] = [];
  const workers: TempWorker[] = [];
  const walk = (r: AgentRun, d: number) => {
    runs.push(r);
    workers.push(...r.workers);
    if (d > 8) return;
    for (const id of r.childRunIds) { const c = runById(s, id); if (c) { edges.push({ from: r.agentId, to: c.agentId, runId: c.id }); walk(c, d + 1); } }
  };
  walk(root, 0);
  return { runs, edges, workers };
}

export function runDuration(run: AgentRun, now: string): string {
  const end = run.endedAt || now;
  const m = Math.max(0, Math.round((ms(end) - ms(run.startedAt)) / 60000));
  if (m < 1) return "Under a minute";
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60);
  if (h < 48) return h + " h " + (m % 60 ? (m % 60) + " min" : "");
  return Math.round(h / 24) + " days";
}

/** Run one tool without applying anything, e.g. to describe seeded sample history with real figures. */
export function previewTool(s: CoreState, ctx: Ctx, run: AgentRun, toolId: string, target?: Ref, args?: Record<string, string>) {
  const out = execTool(s, ctx, run, toolId, target, args, run.agentId);
  return { ok: out.ok, input: out.input, output: out.output, refs: out.refs, error: out.error };
}
