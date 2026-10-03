import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { cleanState } from "../fixtures/clean";
import { query } from "../query";
import { computeMetric, compareMetric } from "../metrics";
import { answer } from "../agent";
import { scopeOptions, viewerOf, validScope } from "../access";
import * as ops from "../ops";
import type { CoreState, Ctx, ScopeSel } from "../types";
import { addHours } from "../time";

const ctx = (viewerId: string, scope: ScopeSel = { kind: "organisation" }, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope, now });
const ok = (r: ops.Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: ops.Result) => (r.ok ? "" : r.error);

describe("scope and permissions", () => {
  const s = sampleState();
  const north: ScopeSel = { kind: "unit", id: "u-north" };

  it("a unit lead only sees their unit, everywhere the query layer is used", () => {
    const q = query(s, ctx("p-casey", north));
    expect(q.tasks().every((t) => t.teamId !== "t-c")).toBe(true);
    expect(q.requests().some((r) => r.id === "req-10")).toBe(false);
    expect(q.approvals().some((a) => a.id === "ap-10")).toBe(false);
    expect(q.records().some((r) => r.teamId === "t-c")).toBe(false);
    // Even ignoring the selected scope, permission still hides Unit South.
    expect(q.tasks({ ignoreScope: true }).some((t) => t.teamId === "t-c")).toBe(false);
    expect(q.record("r-1013")).toBeUndefined();
  });

  it("the unit lead cannot select a scope they do not oversee", () => {
    const v = viewerOf(s, "p-casey");
    const keys = scopeOptions(s, v).map((o) => o.key);
    expect(keys).toContain("unit:u-north");
    expect(keys).not.toContain("unit:u-south");
    expect(keys).not.toContain("organisation");
    expect(validScope(s, v, { kind: "unit", id: "u-south" }).changed).toBe(true);
  });

  it("restricted documents follow source permissions", () => {
    expect(query(s, ctx("p-casey", north)).file("f-access")).toBeUndefined();
    expect(query(s, ctx("p-robin")).file("f-access")).toBeDefined();
  });

  it("agent evidence never cites out-of-scope objects", () => {
    const a = answer(s, ctx("p-casey", north), "what is overdue?");
    const visible = new Set(query(s, ctx("p-casey", north)).tasks().map((t) => t.id));
    expect(a.citations.length).toBeGreaterThan(0);
    expect(a.citations.every((c) => visible.has(c.id))).toBe(true);
    expect(a.sample).toBe(true);
  });

  it("a contributor sees their teams, not the whole organisation", () => {
    const q = query(s, ctx("p-morgan", { kind: "team", id: "t-a" }));
    expect(q.tasks().every((t) => t.teamId === "t-a")).toBe(true);
    expect(scopeOptions(s, viewerOf(s, "p-morgan")).map((o) => o.key)).toEqual(["personal", "team:t-a"]);
  });

  it("clean template has one scope, so the selector can hide", () => {
    const c = cleanState();
    expect(scopeOptions(c, viewerOf(c, "p-you")).filter((o) => o.key !== "personal" && o.key !== "organisation")).toHaveLength(0);
    expect(c.data.records).toHaveLength(0);
    expect(JSON.stringify(c)).not.toMatch(/Example Organisation|Team A/);
  });
});

