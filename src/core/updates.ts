/* Company updates and drafted recaps.
   An audit event never becomes an announcement on its own: a recap is drafted
   from recorded events and stays a draft until a person with updates.publish
   publishes it to an audience they are allowed to address. Nothing is emailed;
   a published update appears in Activity for the people in its audience. */

import { can, viewerOf, type Viewer } from "./access";
import { draft, logEvent, nid, type Result } from "./ops";
import { query } from "./query";
import { localDay, fmtDate } from "./time";
import type { AuditEvent, CompanyUpdate, CoreState, Ctx, Id } from "./types";

export type UpdateAudience = CompanyUpdate["audience"];

const fail = (error: string): Result => ({ ok: false, error });

/** The story an event belongs to: its own storyKey, else the request behind an approval, else its object. */
export function storyKeyOf(s: CoreState, e: AuditEvent): string {
  if (e.storyKey) return e.storyKey;
  if (e.objectType === "approval") {
    const a = s.data.approvals.find((x) => x.id === e.objectId);
    if (a) return "request:" + a.requestId;
  }
  return e.objectType + ":" + e.objectId;
}

export function audienceLabel(s: CoreState, a: UpdateAudience): string {
  if (a.kind === "organisation") return "Whole " + s.config.terminology.organisation.toLowerCase();
  if (a.kind === "unit") return s.config.units.find((u) => u.id === a.id)?.label || "Unknown " + s.config.terminology.unit.toLowerCase();
  return s.config.teams.find((t) => t.id === a.id)?.label || "Unknown " + s.config.terminology.team.toLowerCase();
}

function audienceExists(s: CoreState, a: UpdateAudience): boolean {
  if (a.kind === "organisation") return true;
  if (a.kind === "unit") return s.config.units.some((u) => u.id === a.id);
  return s.config.teams.some((t) => t.id === a.id);
}

/** Can this person address an audience? Org-wide people can reach anyone; others only the units and teams they oversee. */
export function canAddress(s: CoreState, v: Viewer, a: UpdateAudience): boolean {
  if (!audienceExists(s, a)) return false;
  if (v.isOrgWide) return true;
  if (a.kind === "organisation") return false;
  if (a.kind === "unit") return v.overseenUnitIds.includes(a.id);
  return v.overseenTeamIds.includes(a.id);
}

/** Audiences a viewer could publish to, widest first. */
export function addressableAudiences(s: CoreState, v: Viewer): UpdateAudience[] {
  const out: UpdateAudience[] = [{ kind: "organisation" }];
  s.config.units.filter((u) => u.status !== "planned").forEach((u) => out.push({ kind: "unit", id: u.id }));
  s.config.teams.forEach((t) => out.push({ kind: "team", id: t.id }));
  return out.filter((a) => canAddress(s, v, a));
}

/** Is a person inside a published update's audience? */
function inAudience(s: CoreState, v: Viewer, a: UpdateAudience): boolean {
  if (v.person.kind !== "staff") return false;
  if (v.isOrgWide || a.kind === "organisation") return true;
  if (a.kind === "unit") {
    const myUnits = v.memberTeamIds.map((t) => s.config.teams.find((x) => x.id === t)?.unitId);
    return v.overseenUnitIds.includes(a.id) || myUnits.includes(a.id);
  }
  return v.overseenTeamIds.includes(a.id) || v.memberTeamIds.includes(a.id);
}

/** Who can read an update. Drafts: the drafter and people who could publish them. Published: the audience. */
export function canReadUpdate(s: CoreState, v: Viewer, u: CompanyUpdate): boolean {
  if (u.state === "draft") return u.draftedBy === v.person.id || (can(v, "updates.publish") && canAddress(s, v, u.audience));
  if (u.state === "discarded") return u.draftedBy === v.person.id;
  return inAudience(s, v, u.audience);
}

export function visibleUpdates(s: CoreState, viewerId: Id): CompanyUpdate[] {
  const v = viewerOf(s, viewerId);
  return s.data.companyUpdates.filter((u) => canReadUpdate(s, v, u))
    .sort((a, b) => (b.publishedAt || b.draftedAt).localeCompare(a.publishedAt || a.draftedAt));
}

/** People who could publish a draft to its audience, for "who needs to act" copy. */
export function publishersFor(s: CoreState, a: UpdateAudience): Id[] {
  return s.data.people.filter((p) => p.status === "active" && p.kind === "staff").map((p) => viewerOf(s, p.id))
    .filter((v) => can(v, "updates.publish") && canAddress(s, v, a)).map((v) => v.person.id);
}

const defaultAudience = (ctx: Ctx): UpdateAudience =>
  ctx.scope.kind === "unit" ? { kind: "unit", id: ctx.scope.id } : ctx.scope.kind === "team" ? { kind: "team", id: ctx.scope.id } : { kind: "organisation" };

