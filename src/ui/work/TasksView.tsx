/* Work > My work and Work > Team work: two default views over the same
   canonical tasks (project tasks included, with the project as a link).
   My work is the viewer's own list by due date, with the personal focus
   timer kept small beside the title. Team work is the team queues in scope:
   claim, assignment, priority, due, checklist, evidence, comments,
   dependencies and blocked state, with unestimated work shown as such.
   Everything reads through the query layer and changes through ops. */

import { useMemo, useState, type CSSProperties } from "react";
import { useCore, ops, scopeLabel, ms, localDay, store, openObject, moduleEnabled } from "../../core";
import type { Priority, Task } from "../../core";
import { SegTabs, FilterChip, eyebrowOf, Btn } from "../frame";
import { LABEL } from "../kit";
import { clockText, Ico, InlineError, useClock, useRunner, useViewer, WI, WorkHead, type OpenPanel } from "./shared";
import { FocusTimerMini, focusTimer } from "./FocusTimer";
import { SavedViewsChip, EMPTY_FILTERS, type TaskFilters, type TaskTab } from "./SavedViews";
import { isUnestimated, myWork, PRIO_RANK, teamQueueIds, teamWork } from "./select";

const PRIO_CYCLE: Priority[] = ["normal", "high", "urgent", "low"];
const PAGE = 30;

/* ── My work ───────────────────────────────────────────────────────────── */

type Bucket = "overdue" | "today" | "week" | "later" | "none" | "done";
const BUCKET_LABEL: Record<Bucket, string> = { overdue: "Overdue", today: "Due today", week: "Next 7 days", later: "Later", none: "No due date", done: "Done recently" };

