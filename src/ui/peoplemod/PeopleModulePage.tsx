/* People module. Promotes the existing People capability (src/ui/people and
   src/core/people.ts) into its own page; it is the same person and employment
   data, not a second directory. The top bar picks the section (v.section):

   - Directory: role, manager, team, availability today and open work for
     everyone in scope. Ordinary directory information only; contract, hours
     and probation stay in the person panel for those allowed to see them.
   - Teams: each team with its manager, members, workload and open work.
   - Availability: weekly allocation from scheduled hours (minus approved
     leave) against estimates of the work due that week. Work without an
     estimate is counted as unestimated, never as zero hours.
   - Onboarding: joiners and leavers with their checklists, probation reviews
     and access reviews.
   - Documents and training: signatures and acknowledgements, certificates
     and training, with policy acknowledgements in Standards when enabled.

   Invitations, accounts and access administration stay in Settings. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useCore, store, navigate, scopeLabel, scopeOptions, scopeKey, moduleEnabled, canSeeEmployment, personRows, weeklyAllocation,
  addDaysKey, mondayOf, localDay, fmtDate, type Id, type Person, type ScopeSel
} from "../../core";
import type { ModulePageProps } from "../modules/registry";
import { Btn, FilterChip, Pill, eyebrowOf, Panel } from "../frame";
import { NoAccess, PersonName, SidePanel } from "../kit";
import { Ico, WI, WorkHead } from "../work/shared";
import { PersonPanel } from "../people/PersonPanel";
import { LeavePanel, LEAVE_FORM } from "../people/LeavePanel";
import { OnboardPanel } from "../people/OnboardPanel";
import { AccessPanel, AwayPanel, CertsPanel, DocsPanel, JoinersPanel, ProbationPanel } from "../people/SupportPanels";
import { ICONS, LEAVE_LABEL, isManagerViewer } from "../people/util";
import { I } from "../people/bits";
import "../../styles/people.css";

type Section = "directory" | "teams" | "availability" | "onboarding" | "documents";
const SECTIONS: Section[] = ["directory", "teams", "availability", "onboarding", "documents"];
const TITLE: Record<Section, string> = { directory: "Directory", teams: "Teams", availability: "Availability", onboarding: "Onboarding", documents: "Documents and training" };

type PanelState = { kind: "person"; id: Id } | { kind: "leave" } | { kind: "onboard" } | { kind: "team"; id: Id } | null;

export default function PeopleModulePage({ section }: ModulePageProps) {
  const { core, q, session } = useCore();
  const sec: Section = SECTIONS.includes(section as Section) ? (section as Section) : "directory";
  const [panel, setPanel] = useState<PanelState>(null);
  const label = core.config.modules.people?.label || "People";

  /* Links from other pages: openObject("person", id). */
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "person" && f.id) { setPanel({ kind: "person", id: f.id }); store.setSession({ focus: null }); }
    if (f && f.kind === "team" && f.id) { setPanel({ kind: "team", id: f.id }); store.setSession({ focus: null }); }
  }, [session.focus]);

  if (q.viewer.person.kind !== "staff") return <div className="pf-page"><NoAccess what="the staff directory" /></div>;
  const rows = personRows(q);
  const manager = isManagerViewer(q);
  const leaveForm = core.config.requestForms.some((f) => f.id === LEAVE_FORM && f.enabled);
  const openPerson = (id: Id) => setPanel({ kind: "person", id });

  const primary = sec === "directory" || sec === "availability"
    ? <Btn primary onClick={() => setPanel({ kind: "leave" })} disabled={!leaveForm}
        title={leaveForm ? "Ask for time off. It goes through the normal approvals." : "No leave request form is set up. An administrator can add one in Settings, Request forms."}><I d={ICONS.leave} size={14} sw={1.9} />Request leave</Btn>
    : sec === "onboarding" && manager
      ? <Btn primary onClick={() => setPanel({ kind: "onboard" })}><I d={ICONS.seed} size={14} />Start onboarding</Btn>
      : sec === "teams"
        ? <Btn onClick={() => navigate({ page: "Settings", section: "people" })} title="Teams, memberships, invitations and access are managed in Settings">Teams and access in Settings</Btn>
        : undefined;

  return (
    <div className="pf-page pm-page" style={{ maxWidth: 1280 }}>
      <WorkHead eyebrow={eyebrowOf(label, TITLE[sec], scopeLabel(core, session.scope))} title={TITLE[sec]} primary={primary}
        info={sec === "directory" ? "Who works here, their role, manager, team and availability today. Employment details are only shown to people allowed to see them."
          : sec === "availability" ? "Scheduled hours against estimated work due each week. Tasks with no estimate are listed as unestimated, not counted as zero."
          : sec === "teams" ? "Each team with its manager, members and open work." : undefined} />

      {sec === "directory" && <Directory onOpen={openPerson} />}
      {sec === "teams" && <Teams onOpen={(id) => setPanel({ kind: "team", id })} onPerson={openPerson} />}
      {sec === "availability" && <Availability onOpen={openPerson} />}
      {sec === "onboarding" && (
        core.data.employment.length === 0 ? <NoEmployment /> : (
          <div className="pp-grid">
            {manager && <JoinersPanel rows={rows} onOpen={openPerson} />}
            {manager && <ProbationPanel rows={rows} onOpen={openPerson} />}
            {manager && <AccessPanel rows={rows} onOpen={openPerson} />}
            {!manager && <Panel title="Onboarding" meta="Checklists and reviews"><div className="pp-panel-empty">Onboarding checklists and probation reviews are run by managers. Your own record is in the Directory.</div></Panel>}
          </div>
        )
      )}
      {sec === "documents" && (core.data.employment.length === 0 ? <NoEmployment /> : <Documents rows={rows} onOpen={openPerson} />)}

      {panel?.kind === "person" && <PersonPanel key={panel.id} personId={panel.id} onClose={() => setPanel(null)} />}
      {panel?.kind === "leave" && <LeavePanel onClose={() => setPanel(null)} />}
      {panel?.kind === "onboard" && <OnboardPanel rows={rows} onClose={() => setPanel(null)} />}
      {panel?.kind === "team" && <TeamPanel teamId={panel.id} onClose={() => setPanel(null)} onPerson={openPerson} />}
    </div>
  );
}

