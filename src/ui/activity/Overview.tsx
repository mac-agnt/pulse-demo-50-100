/* Activity > Overview, in the Base Pulse layout: four stat tiles (the active
   one filled with the accent), three compact streams (Data, People, Agents)
   made of stories rather than single events, a short summary of what changed
   in the business, and company updates. Everything is derived from the audit
   log the viewer can see in the current scope. Nothing ticks or invents
   activity; sample data is labelled as such. */

import { useMemo, useState } from "react";
import {
  useCore, navigate, openObject, relative, fmtDateTime, localDay, ms, DAY, moduleEnabled, scopeLabel,
  type AuditEvent, type Tone
} from "../../core";
import type { Q } from "../../core/query";
import { SegTabs, toneColor, toneSoft } from "../frame";
import { Icon, ICON } from "../kit";
import { ACTOR_KIND_LABEL, actionLabel } from "./eventInfo";
import { buildStories, matchesFilter, type Story, type Stream, type StreamFilter } from "./stories";
import CompanyUpdates from "./Updates";

type Period = "today" | "7d";

const STREAMS: { id: Stream; title: string; sub: string; icon: string; tint: string }[] = [
  { id: "data", title: "Data", sub: "Syncs, imports and system changes", tint: "var(--neutral)",
    icon: "M4.5 7.5c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3-3.4 3-7.5 3-7.5-1.3-7.5-3Z M4.5 7.5v9c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-9 M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" },
  { id: "people", title: "People", sub: "Decisions and changes people made", tint: "var(--warn)",
    icon: "M12 12.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z M5 20.2c.9-3.1 3.6-4.9 7-4.9s6.1 1.8 7 4.9" },
  { id: "agents", title: "Agents", sub: "Agent runs and agent actions", tint: "var(--accent)",
    icon: "M2 12h4l2.5-6 3.5 12 3-8 2 2h5" }
];

const PER_STREAM = 5;