/** Draft a recap of today's recorded events in the current scope. Local and labelled as a draft. */
export function draftRecap(s0: CoreState, ctx: Ctx, opts: { audience?: UpdateAudience } = {}): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "audit.view") && !can(v, "updates.publish")) return fail("Your role cannot draft recaps. It needs audit access or permission to publish updates.");
  const tz = s0.config.timezone;
  const today = localDay(ctx.now, tz);
  const q = query(s0, ctx);
  // Only what this person can see, in the scope they are looking at. Earlier recaps are not recapped again.
  const events = q.events().filter((e) => localDay(e.at, tz) === today && e.at <= ctx.now && e.objectType !== "update")
    .sort((a, b) => a.at.localeCompare(b.at));
  if (!events.length) return fail("Nothing was recorded today in this scope, so there is nothing to recap.");
  const stories = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const k = storyKeyOf(s0, e);
    stories.set(k, [...(stories.get(k) || []), e]);
  }
  const lines = [...stories.values()].map((list) => {
    const last = list[list.length - 1];
    return "- " + last.summary + (list.length > 1 ? " (" + list.length + " events)" : "") + (list.some((e) => e.simulated) ? " [sample]" : "");
  });
  const audience = opts.audience || defaultAudience(ctx);
  if (!audienceExists(s0, audience)) return fail("That audience no longer exists.");
  const s = draft(s0);
  const id = nid(s, "upd");
  const title = "Recap for " + fmtDate(ctx.now, tz);
  s.data.companyUpdates.push({
    id, title, state: "draft", audience, draftedBy: ctx.viewerId, draftedAt: ctx.now, eventIds: events.map((e) => e.id),
    body: "What was recorded today in " + q.s.config.terminology.organisation.toLowerCase() + " work you can see:\n" + lines.join("\n")
      + "\n\nDrafted from the audit log. Review the wording before publishing."
  });
  logEvent(s, ctx, { action: "update.drafted", objectType: "update", objectId: id, recordIds: [], storyKey: "update:" + id,
    summary: "Drafted " + title.toLowerCase() + " from " + events.length + " recorded events (not published)" });
  return { ok: true, state: s, message: "Recap drafted from " + events.length + " events. It stays a draft until someone who can publish updates publishes it.", id };
}

/** Publish a draft. Needs updates.publish and the right to address the audience, checked here. */
export function publishUpdate(s0: CoreState, ctx: Ctx, id: Id, patch: { audience?: UpdateAudience; title?: string; body?: string } = {}): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "updates.publish")) return fail("Your role cannot publish company updates. Someone with permission to publish updates has to do it.");
  const u0 = s0.data.companyUpdates.find((x) => x.id === id);
  if (!u0) return fail("Update not found.");
  if (u0.state === "published") return fail("This update is already published.");
  if (u0.state === "discarded") return fail("This draft was discarded.");
  const audience = patch.audience || u0.audience;
  if (!audienceExists(s0, audience)) return fail("That audience no longer exists.");
  if (!canAddress(s0, v, audience)) return fail("You can only publish to " + (v.isOrgWide ? "existing audiences" : "the units and teams you oversee") + ". " + audienceLabel(s0, audience) + " is outside that.");
  const title = (patch.title ?? u0.title).trim();
  const body = (patch.body ?? u0.body).trim();
  if (!title) return fail("Give the update a title.");
  if (!body) return fail("The update has no text.");
  const s = draft(s0);
  const u = s.data.companyUpdates.find((x) => x.id === id)!;
  u.title = title; u.body = body; u.audience = audience;
  u.state = "published"; u.publishedBy = ctx.viewerId; u.publishedAt = ctx.now;
  logEvent(s, ctx, { action: "update.published", objectType: "update", objectId: id, recordIds: [], storyKey: "update:" + id,
    unitId: audience.kind === "unit" ? audience.id : undefined, teamId: audience.kind === "team" ? audience.id : undefined,
    summary: "Published “" + title + "” to " + audienceLabel(s, audience) });
  return { ok: true, state: s, message: "Published to " + audienceLabel(s, audience) + ". It shows in Activity for that audience. Nothing was emailed.", id };
}

/** Discard a draft. The drafter, or someone who could publish it, may discard. */
export function discardUpdate(s0: CoreState, ctx: Ctx, id: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  const u0 = s0.data.companyUpdates.find((x) => x.id === id);
  if (!u0) return fail("Update not found.");
  if (u0.state !== "draft") return fail("Only drafts can be discarded.");
  if (u0.draftedBy !== ctx.viewerId && !(can(v, "updates.publish") && canAddress(s0, v, u0.audience))) return fail("Only the person who drafted it, or someone who could publish it, can discard this draft.");
  const s = draft(s0);
  const u = s.data.companyUpdates.find((x) => x.id === id)!;
  u.state = "discarded";
  logEvent(s, ctx, { action: "update.discarded", objectType: "update", objectId: id, recordIds: [], storyKey: "update:" + id,
    summary: "Discarded draft “" + u.title + "”" });
  return { ok: true, state: s, message: "Draft discarded. It was never published." };
}
