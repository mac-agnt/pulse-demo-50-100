/* Home, Today mode. A compact header (demo-clock date, scope, one greeting
   line) and then the main width for a briefing, decisions, an ordered list of
   priorities, today's agenda and team exceptions. Every line opens the record
   it is about or a correctly filtered queue. Blocks are shown, hidden and
   reordered through the same widget preferences as the Chat rail; nothing here
   is a separate dashboard builder. Chat mode is unchanged (views/pages/Home.tsx). */

import { useState, type ReactNode } from "react";
import {
  moduleEnabled, navigate, openObject, relative, scopeLabel, useCore, localDay, fmtHours, hoursBetween, ms, addDays,
  projectsFor, projectHealth, appointments,
  type Approval, type Tone
} from "../../core";
import type { Q } from "../../core/query";
import { attention, currentStage, waitingOnMe } from "../selectors";
import { Chip, Icon, ICON } from "../kit";
import { Widget, TeamExceptions } from "./widgets";
import { TODAY_BLOCKS, useTodayLayout } from "./prefs";
import { attentionQueue, runInline, SEVERITY_LABEL, type QueueItem } from "../activity/queue";
import "../../styles/home.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function HomeToday({ v }: { v: any }) {
  const { core, ctx, session, q } = useCore();
  const [editing, setEditing] = useState(false);
  const layout = useTodayLayout();
  const tz = core.config.timezone;
  const me = q.viewer.person;
  const scope = scopeLabel(core, session.scope);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(ctx.now));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(ctx.now)));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const queue = attentionQueue(q);
  const decisions = waitingOnMe(q).length;
  const line = [decisions ? decisions + (decisions === 1 ? " decision waits" : " decisions wait") + " on you" : "",
    queue.length ? queue.filter((x) => x.severity !== "low").length + " urgent items in " + scope : ""].filter(Boolean).join(", ")
    || "Nothing urgent in " + scope + " right now";

  const RENDER: Record<string, () => ReactNode> = {
    briefing: () => <Briefing key="briefing" />,
    priorities: () => <Priorities key="priorities" items={queue} />,
    decisions: () => <Decisions key="decisions" />,
    agenda: () => <Agenda key="agenda" />,
    teams: () => <TeamExceptions key="teams" />
  };
  const shown = layout.order.filter((id) => !layout.hidden.includes(id));

  return (
    <div className="td-page pk">
      <header className="td-head">
        <div className="pk-grow">
          <div className="pf-eyebrow">{date} · {scope}</div>
          <h1 className="td-title">{hello}, {me.name.split(" ")[0]}</h1>
          <div className="td-line">{line}.</div>
        </div>
        <div className="td-head-actions">
          <button type="button" className="pf-btn pf-btn--sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <Icon d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6V20Z" size={12} />{editing ? "Done" : "Edit"}
          </button>
          {typeof v?.setHomeMode === "function" && (
            <button type="button" className="pf-btn pf-btn--sm" onClick={() => v.setHomeMode("chat")} title="Switch Home to Chat">
              <Icon d={ICON.arrow} size={12} />Ask Pulse
            </button>
          )}
        </div>
      </header>

      {editing && (
        <fieldset className="hm-card hm-edit td-edit">
          <legend className="hm-card-t">Blocks on Today</legend>
          <p className="hm-sub" style={{ margin: "2px 0 8px", whiteSpace: "normal" }}>Show, hide and reorder blocks. Kept in this browser; your access is unchanged.</p>
          {layout.order.map((id, i) => {
            const b = TODAY_BLOCKS.find((x) => x.id === id)!;
            return (
              <div key={id} className="td-edit-row">
                <label className="hm-toggle pk-grow">
                  <input type="checkbox" checked={!layout.hidden.includes(id)} onChange={() => layout.toggle(id)} />
                  <span>{b.label}</span>
                </label>
                <button type="button" className="hm-x" disabled={i === 0} onClick={() => layout.move(id, -1)} aria-label={"Move " + b.label + " up"} title="Move up">
                  <Icon d="M6 15l6-6 6 6" size={11} sw={2.2} />
                </button>
                <button type="button" className="hm-x" disabled={i === layout.order.length - 1} onClick={() => layout.move(id, 1)} aria-label={"Move " + b.label + " down"} title="Move down">
                  <Icon d={ICON.down} size={11} sw={2.2} />
                </button>
              </div>
            );
          })}
          <button type="button" className="hm-more" onClick={layout.reset}>Restore the default layout</button>
        </fieldset>
      )}

      {shown.length === 0 ? (
        <div className="hm-card"><div className="hm-empty">Every block is hidden. Use Edit to show them again.</div></div>
      ) : (
        <div className="td-grid">
          {shown.map((id) => (
            <div key={id} className={"td-cell" + (TODAY_BLOCKS.find((b) => b.id === id)?.wide ? " td-cell--wide" : "")}>{RENDER[id]()}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Briefing ──────────────────────────────────────────────────────────── */

interface Statement { key: string; tone: Tone; text: string; go: () => void; linkLabel: string }

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

function briefing(q: Q): Statement[] {
  const s = q.s;
  const now = q.ctx.now;
  const tz = s.config.timezone;
  const T = s.config.terminology;
  const scope = scopeLabel(s, q.ctx.scope);
  const out: Statement[] = [];

  const overdue = q.tasks().filter((t) => q.isOverdue(t)).sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));
  if (overdue.length) out.push({ key: "overdue", tone: "bad", linkLabel: "Show them in Work",
    text: plural(overdue.length, T.task.toLowerCase() + " is", T.tasks.toLowerCase() + " are") + " overdue in " + scope + ", the oldest since " + relative(overdue[0].dueAt, now, tz) + ".",
    go: () => navigate({ page: "Work", section: "team", focus: { kind: "ids", ids: overdue.map((t) => t.id), label: "Today's briefing: overdue" } }) });

  const mine = waitingOnMe(q).sort((a, b) => (currentStage(a)?.startedAt || a.submittedAt).localeCompare(currentStage(b)?.startedAt || b.submittedAt));
  if (mine.length) out.push({ key: "decide", tone: "warn", linkLabel: mine.length === 1 ? "Open the decision" : "Open approvals",
    text: plural(mine.length, "decision waits", "decisions wait") + " on you; the oldest has waited " + fmtHours(hoursBetween(currentStage(mine[0])?.startedAt || mine[0].submittedAt, now)) + ".",
    go: () => (mine.length === 1 ? openObject("approval", mine[0].id) : navigate({ page: "Work", section: "approvals" })) });

  const att = attention(q);
  const failed = att.filter((a) => a.kind === "run" || a.kind === "execution");
  if (failed.length) out.push({ key: "failed", tone: "bad", linkLabel: failed.length === 1 ? "Open it" : "Open Needs attention",
    text: plural(failed.length, "workflow run or approved action has", "workflow runs or approved actions have") + " failed and need recovery.",
    go: () => (failed.length === 1 ? openObject(failed[0].objectKind, failed[0].id) : navigate({ page: "Activity", section: "attention" })) });

  const issues = q.issues().filter((i) => (i.state === "open" || i.state === "in_progress") && i.severity === "high");
  if (issues.length) out.push({ key: "issues", tone: "warn", linkLabel: "Show them in Data quality",
    text: plural(issues.length, "high-severity data issue is", "high-severity data issues are") + " open.",
    go: () => navigate({ page: "Records", section: "quality", focus: { kind: "ids", ids: issues.map((i) => i.id), label: "Today's briefing" } }) });

  if (moduleEnabled(s.config, "projects")) {
    const P = s.config.projects;
    const projects = projectsFor(q).filter((p) => p.status === "active");
    // Computed health (milestones, gates, overdue tasks, risks), the same as Projects shows.
    const health = new Map(projects.map((p) => [p.id, projectHealth(s, p, now).health]));
    const risky = projects.filter((p) => health.get(p.id) !== "on_track");
    if (risky.length) out.push({ key: "projects", tone: risky.some((p) => health.get(p.id) === "off_track") ? "bad" : "warn",
      linkLabel: risky.length === 1 ? "Open " + P.label.toLowerCase() : "Show them",
      text: plural(risky.length, P.label.toLowerCase() + " is", P.plural.toLowerCase() + " are") + " at risk or off track: " + risky.map((p) => p.title).join(", ") + ".",
      go: () => (risky.length === 1 ? openObject("project", risky[0].id) : navigate({ page: "Projects", section: "portfolio", focus: { kind: "ids", ids: risky.map((p) => p.id), label: "Today's briefing" } })) });
    const ids = new Set(projects.map((p) => p.id));
    const week = addDays(now, 7);
    const due = s.data.milestones.filter((m) => ids.has(m.projectId) && !m.completedAt && m.dueAt >= now && m.dueAt <= week).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    if (due.length) out.push({ key: "milestones", tone: "neutral", linkLabel: "Open " + P.label.toLowerCase(),
      text: plural(due.length, "milestone is", "milestones are") + " due in the next 7 days; next is " + due[0].label + " (" + relative(due[0].dueAt, now, tz) + ").",
      go: () => openObject("project", due[0].projectId) });
  }

  if (s.config.capabilities.agents && s.data.agentRuns.length) {
    const queue = attentionQueue(q).filter((x) => x.area === "Agents");
    const waiting = queue.filter((x) => x.state === "Waiting for approval");
    const broke = queue.filter((x) => x.state === "Failed");
    if (waiting.length || broke.length) out.push({ key: "agents", tone: broke.length ? "bad" : "warn", linkLabel: "Open agent runs",
      text: [waiting.length ? plural(waiting.length, "agent run waits", "agent runs wait") + " for a human decision" : "", broke.length ? plural(broke.length, "agent run has", "agent runs have") + " failed" : ""].filter(Boolean).join(" and ") + ".",
      go: () => (waiting.length + broke.length === 1 ? openObject((waiting[0] || broke[0]).open.kind, (waiting[0] || broke[0]).open.id) : navigate({ page: "Agents", section: "runs" })) });
  }

  if (moduleEnabled(s.config, "purchasing")) {
    const ex = attentionQueue(q).filter((x) => x.area === "Purchasing");
    if (ex.length) out.push({ key: "invoices", tone: "warn", linkLabel: ex.length === 1 ? "Review it" : "Open matching",
      text: plural(ex.length, "supplier invoice does", "supplier invoices do") + " not match " + (ex.length === 1 ? "its order" : "their orders") + ".",
      go: () => (ex.length === 1 ? openObject(ex[0].open.kind, ex[0].open.id) : navigate({ page: "Purchasing", section: "matching" })) });
  }

  if (moduleEnabled(s.config, "standards")) {
    const ev = attentionQueue(q).filter((x) => x.area === "Standards" && x.source === "Evidence to review");
    if (ev.length) out.push({ key: "evidence", tone: "neutral", linkLabel: ev.length === 1 ? "Review it" : "Open evidence",
      text: plural(ev.length, "piece of evidence has", "pieces of evidence have") + " arrived and not been reviewed yet. Received is not accepted.",
      go: () => (ev.length === 1 ? openObject(ev[0].open.kind, ev[0].open.id) : navigate({ page: "Standards", section: "evidence" })) });
  }

  const from = addDays(now, -1);
  const changed = q.events().filter((e) => e.at > from && e.at <= now);
  if (changed.length) out.push({ key: "changes", tone: "neutral", linkLabel: "Open Activity",
    text: plural(changed.length, "change was", "changes were") + " recorded in " + scope + " in the last 24 hours, by " + plural(new Set(changed.map((e) => e.actorId)).size, "person or agent", "people and agents") + ".",
    go: () => navigate({ page: "Activity", section: "overview" }) });
  return out;
}

function Briefing() {
  const { q } = useCore();
  const list = briefing(q);
  return (
    <Widget title="Briefing" count={list.length} note="Built from the records you can see in this scope. Not written by AI.">
      {list.length === 0 ? <div className="hm-empty">Nothing needs a briefing in this scope today.</div> : (
        <ul className="hm-list td-brief">
          {list.map((st) => (
            <li key={st.key} className="hm-row">
              <span className="td-mark" style={{ background: st.tone === "bad" ? "var(--bad)" : st.tone === "warn" ? "var(--warn)" : "var(--neutral)" }} aria-hidden="true" />
              <span className="pk-grow td-brief-t">{st.text}</span>
              <button type="button" className="pk-btn pk-btn--sm pk-btn--ghost" onClick={st.go}>{st.linkLabel}<Icon d={ICON.arrow} size={11} /></button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* ── Priorities ────────────────────────────────────────────────────────── */

function Priorities({ items }: { items: QueueItem[] }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  // A small ordered list: the most urgent first, enough to act on today.
  const top = items.slice(0, items.length > 7 ? 6 : 7);
  return (
    <Widget title="Priorities" count={top.length < items.length ? top.length + " of " + items.length : items.length}
      note="Ordered by severity, then deadline. The same items as Activity, Needs attention.">
      {top.length === 0 ? <div className="hm-empty">Nothing needs attention in this scope.</div> : (
        <ol className="td-prio" aria-label="Priorities">
          <li className="td-prio-h" aria-hidden="true"><span /><span>Item and reason</span><span>Owner</span><span>Deadline</span><span>State</span><span>Next action</span></li>
          {top.map((it, i) => (
            <li key={it.key} className="td-prio-r">
              <span className="td-n">{i + 1}</span>
              <div className="td-prio-main">
                <button type="button" className="hm-link td-prio-t" onClick={() => openObject(it.open.kind, it.open.id)}>{it.title}</button>
                <div className="hm-sub hm-wrap">{it.reason}{it.also.length ? " Also: " + it.also.join(", ").toLowerCase() + "." : ""}</div>
              </div>
              <span className="td-cellv" data-l="Owner">{it.ownerId ? q.name(it.ownerId) : "Nobody assigned"}</span>
              <span className={"td-cellv pk-mono" + (it.deadline && ms(it.deadline) < ms(ctx.now) ? " hm-bad" : "")} data-l="Deadline">{it.deadline ? relative(it.deadline, ctx.now, tz) : "None set"}</span>
              <span className="td-cellv" data-l="State"><Chip tone={it.tone}>{it.state}</Chip><span className="td-sev">{SEVERITY_LABEL[it.severity]}</span></span>
              <span className="td-act">
                {it.inline && <button type="button" className="pk-btn pk-btn--sm" onClick={() => runInline(it)}>{it.inline.label}</button>}
                <button type="button" className="pk-btn pk-btn--sm pk-btn--primary" onClick={() => openObject(it.open.kind, it.open.id)}>{it.next}</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {items.length > top.length && <button type="button" className="hm-more" onClick={() => navigate({ page: "Activity", section: "attention" })}>All {items.length} in Activity, Needs attention</button>}
    </Widget>
  );
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

function DecisionRow({ a, mine }: { a: Approval; mine: boolean }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const req = q.request(a.requestId);
  const st = currentStage(a);
  const since = st?.startedAt || a.submittedAt;
  const late = !!st?.dueAt && ms(st.dueAt) < ms(ctx.now);
  return (
    <li>
      <button type="button" className="hm-row hm-row--btn" onClick={() => openObject("approval", a.id)}>
        <div className="pk-grow">
          <div className="hm-title"><span className="pk-mono hm-ref">{req?.ref}</span> {req?.title || "Request"}</div>
          <div className="hm-sub">{st?.label || "Decision"}{mine ? "" : ", with " + q.name(st?.assigneeId)}, waited {fmtHours(hoursBetween(since, ctx.now))}</div>
        </div>
        {late ? <Chip tone="warn">Late</Chip> : <span className="hm-meta">{st?.dueAt ? "Due " + relative(st.dueAt, ctx.now, tz) : "No deadline"}</span>}
      </button>
    </li>
  );
}

function Decisions() {
  const { q } = useCore();
  const me = q.viewer.person.id;
  const mine = waitingOnMe(q);
  const mineIds = new Set(mine.map((a) => a.id));
  const manages = q.viewer.permissions.has("approvals.decide") || q.viewer.permissions.has("tasks.manage");
  const others = q.approvals().filter((a) => a.status === "pending" && !!currentStage(a) && !mineIds.has(a.id)
    && (q.s.data.requests.find((r) => r.id === a.requestId)?.requesterId === me || manages))
    .sort((a, b) => (currentStage(a)!.startedAt || a.submittedAt).localeCompare(currentStage(b)!.startedAt || b.submittedAt));
  return (
    <Widget title="Decisions" count={mine.length + others.length}>
      <div className="td-sub-h">Waiting on you <span className="hm-meta">{mine.length}</span></div>
      {mine.length === 0 ? <div className="td-empty">No decisions are waiting on you.</div> : (
        <ul className="hm-list">{mine.slice(0, 4).map((a) => <DecisionRow key={a.id} a={a} mine />)}</ul>
      )}
      <div className="td-sub-h">Waiting on others <span className="hm-meta">{others.length}</span></div>
      {others.length === 0 ? <div className="td-empty">{manages ? "Nothing you raised or oversee is waiting on someone else." : "Nothing you raised is waiting on someone else."}</div> : (
        <ul className="hm-list">{others.slice(0, 4).map((a) => <DecisionRow key={a.id} a={a} mine={false} />)}</ul>
      )}
      {(mine.length > 4 || others.length > 4) && <button type="button" className="hm-more" onClick={() => navigate({ page: "Work", section: "approvals" })}>All decisions in Work</button>}
    </Widget>
  );
}

/* ── Agenda ────────────────────────────────────────────────────────────── */

interface AgendaItem { key: string; at: string; minutes?: number; title: string; kind: string; sub: string; open?: () => void }

function agenda(q: Q, day: string): AgendaItem[] {
  const s = q.s;
  const tz = s.config.timezone;
  const onDay = (at?: string) => !!at && localDay(at, tz) === day;
  const out: AgendaItem[] = [];
  for (const a of appointments(q)) {
    if (!onDay(a.startAt)) continue;
    const loc = s.config.locations.find((l) => l.id === a.locationId)?.label;
    const proj = a.projectId && moduleEnabled(s.config, "projects") ? s.data.projects.find((p) => p.id === a.projectId) : undefined;
    out.push({ key: "a" + a.id, at: a.startAt, minutes: a.minutes, title: a.title, kind: "Appointment",
      sub: [a.minutes + " min", loc, proj ? proj.title : "", q.name(a.ownerId)].filter(Boolean).join(", "),
      open: proj ? () => openObject("project", proj.id) : () => navigate({ page: "Work", section: "calendar" }) });
  }
  for (const t of q.tasks()) {
    if (q.isOpenTask(t) && onDay(t.dueAt)) out.push({ key: "t" + t.id, at: t.dueAt!, title: t.title, kind: "Task due", sub: q.name(t.assigneeId), open: () => openObject("task", t.id) });
  }
  for (const a of q.approvals()) {
    const st = currentStage(a);
    if (a.status === "pending" && st && onDay(st.dueAt)) {
      const req = q.request(a.requestId);
      out.push({ key: "d" + a.id, at: st.dueAt!, title: (req ? req.ref + " " : "") + (req?.title || "Decision"), kind: "Decision due", sub: st.label + ", " + q.name(st.assigneeId), open: () => openObject("approval", a.id) });
    }
  }
  if (moduleEnabled(s.config, "projects")) {
    const visible = new Map(projectsFor(q).map((p) => [p.id, p]));
    for (const m of s.data.milestones) {
      const p = visible.get(m.projectId);
      if (!p || m.completedAt || !onDay(m.dueAt)) continue;
      out.push({ key: "m" + m.id, at: m.dueAt, title: m.label, kind: "Milestone", sub: p.title, open: () => openObject("project", p.id) });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function Agenda() {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const today = localDay(ctx.now, tz);
  const items = agenda(q, today);
  const time = (at: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
  const allDay = (at: string) => time(at) === "00:00" || time(at) === "23:59";
  return (
    <Widget title="Today's agenda" count={items.length} note="Appointments, task and decision deadlines and milestones due today. Automation schedules are in Work, Calendar.">
      {items.length === 0 ? <div className="hm-empty">Nothing is booked or due today in this scope.</div> : (
        <ul className="hm-list">
          {items.map((it) => {
            const past = ms(it.at) + (it.minutes || 0) * 60000 < ms(ctx.now);
            return (
              <li key={it.key}>
                <button type="button" className={"hm-row hm-row--btn td-ag" + (past ? " td-ag--past" : "")} onClick={it.open} disabled={!it.open}>
                  <span className="td-ag-time pk-mono">{allDay(it.at) ? "Today" : time(it.at)}</span>
                  <div className="pk-grow">
                    <div className="hm-title">{it.title}</div>
                    <div className="hm-sub">{it.kind}{it.sub ? ", " + it.sub : ""}</div>
                  </div>
                  {past && <span className="hm-meta">Earlier</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

