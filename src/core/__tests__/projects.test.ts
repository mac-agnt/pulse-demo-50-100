import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { query } from "../query";
import { computeMetric } from "../metrics";
import { pageLabel } from "../modules";
import * as ops from "../ops";
import {
  completeMilestone, createProjectFromTemplate, milestoneDependants, milestoneImpact, moveMilestone, projectDay, projectDaysBetween,
  projectHealth, projectPhaseLabel, projectProgress, projectsFor, projectTerms, requestMilestoneChange, saveProjectTemplate, setProjectPhase
} from "../projects";
import type { CoreState, Ctx, ObligationState, ScopeSel } from "../types";

const ctx = (viewerId: string, scope: ScopeSel = { kind: "organisation" }, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope, now });
const ok = (r: ops.Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: ops.Result) => (r.ok ? "" : r.error);
const tz = "UTC";

/** The gate obligations belong to Standards; set their state directly so the test does not depend on that fixture. */
function setObligation(s: CoreState, id: string, requirementId: string, state: ObligationState) {
  const o = s.data.obligations.find((x) => x.id === id);
  if (o) o.state = state;
  else s.data.obligations.push({ id, requirementId, subject: { kind: "project", id: "pr-doc" }, state });
}

describe("project templates", () => {
  it("anchors every date to the chosen start date and creates canonical tasks", () => {
    const s = sampleState();
    const tpl = s.config.projects.templates.find((t) => t.id === "tpl-rollout")!;
    const make = (start: string, key: string) => {
      const r = createProjectFromTemplate(s, ctx("p-robin"), { templateId: tpl.id, title: "Pilot rollout", startDate: start, ownerId: "p-casey", teamId: "t-a", key });
      const st = ok(r);
      const p = st.data.projects.find((x) => x.id === (r.ok ? r.id : ""))!;
      return { st, p };
    };
    const a = make("2026-04-06", "k-a");
    const b = make("2026-05-04", "k-b");
    expect(a.p.startDate).toBe(projectDay("2026-04-06", tz, 9));
    expect(a.p.template).toEqual({ id: "tpl-rollout", version: tpl.version });
    for (const { st, p } of [a, b]) {
      const ms = st.data.milestones.filter((m) => m.projectId === p.id);
      expect(ms).toHaveLength(tpl.milestones.length);
      for (const def of tpl.milestones) {
        const m = ms.find((x) => x.label === def.label)!;
        expect(projectDaysBetween(p.startDate, m.dueAt, tz)).toBe(def.offsetDays);
        expect(m.baselineAt).toBe(m.dueAt);
      }
      expect(projectDaysBetween(p.startDate, p.endDate, tz)).toBe(tpl.durationDays);
      const tasks = st.data.tasks.filter((t) => t.projectId === p.id);
      expect(tasks).toHaveLength(tpl.tasks.length);
      expect(tasks.every((t) => t.origin?.kind === "project-template" && t.phaseId && t.teamId === "t-a")).toBe(true);
      // Unestimated template tasks stay unestimated, never zero.
      expect(tasks.filter((t) => t.estimateHours === undefined).length).toBe(tpl.tasks.filter((t) => t.estimateHours === undefined).length);
      const run = tasks.find((t) => t.title === "Run team briefings")!;
      expect(run.dependsOn).toEqual([tasks.find((t) => t.title === "Prepare team briefings")!.id]);
      expect(run.milestoneId).toBe(ms.find((m) => m.label === "Live in all teams")!.id);
    }
  });

  it("a repeated submit with the same key creates nothing twice", () => {
    const s = sampleState();
    const input = { templateId: "tpl-rollout", title: "Pilot rollout", startDate: "2026-04-06", ownerId: "p-casey", teamId: "t-a", key: "same-key" };
    const r1 = createProjectFromTemplate(s, ctx("p-robin"), input);
    const s1 = ok(r1);
    const r2 = createProjectFromTemplate(s1, ctx("p-robin"), input);
    const s2 = ok(r2);
    expect(r2.ok && r1.ok && r2.id === r1.id).toBe(true);
    expect(s2.data.projects.length).toBe(s1.data.projects.length);
    expect(s2.data.tasks.length).toBe(s1.data.tasks.length);
    expect(s2.data.milestones.length).toBe(s1.data.milestones.length);
  });

  it("editing a template bumps its version and leaves existing projects alone", () => {
    const s = sampleState();
    const tpl = structuredClone(s.config.projects.templates.find((t) => t.id === "tpl-rollout")!);
    tpl.durationDays = 95;
    const s1 = ok(saveProjectTemplate(s, ctx("p-robin"), tpl));
    expect(s1.config.projects.templates.find((t) => t.id === "tpl-rollout")!.version).toBe(tpl.version + 1);
    expect(s1.data.projects.find((p) => p.id === "pr-doc")!.template).toEqual({ id: "tpl-rollout", version: 1 });
    expect(s1.data.milestones.filter((m) => m.projectId === "pr-doc")).toEqual(s.data.milestones.filter((m) => m.projectId === "pr-doc"));
    expect(err(saveProjectTemplate(s, ctx("p-casey"), tpl))).toMatch(/administrator/);
  });
});

