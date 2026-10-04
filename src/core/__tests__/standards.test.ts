import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { query } from "../query";
import { computeMetric } from "../metrics";
import * as ops from "../ops";
import {
  acknowledgePolicy, completeCheck, ensureObligations, gateState, obligationView, policyProgress, raiseRenewals, readiness,
  receiveEvidence, runDueChecks, startReview, attachEvidenceFile, untrackedKey
} from "../standards";
import type { CoreState, Ctx } from "../types";
import { addDays } from "../time";

const ctx = (viewerId: string, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope: { kind: "organisation" }, now });
const ok = (r: ops.Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: ops.Result) => (r.ok ? "" : r.error);
const GATE = ["ob-doc-signoff", "ob-doc-dpia"];
const stateOf = (s: CoreState, key: string, now = SAMPLE_REFERENCE) => obligationView(s, key, now)?.state;

/** Start the sign-off review as the unit lead and return the state with the request id. */
function started() {
  const s0 = sampleState();
  const res = startReview(s0, ctx("p-casey"), "ob-doc-signoff");
  const s = ok(res);
  return { s, requestId: res.ok ? res.id! : "" };
}

describe("standards: receiving is not accepting", () => {
  it("the sample sign-off file is received, not approved, and the gate stays closed", () => {
    const s = sampleState();
    expect(stateOf(s, "ob-doc-signoff")).toBe("received");
    expect(stateOf(s, "ob-doc-dpia")).toBe("approved");
    const g = gateState(s, SAMPLE_REFERENCE, GATE);
    expect(g.satisfied).toBe(false);
    expect(g.waiting.map((w) => w.obligationId)).toEqual(["ob-doc-signoff"]);
    const m = computeMetric(s, ctx("p-robin"), "requirementsApproved")!;
    expect(m.ids).toContain("ob-doc-signoff");
    expect(m.numerator).toBeLessThan(m.denominator!);
  });

  it("receiving evidence records the exact file version and never approves it", () => {
    const s0 = sampleState();
    const s = ok(receiveEvidence(s0, ctx("p-jordan"), "ob-svc-dpia", "f-service"));
    const o = s.data.obligations.find((x) => x.id === "ob-svc-dpia")!;
    expect(o.state).toBe("received");
    expect(o.evidence).toMatchObject({ fileId: "f-service", version: 2, receivedBy: "p-jordan" });
    expect(o.decidedAt).toBeUndefined();
    expect(s.data.events.some((e) => e.storyKey === "obligation:ob-svc-dpia" && e.action === "obligation.received")).toBe(true);
  });

  it("an untracked subject gets its row when evidence arrives, and a new sample file is created once", () => {
    const s0 = sampleState();
    // Apply the induction-free location requirement to a location with no row by removing it first.
    s0.data.obligations = s0.data.obligations.filter((o) => o.id !== "ob-fire-north");
    const key = untrackedKey("rq-firecheck", "location", "loc-north");
    expect(stateOf(s0, key)).toBe("missing");
    const files = s0.data.files.length;
    const s = ok(attachEvidenceFile(s0, ctx("p-casey"), key, "Inspection report 2026", "New annual report"));
    expect(s.data.files.length).toBe(files + 1);
    const o = s.data.obligations.find((x) => x.requirementId === "rq-firecheck" && x.subject.id === "loc-north")!;
    expect(o.state).toBe("received");
    expect(o.evidence?.version).toBe(1);
  });

  it("someone with no link to the subject cannot record evidence", () => {
    const s = sampleState();
    expect(err(receiveEvidence(s, ctx("p-drew"), "ob-svc-dpia", "f-service"))).toMatch(/Only the owner/);
  });

  it("ensureObligations is idempotent", () => {
    const s0 = sampleState();
    s0.data.obligations = s0.data.obligations.filter((o) => o.id !== "ob-svc-dpia");
    const s1 = ok(ensureObligations(s0, ctx("p-robin")));
    expect(s1.data.obligations.filter((o) => o.requirementId === "rq-dpia" && o.subject.id === "pr-svc")).toHaveLength(1);
    const again = ensureObligations(s1, ctx("p-robin"));
    expect(again.ok && again.state).toBe(s1);
  });
});

