/* Activity, in the original Pulse design language: a hero with the lens and
   scope, a stat strip that switches lens, the Attention triage cards, and the
   audit trail card over the shared audit events (q.events()).
   Counts describe recorded events; they are not productivity or performance
   measures. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCore, store, ops, openObject, navigate, scopeLabel, can, fmtDateTime, relative, toCsv, localDay, DAY, ms } from "../../core";
import type { AuditEvent } from "../../core";
import { attention, type AttentionItem } from "../selectors";
import { downloadText, Icon } from "../kit";
import { PageFrame, Hero, StatStrip, FilterChip, Btn, Panel, Pill, eyebrowOf, toneColor, toneSoft } from "../frame";
import { ACTOR_KIND_LABEL, actionLabel, objectResolver } from "./eventInfo";
import EventPanel from "./EventPanel";
import AgentOutcomesCard from "../agents/AgentOutcomesCard";
import "../../styles/activity.css";

export type ActLens = "attention" | "all" | "people" | "ai";
type Period = "24h" | "7d" | "30d" | "all";

const PERIODS: { value: Period; label: string; days: number | null }[] = [
  { value: "24h", label: "Last 24 hours", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "all", label: "All time", days: null }
];

const LENS_LABEL: Record<ActLens, string> = { attention: "Attention", all: "Everything", people: "People", ai: "Agents" };
const TITLE: Record<ActLens, string> = { attention: "What needs you", all: "Everything recorded", people: "Who did what", ai: "What the agents did" };

type Status = "failed" | "simulated" | "recorded";
const statusOf = (e: AuditEvent): Status => /fail/.test(e.action) ? "failed" : e.simulated ? "simulated" : "recorded";
const STATUS_LABEL: Record<Status, string> = { failed: "Failed", simulated: "Simulated", recorded: "Recorded" };
const STATUS_TONE = { failed: "bad", simulated: "warn", recorded: "ok" } as const;

const PAGE = 30;

export default function ActivityPage({ v }: { v: { actLens?: string } }) {
  const lens: ActLens = (["attention", "all", "people", "ai"] as const).includes(v.actLens as ActLens) ? v.actLens as ActLens : "all";
  const { q, ctx, core, session } = useCore();
  const tz = core.config.timezone;
  const T = core.config.terminology;
  const [openId, setOpenId] = useState<string | null>(null);

  // Focus hand-off: another page asked to open an event here.
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "event" && f.id) {
      setOpenId(f.id);
      store.setSession({ focus: null });
    }
  }, [session.focus]);

  const scope = scopeLabel(core, session.scope);
  const events = useMemo(() => q.events(), [q]);
  const items = useMemo(() => attention(q), [q]);

  /* Stat strip: today's recorded events in this scope. */
  const today = localDay(ctx.now, tz);
  const todays = events.filter((e) => localDay(e.at, tz) === today);
  const peopleToday = new Set(todays.filter((e) => e.actorKind === "person").map((e) => e.actorId)).size;
  const agentToday = todays.filter((e) => e.actorKind === "agent").length;
  const lensGo = (section: ActLens) => () => navigate({ page: "Activity", section });

  /* Audit trail filters */
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setActor(""); setKind(""); setType(""); setLimit(PAGE); }, [lens]);

  const resolve = useMemo(() => objectResolver(q), [q]);
  const objCache = useMemo(() => new Map(events.map((e) => [e.id, resolve(e)])), [events, resolve]);
  const objOf = (e: AuditEvent) => objCache.get(e.id) || resolve(e);

  const lensEvents = useMemo(() => events.filter((e) => lens === "people" ? e.actorKind === "person" : lens === "ai" ? e.actorKind === "agent" : true), [events, lens]);
  const actorOptions = useMemo(() => [...new Set(lensEvents.map((e) => e.actorId))].map((id) => ({ value: id, label: q.name(id) })).sort((a, b) => a.label.localeCompare(b.label)), [lensEvents, q]);
  const typeOptions = useMemo(() => [...new Set(lensEvents.map((e) => e.action))].map((a) => ({ value: a, label: actionLabel(a) })).sort((a, b) => a.label.localeCompare(b.label)), [lensEvents]);

  const days = PERIODS.find((p) => p.value === period)!.days;
  const since = days === null ? null : ms(ctx.now) - days * DAY;
  const needle = search.trim().toLowerCase();
  const sourceOf = (e: AuditEvent) => e.actorKind === "source" ? q.name(e.actorId) : "Pulse";
  const rows = lensEvents
    .filter((e) => (since === null || ms(e.at) >= since) && (!actor || e.actorId === actor) && (!kind || e.actorKind === kind)
      && (!type || e.action === type) && (!status || statusOf(e) === status)
      && (!needle || [e.summary, q.name(e.actorId), actionLabel(e.action), objOf(e).label, sourceOf(e)].join(" ").toLowerCase().includes(needle)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const filtered = !!needle || period !== "all" || !!actor || !!kind || !!type || !!status;
  const clear = () => { setSearch(""); setPeriod("all"); setActor(""); setKind(""); setType(""); setStatus(""); };

  const canExport = !core.config.governance.exportRequiresPermission || can(q.viewer, "export");
  const exportCsv = () => {
    const res = store.run(ops.logExport, "Activity, " + LENS_LABEL[lens] + " (" + scope + ")", rows.length);
    if (!res.ok) return;
    const cols = [{ key: "when", label: "Time" }, { key: "event", label: "Event" }, { key: "actor", label: "Person or agent" }, { key: "actorKind", label: "Actor kind" },
      { key: "action", label: "Action" }, { key: "related", label: "Related record" }, { key: "team", label: T.team }, { key: "source", label: "Source" }, { key: "status", label: "Status" }];
    const data = rows.map((e) => ({
      when: fmtDateTime(e.at, tz), event: e.summary, actor: q.name(e.actorId), actorKind: ACTOR_KIND_LABEL[e.actorKind], action: e.action,
      related: objOf(e).type + " " + objOf(e).label, team: e.teamId ? q.teamLabel(e.teamId) : "", source: sourceOf(e), status: STATUS_LABEL[statusOf(e)]
    }));
    downloadText("activity-" + lens + ".csv", toCsv(cols, data));
  };

  const blurb = lens === "attention" ? "Failed runs, actions that did not complete, overdue decisions and tasks, blocked work due soon and high-severity data issues in " + scope + ", most urgent first."
    : lens === "people" ? "Changes made by people in " + scope + ". Counts describe recorded events, not productivity."
    : lens === "ai" ? "Actions taken by agents in " + scope + ". Agent work uses the same tasks, requests and approvals as people."
    : "Every recorded change in " + scope + ": people, agents, Pulse itself and source syncs.";

  return (
    <PageFrame>
      <Hero eyebrow={eyebrowOf("Activity", LENS_LABEL[lens], scope)} title={TITLE[lens]} blurb={blurb}
        actions={<Btn onClick={exportCsv} disabled={!canExport || rows.length === 0}
          title={!canExport ? "Your role cannot export data" : rows.length === 0 ? "Nothing to export with these filters" : "Download the audit rows shown below as CSV (local file)"}>
          <Icon d="M12 3.5v11 M7.5 10 12 14.5 16.5 10 M4.5 19.5h15" size={14} sw={1.8} />Export audit log</Btn>}>
        <StatStrip stats={[
          { label: "Events today", value: String(todays.length), onClick: lensGo("all"), title: "Events recorded today in " + scope + ". Show everything" },
          { label: "People active today", value: String(peopleToday), onClick: lensGo("people"), title: "People who changed something today. Show people activity" },
          { label: "Agent actions", value: String(agentToday), onClick: lensGo("ai"), title: "Actions recorded by agents today. Show agent activity" },
          { label: "Needs attention", value: String(items.length), color: items.length ? "var(--bad)" : undefined, onClick: lensGo("attention"), title: "Unresolved items that need a person. Show the triage list" }
        ]} />
      </Hero>

      {lens === "attention" && <Triage items={items} scope={scope} />}

      <AuditTrail
        lens={lens} rows={rows} total={lensEvents.length} limit={limit} onMore={() => setLimit((l) => l + PAGE)}
        objOf={objOf} sourceOf={sourceOf} openId={openId} onOpen={setOpenId}
        search={search} setSearch={setSearch} filtered={filtered} clear={clear}
        chips={<>
          <FilterChip label="Period" value={period} onChange={(x) => setPeriod(x as Period)} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
          <FilterChip label="Person or agent" value={actor} onChange={setActor} options={[{ value: "", label: "Anyone" }, ...actorOptions]} />
          {(lens === "all" || lens === "attention") && (
            <FilterChip label="Actor kind" value={kind} onChange={setKind}
              options={[{ value: "", label: "Any source" }, ...(Object.keys(ACTOR_KIND_LABEL) as (keyof typeof ACTOR_KIND_LABEL)[]).map((k) => ({ value: k, label: ACTOR_KIND_LABEL[k] }))]} />
          )}
          <FilterChip label="Event type" value={type} onChange={setType} options={[{ value: "", label: "Any type" }, ...typeOptions]} />
          <FilterChip label="Status" value={status} onChange={setStatus}
            options={[{ value: "", label: "Any status" }, ...(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
        </>}
      />

      {lens === "ai" && <div style={{ marginTop: 22 }}><AgentOutcomesCard /></div>}
      {!canExport && <div className="act-foot-note">Export is not available to your role.</div>}

      <EventPanel eventId={openId} onClose={() => setOpenId(null)} onSelect={setOpenId} />
    </PageFrame>
  );
}

/* ── Attention triage ──────────────────────────────────────────────────── */

const KIND_LABEL: Record<AttentionItem["kind"], string> = {
  run: "Failed run",
  execution: "Failed action",
  approval: "Overdue decision",
  task: "Overdue task",
  blocked: "Blocked task",
  issue: "Data issue"
};

function Triage({ items, scope }: { items: AttentionItem[]; scope: string }) {
  const { q, ctx, core } = useCore();
  const tz = core.config.timezone;
  const groups = [
    { tone: "bad" as const, label: "FAILED OR OVERDUE", blurb: "Stopped, or past its date.", rows: items.filter((i) => i.tone === "bad") },
    { tone: "warn" as const, label: "NEEDS A DECISION OR A FIX", blurb: "Past a deadline, blocked, or high severity.", rows: items.filter((i) => i.tone !== "bad") }
  ];

  if (items.length === 0) {
    return (
      <div className="act-tri-empty">
        <b>Nothing needs you in {scope}</b>
        <span>No failures, no overdue decisions or tasks, and no high-severity data issues. The audit trail below still has everything.</span>
      </div>
    );
  }

  return (
    <>
      {groups.filter((g) => g.rows.length > 0).map((g) => (
        <section key={g.tone} aria-label={g.label}>
          <div className="act-group-h">
            <span className="act-group-l" style={{ color: toneColor(g.tone) }}>{g.label}</span>
            <span className="act-group-b">{g.blurb}</span>
            <span className="act-group-line" />
            <span className="act-group-n">{g.rows.length}</span>
          </div>
          <div className="act-tri">
            {g.rows.map((it, i) => (
              <div key={it.key} className="act-tri-card" style={{ animationDelay: i * 55 + "ms" }}>
                <span className="act-tri-rail" style={{ background: toneColor(it.tone) }} />
                <div className="act-tri-top">
                  <span className="act-tri-title">{it.title}</span>
                  <span className="act-tri-chip" style={{ background: toneSoft(it.tone), color: toneColor(it.tone) }}>{KIND_LABEL[it.kind]}</span>
                  <span className="act-tri-wait" title={fmtDateTime(it.since, tz)}>since {relative(it.since, ctx.now, tz)}</span>
                </div>
                <div className="act-tri-reason">{it.reason}</div>
                <div className="act-tri-foot">
                  <Btn primary small onClick={() => openObject(it.objectKind, it.id)}>{it.next}</Btn>
                  <span className="act-grow" />
                  <span className="act-tri-who">Responsible: {it.ownerId ? q.name(it.ownerId) : "Nobody assigned"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/* ── Audit trail card ──────────────────────────────────────────────────── */

function AuditTrail({ lens, rows, total, limit, onMore, objOf, sourceOf, openId, onOpen, search, setSearch, filtered, clear, chips }: {
  lens: ActLens; rows: AuditEvent[]; total: number; limit: number; onMore: () => void;
  objOf: (e: AuditEvent) => { type: string; label: string; hidden?: boolean }; sourceOf: (e: AuditEvent) => string;
  openId: string | null; onOpen: (id: string) => void;
  search: string; setSearch: (s: string) => void; filtered: boolean; clear: () => void; chips: ReactNode;
}) {
  const { q, ctx, core } = useCore();
  const tz = core.config.timezone;
  const shown = rows.slice(0, limit);
  const caption = search.trim() ? "Filtered by “" + search.trim() + "”."
    : lens === "people" ? "Changes made by people, with the record each one touched."
    : lens === "ai" ? "Actions taken by agents, with the record each one touched."
    : "Every event, with who or what caused it.";

  return (
    <Panel style={{ marginTop: 22, overflow: "hidden" }} pad={false}
      title="Audit trail" meta={caption} right={<span className="act-badge">{rows.length} shown</span>}>
      <div className="act-tools">
        <label className="act-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search every event, person, record or source" aria-label="Search the audit trail" />
        </label>
        {chips}
      </div>
      <div className="pf-table-wrap">
        <div className="act-table" role="table" aria-label="Audit trail">
          <div className="act-th" role="row">
            {["Time", "Event", "Person or agent", "Related record", "Source", "Status"].map((c) => <div key={c} role="columnheader">{c}</div>)}
          </div>
          {shown.map((e) => {
            const o = objOf(e);
            const st = statusOf(e);
            return (
              <button key={e.id} type="button" role="row" className="act-tr" aria-current={e.id === openId || undefined} onClick={() => onOpen(e.id)}>
                <span role="cell" className="act-td act-td--time" title={relative(e.at, ctx.now, tz)}>{fmtDateTime(e.at, tz)}</span>
                <span role="cell" className="act-td act-td--event" title={actionLabel(e.action)}>{e.summary}</span>
                <span role="cell" className="act-td">{q.name(e.actorId)}{e.actorKind !== "person" && <span className="act-kind"> {ACTOR_KIND_LABEL[e.actorKind]}</span>}</span>
                <span role="cell" className="act-td" title={o.type + " " + o.label}><span className="act-kind">{o.type} </span>{o.label}</span>
                <span role="cell" className="act-td">{sourceOf(e)}</span>
                <span role="cell" className="act-td"><Pill tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Pill></span>
              </button>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && (
        <div className="pf-empty">
          {total === 0 ? (
            <>
              <b>{lens === "ai" ? "No agent activity recorded" : lens === "people" ? "No activity by people recorded" : "No activity recorded yet"}</b>
              <span>{lens === "ai"
                ? "Agent actions appear here once an agent configured in Settings opens a task or an issue."
                : "Activity is recorded when people, agents and sources change tasks, requests, approvals and records. Create a task in Work or a record in Records to start the trail."}</span>
            </>
          ) : (
            <>
              <b>No events match</b>
              <span>Widen the period, choose someone else or clear the search.</span>
              {filtered && <div style={{ marginTop: 14 }}><Btn small onClick={clear}>Clear filters</Btn></div>}
            </>
          )}
        </div>
      )}
      <div className="act-foot">
        <span className="act-grow">Showing {shown.length} of {rows.length} matching events{rows.length !== total ? " (" + total + " recorded in this view)" : ""}</span>
        {rows.length > shown.length && <Btn small onClick={onMore}>Show more</Btn>}
        <span>Newest first</span>
      </div>
    </Panel>
  );
}