describe("moving a milestone", () => {
  const newDate = projectDay("2026-04-14", tz)!;

  it("lists dependants, updates computed health and writes one linked story", () => {
    const s = sampleState();
    const dep = milestoneDependants(s, "ms-ws-2");
    expect(dep.milestones.map((m) => m.id)).toEqual(["ms-ws-3", "ms-ws-4"]);
    const depTasks = dep.tasks.map((t) => t.task.id);
    expect(depTasks).toEqual(expect.arrayContaining(["t-ws-2", "t-ws-3", "t-ws-4", "t-ws-5", "t-ws-6"]));

    const imp = milestoneImpact(s, "ms-ws-2", newDate, ctx("p-casey"))!;
    expect(imp.route).toBe("direct");
    expect(imp.health.before.health).toBe("on_track");
    expect(imp.health.after.health).toBe("at_risk");
    const ws3 = imp.milestones.find((x) => x.milestone.id === "ms-ws-3")!;
    expect(ws3.applied).toBe(false);
    expect(ws3.conflict).toBe(true);
    expect(imp.notes.join(" ")).toMatch(/No budget, cost or invoice/);

    const before = s.data.events.length;
    const s1 = ok(moveMilestone(s, ctx("p-casey"), "ms-ws-2", "2026-04-14", "Furniture delivery moved"));
    const added = s1.data.events.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0].storyKey).toBe("project:pr-ws");
    expect(added[0].summary).toMatch(/Teams moved in/);
    expect(s1.data.milestones.find((m) => m.id === "ms-ws-2")!.dueAt).toBe(newDate);
    // Cascading is off in the sample: the dependant keeps its date and is flagged instead.
    expect(s1.data.milestones.find((m) => m.id === "ms-ws-3")!.dueAt).toBe(s.data.milestones.find((m) => m.id === "ms-ws-3")!.dueAt);
    const h = projectHealth(s1, s1.data.projects.find((p) => p.id === "pr-ws")!, SAMPLE_REFERENCE);
    expect(h.health).toBe("at_risk");
    expect(h.reasons.some((r) => r.kind === "dependency" && r.refId === "ms-ws-3")).toBe(true);
    expect(h.reported).toBe("on_track");
    expect(h.differs).toBe(true);
    // Budget figures are untouched by a date move.
    expect(s1.data.budgets).toEqual(s.data.budgets);
  });

  it("moves dependants by the same delta only when cascading is configured", () => {
    const s = sampleState();
    s.config.projects.cascadeMilestoneMoves = true;
    const earlier = projectDay("2026-03-25", tz)!;
    const s1 = ok(moveMilestone(s, ctx("p-casey"), "ms-ws-2", "2026-03-25", ""));
    const due = (st: CoreState, id: string) => st.data.milestones.find((m) => m.id === id)!.dueAt;
    const tdue = (st: CoreState, id: string) => st.data.tasks.find((t) => t.id === id)!.dueAt!;
    expect(due(s1, "ms-ws-2")).toBe(earlier);
    expect(projectDaysBetween(due(s, "ms-ws-3"), due(s1, "ms-ws-3"), tz)).toBe(-2);
    expect(projectDaysBetween(due(s, "ms-ws-4"), due(s1, "ms-ws-4"), tz)).toBe(-2);
    expect(projectDaysBetween(tdue(s, "t-ws-4"), tdue(s1, "t-ws-4"), tz)).toBe(-2);
    // Tasks leading up to the moved milestone keep their own dates.
    expect(tdue(s1, "t-ws-2")).toBe(tdue(s, "t-ws-2"));
    // A later move would push the last milestone past the end date, so it needs a request.
    expect(milestoneImpact(s, "ms-ws-2", newDate, ctx("p-casey"))!.route).toBe("request");
    expect(err(moveMilestone(s, ctx("p-casey"), "ms-ws-2", "2026-04-14", ""))).toMatch(/end date/);
  });

  it("a non-owner goes through a canonical change request; approval and execution are separate", () => {
    const s = sampleState();
    expect(err(moveMilestone(s, ctx("p-jordan"), "ms-ws-2", "2026-04-14", ""))).toMatch(/owner/);
    const r = requestMilestoneChange(s, ctx("p-jordan"), "ms-ws-2", "2026-04-14", "Network work needs another fortnight");
    const s1 = ok(r);
    const req = s1.data.requests.find((x) => x.id === (r.ok ? r.id : ""))!;
    expect(req.formId).toBe("form-milestone-change");
    expect(req.status).toBe("submitted");
    expect(s1.data.milestones.find((m) => m.id === "ms-ws-2")!.dueAt).toBe(s.data.milestones.find((m) => m.id === "ms-ws-2")!.dueAt);
    expect(s1.data.events.slice(s.data.events.length).every((e) => e.storyKey === "project:pr-ws")).toBe(true);
    expect(err(requestMilestoneChange(s1, ctx("p-jordan"), "ms-ws-2", "2026-04-15", "Again"))).toMatch(/already open/);

    const ap = s1.data.approvals.find((a) => a.id === req.approvalId)!;
    const approver = ap.stages.find((st) => st.status === "pending")!.assigneeId!;
    const s2 = ok(ops.decide(s1, ctx(approver), ap.id, "approve", ""));
    // Approved is not executed: the date has not moved yet.
    expect(s2.data.milestones.find((m) => m.id === "ms-ws-2")!.dueAt).toBe(s.data.milestones.find((m) => m.id === "ms-ws-2")!.dueAt);
    const s3 = ok(ops.executeRequest(s2, ctx(approver), req.id));
    expect(s3.data.requests.find((x) => x.id === req.id)!.execution.status).toBe("succeeded");
    expect(s3.data.milestones.find((m) => m.id === "ms-ws-2")!.dueAt).toBe(newDate);
    // Running it again repeats nothing.
    const s4 = ok(ops.executeRequest(s3, ctx(approver), req.id));
    expect(s4.data.events.length).toBe(s3.data.events.length);
  });
});

