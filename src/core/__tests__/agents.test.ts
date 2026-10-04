import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { cleanState } from "../fixtures/clean";
import * as ops from "../ops";
import {
  agentAttention, agentState, archiveAgent, childrenOf, createAgent, moveAgent, moveImpact, requestStop, retryRun, runById,
  saveWorkerAsAgent, setAvailability, startRun, testRun, updateAgent, agentReadiness, AGENT_ACTION_FORM
} from "../orchestration";
import { query } from "../query";
import type { CoreState, Ctx, ScopeSel } from "../types";

const ctx = (viewerId: string, scope: ScopeSel = { kind: "organisation" }, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope, now });
const ok = (r: ops.Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: ops.Result) => (r.ok ? "" : r.error);
const agent = (s: CoreState, id: string) => s.config.agents.find((a) => a.id === id)!;
const NORTH: ScopeSel = { kind: "unit", id: "u-north" };

describe("sample organisation", () => {
  const s = sampleState();
  it("has eight saved agents, a Helios root, a nested branch and an independent root", () => {
    expect(s.config.agents.length).toBe(8);
    expect(agent(s, "ag-helios").coordinatorId).toBeNull();
    expect(childrenOf(s, "ag-work").map((a) => a.id).sort()).toEqual(["ag-intake", "ag-steward"]);
    expect(agent(s, "ag-work").coordinatorId).toBe("ag-helios");
    expect(agent(s, "ag-invoices").coordinatorId).toBeNull();
    expect(agent(s, "ag-invoices").availability).toBe("connection_required");
  });
  it("seeds the four run scenarios with resolvable evidence", () => {
    expect(runById(s, "run-1")!.childRunIds).toEqual(["run-2", "run-3"]);
    expect(runById(s, "run-1")!.outputs[0].label).toBe("Combined outcome");
    expect(runById(s, "run-4")!.workers).toHaveLength(1);
    expect(runById(s, "run-6")!.state).toBe("waiting_approval");
    expect(s.data.requests.find((r) => r.id === "req-ag-1")!.fields.agentRunId).toBe("run-6");
    expect(runById(s, "run-7")!.state).toBe("failed");
    for (const r of s.data.agentRuns) for (const st of r.steps) for (const ref of st.sourceRefs) {
      const list = { record: s.data.records, task: s.data.tasks, file: s.data.files, request: s.data.requests, approval: s.data.approvals, project: s.data.projects,
        invoice: s.data.invoices, issue: s.data.issues, obligation: s.data.obligations }[ref.kind] as { id: string }[];
      expect(list.some((x) => x.id === ref.id), ref.kind + " " + ref.id).toBe(true);
    }
  });
  it("Home and Activity can read waiting approvals and failures with an owner and next action", () => {
    const items = agentAttention(query(s, ctx("p-casey", NORTH)));
    const wait = items.find((i) => i.runId === "run-6")!;
    expect(wait.kind).toBe("waiting_approval");
    expect(wait.ownerId).toBe("p-casey");
    expect(wait.nextAction).toContain("REQ-290");
    expect(items.some((i) => i.runId === "run-7" && i.kind === "failed")).toBe(true);
    expect(agentState(query(s, ctx("p-casey", NORTH)), "ag-steward").waitingApproval).toBe(1);
  });
  it("clean mode has no agents or runs", () => {
    const c = cleanState();
    expect(c.config.agents).toHaveLength(0);
    expect(c.data.agentRuns).toHaveLength(0);
  });
});

