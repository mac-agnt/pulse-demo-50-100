/* Sample comments, company updates and appointments. Removable with the rest of the sample fixture layer.
   applyShell() receives the sample config and data after the base sample is
   built and adds this module's rows and configuration to them. The audit
   events added here are the history of these rows, so Activity groups them
   into the same stories the live ops would produce. */

import { addHours } from "../time";
import type { AuditEvent, CoreData, OrgConfig } from "../types";

const REF = "2026-03-11T10:00:00.000Z"; // same as SAMPLE_REFERENCE, a Wednesday
const at = (h: number) => addHours(REF, h);

export function applyShell(c: OrgConfig, d: CoreData): void {
  /* Role defaults for Home: managers and administrators open on Today, contributors on Chat. */
  c.roleLayouts = {
    ...c.roleLayouts,
    contributor: { ...(c.roleLayouts.contributor || { homeView: "personal", dashboardId: "delivery" }), homeMode: "chat" },
    team_manager: { ...(c.roleLayouts.team_manager || { homeView: "management", dashboardId: "overview" }), homeMode: "today" },
    admin: { ...(c.roleLayouts.admin || { homeView: "management", dashboardId: "overview" }), homeMode: "today" }
  };

  const hasRequest = (id: string) => d.requests.some((r) => r.id === id);
  const hasRecord = (id: string) => d.records.some((r) => r.id === id);
  const hasProject = (id: string) => d.projects.some((p) => p.id === id);

  /* ── Comments on records, requests and projects ── */
  const comments: CoreData["comments"] = [];
  if (hasRequest("req-11")) comments.push({ id: "cm-s1", objectType: "request", objectId: "req-11", by: "p-casey", at: at(-3),
    text: "@Robin Hale the four seats replace the trial licences that end this month, so there is no overlap.", mentions: ["p-robin"] });
  if (hasRequest("req-1")) comments.push({ id: "cm-s2", objectType: "request", objectId: "req-1", by: "p-jordan", at: at(-2),
    text: "Steps 3 to 5 read well. One question on who signs off step 4, noted in the task.", mentions: [] });
  if (hasRecord("r-1003")) comments.push({ id: "cm-s3", objectType: "record", objectId: "r-1003", by: "p-morgan", at: at(-20),
    text: "The review date is on the paper copy. I will add it once the scan is back.", mentions: [] });
  if (hasProject("pr-ws")) comments.push({ id: "cm-s4", objectType: "project", objectId: "pr-ws", by: "p-jordan", at: at(-1.5),
    text: "@Casey Lund the move date depends on fit-out finishing. Worth a look before Friday.", mentions: ["p-casey"] });
  d.comments.push(...comments);

  /* ── Company updates: one published, one recap waiting for a publisher ── */
  d.companyUpdates.push(
    { id: "upd-s1", title: "New request forms are live", state: "published",
      body: "Document reviews and information corrections now go through request forms in Work. Each one routes to the right reviewer and keeps its evidence with the request. Old email threads are not migrated.",
      audience: { kind: "organisation" }, draftedBy: "p-robin", draftedAt: at(-24 * 2 - 3), publishedBy: "p-robin", publishedAt: at(-24 * 2), eventIds: [] },
    { id: "upd-s2", title: "Recap for 10 Mar 2026", state: "draft",
      body: "What was recorded yesterday in Unit North:\n- REQ-212 replacement laptops for Team B submitted for a decision\n- Contact email for REC-1005 updated from the sample source\n- Data steward opened a task to fill the missing review date on REC-1003\n\nDrafted from the audit log. Review the wording before publishing.",
      audience: { kind: "unit", id: "u-north" }, draftedBy: "p-casey", draftedAt: at(-17), eventIds: [] }
  );

  /* ── Appointments for the demo week (Monday 9 to Friday 13 March) ── */
  const appts: CoreData["appointments"] = [
    { id: "apt-1", title: "Team A weekly meeting", startAt: at(-1), minutes: 30, ownerId: "p-jordan", attendeeIds: ["p-casey", "p-morgan", "p-taylor", "p-robin"], teamId: "t-a", unitId: "u-north", locationId: "loc-north" },
    { id: "apt-2", title: "One-to-one: Casey and Jordan", startAt: at(1.5), minutes: 45, ownerId: "p-casey", attendeeIds: ["p-jordan"], teamId: "t-a", unitId: "u-north", locationId: "loc-north" },
    { id: "apt-3", title: "Site walk for the workspace upgrade", startAt: at(5), minutes: 60, ownerId: "p-casey", attendeeIds: ["p-jordan", "p-riley"], unitId: "u-north", locationId: "loc-north",
      projectId: hasProject("pr-ws") ? "pr-ws" : undefined, note: "Walk the fitted areas before the move date is confirmed." },
    { id: "apt-4", title: "Supplier visit: furniture delivery plan", startAt: at(24), minutes: 60, ownerId: "p-riley", attendeeIds: ["p-casey", "p-taylor"], teamId: "t-b", unitId: "u-north", locationId: "loc-north",
      projectId: hasProject("pr-ws") ? "pr-ws" : undefined },
    { id: "apt-5", title: "One-to-one: Avery and Quinn", startAt: at(23), minutes: 30, ownerId: "p-avery", attendeeIds: ["p-quinn"], teamId: "t-c", unitId: "u-south", locationId: "loc-south" },
    { id: "apt-6", title: "Team B planning", startAt: at(-24 * 2 + 1), minutes: 45, ownerId: "p-riley", attendeeIds: ["p-jamie", "p-sam", "p-taylor"], teamId: "t-b", unitId: "u-north", locationId: "loc-north" },
    { id: "apt-7", title: "Team C weekly meeting", startAt: at(24 * 2 - 1), minutes: 30, ownerId: "p-avery", attendeeIds: ["p-quinn", "p-drew"], teamId: "t-c", unitId: "u-south", locationId: "loc-south" },
    { id: "apt-8", title: "Document review rollout check-in", startAt: at(24 * 2 + 3), minutes: 30, ownerId: "p-robin", attendeeIds: ["p-casey", "p-avery"],
      projectId: hasProject("pr-doc") ? "pr-doc" : undefined }
  ];
  d.appointments.push(...appts);

  /* ── History of the rows above ── */
  let n = 0;
  const ev = (e: Omit<AuditEvent, "id">) => d.events.push({ id: "e-sh" + String(++n).padStart(2, "0"), ...e });
  ev({ at: at(-24 * 2 - 3), actorId: "p-robin", actorKind: "person", action: "update.drafted", objectType: "update", objectId: "upd-s1", recordIds: [], storyKey: "update:upd-s1",
    summary: "Drafted “New request forms are live”" });
  ev({ at: at(-24 * 2), actorId: "p-robin", actorKind: "person", action: "update.published", objectType: "update", objectId: "upd-s1", recordIds: [], storyKey: "update:upd-s1",
    summary: "Published “New request forms are live” to the whole organisation" });
  ev({ at: at(-17), actorId: "p-casey", actorKind: "person", action: "update.drafted", objectType: "update", objectId: "upd-s2", recordIds: [], storyKey: "update:upd-s2", unitId: "u-north",
    summary: "Drafted recap for 10 Mar 2026 from recorded events (not published)" });
  for (const cm of comments) {
    const req = cm.objectType === "request" ? d.requests.find((r) => r.id === cm.objectId) : undefined;
    const rec = cm.objectType === "record" ? d.records.find((r) => r.id === cm.objectId) : undefined;
    const prj = cm.objectType === "project" ? d.projects.find((p) => p.id === cm.objectId) : undefined;
    ev({ at: cm.at, actorId: cm.by, actorKind: "person", action: "comment.added", objectType: "comment", objectId: cm.id,
      recordIds: rec ? [rec.id] : req ? req.linkedRecordIds : [], storyKey: cm.objectType + ":" + cm.objectId,
      teamId: req?.teamId || rec?.teamId || prj?.teamId, unitId: req?.unitId || rec?.unitId || prj?.unitId,
      summary: "Commented on " + (req ? req.ref : rec ? rec.ref : prj ? prj.title : cm.objectType)
        + (cm.mentions.length ? ", mentioning " + cm.mentions.map((m) => d.people.find((p) => p.id === m)?.name || m).join(", ") : "") });
  }
  d.events.sort((a, b) => a.at.localeCompare(b.at));
}