describe("standards: one canonical review", () => {
  it("starting a review creates one request in Work, routed to a reviewer who is not the requester", () => {
    const s0 = sampleState();
    const before = s0.data.requests.length;
    const { s, requestId } = started();
    expect(s.data.requests.length).toBe(before + 1);
    const r = s.data.requests.find((x) => x.id === requestId)!;
    expect(r.formId).toBe("form-evidence-review");
    expect(r.status).toBe("submitted");
    expect(r.fields).toMatchObject({ obligationId: "ob-doc-signoff", fileId: "f-doc-signoff", version: 2 });
    const a = s.data.approvals.find((x) => x.id === r.approvalId)!;
    const stage = a.stages.find((x) => x.status === "pending")!;
    expect(stage.assigneeId).toBeTruthy();
    expect(stage.assigneeId).not.toBe("p-casey");
    expect(stateOf(s, "ob-doc-signoff")).toBe("under_review");
    // Still not accepted: the gate is closed.
    expect(gateState(s, SAMPLE_REFERENCE, GATE).satisfied).toBe(false);
  });

  it("starting it again does not duplicate the request", () => {
    const { s, requestId } = started();
    const n = s.data.requests.length;
    const again = startReview(s, ctx("p-robin"), "ob-doc-signoff");
    expect(again.ok).toBe(true);
    expect(again.ok && again.id).toBe(requestId);
    expect(again.ok && again.state.data.requests.length).toBe(n);
  });

  it("approving is the decision; running the approved action accepts the evidence, updates readiness and releases the gate", () => {
    const { s, requestId } = started();
    const r = s.data.requests.find((x) => x.id === requestId)!;
    const a = s.data.approvals.find((x) => x.id === r.approvalId)!;
    const reviewer = a.stages.find((x) => x.status === "pending")!.assigneeId!;
    const s1 = ok(ops.decide(s, ctx(reviewer), a.id, "approve", "All three signatures present."));
    // Decision recorded, acceptance not applied yet.
    expect(stateOf(s1, "ob-doc-signoff")).toBe("under_review");
    expect(gateState(s1, SAMPLE_REFERENCE, GATE).satisfied).toBe(false);
    const s2 = ok(ops.executeRequest(s1, ctx("p-casey"), requestId));
    const o = s2.data.obligations.find((x) => x.id === "ob-doc-signoff")!;
    expect(o.state).toBe("approved");
    expect(o.decidedBy).toBe(reviewer);
    expect(gateState(s2, SAMPLE_REFERENCE, GATE).satisfied).toBe(true);
    const ms2 = s2.data.milestones.find((m) => m.id === "ms-doc-2");
    if (ms2?.gate) expect(ms2.gate.obligationIds.every((id) => stateOf(s2, id) === "approved")).toBe(true);
    // Readiness reads the same state.
    const group = readiness(query(s2, ctx("p-robin"))).find((g) => g.kind === "project");
    const row = group?.rows.find((x) => x.subject.id === "pr-doc");
    if (row) {
      const i = group!.requirements.findIndex((q) => q.id === "rq-signoff");
      expect(row.cells[i]?.state).toBe("approved");
    }
    // Running it again repeats nothing.
    const again = ops.executeRequest(s2, ctx("p-casey"), requestId);
    expect(again.ok && again.state).toBe(s2);
  });

  it("acceptance refuses when different evidence arrived after the review started", () => {
    const { s, requestId } = started();
    const r = s.data.requests.find((x) => x.id === requestId)!;
    const a = s.data.approvals.find((x) => x.id === r.approvalId)!;
    const reviewer = a.stages.find((x) => x.status === "pending")!.assigneeId!;
    const s1 = ok(ops.decide(s, ctx(reviewer), a.id, "approve", ""));
    s1.data.obligations.find((x) => x.id === "ob-doc-signoff")!.evidence!.version = 1;
    const s2 = ok(ops.executeRequest(s1, ctx("p-casey"), requestId));
    expect(s2.data.requests.find((x) => x.id === requestId)!.execution.status).toBe("failed");
    expect(stateOf(s2, "ob-doc-signoff")).not.toBe("approved");
  });

  it("declining rejects the evidence with the reason and gives the subject owner one task", () => {
    const { s, requestId } = started();
    const r = s.data.requests.find((x) => x.id === requestId)!;
    const a = s.data.approvals.find((x) => x.id === r.approvalId)!;
    const reviewer = a.stages.find((x) => x.status === "pending")!.assigneeId!;
    const s1 = ok(ops.decide(s, ctx(reviewer), a.id, "decline", "One unit lead has not signed."));
    const o = s1.data.obligations.find((x) => x.id === "ob-doc-signoff")!;
    expect(o.state).toBe("rejected");
    expect(o.rejectionReason).toBe("One unit lead has not signed.");
    const tasks = s1.data.tasks.filter((t) => t.origin?.kind === "requirement" && t.origin.id === "ob-doc-signoff");
    expect(tasks).toHaveLength(1);
    const owner = s1.data.projects.find((p) => p.id === "pr-doc")?.ownerId;
    if (owner) expect(tasks[0].assigneeId).toBe(owner);
    expect(gateState(s1, SAMPLE_REFERENCE, GATE).satisfied).toBe(false);
  });

  it("a reviewer whose role lacks standards.review cannot decide, even when assigned", () => {
    const { s, requestId } = started();
    const r = s.data.requests.find((x) => x.id === requestId)!;
    const a = s.data.approvals.find((x) => x.id === r.approvalId)!;
    const reviewer = a.stages.find((x) => x.status === "pending")!.assigneeId!;
    for (const role of s.config.roles) role.permissions = role.permissions.filter((p) => p !== "standards.review");
    const auth = ops.decisionAuthority(s, ctx(reviewer), a);
    expect(auth.ok).toBe(false);
    expect(err(ops.decide(s, ctx(reviewer), a.id, "approve", ""))).toMatch(/Review evidence permission/);
  });

  it("start review is refused when no one else can review", () => {
    const s = sampleState();
    for (const role of s.config.roles) role.permissions = role.permissions.filter((p) => p !== "standards.review");
    expect(err(startReview(s, ctx("p-robin"), "ob-doc-signoff"))).toMatch(/can review it/);
    expect(err(startReview(s, ctx("p-casey"), "ob-doc-signoff"))).toMatch(/Only the owner/);
  });
});