describe("request and approval lifecycle", () => {
  it("create, return, resubmit, approve in two stages, execute once, with one history", () => {
    let s = sampleState();
    const t0 = SAMPLE_REFERENCE;
    // Morgan (Team A) raises a correction with evidence.
    s = ok(ops.attachEvidence(s, ctx("p-morgan", { kind: "personal" }, t0), { taskId: "t-01" }, "Screenshot of source", "Shows the right value"));
    const evidence = s.data.files[s.data.files.length - 1].id;
    let r = ops.createRequest(s, ctx("p-morgan", { kind: "personal" }, t0), {
      formId: "form-correction", title: "Fix review date", teamId: "t-a",
      fields: { recordId: "r-1003", field: "reviewDate", newValue: "2026-06-30", reason: "Agreed in the review meeting" },
      evidenceFileIds: [evidence], linkedRecordIds: [], submit: true
    });
    s = ok(r);
    const reqId = (r as { id: string }).id;
    const req = () => s.data.requests.find((x) => x.id === reqId)!;
    const ap = () => s.data.approvals.find((x) => x.id === req().approvalId)!;
    expect(ap().stages.map((st) => [st.assigneeId, st.status])).toEqual([["p-jordan", "pending"], ["p-robin", "waiting"]]);

    // The requester cannot decide; Morgan also holds a delegation from Jordan for document reviews only.
    expect(err(ops.decide(s, ctx("p-morgan", { kind: "personal" }, t0), ap().id, "approve", ""))).toMatch(/raised this request/);

    // Return for changes, with a reason.
    expect(err(ops.decide(s, ctx("p-jordan", { kind: "personal" }, t0), ap().id, "return", ""))).toMatch(/reason/);
    s = ok(ops.decide(s, ctx("p-jordan", { kind: "personal" }, t0), ap().id, "return", "Use the date from the minutes"));
    expect(req().status).toBe("changes_requested");

    // Edit and resubmit: version 2, cycle 2.
    s = ok(ops.editRequest(s, ctx("p-morgan", { kind: "personal" }, addHours(t0, 1)), reqId, { newValue: "2026-07-15" }, "Date from the minutes"));
    s = ok(ops.submitRequest(s, ctx("p-morgan", { kind: "personal" }, addHours(t0, 1)), reqId));
    expect(req().version).toBe(2);
    expect(ap().cycle).toBe(2);
    expect(ap().reviewingVersion).toBe(2);

    s = ok(ops.decide(s, ctx("p-jordan", { kind: "personal" }, addHours(t0, 2)), ap().id, "approve", ""));
    expect(ap().stages[1].status).toBe("pending");
    s = ok(ops.decide(s, ctx("p-robin", { kind: "personal" }, addHours(t0, 3)), ap().id, "approve", "Fine"));
    expect(req().status).toBe("approved");
    // Decision is separate from execution.
    expect(req().execution.status).toBe("not_started");
    expect(s.data.records.find((x) => x.id === "r-1003")!.fields.reviewDate).toBeNull();

    s = ok(ops.executeRequest(s, ctx("p-morgan", { kind: "personal" }, addHours(t0, 4)), reqId));
    expect(req().execution.status).toBe("succeeded");
    expect(s.data.records.find((x) => x.id === "r-1003")!.fields.reviewDate).toBe("2026-07-15");
    const eventsAfter = s.data.events.length;
    const again = ops.executeRequest(s, ctx("p-morgan", { kind: "personal" }, addHours(t0, 5)), reqId);
    expect(again.ok && again.message).toMatch(/Nothing was repeated/);
    s = ok(again);
    expect(s.data.events.length).toBe(eventsAfter);
    expect(req().execution.appliedKeys).toHaveLength(1);

    // One history across the request, the approval and the record.
    const history = s.data.events.filter((e) => e.objectId === reqId || e.objectId === ap().id || (e.objectId === "r-1003" && e.action === "record.updated"));
    expect(history.map((e) => e.action)).toEqual(expect.arrayContaining([
      "request.created", "request.submitted", "approval.return", "request.edited", "approval.approve", "request.execution.succeeded", "record.updated"
    ]));
    // The derived missing-field issue for r-1003 has gone, so the metric moved.
    const q = query(s, ctx("p-robin"));
    expect(q.issues().some((i) => i.id === "miss:r-1003:reviewDate")).toBe(false);
  });

  it("a material edit after approval forces a renewed review", () => {
    let s = sampleState();
    s = ok(ops.decide(s, ctx("p-riley", { kind: "personal" }), "ap-3", "approve", ""));
    const before = s.data.approvals.find((a) => a.id === "ap-3")!.cycle;
    s = ok(ops.editRequest(s, ctx("p-jamie", { kind: "personal" }), "req-3", { value: 2400 }, "More cards needed"));
    const a = s.data.approvals.find((x) => x.id === "ap-3")!;
    expect(a.cycle).toBe(before + 1);
    expect(a.stages[0].status).toBe("pending");
    expect(a.policyException).toMatch(/material field changed/);
  });

  it("delegation applies only within granted rules and never to own requests", () => {
    const s = sampleState();
    // Morgan holds Jordan's delegation for document reviews, but raised req-1.
    expect(err(ops.decide(s, ctx("p-morgan", { kind: "personal" }), "ap-1", "approve", ""))).toMatch(/raised this request/);
    // The delegation does not cover internal requests.
    expect(err(ops.decide(s, ctx("p-morgan", { kind: "personal" }), "ap-11", "approve", ""))).toMatch(/with Jordan Price/);
  });

  it("losing authority blocks the decision at execution time", () => {
    let s = sampleState();
    s = ok(ops.setRoleAssignment(s, ctx("p-robin"), "p-jordan", "team_manager", { kind: "team", teamId: "t-a" }, false));
    expect(err(ops.decide(s, ctx("p-jordan", { kind: "personal" }), "ap-1", "approve", ""))).toMatch(/no longer allows|authority/);
  });

  it("self-approval is routed away from the requester", () => {
    const s = sampleState();
    const ap = s.data.approvals.find((a) => a.id === "ap-11")!;
    expect(ap.stages.map((x) => x.assigneeId)).not.toContain("p-casey");
  });

  it("an external effect without a connection fails honestly", () => {
    let s = sampleState();
    s = ok(ops.executeRequest(s, ctx("p-drew", { kind: "personal" }), "req-7"));
    const r = s.data.requests.find((x) => x.id === "req-7")!;
    expect(r.execution.status).toBe("failed");
    expect(r.execution.lastError).toMatch(/Nothing was sent/);
  });

  it("escalates an overdue decision to the configured owner", () => {
    let s = sampleState();
    expect(ops.isStageOverdue(s.data.approvals.find((a) => a.id === "ap-3")!, SAMPLE_REFERENCE)).toBe(true);
    s = ok(ops.escalate(s, ctx("p-casey", { kind: "personal" }), "ap-3"));
    const st = s.data.approvals.find((a) => a.id === "ap-3")!.stages[0];
    expect(st.assigneeId).toBe("p-robin");
    expect(st.escalatedFromId).toBe("p-riley");
  });
});