export function MyWorkView({ openPanel, selected }: { openPanel: OpenPanel; selected?: string | null }) {
  const { core, q } = useCore();
  const { me } = useViewer();
  const { tz, now } = useClock();
  const add = useRunner();
  const rowErr = useRunner();
  const [errFor, setErrFor] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<Priority>("normal");
  const [showDone, setShowDone] = useState(false);
  const [justDone, setJustDone] = useState<string[]>([]);

  const open = useMemo(() => myWork(q), [q]);
  const today = localDay(now, tz);
  const weekEnd = ms(now) + 7 * 864e5;
  const recentDone = q.tasks({ ignoreScope: true }).filter((t) => t.assigneeId === me && t.status === "done" && !!t.completedAt && ms(now) - ms(t.completedAt) <= 7 * 864e5)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const kept = recentDone.filter((t) => justDone.includes(t.id));

  const bucketOf = (t: Task): Bucket => {
    if (t.status === "done") return "done";
    if (!t.dueAt) return "none";
    if (q.isOverdue(t)) return "overdue";
    if (localDay(t.dueAt, tz) === today) return "today";
    if (ms(t.dueAt) <= weekEnd) return "week";
    return "later";
  };
  const order: Bucket[] = ["overdue", "today", "week", "later", "none", "done"];
  const rows = [...open, ...(showDone ? recentDone : kept)];
  const groups = order.map((b) => ({ b, list: rows.filter((t) => bucketOf(t) === b) })).filter((g) => g.list.length);

  const createQuick = () => {
    if (!title.trim()) { add.setErr("Type what needs doing first."); return; }
    const r = add.run(ops.createTask, { title, priority: prio, assigneeId: me });
    if (r.ok) setTitle("");
  };
  const toggleDone = (t: Task) => {
    setErrFor(t.id);
    const r = rowErr.run(ops.setTaskStatus, t.id, t.status === "done" ? "open" : "done");
    if (r.ok && t.status !== "done") setJustDone((x) => [...x, t.id]);
  };
  const start = (t: Task) => {
    focusTimer.start(t.id);
    if (t.status === "open") store.run(ops.setTaskStatus, t.id, "in_progress");
  };
  const overdueN = open.filter((t) => q.isOverdue(t)).length;

  return (
    <>
      <WorkHead eyebrow={eyebrowOf("Work", "My work", open.length + " open" + (overdueN ? ", " + overdueN + " overdue" : ""))} title="My work"
        info="Tasks assigned to you, whatever the scope, ordered by due date. Project tasks appear here as the same task their project shows."
        extra={<FocusTimerMini fallbackTaskId={open[0]?.id} />}
        primary={<Btn primary onClick={() => openPanel({ kind: "newTask" })}><Ico d={WI.plus} size={14} sw={2.1} />New task</Btn>} />

      <section className="wk-card" aria-label="My tasks">
        <div className="wk-add">
          <Ico d={WI.plus} size={16} sw={1.9} color="var(--faint)" />
          <input value={title} onChange={(e) => { setTitle(e.target.value); if (add.err) add.setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") createQuick(); }} placeholder="Add a task for yourself..." aria-label="New task title" />
          <button type="button" className="wk-tag wk-tag--btn" style={prioStyle(prio)} title="Change priority"
            onClick={() => setPrio(PRIO_CYCLE[(PRIO_CYCLE.indexOf(prio) + 1) % PRIO_CYCLE.length])}>
            <Ico d={WI.flag} size={12} sw={1.8} />{LABEL.priority[prio]}
          </button>
          <button type="button" className="wk-add-btn" onClick={createQuick}><Ico d={WI.plus} size={12} sw={2.2} />Add</button>
        </div>
        {add.err && <div style={{ paddingBottom: 12 }}><InlineError text={add.err} /></div>}

        {groups.map((g) => (
          <div key={g.b}>
            <div className="wk-group-h"><b>{BUCKET_LABEL[g.b]}</b><span>{g.list.length}</span></div>
            {g.list.map((t, i) => (
              <TaskRow key={t.id} t={t} i={i} selected={selected === t.id} me={me} mode="mine"
                onOpen={() => openPanel({ kind: "task", id: t.id })} onToggle={() => toggleDone(t)} onStart={() => start(t)}
                err={errFor === t.id ? rowErr.err : null} />
            ))}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="wk-empty"><b>Nothing assigned to you</b>
            <span>Add a task above, or claim one from Team work. Tasks from requests, projects and schedules land here once they are assigned to you.</span></div>
        )}
        <div className="wk-more" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span className="wk-small">Due dates in {tz}.</span>
          <button type="button" className="wk-dashed-btn" onClick={() => setShowDone(!showDone)} aria-pressed={showDone}>
            {showDone ? "Hide done" : "Show done in the last 7 days (" + recentDone.length + ")"}
          </button>
        </div>
      </section>
    </>
  );
}

/* ── Team work ─────────────────────────────────────────────────────────── */

export function TeamWorkView({ openPanel, selected, only, clearOnly }: {
  openPanel: OpenPanel; selected?: string | null; only?: { ids: string[]; label: string } | null; clearOnly?: () => void;
}) {
  const { core, ctx, q } = useCore();
  const { me, inTeam } = useViewer();
  const { now } = useClock();
  const [tab, setTab] = useState<TaskTab>("team");
  const [f, setF] = useState<TaskFilters>(EMPTY_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const [title, setTitle] = useState("");
  const add = useRunner();
  const rowErr = useRunner();
  const [errFor, setErrFor] = useState<string | null>(null);
  const scopeName = scopeLabel(core, ctx.scope);
  const weekEnd = ms(now) + 7 * 864e5;

  const open = useMemo(() => teamWork(q), [q]);
  const queues = teamQueueIds(q);
  const doneRecent = useMemo(() => q.tasks({ ignoreScope: true }).filter((t) => t.status === "done" && (!queues || (!!t.teamId && queues.includes(t.teamId)))
    && !!t.completedAt && ms(now) - ms(t.completedAt) <= 14 * 864e5), [q, queues, now]);

  const lists: Record<TaskTab, Task[]> = {
    team: open.filter((t) => !t.assigneeId),
    all: open,
    due: open.filter((t) => !!t.dueAt && ms(t.dueAt) <= weekEnd),
    review: open.filter((t) => t.status === "waiting"),
    blocked: open.filter((t) => q.blockers(t).length > 0),
    done: doneRecent
  };
  const who = (t: Task) => (f.who === "me" ? t.assigneeId === me : f.who === "none" ? !t.assigneeId : t.assigneeId === f.who);
  const dueOk = (t: Task) => f.due === "overdue" ? q.isOverdue(t) : f.due === "week" ? !!t.dueAt && ms(t.dueAt) <= weekEnd : f.due === "none" ? !t.dueAt : true;
  const estOk = (t: Task) => f.estimate === "none" ? isUnestimated(t) : f.estimate === "set" ? !isUnestimated(t) : true;
  const base = only ? q.tasks({ ignoreScope: true }).filter((t) => only.ids.includes(t.id)) : lists[tab];
  const rows = base.filter((t) => (!f.who || who(t)) && dueOk(t) && estOk(t) && (!f.team || (t.teamId || "") === f.team) && (!f.priority || t.priority === f.priority) && (!f.status || t.status === f.status))
    .sort(tab === "done" ? (a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")
      : (a, b) => (a.teamId || "").localeCompare(b.teamId || "") || (a.dueAt ? ms(a.dueAt) : Infinity) - (b.dueAt ? ms(b.dueAt) : Infinity) || PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  const teams = [...new Set(base.map((t) => t.teamId || ""))];
  const people = [...new Set(base.map((t) => t.assigneeId).filter((x): x is string => !!x && x !== me))];
  const filtered = !!(f.due || f.status || f.who || f.team || f.priority || f.estimate);
  const go = (t: TaskTab, nf: TaskFilters) => { setTab(t); setF(nf); setLimit(PAGE); };
  const unestimated = open.filter(isUnestimated).length;

  const tabs: { value: TaskTab; label: string; count: number }[] = [
    { value: "team", label: "Unclaimed", count: lists.team.length },
    { value: "all", label: "All open", count: lists.all.length },
    { value: "due", label: "Due in 7 days", count: lists.due.length },
    { value: "review", label: "Waiting", count: lists.review.length },
    { value: "blocked", label: "Blocked", count: lists.blocked.length },
    { value: "done", label: "Done", count: lists.done.length }
  ];
  const queueTeam = f.team || (queues && queues.length === 1 ? queues[0] : undefined);
  const createQuick = () => {
    if (!title.trim()) { add.setErr("Type what needs doing first."); return; }
    const r = add.run(ops.createTask, { title, teamId: queueTeam, assigneeId: null });
    if (r.ok) setTitle("");
  };
  const claim = (t: Task) => { setErrFor(t.id); rowErr.run(ops.claimTask, t.id); };
  const toggleDone = (t: Task) => { setErrFor(t.id); rowErr.run(ops.setTaskStatus, t.id, t.status === "done" ? "open" : "done"); };
  const shown = rows.slice(0, limit);

  return (
    <>
      <WorkHead eyebrow={eyebrowOf("Work", "Team work", scopeName, unestimated ? unestimated + " unestimated" : "")} title="Team work"
        info="The team queues in the selected scope. Claim unassigned work, or open a task to assign it, set its estimate, add evidence or comment."
        primary={<Btn primary onClick={() => openPanel({ kind: "newTask" })}><Ico d={WI.plus} size={14} sw={2.1} />New task</Btn>} />

      <div className="wk-viewbar">
        <SegTabs label="Team work view" options={tabs} value={tab} onChange={(v) => go(v, f)} />
        <span className="wk-vsep" aria-hidden="true" />
        {teams.length > 1 && (
          <FilterChip label="Team" value={f.team} onChange={(v) => setF({ ...f, team: v })}
            options={[{ value: "", label: "Any team" }, ...teams.map((id) => ({ value: id, label: q.teamLabel(id || undefined) }))]} />
        )}
        {tab !== "team" && (
          <FilterChip label="Assignee" value={f.who} onChange={(v) => setF({ ...f, who: v })}
            options={[{ value: "", label: "Anyone" }, { value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...people.map((id) => ({ value: id, label: q.name(id) }))]} />
        )}
        <FilterChip label="Due date" value={f.due} onChange={(v) => setF({ ...f, due: v })}
          options={[{ value: "", label: "Due date" }, { value: "overdue", label: "Overdue" }, { value: "week", label: "Due in 7 days" }, { value: "none", label: "No due date" }]} />
        <FilterChip label="Priority" value={f.priority} onChange={(v) => setF({ ...f, priority: v })}
          options={[{ value: "", label: "Any priority" }, ...(["urgent", "high", "normal", "low"] as Priority[]).map((p) => ({ value: p, label: LABEL.priority[p] }))]} />
        <FilterChip label="Estimate" value={f.estimate} onChange={(v) => setF({ ...f, estimate: v })}
          options={[{ value: "", label: "Any estimate" }, { value: "none", label: "Unestimated" }, { value: "set", label: "Estimated" }]} />
        <SavedViewsChip tab={tab} filters={f} onApply={go} />
        {filtered && <button type="button" className="wk-dashed-btn" onClick={() => setF(EMPTY_FILTERS)}>Clear filters</button>}
        {only && <button type="button" className="wk-dashed-btn" onClick={clearOnly} title="Show the team queues again">{"Showing " + only.ids.length + " tasks from " + only.label + ", show all"}</button>}
      </div>

      <section className="wk-card" aria-label="Team tasks">
        <div className="wk-add">
          <Ico d={WI.plus} size={16} sw={1.9} color="var(--faint)" />
          <input value={title} onChange={(e) => { setTitle(e.target.value); if (add.err) add.setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") createQuick(); }}
            placeholder={"Add a task to the " + (queueTeam ? q.teamLabel(queueTeam) : "your team's") + " queue..."} aria-label="New team task title" />
          <button type="button" className="wk-add-btn" onClick={createQuick}><Ico d={WI.plus} size={12} sw={2.2} />Add</button>
        </div>
        {add.err && <div style={{ paddingBottom: 12 }}><InlineError text={add.err} /></div>}

        {shown.map((t, i) => {
          const head = i === 0 || shown[i - 1].teamId !== t.teamId;
          return (
            <div key={t.id}>
              {head && teams.length > 1 && tab !== "done" && (
                <div className="wk-group-h"><b>{q.teamLabel(t.teamId)}</b><span>{rows.filter((x) => x.teamId === t.teamId).length} in view</span></div>
              )}
              <TaskRow t={t} i={i} selected={selected === t.id} me={me} mode="team"
                canClaim={!t.assigneeId && (!t.teamId || inTeam(t.teamId))}
                onOpen={() => openPanel({ kind: "task", id: t.id })} onToggle={() => toggleDone(t)} onClaim={() => claim(t)}
                err={errFor === t.id ? rowErr.err : null} />
            </div>
          );
        })}
        {rows.length > limit && (
          <div className="wk-more"><button type="button" className="wk-dashed-btn" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}</button></div>
        )}
        {rows.length === 0 && (core.data.tasks.length === 0 ? (
          <div className="wk-empty"><b>No tasks yet</b><span>Add the first one above. Tasks also arrive from requests, projects, schedules and workflow runs once those are set up.</span></div>
        ) : filtered ? (
          <div className="wk-empty"><b>No tasks match these filters</b><span>Clear a filter, or switch view.</span>
            <button type="button" className="wk-dashed-btn" style={{ margin: "14px auto 0" }} onClick={() => setF(EMPTY_FILTERS)}>Clear filters</button></div>
        ) : (
          <div className="wk-empty"><b>{TEAM_EMPTY[tab][0]}</b><span>{TEAM_EMPTY[tab][1].replace("{scope}", scopeName)}</span></div>
        ))}
      </section>
    </>
  );
}

const TEAM_EMPTY: Record<TaskTab, [string, string]> = {
  team: ["Every task is claimed", "Unassigned tasks in the team queues of {scope} appear here for anyone in the team to claim."],
  all: ["No open team work", "Open tasks in the team queues of {scope} appear here."],
  due: ["Nothing due in the next 7 days", "Team tasks due inside a week, or past it, appear here."],
  review: ["Nothing waiting", "Tasks set to Waiting, for example on a reply or a decision, appear here."],
  blocked: ["Nothing blocked", "Tasks waiting on another open task appear here."],
  done: ["Nothing done in the last 14 days", "Completed team tasks appear here, newest first."]
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

/* ── One task row ──────────────────────────────────────────────────────── */

export function TaskRow({ t, i, selected, me, mode, canClaim, onOpen, onToggle, onStart, onClaim, err }: {
  t: Task; i: number; selected: boolean; me: string; mode: "mine" | "team"; canClaim?: boolean;
  onOpen: () => void; onToggle: () => void; onStart?: () => void; onClaim?: () => void; err: string | null;
}) {
  const { core, q } = useCore();
  const { tz, now, rel } = useClock();
  const done = t.status === "done";
  const overdue = q.isOverdue(t);
  const req = t.requestId ? core.data.requests.find((r) => r.id === t.requestId) : undefined;
  const rec = t.linkedRecordIds.map((id) => q.record(id)).find(Boolean);
  const blockers = q.blockers(t);
  const project = t.projectId ? core.data.projects.find((p) => p.id === t.projectId) : undefined;
  const projectVisible = !!project && q.canSee({ ownerIds: [project.ownerId], teamId: project.teamId, unitId: project.unitId, visibility: project.visibility });
  const projectsOn = moduleEnabled(core.config, "projects");
  const comments = (core.data.comments || []).filter((c) => c.objectType === "task" && c.objectId === t.id).length;

  const status: [string, string, string] = done ? ["Done", "var(--ok)", "var(--ok-soft)"]
    : overdue ? ["Overdue", "var(--bad)", "var(--bad-soft)"]
    : blockers.length ? ["Blocked", "var(--warn)", "var(--warn-soft)"]
    : t.status === "in_progress" ? ["In progress", "var(--accent)", "var(--accent-faint)"]
    : t.status === "waiting" ? (req?.status === "submitted" ? ["Review", "var(--warn)", "var(--warn-soft)"] : ["Waiting", "var(--warn)", "var(--warn-soft)"])
    : ["Not started", "var(--dim)", "var(--track)"];

  const dueText = !t.dueAt ? "No due date"
    : done ? "Done " + (t.completedAt ? rel(t.completedAt) : "")
    : overdue ? lateBy(t.dueAt, now) + " overdue"
    : localDay(t.dueAt, tz) === localDay(now, tz) ? "Due today " + clockText(t.dueAt, tz)
    : "Due " + rel(t.dueAt);

  return (
    <div className="wk-task wk-task--compact" data-selected={selected || undefined} style={{ animationDelay: Math.min(i * 24, 240) + "ms" }}
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
          {project && (projectVisible && projectsOn
            ? <button type="button" className="wk-plink" title={"Open project " + project.title}
                onClick={(e) => { e.stopPropagation(); openObject("project", project.id); }}><Ico d={WI.building} />{project.title}</button>
            : <span><Ico d={WI.building} />{projectVisible ? project.title : "A project you cannot see"}</span>)}
          {!project && (rec ? <span title={rec.title}><Ico d={WI.link} />{rec.ref} {rec.title}</span>
            : <span><Ico d={WI.building} />{q.teamLabel(t.teamId)}</span>)}
          {req && <span><Ico d={WI.doc} />{req.ref}</span>}
          {t.checklist.length > 0 && <span><Ico d={WI.done} />{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
          {t.evidenceFileIds.length > 0 && <span title="Evidence attached"><Ico d={WI.doc} />{t.evidenceFileIds.length} evidence</span>}
          {comments > 0 && <span title="Comments"><Ico d={WI.list} />{comments} comment{comments === 1 ? "" : "s"}</span>}
          {!done && (typeof t.estimateHours === "number"
            ? <span title="Effort estimate"><Ico d={WI.clock} />{t.estimateHours} h est.</span>
            : <span style={{ color: "var(--faint)" }} title="No effort estimate. It is not counted as zero hours in capacity."><Ico d={WI.clock} />Unestimated</span>)}
          {blockers.length > 0 && !done && <span style={{ color: "var(--warn)" }} title={blockers.map((b) => b.title).join(", ")}><Ico d={WI.lock} />Blocked by {blockers.length === 1 ? "“" + blockers[0].title + "”" : blockers.length + " tasks"}</span>}
        </div>
        {err && <div className="pk-error wk-inline-err" role="alert" onClick={(e) => e.stopPropagation()}>{err}</div>}
      </div>
      <div className="wk-task-side">
        <span className="wk-tag" style={{ background: status[2], color: status[1] }}><span className="wk-tag-dot" style={{ background: status[1] }} />{status[0]}</span>
        <span className="wk-tag" style={prioStyle(t.priority)}><Ico d={WI.flag} size={11} sw={1.8} />{LABEL.priority[t.priority]}</span>
        {mode === "team" && <span className="wk-who" title={t.assigneeId ? q.name(t.assigneeId) + (t.assigneeId === me ? " (you)" : "") : "Unassigned"}>{t.assigneeId ? q.initials(t.assigneeId) : "?"}</span>}
        {mode === "team" && !t.assigneeId && !done && onClaim && (
          <button type="button" className="wk-start" disabled={!canClaim} title={canClaim ? "Take this task" : "This queue belongs to a team you are not in."}
            onClick={(e) => { e.stopPropagation(); onClaim(); }}><Ico d={WI.hand} size={12} sw={1.7} />Claim</button>
        )}
        {mode === "mine" && onStart && (
          <button type="button" className="wk-start" disabled={done} title={done ? "This task is done" : "Time this task with your focus timer"}
            onClick={(e) => { e.stopPropagation(); onStart(); }}><Ico d={WI.play} size={11} sw={1.9} />Focus</button>
        )}
      </div>
    </div>
  );
}

export default MyWorkView;