function NoEmployment() {
  return (
    <section className="pp-card"><div className="pf-empty" style={{ borderTop: 0 }}>
      <b>No employment records yet</b>
      <span>Add people in Settings, People and access. Their stage, contract, certificates and documents then show here.</span>
      <div style={{ marginTop: 14 }}><Btn small onClick={() => navigate({ page: "Settings", section: "people" })}>Open People and access</Btn></div>
    </div></section>
  );
}

/* ── Shared reads ──────────────────────────────────────────────────────── */

/** Teams the selected scope covers, for directory and team views. */
function scopeTeamIds(core: ReturnType<typeof useCore>["core"], q: ReturnType<typeof useCore>["q"], sel: ScopeSel): Id[] {
  if (sel.kind === "team") return [sel.id];
  if (sel.kind === "unit") return core.config.teams.filter((t) => t.unitId === sel.id).map((t) => t.id);
  if (sel.kind === "personal") return [...new Set([...q.viewer.memberTeamIds, ...q.viewer.overseenTeamIds])];
  return core.config.teams.map((t) => t.id);
}

function useDirectory() {
  const { core, q, ctx } = useCore();
  const tz = core.config.timezone;
  const teams = scopeTeamIds(core, q, ctx.scope);
  const orgWide = ctx.scope.kind === "organisation";
  const staff = core.data.people.filter((p) => p.kind === "staff" && p.status !== "suspended");
  const openTasks = q.tasks({ ignoreScope: true }).filter((t) => q.isOpenTask(t));
  const today = localDay(ctx.now, tz);
  return staff.map((p) => {
    const memberOf = core.data.memberships.filter((m) => m.personId === p.id).map((m) => m.teamId);
    const e = core.data.employment.find((x) => x.personId === p.id && x.stage !== "left");
    const sensitive = !!e && canSeeEmployment(q, e);
    const away = core.data.leave.find((l) => l.personId === p.id && l.status === "approved" && localDay(l.from, tz) <= today && localDay(l.to, tz) >= today) || null;
    const mine = openTasks.filter((t) => t.assigneeId === p.id);
    return {
      p, memberOf, e, sensitive, away,
      managerId: e?.managerId,
      open: mine.length, overdue: mine.filter((t) => q.isOverdue(t)).length
    };
  }).filter((r) => orgWide || r.memberOf.some((t) => teams.includes(t)) || r.p.id === q.viewer.person.id);
}

