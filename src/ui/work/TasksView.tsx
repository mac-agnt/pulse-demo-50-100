/* Work > Tasks in the original design: a hero with the stat strip and the
   personal focus timer, view tabs and filter chips, then one card holding the
   quick-add row and the task rows. Everything reads through the query layer
   and every change goes through an operation. */

import { useMemo, useState, type CSSProperties } from "react";
import { useCore, ops, scopeLabel, ms, localDay, store } from "../../core";
import type { Priority, Task } from "../../core";
import { Hero, StatStrip, SegTabs, FilterChip, eyebrowOf } from "../frame";
import { LABEL } from "../kit";
import { clockText, Ico, InlineError, useClock, useRunner, useViewer, WI, type OpenPanel } from "./shared";
import { FocusTimerCard, focusTimer } from "./FocusTimer";
import { SavedViewsChip, EMPTY_FILTERS, type TaskFilters, type TaskTab } from "./SavedViews";

const PRIO_CYCLE: Priority[] = ["normal", "high", "urgent", "low"];
const PRIO_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const PAGE = 25;

export default function TasksView({ openPanel, selected, only, clearOnly }: {
  openPanel: OpenPanel; selected?: string | null; only?: { ids: string[]; label: string } | null; clearOnly?: () => void;
}) {
  const { core, ctx, q } = useCore();
  const { me, inTeam } = useViewer();
  const { tz, now } = useClock();
  const [tab, setTab] = useState<TaskTab>("all");
  const [f, setF] = useState<TaskFilters>(EMPTY_FILTERS);
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<Priority>("normal");
  const [limit, setLimit] = useState(PAGE);
  // Ticked off in this visit: stay in the list, struck through, until the view changes.
  const [justDone, setJustDone] = useState<string[]>([]);
  const add = useRunner();
  const rowErr = useRunner();
  const [errFor, setErrFor] = useState<string | null>(null);
  const scopeName = scopeLabel(core, ctx.scope);

  const today = localDay(now, tz);
  const weekEnd = ms(now) + 7 * 864e5;
  const isOpen = (t: Task) => q.isOpenTask(t);
  const dueToday = (t: Task) => !!t.dueAt && localDay(t.dueAt, tz) === today;

  // My tasks always count, whatever the scope; the rest follows the selected scope.
  const pool = useMemo(() => {
    const inScope = q.tasks();
    const ids = new Set(inScope.map((t) => t.id));
    return [...inScope, ...q.tasks({ ignoreScope: true }).filter((t) => t.assigneeId === me && !ids.has(t.id))].filter((t) => t.status !== "cancelled");
  }, [q, me]);
  const mine = pool.filter((t) => t.assigneeId === me);

  const lists: Record<TaskTab, Task[]> = {
    all: pool.filter((t) => isOpen(t) || justDone.includes(t.id)),
    due: pool.filter((t) => (isOpen(t) || justDone.includes(t.id)) && !!t.dueAt && ms(t.dueAt) <= weekEnd),
    review: pool.filter((t) => t.status === "waiting"),
    done: pool.filter((t) => t.status === "done"),
    team: q.tasks({ ignoreScope: true }).filter((t) => !t.assigneeId && isOpen(t) && (!t.teamId || inTeam(t.teamId))),
    blocked: pool.filter((t) => isOpen(t) && q.blockers(t).length > 0)
  };

  const who = (t: Task) => (f.who === "me" ? t.assigneeId === me : f.who === "none" ? !t.assigneeId : t.assigneeId === f.who);
  const dueOk = (t: Task) => f.due === "overdue" ? q.isOverdue(t) : f.due === "today" ? dueToday(t) : f.due === "week" ? !!t.dueAt && ms(t.dueAt) <= weekEnd : f.due === "none" ? !t.dueAt : true;
  const rows = (only ? q.tasks({ ignoreScope: true }).filter((t) => only.ids.includes(t.id)) : lists[tab])
    .filter((t) => (!f.who || who(t)) && dueOk(t) && (!f.status || t.status === f.status) && (!f.team || (t.teamId || "") === f.team) && (!f.priority || t.priority === f.priority))
    .sort(tab === "done"
      ? (a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")
      : (a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0)
        || (a.dueAt ? ms(a.dueAt) : Infinity) - (b.dueAt ? ms(b.dueAt) : Infinity)
        || PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);

  const stats = [
    { label: "OPEN FOR ME", value: String(mine.filter(isOpen).length), icon: WI.list, title: "Show my open tasks", onClick: () => go("all", { ...EMPTY_FILTERS, who: "me" }) },
    { label: "DUE TODAY", value: String(mine.filter((t) => isOpen(t) && dueToday(t)).length), icon: WI.cal, title: "Show my tasks due today", onClick: () => go("all", { ...EMPTY_FILTERS, who: "me", due: "today" }) },
    { label: "OVERDUE", value: String(mine.filter((t) => q.isOverdue(t)).length), icon: WI.alert, color: mine.some((t) => q.isOverdue(t)) ? "var(--bad)" : undefined, title: "Show my overdue tasks", onClick: () => go("all", { ...EMPTY_FILTERS, who: "me", due: "overdue" }) },
    { label: "DONE BY ME", value: String(mine.filter((t) => t.status === "done").length), icon: WI.done, title: "Show tasks I finished", onClick: () => go("done", { ...EMPTY_FILTERS, who: "me" }) }
  ];

  function go(t: TaskTab, nf: TaskFilters) { setTab(t); setF(nf); setLimit(PAGE); setJustDone([]); }

  const tabs: { value: TaskTab; label: string; count: number }[] = [
    { value: "all", label: "All tasks", count: lists.all.filter(isOpen).length },
    { value: "due", label: "Due tasks", count: lists.due.filter(isOpen).length },
    { value: "review", label: "Review (waiting)", count: lists.review.length },
    { value: "done", label: "Done", count: lists.done.length },
    { value: "team", label: "Team queue", count: lists.team.length },
    { value: "blocked", label: "Blocked", count: lists.blocked.length }
  ];

  const people = [...new Set(lists[tab].map((t) => t.assigneeId).filter((x): x is string => !!x && x !== me))];
  const teams = [...new Set(lists[tab].map((t) => t.teamId || ""))];
  const filtered = !!(f.due || f.status || f.who || f.team || f.priority);

  const createQuick = () => {
    if (!title.trim()) { add.setErr("Type what needs doing first."); return; }
    const r = add.run(ops.createTask, { title, priority: prio, assigneeId: tab === "team" ? null : me });
    if (r.ok) setTitle("");
  };

  const toggleDone = (t: Task) => {
    setErrFor(t.id);
    const r = rowErr.run(ops.setTaskStatus, t.id, t.status === "done" ? "open" : "done");
    if (r.ok && t.status !== "done") setJustDone((x) => [...x, t.id]);
  };

  const start = (t: Task) => {
    focusTimer.start(t.id);
    if (t.assigneeId === me && t.status === "open") store.run(ops.setTaskStatus, t.id, "in_progress");
  };

  const claim = (t: Task) => { setErrFor(t.id); rowErr.run(ops.claimTask, t.id); };

  const nextMine = mine.filter(isOpen).sort((a, b) => (a.dueAt ? ms(a.dueAt) : Infinity) - (b.dueAt ? ms(b.dueAt) : Infinity))[0];

  return (
    <>
      <Hero infoOnly eyebrow={eyebrowOf("Work", "Tasks", scopeName)} title="Tasks"
        blurb="Everything assigned to you or your team, in one permission-filtered list."
        aside={<FocusTimerCard fallbackTaskId={nextMine?.id} />}>
        <StatStrip stats={stats} onAdd={() => openPanel({ kind: "newTask" })} addLabel="New task" />
      </Hero>

      <div className="wk-viewbar">
        <SegTabs label="Task view" options={tabs} value={tab} onChange={(v) => go(v, f)} />
        <span className="wk-vsep" aria-hidden="true" />
        <FilterChip label="Due date" value={f.due} onChange={(v) => setF({ ...f, due: v })}
          options={[{ value: "", label: "Due date" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "week", label: "Due in 7 days" }, { value: "none", label: "No due date" }]} />
        {tab !== "done" && tab !== "review" && (
          <FilterChip label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })}
            options={[{ value: "", label: "Any status" }, { value: "open", label: "Not started" }, { value: "in_progress", label: "In progress" }, { value: "waiting", label: "Waiting" }]} />
        )}
        {tab !== "team" && (
          <FilterChip label="Assignee" value={f.who} onChange={(v) => setF({ ...f, who: v })}
            options={[{ value: "", label: "Anyone" }, { value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...people.map((id) => ({ value: id, label: q.name(id) }))]} />
        )}
        {teams.length > 1 && (
          <FilterChip label="Team" value={f.team} onChange={(v) => setF({ ...f, team: v })}
            options={[{ value: "", label: "Any team" }, ...teams.map((id) => ({ value: id, label: q.teamLabel(id || undefined) }))]} />
        )}
        <FilterChip label="Priority" value={f.priority} onChange={(v) => setF({ ...f, priority: v })}
          options={[{ value: "", label: "Any priority" }, ...(["urgent", "high", "normal", "low"] as Priority[]).map((p) => ({ value: p, label: LABEL.priority[p] }))]} />
        <SavedViewsChip tab={tab} filters={f} onApply={(t, nf) => go(t, nf)} />
        {filtered && <button type="button" className="wk-dashed-btn" onClick={() => setF(EMPTY_FILTERS)}>Clear filters</button>}
        {only && <button type="button" className="wk-dashed-btn" onClick={clearOnly} title="Show all tasks again">{"Showing " + only.ids.length + " tasks from " + only.label + " · show all"}</button>}
      </div>

      <section className="wk-card" aria-label="Task list">
        <div className="wk-add">
          <Ico d={WI.plus} size={16} sw={1.9} color="var(--faint)" />
          <input value={title} onChange={(e) => { setTitle(e.target.value); if (add.err) add.setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") createQuick(); }}
            placeholder={tab === "team" ? "Add a task to the team queue..." : "Add a task..."} aria-label="New task title" />
          <span className="wk-add-l pf-hide-narrow">Priority</span>
          <button type="button" className="wk-tag wk-tag--btn" style={prioStyle(prio)} title="Change priority"
            onClick={() => setPrio(PRIO_CYCLE[(PRIO_CYCLE.indexOf(prio) + 1) % PRIO_CYCLE.length])}>
            <Ico d={WI.flag} size={12} sw={1.8} />{LABEL.priority[prio]}
          </button>
          <button type="button" className="wk-add-btn" onClick={createQuick}><Ico d={WI.plus} size={12} sw={2.2} />Add</button>
        </div>
        {add.err && <div style={{ paddingBottom: 12 }}><InlineError text={add.err} /></div>}

        {rows.slice(0, limit).map((t, i) => (
          <TaskRow key={t.id} t={t} i={i} selected={selected === t.id} me={me}
            canClaim={!t.assigneeId && (!t.teamId || inTeam(t.teamId))}
            onOpen={() => openPanel({ kind: "task", id: t.id })} onToggle={() => toggleDone(t)} onStart={() => start(t)} onClaim={() => claim(t)}
            err={errFor === t.id ? rowErr.err : null} />
        ))}

        {rows.length > limit && (
          <div className="wk-more"><button type="button" className="wk-dashed-btn" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}</button></div>
        )}

        {rows.length === 0 && (core.data.tasks.length === 0 ? (
          <div className="wk-empty"><b>No tasks yet</b><span>Add the first one above or with the add button. Tasks also arrive from requests, schedules and workflow runs once those are set up.</span></div>
        ) : filtered ? (
          <div className="wk-empty"><b>No tasks match these filters</b><span>Clear a filter, or switch view.</span>
            <button type="button" className="wk-dashed-btn" style={{ margin: "14px auto 0" }} onClick={() => setF(EMPTY_FILTERS)}>Clear filters</button></div>
        ) : (
          <div className="wk-empty"><b>{EMPTY[tab][0]}</b><span>{EMPTY[tab][1].replace("{scope}", scopeName)}</span></div>
        ))}
      </section>
    </>
  );
}

