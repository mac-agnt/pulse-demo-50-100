/* Sample agent definitions and agent runs. Removable with the rest of the sample fixture layer.
   applyAgents() receives the sample config and data after every other module
   has added its rows, and adds this module's definitions, templates, the
   agent action approval route and a short run history.

   The organisation it sets up (8 saved agents):
     Helios (coordinator, root)
       Briefing assistant
       Work coordinator           (nested branch)
         Request triage
         Data steward
       Project monitor
       Document reviewer
     Invoice matcher               (independent root; needs Email delivery)

   Run history (all simulated, local sample engine):
     run-1  Helios delegated a weekly status to Briefing (run-2) and Project monitor (run-3) and combined the outputs.
     run-4  Document reviewer created a bounded temporary worker for the second piece of evidence (kept in history).
     run-5  Work coordinator delegated data gaps to Data steward (run-6), which proposed a record change and waits
            for approval (REQ-290 in Work, with Casey Lund).
     run-7  Project monitor failed one step after creating a task; a retry runs only the failed step.
     run-8  Invoice matcher matched an invoice with its order, on version 1, before email was added. */

import { agentActionForm, agentActionRule, dedupeTexts, previewTool, scopeText } from "../orchestration";
import { addBusinessHours, addHours } from "../time";
import type {
  AgentDef, AgentPlanItem, AgentRun, AgentRunStep, AgentSourceKind, Approval, AuditEvent, CoreData, CoreState, Ctx, Id, OrgConfig, RequestItem, Task
} from "../types";

const REF = "2026-03-11T10:00:00.000Z";
const at = (h: number) => addHours(REF, h);
type Ref = { kind: AgentSourceKind; id: Id };

const LIMITS = { maxDepth: 2, maxChildren: 3, maxConcurrentRuns: 2, maxMinutes: 15 };

