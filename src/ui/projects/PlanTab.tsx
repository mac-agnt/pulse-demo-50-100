/* Project > Plan: phases (with the gate that blocks the next one), milestones
   with baselines, dependencies and gates, and work grouped by phase. Moving a
   milestone opens an impact preview first: affected milestones, tasks, gates,
   health before and after, the owner, and whether it applies now or needs an
   approved change request. */

import { useEffect, useRef, useState } from "react";
import {
  completeMilestone, milestoneGate, milestoneImpact, milestoneSlipDays, moduleEnabled, moveMilestone, ms, openObject, phaseBlockers, projectDay,
  projectHealth, projectMilestones, projectPhaseLabel, projectPhases, projectTasks, requestMilestoneChange, setProjectPhase, store,
  OBLIGATION_STATE_TEXT, PROJECT_HEALTH_LABEL, type Milestone, type Project
} from "../../core";
import { Button, Chip, Field, Notice, Overflow, PersonName, SidePanel, TextArea } from "../kit";
import { dayInput, Faint, HealthChip, SlipChip, useProjectsCtx } from "./shared";

export function PlanTab({ p, canChange, focusMilestone }: { p: Project; canChange: boolean; focusMilestone?: string | null }) {
  const { core, now, d, T } = useProjectsCtx();
  const [moving, setMoving] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [openGate, setOpenGate] = useState<string | null>(focusMilestone || null);
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focusMilestone) focusRef.current?.focus(); }, [focusMilestone]);

  const phases = projectPhases(core.config, p);
  const ci = phases.findIndex((x) => x.id === p.phaseId);
  const next = phases[ci + 1];
  const blockers = next ? phaseBlockers(core, p, next.id) : [];
  const list = projectMilestones(core, p.id);
  const h = projectHealth(core, p, now);
  const standardsOn = moduleEnabled(core.config, "standards");
  const tasks = projectTasks(core, p.id).filter((t) => t.status !== "cancelled");

  const runPhase = (phaseId: string) => {
    const r = store.run(setProjectPhase, p.id, phaseId);
    setErr(r.ok ? null : { id: "phase", text: r.error });
  };

  return (
    <>
      <section className="pj-box">
        <div className="pj-tabhead" style={{ marginBottom: 10 }}>
          <div className="pk-eyebrow">Phases</div>
          {canChange && (
            <Overflow label="Set phase" icon={<span>Set phase</span>} items={phases.filter((x) => x.id !== p.phaseId).map((x) => ({ label: "Move to " + x.label, onClick: () => runPhase(x.id) }))} />
          )}
        </div>
        <ol className="pj-phases">
          {phases.map((ph, i) => (
            <li key={ph.id} className={"pj-phase" + (i < ci ? " pj-phase--past" : i === ci ? " pj-phase--current" : "")} aria-current={i === ci ? "step" : undefined}>
              <span className="pj-phase-n">{i + 1}</span>{ph.label}
            </li>
          ))}
        </ol>
        {next && (
          <div className="pj-phase-next">
            {blockers.length ? (
              <div className="pj-faint" style={{ color: "var(--warn)" }}>
                {next.label} is blocked: the gate “{blockers[0].gate.label}” on “{blockers[0].milestone.label}” is not satisfied. {blockers[0].gate.text}.
              </div>
            ) : <div className="pj-faint">No gate blocks the next phase, {next.label}.</div>}
            <Button variant={blockers.length ? "secondary" : "primary"} disabled={!canChange || blockers.length > 0} onClick={() => runPhase(next.id)}
              title={!canChange ? "Only the owner or a manager of its team can change the phase" : blockers.length ? "Satisfy the gate first" : undefined}>
              Next phase: {next.label}
            </Button>
          </div>
        )}
        {err?.id === "phase" && <div className="pk-error" role="alert" style={{ marginTop: 8 }}>{err.text}</div>}
      </section>

      <section className="pj-box">
        <div className="pk-eyebrow">Milestones and gates</div>
        <div className="pj-faint" style={{ margin: "6px 0 10px" }}>
          A gate is a prerequisite: the milestone cannot be completed, and later phases cannot start, until every requirement it names is approved in Standards.
          {core.config.projects.cascadeMilestoneMoves ? " Moving a milestone moves the milestones and tasks that depend on it." : " Moving a milestone does not move its dependants; they are listed and flagged."}
        </div>
        {list.length === 0 && <Faint>No milestones yet.</Faint>}
        <div className="pj-mslist">
          {list.map((m) => {
            const slip = milestoneSlipDays(core, m);
            const g = milestoneGate(core, m);
            const overdue = !m.completedAt && ms(m.dueAt) < ms(now);
            const conflict = h.reasons.filter((r) => r.kind === "dependency" && r.refId === m.id);
            const deps = m.dependsOn.map((id) => core.data.milestones.find((x) => x.id === id)?.label).filter(Boolean);
            const linked = tasks.filter((t) => t.milestoneId === m.id);
            const openLinked = linked.filter((t) => t.status !== "done").length;
            const focused = focusMilestone === m.id;
            return (
              <div key={m.id} className={"pj-ms" + (focused ? " pj-ms--focus" : "")} ref={focused ? focusRef : undefined} tabIndex={focused ? -1 : undefined}>
                <div className="pj-ms-row">
                  <span className={"pj-dm" + (m.completedAt ? " pj-dm--done" : overdue ? " pj-dm--bad" : slip >= core.config.projects.atRiskSlipDays || conflict.length ? " pj-dm--warn" : "")} aria-hidden="true" />
                  <div className="pj-ms-main">
                    <div className="pj-ms-title">{m.label}</div>
                    <div className="pj-faint">
                      {projectPhaseLabel(core.config, p, m.phaseId)}
                      {deps.length ? " · after " + deps.join(", ") : ""}
                      {" · " + openLinked + " of " + linked.length + " linked tasks open"}
                    </div>
                  </div>
                  <div className="pj-ms-date">
                    <span className="pj-mono" style={{ color: overdue ? "var(--bad)" : undefined }}>{m.completedAt ? "Done " + d(m.completedAt) : d(m.dueAt)}</span>
                    {!m.completedAt && <SlipChip days={slip} />}
                    {slip !== 0 && <span className="pj-faint">baseline {d(m.baselineAt)}</span>}
                  </div>
                  <div className="pj-ms-state">
                    {m.completedAt ? <Chip tone="ok">Complete</Chip> : overdue ? <Chip tone="bad">Overdue</Chip> : conflict.length ? <Chip tone="warn" title={conflict.map((c) => c.text).join(". ")}>At risk</Chip> : <Chip tone="neutral">Open</Chip>}
                    {g && (
                      <button type="button" className="pj-linkbtn" aria-expanded={openGate === m.id} onClick={() => setOpenGate(openGate === m.id ? null : m.id)}>
                        <Chip tone={g.satisfied ? "ok" : "warn"}>{g.satisfied ? "Gate satisfied" : "Gate: " + g.missing.length + " of " + g.items.length + " outstanding"}</Chip>
                      </button>
                    )}
                  </div>
                  <div className="pj-ms-actions">
                    {!m.completedAt && <Button size="sm" onClick={() => setMoving(m.id)}>Move date</Button>}
                    {!m.completedAt && (
                      <Button size="sm" variant="ghost" disabled={!canChange || (!!g && !g.satisfied)}
                        title={!canChange ? "Only the owner or a manager of its team can complete milestones" : g && !g.satisfied ? "The gate is not satisfied: " + g.text : undefined}
                        onClick={() => { const r = store.run(completeMilestone, m.id); setErr(r.ok ? null : { id: m.id, text: r.error }); }}>Mark complete</Button>
                    )}
                  </div>
                </div>
                {conflict.map((c, i) => <div key={i} className="pj-ms-note" style={{ color: "var(--warn)" }}>{c.text}. Move it, or move the milestone it depends on.</div>)}
                {g && openGate === m.id && (
                  <div className="pj-gatebox">
                    <div><b>{g.label}</b></div>
                    {g.items.map((it) => (
                      <div key={it.obligationId} className="pj-gate-item">
                        <span className="pk-grow">{it.label}</span>
                        <Chip tone={it.ok ? "ok" : it.state === "rejected" || it.state === "expired" ? "bad" : "warn"}>{OBLIGATION_STATE_TEXT[it.state]}</Chip>
                        {it.state !== "not_found" && standardsOn && <Button size="sm" variant="ghost" onClick={() => openObject("obligation", it.obligationId)}>Open in Standards</Button>}
                      </div>
                    ))}
                    {!standardsOn && <div className="pj-faint">Standards is switched off, so this evidence cannot be reviewed until it is switched on again. The gate stays closed.</div>}
                    <div className="pj-faint">A received file is not accepted evidence. Only approval in review releases the gate.</div>
                  </div>
                )}
                {err?.id === m.id && <div className="pk-error" role="alert">{err.text}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="pj-box">
        <div className="pk-eyebrow">Work by phase</div>
        <div className="pj-faint" style={{ margin: "6px 0 10px" }}>Workstreams are the {T.oneLower}'s tasks grouped by phase. Hours count estimated tasks only.</div>
        <table className="pj-mini">
          <thead><tr><th>Phase</th><th>Open</th><th>Done</th><th>Estimated hours (done of total)</th><th>Unestimated</th></tr></thead>
          <tbody>
            {phases.map((ph) => {
              const ts = tasks.filter((t) => t.phaseId === ph.id);
              const est = ts.filter((t) => typeof t.estimateHours === "number");
              const done = est.filter((t) => t.status === "done").reduce((n, t) => n + (t.estimateHours || 0), 0);
              const total = est.reduce((n, t) => n + (t.estimateHours || 0), 0);
              return (
                <tr key={ph.id}>
                  <td>{ph.label}</td>
                  <td className="pj-mono">{ts.filter((t) => t.status !== "done").length}</td>
                  <td className="pj-mono">{ts.filter((t) => t.status === "done").length}</td>
                  <td className="pj-mono">{est.length ? done + " of " + total + " h" : <Faint>No estimates</Faint>}</td>
                  <td className="pj-mono">{ts.length - est.length || <Faint>None</Faint>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {moving && <MovePanel key={moving} m={core.data.milestones.find((x) => x.id === moving)!} p={p} onClose={() => setMoving(null)} />}
    </>
  );
}

function MovePanel({ m, p, onClose }: { m: Milestone; p: Project; onClose: () => void }) {
  const { core, ctx, q, d, tz, T } = useProjectsCtx();
  const [date, setDate] = useState(dayInput(m.dueAt, tz));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);
  const to = projectDay(date, tz);
  const imp = to ? milestoneImpact(core, m.id, to, ctx) : null;
  const same = !!imp && imp.deltaDays === 0;

  const submit = () => {
    if (!imp || !to) return;
    if (imp.route === "direct") {
      const r = store.run(moveMilestone, m.id, date, reason);
      if (r.ok) onClose(); else setErr(r.error);
    } else {
      const r = store.run(requestMilestoneChange, m.id, date, reason);
      if (r.ok && r.id) setRequested(r.id); else if (!r.ok) setErr(r.error);
    }
  };

  if (requested) {
    const req = q.request(requested);
    const ap = req && core.data.approvals.find((a) => a.id === req.approvalId);
    const who = ap?.stages.find((s) => s.status === "pending")?.assigneeId;
    return (
      <SidePanel open onClose={onClose} title="Change request raised" eyebrow={m.label} width={560}
        footer={<><span className="pk-grow" /><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={() => openObject("request", requested)}>Open request</Button></>}>
        <Notice tone="ok">{req?.ref || "The request"} is in Work, waiting on {q.name(who)}. The milestone keeps its date until the request is approved and then run.</Notice>
      </SidePanel>
    );
  }

  return (
    <SidePanel open onClose={onClose} title={"Move “" + m.label + "”"} eyebrow={p.ref + " · IMPACT PREVIEW"} width={680}
      footer={<>
        <span className="pk-grow pk-help">{imp ? imp.routeReason : ""}</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!imp || same || (imp.route === "request" && !reason.trim())} onClick={submit}
          title={imp?.route === "request" && !reason.trim() ? "Give a reason for the request" : undefined}>
          {imp?.route === "request" ? "Raise change request" : "Move milestone"}
        </Button>
      </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="pj-grid2">
          <Field label="New date" help={"Currently " + d(m.dueAt) + (milestoneSlipDays(core, m) ? ", baseline " + d(m.baselineAt) : "") + "."}>
            <input className="pk-input" type="date" aria-label="New date" value={date} onChange={(e) => { setDate(e.target.value); setErr(null); }} />
          </Field>
          <Field label="Responsible owner"><div style={{ paddingTop: 8 }}><PersonName id={p.ownerId} /></div></Field>
        </div>
        <Field label={imp?.route === "request" ? "Reason (required for the request)" : "Reason (optional)"}><TextArea value={reason} onChange={setReason} rows={2} /></Field>
        {!imp ? <Notice tone="warn">Enter a valid date to see the impact.</Notice> : same ? <Notice>That is the current date. Choose another date to see the impact.</Notice> : (
          <>
            <div className="pj-impact-head">
              <span className="pj-mono">{d(imp.from)} to {d(imp.to)}</span>
              <Chip tone={imp.deltaDays > 0 ? "warn" : "ok"}>{(imp.deltaDays > 0 ? "+" : "") + imp.deltaDays + " days"}</Chip>
              {imp.beyondEnd && <Chip tone="warn">Past the end date ({d(p.endDate)})</Chip>}
              <Chip tone={imp.route === "direct" ? "ok" : "accent"}>{imp.route === "direct" ? "Applies now" : "Needs approval"}</Chip>
            </div>

            <div>
              <div className="pk-eyebrow">Health</div>
              <div className="pj-impact-health">
                <span>Now</span><HealthChip health={imp.health.before.health} />
                <span aria-hidden="true">→</span>
                <span>After</span><HealthChip health={imp.health.after.health} />
                <span className="pj-faint">Owner-reported stays {imp.health.before.reported ? PROJECT_HEALTH_LABEL[imp.health.before.reported].toLowerCase() : "unreported"}</span>
              </div>
              {imp.health.after.reasons.length > 0 && (
                <ul className="pj-reasons">{imp.health.after.reasons.map((r, i) => <li key={i} className={"pj-reason pj-reason--" + r.level}>{r.text}</li>)}</ul>
              )}
            </div>

            <div>
              <div className="pk-eyebrow">Dependent milestones · {imp.milestones.length}</div>
              {imp.milestones.length === 0 ? <div className="pj-faint">None recorded.</div> : (
                <table className="pj-mini">
                  <thead><tr><th>Milestone</th><th>Now</th><th>{imp.cascade ? "Moves to" : "Proposed"}</th><th>Effect</th></tr></thead>
                  <tbody>
                    {imp.milestones.map((x) => (
                      <tr key={x.milestone.id}>
                        <td>{x.milestone.label}</td>
                        <td className="pj-mono">{d(x.from)}</td>
                        <td className="pj-mono">{d(x.to)}</td>
                        <td>{x.applied ? <Chip tone="accent">Moves with it</Chip> : <Chip tone="neutral">Proposed, not applied</Chip>}
                          {x.conflict && <> <Chip tone="warn">Flagged at risk</Chip></>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <div className="pk-eyebrow">Affected tasks · {imp.tasks.length}</div>
              {imp.tasks.length === 0 ? <div className="pj-faint">No open tasks are linked.</div> : (
                <table className="pj-mini">
                  <thead><tr><th>Task</th><th>Assignee</th><th>Why</th><th>Due</th></tr></thead>
                  <tbody>
                    {imp.tasks.map((x) => (
                      <tr key={x.task.id}>
                        <td>{x.task.title}</td>
                        <td>{q.name(x.task.assigneeId)}</td>
                        <td>{x.why}</td>
                        <td className="pj-mono">{x.to ? d(x.from) + " to " + d(x.to) + (x.applied ? "" : " (proposed)") : (x.from ? d(x.from) + " (unchanged)" : "No date")}
                          {x.conflict && <> <Chip tone="warn">After the new date</Chip></>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {imp.gates.length > 0 && (
              <div>
                <div className="pk-eyebrow">Gates</div>
                {imp.gates.map((g) => <div key={g.milestoneId} className="pj-faint">“{g.milestone}”: {g.status.label}, {g.status.satisfied ? "satisfied" : g.status.text.toLowerCase()}.</div>)}
              </div>
            )}

            <div className="pj-notes">{imp.notes.map((n) => <div key={n}>{n}</div>)}</div>
            {imp.route === "request" && <Notice>This raises a {T.oneLower} change request in Work. The decision is recorded first; the date only changes when the approved request is run.</Notice>}
          </>
        )}
        {err && <div className="pk-error" role="alert">{err}</div>}
      </div>
    </SidePanel>
  );
}
