/* One task, everywhere it appears. Status, claiming, assignment, checklist,
   dependencies, links, evidence, notes, deadline policy and history all act
   on the same task through core operations. */

import { useState } from "react";
import { useCore, ops, openObject, store, setTaskEstimate, moduleEnabled } from "../../core";
import type { Task, TaskStatus } from "../../core";
import { Button, Chip, Field, KV, LABEL, NoAccess, Notice, PersonName, Section, Select, SidePanel, TextArea, TextInput, toneOf } from "../kit";
import { History, InlineError, isAgent, LinkRow, Muted, Rows, useClock, useRunner, useViewer, REQ_TONE, type OpenPanel } from "./shared";
import { Comments } from "../collab/Comments";

export function TaskPanel({ taskId, onClose, onOpen }: { taskId: string; onClose: () => void; onOpen?: OpenPanel }) {
  const { q } = useCore();
  const t = q.task(taskId);
  if (!t) return <SidePanel open onClose={onClose} title="Task"><NoAccess what="this task" /></SidePanel>;
  return <TaskBody t={t} onClose={onClose} onOpen={onOpen} />;
}

function TaskBody({ t, onClose, onOpen }: { t: Task; onClose: () => void; onOpen?: OpenPanel }) {
  const { core, q } = useCore();
  const { v, me, can: canDo, oversees, inTeam } = useViewer();
  const { rel, dt } = useClock();
  const status = useRunner();
  const deps = useRunner();
  const links = useRunner();
  const ev = useRunner();
  const [assignTo, setAssignTo] = useState("");
  const [depId, setDepId] = useState("");
  const [recId, setRecId] = useState("");
  const [evTitle, setEvTitle] = useState("");
  const [evNote, setEvNote] = useState("");
  const [est, setEst] = useState(typeof t.estimateHours === "number" ? String(t.estimateHours) : "");
  const [estErr, setEstErr] = useState<string | null>(null);

  const openTask = (id: string) => (onOpen ? onOpen({ kind: "task", id }) : openObject("task", id));
  const overdue = q.isOverdue(t);
  const mine = t.assigneeId === me;
  const manages = canDo("tasks.manage") && oversees(t.teamId);
  const canAct = mine || manages;
  const actReason = canAct ? "" : t.assigneeId ? "Assigned to " + q.name(t.assigneeId) + ". Only they or a manager of this team can change it." : "Claim the task first.";
  const closed = t.status === "done" || t.status === "cancelled";

  const setStatus = (s: TaskStatus) => status.run(ops.setTaskStatus, t.id, s);
  const statusButtons: { label: string; to: TaskStatus; show: boolean; primary?: boolean }[] = [
    { label: t.status === "waiting" ? "Resume" : "Start", to: "in_progress", show: t.status === "open" || t.status === "waiting" },
    { label: "Waiting", to: "waiting", show: t.status === "open" || t.status === "in_progress" },
    { label: "Done", to: "done", show: !closed, primary: true },
    { label: "Reopen", to: "open", show: closed }
  ];

  const blockers = q.blockers(t);
  const blockedBy = t.dependsOn.map((id) => ({ id, task: q.task(id) }));
  const blocking = q.tasks({ ignoreScope: true }).filter((x) => x.dependsOn.includes(t.id));
  const depOptions = q.tasks({ ignoreScope: true }).filter((x) => x.id !== t.id && !t.dependsOn.includes(x.id) && q.isOpenTask(x));
  const recOptions = q.records({ ignoreScope: true }).filter((r) => !t.linkedRecordIds.includes(r.id));
  const left = t.checklist.filter((c) => !c.done).length;

  const members = (t.teamId ? core.data.memberships.filter((m) => m.teamId === t.teamId).map((m) => m.personId) : core.data.people.filter((p) => p.kind === "staff").map((p) => p.id))
    .filter((id) => id !== t.assigneeId && core.data.people.some((p) => p.id === id && p.status === "active"));

  const req = t.requestId ? q.request(t.requestId) : undefined;
  const agent = isAgent(t.createdBy) ? core.config.agents.find((a) => a.id === t.createdBy) : undefined;
  const schedule = t.scheduleId ? core.data.schedules.find((s) => s.id === t.scheduleId) : undefined;
  const sla = core.config.slaPolicies.find((p) => p.id === t.slaPolicyId);
  const roleLabel = (id: string) => core.config.roles.find((r) => r.id === id)?.label || id;
  const project = t.projectId ? core.data.projects.find((p) => p.id === t.projectId) : undefined;
  const projectVisible = !!project && q.canSee({ ownerIds: [project.ownerId], teamId: project.teamId, unitId: project.unitId, visibility: project.visibility });
  const milestone = t.milestoneId ? core.data.milestones.find((m) => m.id === t.milestoneId) : undefined;
  const saveEstimate = (clear: boolean) => {
    const n = clear ? null : Number(est);
    if (!clear && (!est.trim() || !Number.isFinite(n))) { setEstErr("Give the estimate in hours, for example 2.5."); return; }
    const r = store.run(setTaskEstimate, t.id, n);
    setEstErr(r.ok ? null : r.error);
    if (r.ok && clear) setEst("");
  };

  return (
    <SidePanel open onClose={onClose} width={640} eyebrow={"Task" + (t.teamId ? " · " + q.teamLabel(t.teamId) : "")} title={t.title}
      chips={<>
        <Chip tone={toneOf.task(t.status, overdue)}>{overdue ? "Overdue" : LABEL.task[t.status]}</Chip>
        {(t.priority === "high" || t.priority === "urgent") && <Chip tone="warn">{LABEL.priority[t.priority]} priority</Chip>}
        {blockers.length > 0 && !closed && <Chip tone="warn">Blocked</Chip>}
      </>}>

      {agent && <Notice>Created by {agent.name}, an agent. {q.name(agent.responsibleId)} is the person responsible for it. Agent work follows the same rules as anyone else's.</Notice>}
      {!agent && t.createdBy === "system" && <Notice>Created by Pulse{schedule ? " from the schedule “" + schedule.label + "”" : req ? " when " + req.ref + " was approved" : ""}.</Notice>}

      <div style={{ marginTop: agent || t.createdBy === "system" ? 14 : 0 }}>
        <KV items={[
          ["Assignee", t.assigneeId ? <PersonName id={t.assigneeId} /> : "Unassigned"],
          ["Team", q.teamLabel(t.teamId)],
          ["Due", t.dueAt ? dt(t.dueAt) + " (" + rel(t.dueAt) + ")" : "No due date"],
          ["Priority", LABEL.priority[t.priority]],
          ...(project ? [[core.config.projects.label || "Project", projectVisible && moduleEnabled(core.config, "projects")
            ? <button key="p" type="button" className="wk-plink" onClick={() => openObject("project", project.id)}>{project.title}{milestone ? ", " + milestone.label : ""}</button>
            : projectVisible ? project.title : "A project you cannot see"] as [string, React.ReactNode]] : []),
          ["Estimate", typeof t.estimateHours === "number" ? t.estimateHours + " h" : "Unestimated (not counted as zero)"],
          ["Created", dt(t.createdAt) + (agent || t.createdBy === "system" ? "" : ", by " + q.name(t.createdBy))],
          ...(t.completedAt ? [["Completed", dt(t.completedAt)] as [string, string]] : [])
        ]} />
      </div>

      <Section label="Status">
        <div className="wk-row">
          {statusButtons.filter((b) => b.show).map((b) => (
            <Button key={b.to} variant={b.primary ? "primary" : "secondary"} disabled={!canAct} title={actReason || undefined} onClick={() => setStatus(b.to)}>{b.label}</Button>
          ))}
        </div>
        {!canAct && <div className="wk-small" style={{ marginTop: 6 }}>{actReason}</div>}
        {canAct && !closed && (blockers.length > 0 || left > 0) && (
          <div className="wk-small" style={{ marginTop: 6 }}>
            Before it can be done: {[blockers.length ? blockers.length + " blocking task" + (blockers.length === 1 ? "" : "s") + " to finish" : "", left ? left + " checklist item" + (left === 1 ? "" : "s") + " to tick" : ""].filter(Boolean).join(", ")}.
          </div>
        )}
        <InlineError text={status.err} />
      </Section>

      <Section label="Ownership">
        {!t.assigneeId ? (
          <div className="wk-row">
            <span className="pk-muted" style={{ fontSize: 12.5 }}>In the {q.teamLabel(t.teamId)} queue. Anyone in the team can claim it.</span>
            <span className="pk-grow" />
            <Button variant="primary" disabled={!!t.teamId && !inTeam(t.teamId)} title={t.teamId && !inTeam(t.teamId) ? "This queue belongs to a team you are not in." : undefined}
              onClick={() => status.run(ops.claimTask, t.id)}>Claim</Button>
          </div>
        ) : (
          <div className="wk-muted">{mine ? "You have this task" : "Claimed by " + q.name(t.assigneeId)}{t.claimedAt ? " since " + dt(t.claimedAt) : ""}.</div>
        )}
        {manages ? (
          <div className="wk-row" style={{ marginTop: 10 }}>
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <Select ariaLabel="Assign to" value={assignTo} onChange={setAssignTo}
                options={[{ value: "", label: "Assign to a team member" }, ...members.map((id) => ({ value: id, label: q.name(id) }))]} />
            </div>
            <Button disabled={!assignTo} title={assignTo ? undefined : "Pick a person first"} onClick={() => { if (status.run(ops.assignTask, t.id, assignTo).ok) setAssignTo(""); }}>Assign</Button>
            {t.assigneeId && <Button variant="ghost" onClick={() => status.run(ops.assignTask, t.id, null)}>Return to queue</Button>}
          </div>
        ) : t.assigneeId && !mine ? <div className="wk-small" style={{ marginTop: 6 }}>Only a manager of this team can reassign it.</div> : null}
      </Section>

      {t.checklist.length > 0 && (
        <Section label={"Checklist · " + (t.checklist.length - left) + " of " + t.checklist.length}>
          <div className="wk-stack" style={{ gap: 7 }}>
            {t.checklist.map((c) => {
              const may = mine || v.isOrgWide;
              return (
                <label key={c.id} className="wk-check" title={may ? undefined : "Only the assignee can tick this off."}>
                  <input type="checkbox" checked={c.done} disabled={!may} onChange={() => status.run(ops.toggleChecklist, t.id, c.id)} />
                  <span className={c.done ? "wk-done" : undefined}>{c.label}</span>
                </label>
              );
            })}
          </div>
          {!(mine || v.isOrgWide) && <div className="wk-small" style={{ marginTop: 6 }}>Only the assignee can tick items off.</div>}
        </Section>
      )}

      {t.completionCriteria && <Section label="Completion criteria"><div className="wk-muted" style={{ color: "var(--body)" }}>{t.completionCriteria}</div></Section>}

      <Section label="Dependencies">
        <div className="wk-small" style={{ marginBottom: 6 }}>Blocked by</div>
        {blockedBy.length === 0 ? <Muted>Not waiting on any other task.</Muted> : (
          <Rows>
            {blockedBy.map(({ id, task }) => (
              <div key={id} className="pk-li">
                {task ? (
                  <button type="button" className="pk-btn pk-btn--ghost pk-btn--sm" style={{ padding: 0 }} onClick={() => openTask(id)}>{task.title}</button>
                ) : <span className="pk-muted">A task you cannot see</span>}
                <span className="pk-grow" />
                {task && <Chip tone={toneOf.task(task.status, q.isOverdue(task))}>{LABEL.task[task.status]}</Chip>}
                <Button size="sm" variant="ghost" disabled={!canAct} title={actReason || "Remove this dependency"} onClick={() => deps.run(ops.removeDependency, t.id, id)}>Remove</Button>
              </div>
            ))}
          </Rows>
        )}
        <div className="wk-small" style={{ margin: "10px 0 6px" }}>Blocking</div>
        {blocking.length === 0 ? <Muted>No other task waits on this one.</Muted> : (
          <Rows>
            {blocking.map((b) => (
              <LinkRow key={b.id} onClick={() => openTask(b.id)} right={<Chip tone={toneOf.task(b.status, q.isOverdue(b))}>{LABEL.task[b.status]}</Chip>}>
                <span className="wk-wrap">{b.title}</span>
              </LinkRow>
            ))}
          </Rows>
        )}
        <div className="wk-row" style={{ marginTop: 10 }}>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <Select ariaLabel="Task this one waits on" value={depId} onChange={setDepId}
              options={[{ value: "", label: depOptions.length ? "Add a task this one waits on" : "No other open tasks to link" }, ...depOptions.map((x) => ({ value: x.id, label: x.title + " (" + q.teamLabel(x.teamId) + ")" }))]} />
          </div>
          <Button disabled={!depId || !canAct} title={!canAct ? actReason : depId ? undefined : "Pick a task first"} onClick={() => { if (deps.run(ops.addDependency, t.id, depId).ok) setDepId(""); }}>Add dependency</Button>
        </div>
        <InlineError text={deps.err} />
      </Section>

      <Section label="Linked records">
        {t.linkedRecordIds.length === 0 ? <Muted>No records linked.</Muted> : (
          <Rows>
            {t.linkedRecordIds.map((id) => {
              const r = q.record(id);
              return r
                ? <LinkRow key={id} onClick={() => openObject("record", id)}><span className="wk-ref">{r.ref}</span><span className="wk-wrap">{r.title}</span></LinkRow>
                : <div key={id} className="pk-li pk-muted">A record you cannot see</div>;
            })}
          </Rows>
        )}
        <div className="wk-row" style={{ marginTop: 10 }}>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <Select ariaLabel="Record to link" value={recId} onChange={setRecId}
              options={[{ value: "", label: recOptions.length ? "Link a record" : "No other records you can see" }, ...recOptions.map((r) => ({ value: r.id, label: r.ref + " " + r.title }))]} />
          </div>
          <Button disabled={!recId} title={recId ? undefined : "Pick a record first"} onClick={() => { if (links.run(ops.linkTaskRecord, t.id, recId).ok) setRecId(""); }}>Link</Button>
        </div>
        <InlineError text={links.err} />
      </Section>

      <Section label="Evidence">
        {t.evidenceFileIds.length === 0 ? <Muted>No evidence attached.</Muted> : (
          <Rows>
            {t.evidenceFileIds.map((id) => {
              const f = q.file(id);
              return f
                ? <LinkRow key={id} onClick={() => openObject("file", id)} right={<span className="wk-small">{f.kind}</span>}><span className="wk-wrap">{f.title}</span></LinkRow>
                : <div key={id} className="pk-li pk-muted">A document you cannot see</div>;
            })}
          </Rows>
        )}
        <div className="pk-grid2" style={{ marginTop: 10 }}>
          <Field label="Evidence title" htmlFor="ev-title"><TextInput id="ev-title" value={evTitle} onChange={setEvTitle} placeholder="For example: Source extract" /></Field>
          <Field label="Note" htmlFor="ev-note"><TextInput id="ev-note" value={evNote} onChange={setEvNote} placeholder="What it shows" /></Field>
        </div>
        <div className="wk-row" style={{ marginTop: 8 }}>
          <span className="wk-small pk-grow">No file is uploaded in this demo. This records a named evidence note linked to the task.</span>
          <Button disabled={!evTitle.trim()} title={evTitle.trim() ? undefined : "Name the evidence first"}
            onClick={() => { if (ev.run(ops.attachEvidence, { taskId: t.id }, evTitle, evNote).ok) { setEvTitle(""); setEvNote(""); } }}>Attach evidence note</Button>
        </div>
        <InlineError text={ev.err} />
      </Section>

      {t.requestId && (
        <Section label="Request">
          {req ? (
            <Rows>
              <LinkRow onClick={() => (onOpen ? onOpen({ kind: "request", id: req.id }) : openObject("request", req.id))}
                right={<Chip tone={REQ_TONE[req.status]}>{LABEL.request[req.status]}</Chip>}>
                <span className="wk-ref">{req.ref}</span><span className="wk-wrap">{req.title}</span>
              </LinkRow>
            </Rows>
          ) : <Muted>Linked to a request you cannot see.</Muted>}
        </Section>
      )}

      <Section label="Effort estimate">
        <div className="wk-row">
          <div style={{ width: 140 }}><TextInput ariaLabel="Estimate in hours" type="number" value={est} onChange={(x) => { setEst(x); setEstErr(null); }} placeholder="Hours" /></div>
          <Button disabled={!canAct} title={canAct ? "Save the estimate" : actReason} onClick={() => saveEstimate(false)}>Save estimate</Button>
          {typeof t.estimateHours === "number" && <Button variant="ghost" disabled={!canAct} title={canAct ? undefined : actReason} onClick={() => saveEstimate(true)}>Clear</Button>}
        </div>
        <div className="wk-small" style={{ marginTop: 6 }}>Weekly allocation in People adds up estimates. A task without one is shown as unestimated, never as zero hours.</div>
        <InlineError text={estErr} />
      </Section>

      <Section label="Comments">
        <Comments objectType="task" objectId={t.id} />
      </Section>

      {t.notes.length > 0 && <Section label="Earlier notes">
        {t.notes.length === 0 ? <Muted>No notes yet.</Muted> : (
          <Rows>
            {t.notes.map((n) => (
              <div key={n.id} className="pk-li wk-event">
                <span className="wk-event-who"><PersonName id={n.by} /></span>
                <span className="pk-grow wk-wrap">{n.text}</span>
                <span className="pk-mono wk-time">{dt(n.at)}</span>
              </div>
            ))}
          </Rows>
        )}
      </Section>}

      <Section label="Deadline policy">
        {sla ? (
          <dl className="wk-dl">
            <dt>Policy</dt><dd>{sla.label}, {sla.targetHours} {sla.calendar === "business" ? "working" : "calendar"} hours</dd>
            <dt>Calendar</dt><dd>{sla.calendar === "business" ? "Business hours: " + sla.businessHours : "Calendar hours, every day"}</dd>
            <dt>While waiting</dt><dd>{sla.pauseWhenWaiting ? (t.status === "waiting" ? "Paused since " + dt(t.waitingSince) + ", because the task is waiting." : "The clock pauses while the task is waiting.") : "The clock keeps running while waiting."}</dd>
            <dt>Escalates to</dt><dd>{roleLabel(sla.escalateToRole)}</dd>
          </dl>
        ) : <Muted>No deadline policy applies to this task.</Muted>}
      </Section>

      <Section label="History"><History ids={[t.id]} /></Section>
    </SidePanel>
  );
}