describe("gates", () => {
  it("block the phase change and milestone completion until both obligations are approved", () => {
    const s = sampleState();
    setObligation(s, "ob-doc-signoff", "rq-signoff", "received");
    setObligation(s, "ob-doc-dpia", "rq-dpia", "approved");
    const e1 = err(setProjectPhase(s, ctx("p-robin"), "pr-doc", "rollout"));
    expect(e1).toMatch(/Sign-off evidence accepted/);
    expect(e1).toMatch(/received, not yet reviewed/);
    expect(err(completeMilestone(s, ctx("p-robin"), "ms-doc-2"))).toMatch(/not satisfied/);

    setObligation(s, "ob-doc-signoff", "rq-signoff", "under_review");
    expect(err(setProjectPhase(s, ctx("p-robin"), "pr-doc", "rollout"))).toMatch(/under review/);

    setObligation(s, "ob-doc-signoff", "rq-signoff", "approved");
    const s1 = ok(setProjectPhase(s, ctx("p-robin"), "pr-doc", "rollout"));
    expect(s1.data.projects.find((p) => p.id === "pr-doc")!.phaseId).toBe("rollout");
    ok(completeMilestone(s, ctx("p-robin"), "ms-doc-2"));
  });

  it("authority is rechecked inside the operation", () => {
    const s = sampleState();
    // Morgan can see the organisation-wide project but neither owns nor manages it.
    expect(err(setProjectPhase(s, ctx("p-morgan"), "pr-doc", "plan"))).toMatch(/owner/);
  });
});

