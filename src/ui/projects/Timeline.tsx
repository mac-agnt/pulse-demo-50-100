/* Projects > Timeline. One row per project: phase spans (derived from where
   each phase's milestones fall), milestones at their current date with the
   baseline as a ghost, dependencies as connectors and a today line. It
   scrolls inside its own region; milestones are buttons, so the whole chart
   is keyboard reachable. */

import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  DAY, milestoneGate, pageLabel, milestoneSlipDays, ms, projectHealth, projectMilestones, projectPhases, projectsFor, scopeLabel, PROJECT_HEALTH_LABEL,
  type Milestone, type Project
} from "../../core";
import { Hero, eyebrowOf } from "../frame";
import { Empty, useNarrow } from "../kit";
import { HealthChip, useProjectsCtx, type DetailTab } from "./shared";

const ROW = 66;
const HEAD = 42;

export function Timeline({ onOpen }: { onOpen: (id: string, tab?: DetailTab, milestoneId?: string) => void }) {
  const { core, ctx, q, T, d, now, tz } = useProjectsCtx();
  const narrow = useNarrow();
  const PX = narrow ? 4 : 6;
  const LEFT = narrow ? 128 : 230;
  const scroller = useRef<HTMLDivElement>(null);

  const projects = useMemo(() => projectsFor(q).slice().sort((a, b) => a.startDate.localeCompare(b.startDate)), [q]);
  const msOf = (p: Project) => projectMilestones(core, p.id);

  const range = useMemo(() => {
    const times = projects.flatMap((p) => [ms(p.startDate), ms(p.endDate), ...msOf(p).flatMap((m) => [ms(m.dueAt), ms(m.baselineAt)])]);
    times.push(ms(now));
    const start = new Date(Math.min(...times) - 7 * DAY);
    start.setUTCDate(1);
    return { start: start.getTime(), end: Math.max(...times) + 14 * DAY };
  }, [projects, core, now]);

  const x = (at: string | number) => Math.round(((typeof at === "number" ? at : ms(at)) - range.start) / DAY * PX);
  const width = x(range.end);
  const height = HEAD + projects.length * ROW;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, x(now) - el.clientWidth / 3);
  }, [PX, projects.length]);

  const months: { at: number; label: string }[] = [];
  for (let t = new Date(range.start); t.getTime() < range.end; t.setUTCMonth(t.getUTCMonth() + 1)) {
    months.push({ at: t.getTime(), label: new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "short", year: "numeric" }).format(t) });
  }

  const header = (
    <Hero eyebrow={eyebrowOf(pageLabel(core.config, "Projects"), "Timeline", scopeLabel(core, ctx.scope))} title="Timeline" infoOnly
      blurb={"Phases, milestones and dependencies for every " + T.oneLower + " in scope. Filled markers are current dates; hollow markers are baselines."}
      aside={
        <div className="pj-legend" aria-label="Legend">
          <span><i className="pj-dm" /> Milestone</span>
          <span><i className="pj-dm pj-dm--ghost" /> Baseline</span>
          <span><i className="pj-dm pj-dm--done" /> Complete</span>
          <span><i className="pj-dm pj-dm--warn" /> Slipped or at risk</span>
          <span><i className="pj-today-key" /> Today</span>
        </div>
      } />
  );

  if (!projects.length) return <>{header}<Empty title={"No " + T.manyLower + " in this scope"} body="Choose a wider scope in the top bar, or create one in the Portfolio." /></>;

  return (
    <>
      {header}
      <div className="pk-card pj-tl" style={{ gridTemplateColumns: LEFT + "px 1fr" }}>
        <div className="pj-tl-names" style={{ paddingTop: HEAD }}>
          {projects.map((p) => {
            const h = projectHealth(core, p, now);
            return (
              <button key={p.id} type="button" className="pj-tl-name" style={{ height: ROW }} onClick={() => onOpen(p.id, "plan")}
                aria-label={p.title + ", " + PROJECT_HEALTH_LABEL[h.health] + ". Open the plan."}>
                <span className="pj-tl-title">{p.title}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}><HealthChip health={h.health} />{!narrow && <span className="pj-faint">{q.name(p.ownerId)}</span>}</span>
              </button>
            );
          })}
        </div>
        <div className="pj-tl-scroll" ref={scroller} tabIndex={0} aria-label="Timeline, scrolls sideways" role="region">
          <div className="pj-tl-canvas" style={{ width, height }}>
            {months.map((m) => (
              <div key={m.at} className="pj-tl-month" style={{ left: x(m.at), height }}>
                <span>{m.label}</span>
              </div>
            ))}
            <svg className="pj-tl-svg" width={width} height={height} aria-hidden="true">
              <defs>
                <marker id="pj-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill="var(--faint)" />
                </marker>
                <marker id="pj-arrow-warn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill="var(--warn)" />
                </marker>
              </defs>
              {projects.map((p, i) => {
                const list = msOf(p);
                const y = HEAD + i * ROW + ROW / 2 + 10;
                return list.flatMap((m) => m.dependsOn.map((depId) => {
                  const dep = list.find((z) => z.id === depId);
                  if (!dep) return null;
                  const x1 = x(dep.dueAt), x2 = x(m.dueAt);
                  const bad = !m.completedAt && ms(dep.dueAt) > ms(m.dueAt);
                  const lift = 16;
                  return <path key={m.id + depId} d={"M" + x1 + " " + (y - 7) + " V" + (y - lift) + " H" + x2 + " V" + (y - 8)} fill="none"
                    stroke={bad ? "var(--warn)" : "var(--faint)"} strokeWidth={bad ? 1.6 : 1.1} strokeDasharray={bad ? "4 3" : undefined}
                    markerEnd={"url(#" + (bad ? "pj-arrow-warn" : "pj-arrow") + ")"} opacity={0.85} />;
                }));
              })}
              {projects.map((p, i) => msOf(p).filter((m) => milestoneSlipDays(core, m) !== 0).map((m) => {
                const y = HEAD + i * ROW + ROW / 2 + 10;
                return <line key={"b" + m.id} x1={x(m.baselineAt)} x2={x(m.dueAt)} y1={y} y2={y} stroke="var(--warn)" strokeDasharray="2 3" strokeWidth={1.2} />;
              }))}
            </svg>
            {projects.map((p, i) => <Fragment key={p.id}>{renderRow(p, HEAD + i * ROW)}</Fragment>)}
            <div className="pj-tl-today" style={{ left: x(now), height }} aria-hidden="true"><span>Today</span></div>
          </div>
        </div>
      </div>
      <p className="pj-faint" style={{ margin: "10px 4px 0", fontSize: 12 }}>
        Phase spans run from the end of the previous phase to the last milestone in that phase. Dates shown in {tz}. Dashed connectors mark a {T.oneLower} milestone due before one it depends on.
      </p>
    </>
  );

  function renderRow(p: Project, top: number) {
    const list = msOf(p);
    const phases = projectPhases(core.config, p);
    const cur = phases.findIndex((ph) => ph.id === p.phaseId);
    const spans: { id: string; label: string; from: string; to: string; state: "past" | "current" | "future" }[] = [];
    let prev = p.startDate;
    phases.forEach((ph, i) => {
      const inPhase = list.filter((m) => m.phaseId === ph.id);
      const end = inPhase.length ? inPhase.reduce((a, b) => (ms(b.dueAt) > ms(a.dueAt) ? b : a)).dueAt : i === phases.length - 1 ? p.endDate : null;
      if (!end || ms(end) <= ms(prev)) return;
      spans.push({ id: ph.id, label: ph.label, from: prev, to: end, state: i < cur ? "past" : i === cur ? "current" : "future" });
      prev = end;
    });
    const y = top + ROW / 2 + 10;
    return (
      <>
        {spans.map((sp) => (
          <div key={sp.id} className={"pj-span pj-span--" + sp.state} style={{ left: x(sp.from), width: Math.max(2, x(sp.to) - x(sp.from) - 2), top: top + 10 }}
            title={sp.label + ": " + d(sp.from) + " to " + d(sp.to)}>
            <span>{sp.label}</span>
          </div>
        ))}
        {list.map((m) => <Fragment key={m.id}>{renderMark(m, p, y)}</Fragment>)}
      </>
    );
  }

  function renderMark(m: Milestone, p: Project, y: number) {
    const slip = milestoneSlipDays(core, m);
    const g = milestoneGate(core, m);
    const overdue = !m.completedAt && ms(m.dueAt) < ms(now);
    const warn = !m.completedAt && (slip >= core.config.projects.atRiskSlipDays || (g && !g.satisfied) || msOf(p).some((dd) => m.dependsOn.includes(dd.id) && !dd.completedAt && ms(dd.dueAt) > ms(m.dueAt)));
    const cls = "pj-dm pj-dm--btn" + (m.completedAt ? " pj-dm--done" : overdue ? " pj-dm--bad" : warn ? " pj-dm--warn" : "");
    const label = m.label + ", " + (m.completedAt ? "complete" : "due " + d(m.dueAt)) + (slip ? ", baseline " + d(m.baselineAt) + " (" + (slip > 0 ? "+" : "") + slip + " days)" : "")
      + (g ? ", gate " + (g.satisfied ? "satisfied" : "not satisfied: " + g.text) : "") + (overdue ? ", overdue" : "");
    return (
      <>
        {slip !== 0 && <span className="pj-dm pj-dm--ghost pj-dm--abs" style={{ left: x(m.baselineAt) - 6, top: y - 6 }} aria-hidden="true" />}
        <button type="button" className={cls} style={{ left: x(m.dueAt) - 7, top: y - 7 }} title={label} aria-label={label} onClick={() => onOpen(p.id, "plan", m.id)}>
          {g && <span className={"pj-gate-dot" + (g.satisfied ? " pj-gate-dot--ok" : "")} />}
        </button>
        {!narrow && <span className="pj-dm-label" style={{ left: x(m.dueAt) + 10, top: y - 7 }} aria-hidden="true">{m.label}</span>}
      </>
    );
  }
}
