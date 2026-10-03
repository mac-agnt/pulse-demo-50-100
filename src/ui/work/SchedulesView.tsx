/* Work > Schedules in the original design, and now the home of automations
   and workflow runs: the week or month calendar with a chip for every real
   occurrence of a schedule (produced, due, or missed), stat tiles from real
   data, Next up, the agenda for the chosen day, the recurring routines with
   their switches, and the automation runs with failed ones first. Nothing is
   invented: a day with no chips has nothing scheduled. */

import { useRef, useState, type RefObject } from "react";
import { useCore, ops, navigate, nextOccurrence, localDay, zonedTime, ms, iso, scopeLabel } from "../../core";
import type { Schedule, WorkflowRun, Tone } from "../../core";
import { Hero, Btn, eyebrowOf, toneColor, toneSoft } from "../frame";
import { LABEL, toneOf } from "../kit";
import { clockText, Ico, InlineError, SCHEDULE_KIND, Toggle, useClock, useRunner, useViewer, WI, type OpenPanel } from "./shared";

const KIND_COLOR: Record<Schedule["kind"], string> = { "recurring-task": "var(--accent)", automation: "var(--neutral)", report: "var(--ok)" };
const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY = 864e5;

interface Occ { s: Schedule; at: string; day: string; produced: boolean; past: boolean }

/* Pure calendar arithmetic on YYYY-MM-DD keys. */
const parse = (k: string) => { const [y, m, d] = k.split("-").map(Number); return { y, m, d }; };
const keyOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (k: string) => { const p = parse(k); return Date.UTC(p.y, p.m - 1, p.d); };
const addDaysKey = (k: string, n: number) => keyOf(utc(k) + n * DAY);
const mondayIndex = (k: string) => (new Date(utc(k)).getUTCDay() + 6) % 7;

function occurrences(list: Schedule[], fromKey: string, toKeyExcl: string, tz: string, now: string): Occ[] {
  const a = parse(fromKey), b = parse(toKeyExcl);
  const from = zonedTime(a.y, a.m, a.d, 0, 0, tz), to = zonedTime(b.y, b.m, b.d, 0, 0, tz);
  const out: Occ[] = [];
  for (const s of list) {
    let at = nextOccurrence(s.cadence, iso(ms(from) - 60000), s.timezone);
    for (let i = 0; i < 64 && ms(at) < ms(to); i++) {
      if (ms(at) >= ms(from)) {
        const produced = s.producedKeys.includes(s.id + ":" + localDay(at, s.timezone));
        const past = ms(at) <= ms(now);
        if (produced || s.active) out.push({ s, at, day: localDay(at, tz), produced, past });
      }
      const next = nextOccurrence(s.cadence, at, s.timezone);
      if (next === at) break;
      at = next;
    }
  }
  return out.sort((x, y) => x.at.localeCompare(y.at));
}

function cadenceShort(s: Schedule, orgTz: string) {
  const c = s.cadence;
  const t = String(c.hour).padStart(2, "0") + ":" + String(c.minute).padStart(2, "0");
  const wd = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][c.weekday ?? 1];
  const base = c.every === "day" ? "Daily, " + t : c.every === "week" ? wd + ", " + t : "Day " + (c.monthday ?? 1) + " of the month, " + t;
  return base + (s.timezone !== orgTz ? " " + s.timezone : "");
}

type RunFilter = "all" | "attention" | "failed" | "active" | "completed" | "templates";