describe("configuration and scope", () => {
  it("renaming the label and phases keeps ids and behaviour", () => {
    const s = sampleState();
    const s1 = ok(ops.updateConfig(s, ctx("p-robin"), (c) => {
      c.projects.label = "Engagement";
      c.projects.plural = "Engagements";
      c.projects.types.find((t) => t.id === "rollout")!.phases.find((p) => p.id === "approve")!.label = "Sign-off";
    }, "Renamed"));
    expect(projectTerms(s1.config).many).toBe("Engagements");
    expect(pageLabel(s1.config, "Projects")).toBe("Engagements");
    const doc = s1.data.projects.find((p) => p.id === "pr-doc")!;
    expect(doc.phaseId).toBe("approve");
    expect(projectPhaseLabel(s1.config, doc, doc.phaseId)).toBe("Sign-off");
    const q0 = query(s, ctx("p-robin")), q1 = query(s1, ctx("p-robin"));
    expect(projectsFor(q1).map((p) => p.id)).toEqual(projectsFor(q0).map((p) => p.id));
    expect(projectHealth(s1, doc, SAMPLE_REFERENCE).health).toBe(projectHealth(s, doc, SAMPLE_REFERENCE).health);
    expect(err(setProjectPhase(s1, ctx("p-robin"), "pr-doc", "rollout"))).toMatch(/Sign-off evidence accepted/);
    expect(err(moveMilestone(s1, ctx("p-jordan"), "ms-ws-2", "2026-04-14", ""))).toMatch(/engagement owner/);
  });

  it("scope and permission hide projects outside the viewer's teams", () => {
    const s = sampleState();
    const avery = query(s, ctx("p-avery", { kind: "team", id: "t-c" }));
    expect(projectsFor(avery).map((p) => p.id)).toEqual(["pr-doc"]);
    expect(projectsFor(avery, { ignoreScope: true }).map((p) => p.id)).toEqual(["pr-doc"]);
    expect(err(moveMilestone(s, ctx("p-avery"), "ms-ws-2", "2026-04-14", ""))).toMatch(/cannot see/);
    const caseyTeamB = query(s, ctx("p-casey", { kind: "team", id: "t-b" }));
    expect(projectsFor(caseyTeamB).map((p) => p.id)).toEqual(["pr-doc"]);
    const caseyNorth = query(s, ctx("p-casey", { kind: "unit", id: "u-north" }));
    expect(projectsFor(caseyNorth).map((p) => p.id).sort()).toEqual(["pr-doc", "pr-svc", "pr-ws"]);
  });

  it("progress states its basis and leaves unestimated work out rather than counting it as zero", () => {
    const s = sampleState();
    const svc = s.data.projects.find((p) => p.id === "pr-svc")!;
    const m = projectProgress(s, svc);
    expect(m.basis).toBe("milestones");
    expect(m.text).toBe("1 of 4 milestones completed");
    s.config.projects.progressBasis = "estimate-hours";
    const h = projectProgress(s, svc);
    expect(h.total).toBe(6 + 8 + 12 + 3);
    expect(h.done).toBe(14);
    expect(h.excluded.join(" ")).toMatch(/2 tasks have no estimate/);
  });

  it("project metrics count the same projects the portfolio flags", () => {
    const s = sampleState();
    const atRisk = computeMetric(s, ctx("p-robin"), "projectsAtRisk")!;
    expect(atRisk.ids.sort()).toEqual(["pr-doc", "pr-svc"]);
    const onTime = computeMetric(s, ctx("p-robin"), "milestonesOnTime")!;
    expect(onTime.numerator).toBe(2);
    expect(onTime.denominator).toBe(3);
    const team = computeMetric(s, ctx("p-robin", { kind: "team", id: "t-c" }), "projectsAtRisk")!;
    expect(team.ids).toEqual(["pr-doc"]);
  });
});
