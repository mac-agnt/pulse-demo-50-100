/* Work > Calendar: one week combining permitted task deadlines, project
   milestones and business appointments, with automation schedules as a
   separate layer you can switch on. Schedules show recurrence, timezone,
   next run and owner; a slot that already produced its task shows once, as
   that task. Everything comes from calendarItems() in src/core/calendar.ts. */

import { useMemo, useState } from "react";
import { useCore, ops, calendarItems, addDaysKey, mondayOf, localDay, moduleEnabled, nextOccurrence, cadenceLabel, scopeLabel, openObject, type CalItem, type CalLayer } from "../../core";
import { Btn, eyebrowOf } from "../frame";
import { clockText, Ico, InlineError, SCHEDULE_KIND, Toggle, useClock, useRunner, useViewer, WI, WorkHead, type OpenPanel } from "./shared";

const LAYER_LABEL: Record<CalLayer, string> = { task: "Task deadlines", milestone: "Milestones", appointment: "Appointments", schedule: "Automation schedules" };
const LAYER_COLOR: Record<CalLayer, string> = { task: "var(--accent)", milestone: "var(--warn)", appointment: "var(--ok)", schedule: "var(--neutral)" };
const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function CalendarView({ openPanel, selected }: { openPanel: OpenPanel; selected?: string | null }) {
  const { core, ctx, q } = useCore();
  const { me, can: canDo } = useViewer();
  const { tz, now, rel } = useClock();
  const today = localDay(now, tz);
  const [week, setWeek] = useState(mondayOf(today));
  const [day, setDay] = useState(today);
  const projectsOn = moduleEnabled(core.config, "projects");
  const schedulesOn = core.config.capabilities.schedules !== false;
  const [layers, setLayers] = useState<CalLayer[]>(["task", "milestone", "appointment"]);
  const toggle = useRunner();

  const available: CalLayer[] = ["task", ...(projectsOn ? ["milestone" as const] : []), "appointment", ...(schedulesOn ? ["schedule" as const] : [])];
  const active = layers.filter((l) => available.includes(l));
  const all = useMemo(() => calendarItems(q, week, addDaysKey(week, 7), available), [q, week, available.join(",")]);
  const items = all.filter((i) => active.includes(i.layer));
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(week, i));
  const agenda = items.filter((i) => i.day === day);
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(k + "T12:00:00Z"));
  const schedules = q.schedules();
  const may = (ownerId: string) => ownerId === me || canDo("workflows.operate");

  const open = (i: CalItem) => {
    if (i.object.kind === "task") openPanel({ kind: "task", id: i.object.id });
    else if (i.object.kind === "appointment") openPanel({ kind: "appointment", id: i.object.id });
    else if (i.object.kind === "schedule") openPanel({ kind: "schedule", id: i.object.id });
    else openObject("project", i.object.id);
  };
  const flip = (l: CalLayer) => setLayers(active.includes(l) ? active.filter((x) => x !== l) : [...active, l]);
  const count = (l: CalLayer) => all.filter((i) => i.layer === l).length;
  const sub = (i: CalItem) => i.layer === "task" ? (i.ownerId ? q.name(i.ownerId) : "Unassigned") + (i.scheduleId ? ", from a schedule" : "") + (i.done ? ", done" : i.overdue ? ", overdue" : "")
    : i.layer === "milestone" ? "Milestone, " + q.name(i.ownerId) + (i.done ? ", reached" : i.overdue ? ", missed" : "")
    : i.layer === "appointment" ? (i.minutes || 0) + " min, " + q.name(i.ownerId)
    : (i.recurrence || "") + ", owner " + q.name(i.ownerId) + (i.past ? (i.produced ? ", produced" : ", not produced") : "");

  return (
    <>
      <WorkHead eyebrow={eyebrowOf("Work", "Calendar", scopeLabel(core, ctx.scope), "times in " + tz)} title="Calendar"
        info="Task deadlines, project milestones and business appointments you are allowed to see. Automation schedules are a separate layer."
        extra={<Btn onClick={() => openPanel({ kind: "newTask", due: day >= today ? day : today })}><Ico d={WI.cal} size={14} />Schedule a task</Btn>}
        primary={<Btn primary onClick={() => openPanel({ kind: "newAppointment", due: day })}><Ico d={WI.plus} size={14} sw={2.1} />New appointment</Btn>} />

      <div className="wk-viewbar">
        <div className="wk-mini-seg" role="group" aria-label="Week">
          <button type="button" onClick={() => setWeek(addDaysKey(week, -7))} aria-label="Previous week">Previous</button>
          <button type="button" aria-pressed={week === mondayOf(today)} onClick={() => { setWeek(mondayOf(today)); setDay(today); }}>This week</button>
          <button type="button" onClick={() => setWeek(addDaysKey(week, 7))} aria-label="Next week">Next</button>
        </div>
        <span className="wk-card-t" style={{ fontSize: 13.5 }}>{fmt(week, { day: "numeric", month: "short" })} to {fmt(addDaysKey(week, 6), { day: "numeric", month: "short", year: "numeric" })}</span>
        <span className="wk-vsep" aria-hidden="true" />
        <div className="wk-layers" role="group" aria-label="Calendar layers">
          {available.map((l) => (
            <button key={l} type="button" className="wk-fpill" aria-pressed={active.includes(l)} onClick={() => flip(l)}
              title={l === "schedule" ? "Recurring tasks, automations and reports. Kept apart from business appointments." : undefined}>
              <i style={{ width: 7, height: 7, borderRadius: 2, background: LAYER_COLOR[l], display: "inline-block" }} />{LAYER_LABEL[l]}<span>{count(l)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wk-cal-grid2">
        <section className="wk-card wk-cal-card" aria-label="Week calendar">
          <div className="wk-cal wk-cal--v2" style={{ marginTop: 4 }}>
            {DAY_NAMES.map((d) => <div key={d} className="wk-cal-dn">{d}</div>)}
            {days.map((k) => {
              const list = items.filter((i) => i.day === k);
              return (
                <div key={k} role="group" className="wk-day" data-today={k === today || undefined} data-sel={(k === day && k !== today) || undefined}
                  onClick={() => setDay(k)} aria-label={fmt(k, { weekday: "long", day: "numeric", month: "long" }) + ", " + list.length + " entries"}>
                  <div className="wk-day-head">
                    <button type="button" className="wk-day-n" style={{ border: 0, background: "none", cursor: "pointer", font: "inherit" }} aria-pressed={k === day}
                      onClick={(e) => { e.stopPropagation(); setDay(k); }} aria-label={"Show " + fmt(k, { weekday: "long", day: "numeric", month: "long" })}>{Number(k.slice(8))}</button>
                    <button type="button" className="wk-day-add" title="New appointment on this day" aria-label={"New appointment on " + fmt(k, { day: "numeric", month: "long" })}
                      onClick={(e) => { e.stopPropagation(); openPanel({ kind: "newAppointment", due: k }); }}>+</button>
                  </div>
                  {list.slice(0, 6).map((i) => (
                    <button key={i.key} type="button" className="wk-cal-chip" style={{ borderLeftColor: LAYER_COLOR[i.layer], borderLeftStyle: i.layer === "schedule" ? "dashed" : "solid" }}
                      data-done={i.done || undefined} data-late={(i.overdue && !i.done) || undefined} data-missed={(i.layer === "schedule" && i.past && !i.produced) || undefined}
                      title={clockText(i.at, tz) + " " + i.title + ", " + sub(i)} onClick={(e) => { e.stopPropagation(); open(i); }}>
                      {clockText(i.at, tz)} {i.title}
                    </button>
                  ))}
                  {list.length > 6 && <button type="button" className="wk-day-add" style={{ marginLeft: 0 }} onClick={(e) => { e.stopPropagation(); setDay(k); }}>+{list.length - 6} more</button>}
                </div>
              );
            })}
          </div>
          <div className="wk-legend">
            {available.map((l) => <span key={l}><i style={{ background: LAYER_COLOR[l] }} />{LAYER_LABEL[l]}</span>)}
            <span><i style={{ background: "none", border: "1px dashed var(--border-strong)" }} />Schedule slot not produced</span>
          </div>
        </section>

        <div className="wk-stack" style={{ gap: 14 }}>
          <section className="wk-card wk-agenda" aria-label="Agenda">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="wk-card-t" style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{day === today ? "Today" : fmt(day, { weekday: "short", day: "numeric", month: "short" })}</span>
              <span className="wk-mono-s">{agenda.length} entr{agenda.length === 1 ? "y" : "ies"}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {agenda.map((i) => (
                <button key={i.key} type="button" className="wk-line wk-line--agenda" data-selected={selected === i.object.id || undefined} onClick={() => open(i)}>
                  <span className="wk-line-time">{clockText(i.at, tz)}</span>
                  <span className="wk-bar" style={{ height: 26, background: LAYER_COLOR[i.layer], opacity: i.done ? 0.45 : 1 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="wk-line-t" style={{ display: "block", color: i.overdue && !i.done ? "var(--bad)" : undefined }}>{i.title}</span>
                    <span className="wk-line-sub">{LAYER_LABEL[i.layer]}: {sub(i)}</span>
                  </span>
                </button>
              ))}
              {agenda.length === 0 && <div className="wk-line wk-small" style={{ display: "block" }}>Nothing in the selected layers on this day.</div>}
            </div>
          </section>

          {schedulesOn && (
            <section className="wk-card wk-routines" aria-label="Automation schedules">
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0 6px" }}>
                <span className="pf-eyebrow" style={{ flex: 1 }}>AUTOMATION SCHEDULES · {schedules.length}</span>
                <button type="button" className="wk-dashed-btn" onClick={() => openPanel({ kind: "newSchedule" })}><Ico d={WI.plus} size={12} sw={2} />Recurring work</button>
              </div>
              {schedules.map((s) => (
                <div key={s.id} className="wk-line wk-routine" data-selected={selected === s.id || undefined} role="button" tabIndex={0}
                  onClick={() => openPanel({ kind: "schedule", id: s.id })}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); openPanel({ kind: "schedule", id: s.id }); } }}>
                  <span className="wk-tile-ico" data-on={s.active || undefined}><Ico d={WI.cal} size={13} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="wk-line-t" style={{ display: "block" }}>{s.label}</span>
                    <span className="wk-line-sub">{SCHEDULE_KIND[s.kind]}, {cadenceLabel(s.cadence, s.timezone)}</span>
                    <span className="wk-line-sub">Owner {q.name(s.ownerId)}. {s.active ? "Next run " + rel(nextOccurrence(s.cadence, now, s.timezone)) : "Paused"}</span>
                  </span>
                  <Toggle on={s.active} label={(s.active ? "Pause future runs of " : "Resume ") + s.label} disabled={!may(s.ownerId)}
                    title={may(s.ownerId) ? (s.active ? "Pause future runs" : "Resume") : "Only the owner or a workflow operator can change this."}
                    onChange={() => toggle.run(ops.setScheduleActive, s.id, !s.active)} />
                </div>
              ))}
              {schedules.length === 0 && <div className="wk-line wk-small" style={{ display: "block" }}>No schedules in this scope. Recurring tasks, automations and reports appear here once set up.</div>}
              <InlineError text={toggle.err} />
              <div className="wk-small" style={{ padding: "12px 0 8px", borderTop: "1px solid var(--border)" }}>
                Each slot is produced once, so running a schedule again never makes a duplicate. Pausing stops future runs only.
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