describe("tasks", () => {
  it("refuses a double claim", () => {
    let s = sampleState();
    const id = s.data.tasks.find((t) => t.title === "Check incoming documents")!.id;
    s = ok(ops.claimTask(s, ctx("p-morgan", { kind: "personal" }), id));
    expect(err(ops.claimTask(s, ctx("p-taylor", { kind: "personal" }), id))).toMatch(/Already claimed by Morgan Ellis/);
  });

  it("refuses circular dependencies and blocked completion", () => {
    const s = sampleState();
    expect(err(ops.addDependency(s, ctx("p-jordan"), "t-signoff", "t-publish"))).toMatch(/loop/);
    expect(err(ops.setTaskStatus(s, ctx("p-morgan", { kind: "personal" }), "t-publish", "done"))).toMatch(/Blocked by/);
  });

  it("recurring schedules never produce the same instance twice", () => {
    let s = sampleState();
    const c = ctx("p-riley", { kind: "personal" }, "2026-03-12T10:00:00.000Z");
    s = ok(ops.setScheduleActive(s, c, "sch-queue", true));
    s = ok(ops.runSchedule(s, c, "sch-queue"));
    const n = s.data.tasks.filter((t) => t.scheduleId === "sch-queue").length;
    s = ok(ops.runSchedule(s, c, "sch-queue"));
    expect(s.data.tasks.filter((t) => t.scheduleId === "sch-queue").length).toBe(n);
    expect(n).toBe(1);
    // The monthly access review already produced March: no duplicate.
    const r = ops.runSchedule(s, ctx("p-jordan", { kind: "personal" }), "sch-access");
    expect(r.ok && r.message).toMatch(/No duplicate/);
  });
});

