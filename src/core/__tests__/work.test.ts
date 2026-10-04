import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { query } from "../query";
import * as ops from "../ops";
import { appointments, calendarItems, cancelAppointment, createAppointment, setTaskEstimate, updateAppointment, weeklyAllocation } from "../calendar";
import { myWork, teamWork } from "../../ui/work/select";
import type { CoreState, Ctx, ScopeSel, Task } from "../types";
import { addHours } from "../time";

const ctx = (viewerId: string, scope: ScopeSel = { kind: "organisation" }, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope, now });
const ok = (r: ops.Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: ops.Result) => (r.ok ? "" : r.error);

/** A task added straight to the fixture, as a module would (project tasks are ordinary tasks). */
function withTask(s0: CoreState, t: Partial<Task> & { id: string; title: string }): CoreState {
  const s = structuredClone(s0);
  s.data.tasks.push({ teamId: "t-a", unitId: "u-north", assigneeId: null, linkedRecordIds: [], priority: "normal", status: "open", dependsOn: [], checklist: [], notes: [],
    evidenceFileIds: [], createdAt: SAMPLE_REFERENCE, createdBy: "p-robin", ...t });
  return s;
}

describe("My work and Team work over the same canonical tasks", () => {
  const teamA: ScopeSel = { kind: "team", id: "t-a" };

  it("shows a project task assigned to me in both views as the same object", () => {
    let s = withTask(sampleState(), { id: "t-proj-1", title: "Draft the rollout plan", assigneeId: "p-morgan", projectId: "pr-doc", dueAt: addHours(SAMPLE_REFERENCE, 30), estimateHours: 3 });
    s = withTask(s, { id: "t-proj-2", title: "Book the training room", assigneeId: null, projectId: "pr-doc", dueAt: addHours(SAMPLE_REFERENCE, 50) });
    const q = query(s, ctx("p-morgan", teamA));
    const mine = myWork(q);
    const team = teamWork(q);
    const canonical = new Map(s.data.tasks.map((t) => [t.id, t]));

    expect(mine.every((t) => t.assigneeId === "p-morgan" && canonical.get(t.id) === t)).toBe(true);
    expect(team.every((t) => t.teamId === "t-a" && canonical.get(t.id) === t)).toBe(true);
    const inMine = mine.find((t) => t.id === "t-proj-1");
    const inTeam = team.find((t) => t.id === "t-proj-1");
    expect(inMine).toBeDefined();
    expect(inMine).toBe(inTeam);
    expect(inMine!.projectId).toBe("pr-doc");
    // The unclaimed project task is team work only.
    expect(team.some((t) => t.id === "t-proj-2")).toBe(true);
    expect(mine.some((t) => t.id === "t-proj-2")).toBe(false);
    // No task appears twice in either list.
    expect(new Set(mine.map((t) => t.id)).size).toBe(mine.length);
    expect(new Set(team.map((t) => t.id)).size).toBe(team.length);
  });

  it("orders My work by due date with undated work last", () => {
    let s = withTask(sampleState(), { id: "t-late", title: "Later", assigneeId: "p-morgan", dueAt: addHours(SAMPLE_REFERENCE, 200) });
    s = withTask(s, { id: "t-undated", title: "Whenever", assigneeId: "p-morgan" });
    const mine = myWork(query(s, ctx("p-morgan", teamA)));
    const due = mine.map((t) => (t.dueAt ? Date.parse(t.dueAt) : Infinity));
    expect([...due].sort((a, b) => a - b)).toEqual(due);
    expect(mine[mine.length - 1].dueAt).toBeUndefined();
  });

  it("claiming moves a team task into My work, and a second claim is refused", () => {
    const s0 = withTask(sampleState(), { id: "t-q", title: "Unclaimed queue item", dueAt: addHours(SAMPLE_REFERENCE, 20) });
    const s1 = ok(ops.claimTask(s0, ctx("p-morgan", teamA), "t-q"));
    expect(myWork(query(s1, ctx("p-morgan", teamA))).some((t) => t.id === "t-q")).toBe(true);
    expect(err(ops.claimTask(s1, ctx("p-taylor", teamA), "t-q"))).toMatch(/Already claimed/);
  });
});