describe("standards: renewals and checks", () => {
  it("expired evidence creates exactly one renewal task", () => {
    const s0 = sampleState();
    const later = addDays("2027-03-07T11:00:00.000Z", 1);
    expect(stateOf(s0, "ob-doc-dpia", later)).toBe("expired");
    const s1 = ok(raiseRenewals(s0, ctx("p-robin", later)));
    const o = s1.data.obligations.find((x) => x.id === "ob-doc-dpia")!;
    expect(o.state).toBe("expired");
    const tasks = (s: CoreState) => s.data.tasks.filter((t) => t.origin?.kind === "requirement" && t.origin.id === "ob-doc-dpia");
    expect(tasks(s1)).toHaveLength(1);
    expect(o.renewalTaskId).toBe(tasks(s1)[0].id);
    const again = raiseRenewals(s1, ctx("p-robin", later));
    expect(again.ok && tasks(again.state)).toHaveLength(1);
  });

  it("the sample's expired location already has its renewal task, so no second one appears", () => {
    const s0 = sampleState();
    const s1 = ok(raiseRenewals(s0, ctx("p-robin")));
    expect(s1.data.tasks.filter((t) => t.origin?.kind === "requirement" && t.origin.id === "ob-fire-south")).toHaveLength(1);
  });

  it("check runs are one per check, subject and period", () => {
    const s0 = sampleState();
    const now = runDueChecks(s0, ctx("p-robin"));
    expect(now.ok && now.state).toBe(s0);
    const april = "2026-04-02T09:00:00.000Z";
    const s1 = ok(runDueChecks(s0, ctx("p-robin", april)));
    const added = s1.data.checkRuns.length - s0.data.checkRuns.length;
    expect(added).toBeGreaterThan(0);
    expect(new Set(s1.data.checkRuns.map((r) => r.checkId + r.subject.id + r.periodKey)).size).toBe(s1.data.checkRuns.length);
    const again = runDueChecks(s1, ctx("p-robin", april));
    expect(again.ok && again.state).toBe(s1);
  });

  it("a failed check needs notes and creates one follow-up task", () => {
    const s0 = sampleState();
    expect(err(completeCheck(s0, ctx("p-casey"), "chk-3", "failed", ""))).toMatch(/Say what failed/);
    const s1 = ok(completeCheck(s0, ctx("p-casey"), "chk-3", "failed", "Extinguisher missing on floor 2."));
    const run = s1.data.checkRuns.find((r) => r.id === "chk-3")!;
    expect(run.result).toBe("failed");
    const tasks = s1.data.tasks.filter((t) => t.origin?.kind === "check" && t.origin.id === "chk-3");
    expect(tasks).toHaveLength(1);
    expect(run.followUpTaskId).toBe(tasks[0].id);
    expect(err(completeCheck(s1, ctx("p-casey"), "chk-3", "failed", "Again"))).toMatch(/Already recorded/);
  });

  it("checksOverdue counts pending checks past their period", () => {
    const s = sampleState();
    const m = computeMetric(s, ctx("p-robin"), "checksOverdue")!;
    expect(m.ids).toContain("chk-6");
    expect(m.ids).not.toContain("chk-3");
  });
});