/* ── Directory ─────────────────────────────────────────────────────────── */

function Directory({ onOpen }: { onOpen: (id: Id) => void }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const all = useDirectory();
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");
  const [today, setToday] = useState("");
  const teams = [...new Set(all.flatMap((r) => r.memberOf))];
  const needle = search.trim().toLowerCase();
  const rows = all.filter((r) => (!team || r.memberOf.includes(team)) && (!today || (today === "away" ? !!r.away : !r.away))
    && (!needle || [r.p.name, r.p.title, ...r.memberOf.map((t) => q.teamLabel(t)), q.name(r.managerId)].join(" ").toLowerCase().includes(needle)))
    .sort((a, b) => a.p.name.localeCompare(b.p.name));
  if (core.data.people.filter((p) => p.kind === "staff").length === 0) return <NoEmployment />;
  return (
    <>
      <div className="pp-toolbar">
        <label className="pp-search"><I d={ICONS.search} size={13} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, role, team or manager" aria-label="Search the directory" /></label>
        {teams.length > 1 && <FilterChip label="Team" value={team} onChange={setTeam} options={[{ value: "", label: "Any team" }, ...teams.map((id) => ({ value: id, label: q.teamLabel(id) }))]} />}
        <FilterChip label="Today" value={today} onChange={setToday} options={[{ value: "", label: "Anyone today" }, { value: "in", label: "Available today" }, { value: "away", label: "Away today" }]} />
        <span className="wk-small" style={{ marginLeft: "auto" }}>{rows.length} of {all.length} people</span>
      </div>
      <section className="wk-card wk-tcard" aria-label="Directory">
        {rows.length ? (
          <div className="wk-scroll">
            <table className="wk-table" style={{ minWidth: 820 }}>
              <thead><tr><th>Person</th><th>{core.config.terminology.team}</th><th>Manager</th><th>Today</th><th style={{ textAlign: "right" }}>Open work</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.p.id} tabIndex={0} onClick={() => onOpen(r.p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r.p.id); } }} aria-label={"Open " + r.p.name}>
                    <td className="wk-strong"><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span className="pp-av" style={{ width: 28, height: 28, fontSize: 10.5 }} aria-hidden="true">{q.initials(r.p.id)}</span>
                      <span>{r.p.name}<span className="pp-title">{r.p.title}</span>{r.p.status === "invited" && <span className="wk-small"> (invited)</span>}</span>
                    </span></td>
                    <td>{r.memberOf.map((t) => q.teamLabel(t)).join(", ") || "No team"}</td>
                    <td>{r.managerId ? q.name(r.managerId) : <span className="pk-faint">None recorded</span>}</td>
                    <td>{r.away ? <Pill tone="warn">{"Away" + (r.sensitive ? ", " + LEAVE_LABEL[r.away.kind].toLowerCase() : "") + " to " + fmtDate(r.away.to, tz)}</Pill> : <Pill tone="ok">Available</Pill>}</td>
                    <td style={{ textAlign: "right" }} className="pk-mono">{r.open}{r.overdue ? <span style={{ color: "var(--bad)" }}>{", " + r.overdue + " overdue"}</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="wk-empty" style={{ borderTop: 0 }}><b>Nobody matches</b><span>Clear the search or a filter, or widen the scope in the top bar.</span></div>}
        <div className="pk-tfoot" style={{ padding: "10px 18px" }}>Open work counts tasks you can see. It is not a performance measure. Contract, hours and probation are in each person's panel for their manager and administrators only.</div>
      </section>
    </>
  );
}