describe("weekly allocation", () => {
  const week = "2026-03-09";

  it("counts tasks without an estimate separately and never as zero hours", () => {
    let s = withTask(sampleState(), { id: "t-est", title: "Estimated work", assigneeId: "p-morgan", dueAt: addHours(SAMPLE_REFERENCE, 24), estimateHours: 6 });
    s = withTask(s, { id: "t-unest", title: "Unestimated work", assigneeId: "p-morgan", dueAt: addHours(SAMPLE_REFERENCE, 26) });
    const before = weeklyAllocation(query(s, ctx("p-robin")), week).find((a) => a.personId === "p-morgan")!;
    expect(before.estimatedTaskIds).toContain("t-est");
    expect(before.unestimatedTaskIds).toContain("t-unest");
    expect(before.estimatedTaskIds).not.toContain("t-unest");

    // Another unestimated task changes the unestimated count only, not the hours or the load.
    const s2 = withTask(s, { id: "t-unest-2", title: "More unestimated work", assigneeId: "p-morgan", dueAt: addHours(SAMPLE_REFERENCE, 28) });
    const after = weeklyAllocation(query(s2, ctx("p-robin")), week).find((a) => a.personId === "p-morgan")!;
    expect(after.estimatedHours).toBe(before.estimatedHours);
    expect(after.load).toBe(before.load);
    expect(after.unestimatedTaskIds.length).toBe(before.unestimatedTaskIds.length + 1);

    // Clearing an estimate makes the task unestimated again rather than zero hours.
    const s3 = ok(setTaskEstimate(s2, ctx("p-robin"), "t-est", null));
    const cleared = weeklyAllocation(query(s3, ctx("p-robin")), week).find((a) => a.personId === "p-morgan")!;
    expect(cleared.unestimatedTaskIds).toContain("t-est");
    expect(s3.data.tasks.find((t) => t.id === "t-est")!.estimateHours).toBeUndefined();
  });

  it("takes approved leave off scheduled hours and keeps hours private to managers", () => {
    const s = sampleState();
    const quinn = weeklyAllocation(query(s, ctx("p-robin")), week).find((a) => a.personId === "p-quinn")!;
    const e = s.data.employment.find((x) => x.personId === "p-quinn")!;
    expect(quinn.scheduledHours).toBe(e.hoursPerWeek);
    expect(quinn.leaveHours).toBeGreaterThan(0);
    expect(quinn.availableHours).toBe(e.hoursPerWeek - quinn.leaveHours);
    // A contributor sees only their own allocation.
    const own = weeklyAllocation(query(s, ctx("p-morgan")), week);
    expect(own.map((a) => a.personId)).toEqual(["p-morgan"]);
  });

  it("only the assignee or a manager of the team may set an estimate", () => {
    const s = withTask(sampleState(), { id: "t-x", title: "Someone else's task", assigneeId: "p-taylor", dueAt: addHours(SAMPLE_REFERENCE, 24) });
    expect(err(setTaskEstimate(s, ctx("p-morgan"), "t-x", 2))).toMatch(/assignee or a manager/);
    expect(ok(setTaskEstimate(s, ctx("p-jordan"), "t-x", 2)).data.tasks.find((t) => t.id === "t-x")!.estimateHours).toBe(2);
  });
});

describe("appointments", () => {
  const start = addHours(SAMPLE_REFERENCE, 24);

  it("lets the owner or a manager of the team change it, and nobody else", () => {
    const s1 = createAppointment(sampleState(), ctx("p-morgan"), { title: "Supplier walkthrough", startAt: start, minutes: 60, teamId: "t-a" });
    const s = ok(s1);
    const id = s1.ok ? s1.id! : "";
    const ev = s.data.events.find((e) => e.objectId === id && e.action === "appointment.created");
    expect(ev?.storyKey).toBe("appointment:" + id);

    expect(err(updateAppointment(s, ctx("p-taylor"), id, { title: "Changed" }))).toMatch(/owner of this appointment or a manager/);
    expect(err(updateAppointment(s, ctx("p-avery"), id, { title: "Changed" }))).toMatch(/owner of this appointment or a manager/);
    expect(ok(updateAppointment(s, ctx("p-jordan"), id, { title: "Changed" })).data.appointments.find((a) => a.id === id)!.title).toBe("Changed");
    expect(ok(updateAppointment(s, ctx("p-morgan"), id, { minutes: 90 })).data.appointments.find((a) => a.id === id)!.minutes).toBe(90);
    expect(err(cancelAppointment(s, ctx("p-taylor"), id, ""))).not.toBe("");
  });

  it("a contributor cannot book for someone else, and appointments stay within permission", () => {
    expect(err(createAppointment(sampleState(), ctx("p-morgan"), { title: "For Taylor", startAt: start, minutes: 30, ownerId: "p-taylor", teamId: "t-a" }))).toMatch(/manager/);
    const s = ok(createAppointment(sampleState(), ctx("p-avery"), { title: "Team C planning", startAt: start, minutes: 30, teamId: "t-c" }));
    expect(appointments(query(s, ctx("p-quinn"))).some((a) => a.title === "Team C planning")).toBe(true);
    expect(appointments(query(s, ctx("p-morgan"))).some((a) => a.title === "Team C planning")).toBe(false);
  });
});

describe("calendar", () => {
  it("shows each schedule slot once, before and after it produces its task", () => {
    const now = "2026-03-11T17:00:00.000Z";
    const c = ctx("p-jordan", { kind: "team", id: "t-a" }, now);
    const s0 = sampleState();
    const slot = "sch-handover:2026-03-11";
    const count = (s: CoreState) => calendarItems(query(s, c), "2026-03-09", "2026-03-16")
      .filter((i) => i.key === "schedule:" + slot || (i.layer === "task" && s.data.tasks.find((t) => t.id === i.object.id)?.instanceKey === slot)).length;

    const before = calendarItems(query(s0, c), "2026-03-09", "2026-03-16");
    expect(new Set(before.map((i) => i.key)).size).toBe(before.length);
    expect(count(s0)).toBe(1);

    const s1 = ok(ops.runSchedule(s0, c, "sch-handover"));
    expect(count(s1)).toBe(1);
    const after = calendarItems(query(s1, c), "2026-03-09", "2026-03-16");
    expect(after.some((i) => i.key === "schedule:" + slot)).toBe(false);
    expect(new Set(after.map((i) => i.key)).size).toBe(after.length);

    // Running the same slot again produces nothing new.
    const again = ops.runSchedule(s1, c, "sch-handover");
    expect(again.ok && again.message).toMatch(/No duplicate/);
    expect(count(again.ok ? again.state : s1)).toBe(1);
  });

  it("keeps automation schedules in their own layer", () => {
    const q = query(sampleState(), ctx("p-robin"));
    const noSchedules = calendarItems(q, "2026-03-09", "2026-03-16", ["task", "milestone", "appointment"]);
    expect(noSchedules.some((i) => i.layer === "schedule")).toBe(false);
    const all = calendarItems(q, "2026-03-09", "2026-03-16");
    const sched = all.filter((i) => i.layer === "schedule");
    expect(sched.length).toBeGreaterThan(0);
    expect(sched.every((i) => !!i.recurrence && !!i.timezone && !!i.ownerId)).toBe(true);
  });
});
