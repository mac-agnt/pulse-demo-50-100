/* One schedule: what it produces, a simulated tick that never duplicates,
   and pausing future runs (which is not the same as pausing a run). */

import { useCore, ops, cadenceLabel, nextOccurrence, navigate, openObject } from "../../core";
import { Button, Chip, KV, LABEL, NoAccess, Notice, PersonName, Section, SidePanel, toneOf } from "../kit";
import { History, InlineError, LinkRow, Muted, Rows, SCHEDULE_KIND, useClock, useRunner, useViewer, type OpenPanel } from "./shared";

export function SchedulePanel({ scheduleId, onClose, onOpen }: { scheduleId: string; onClose: () => void; onOpen?: OpenPanel }) {
  const { core, q } = useCore();
  const { me, can: canDo } = useViewer();
  const { dt, now } = useClock();
  const { err, run } = useRunner();
  const s = q.schedules({ ignoreScope: true }).find((x) => x.id === scheduleId);
  if (!s) return <SidePanel open onClose={onClose} title="Schedule"><NoAccess what="this schedule" /></SidePanel>;

  const allowed = s.ownerId === me || canDo("workflows.operate");
  const reason = allowed ? "" : "Only the owner or a workflow operator can run or pause this.";
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => t.scheduleId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tpl = s.workflowTemplateId ? core.config.workflowTemplates.find((t) => t.id === s.workflowTemplateId) : undefined;
  const runs = s.workflowTemplateId ? q.runs({ ignoreScope: true }).filter((r) => r.templateId === s.workflowTemplateId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) : [];
  const open = (kind: "task" | "run", id: string) => (onOpen ? onOpen({ kind, id }) : openObject(kind, id));

  return (
    <SidePanel open onClose={onClose} width={600} eyebrow={"Schedule · " + SCHEDULE_KIND[s.kind]} title={s.label}
      chips={<Chip tone={s.active ? "ok" : "neutral"}>{s.active ? "Active" : "Paused"}</Chip>}>
      <KV items={[
        ["Cadence", cadenceLabel(s.cadence, s.timezone)],
        ["Next run", s.active ? dt(nextOccurrence(s.cadence, now, s.timezone)) + " " + s.timezone : "Paused"],
        ["Owner", <PersonName key="o" id={s.ownerId} />],
        ["Team", q.teamLabel(s.teamId)],
        ["Last run", s.lastRunAt ? dt(s.lastRunAt) : "Never"],
        ["Instances produced", String(s.producedKeys.length)]
      ]} />

      {s.kind === "recurring-task" && s.task && (
        <Section label="Each instance">
          <dl className="wk-dl">
            <dt>Task</dt><dd>{s.task.title}</dd>
            <dt>Goes to</dt><dd>The {q.teamLabel(s.teamId)} queue, unassigned</dd>
            <dt>Due</dt><dd>{s.task.dueInHours} hours after it is created</dd>
            <dt>Priority</dt><dd>{LABEL.priority[s.task.priority]}</dd>
            {s.task.checklist.length > 0 && <><dt>Checklist</dt><dd>{s.task.checklist.join(", ")}</dd></>}
          </dl>
        </Section>
      )}

      {s.kind === "report" && (
        <Section label="Report">
          <dl className="wk-dl">
            <dt>Dashboard</dt><dd>{core.config.dashboards.find((d) => d.id === s.dashboardId)?.label || "Not set"}</dd>
            <dt>Recipients</dt><dd>{(s.recipients || []).map((id) => q.name(id)).join(", ") || "None"}</dd>
          </dl>
          <div style={{ marginTop: 10 }}><Notice>No scheduler or email connection is configured, so nothing is sent. Running it creates a preview entry in the audit log only.</Notice></div>
        </Section>
      )}

      <Section label="Run now">
        <div className="wk-row">
          <Button variant="primary" disabled={!allowed || !s.active} title={!allowed ? reason : !s.active ? "This schedule is paused. Resume it to produce new instances." : undefined}
            onClick={() => run(ops.runSchedule, s.id)}>Run the due instance now (simulated)</Button>
        </div>
        <div className="wk-small" style={{ marginTop: 6 }}>
          {!allowed ? reason : !s.active ? "Paused: resume it to produce new instances." : "Stands in for the scheduler, which is not connected in this demo. Each due slot is produced once: running it again for the same slot never creates a duplicate."}
        </div>
        <InlineError text={err} />
      </Section>

      <Section label={s.active ? "Pause future runs" : "Resume"}>
        <div className="wk-row">
          <span className="wk-muted pk-grow">
            {s.active
              ? "Pausing only stops future instances. Tasks and runs it already created carry on; to pause a case that has started, open the run under Automation runs and pause it there."
              : "Resuming lets the schedule produce instances again, starting with the slot that is due now."}
          </span>
          <Button disabled={!allowed} title={reason || undefined} onClick={() => run(ops.setScheduleActive, s.id, !s.active)}>{s.active ? "Pause future runs" : "Resume"}</Button>
        </div>
        {s.active && <Button size="sm" variant="ghost" style={{ marginTop: 8 }} onClick={() => { onClose(); navigate({ page: "Work", section: "schedules" }); }}>Go to automation runs</Button>}
      </Section>

      {s.kind === "recurring-task" && (
        <Section label="Instances">
          {tasks.length === 0 ? <Muted>No instances yet.</Muted> : (
            <Rows>
              {tasks.slice(0, 12).map((t) => (
                <LinkRow key={t.id} onClick={() => open("task", t.id)} right={<Chip tone={toneOf.task(t.status, q.isOverdue(t))}>{q.isOverdue(t) ? "Overdue" : LABEL.task[t.status]}</Chip>}>
                  <span className="wk-wrap">{t.title}</span><span className="wk-small">{t.instanceKey?.split(":")[1] || dt(t.createdAt)}</span>
                </LinkRow>
              ))}
            </Rows>
          )}
        </Section>
      )}

      {s.kind === "automation" && (
        <Section label={"Runs of " + (tpl?.label || "this workflow")}>
          {runs.length === 0 ? <Muted>No runs you can see.</Muted> : (
            <Rows>
              {runs.slice(0, 12).map((r) => (
                <LinkRow key={r.id} onClick={() => open("run", r.id)} right={<Chip tone={toneOf.run(r.status)}>{LABEL.run[r.status]}</Chip>}>
                  <span className="wk-ref">{r.ref}</span><span className="wk-wrap">{r.title}</span>
                </LinkRow>
              ))}
            </Rows>
          )}
        </Section>
      )}

      <Section label="History"><History ids={[s.id]} /></Section>
    </SidePanel>
  );
}