/* ── Teams ─────────────────────────────────────────────────────────────── */

function teamManagerIds(core: ReturnType<typeof useCore>["core"], teamId: Id): Id[] {
  const t = core.config.teams.find((x) => x.id === teamId);
  const ids = new Set<Id>(t?.ownerId ? [t.ownerId] : []);
  for (const ra of core.data.roleAssignments) if (ra.scope.kind === "team" && ra.scope.teamId === teamId && ra.roleId !== "contributor") ids.add(ra.personId);
  return [...ids];
}

function useTeamFacts() {
  const { core, q, ctx } = useCore();
  const ids = scopeTeamIds(core, q, ctx.scope).filter((id) => core.config.teams.some((t) => t.id === id));
  const open = q.tasks({ ignoreScope: true }).filter((t) => q.isOpenTask(t));
  return ids.map((id) => {
    const t = core.config.teams.find((x) => x.id === id)!;
    const members = core.data.memberships.filter((m) => m.teamId === id).map((m) => m.personId)
      .filter((pid) => core.data.people.some((p) => p.id === pid && p.kind === "staff" && p.status !== "suspended"));
    const tasks = open.filter((x) => x.teamId === id);
    const est = tasks.filter((x) => typeof x.estimateHours === "number");
    return {
      t, members, managers: teamManagerIds(core, id), tasks,
      unassigned: tasks.filter((x) => !x.assigneeId).length, overdue: tasks.filter((x) => q.isOverdue(x)).length,
      blocked: tasks.filter((x) => q.blockers(x).length > 0).length,
      estHours: est.reduce((n, x) => n + (x.estimateHours as number), 0), unestimated: tasks.length - est.length,
      requests: q.requests({ ignoreScope: true }).filter((r) => r.teamId === id && (r.status === "submitted" || r.status === "changes_requested")).length
    };
  });
}