describe("workflow recovery", () => {
  it("recovering a failed run never repeats completed effects", () => {
    let s = sampleState();
    const c = ctx("p-robin");
    expect(ops.retryRun(s, c, "run-3").ok && s.data.runs.find((r) => r.id === "run-3")!.status).toBe("failed");
    s = ok(ops.retryRun(s, c, "run-3"));
    expect(s.data.runs.find((r) => r.id === "run-3")!.status).toBe("failed");
    s = ok(ops.assignRun(s, c, "run-3", "p-riley"));
    const tasksBefore = s.data.tasks.length;
    s = ok(ops.retryRun(s, c, "run-3"));
    const run = s.data.runs.find((r) => r.id === "run-3")!;
    expect(run.status).toBe("completed");
    expect(s.data.tasks.length).toBe(tasksBefore + 1);
    expect(run.appliedEffects.filter((e) => e.key === "run-3:s-open")).toHaveLength(1);
    const again = ops.retryRun(s, c, "run-3");
    s = ok(again);
    expect(s.data.tasks.length).toBe(tasksBefore + 1);
    expect(again.ok && again.message).toMatch(/Nothing to retry/);
  });

  it("pausing a schedule is different from pausing a case", () => {
    let s = sampleState();
    const c = ctx("p-robin");
    const r = ops.setScheduleActive(s, c, "sch-weekly-check", false);
    s = ok(r);
    expect(r.ok && r.message).toMatch(/Runs already in progress are not affected/);
    expect(s.data.runs.find((x) => x.id === "run-1")!.status).toBe("awaiting_approval");
    const p = ops.pauseRun(s, c, "run-1", true, "Waiting on figures");
    expect(p.ok && p.message).toMatch(/schedule that started it keeps running/);
  });
});

describe("metrics", () => {
  const s = sampleState();

  it("ratios aggregate from totals, not from averaged percentages", () => {
    const c = ctx("p-robin");
    const org = computeMetric(s, c, "ontime")!;
    const units = compareMetric(s, c, "ontime", "unit");
    const num = units.reduce((n, u) => n + (u.result.numerator || 0), 0);
    const den = units.reduce((n, u) => n + (u.result.denominator || 0), 0);
    expect(org.numerator).toBe(num);
    expect(org.denominator).toBe(den);
    expect(org.value).toBeCloseTo((100 * num) / den, 6);
    const avg = units.reduce((n, u) => n + (u.result.value || 0), 0) / units.length;
    expect(Math.abs(avg - (org.value || 0))).toBeGreaterThan(0.01);
  });

  it("drill-down ids are exactly the KPI's records for the scope", () => {
    const c = ctx("p-casey", { kind: "unit", id: "u-north" });
    const m = computeMetric(s, c, "overdue")!;
    const expected = query(s, c).tasks().filter((t) => query(s, c).isOverdue(t)).map((t) => t.id).sort();
    expect([...m.ids].sort()).toEqual(expected);
    expect(m.value).toBe(expected.length);
  });

  it("flags partial and stale data instead of presenting it as complete", () => {
    const south = computeMetric(s, ctx("p-robin", { kind: "unit", id: "u-south" }), "completeness")!;
    expect(south.partial).toBe(true);
    expect(south.missing.length).toBeGreaterThan(0);
    const north = computeMetric(s, ctx("p-robin", { kind: "unit", id: "u-north" }), "completeness")!;
    expect(north.partial).toBe(false);
  });

  it("missing data is not zero", () => {
    const c = cleanState();
    const m = computeMetric(c, { viewerId: "p-you", scope: { kind: "organisation" }, now: SAMPLE_REFERENCE }, "ontime")!;
    expect(m.value).toBeNull();
    expect(m.display).toBe("No data");
  });

  it("resolving a data issue moves the issue count and completeness together", () => {
    let st = sampleState();
    const c = ctx("p-robin");
    const before = computeMetric(st, c, "issues")!.value!;
    const compBefore = computeMetric(st, c, "completeness")!.value!;
    st = ok(ops.mapCode(st, c, "iss-unmapped", "operational"));
    expect(computeMetric(st, c, "issues")!.value).toBe(before - 1);
    expect(computeMetric(st, c, "completeness")!.value!).toBeGreaterThan(compBefore);
    expect(st.data.events.some((e) => e.summary.includes("Mapped source code X-17"))).toBe(true);
  });
});

