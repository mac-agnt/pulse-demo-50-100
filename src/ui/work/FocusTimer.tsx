/* The personal focus timer card from the original Tasks header: a ring,
   15/25/50 minute presets, Start/Pause, reset and complete. It times one
   chosen task. State lives in this module only (it survives switching
   sections), nothing is recorded, reported or shared. Completing marks the
   timed task done through the normal task operation, so a blocked task or an
   open checklist is refused with the reason. */

import { useEffect, useReducer, useSyncExternalStore } from "react";
import { useCore, ops, store } from "../../core";
import { Ico, WI } from "./shared";

interface TimerState { taskId: string | null; preset: number; running: boolean; endsAt: number | null; left: number; error: string | null }

let st: TimerState = { taskId: null, preset: 25, running: false, endsAt: null, left: 25 * 60, error: null };
const subs = new Set<() => void>();
const set = (patch: Partial<TimerState>) => { st = { ...st, ...patch }; subs.forEach((f) => f()); };
const remaining = (s: TimerState) => (s.running && s.endsAt ? Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000)) : s.left);

export const focusTimer = {
  /** Start timing a task from its row. Keeps the chosen preset. */
  start(taskId: string) {
    const fresh = st.taskId !== taskId || remaining(st) === 0;
    const left = fresh ? st.preset * 60 : remaining(st);
    set({ taskId, running: true, left, endsAt: Date.now() + left * 1000, error: null });
  },
  get: () => st
};

function useTimer() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => st, () => st);
}

const R = 44, C = 2 * Math.PI * R;

export function FocusTimerCard({ fallbackTaskId }: { fallbackTaskId?: string }) {
  const s = useTimer();
  const { q } = useCore();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const left = remaining(s);

  useEffect(() => {
    if (!s.running) return;
    const h = setInterval(() => {
      if (remaining(st) <= 0) set({ running: false, left: 0, endsAt: null });
      else tick();
    }, 1000);
    return () => clearInterval(h);
  }, [s.running]);

  const task = s.taskId ? q.task(s.taskId) : undefined;
  const total = s.preset * 60;
  const idle = !s.running && !s.taskId && left === total;
  const state = s.running ? "RUNNING" : left === 0 ? "TIME UP" : s.taskId || left !== total ? "PAUSED" : "IDLE";
  const mm = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
  const progress = total ? left / total : 0;

  const toggle = () => {
    if (s.running) { set({ running: false, left: remaining(st), endsAt: null }); return; }
    const taskId = s.taskId || fallbackTaskId || null;
    const from = left === 0 ? total : left;
    set({ taskId, running: true, left: from, endsAt: Date.now() + from * 1000, error: null });
  };
  const reset = () => set({ taskId: null, running: false, endsAt: null, left: s.preset * 60, error: null });
  const pick = (m: number) => set({ preset: m, left: m * 60, endsAt: s.running ? Date.now() + m * 60 * 1000 : null, error: null });
  const complete = () => {
    if (!s.taskId) return;
    const r = store.run(ops.setTaskStatus, s.taskId, "done");
    if (r.ok) set({ taskId: null, running: false, endsAt: null, left: s.preset * 60, error: null });
    else set({ error: r.error });
  };

  const title = task ? task.title : s.taskId ? "A task you can no longer see" : s.running ? "Focus session" : "No task started";
  const sub = left === 0 ? "Time is up. Take a break, then reset or start again."
    : task || s.running ? "Personal only. Nothing is recorded or shared."
    : "Hit Start on a task, or pick a preset";

  return (
    <section className="wk-timer-card" aria-label="Focus timer">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pf-eyebrow" style={{ flex: 1 }}>FOCUS TIMER</span>
        <span className="pf-eyebrow" style={{ color: s.running ? "var(--accent)" : left === 0 ? "var(--warn)" : undefined }}>{state}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
        <div className="wk-ring" data-running={s.running || undefined}>
          <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r={R} fill="none" stroke="var(--border)" strokeWidth="2" opacity=".6" />
            {!idle && <circle cx="48" cy="48" r={R} fill="none" stroke={s.running ? "var(--accent)" : "var(--border-strong)"} strokeWidth="2" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 48 48)" />}
            <circle cx="48" cy="48" r="39" fill="none" stroke={s.running ? "var(--accent)" : "var(--border)"} strokeWidth="1" opacity={s.running ? ".8" : ".45"} />
          </svg>
          <span className="wk-ring-t" aria-live="off">{idle ? "00:00" : mm}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wk-timer-title">{title}</div>
          <div className="wk-timer-sub">{sub}</div>
          <div style={{ display: "flex", gap: 7, marginTop: 12 }} role="group" aria-label="Timer length">
            {[15, 25, 50].map((m) => (
              <button key={m} type="button" className="wk-preset" aria-pressed={s.preset === m} onClick={() => pick(m)}>{m}m</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: "var(--border)", margin: "18px 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="wk-timer-go" data-running={s.running || undefined} onClick={toggle}>
          <Ico d={s.running ? WI.pause : WI.play} size={15} sw={1.9} />{s.running ? "Pause" : left < total && left > 0 ? "Resume" : "Start"}
        </button>
        <button type="button" className="wk-icon-btn" onClick={reset} title="Reset" aria-label="Reset timer"><Ico d={WI.reset} size={15} sw={1.8} /></button>
        <button type="button" className="wk-icon-btn wk-icon-btn--ok" onClick={complete} disabled={!task}
          title={task ? "Mark the timed task done" : "Start a task first"} aria-label="Mark the timed task done"><Ico d={WI.check} size={15} sw={2} /></button>
      </div>
      {s.error && <div className="pk-error wk-inline-err" role="alert">{s.error}</div>}
    </section>
  );
}
