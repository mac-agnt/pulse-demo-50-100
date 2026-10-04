import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { draftRecap, publishUpdate, discardUpdate, visibleUpdates, canReadUpdate } from "../updates";
import { viewerOf } from "../access";
import type { CoreState, Ctx, ScopeSel } from "../types";
import type { Result } from "../ops";

const ctx = (viewerId: string, scope: ScopeSel = { kind: "organisation" }, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope, now });
const ok = (r: Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: Result) => (r.ok ? "" : r.error);

describe("company updates", () => {
  it("publishing needs updates.publish, checked inside the op", () => {
    const s = sampleState();
    // Casey drafted the sample recap but leads a unit without permission to publish.
    expect(err(publishUpdate(s, ctx("p-casey", { kind: "unit", id: "u-north" }), "upd-s2"))).toMatch(/cannot publish/);
    expect(err(publishUpdate(s, ctx("p-morgan"), "upd-s2"))).toMatch(/cannot publish/);
    const s2 = ok(publishUpdate(s, ctx("p-robin"), "upd-s2"));
    const u = s2.data.companyUpdates.find((x) => x.id === "upd-s2")!;
    expect(u.state).toBe("published");
    expect(u.publishedBy).toBe("p-robin");
    // Publishing is one recorded event, grouped with the draft under the same story.
    const evs = s2.data.events.filter((e) => e.storyKey === "update:upd-s2");
    expect(evs.map((e) => e.action)).toEqual(["update.drafted", "update.published"]);
    // A second publish is refused rather than repeated.
    expect(err(publishUpdate(s2, ctx("p-robin"), "upd-s2"))).toMatch(/already published/);
  });

  it("the audience decides who reads a published update, and who may address it", () => {
    const s = sampleState();
    const s2 = ok(publishUpdate(s, ctx("p-robin"), "upd-s2", { audience: { kind: "team", id: "t-c" } }));
    const u = s2.data.companyUpdates.find((x) => x.id === "upd-s2")!;
    expect(canReadUpdate(s2, viewerOf(s2, "p-quinn"), u)).toBe(true); // Team C member
    expect(canReadUpdate(s2, viewerOf(s2, "p-morgan"), u)).toBe(false); // Team A member
    expect(visibleUpdates(s2, "p-morgan").some((x) => x.id === "upd-s2")).toBe(false);

    // A team manager given the permission can only address what they oversee.
    const s3 = structuredClone(s);
    s3.config.roles.find((r) => r.id === "team_manager")!.permissions.push("updates.publish");
    expect(err(publishUpdate(s3, ctx("p-avery"), "upd-s2", { audience: { kind: "organisation" } }))).toMatch(/only publish/);
    expect(err(publishUpdate(s3, ctx("p-avery"), "upd-s2", { audience: { kind: "team", id: "t-a" } }))).toMatch(/only publish/);
    expect(publishUpdate(s3, ctx("p-avery"), "upd-s2", { audience: { kind: "team", id: "t-c" } }).ok).toBe(true);
  });

  it("a drafted recap stays a draft until someone publishes it", () => {
    const s = sampleState();
    const before = s.data.events.length;
    const res = draftRecap(s, ctx("p-robin"));
    const s2 = ok(res);
    const u = s2.data.companyUpdates.find((x) => x.id === (res.ok ? res.id : ""))!;
    expect(u.state).toBe("draft");
    expect(u.eventIds.length).toBeGreaterThan(0);
    // Only today's events in the drafter's view are summarised.
    for (const id of u.eventIds) expect(s2.data.events.find((e) => e.id === id)!.at.slice(0, 10)).toBe(SAMPLE_REFERENCE.slice(0, 10));
    // The audit log gains a "drafted" event; nothing is announced.
    const added = s2.data.events.slice(before);
    expect(added.map((e) => e.action)).toEqual(["update.drafted"]);
    expect(s2.data.events.some((e) => e.action === "update.published" && e.objectId === u.id)).toBe(false);
    // Other staff do not see someone else's draft.
    expect(visibleUpdates(s2, "p-morgan").some((x) => x.id === u.id)).toBe(false);
    expect(visibleUpdates(s2, "p-robin").some((x) => x.id === u.id)).toBe(true);
    // Contributors cannot draft recaps of the audit log.
    expect(err(draftRecap(s, ctx("p-morgan")))).toMatch(/cannot draft/);
  });

  it("discarding a draft keeps it unpublished and blocks later publishing", () => {
    const s = sampleState();
    expect(err(discardUpdate(s, ctx("p-morgan"), "upd-s2"))).toMatch(/Only the person/);
    const s2 = ok(discardUpdate(s, ctx("p-casey", { kind: "unit", id: "u-north" }), "upd-s2"));
    expect(s2.data.companyUpdates.find((x) => x.id === "upd-s2")!.state).toBe("discarded");
    expect(err(publishUpdate(s2, ctx("p-robin"), "upd-s2"))).toMatch(/discarded/);
    expect(err(discardUpdate(s, ctx("p-robin"), "upd-s1"))).toMatch(/Only drafts/);
  });
});