export default function SchedulesView({ openPanel, selected }: { openPanel: OpenPanel; selected?: string | null }) {
  const { core, ctx, q } = useCore();
  const { me, can: canDo } = useViewer();
  const { tz, now, rel } = useClock();
  const caps = core.config.capabilities;
  const showSchedules = caps.schedules !== false;
  const showRuns = caps.workflows !== false;
  const [mode, setMode] = useState<"week" | "month">("week");
  const today = localDay(now, tz);
  const [day, setDay] = useState(today);
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const runsRef = useRef<HTMLElement>(null);
  const toggle = useRunner();
  const scopeName = scopeLabel(core, ctx.scope);

  const schedules = q.schedules();
  const active = schedules.filter((s) => s.active);
  const runs = q.runs();

  // The visible range.
  const weekStart = addDaysKey(today, -mondayIndex(today));
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const monthFirst = today.slice(0, 8) + "01";
  const nextMonthFirst = (() => { const p = parse(monthFirst); return keyOf(Date.UTC(p.y, p.m, 1)); })();
  const monthLen = Math.round((utc(nextMonthFirst) - utc(monthFirst)) / DAY);
  const monthKeys = Array.from({ length: monthLen }, (_, i) => addDaysKey(monthFirst, i));
  const rangeFrom = mode === "week" ? weekStart : monthFirst;
  const rangeTo = mode === "week" ? addDaysKey(weekStart, 7) : nextMonthFirst;

  const occ = occurrences(schedules, rangeFrom, rangeTo, tz, now);
  const weekOcc = mode === "week" ? occ : occurrences(schedules, weekStart, addDaysKey(weekStart, 7), tz, now);
  const dayOcc = (k: string) => occ.filter((o) => o.day === k);
  const agenda = (day >= rangeFrom && day < rangeTo ? occ : occurrences(schedules, day, addDaysKey(day, 1), tz, now)).filter((o) => o.day === day);

  const fmtDay = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(utc(k)));
  const label = mode === "week" ? "This week · " + fmtDay(weekStart, { day: "numeric", month: "short" }) : fmtDay(monthFirst, { month: "long", year: "numeric" });

  // Stat tiles, all from real data.
  const perDay = weekKeys.map((k) => ({ k, n: weekOcc.filter((o) => o.day === k).length }));
  const busiest = perDay.reduce((x, y) => (y.n > x.n ? y : x), perDay[0]);
  const nexts = active.map((s) => ({ s, at: nextOccurrence(s.cadence, now, s.timezone) })).sort((x, y) => x.at.localeCompare(y.at));
  const needPerson = runs.filter((r) => r.status === "awaiting_input" || r.status === "awaiting_approval" || (!r.assigneeId && r.status !== "completed"));
  const failing = runs.filter((r) => r.status === "failed");
  const paused = schedules.filter((s) => !s.active);

  const jumpToRuns = (f: RunFilter) => {
    setRunFilter(f);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => runsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 30);
  };

  const tiles: { label: string; value: string; note: string; tone?: Tone; onClick?: () => void }[] = [
    { label: "Runs this week", value: String(weekOcc.length), note: "across " + active.length + " active schedule" + (active.length === 1 ? "" : "s") },
    { label: "Busiest day", value: busiest && busiest.n > 0 ? fmtDay(busiest.k, { day: "numeric", month: "short" }) : "None", note: busiest && busiest.n > 0 ? busiest.n + " scheduled run" + (busiest.n === 1 ? "" : "s") : "nothing scheduled this week" },
    { label: "Needs a person", value: String(needPerson.length), note: "runs waiting on input, a decision or an owner", tone: needPerson.length ? "warn" : undefined, onClick: showRuns ? () => jumpToRuns("attention") : undefined },
    { label: "Failing", value: String(failing.length), note: "runs to recover", tone: failing.length ? "bad" : undefined, onClick: showRuns ? () => jumpToRuns("failed") : undefined },
    { label: "Next run", value: nexts[0] ? rel(nexts[0].at) : "None", note: nexts[0] ? nexts[0].s.label : "no active schedules" },
    { label: "Paused", value: String(paused.length), note: "schedules switched off" }
  ];

  const scheduleTask = () => openPanel({ kind: "newTask", due: day >= today ? day : today });
  const may = (s: Schedule) => s.ownerId === me || canDo("workflows.operate");

  return (
    <>
      <Hero eyebrow={eyebrowOf("Work", "Schedules", scopeName)} title="Schedules"
        blurb="The team calendar: when recurring work fires, what it produced, and how automation runs are doing."
        actions={<>
          <Btn primary onClick={() => openPanel({ kind: "newSchedule" })}><Ico d={WI.plus} size={14} sw={2.1} />New recurring work</Btn>
          <Btn onClick={scheduleTask}><Ico d={WI.cal} size={14} />Schedule a task</Btn>
          <Btn onClick={() => navigate({ page: "Settings", section: "workflows" })} title="Workflow templates and their triggers are configured in Settings"><Ico d={WI.cal} size={14} />Workflow templates</Btn>
        </>} />

      {showSchedules && (
        <div className="wk-sched-grid">
          <section className="wk-card wk-cal-card" aria-label="Schedule calendar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wk-card-t">{label}</div>
                <div className="wk-card-m">Everything that runs on a schedule, and when. Times in {tz}.</div>
              </div>
              <div className="wk-mini-seg" role="group" aria-label="Calendar range">
                <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>Week</button>
                <button type="button" aria-pressed={mode === "month"} onClick={() => setMode("month")}>Month</button>
              </div>
            </div>

            <div className="wk-cal" data-mode={mode}>
              {DAY_NAMES.map((d) => <div key={d} className="wk-cal-dn">{d}</div>)}
              {mode === "month" && Array.from({ length: mondayIndex(monthFirst) }, (_, i) => <div key={"b" + i} className="wk-day wk-day--blank" aria-hidden="true" />)}
              {(mode === "week" ? weekKeys : monthKeys).map((k) => {
                const evs = dayOcc(k);
                const cap = mode === "week" ? 4 : 2;
                const shown = evs.slice(0, cap);
                return (
                  <button key={k} type="button" className="wk-day" data-today={k === today || undefined} data-sel={(k === day && k !== today) || undefined}
                    aria-pressed={k === day} aria-label={fmtDay(k, { weekday: "long", day: "numeric", month: "long" }) + ", " + (evs.length ? evs.length + " scheduled" : "nothing scheduled")}
                    onClick={() => setDay(k)}>
                    <span className="wk-day-n">{Number(k.slice(8))}</span>
                    {shown.map((o) => (
                      <span key={o.s.id + o.at} className="wk-cal-chip" data-missed={(o.past && !o.produced) || undefined}
                        style={{ borderLeftColor: KIND_COLOR[o.s.kind] }} title={o.s.label + " " + clockText(o.at, tz) + (o.past ? (o.produced ? ", produced" : ", not produced") : "")}>{o.s.label}</span>
                    ))}
                    {evs.length > shown.length && <span className="wk-day-more">+{evs.length - shown.length} more</span>}
                  </button>
                );
              })}
            </div>

            <div className="wk-legend">
              {(["recurring-task", "automation", "report"] as Schedule["kind"][]).map((k) => (
                <span key={k}><i style={{ background: KIND_COLOR[k] }} />{SCHEDULE_KIND[k]}</span>
              ))}
              <span><i style={{ background: "none", border: "1px dashed var(--border-strong)" }} />Due but not produced</span>
            </div>

            <div className="wk-tiles">
              {tiles.map((t) => {
                const body = <>
                  <div className="wk-tile-l">{t.label}</div>
                  <div className="wk-tile-v" style={{ color: t.tone ? toneColor(t.tone) : undefined }}>{t.value}</div>
                  <div className="wk-tile-n">{t.note}</div>
                </>;
                return t.onClick
                  ? <button key={t.label} type="button" className="wk-tile wk-tile--btn" onClick={t.onClick}>{body}</button>
                  : <div key={t.label} className="wk-tile">{body}</div>;
              })}
            </div>

            <div className="pf-eyebrow" style={{ marginTop: 20 }}>NEXT UP</div>
            <div style={{ marginTop: 4 }}>
              {nexts.slice(0, 4).map((n) => (
                <button key={n.s.id} type="button" className="wk-line" onClick={() => openPanel({ kind: "schedule", id: n.s.id })}>
                  <span className="wk-bar" style={{ background: KIND_COLOR[n.s.kind] }} />
                  <span className="wk-line-t">{n.s.label}</span>
                  <span className="wk-line-o">{q.name(n.s.ownerId)}</span>
                  <span className="wk-line-w">{rel(n.at)}</span>
                </button>
              ))}
              {nexts.length === 0 && <div className="wk-line wk-small">{schedules.length ? "Every schedule is paused." : "No schedules yet."}</div>}
            </div>
          </section>

          <section className="wk-card wk-agenda" aria-label="Agenda">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="wk-card-t" style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>
                {day === today ? "Today" : fmtDay(day, { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <span className="wk-mono-s">{agenda.length} run{agenda.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {agenda.map((o) => (
                <button key={o.s.id + o.at} type="button" className="wk-line wk-line--agenda" data-selected={selected === o.s.id || undefined}
                  onClick={() => openPanel({ kind: "schedule", id: o.s.id })}>
                  <span className="wk-line-time">{clockText(o.at, tz)}</span>
                  <span className="wk-bar" style={{ height: 26, background: KIND_COLOR[o.s.kind], opacity: o.past && !o.produced ? 0.4 : 1 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="wk-line-t" style={{ display: "block" }}>{o.s.label}</span>
                    <span className="wk-line-sub">{q.name(o.s.ownerId)} · {o.past ? (o.produced ? "Produced" : "Not produced yet") : "Scheduled"}</span>
                  </span>
                </button>
              ))}
              {agenda.length === 0 && <div className="wk-line wk-small" style={{ display: "block" }}>Nothing scheduled{day === today ? " today" : " on this day"}. Pick another day on the calendar.</div>}
            </div>
            <div className="wk-small" style={{ padding: "10px 0 6px" }}>
              Open one to run its due instance. Each slot is produced once, so running it again never makes a duplicate.
            </div>
          </section>

          <section className="wk-card wk-routines" aria-label="Recurring routines">
            <div className="pf-eyebrow" style={{ padding: "16px 0 6px" }}>RECURRING ROUTINES</div>
            {schedules.map((s) => (
              <div key={s.id} className="wk-line wk-routine" data-selected={selected === s.id || undefined} role="button" tabIndex={0}
                onClick={() => openPanel({ kind: "schedule", id: s.id })}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); openPanel({ kind: "schedule", id: s.id }); } }}>
                <span className="wk-tile-ico" data-on={s.active || undefined}><Ico d={WI.cal} size={13} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="wk-line-t" style={{ display: "block" }}>{s.label}</span>
                  <span className="wk-line-sub wk-mono-s">{cadenceShort(s, tz)}</span>
                </span>
                <Toggle on={s.active} label={(s.active ? "Pause future runs of " : "Resume ") + s.label} disabled={!may(s)}
                  title={may(s) ? (s.active ? "Pause future runs" : "Resume") : "Only the owner or a workflow operator can change this."}
                  onChange={() => toggle.run(ops.setScheduleActive, s.id, !s.active)} />
              </div>
            ))}
            {schedules.length === 0 && (
              <div className="wk-line wk-small" style={{ display: "block" }}>
                {core.data.schedules.length ? "No schedules in " + scopeName + ". Try a wider scope from the top bar." : "No recurring routines yet. Recurring tasks, automations and reports appear here once they are set up."}
              </div>
            )}
            <InlineError text={toggle.err} />
            <div className="wk-routines-f">
              <span className="wk-small" style={{ flex: 1 }}>Switching one off pauses its future runs only. Tasks and runs it already created carry on.</span>
              <button type="button" className="wk-dashed-btn" onClick={scheduleTask}><Ico d={WI.plus} size={12} sw={2} />Schedule task</button>
            </div>
          </section>
        </div>
      )}

      {showRuns && <AutomationRuns refEl={runsRef} filter={runFilter} setFilter={setRunFilter} runs={runs} openPanel={openPanel} selected={selected} />}
      {!showSchedules && !showRuns && (
        <div className="wk-card wk-ap-empty"><b>Schedules and workflows are switched off</b><span>An administrator can switch them on in Settings &gt; Experience &gt; Enabled views.</span></div>
      )}
    </>
  );
}

const RUN_RANK: Record<WorkflowRun["status"], number> = { failed: 0, awaiting_input: 1, awaiting_approval: 2, paused: 3, running: 4, queued: 5, completed: 6 };

function AutomationRuns({ refEl, filter, setFilter, runs, openPanel, selected }: {
  refEl: RefObject<HTMLElement>; filter: RunFilter; setFilter: (f: RunFilter) => void; runs: WorkflowRun[]; openPanel: OpenPanel; selected?: string | null;
}) {
  const { core } = useCore();
  const { rel } = useClock();
  const templates = core.config.workflowTemplates;
  const tplLabel = (id: string) => templates.find((t) => t.id === id)?.label || "Unknown template";
  const attention = (r: WorkflowRun) => r.status === "failed" || r.status === "awaiting_input" || r.status === "awaiting_approval" || (!r.assigneeId && r.status !== "completed");
  const match: Record<Exclude<RunFilter, "templates">, (r: WorkflowRun) => boolean> = {
    all: () => true, attention, failed: (r) => r.status === "failed",
    active: (r) => r.status === "running" || r.status === "queued" || r.status === "paused", completed: (r) => r.status === "completed"
  };
  const pills: { id: RunFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: runs.length },
    { id: "attention", label: "Needs attention", count: runs.filter(attention).length },
    { id: "failed", label: "Failed", count: runs.filter(match.failed).length },
    { id: "active", label: "In flight", count: runs.filter(match.active).length },
    { id: "completed", label: "Completed", count: runs.filter(match.completed).length },
    { id: "templates", label: "Templates", count: templates.length }
  ];
  const rows = filter === "templates" ? [] : runs.filter(match[filter]).sort((a, b) => RUN_RANK[a.status] - RUN_RANK[b.status] || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section ref={refEl} className="wk-card wk-runs" aria-label="Automation runs">
      <div className="wk-runs-h">
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="wk-card-t">Automation runs</div>
          <div className="wk-card-m">Workflow runs from schedules, requests and manual starts. Failed runs first; open one to recover it.</div>
        </div>
      </div>
      <div className="wk-pills" role="group" aria-label="Filter runs">
        {pills.map((p) => (
          <button key={p.id} type="button" className="wk-fpill" aria-pressed={filter === p.id} onClick={() => setFilter(p.id)}>
            {p.label}<span>{p.count}</span>
          </button>
        ))}
      </div>

      <div className="wk-runs-scroll">
        {filter === "templates" ? (
          <div className="wk-runs-table">
            <div className="wk-runs-row wk-runs-th"><div>Template</div><div>Trigger</div><div>Owner</div><div>Steps</div><div>Status</div></div>
            {templates.map((t) => (
              <button key={t.id} type="button" className="wk-runs-row wk-runs-tr" onClick={() => openPanel({ kind: "template", id: t.id })}>
                <div className="wk-run-name"><span className="wk-sq" style={{ background: t.enabled ? "var(--ok)" : "var(--dim)" }} />
                  <span style={{ minWidth: 0 }}><span className="wk-line-t" style={{ display: "block" }}>{t.label}</span><span className="wk-mono-s">{t.description}</span></span></div>
                <div className="wk-cell-2"><span>{t.trigger.detail}</span><span className="wk-mono-s">{t.trigger.kind}</span></div>
                <Owner id={t.ownerId} />
                <div className="wk-mono-s" style={{ color: "var(--ink)" }}>{t.steps.length}</div>
                <div><span className="wk-ap-status" style={{ background: toneSoft(t.enabled ? "ok" : "neutral"), color: toneColor(t.enabled ? "ok" : "neutral") }}>{t.enabled ? "Enabled" : "Off"}</span></div>
              </button>
            ))}
            {templates.length === 0 && <div className="wk-empty"><b>No workflow templates yet</b><span>An administrator can add templates in Settings &gt; Control &gt; Workflow templates.</span></div>}
          </div>
        ) : (
          <div className="wk-runs-table">
            <div className="wk-runs-row wk-runs-th"><div>Run</div><div>Status</div><div>Owner</div><div>Updated</div><div>Steps</div></div>
            {rows.map((r, i) => {
              const tone = toneOf.run(r.status);
              const doneSteps = r.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
              const pct = r.steps.length ? Math.round((doneSteps / r.steps.length) * 100) : 0;
              return (
                <button key={r.id} type="button" className="wk-runs-row wk-runs-tr" data-selected={selected === r.id || undefined}
                  style={{ animationDelay: Math.min(i * 30, 300) + "ms" }} onClick={() => openPanel({ kind: "run", id: r.id })}>
                  <div className="wk-run-name"><span className="wk-sq" style={{ background: toneColor(tone) }} />
                    <span style={{ minWidth: 0 }}><span className="wk-line-t" style={{ display: "block" }}>{r.title}</span>
                      <span className="wk-mono-s">{r.ref} · {tplLabel(r.templateId)}</span></span></div>
                  <div className="wk-cell-2">
                    <span className="wk-ap-status" style={{ background: toneSoft(tone), color: toneColor(tone), width: "fit-content" }}>{LABEL.run[r.status]}</span>
                    {r.status === "failed" && r.failure && <span className="wk-mono-s" style={{ color: "var(--bad)" }} title={r.failure.message}>{r.failure.message}</span>}
                    {!r.assigneeId && r.status !== "completed" && <span className="wk-mono-s" style={{ color: "var(--warn)" }}>No owner</span>}
                  </div>
                  <Owner id={r.assigneeId || r.ownerId} />
                  <div className="wk-mono-s" style={{ color: "var(--ink)" }}>{rel(r.updatedAt)}</div>
                  <div className="wk-steps">
                    <span className="wk-steps-track"><span style={{ transform: "scaleX(" + pct / 100 + ")", background: toneColor(tone) }} /></span>
                    <span className="wk-mono-s">{doneSteps}/{r.steps.length}</span>
                  </div>
                </button>
              );
            })}
            {rows.length === 0 && (
              runs.length === 0
                ? <div className="wk-empty"><b>No workflow runs yet</b><span>{templates.length ? "Runs start when a request is submitted, a schedule ticks, or someone starts one. They appear here with every step." : "No workflow templates are configured yet. An administrator can add one in Settings > Control, then runs appear here."}</span></div>
                : <div className="wk-empty"><b>Nothing matches that filter</b><span>Choose All to see every run you can see.</span></div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Owner({ id }: { id: string }) {
  const { q } = useCore();
  return (
    <div className="wk-owner">
      <span className="wk-owner-chip" data-agent={id.startsWith("ag-") || undefined}>{q.initials(id)}</span>
      <span className="wk-owner-n">{q.name(id)}</span>
    </div>
  );
}