const EMPTY: Record<TaskTab, [string, string]> = {
  all: ["Nothing in this view", "Add a task above, or switch view. Open tasks in {scope} and everything assigned to you appear here."],
  due: ["Nothing due in the next 7 days", "Open tasks with a due date inside a week, or past it, appear here."],
  review: ["Nothing waiting", "Tasks set to Waiting, for example on a reply or a decision, appear here."],
  done: ["Nothing done yet", "Tasks ticked off appear here, newest first."],
  team: ["The team queue is clear", "Unassigned tasks in your teams appear here for anyone in the team to claim."],
  blocked: ["Nothing blocked", "Tasks waiting on another open task appear here."]
};

export function prioStyle(p: Priority): CSSProperties {
  return p === "urgent" ? { background: "var(--bad-soft)", color: "var(--bad)", borderColor: "transparent" }
    : p === "high" ? { background: "var(--warn-soft)", color: "var(--warn)", borderColor: "transparent" }
    : p === "low" ? { background: "var(--track)", color: "var(--dim)", borderColor: "transparent" }
    : { background: "var(--accent-faint)", color: "var(--ink)", borderColor: "var(--accent-line)" };
}

function lateBy(at: string, now: string) {
  const m = Math.max(1, Math.round((ms(now) - ms(at)) / 60000));
  return m < 60 ? m + " min" : m < 1440 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " d";
}

