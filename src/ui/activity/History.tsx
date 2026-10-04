/* Activity > History: the searchable, filterable audit table (time, actor,
   event, object, source, outcome). Rows come from q.events(), so permissions
   and scope apply; export writes exactly the filtered rows and needs the
   export permission when governance requires it. */

import { useMemo, useState } from "react";
import { useCore, store, ops, can, fmtDateTime, relative, toCsv, ms, DAY, scopeLabel, type AuditEvent } from "../../core";
import { downloadText, Icon } from "../kit";
import { Btn, FilterChip, Pill } from "../frame";
import { ACTOR_KIND_LABEL, actionLabel, objectResolver } from "./eventInfo";

type Period = "24h" | "7d" | "30d" | "all";
const PERIODS: { value: Period; label: string; days: number | null }[] = [
  { value: "24h", label: "Last 24 hours", days: 1 }, { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 }, { value: "all", label: "All time", days: null }
];

type Outcome = "failed" | "simulated" | "recorded";
export const outcomeOf = (e: AuditEvent): Outcome => /fail/.test(e.action) ? "failed" : e.simulated ? "simulated" : "recorded";
const OUTCOME_LABEL: Record<Outcome, string> = { failed: "Failed", simulated: "Simulated", recorded: "Recorded" };
const OUTCOME_TONE = { failed: "bad", simulated: "warn", recorded: "ok" } as const;
const STREAM_OPTS = [{ value: "", label: "Everyone" }, { value: "person", label: "People" }, { value: "agent", label: "Agents" }, { value: "system", label: "Systems and syncs" }];

const PAGE = 30;