export function applyAgents(c: OrgConfig, d: CoreData): void {
  /* ── Templates, approval route ── */
  if (!c.agentTemplates.some((t) => t.id === "tpl-invoice")) {
    c.agentTemplates.push({ id: "tpl-invoice", label: "Invoice matching", description: "Compares supplier invoices with their orders and receipts and notes differences for a reviewer.",
      inputs: ["Invoice"], outputs: ["Matching notes"], tools: ["purchasing.match", "read.files"], defaultTrigger: { kind: "event", detail: "When an invoice arrives" }, workerOk: true, module: "purchasing" });
  }
  if (!c.requestForms.some((f) => f.id === "form-agent-action")) c.requestForms.push(agentActionForm());
  if (!c.approvalRules.some((r) => r.id === "rule-agent-action")) c.approvalRules.push(agentActionRule());

  /* ── Definitions ── */
  const old = (id: string) => c.agents.find((a) => a.id === id);
  const def = (a: Omit<AgentDef, "permittedActions" | "approvalRequired" | "enabled"> & Partial<AgentDef>): AgentDef => {
    const restricted = (t: string) => !!c.agentTools.find((x) => x.id === t)?.restricted;
    const label = (t: string) => c.agentTools.find((x) => x.id === t)?.label || t;
    return {
      ...a,
      permittedActions: (a.tools || []).filter((t) => !restricted(t)).map(label),
      approvalRequired: (a.tools || []).filter(restricted).map(label),
      enabled: a.availability === "ready"
    };
  };
  const briefing = old("ag-briefing");
  const steward = old("ag-steward");
  const intake = old("ag-intake");

  c.agents = [
    def({ id: "ag-helios", name: "Helios", purpose: "Takes goals from people, splits them into parts and routes each part to the capability agent responsible for it.",
      instructions: "Route each part to the agent whose responsibility fits the goal and inputs. Combine their results with the evidence they cite. Never act outside the scope of the person asking.",
      outputs: ["Combined outcome with evidence"], responsibleId: "p-robin", coordinatorId: null, availability: "ready", scope: { teamIds: "all" },
      tools: ["read.work", "read.records", "read.files", "write.task", "write.record", "project.update", "standards.precheck", "purchasing.match"],
      knowledge: ["record", "files"], trigger: { kind: "manual", detail: "Started by a person" }, limits: { ...LIMITS },
      spawn: { enabled: true, templateIds: ["tpl-docreview", "tpl-project"], maxWorkers: 2 }, templateId: "tpl-coordination", version: 3, createdAt: at(-24 * 40),
      shape: "glass-visor", tint: "#191c1f" }),
    def({ id: "ag-briefing", name: briefing?.name || "Briefing assistant", purpose: briefing?.purpose || "Summarises what changed in your scope and links the evidence.",
      outputs: ["Briefing with links"], responsibleId: briefing?.responsibleId || "p-casey", coordinatorId: "ag-helios", availability: "ready", scope: { teamIds: "all" },
      tools: ["read.work", "read.records", "read.files"], knowledge: ["record", "files"], trigger: { kind: "schedule", detail: "Weekdays 07:30 (recorded; no scheduler runs in this demo)" },
      limits: { ...LIMITS, maxChildren: 1 }, spawn: { enabled: false, templateIds: [], maxWorkers: 1 }, templateId: "tpl-briefing", version: 2, createdAt: at(-24 * 60),
      shape: briefing?.shape || "crown-pebble", tint: briefing?.tint || "#191c1f" }),
    def({ id: "ag-work", name: "Work coordinator", purpose: "Coordinates day-to-day work for Unit North: routes requests and data gaps to the agents that handle them.",
      outputs: ["Routing notes", "Combined outcome"], responsibleId: "p-jordan", coordinatorId: "ag-helios", availability: "ready", scope: { teamIds: ["t-a", "t-b"] },
      tools: ["read.work", "read.records", "read.files", "write.task", "write.request", "write.record", "write.issue"], knowledge: ["record"],
      trigger: { kind: "delegated", detail: "Delegated by Helios, or started by a person" }, limits: { ...LIMITS },
      spawn: { enabled: true, templateIds: ["tpl-triage", "tpl-quality"], maxWorkers: 1 }, templateId: "tpl-coordination", version: 1, createdAt: at(-24 * 30),
      shape: "control-cube", tint: "#1b2430" }),
    def({ id: "ag-projects", name: "Project monitor", purpose: "Watches milestones, dependencies and open project work, and drafts progress updates for project owners.",
      outputs: ["Risk notes", "Draft update"], responsibleId: "p-casey", coordinatorId: "ag-helios", availability: "ready", scope: { teamIds: "all" },
      tools: ["read.work", "read.records", "write.task", "project.update", "project.milestone"], knowledge: ["record"],
      trigger: { kind: "event", detail: "When a milestone moves (recorded; events start nothing on their own in this demo)" }, limits: { ...LIMITS, maxChildren: 2 },
      spawn: { enabled: false, templateIds: [], maxWorkers: 1 }, templateId: "tpl-project", version: 2, createdAt: at(-24 * 25),
      shape: "low-dome", tint: "#2a2118" }),
    def({ id: "ag-docs", name: "Document reviewer", purpose: "Pre-checks received evidence against its requirement and lists gaps for the human reviewer. It never accepts evidence.",
      outputs: ["Gap list"], responsibleId: "p-jordan", coordinatorId: "ag-helios", availability: "ready", scope: { teamIds: "all" },
      tools: ["read.files", "standards.precheck"], knowledge: ["files"], trigger: { kind: "delegated", detail: "Delegated by Helios, or started by a person" },
      limits: { maxDepth: 1, maxChildren: 2, maxConcurrentRuns: 2, maxMinutes: 15 }, spawn: { enabled: true, templateIds: ["tpl-docreview"], maxWorkers: 2 },
      templateId: "tpl-docreview", version: 1, createdAt: at(-24 * 20), shape: "shield", tint: "#191c1f" }),
    def({ id: "ag-intake", name: "Request triage", purpose: intake?.purpose && /triage|route/i.test(intake.purpose) ? intake.purpose : "Reads new requests, checks their evidence and routes them to the right queue.",
      outputs: ["Routing note", "Missing evidence list"], responsibleId: intake?.responsibleId || "p-jordan", coordinatorId: "ag-work", availability: "ready", scope: { teamIds: ["t-a", "t-b"] },
      tools: ["read.work", "write.task", "write.request"], knowledge: ["record"], trigger: { kind: "delegated", detail: "Delegated by Work coordinator" },
      limits: { maxDepth: 1, maxChildren: 1, maxConcurrentRuns: 2, maxMinutes: 10 }, spawn: { enabled: false, templateIds: [], maxWorkers: 1 }, templateId: "tpl-triage", version: 2,
      createdAt: at(-24 * 60), shape: intake?.shape || "rim-capsule", tint: intake?.tint || "#1b2430" }),
    def({ id: "ag-steward", name: steward?.name || "Data steward", purpose: steward?.purpose || "Finds missing and conflicting data and opens review tasks.",
      outputs: ["Issues", "Proposed corrections"], responsibleId: steward?.responsibleId || "p-robin", coordinatorId: "ag-work", availability: "ready", scope: { teamIds: "all" },
      tools: ["read.records", "read.files", "write.task", "write.record", "write.issue"], knowledge: ["record", "files"],
      trigger: { kind: "delegated", detail: "Delegated by Work coordinator" }, limits: { maxDepth: 1, maxChildren: 1, maxConcurrentRuns: 2, maxMinutes: 15 },
      spawn: { enabled: false, templateIds: [], maxWorkers: 1 }, templateId: "tpl-quality", version: 2, createdAt: at(-24 * 60),
      shape: steward?.shape || "executive-capsule", tint: steward?.tint || "#2a2118" }),
    def({ id: "ag-invoices", name: "Invoice matcher", purpose: "Matches supplier invoices with their orders and receipts, notes differences for a reviewer and emails the supplier about them.",
      outputs: ["Matching notes"], responsibleId: "p-robin", coordinatorId: null, availability: "connection_required", scope: { teamIds: "all" },
      tools: ["purchasing.match", "finance.read", "read.files", "notify.email"], knowledge: ["files"], trigger: { kind: "event", detail: "When an invoice arrives (recorded; events start nothing on their own in this demo)" },
      limits: { maxDepth: 0, maxChildren: 1, maxConcurrentRuns: 2, maxMinutes: 10 }, spawn: { enabled: false, templateIds: [], maxWorkers: 1 }, templateId: "tpl-invoice", version: 2,
      createdAt: at(-24 * 15), shape: "precision-brow", tint: "#2a2118" })
  ];

  /* ── Run history ── */
  const s: CoreState = { mode: "sample", config: c, data: d, seq: 0 };
  const agent = (id: Id) => c.agents.find((a) => a.id === id)!;
  const ev: Omit<AuditEvent, "id">[] = [];
  const runs: AgentRun[] = [];

  const mk = (o: { id: Id; agentId: Id; version?: number; parent?: AgentRun; goal: string; scope: Id[] | "all"; initiator: AgentRun["initiator"]; start: number; inputs?: Ref[] }): AgentRun => {
    const a = agent(o.agentId);
    const r: AgentRun = {
      id: o.id, ref: "AGR-" + (100 + runs.length + 1), agentId: o.agentId, agentVersion: o.version ?? (a.version || 1), parentRunId: o.parent?.id, depth: o.parent ? o.parent.depth + 1 : 0,
      goal: o.goal, scopeTeamIds: o.scope, initiator: o.initiator, idempotencyKey: o.parent ? o.parent.idempotencyKey + "/" + o.id : "seed:" + o.id, state: "completed",
      startedAt: at(o.start), steps: [], workers: [], childRunIds: [], inputs: o.inputs || [], outputs: [], appliedEffects: [], usage: { reported: false }, simulated: true, plan: [],
      snapshot: { name: a.name, tools: [...(a.tools || [])], limits: { ...(a.limits || LIMITS) }, spawn: a.spawn ? structuredClone(a.spawn) : undefined }
    };
    if (o.parent) o.parent.childRunIds.push(r.id);
    runs.push(r);
    d.agentRuns.push(r);
    return r;
  };
  const step = (r: AgentRun, h: number, kind: AgentRunStep["kind"], actor: AgentRunStep["actor"], summary: string, extra?: Partial<AgentRunStep>) => {
    r.steps.push({ id: r.id + "-s" + (r.steps.length + 1), at: at(h), kind, actor, summary, status: "done", sourceRefs: [], ...extra });
  };
  const item = (r: AgentRun, p: Omit<AgentPlanItem, "id" | "attempts"> & { attempts?: number }): AgentPlanItem => {
    const it: AgentPlanItem = { id: "p" + (r.plan!.length + 1), attempts: 1, ...p };
    r.plan!.push(it);
    return it;
  };
  const ag = (id: Id): AgentRunStep["actor"] => ({ kind: "agent", id });
  const person = (id: Id): AgentRunStep["actor"] => ({ kind: "person", id });
  const SYS: AgentRunStep["actor"] = { kind: "system", id: "system" };
  /** Real figures for a tool at that time, through the same executor the engine uses. */
  const tool = (r: AgentRun, h: number, toolId: string, target?: Ref, fallback?: string) => {
    const ctx: Ctx = { viewerId: "p-robin", scope: { kind: "organisation" }, now: at(h) };
    const out = previewTool(s, ctx, r, toolId, target);
    return out.ok ? { input: out.input, output: out.output, refs: out.refs } : { input: toolId, output: fallback || "No data was available for this step.", refs: target ? [target] : [] };
  };
  const log = (r: AgentRun, h: number, action: string, summary: string, actorId: Id, refs: Ref[] = []) => {
    const team = r.scopeTeamIds !== "all" && r.scopeTeamIds.length === 1 ? r.scopeTeamIds[0] : undefined;
    const unit = team ? c.teams.find((t) => t.id === team)?.unitId : r.scopeTeamIds !== "all" && r.scopeTeamIds.length ? c.teams.find((t) => t.id === (r.scopeTeamIds as Id[])[0])?.unitId : undefined;
    let root = r;
    while (root.parentRunId) root = runs.find((x) => x.id === root.parentRunId) || root;
    ev.push({ at: at(h), actorId, actorKind: actorId.startsWith("ag-") ? "agent" : "person", action, objectType: "agentRun", objectId: r.id, storyKey: "agentRun:" + root.id,
      recordIds: refs.filter((x) => x.kind === "record").map((x) => x.id), summary: r.ref + ": " + summary, teamId: team, unitId: unit, simulated: true });
  };
  const has = { projects: d.projects.some((p) => p.id === "pr-ws") && d.projects.some((p) => p.id === "pr-doc"),
    obligations: d.obligations.some((o) => o.id === "ob-doc-signoff"), invoice: d.invoices.some((i) => i.id === "inv-3") };
  const north = ["t-a", "t-b"];

  /* run-1: Helios delegates a weekly status to two registered agents and combines the outputs. */
  {
    const h0 = -26;
    const r1 = mk({ id: "run-1", agentId: "ag-helios", goal: "Weekly status for Unit North", scope: north, initiator: { kind: "person", id: "p-casey" }, start: h0, inputs: has.projects ? [{ kind: "project", id: "pr-ws" }] : [] });
    step(r1, h0, "queued", person("p-casey"), "Queued by Casey Lund. Scope: " + scopeText(s, north) + ".");
    const d1 = item(r1, { kind: "delegate", agentId: "ag-briefing", label: "Delegate to Briefing assistant", status: "done", childRunId: "run-2" });
    const d2 = item(r1, { kind: "delegate", agentId: "ag-projects", label: "Delegate to Project monitor", status: "done", childRunId: "run-3" });
    step(r1, h0, "planning", ag("ag-helios"), "Planned 2 steps: delegate to Briefing assistant; delegate to Project monitor. Chose Briefing assistant and Project monitor: their responsibilities match the goal and inputs.");
    // run-2 Briefing
    const r2 = mk({ id: "run-2", agentId: "ag-briefing", parent: r1, goal: r1.goal, scope: north, initiator: { kind: "agent", id: "ag-helios" }, start: h0 });
    step(r1, h0 + 0.01, "delegated", ag("ag-helios"), "Delegated to Briefing assistant (" + r2.ref + "). It works within " + scopeText(s, north) + " with the tools both agents hold.", { childRunId: r2.id });
    step(r2, h0 + 0.01, "queued", ag("ag-helios"), "Delegated by Helios (" + r1.ref + "). Scope: " + scopeText(s, north) + ".");
    step(r2, h0 + 0.01, "planning", ag("ag-briefing"), "Planned 2 steps: read work in scope; read records in scope.");
    const w = tool(r2, h0 + 0.02, "read.work");
    const rr = tool(r2, h0 + 0.02, "read.records");
    item(r2, { kind: "tool", toolId: "read.work", label: "Read work in scope", status: "done", output: w.output });
    item(r2, { kind: "tool", toolId: "read.records", label: "Read records in scope", status: "done", output: rr.output });
    step(r2, h0 + 0.02, "tool_call", ag("ag-briefing"), "Read work in scope", { toolId: "read.work", input: w.input, output: w.output, sourceRefs: w.refs, attempt: 1 });
    step(r2, h0 + 0.02, "tool_call", ag("ag-briefing"), "Read records in scope", { toolId: "read.records", input: rr.input, output: rr.output, sourceRefs: rr.refs, attempt: 1 });
    r2.outputs = [{ label: "Read work in scope", text: w.output }, { label: "Read records in scope", text: rr.output }];
    step(r2, h0 + 0.03, "completed", ag("ag-briefing"), "Completed: 2 of 2 planned steps done.", { sourceRefs: [...w.refs, ...rr.refs].slice(0, 8) });
    r2.endedAt = at(h0 + 0.03);
    d1.output = w.output + " " + rr.output;
    step(r1, h0 + 0.03, "output", ag("ag-briefing"), "Briefing assistant returned (" + r2.ref + "): " + d1.output, { childRunId: r2.id, sourceRefs: [...w.refs, ...rr.refs].slice(0, 6) });
    // run-3 Project monitor
    const r3 = mk({ id: "run-3", agentId: "ag-projects", parent: r1, goal: r1.goal, scope: north, initiator: { kind: "agent", id: "ag-helios" }, start: h0 + 0.03,
      inputs: has.projects ? [{ kind: "project", id: "pr-ws" }] : [] });
    step(r1, h0 + 0.03, "delegated", ag("ag-helios"), "Delegated to Project monitor (" + r3.ref + "). It works within " + scopeText(s, north) + " with the tools both agents hold; not passed on: Propose milestone changes.", { childRunId: r3.id });
    step(r3, h0 + 0.03, "queued", ag("ag-helios"), "Delegated by Helios (" + r1.ref + "). Scope: " + scopeText(s, north) + ".");
    r3.snapshot!.tools = r3.snapshot!.tools.filter((t) => t !== "project.milestone");
    const pw: Ref | undefined = has.projects ? { kind: "project", id: "pr-ws" } : undefined;
    step(r3, h0 + 0.03, "planning", ag("ag-projects"), pw ? "Planned 2 steps: read milestones and tasks for Workspace upgrade; draft a progress update for Workspace upgrade." : "Planned 1 step: read work in scope.");
    const pr = tool(r3, h0 + 0.04, "read.work", pw);
    item(r3, { kind: "tool", toolId: "read.work", target: pw, label: pw ? "Read milestones and tasks for Workspace upgrade" : "Read work in scope", status: "done", output: pr.output });
    step(r3, h0 + 0.04, "tool_call", ag("ag-projects"), pw ? "Read milestones and tasks for Workspace upgrade" : "Read work in scope", { toolId: "read.work", input: pr.input, output: pr.output, sourceRefs: pr.refs, attempt: 1 });
    let upd = { output: "", refs: [] as Ref[] };
    if (pw) {
      const u = tool(r3, h0 + 0.05, "project.update", pw);
      upd = { output: u.output, refs: u.refs };
      item(r3, { kind: "tool", toolId: "project.update", target: pw, label: "Draft a progress update for Workspace upgrade", status: "done", output: u.output });
      step(r3, h0 + 0.05, "tool_call", ag("ag-projects"), "Draft a progress update for Workspace upgrade", { toolId: "project.update", input: u.input, output: u.output, sourceRefs: u.refs, attempt: 1 });
    }
    r3.outputs = (r3.plan || []).map((p) => ({ label: p.label, text: p.output, ...(p.target ? { kind: p.target.kind, id: p.target.id } : {}) }));
    step(r3, h0 + 0.06, "completed", ag("ag-projects"), "Completed: " + r3.plan!.length + " of " + r3.plan!.length + " planned steps done.", { sourceRefs: [...pr.refs, ...upd.refs].slice(0, 8) });
    r3.endedAt = at(h0 + 0.06);
    d2.output = dedupeTexts((r3.plan || []).map((p) => p.output || "")).join(" ");
    step(r1, h0 + 0.06, "output", ag("ag-projects"), "Project monitor returned (" + r3.ref + "): " + d2.output, { childRunId: r3.id, sourceRefs: [...pr.refs, ...upd.refs].slice(0, 6) });
    r1.outputs = [
      { label: "Combined outcome", text: "Combined from Briefing assistant and Project monitor. " + dedupeTexts([d1.output || "", d2.output || ""]).join(" ") },
      { label: "Briefing assistant", kind: "agentRun", id: r2.id, text: d1.output },
      { label: "Project monitor", kind: "agentRun", id: r3.id, text: d2.output }
    ];
    const refs = [...w.refs, ...rr.refs, ...pr.refs, ...upd.refs].filter((x, i, arr) => arr.findIndex((y) => y.kind === x.kind && y.id === x.id) === i);
    step(r1, h0 + 0.07, "completed", ag("ag-helios"), "Completed: 2 of 2 planned steps done.", { sourceRefs: refs.slice(0, 8) });
    r1.endedAt = at(h0 + 0.07);
    log(r1, h0, "agentRun.started", "started Helios: Weekly status for Unit North", "p-casey");
    log(r1, h0 + 0.01, "agentRun.delegated", "delegated to Briefing assistant (" + r2.ref + ")", "ag-helios");
    log(r1, h0 + 0.03, "agentRun.delegated", "delegated to Project monitor (" + r3.ref + ")", "ag-helios");
    log(r2, h0 + 0.03, "agentRun.completed", "completed", "ag-briefing", w.refs);
    log(r3, h0 + 0.06, "agentRun.completed", "completed", "ag-projects", pr.refs);
    log(r1, h0 + 0.07, "agentRun.completed", "completed with a combined outcome from 2 parts", "ag-helios", refs);
  }

  /* run-4: Document reviewer creates a bounded temporary worker for the second piece of evidence. */
  if (has.obligations) {
    const h0 = -20;
    const ins: Ref[] = [{ kind: "obligation", id: "ob-doc-signoff" }, { kind: "obligation", id: "ob-doc-dpia" }];
    const r4 = mk({ id: "run-4", agentId: "ag-docs", goal: "Pre-check the evidence for the document review rollout", scope: north, initiator: { kind: "person", id: "p-casey" }, start: h0, inputs: ins });
    step(r4, h0, "queued", person("p-casey"), "Queued by Casey Lund. Scope: " + scopeText(s, north) + ".");
    step(r4, h0, "planning", ag("ag-docs"), "Planned 2 steps: pre-check Document sign-off; temporary worker to pre-check the second piece of evidence. The second check goes to a worker under the spawn policy (Document review template, at most 2 workers).");
    const a1 = tool(r4, h0 + 0.01, "standards.precheck", ins[0]);
    item(r4, { kind: "tool", toolId: "standards.precheck", target: ins[0], label: "Pre-check the sign-off evidence", status: "done", output: a1.output });
    step(r4, h0 + 0.01, "tool_call", ag("ag-docs"), "Pre-check the sign-off evidence", { toolId: "standards.precheck", input: a1.input, output: a1.output, sourceRefs: a1.refs, attempt: 1 });
    const wk = { id: "run-4-w1", runId: "run-4", templateId: "tpl-docreview", label: "Document review worker 1", scopeTeamIds: [...north], tools: ["read.files", "standards.precheck"], depth: 1,
      state: "completed" as const, createdAt: at(h0 + 0.02), endedAt: at(h0 + 0.03), output: "" };
    r4.workers.push(wk);
    step(r4, h0 + 0.02, "spawned", ag("ag-docs"), "Created temporary worker Document review worker 1 for the data protection assessment. Tools: Read documents, Pre-check evidence (its template and this run's tools in common, restricted tools excluded). Scope: "
      + scopeText(s, north) + ". It ends with this task.", { workerId: wk.id, sourceRefs: [ins[1]] });
    const a2 = tool(r4, h0 + 0.03, "standards.precheck", ins[1]);
    wk.output = a2.output;
    item(r4, { kind: "spawn", templateId: "tpl-docreview", target: ins[1], workerId: wk.id, label: "Temporary worker to pre-check the data protection assessment", status: "done", output: a2.output });
    step(r4, h0 + 0.03, "tool_call", { kind: "worker", id: wk.id }, "Pre-check evidence: data protection assessment", { workerId: wk.id, toolId: "standards.precheck", input: a2.input, output: a2.output, sourceRefs: a2.refs });
    r4.outputs = [
      { label: "Combined outcome", text: "Combined from Document review worker 1. " + a1.output + " " + a2.output },
      { label: "Document review worker 1 (temporary)", kind: "obligation", id: "ob-doc-dpia", text: a2.output }
    ];
    step(r4, h0 + 0.04, "completed", ag("ag-docs"), "Completed: 2 of 2 planned steps done. The worker ended with its task and is kept in this run's history.", { sourceRefs: [...a1.refs, ...a2.refs] });
    r4.endedAt = at(h0 + 0.04);
    log(r4, h0, "agentRun.started", "started Document reviewer: pre-check the evidence for the document review rollout", "p-casey");
    log(r4, h0 + 0.02, "agentRun.worker", "created temporary worker Document review worker 1", "ag-docs");
    log(r4, h0 + 0.04, "agentRun.completed", "completed", "ag-docs");
  }

  /* run-5 / run-6: Work coordinator delegates data gaps to Data steward, which proposes a record change and waits for approval. */
  {
    const h0 = -3;
    const r5 = mk({ id: "run-5", agentId: "ag-work", goal: "Clear the data gaps in Team A", scope: ["t-a"], initiator: { kind: "person", id: "p-jordan" }, start: h0 });
    r5.state = "delegated";
    step(r5, h0, "queued", person("p-jordan"), "Queued by Jordan Price. Scope: Team A.");
    step(r5, h0, "planning", ag("ag-work"), "Planned 1 step: delegate to Data steward. Chose Data steward: its responsibility matches the goal. Request triage was not asked: nothing in the goal is about requests.");
    item(r5, { kind: "delegate", agentId: "ag-steward", label: "Delegate to Data steward", status: "waiting", childRunId: "run-6" });
    const r6 = mk({ id: "run-6", agentId: "ag-steward", parent: r5, goal: r5.goal, scope: ["t-a"], initiator: { kind: "agent", id: "ag-work" }, start: h0 + 0.01 });
    r6.state = "waiting_approval";
    step(r5, h0 + 0.01, "delegated", ag("ag-work"), "Delegated to Data steward (" + r6.ref + "). It works within Team A with the tools both agents hold.", { childRunId: r6.id, status: "current" });
    step(r6, h0 + 0.01, "queued", ag("ag-work"), "Delegated by Work coordinator (" + r5.ref + "). Scope: Team A.");
    step(r6, h0 + 0.01, "planning", ag("ag-steward"), "Planned 2 steps: scan records in scope for missing required fields; set review date on REC-1003.");
    const scan = tool(r6, h0 + 0.02, "read.records");
    item(r6, { kind: "tool", toolId: "read.records", label: "Scan records in scope for missing required fields", status: "done", output: scan.output });
    step(r6, h0 + 0.02, "tool_call", ag("ag-steward"), "Scan records in scope for missing required fields", { toolId: "read.records", input: scan.input, output: scan.output, sourceRefs: scan.refs, attempt: 1 });
    const rec = d.records.find((x) => x.id === "r-1003");
    const file = d.files.find((f) => f.id === "f-procedure");
    const value = (file?.reviewDate || at(-48)).slice(0, 10);
    const basis = "the review date of the linked document " + (file?.title || "Review procedure") + " (f-procedure)";
    const desc = "Set review date on " + (rec?.ref || "REC-1003") + " to " + value + ", from " + basis;
    const key = "record:r-1003:reviewDate=" + value;
    item(r6, { kind: "action", toolId: "write.record", target: { kind: "record", id: "r-1003" }, label: "Set review date on " + (rec?.ref || "REC-1003"), status: "waiting",
      action: { kind: "record-field", recordId: "r-1003", field: "reviewDate", value, basis }, effectKey: key, requestId: "req-ag-1", created: { kind: "request", id: "req-ag-1" } });
    step(r6, h0 + 0.02, "proposed_action", ag("ag-steward"), "Proposed: " + desc + ". Correct record fields is restricted, so a person decides first.",
      { toolId: "write.record", input: desc, sourceRefs: [{ kind: "record", id: "r-1003" }, { kind: "file", id: "f-procedure" }], effectKey: key });
    const fields = { agentRunId: "run-6", agentId: "ag-steward", toolId: "write.record", action: desc + ". Proposed by Data steward in " + r6.ref + ".", effectKey: key };
    const req: RequestItem = {
      id: "req-ag-1", ref: "REQ-290", formId: "form-agent-action", title: "Agent action: " + desc, requesterId: "p-jordan", teamId: "t-a", unitId: "u-north", fields, version: 1,
      versions: [{ n: 1, fields: { ...fields }, at: at(h0 + 0.02), by: "p-jordan", note: "Submitted" }], status: "submitted", evidenceFileIds: [], linkedRecordIds: ["r-1003"], taskIds: [],
      approvalId: "ap-ag-1", execution: { status: "not_started", effect: "Let the agent carry out its proposed action", attempts: 0, appliedKeys: [] },
      createdAt: at(h0 + 0.02), updatedAt: at(h0 + 0.02), createdBy: "ag-steward"
    };
    const ap: Approval = {
      id: "ap-ag-1", requestId: "req-ag-1", ruleId: "rule-agent-action", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(h0 + 0.02), decisions: [],
      stages: [{ stageId: "st-mgr", label: "Team manager or administrator", eligibleRoles: ["team_manager", "admin"], assigneeId: "p-casey", status: "pending",
        startedAt: at(h0 + 0.02), dueAt: addBusinessHours(at(h0 + 0.02), 16, c.timezone) }],
      policyException: "The requester cannot approve their own request, so team manager or administrator routes to the next eligible person."
    };
    d.requests.push(req);
    d.approvals.push(ap);
    r6.approvalRequestId = "req-ag-1";
    r6.waitingOwnerId = "p-casey";
    step(r6, h0 + 0.02, "waiting_approval", SYS, "Waiting for Casey Lund to decide REQ-290 in Work. Nothing changes until it is approved and then run.",
      { status: "current", sourceRefs: [{ kind: "request", id: "req-ag-1" }, { kind: "approval", id: "ap-ag-1" }] });
    log(r5, h0, "agentRun.started", "started Work coordinator: Clear the data gaps in Team A", "p-jordan");
    log(r5, h0 + 0.01, "agentRun.delegated", "delegated to Data steward (" + r6.ref + ")", "ag-work");
    ev.push({ at: at(h0 + 0.02), actorId: "ag-steward", actorKind: "agent", action: "request.created", objectType: "request", objectId: "req-ag-1", recordIds: ["r-1003"],
      summary: "Created REQ-290: Agent action: " + desc, teamId: "t-a", unitId: "u-north", storyKey: "agentRun:run-5", simulated: true });
    ev.push({ at: at(h0 + 0.02), actorId: "p-jordan", actorKind: "person", action: "request.submitted", objectType: "request", objectId: "req-ag-1", recordIds: ["r-1003"],
      summary: "Submitted REQ-290 (version 1); waiting on Casey Lund", teamId: "t-a", unitId: "u-north", storyKey: "agentRun:run-5" });
    log(r6, h0 + 0.02, "agentRun.waiting_approval", "waiting for Casey Lund to approve REQ-290", "ag-steward", [{ kind: "record", id: "r-1003" }]);
  }

  /* run-7: Project monitor created a task, then one step failed. Retry runs only the failed step; the task is not created twice. */
  if (has.projects) {
    const h0 = -6;
    const pd: Ref = { kind: "project", id: "pr-doc" };
    const proj = d.projects.find((p) => p.id === "pr-doc")!;
    const r7 = mk({ id: "run-7", agentId: "ag-projects", goal: "Check readiness of the document review rollout", scope: north, initiator: { kind: "person", id: "p-casey" }, start: h0, inputs: [pd] });
    r7.state = "failed";
    step(r7, h0, "queued", person("p-casey"), "Queued by Casey Lund. Scope: " + scopeText(s, north) + ".");
    step(r7, h0, "planning", ag("ag-projects"), "Planned 3 steps: read milestones and tasks for Document review rollout; create a task to chase the sign-off review; draft a progress update for Document review rollout.");
    const rd = tool(r7, h0 + 0.01, "read.work", pd);
    item(r7, { kind: "tool", toolId: "read.work", target: pd, label: "Read milestones and tasks for Document review rollout", status: "done", output: rd.output });
    step(r7, h0 + 0.01, "tool_call", ag("ag-projects"), "Read milestones and tasks for Document review rollout", { toolId: "read.work", input: rd.input, output: rd.output, sourceRefs: rd.refs, attempt: 1 });
    const title = "Start the review of the sign-off evidence for Document review rollout";
    const task: Task = { id: "t-run7-1", title, teamId: proj.teamId || "t-a", unitId: proj.unitId || "u-north", assigneeId: null, linkedRecordIds: [], priority: "high", status: "open",
      dueAt: at(24 + 7), dependsOn: [], checklist: [], notes: [], evidenceFileIds: [], createdAt: at(h0 + 0.02), createdBy: "ag-projects", slaPolicyId: "sla-task",
      projectId: "pr-doc", origin: { kind: "agent-run", id: "run-7" } };
    d.tasks.push(task);
    const key = "task:pr-doc:signoff-review";
    item(r7, { kind: "tool", toolId: "write.task", target: pd, label: "Create a task to chase the sign-off review", status: "done", output: "Created task: " + title + ".", effectKey: key,
      created: { kind: "task", id: task.id } });
    step(r7, h0 + 0.02, "tool_call", ag("ag-projects"), "Create a task to chase the sign-off review", { toolId: "write.task", input: title, output: "Created task: " + title + ".",
      sourceRefs: [{ kind: "task", id: task.id }, pd, ...(has.obligations ? [{ kind: "obligation" as const, id: "ob-doc-signoff" }] : [])], effectKey: key, attempt: 1 });
    r7.appliedEffects.push({ key, description: "Created task: " + title, at: at(h0 + 0.02) });
    const err = { business: "The draft update was not written because the project's milestone dates changed while the run was reading them. Nothing was posted; retrying reads the dates again.",
      technical: "project.update: stale read on pr-doc milestones (read 03:59:41Z, changed 04:00:02Z); sample engine aborts on a version mismatch (409 conflict)", retryable: true };
    item(r7, { kind: "tool", toolId: "project.update", target: pd, label: "Draft a progress update for Document review rollout", status: "failed", error: err });
    step(r7, h0 + 0.03, "failed", ag("ag-projects"), "Draft a progress update for Document review rollout failed. " + err.business, { status: "failed", error: err, toolId: "project.update", attempt: 1, sourceRefs: [pd] });
    r7.waitingOwnerId = "p-casey";
    log(r7, h0, "agentRun.started", "started Project monitor: Check readiness of the document review rollout", "p-casey");
    ev.push({ at: at(h0 + 0.02), actorId: "ag-projects", actorKind: "agent", action: "task.created", objectType: "task", objectId: task.id, recordIds: [], teamId: task.teamId, unitId: task.unitId,
      summary: "Created task: " + title, storyKey: "agentRun:run-7", simulated: true });
    log(r7, h0 + 0.03, "agentRun.failed", "step failed: " + err.business, "ag-projects");
  }

  /* run-8: Invoice matcher on version 1 (before email was added), matching an invoice with its order. */
  if (has.invoice) {
    const h0 = -24 * 3;
    const iv: Ref = { kind: "invoice", id: "inv-3" };
    const r8 = mk({ id: "run-8", agentId: "ag-invoices", version: 1, goal: "Match the new invoice with its order", scope: "all", initiator: { kind: "event", id: "inv-3" }, start: h0, inputs: [iv] });
    r8.snapshot!.tools = ["purchasing.match", "finance.read", "read.files"];
    step(r8, h0, "queued", SYS, "Queued when the invoice arrived (simulated event). Scope: " + scopeText(s, "all") + ".");
    step(r8, h0, "planning", ag("ag-invoices"), "Planned 1 step: match the invoice with its order.");
    const m = tool(r8, h0 + 0.01, "purchasing.match", iv);
    item(r8, { kind: "tool", toolId: "purchasing.match", target: iv, label: "Match the invoice with its order", status: "done", output: m.output });
    step(r8, h0 + 0.01, "tool_call", ag("ag-invoices"), "Match the invoice with its order", { toolId: "purchasing.match", input: m.input, output: m.output, sourceRefs: m.refs, attempt: 1 });
    r8.outputs = [{ label: "Matching notes", kind: "invoice", id: "inv-3", text: m.output }];
    step(r8, h0 + 0.02, "completed", ag("ag-invoices"), "Completed: 1 of 1 planned step done.", { sourceRefs: m.refs });
    r8.endedAt = at(h0 + 0.02);
    log(r8, h0 + 0.02, "agentRun.completed", "matched the invoice with its order", "ag-invoices");
  }

  // Definition history the History tab shows.
  ev.push({ at: at(-24 * 2), actorId: "p-robin", actorKind: "person", action: "agent.updated", objectType: "agent", objectId: "ag-invoices", storyKey: "agent:ag-invoices", recordIds: [],
    summary: "Changed tools on Invoice matcher (version 2): added Send email", before: { tools: "purchasing.match, finance.read, read.files" }, after: { tools: "purchasing.match, finance.read, read.files, notify.email" } });
  ev.push({ at: at(-24 * 2 + 0.01), actorId: "p-robin", actorKind: "person", action: "agent.connection_required", objectType: "agent", objectId: "ag-invoices", storyKey: "agent:ag-invoices", recordIds: [],
    summary: "Invoice matcher needs Email delivery before it can be activated" });
  ev.push({ at: at(-24 * 30), actorId: "p-robin", actorKind: "person", action: "agent.created", objectType: "agent", objectId: "ag-work", storyKey: "agent:ag-work", recordIds: [],
    summary: "Created Work coordinator under Helios (version 1)" });

  let n = 0;
  for (const e of ev) d.events.push({ id: "e-ag-" + String(++n).padStart(2, "0"), ...e });
  d.events.sort((a, b) => a.at.localeCompare(b.at));
}