describe("standards: policies", () => {
  it("acknowledgements are per version and never duplicated", () => {
    const s0 = sampleState();
    const hs = s0.data.files.find((f) => f.id === "f-hs")!;
    const p0 = policyProgress(s0, hs, SAMPLE_REFERENCE);
    expect(p0.outstanding).toContain("p-drew");
    const s1 = ok(acknowledgePolicy(s0, ctx("p-drew"), "f-hs"));
    const acks = s1.data.policyAcks.filter((a) => a.fileId === "f-hs" && a.personId === "p-drew");
    expect(acks.map((a) => a.version).sort()).toEqual([3, 4]);
    const p1 = policyProgress(s1, s1.data.files.find((f) => f.id === "f-hs")!, SAMPLE_REFERENCE);
    expect(p1.outstanding).not.toContain("p-drew");
    const again = acknowledgePolicy(s1, ctx("p-drew"), "f-hs");
    expect(again.ok && again.state).toBe(s1);
  });

  it("a new version needs a new acknowledgement", () => {
    const s = sampleState();
    const conduct = policyProgress(s, s.data.files.find((f) => f.id === "f-conduct")!, SAMPLE_REFERENCE);
    expect(conduct.version).toBe(3);
    // Avery acknowledged version 2 but not 3.
    expect(s.data.policyAcks.some((a) => a.fileId === "f-conduct" && a.personId === "p-avery" && a.version === 2)).toBe(true);
    expect(conduct.outstanding).toContain("p-avery");
  });
});

describe("standards: certificates are read from People", () => {
  it("the induction requirement reflects the People certificate, with no copied rows", () => {
    const s = sampleState();
    expect(s.data.obligations.some((o) => o.requirementId === "rq-induction")).toBe(false);
    expect(stateOf(s, "cert:rq-induction:p-sam")).toBe("missing");
    expect(stateOf(s, "cert:rq-induction:p-robin")).toBe("approved");
    expect(err(receiveEvidence(s, ctx("p-robin"), "cert:rq-induction:p-sam", "f-hs"))).toMatch(/People/);
  });
});
