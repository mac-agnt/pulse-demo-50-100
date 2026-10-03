/* One workflow run: a readable step timeline, the failure and its business
   impact, recovery options, and the ledger of effects already applied, which
   a retry never repeats. Also the read-only template panel. */

import { useState } from "react";
import { useCore, ops, openObject, navigate } from "../../core";
import type { WorkflowRun } from "../../core";
import { Button, Chip, Field, KV, LABEL, NoAccess, PersonName, Section, Select, SidePanel, TextInput, toneOf } from "../kit";
import { History, InlineError, LinkRow, Muted, Rows, RUN_STEP_LABEL, RUN_STEP_TONE, useClock, useRunner, useViewer, REQ_TONE, type OpenPanel } from "./shared";

const CAUSE: Record<string, string> = { "missing-owner": "No owner for a step", "no-connection": "External connection missing", validation: "Validation failed" };

export function RunPanel({ runId, onClose, onOpen }: { runId: string; onClose: () => void; onOpen?: OpenPanel }) {
  const { q } = useCore();
  const r = q.run(runId);
  if (!r) return <SidePanel open onClose={onClose} title="Workflow run"><NoAccess what="this run" /></SidePanel>;
  return <RunBody r={r} onClose={onClose} onOpen={onOpen} />;
}

function RunBody({ r, onClose, onOpen }: { r: WorkflowRun; onClose: () => void; onOpen?: OpenPanel }) {
  const { core, q } = useCore();
  const { v, me, can: canDo, oversees } = useViewer();
  const { dt } = useClock();
  const rec = useRunner();
  const pause = useRunner();
  const [owner, setOwner] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const tpl = core.config.workflowTemplates.find((t) => t.id === r.templateId);
  const operate = r.ownerId === me || r.assigneeId === me || (canDo("workflows.operate") && (v.isOrgWide || oversees(r.teamId)));
  const opReason = operate ? "" : "Only the run owner, its assignee or a workflow operator for this team can do that.";
  const mayAssign = canDo("workflows.operate");
  const staff = core.data.people.filter((p) => p.kind === "staff" && p.status === "active" && p.id !== r.assigneeId);
  const req = r.requestId ? q.request(r.requestId) : undefined;
  const f = r.failure;
  const canPause = !(r.status === "completed" || r.status === "failed" || r.status === "paused");

  return (
    <SidePanel open onClose={onClose} width={660} eyebrow={r.ref + " · " + (tpl?.label || "Workflow")} title={r.title}
      chips={<Chip tone={toneOf.run(r.status)}>{LABEL.run[r.status]}</Chip>}>
      <KV items={[
        ["Owner", <PersonName key="o" id={r.ownerId} />],
        ["Assignee", r.assigneeId ? <PersonName key="a" id={r.assigneeId} /> : "No owner"],
        ["Team", q.teamLabel(r.teamId)],
        ["Started", dt(r.startedAt)],
        ["Updated", dt(r.updatedAt)]
      ]} />

      {f && (
        <div className="wk-box wk-box--bad" style={{ marginTop: 14 }} role="alert">
          <div className="wk-row" style={{ marginBottom: 6 }}><Chip tone="bad">Failed</Chip><span style={{ color: "var(--ink)", fontSize: 13 }}>{f.message}</span></div>
          <dl className="wk-dl">
            <dt>Business impact</dt><dd>{f.impact}</dd>
            <dt>Failed step</dt><dd>{r.steps.find((s) => s.stepId === f.stepId)?.label || f.stepId}, {dt(f.at)}</dd>
            <dt>Cause</dt><dd>{CAUSE[f.cause] || f.cause}</dd>
            <dt>Owner</dt><dd>{r.assigneeId ? q.name(r.assigneeId) : "Nobody yet"}</dd>
            <dt>Affected records</dt><dd>{r.affectedRecordIds.length ? r.affectedRecordIds.map((id) => q.record(id)?.ref || "a record you cannot see").join(", ") : "None"}</dd>
          </dl>
        </div>
      )}

      {(r.status === "failed" || r.status === "queued") && (
        <Section label={r.status === "queued" ? "Start" : "Recover"}>
          <div className="wk-stack">
            {r.status === "failed" && (
              <div className="wk-box">
                <div className="pk-eyebrow" style={{ marginBottom: 8 }}>Assign owner</div>
                <div className="wk-row">
                  <div style={{ minWidth: 200, flex: "1 1 200px" }}>
                    <Select ariaLabel="Assign the run to" value={owner} onChange={setOwner}
                      options={[{ value: "", label: "Choose a member of staff" }, ...staff.map((p) => ({ value: p.id, label: p.name + ", " + p.title }))]} />
                  </div>
                  <Button disabled={!mayAssign || !owner} title={!mayAssign ? "Assigning a run needs a workflow operator." : owner ? undefined : "Choose a person first"}
                    onClick={() => { if (rec.run(ops.assignRun, r.id, owner).ok) setOwner(""); }}>Assign</Button>
                </div>
                {!mayAssign && <div className="wk-small" style={{ marginTop: 6 }}>Assigning a run needs a workflow operator.</div>}
              </div>
            )}
            <div className="wk-row">
              <Button variant="primary" disabled={!operate} title={opReason || undefined} onClick={() => rec.run(ops.retryRun, r.id)}>
                {r.status === "queued" ? "Start run" : "Retry from failed step"}
              </Button>
              <span className="wk-small pk-grow">{opReason || (r.status === "queued" ? "Runs the steps in order. Nothing has been applied yet." : "Completed steps are not run again.")}</span>
            </div>
            {f?.cause === "no-connection" && (
              <div className="wk-box">
                <div className="pk-eyebrow" style={{ marginBottom: 8 }}>Skip this step</div>
                <Field label="Reason" htmlFor="run-skip" help="The external system is not updated. Your reason is kept in the run and the audit log.">
                  <TextInput id="run-skip" value={skipReason} onChange={setSkipReason} />
                </Field>
                <div className="wk-row" style={{ marginTop: 8 }}>
                  <Button variant="ghost" onClick={() => navigate({ page: "Settings", section: "connections" })}>Open connections</Button>
                  <span className="pk-grow" />
                  <Button disabled={!operate || !skipReason.trim()} title={!operate ? opReason : skipReason.trim() ? undefined : "Give a reason first"}
                    onClick={() => { if (rec.run(ops.skipRunStep, r.id, skipReason).ok) setSkipReason(""); }}>Skip and continue</Button>
                </div>
              </div>
            )}
            <InlineError text={rec.err} />
          </div>
        </Section>
      )}

      <Section label="Steps">
        <div className="pk-timeline">
          {r.steps.map((s, i) => {
            const def = tpl?.steps.find((d) => d.id === s.stepId);
            return (
              <div key={s.stepId} className="pk-step">
                <div className="pk-step-rail"><div className="pk-step-dot">{i + 1}</div>{i < r.steps.length - 1 && <div className="pk-step-line" />}</div>
                <div className="pk-step-body">
                  <div className="wk-row"><span style={{ fontSize: 13, color: "var(--ink)" }}>{s.label}</span><Chip tone={RUN_STEP_TONE[s.status]}>{RUN_STEP_LABEL[s.status]}</Chip>
                    {def?.effect === "external" && <span className="wk-small">external</span>}</div>
                  {(s.at || s.note) && <div className="wk-small" style={{ marginTop: 4 }}>{[s.at ? dt(s.at) : "", s.note || ""].filter(Boolean).join(". ")}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section label="Effects already applied">
        {r.appliedEffects.length === 0 ? <Muted>Nothing applied yet.</Muted> : (
          <Rows>
            {r.appliedEffects.map((e) => (
              <div key={e.key} className="pk-li wk-event"><span className="pk-grow wk-wrap">{e.description}</span><span className="pk-mono wk-time">{dt(e.at)}</span></div>
            ))}
          </Rows>
        )}
        <div className="wk-small" style={{ marginTop: 6 }}>Retries never repeat these: each effect is recorded once by its key and skipped if it is already here.</div>
      </Section>

      {r.affectedRecordIds.length > 0 && (
        <Section label="Affected records">
          <Rows>
            {r.affectedRecordIds.map((id) => {
              const rc = q.record(id);
              return rc ? <LinkRow key={id} onClick={() => openObject("record", id)}><span className="wk-ref">{rc.ref}</span><span className="wk-wrap">{rc.title}</span></LinkRow>
                : <div key={id} className="pk-li pk-muted">A record you cannot see</div>;
            })}
          </Rows>
        </Section>
      )}

      {r.requestId && (
        <Section label="Request">
          {req ? (
            <Rows>
              <LinkRow onClick={() => (onOpen ? onOpen({ kind: "request", id: req.id }) : openObject("request", req.id))} right={<Chip tone={REQ_TONE[req.status]}>{LABEL.request[req.status]}</Chip>}>
                <span className="wk-ref">{req.ref}</span><span className="wk-wrap">{req.title}</span>
              </LinkRow>
            </Rows>
          ) : <Muted>Linked to a request you cannot see.</Muted>}
        </Section>
      )}

      {(canPause || r.status === "paused") && (
        <Section label={r.status === "paused" ? "Paused" : "Pause this case"}>
          {r.status === "paused" ? (
            <div className="wk-row">
              <span className="wk-muted pk-grow">This case is paused. Resuming picks up from the current step.</span>
              <Button disabled={!operate} title={opReason || undefined} onClick={() => pause.run(ops.pauseRun, r.id, false, "")}>Resume</Button>
            </div>
          ) : (
            <>
              <Field label="Reason" htmlFor="run-pause"><TextInput id="run-pause" value={pauseReason} onChange={setPauseReason} placeholder="Why it should wait" /></Field>
              <div className="wk-row" style={{ marginTop: 8 }}>
                <span className="wk-small pk-grow">Pauses this case only. The schedule or trigger that started it keeps running; pause the schedule in Work &gt; Schedules to stop future runs.</span>
                <Button disabled={!operate || !pauseReason.trim()} title={!operate ? opReason : pauseReason.trim() ? undefined : "Give a reason first"}
                  onClick={() => { if (pause.run(ops.pauseRun, r.id, true, pauseReason).ok) setPauseReason(""); }}>Pause this case</Button>
              </div>
            </>
          )}
          {!operate && <div className="wk-small" style={{ marginTop: 6 }}>{opReason}</div>}
          <InlineError text={pause.err} />
        </Section>
      )}

      <Section label="History"><History ids={[r.id]} /></Section>
    </SidePanel>
  );
}

export function TemplatePanel({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const { core, q } = useCore();
  const t = core.config.workflowTemplates.find((x) => x.id === templateId);
  if (!t) return <SidePanel open onClose={onClose} title="Workflow template"><Muted>This template no longer exists.</Muted></SidePanel>;
  const runs = q.runs({ ignoreScope: true }).filter((r) => r.templateId === t.id);
  const KIND: Record<string, string> = { task: "Task", approval: "Approval", action: "Action", notify: "Notification", check: "Check" };
  return (
    <SidePanel open onClose={onClose} width={560} eyebrow="Workflow template" title={t.label} chips={<Chip tone={t.enabled ? "ok" : "neutral"}>{t.enabled ? "Enabled" : "Off"}</Chip>}
      footer={<><span className="wk-small pk-grow">Templates are configured in Settings, not here.</span><Button onClick={() => { onClose(); navigate({ page: "Settings", section: "workflows" }); }}>Edit in Settings</Button></>}>
      <div className="wk-muted" style={{ color: "var(--body)" }}>{t.description}</div>
      <div style={{ marginTop: 14 }}>
        <KV items={[["Owner", <PersonName key="o" id={t.ownerId} />], ["Trigger", t.trigger.detail], ["Runs you can see", String(runs.length)]]} />
      </div>
      <Section label="Steps">
        <Rows>
          {t.steps.map((s, i) => (
            <div key={s.id} className="pk-li">
              <span className="pk-mono wk-small">{i + 1}</span>
              <span className="pk-grow wk-wrap">{s.label}</span>
              <span className="wk-small">{KIND[s.kind] || s.kind}</span>
              {s.effect && <Chip tone={s.effect === "external" ? "warn" : "neutral"}>{s.effect === "external" ? "External effect" : "Changes Pulse"}</Chip>}
            </div>
          ))}
        </Rows>
        {t.steps.some((s) => s.effect === "external") && <div className="wk-small" style={{ marginTop: 6 }}>External steps need a connection. Without one they fail and nothing is sent.</div>}
      </Section>
      {runs.length > 0 && (
        <Section label="Recent runs">
          <Rows>
            {runs.slice(0, 6).map((r) => (
              <LinkRow key={r.id} onClick={() => { onClose(); openObject("run", r.id); }} right={<Chip tone={toneOf.run(r.status)}>{LABEL.run[r.status]}</Chip>}>
                <span className="wk-ref">{r.ref}</span><span className="wk-wrap">{r.title}</span>
              </LinkRow>
            ))}
          </Rows>
        </Section>
      )}
    </SidePanel>
  );
}