describe("data quality", () => {
  it("resolves a conflict with comparison values and keeps a Pulse correction pending source review", () => {
    let s = sampleState();
    s = ok(ops.resolveConflict(s, ctx("p-riley", { kind: "team", id: "t-b" }), "iss-conflict", "pulse", "Confirmed by phone"));
    const r = s.data.records.find((x) => x.id === "r-1005")!;
    expect(r.fieldMeta.contactEmail.pendingSourceReview).toBe(true);
    expect(s.data.issues.find((i) => i.id === "iss-conflict")!.state).toBe("resolved");
  });

  it("merges duplicates, keeps source references, and can undo", () => {
    let s = sampleState();
    const c = ctx("p-robin");
    const preview = ops.mergePreview(s, "o-01", "o-04")!;
    expect(preview.fieldDiffs.length).toBeGreaterThanOrEqual(0);
    expect(err(ops.mergeRecords(s, ctx("p-casey", { kind: "personal" }), "iss-dup", "o-01", "Same organisation"))).toMatch(/merge permission/);
    s = ok(ops.mergeRecords(s, c, "iss-dup", "o-01", "Same organisation"));
    expect(s.data.records.find((x) => x.id === "o-04")!.mergedInto).toBe("o-01");
    expect(query(s, c).records().some((x) => x.id === "o-04")).toBe(false);
    s = ok(ops.unmergeRecord(s, c, "o-04"));
    expect(s.data.records.find((x) => x.id === "o-04")!.mergedInto).toBeUndefined();
    expect(s.data.issues.find((i) => i.id === "iss-dup")!.state).toBe("open");
  });
});

describe("views and reports", () => {
  it("sharing a view stores filters only and never widens access", () => {
    let s = sampleState();
    s = ok(ops.saveView(s, ctx("p-robin"), { page: "tasks", name: "All overdue", shared: true, teamId: "t-a", state: { filters: { status: "overdue" } } }));
    // Morgan opening the shared view still gets only rows Morgan may see.
    const morgan = query(s, ctx("p-morgan", { kind: "organisation" }));
    expect(morgan.tasks().some((t) => t.teamId === "t-c")).toBe(false);
  });

  it("report recipients must be able to see the scope", () => {
    const s = sampleState();
    const r = ops.createReportSchedule(s, ctx("p-casey", { kind: "unit", id: "u-north" }), "overview", "Weekly", ["p-quinn"]);
    expect(err(r)).toMatch(/cannot see this scope/);
  });
});

describe("audit trail", () => {
  it("records the acting person when no explicit actor is given", () => {
    const s = ok(ops.createRequest(sampleState(), ctx("p-morgan", { kind: "personal" }), {
      formId: "form-internal", title: "Chairs", teamId: "t-a", fields: { description: "Two chairs", neededBy: "2026-04-01", value: 100 },
      evidenceFileIds: [], linkedRecordIds: [], submit: true
    }));
    const created = s.data.events.find((e) => e.action === "request.created" && e.summary.includes("Chairs"))!;
    expect(created.actorId).toBe("p-morgan");
    expect(created.actorKind).toBe("person");
  });
});