export default function Overview({ attentionCount, onOpenEvent }: { attentionCount: number; onOpenEvent: (id: string) => void }) {
  const { q, ctx, core, session } = useCore();
  const tz = core.config.timezone;
  const scope = scopeLabel(core, session.scope);
  const [period, setPeriod] = useState<Period>("7d");
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [more, setMore] = useState<Record<string, boolean>>({});

  const events = useMemo(() => {
    const today = localDay(ctx.now, tz);
    const since = ms(ctx.now) - 7 * DAY;
    return q.events().filter((e) => e.at <= ctx.now && (period === "today" ? localDay(e.at, tz) === today : ms(e.at) >= since));
  }, [q, ctx.now, tz, period]);
  const stories = useMemo(() => buildStories(q, events), [q, events]);

  const people = new Set(events.filter((e) => e.actorKind === "person").map((e) => e.actorId)).size;
  const agentActs = events.filter((e) => e.actorKind === "agent").length;
  const pLabel = period === "today" ? "today" : "in 7 days";
  const tiles: { id: StreamFilter | "attention"; label: string; value: number; hint: string; dot: string }[] = [
    { id: "all", label: "Events " + pLabel, value: events.length, hint: stories.length + " stories in " + scope, dot: "var(--accent)" },
    { id: "people", label: "People active", value: people, hint: "changed something " + pLabel, dot: "var(--warn)" },
    { id: "agents", label: "Agent actions", value: agentActs, hint: "recorded against agents", dot: "var(--neutral)" },
    { id: "attention", label: "Needs attention", value: attentionCount, hint: "failed, overdue or waiting", dot: "var(--bad)" }
  ];
  const sample = core.mode === "sample";

  return (
    <>
      <div className="act-tiles" role="group" aria-label="Activity summary">
        {tiles.map((t, i) => {
          const on = t.id === filter;
          return (
            <button key={t.id} type="button" className="act-tile" data-on={on} aria-pressed={t.id === "attention" ? undefined : on} style={{ animationDelay: i * 70 + "ms" }}
              onClick={() => (t.id === "attention" ? navigate({ page: "Activity", section: "attention" }) : setFilter(on && t.id !== "all" ? "all" : t.id))}
              title={t.id === "attention" ? "Open Needs attention" : on ? "Showing these in the streams" : "Show these in the streams"}>
              <span className="act-tile-l"><span className="act-tile-dot" style={{ background: on ? "currentColor" : t.dot }} />{t.label}</span>
              <span className="act-tile-v" style={!on && t.id === "attention" && t.value ? { color: "var(--bad)" } : undefined}>{t.value}</span>
              <span className="act-tile-h">{t.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="act-bar">
        <SegTabs<Period> label="Period" value={period} onChange={setPeriod} options={[{ value: "today", label: "Today" }, { value: "7d", label: "Last 7 days" }]} />
        <SegTabs<StreamFilter> label="Stream filter" value={filter} onChange={setFilter}
          options={[{ value: "all", label: "Everyone" }, { value: "people", label: "People" }, { value: "agents", label: "Agents" }, { value: "systems", label: "Systems" }]} />
        <span className="act-grow" />
        <span className="act-note">Counts describe recorded events. They are not performance scores.</span>
      </div>

      <div className="act-streams">
        {STREAMS.map((d, di) => {
          const list = stories.filter((st) => st.stream === d.id && matchesFilter(st, filter));
          const shown = more[d.id] ? list : list.slice(0, PER_STREAM);
          return (
            <section key={d.id} className="act-col" aria-label={d.title} style={{ animationDelay: di * 110 + "ms" }}>
              <div className="act-col-h">
                <span className="act-col-ico" style={{ color: d.tint }}><Icon d={d.icon} size={13} sw={1.8} /></span>
                <div className="pk-grow">
                  <div className="act-col-t">{d.title}</div>
                  <div className="act-col-s">{d.sub}</div>
                </div>
                <span className="act-col-state" title={sample ? "Built from the sample organisation's recorded events. Nothing streams in live." : "Recorded events. Refreshes when something is recorded."}>
                  {sample ? "SAMPLE" : "RECORDED"} · {list.length}
                </span>
              </div>
              <div className="act-col-b">
                {shown.map((st) => <StoryCard key={st.key} st={st} onOpenEvent={onOpenEvent} />)}
                {list.length === 0 && <div className="act-col-empty">{filter === "all" ? "Nothing recorded " + pLabel + "." : "Nothing matching that filter " + pLabel + "."}</div>}
                {list.length > PER_STREAM && (
                  <button type="button" className="act-link act-col-more" onClick={() => setMore((m) => ({ ...m, [d.id]: !m[d.id] }))}>
                    {more[d.id] ? "Show fewer" : "Show " + (list.length - PER_STREAM) + " more"}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="act-lower">
        <ChangeSummary events={events} periodLabel={pLabel} />
        <CompanyUpdates />
      </div>
    </>
  );
}

/* ── One story ─────────────────────────────────────────────────────────── */

function StoryCard({ st, onOpenEvent }: { st: Story; onOpenEvent: (id: string) => void }) {
  const { q, ctx, core } = useCore();
  const tz = core.config.timezone;
  const [open, setOpen] = useState(false);
  const rail = st.why.tone === "bad" || st.why.tone === "warn" ? toneColor(st.why.tone) : "var(--track)";
  const actor = st.events.find((e) => e.actorId === st.responsibleId);
  // Lead with what happened to the object; a later comment is shown as the latest note, not the headline.
  const main = [...st.events].reverse().find((e) => e.objectType !== "comment") || st.last;
  const latestNote = main !== st.last ? st.last : null;
  return (
    <article className="act-story">
      <span className="act-story-rail" style={{ background: rail }} />
      <div className="act-story-top">
        <span className="act-story-t">{main.summary}</span>
        {(st.why.tone === "bad" || st.why.tone === "warn") && (
          <span className="act-story-chip" style={{ background: toneSoft(st.why.tone), color: toneColor(st.why.tone) }}>{st.why.tone === "bad" ? "Failed" : "Waiting"}</span>
        )}
        <span className="act-story-when" title={fmtDateTime(st.last.at, tz)}>{relative(st.last.at, ctx.now, tz)}</span>
      </div>
      <div className="act-story-why">{st.why.text}</div>
      {latestNote && <div className="act-story-why">Latest: {latestNote.summary}, {q.name(latestNote.actorId)}.</div>}
      <div className="act-story-meta">
        <span>{q.name(st.responsibleId)}{actor && actor.actorKind !== "person" ? " (" + ACTOR_KIND_LABEL[actor.actorKind].toLowerCase() + ")" : ""}</span>
        <span className="act-sep" />
        <span className="act-story-obj">{st.object.type}: {st.object.label}</span>
        {st.simulated && <span className="act-story-sim">Simulated</span>}
      </div>
      <div className="act-story-f">
        <button type="button" className="act-link" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide" : st.events.length === 1 ? "1 event" : st.events.length + " events"}
          <Icon d={ICON.down} size={10} sw={2.2} />
        </button>
        {st.object.open && !st.object.hidden && (
          <button type="button" className="act-link" onClick={() => openObject(st.object.open!.kind, st.object.open!.id)}>Open {st.object.type.toLowerCase()}</button>
        )}
      </div>
      {open && (
        <ol className="act-chain" aria-label="Events in order">
          {st.events.map((e) => (
            <li key={e.id}>
              <button type="button" className="act-chain-row" onClick={() => onOpenEvent(e.id)}>
                <span className="act-chain-when pk-mono">{fmtDateTime(e.at, tz)}</span>
                <span className="act-chain-t">{e.summary}</span>
                <span className="act-chain-who">{q.name(e.actorId)} · {actionLabel(e.action)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/* ── What changed in the business ──────────────────────────────────────── */

interface ChangeDef { id: string; one: string; many: string; tone?: Tone; match: (e: AuditEvent) => boolean; when?: (q: Q) => boolean; go: (list: AuditEvent[], q: Q) => void }

const uniq = (ids: string[]) => [...new Set(ids)];

const CHANGES: ChangeDef[] = [
  { id: "done", one: "task completed", many: "tasks completed", tone: "ok", match: (e) => e.action === "task.completed",
    go: (l) => navigate({ page: "Work", section: "team", focus: { kind: "ids", ids: uniq(l.map((e) => e.objectId)), label: "Activity, tasks completed" } }) },
  { id: "created", one: "task created", many: "tasks created", match: (e) => e.action === "task.created",
    go: (l) => navigate({ page: "Work", section: "team", focus: { kind: "ids", ids: uniq(l.map((e) => e.objectId)), label: "Activity, tasks created" } }) },
  { id: "submitted", one: "request submitted", many: "requests submitted", match: (e) => e.action === "request.submitted",
    go: (l) => (uniq(l.map((e) => e.objectId)).length === 1 ? openObject("request", l[0].objectId) : navigate({ page: "Work", section: "requests" })) },
  { id: "decided", one: "decision made", many: "decisions made", match: (e) => /^approval\.(approve|decline|return)$/.test(e.action),
    go: (l) => (l.length === 1 ? openObject("approval", l[0].objectId) : navigate({ page: "Work", section: "approvals" })) },
  { id: "applied", one: "approved action applied", many: "approved actions applied", tone: "ok", match: (e) => e.action === "request.execution.succeeded",
    go: (l) => openObject("request", l[l.length - 1].objectId) },
  { id: "failed", one: "action or run failed", many: "actions or runs failed", tone: "bad", match: (e) => /fail/.test(e.action),
    go: () => navigate({ page: "Activity", section: "attention" }) },
  { id: "records", one: "record changed", many: "records changed", match: (e) => /^record\./.test(e.action) || e.action === "sync.completed",
    go: (l) => navigate({ page: "Records", section: "browse", focus: { kind: "ids", ids: uniq(l.flatMap((e) => e.recordIds.length ? e.recordIds : [e.objectId])), label: "Activity, records changed" } }) },
  { id: "issues", one: "data issue flagged", many: "data issues flagged", tone: "warn", match: (e) => e.action === "issue.opened",
    go: (l) => navigate({ page: "Records", section: "quality", focus: { kind: "ids", ids: uniq(l.map((e) => e.objectId)), label: "Activity, issues flagged" } }) },
  { id: "projects", one: "project change", many: "project changes", match: (e) => e.objectType === "project" || e.objectType === "milestone" || e.objectType === "risk",
    when: (q) => moduleEnabled(q.s.config, "projects"),
    go: (l, q) => {
      const ids = uniq(l.map((e) => e.objectType === "project" ? e.objectId
        : e.objectType === "milestone" ? q.s.data.milestones.find((m) => m.id === e.objectId)?.projectId || ""
        : q.s.data.risks.find((r) => r.id === e.objectId)?.projectId || "").filter(Boolean));
      if (ids.length === 1) openObject("project", ids[0]); else navigate({ page: "Projects", section: "portfolio" });
    } },
  { id: "agentRuns", one: "agent run event", many: "agent run events", match: (e) => e.objectType === "agentRun",
    when: (q) => q.s.config.capabilities.agents, go: () => navigate({ page: "Agents", section: "runs" }) },
  { id: "purchasing", one: "order or invoice change", many: "order and invoice changes", match: (e) => e.objectType === "order" || e.objectType === "invoice",
    when: (q) => moduleEnabled(q.s.config, "purchasing"), go: () => navigate({ page: "Purchasing", section: "orders" }) },
  { id: "standards", one: "requirement or check change", many: "requirement and check changes", match: (e) => e.objectType === "requirement" || e.objectType === "check",
    when: (q) => moduleEnabled(q.s.config, "standards"), go: () => navigate({ page: "Standards", section: "overview" }) },
  { id: "config", one: "settings change", many: "settings changes", match: (e) => e.objectType === "config", go: () => navigate({ page: "Settings", section: "audit" }) }
];

function ChangeSummary({ events, periodLabel }: { events: AuditEvent[]; periodLabel: string }) {
  const { q } = useCore();
  const rows = CHANGES.filter((c) => !c.when || c.when(q)).map((c) => ({ c, list: events.filter(c.match) })).filter((r) => r.list.length > 0);
  return (
    <section className="pf-panel act-changes" aria-label="What changed">
      <div className="pf-panel-h">
        <div className="pk-grow">
          <div className="pf-panel-t">What changed {periodLabel}</div>
          <div className="pf-panel-m">Counted from recorded events you can see. Each line opens the records behind it.</div>
        </div>
      </div>
      {rows.length === 0 ? <div className="act-upd-empty">Nothing changed {periodLabel} in this scope.</div> : (
        <ul className="act-change-list">
          {rows.map(({ c, list }) => (
            <li key={c.id}>
              <button type="button" className="act-change" onClick={() => c.go(list, q)}>
                <span className="act-change-n" style={c.tone && c.tone !== "neutral" ? { color: toneColor(c.tone) } : undefined}>{list.length}</span>
                <span className="act-change-l">{list.length === 1 ? c.one : c.many}</span>
                <Icon d={ICON.arrow} size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