function TaskRow({ t, i, selected, me, canClaim, onOpen, onToggle, onStart, onClaim, err }: {
  t: Task; i: number; selected: boolean; me: string; canClaim: boolean;
  onOpen: () => void; onToggle: () => void; onStart: () => void; onClaim: () => void; err: string | null;
}) {
  const { core, q } = useCore();
  const { tz, now, rel } = useClock();
  const done = t.status === "done";
  const overdue = q.isOverdue(t);
  const req = t.requestId ? core.data.requests.find((r) => r.id === t.requestId) : undefined;
  const rec = t.linkedRecordIds.map((id) => q.record(id)).find(Boolean);
  const blockers = q.blockers(t);

  const status: [string, string, string] = done ? ["Done", "var(--ok)", "var(--ok-soft)"]
    : overdue ? ["Overdue", "var(--bad)", "var(--bad-soft)"]
    : t.status === "in_progress" ? ["In progress", "var(--accent)", "var(--accent-faint)"]
    : t.status === "waiting" ? (req?.status === "submitted" ? ["Review", "var(--warn)", "var(--warn-soft)"] : ["Waiting", "var(--warn)", "var(--warn-soft)"])
    : ["Not started", "var(--dim)", "var(--track)"];

  const dueText = !t.dueAt ? "No due date"
    : done ? "Done " + (t.completedAt ? rel(t.completedAt) : "")
    : overdue ? lateBy(t.dueAt, now) + " overdue"
    : localDay(t.dueAt, tz) === localDay(now, tz) ? "Due today " + clockText(t.dueAt, tz)
    : "Due " + rel(t.dueAt);
  const dayText = t.dueAt ? (localDay(t.dueAt, tz) === localDay(now, tz) ? "Today"
    : new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(t.dueAt))) : "Any day";

  return (
    <div className="wk-task" data-selected={selected || undefined} style={{ animationDelay: Math.min(i * 28, 280) + "ms" }}
      onClick={onOpen} role="button" tabIndex={0} aria-label={"Open task: " + t.title}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onOpen(); } }}>
      <button type="button" className="wk-box-check" data-done={done || undefined} aria-pressed={done}
        aria-label={done ? "Mark not done: " + t.title : "Mark done: " + t.title}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <Ico d={WI.check} size={11} sw={3.2} />
      </button>
      <div className="wk-task-main">
        <div className="wk-task-title" data-done={done || undefined}>{t.title}</div>
        <div className="wk-meta">
          <span style={{ color: overdue ? "var(--bad)" : undefined }}><Ico d={WI.cal} />{dueText}</span>
          {rec ? <span title={rec.title}><Ico d={WI.link} />{rec.ref} {rec.title}</span>
            : <span><Ico d={WI.building} />{q.teamLabel(t.teamId)}</span>}
          <span><Ico d={WI.day} />{dayText}</span>
          {req && <span><Ico d={WI.doc} />{req.ref}</span>}
          {t.checklist.length > 0 && <span><Ico d={WI.done} />{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
          {blockers.length > 0 && !done && <span style={{ color: "var(--warn)" }} title={blockers.map((b) => b.title).join(", ")}><Ico d={WI.lock} />Blocked by {blockers.length}</span>}
        </div>
        {err && <div className="pk-error wk-inline-err" role="alert" onClick={(e) => e.stopPropagation()}>{err}</div>}
      </div>
      <div className="wk-task-side">
        <span className="wk-tag" style={{ background: status[2], color: status[1] }}><span className="wk-tag-dot" style={{ background: status[1] }} />{status[0]}</span>
        <span className="wk-tag" style={prioStyle(t.priority)}><Ico d={WI.flag} size={11} sw={1.8} />{LABEL.priority[t.priority]}</span>
        <span className="wk-who" title={t.assigneeId ? q.name(t.assigneeId) + (t.assigneeId === me ? " (you)" : "") : "Unassigned"}>{t.assigneeId ? q.initials(t.assigneeId) : "?"}</span>
        {!t.assigneeId && !done ? (
          <button type="button" className="wk-start" disabled={!canClaim} title={canClaim ? "Take this task" : "This queue belongs to a team you are not in."}
            onClick={(e) => { e.stopPropagation(); onClaim(); }}><Ico d={WI.hand} size={12} sw={1.7} />Claim</button>
        ) : (
          <button type="button" className="wk-start" disabled={done} title={done ? "This task is done" : "Time this task with the focus timer"}
            onClick={(e) => { e.stopPropagation(); onStart(); }}><Ico d={WI.play} size={11} sw={1.9} />Start</button>
        )}
      </div>
    </div>
  );
}