describe("organisation chart", () => {
  it("rejects cycles and self-parenting", () => {
    const s = sampleState();
    expect(err(moveAgent(s, ctx("p-robin"), "ag-helios", "ag-steward"))).toMatch(/loop/);
    expect(err(moveAgent(s, ctx("p-robin"), "ag-work", "ag-work"))).toMatch(/itself/);
    expect(moveImpact(s, "ag-work", "ag-intake").ok).toBe(false);
  });

  it("a move never widens scope or tools and leaves runs in progress alone", () => {
    const s = sampleState();
    const before = structuredClone(agent(s, "ag-steward"));
    const runsBefore = JSON.stringify(s.data.agentRuns);
    const imp = moveImpact(s, "ag-steward", "ag-helios");
    expect(imp.ok).toBe(true);
    expect(imp.inFlight.map((r) => r.id)).toContain("run-6");
    const s2 = ok(moveAgent(s, ctx("p-robin"), "ag-steward", "ag-helios"));
    const after = agent(s2, "ag-steward");
    expect(after.coordinatorId).toBe("ag-helios");
    expect(after.tools).toEqual(before.tools);
    expect(after.scope).toEqual(before.scope);
    expect(after.approvalRequired).toEqual(before.approvalRequired);
    expect(JSON.stringify(s2.data.agentRuns)).toBe(runsBefore);
  });

  it("only people who manage agents can change the chart", () => {
    const s = sampleState();
    expect(err(moveAgent(s, ctx("p-casey"), "ag-steward", "ag-helios"))).toMatch(/Manage agents/);
  });

  it("creating an agent persists it as a draft in the chart, and activation needs a passed test", () => {
    const s = sampleState();
    const res = createAgent(s, ctx("p-robin"), { name: "Follow-up checker", purpose: "Checks open project tasks.", responsibleId: "p-casey", coordinatorId: "ag-helios",
      scope: { teamIds: ["t-a"] }, tools: ["read.work"], templateId: "tpl-project" });
    const s2 = ok(res);
    const id = res.ok ? res.id! : "";
    const reloaded = JSON.parse(JSON.stringify(s2)) as CoreState;
    expect(agent(reloaded, id).availability).toBe("draft");
    expect(childrenOf(reloaded, "ag-helios").some((a) => a.id === id)).toBe(true);
    expect(err(setAvailability(s2, ctx("p-robin"), id, "ready"))).toMatch(/test run/i);
    const s3 = ok(testRun(s2, ctx("p-robin"), id, { goal: "Check Workspace upgrade", inputs: [{ kind: "project", id: "pr-ws" }] }));
    const test = s3.data.agentRuns.find((r) => r.agentId === id && r.test)!;
    expect(test.state).toBe("completed");
    expect(s3.data.tasks.length).toBe(s2.data.tasks.length);
    const s4 = ok(setAvailability(s3, ctx("p-robin"), id, "ready"));
    expect(agent(s4, id).availability).toBe("ready");
  });

  it("an agent needing a missing connection becomes Connection required with the exact connection named", () => {
    const s = sampleState();
    const res = createAgent(s, ctx("p-robin"), { name: "Mailer", purpose: "Emails summaries.", responsibleId: "p-robin", scope: { teamIds: "all" }, tools: ["read.work", "notify.email"] });
    const id = res.ok ? res.id! : "";
    const s2 = ok(testRun(ok(res), ctx("p-robin"), id, { goal: "Send a summary" }));
    const r = setAvailability(s2, ctx("p-robin"), id, "ready");
    expect(r.ok && r.message).toMatch(/Email delivery/);
    expect(agent(ok(r), id).availability).toBe("connection_required");
    expect(agentReadiness(ok(r), agent(ok(r), id)).connections.map((c) => c.id)).toEqual(["s-email"]);
  });

  it("rejects secrets in instructions", () => {
    const s = sampleState();
    expect(err(createAgent(s, ctx("p-robin"), { name: "Leaky", purpose: "x", responsibleId: "p-robin", scope: { teamIds: "all" }, tools: ["read.work"], instructions: "api_key: abc123" }))).toMatch(/keys/);
  });

  it("archiving keeps history and refuses while runs are in progress", () => {
    const s = sampleState();
    expect(err(archiveAgent(s, ctx("p-robin"), "ag-steward"))).toMatch(/in progress/);
    const s2 = ok(archiveAgent(s, ctx("p-robin"), "ag-docs"));
    expect(agent(s2, "ag-docs").archived).toBe(true);
    expect(s2.data.agentRuns.some((r) => r.agentId === "ag-docs")).toBe(true);
  });
});