export default function History({ openId, onOpen }: { openId: string | null; onOpen: (id: string) => void }) {
  const { q, ctx, core, session } = useCore();
  const tz = core.config.timezone;
  const T = core.config.terminology;
  const scope = scopeLabel(core, session.scope);
  const events = useMemo(() => q.events(), [q]);
  const resolve = useMemo(() => objectResolver(q), [q]);
  const objCache = useMemo(() => new Map(events.map((e) => [e.id, resolve(e)])), [events, resolve]);
  const objOf = (e: AuditEvent) => objCache.get(e.id) || resolve(e);
  const sourceOf = (e: AuditEvent) => (e.actorKind === "source" ? q.name(e.actorId) : "Pulse");

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [stream, setStream] = useState("");
  const [actor, setActor] = useState("");
  const [type, setType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const actorOptions = useMemo(() => [...new Set(events.map((e) => e.actorId))].map((id) => ({ value: id, label: q.name(id) })).sort((a, b) => a.label.localeCompare(b.label)), [events, q]);
  const typeOptions = useMemo(() => [...new Set(events.map((e) => e.action))].map((a) => ({ value: a, label: actionLabel(a) })).sort((a, b) => a.label.localeCompare(b.label)), [events]);
  const days = PERIODS.find((p) => p.value === period)!.days;
  const since = days === null ? null : ms(ctx.now) - days * DAY;
  const needle = search.trim().toLowerCase();
  const rows = events
    .filter((e) => (since === null || ms(e.at) >= since)
      && (!stream || (stream === "system" ? e.actorKind === "system" || e.actorKind === "source" : e.actorKind === stream))
      && (!actor || e.actorId === actor) && (!type || e.action === type) && (!outcome || outcomeOf(e) === outcome)
      && (!needle || [e.summary, q.name(e.actorId), actionLabel(e.action), objOf(e).label, objOf(e).type, sourceOf(e)].join(" ").toLowerCase().includes(needle)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const filtered = !!needle || period !== "all" || !!stream || !!actor || !!type || !!outcome;
  const clear = () => { setSearch(""); setPeriod("all"); setStream(""); setActor(""); setType(""); setOutcome(""); };
  const shown = rows.slice(0, limit);

  const canExport = !core.config.governance.exportRequiresPermission || can(q.viewer, "export");
  const exportCsv = () => {
    const res = store.run(ops.logExport, "Activity history (" + scope + ", " + PERIODS.find((p) => p.value === period)!.label.toLowerCase() + (filtered ? ", filtered" : "") + ")", rows.length);
    if (!res.ok) return;
    const cols = [{ key: "when", label: "Time" }, { key: "actor", label: "Person or agent" }, { key: "actorKind", label: "Actor kind" }, { key: "event", label: "Event" },
      { key: "action", label: "Action" }, { key: "object", label: "Object" }, { key: "team", label: T.team }, { key: "source", label: "Source" }, { key: "outcome", label: "Outcome" }];
    const data = rows.map((e) => ({
      when: fmtDateTime(e.at, tz), actor: q.name(e.actorId), actorKind: ACTOR_KIND_LABEL[e.actorKind], event: e.summary, action: e.action,
      object: objOf(e).type + " " + objOf(e).label, team: e.teamId ? q.teamLabel(e.teamId) : "", source: sourceOf(e), outcome: OUTCOME_LABEL[outcomeOf(e)]
    }));
    downloadText("activity-history.csv", toCsv(cols, data));
  };

  return (
    <section className="pf-panel" style={{ overflow: "hidden" }} aria-label="History">
      <div className="act-tools act-tools--top">
        <label className="act-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" /></svg>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} placeholder="Search events, people, agents, objects or sources" aria-label="Search history" />
        </label>
        <FilterChip label="Period" value={period} onChange={(x) => setPeriod(x as Period)} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        <FilterChip label="Stream" value={stream} onChange={setStream} options={STREAM_OPTS} />
        <FilterChip label="Person or agent" value={actor} onChange={setActor} options={[{ value: "", label: "Anyone" }, ...actorOptions]} />
        <FilterChip label="Event type" value={type} onChange={setType} options={[{ value: "", label: "Any event" }, ...typeOptions]} />
        <FilterChip label="Outcome" value={outcome} onChange={setOutcome} options={[{ value: "", label: "Any outcome" }, ...(Object.keys(OUTCOME_LABEL) as Outcome[]).map((s) => ({ value: s, label: OUTCOME_LABEL[s] }))]} />
        <Btn small onClick={exportCsv} disabled={!canExport || rows.length === 0}
          title={!canExport ? "Your role cannot export data" : rows.length === 0 ? "Nothing to export with these filters" : "Download exactly these " + rows.length + " rows as CSV (local file)"}>
          <Icon d="M12 3.5v11 M7.5 10 12 14.5 16.5 10 M4.5 19.5h15" size={13} sw={1.8} />Export
        </Btn>
      </div>
      <div className="pf-table-wrap">
        <div className="act-table" role="table" aria-label="Audit history">
          <div className="act-th" role="row">
            {["Time", "Person or agent", "Event", "Object", "Source", "Outcome"].map((c) => <div key={c} role="columnheader">{c}</div>)}
          </div>
          {shown.map((e) => {
            const o = objOf(e);
            const oc = outcomeOf(e);
            return (
              <button key={e.id} type="button" role="row" className="act-tr" aria-current={e.id === openId || undefined} onClick={() => onOpen(e.id)}>
                <span role="cell" className="act-td act-td--time" title={relative(e.at, ctx.now, tz)}>{fmtDateTime(e.at, tz)}</span>
                <span role="cell" className="act-td">{q.name(e.actorId)}{e.actorKind !== "person" && <span className="act-kind"> {ACTOR_KIND_LABEL[e.actorKind]}</span>}</span>
                <span role="cell" className="act-td act-td--event" title={actionLabel(e.action)}>{e.summary}</span>
                <span role="cell" className="act-td" title={o.type + " " + o.label}><span className="act-kind">{o.type} </span>{o.label}</span>
                <span role="cell" className="act-td">{sourceOf(e)}</span>
                <span role="cell" className="act-td"><Pill tone={OUTCOME_TONE[oc]}>{OUTCOME_LABEL[oc]}</Pill></span>
              </button>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && (
        <div className="pf-empty">
          {events.length === 0 ? (
            <><b>No activity recorded yet</b><span>Activity is recorded when people, agents and sources change tasks, requests, approvals and records. Create a task in Work or a record in Records to start the trail.</span></>
          ) : (
            <><b>No events match</b><span>Widen the period, choose someone else or clear the search.</span>{filtered && <div style={{ marginTop: 14 }}><Btn small onClick={clear}>Clear filters</Btn></div>}</>
          )}
        </div>
      )}
      <div className="act-foot">
        <span className="act-grow">Showing {shown.length} of {rows.length} matching events{rows.length !== events.length ? " (" + events.length + " recorded in " + scope + ")" : ""}{!canExport ? ". Export is not available to your role" : ""}</span>
        {rows.length > shown.length && <Btn small onClick={() => setLimit((l) => l + PAGE)}>Show more</Btn>}
        <span>Newest first</span>
      </div>
    </section>
  );
}