describe("people", () => {
  it("employment details are visible to self, managers in scope and admins only", async () => {
    const { personRows } = await import("../people");
    const s = sampleState();
    const morgan = personRows(query(s, ctx("p-morgan", { kind: "team", id: "t-a" })), { ignoreScope: true }).map((r) => r.person.id);
    expect(morgan).toEqual(["p-morgan"]);
    const casey = personRows(query(s, ctx("p-casey", { kind: "unit", id: "u-north" }))).map((r) => r.person.id);
    expect(casey).toContain("p-jamie");
    expect(casey).not.toContain("p-quinn");
    expect(personRows(query(s, ctx("p-robin"))).length).toBe(11);
  });

  it("certificate renewals and checklists are never duplicated", () => {
    let s = sampleState();
    const c = ctx("p-avery", { kind: "team", id: "t-c" });
    s = ok(ops.bookRenewal(s, c, "p-drew", "c-data-protection"));
    const n = s.data.tasks.length;
    const again = ops.bookRenewal(s, c, "p-drew", "c-data-protection");
    expect(again.ok && again.message).toMatch(/Nothing was duplicated/);
    s = ok(again);
    expect(s.data.tasks.length).toBe(n);
    s = ok(ops.startChecklist(s, ctx("p-riley", { kind: "team", id: "t-b" }), "p-sam", "onboarding"));
    const m = s.data.tasks.length;
    s = ok(ops.startChecklist(s, ctx("p-riley", { kind: "team", id: "t-b" }), "p-sam", "onboarding"));
    expect(s.data.tasks.length).toBe(m);
    expect(err(ops.bookRenewal(s, ctx("p-morgan", { kind: "personal" }), "p-drew", "c-data-protection"))).toMatch(/manager/);
  });

  it("leave is a normal request: approved by the team manager, then recorded once", () => {
    let s = sampleState();
    const r = ops.createRequest(s, ctx("p-morgan", { kind: "personal" }), { formId: "form-leave", title: "Leave in April", teamId: "t-a",
      fields: { kind: "annual", from: "2026-04-06", to: "2026-04-10", note: null }, evidenceFileIds: [], linkedRecordIds: [], submit: true });
    s = ok(r);
    const req = s.data.requests.find((x) => x.title === "Leave in April")!;
    s = ok(ops.decide(s, ctx("p-jordan", { kind: "personal" }), req.approvalId!, "approve", ""));
    s = ok(ops.executeRequest(s, ctx("p-morgan", { kind: "personal" }), req.id));
    s = ok(ops.executeRequest(s, ctx("p-morgan", { kind: "personal" }), req.id));
    expect(s.data.leave.filter((l) => l.requestId === req.id)).toHaveLength(1);
  });
});

describe("recurring work", () => {
  it("creates a schedule and produces each occurrence once", () => {
    let s = sampleState();
    const c = ctx("p-jordan", { kind: "team", id: "t-a" }, "2026-03-12T10:00:00.000Z");
    const r = ops.createSchedule(s, c, { label: "Daily check", teamId: "t-a", cadence: { every: "day", hour: 9, minute: 0 },
      task: { title: "Daily check", priority: "normal", checklist: [], dueInHours: 4 } });
    s = ok(r);
    const id = (r as { id: string }).id;
    s = ok(ops.runSchedule(s, c, id));
    s = ok(ops.runSchedule(s, c, id));
    expect(s.data.tasks.filter((t) => t.scheduleId === id)).toHaveLength(1);
    expect(err(ops.createSchedule(sampleState(), ctx("p-morgan", { kind: "personal" }), { label: "x", cadence: { every: "day", hour: 9, minute: 0 },
      task: { title: "x", priority: "normal", checklist: [], dueInHours: 1 } }))).toMatch(/manager/);
  });
});