describe("runs", () => {
  it("a coordinator run delegates to two capability agents and combines their outputs", () => {
    const s = sampleState();
    const res = startRun(s, ctx("p-casey", NORTH), "ag-helios", { goal: "Weekly status for Unit North", inputs: [{ kind: "project", id: "pr-ws" }], idempotencyKey: "t1" });
    const s2 = ok(res);
    const run = runById(s2, res.ok ? res.id! : "")!;
    expect(run.state).toBe("completed");
    expect(run.childRunIds).toHaveLength(2);
    const kids = run.childRunIds.map((id) => runById(s2, id)!);
    expect(kids.map((k) => k.agentId).sort()).toEqual(["ag-briefing", "ag-projects"]);
    expect(kids.every((k) => k.state === "completed" && k.parentRunId === run.id && k.depth === 1)).toBe(true);
    expect(kids.every((k) => k.scopeTeamIds !== "all" && k.scopeTeamIds.every((t) => ["t-a", "t-b"].includes(t)))).toBe(true);
    expect(run.outputs[0].label).toBe("Combined outcome");
    expect(run.outputs.filter((o) => o.kind === "agentRun").map((o) => o.id).sort()).toEqual([...run.childRunIds].sort());
    expect(run.steps[run.steps.length - 1].sourceRefs.length).toBeGreaterThan(0);
    expect(run.simulated).toBe(true);
    expect(run.usage?.reported).toBe(false);
  });

  it("a child never holds a tool its parent run does not hold", () => {
    const s = sampleState();
    const res = startRun(s, ctx("p-casey", NORTH), "ag-helios", { goal: "Project status", inputs: [{ kind: "project", id: "pr-ws" }], idempotencyKey: "t2" });
    const s2 = ok(res);
    const run = runById(s2, res.ok ? res.id! : "")!;
    const pm = run.childRunIds.map((id) => runById(s2, id)!).find((k) => k.agentId === "ag-projects")!;
    expect(pm.snapshot!.tools).not.toContain("project.milestone");
    expect(pm.snapshot!.tools.every((t) => run.snapshot!.tools.includes(t))).toBe(true);
  });

  it("spawning respects the worker limit and gives workers the intersection of authority", () => {
    let s = sampleState();
    s = ok(updateAgent(s, ctx("p-robin"), "ag-docs", { spawn: { enabled: true, templateIds: ["tpl-docreview"], maxWorkers: 1 } }));
    const res = startRun(s, ctx("p-casey", NORTH), "ag-docs", { goal: "Pre-check evidence",
      inputs: [{ kind: "obligation", id: "ob-doc-signoff" }, { kind: "obligation", id: "ob-doc-dpia" }, { kind: "obligation", id: "ob-svc-dpia" }], idempotencyKey: "t3" });
    const s2 = ok(res);
    const run = runById(s2, res.ok ? res.id! : "")!;
    expect(run.workers).toHaveLength(1);
    const skipped = run.plan!.filter((p) => p.kind === "spawn" && p.status === "skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0].note).toMatch(/worker limit/);
    const w = run.workers[0];
    expect(w.tools.every((t) => run.snapshot!.tools.includes(t))).toBe(true);
    expect(w.tools.some((t) => s2.config.agentTools.find((x) => x.id === t)!.restricted)).toBe(false);
    expect(w.scopeTeamIds).toEqual(run.scopeTeamIds);
    expect(w.state).toBe("completed");
    expect(s2.config.agents.some((a) => a.id === w.id)).toBe(false);
    // Saving the worker as an agent is explicit and creates a draft only.
    const saved = saveWorkerAsAgent(s2, ctx("p-robin"), run.id, w.id, "Evidence pre-checker");
    expect(agent(ok(saved), saved.ok ? saved.id! : "").availability).toBe("draft");
  });

  it("delegation stops at the depth limit", () => {
    let s = sampleState();
    s = ok(updateAgent(s, ctx("p-robin"), "ag-helios", { limits: { maxDepth: 1, maxChildren: 3, maxConcurrentRuns: 2, maxMinutes: 15 } }));
    const res = startRun(s, ctx("p-jordan", { kind: "team", id: "t-a" }), "ag-helios", { goal: "Clear the data gaps in Team A", idempotencyKey: "t4" });
    const s2 = ok(res);
    const run = runById(s2, res.ok ? res.id! : "")!;
    const wc = run.childRunIds.map((id) => runById(s2, id)!).find((k) => k.agentId === "ag-work")!;
    expect(wc.childRunIds).toHaveLength(0);
    expect(wc.plan!.some((p) => p.status === "skipped" && /depth limit/.test(p.note || ""))).toBe(true);
  });

  it("a restricted action raises one approval request, runs once after approval, and an agent cannot approve", () => {
    const s = sampleState();
    expect(err(ops.decide(s, ctx("ag-steward"), "ap-ag-1", "approve", ""))).toMatch(/Agents never approve/);
    expect(err(ops.decide(s, ctx("ag-helios"), "ap-ag-1", "approve", ""))).toMatch(/Agents never approve/);
    // The same proposal again links to the waiting request instead of raising another.
    const again = ok(startRun(s, ctx("p-jordan", { kind: "team", id: "t-a" }), "ag-steward", { goal: "Fill missing review dates", inputs: [{ kind: "record", id: "r-1003" }], idempotencyKey: "t5" }));
    expect(again.data.requests.filter((r) => r.formId === AGENT_ACTION_FORM)).toHaveLength(1);

    const s2 = ok(ops.decide(s, ctx("p-casey"), "ap-ag-1", "approve", ""));
    expect(runById(s2, "run-6")!.state).toBe("waiting_input");
    expect(s2.data.records.find((r) => r.id === "r-1003")!.fields.reviewDate).toBeNull();
    const steps = runById(s2, "run-6")!.steps.map((x) => x.kind);
    expect(steps).toContain("approved");
    expect(steps).not.toContain("executed");

    const s3 = ok(ops.executeRequest(s2, ctx("p-casey"), "req-ag-1"));
    expect(s3.data.records.find((r) => r.id === "r-1003")!.fields.reviewDate).toBe("2026-03-09");
    expect(runById(s3, "run-6")!.state).toBe("completed");
    expect(runById(s3, "run-5")!.state).toBe("completed");
    expect(runById(s3, "run-6")!.appliedEffects).toHaveLength(1);
    const s4 = ok(ops.executeRequest(s3, ctx("p-casey"), "req-ag-1"));
    expect(runById(s4, "run-6")!.appliedEffects).toHaveLength(1);
    expect(s4.data.events.filter((e) => e.action === "record.updated" && e.objectId === "r-1003").length).toBe(1);
  });

  it("a declined action is not carried out and the run finishes without it", () => {
    const s = sampleState();
    expect(err(ops.decide(s, ctx("p-casey"), "ap-ag-1", "decline", ""))).toMatch(/reason/);
    const s2 = ok(ops.decide(s, ctx("p-casey"), "ap-ag-1", "decline", "The procedure date is not the record's review date."));
    const run = runById(s2, "run-6")!;
    expect(run.state).toBe("completed");
    expect(run.plan!.find((p) => p.kind === "action")!.status).toBe("skipped");
    expect(run.appliedEffects).toHaveLength(0);
    expect(s2.data.records.find((r) => r.id === "r-1003")!.fields.reviewDate).toBeNull();
    const ex = ops.executeRequest(s2, ctx("p-casey"), "req-ag-1");
    expect(ex.ok).toBe(false);
  });

  it("a paused agent starts nothing and is not delegated to", () => {
    const s = ok(setAvailability(sampleState(), ctx("p-robin"), "ag-briefing", "paused"));
    const n = s.data.agentRuns.filter((r) => r.agentId === "ag-briefing").length;
    expect(err(startRun(s, ctx("p-casey", NORTH), "ag-briefing", { goal: "Weekly briefing" }))).toMatch(/paused/);
    const s2 = ok(startRun(s, ctx("p-casey", NORTH), "ag-helios", { goal: "Weekly status for Unit North", idempotencyKey: "t6" }));
    expect(s2.data.agentRuns.filter((r) => r.agentId === "ag-briefing").length).toBe(n);
  });

  it("stopping waits for a safe checkpoint and is not shown as done before it is acknowledged", () => {
    const s = ok(requestStop(sampleState(), ctx("p-jordan"), "run-5"));
    expect(runById(s, "run-5")!.state).toBe("stop_requested");
    expect(runById(s, "run-6")!.state).toBe("stop_requested");
    const s2 = ok(ops.decide(s, ctx("p-casey"), "ap-ag-1", "approve", ""));
    expect(runById(s2, "run-6")!.state).toBe("cancelled");
    expect(runById(s2, "run-5")!.state).toBe("cancelled");
    const ex = ops.executeRequest(s2, ctx("p-casey"), "req-ag-1");
    expect(ex.ok && ex.state.data.requests.find((r) => r.id === "req-ag-1")!.execution.status).toBe("failed");
    expect(s2.data.records.find((r) => r.id === "r-1003")!.fields.reviewDate).toBeNull();
  });

  it("retry runs only the failed step and never repeats an applied effect", () => {
    const s = sampleState();
    const tasksBefore = s.data.tasks.filter((t) => t.origin?.id === "run-7").length;
    const s2 = ok(retryRun(s, ctx("p-casey"), "run-7"));
    const run = runById(s2, "run-7")!;
    expect(run.state).toBe("completed");
    expect(s2.data.tasks.filter((t) => t.origin?.id === "run-7").length).toBe(tasksBefore);
    expect(run.appliedEffects).toHaveLength(1);
    expect(run.plan!.filter((p) => p.attempts > 1).map((p) => p.toolId)).toEqual(["project.update"]);
    expect(run.steps.some((x) => x.kind === "retried")).toBe(true);
  });

  it("the same idempotency key returns the existing run", () => {
    const s = sampleState();
    const a = startRun(s, ctx("p-casey", NORTH), "ag-helios", { goal: "Weekly status", idempotencyKey: "same" });
    const s2 = ok(a);
    const b = startRun(s2, ctx("p-casey", NORTH), "ag-helios", { goal: "Weekly status", idempotencyKey: "same" });
    expect(b.ok && b.id).toBe(a.ok && a.id);
    expect(ok(b).data.agentRuns.length).toBe(s2.data.agentRuns.length);
  });

  it("starting a run needs the permission and a ready agent", () => {
    const s = sampleState();
    expect(err(startRun(s, ctx("p-morgan"), "ag-helios", { goal: "Anything" }))).toMatch(/Start agent runs/);
    expect(err(startRun(s, ctx("p-robin"), "ag-invoices", { goal: "Match" }))).toMatch(/Email delivery/);
  });
});

describe("one approval shared by two runs", () => {
  it("resumes every run waiting on the request and applies the effect once", () => {
    let s = sampleState();
    // A Helios run reaches the Data steward, which proposes the same action already waiting in REQ-290.
    s = ok(startRun(s, ctx("p-casey", NORTH), "ag-helios", { goal: "Weekly status for Unit North with project risks and overdue work", inputs: [], idempotencyKey: "t-shared" }));
    const waiting = s.data.agentRuns.filter((r) => r.plan?.some((i) => i.requestId === "req-ag-1" && i.status === "waiting"));
    expect(waiting.length).toBeGreaterThanOrEqual(2);
    expect(s.data.requests.filter((r) => r.formId === AGENT_ACTION_FORM && r.status === "submitted").length).toBe(1);
    const ap = s.data.approvals.find((a) => a.requestId === "req-ag-1")!;
    s = ok(ops.decide(s, ctx("p-casey"), ap.id, "approve", ""));
    s = ok(ops.executeRequest(s, ctx("p-casey"), "req-ag-1"));
    for (const w of waiting) {
      const run = runById(s, w.id)!;
      expect(run.plan!.find((i) => i.requestId === "req-ag-1")!.status).toBe("done");
      expect(run.state).not.toBe("waiting_approval");
    }
    const applied = s.data.agentRuns.flatMap((r) => r.appliedEffects).filter((e) => e.description.includes("REC-1003"));
    expect(applied).toHaveLength(1);
  });
});