function Teams({ onOpen, onPerson }: { onOpen: (id: Id) => void; onPerson: (id: Id) => void }) {
  const { core, q } = useCore();
  const facts = useTeamFacts();
  if (!core.config.teams.length) return <section className="pp-card"><div className="pf-empty" style={{ borderTop: 0 }}><b>No teams yet</b><span>An administrator can add teams in Settings, Organisation.</span></div></section>;
  return (
    <section className="wk-card wk-tcard" aria-label="Teams">
      <div className="wk-scroll">
        <table className="wk-table" style={{ minWidth: 900 }}>
          <thead><tr><th>{core.config.terminology.team}</th><th>Manager</th><th>Members</th><th style={{ textAlign: "right" }}>Open work</th><th style={{ textAlign: "right" }}>Unclaimed</th><th style={{ textAlign: "right" }}>Overdue</th><th>Estimated</th><th style={{ textAlign: "right" }}>Requests in review</th></tr></thead>
          <tbody>
            {facts.map((f) => (
              <tr key={f.t.id} tabIndex={0} onClick={() => onOpen(f.t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(f.t.id); } }} aria-label={"Open " + f.t.label}>
                <td className="wk-strong">{f.t.label}{f.t.unitId ? <span className="pp-title">{q.unitLabel(f.t.unitId)}</span> : null}</td>
                <td>{f.managers.length ? f.managers.map((id) => q.name(id)).join(", ") : <span className="pk-faint">None</span>}</td>
                <td title={f.members.map((id) => q.name(id)).join(", ")}>
                  <button type="button" className="wk-plink" onClick={(e) => { e.stopPropagation(); if (f.members[0]) onPerson(f.members[0]); }} style={{ color: "var(--body)" }} aria-label={f.members.length + " members"}>{f.members.length} {f.members.length === 1 ? "person" : "people"}</button>
                </td>
                <td style={{ textAlign: "right" }} className="pk-mono">{f.tasks.length}</td>
                <td style={{ textAlign: "right" }} className="pk-mono">{f.unassigned}</td>
                <td style={{ textAlign: "right", color: f.overdue ? "var(--bad)" : undefined }} className="pk-mono">{f.overdue}</td>
                <td>{f.estHours ? Math.round(f.estHours * 10) / 10 + " h" : "0 h"}{f.unestimated ? <span className="wk-small">{", " + f.unestimated + " unestimated"}</span> : ""}</td>
                <td style={{ textAlign: "right" }} className="pk-mono">{f.requests}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pk-tfoot" style={{ padding: "10px 18px" }}>Teams in the selected scope. Open one for its members and queue. Membership is changed in Settings.</div>
    </section>
  );
}

function TeamPanel({ teamId, onClose, onPerson }: { teamId: Id; onClose: () => void; onPerson: (id: Id) => void }) {
  const { core, q } = useCore();
  const f = useTeamFacts().find((x) => x.t.id === teamId);
  const t = core.config.teams.find((x) => x.id === teamId);
  const opts = scopeOptions(core, q.viewer);
  const canScope = opts.some((o) => o.key === scopeKey({ kind: "team", id: teamId }));
  const open = q.tasks({ ignoreScope: true }).filter((x) => q.isOpenTask(x));
  const toWork = () => {
    onClose();
    if (canScope) store.setScope({ kind: "team", id: teamId });
    navigate({ page: "Work", section: "team" });
  };
  return (
    <SidePanelLite title={t?.label || "Team"} eyebrow={(t?.unitId ? q.unitLabel(t.unitId) + " · " : "") + core.config.terminology.team} onClose={onClose}
      footer={<><Btn onClick={toWork} disabled={!canScope} title={canScope ? "Open this team's queue in Work" : "This team is not one of your scopes"}>Open in Team work</Btn></>}>
      {!f ? <div className="wk-muted">This team is outside the selected scope. Widen the scope in the top bar.</div> : (
        <>
          <div className="wk-small" style={{ marginBottom: 10 }}>{f.tasks.length} open tasks, {f.unassigned} unclaimed, {f.overdue} overdue, {f.unestimated} unestimated.</div>
          <div className="pp-plist">
            {f.members.map((id) => {
              const mine = open.filter((x) => x.assigneeId === id && x.teamId === teamId);
              return (
                <button key={id} type="button" className="pp-pi pp-link" style={{ width: "100%" }} onClick={() => onPerson(id)}>
                  <div className="pp-li-main"><div className="pp-li-t"><PersonName id={id} /></div>
                    <div className="pp-li-s">{core.data.people.find((p) => p.id === id)?.title}{f.managers.includes(id) ? ", manager" : ""}</div></div>
                  <span className="pk-mono" style={{ fontSize: 12 }}>{mine.length} open</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </SidePanelLite>
  );
}

/* A thin wrapper so the team panel uses the shared side panel. */
function SidePanelLite({ title, eyebrow, onClose, footer, children }: { title: string; eyebrow: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  return <SidePanel open onClose={onClose} width={520} eyebrow={eyebrow} title={title} footer={footer}>{children}</SidePanel>;
}

/* ── Availability ──────────────────────────────────────────────────────── */

function Availability({ onOpen }: { onOpen: (id: Id) => void }) {
  const { core, q, ctx } = useCore();
  const tz = core.config.timezone;
  const thisWeek = mondayOf(localDay(ctx.now, tz));
  const [week, setWeek] = useState(thisWeek);
  const alloc = useMemo(() => weeklyAllocation(q, week), [q, week]);
  const people = new Map<Id, Person>(core.data.people.map((p) => [p.id, p]));
  const fmt = (k: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(k + "T12:00:00Z"));
  const totalUnest = alloc.reduce((n, a) => n + a.unestimatedTaskIds.length, 0);
  const showTasks = (ids: Id[], label: string) => navigate({ page: "Work", section: "team", focus: { kind: "ids", ids, label } });
  const visible = core.data.employment.filter((e) => e.stage !== "left").length;

  return (
    <>
      <div className="wk-viewbar">
        <div className="wk-mini-seg" role="group" aria-label="Week">
          <button type="button" onClick={() => setWeek(addDaysKey(week, -7))}>Previous</button>
          <button type="button" aria-pressed={week === thisWeek} onClick={() => setWeek(thisWeek)}>This week</button>
          <button type="button" onClick={() => setWeek(addDaysKey(week, 7))}>Next</button>
        </div>
        <span className="wk-card-t" style={{ fontSize: 13.5 }}>Week of {fmt(week)}</span>
        {totalUnest > 0 && <Pill tone="warn">{totalUnest} task{totalUnest === 1 ? "" : "s"} without an estimate</Pill>}
      </div>
      <section className="wk-card wk-tcard" aria-label="Weekly allocation">
        {alloc.length === 0 ? (
          <div className="wk-empty" style={{ borderTop: 0 }}>
            <b>{visible ? "No allocation you can see in this scope" : "No employment records yet"}</b>
            <span>{visible ? "Scheduled hours are employment details, shown to a person's manager and administrators. Widen the scope or ask an administrator." : "Add people in Settings, People and access. Their contracted hours then show here."}</span>
          </div>
        ) : (
          <div className="wk-scroll">
            <table className="wk-table" style={{ minWidth: 900 }}>
              <thead><tr><th>Person</th><th style={{ textAlign: "right" }}>Scheduled</th><th style={{ textAlign: "right" }}>Leave</th><th style={{ textAlign: "right" }}>Available</th><th style={{ textAlign: "right" }}>Estimated work due</th><th>Unestimated</th><th>Allocation</th></tr></thead>
              <tbody>
                {alloc.sort((a, b) => (people.get(a.personId)?.name || "").localeCompare(people.get(b.personId)?.name || "")).map((a) => {
                  const over = a.load !== null && a.load > 1;
                  const pct = a.load === null ? 0 : Math.min(100, Math.round(a.load * 100));
                  return (
                    <tr key={a.personId} tabIndex={0} onClick={() => onOpen(a.personId)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(a.personId); } }}>
                      <td className="wk-strong">{people.get(a.personId)?.name || "Unknown"}</td>
                      <td style={{ textAlign: "right" }} className="pk-mono">{a.scheduledHours} h</td>
                      <td style={{ textAlign: "right" }} className="pk-mono">{a.leaveHours ? Math.round(a.leaveHours * 10) / 10 + " h" : "None"}</td>
                      <td style={{ textAlign: "right" }} className="pk-mono">{Math.round(a.availableHours * 10) / 10} h</td>
                      <td style={{ textAlign: "right" }} className="pk-mono">{Math.round(a.estimatedHours * 10) / 10} h <span className="wk-small">({a.estimatedTaskIds.length} task{a.estimatedTaskIds.length === 1 ? "" : "s"})</span></td>
                      <td>{a.unestimatedTaskIds.length
                        ? <button type="button" className="wk-plink" onClick={(e) => { e.stopPropagation(); showTasks(a.unestimatedTaskIds, "unestimated work for " + (people.get(a.personId)?.name || "this person")); }}>{a.unestimatedTaskIds.length} task{a.unestimatedTaskIds.length === 1 ? "" : "s"}, hours unknown</button>
                        : <span className="pk-faint">None</span>}</td>
                      <td>
                        {a.load === null ? <span className="pk-faint">No hours available</span> : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span className="pm-bar" aria-hidden="true"><span style={{ transform: "scaleX(" + pct / 100 + ")", background: over ? "var(--bad)" : "var(--accent)" }} /></span>
                            <span style={{ color: over ? "var(--bad)" : "var(--body)" }}>{Math.round(a.load * 100)}%{over ? ", over" : ""}{a.unestimatedTaskIds.length ? " plus unknown" : ""}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pk-tfoot" style={{ padding: "10px 18px" }}>Scheduled hours come from each contract; approved leave on working days is taken off. Estimated work is open tasks due this week that have an estimate. Tasks without one are listed as unestimated and are not counted as zero, so an allocation with unknown work may be higher than shown.</div>
      </section>
      <div className="pp-grid"><AwayPanel onOpen={onOpen} /></div>
    </>
  );
}

/* ── Documents and training ────────────────────────────────────────────── */

function Documents({ rows, onOpen }: { rows: ReturnType<typeof personRows>; onOpen: (id: Id) => void }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const standards = moduleEnabled(core.config, "standards");
  const training = rows.flatMap((r) => r.certs.map((c) => ({ r, c }))).sort((a, b) => (a.c.days ?? -9999) - (b.c.days ?? -9999));
  const TXT = { ok: "In date", due: "Due", lapsed: "Lapsed", missing: "Not recorded" } as const;
  const TONE = { ok: "ok", due: "warn", lapsed: "bad", missing: "neutral" } as const;
  return (
    <>
      {standards && (
        <div className="pp-note" role="note"><Ico d={WI.doc} size={13} />
          Policy acknowledgements are tracked in Standards, with the exact policy version each person acknowledged.
          <button type="button" className="wk-plink" style={{ marginLeft: "auto" }} onClick={() => navigate({ page: "Standards", section: "policies" })}>Open Standards, Policies</button>
        </div>
      )}
      <div className="pp-grid">
        <DocsPanel rows={rows} onOpen={onOpen} />
        <CertsPanel rows={rows} onOpen={onOpen} />
      </div>
      <section className="wk-card wk-tcard" aria-label="Training records" style={{ marginTop: 12 }}>
        <div className="wk-viewbar"><span className="wk-card-t">Certificates and training</span><span className="wk-small">{training.length} records you can see</span></div>
        {training.length ? (
          <div className="wk-scroll">
            <table className="wk-table" style={{ minWidth: 700 }}>
              <thead><tr><th>Person</th><th>Certificate or training</th><th>Status</th><th>Expires</th><th>Renewal</th></tr></thead>
              <tbody>
                {training.slice(0, 60).map(({ r, c }) => (
                  <tr key={r.person.id + c.cert.id} tabIndex={0} onClick={() => onOpen(r.person.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r.person.id); } }}>
                    <td className="wk-strong">{r.person.name}</td>
                    <td>{c.cert.name}</td>
                    <td><Pill tone={TONE[c.state]}>{TXT[c.state]}</Pill></td>
                    <td>{c.cert.expires ? fmtDate(c.cert.expires, tz) : <span className="pk-faint">Not recorded</span>}</td>
                    <td>{c.cert.renewEveryMonths ? "Every " + c.cert.renewEveryMonths + " months" : "None set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="wk-empty"><b>No certificates recorded</b><span>Certificates and training appear here once they are recorded on employment records.</span></div>}
      </section>
      <div className="wk-small" style={{ marginTop: 10 }}>Only records you are allowed to see are listed: your own, and the people you manage. {q.viewer.isOrgWide ? "" : "Administrators see everyone."}</div>
    </>
  );
}

