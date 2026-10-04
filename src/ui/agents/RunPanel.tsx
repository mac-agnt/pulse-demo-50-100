/* One run in detail: a readable timeline (queued, planning, delegated,
   spawned, tool calls with inputs and results, proposed action, approval,
   execution, waiting, failure, cancellation), the temporary workers, child
   runs, outputs linked to the real objects, and the actions a person can take.
   Approval happens in Work on the canonical request; this panel links to it. */

import AgentFace from "../../components/AgentFace";
import {
  RUN_STATE_LABEL, can, describeRef, failureOf, fmtDateTime, isRunActive, nextActionOf, ops, openObject, requestStop, resumeRun, retryRun, runById,
  runDuration, saveWorkerAsAgent, scopeText, store, useCore, type AgentRun, type AgentRunStep, type AgentSourceKind, type Id
} from "../../core";
import { Callout } from "../frame";
import { Button, Chip, Empty, KV, Section, SidePanel } from "../kit";
import { RunPill, type AgentNav } from "./shared";

const KIND_LABEL: Record<AgentRunStep["kind"], string> = {
  queued: "Queued", planning: "Planning", delegated: "Delegated", spawned: "Temporary worker", tool_call: "Tool call", proposed_action: "Proposed action",
  waiting_input: "Waiting for input", waiting_approval: "Waiting for approval", approved: "Approved", executed: "Executed", output: "Result", completed: "Completed",
  failed: "Failed", retried: "Retried", cancelled: "Cancelled", stop_requested: "Stop requested", paused: "Paused"
};
const KIND_TONE: Partial<Record<AgentRunStep["kind"], string>> = {
  failed: "bad", waiting_approval: "warn", waiting_input: "warn", stop_requested: "warn", proposed_action: "warn", approved: "ok", executed: "ok", completed: "ok", cancelled: "neutral"
};

export function RunPanel({ runId, onClose, nav }: { runId: Id; onClose: () => void; nav: AgentNav }) {
  const { core, ctx, q } = useCore();
  const run = runById(core, runId);
  if (!run) return null;
  const tz = core.config.timezone;
  const agent = core.config.agents.find((a) => a.id === run.agentId);
  const parent = runById(core, run.parentRunId);
  const plan = run.plan || [];
  const actionItem = plan.find((i) => i.kind === "action" && (i.status === "waiting" || i.status === "approved" || i.status === "failed"));
  const req = core.data.requests.find((r) => r.id === (actionItem?.requestId || run.approvalRequestId));
  const err = run.state === "failed" ? failureOf(run) : undefined;
  const failedItem = plan.find((i) => i.status === "failed");
  const manage = can(q.viewer, "agents.manage");
  const operate = can(q.viewer, "agents.run") || manage;
  const resolvedWait = isRunActive(run) && plan.some((i) => (i.kind === "action" && i.status === "waiting" && req && (req.status === "withdrawn" || req.status === "declined"))
    || (i.kind === "delegate" && i.status === "waiting" && ["completed", "failed", "cancelled"].includes(runById(core, i.childRunId)?.state || "")));
  const actorName = (s: AgentRunStep) => s.actor.kind === "worker" ? run.workers.find((w) => w.id === s.actor.id)?.label || "Temporary worker" : q.name(s.actor.id);
  const open = (r: { kind: string; id: Id }) => {
    if (r.kind === "agentRun") return nav.openRun(r.id);
    onClose();
    openObject(r.kind as AgentSourceKind, r.id);
  };

  return (
    <SidePanel open onClose={onClose} width={720} eyebrow={run.ref + (run.test ? " · Test run" : "") + " · " + (agent?.name || "Agent")} title={run.goal}
      chips={<><RunPill run={run} /><Chip plain>Simulated</Chip></>}
      footer={
        <>
          {agent && <Button variant="ghost" onClick={() => nav.openAgent(agent.id)}>Open {agent.name}</Button>}
          <span className="pk-grow" />
          {isRunActive(run) && !run.stop && !run.test && <Button disabled={!operate} onClick={() => store.run(requestStop, run.id)}>Request stop</Button>}
          {run.state === "failed" && !run.test && <Button disabled={!operate || err?.retryable === false} title={err?.retryable === false ? "This step cannot be retried as it is." : undefined}
            onClick={() => store.run(retryRun, run.id)}>Retry failed step</Button>}
          {run.state === "failed" && !run.test && !run.stop && <Button variant="ghost" disabled={!operate} onClick={() => store.run(requestStop, run.id)}>Cancel run</Button>}
        </>
      }>
      {run.state === "waiting_approval" && req && (
        <Callout tone="warn" eyebrow="Waiting for approval" title={"Waiting for " + q.name(run.waitingOwnerId) + " to decide " + req.ref}
          actions={<Button variant="primary" onClick={() => open({ kind: "request", id: req.id })}>Open {req.ref} in Work</Button>}>
          {String(req.fields.action || req.title)} The decision is recorded in Work. Approving does not run it; running it is a separate step.
        </Callout>
      )}
      {run.state === "waiting_input" && req && req.status === "approved" && (
        <Callout tone="warn" eyebrow="Approved, not yet run" title={req.ref + " is approved"}
          actions={<>
            <Button variant="primary" onClick={() => store.run(ops.executeRequest, req.id)}>Run the approved action</Button>
            <Button onClick={() => open({ kind: "request", id: req.id })}>Open {req.ref}</Button>
          </>}>
          Running it applies the change once. Running it again never repeats it.
        </Callout>
      )}
      {run.state === "waiting_input" && req && req.status === "changes_requested" && (
        <Callout tone="warn" eyebrow="Returned" title={req.ref + " was returned to " + q.name(req.requesterId)} actions={<Button onClick={() => open({ kind: "request", id: req.id })}>Open {req.ref}</Button>}>
          The run keeps waiting until it is resubmitted and decided.
        </Callout>
      )}
      {run.state === "stop_requested" && (
        <Callout tone="warn" eyebrow="Stop requested" title="Stopping at the next safe checkpoint">
          {nextActionOf(core, run)}. Nothing new starts meanwhile. It shows as cancelled only once the engine confirms.
        </Callout>
      )}
      {run.state === "failed" && err && (
        <Callout tone="bad" eyebrow="Failed" title={failedItem?.label || "A step failed"}>
          {err.business} {err.retryable ? "A retry runs only this step; steps already done and effects already applied are not repeated." : ""}
          <span className="ag-muted"> Owner: {q.name(run.waitingOwnerId || agent?.responsibleId)}.</span>
        </Callout>
      )}
      {resolvedWait && (
        <Callout tone="accent" eyebrow="Ready to continue" title="What it was waiting for has changed" actions={<Button onClick={() => store.run(resumeRun, run.id)}>Continue</Button>}>
          The engine picks this up and moves to the next safe point.
        </Callout>
      )}

      <Section label="Summary">
        <KV items={[
          ["Agent", agent ? <button type="button" className="ag-link" onClick={() => nav.openAgent(agent.id)}>{agent.name}</button> : "Removed"],
          ["Definition used", "Version " + run.agentVersion + (agent && (agent.version || 1) !== run.agentVersion ? " (now version " + (agent.version || 1) + "; this run keeps the version it started with)" : "")],
          ["Parent run", parent ? <button type="button" className="ag-link" onClick={() => nav.openRun(parent.id)}>{parent.ref} ({q.name(parent.agentId)})</button> : "None"],
          ["Started by", run.initiator.kind === "person" || run.initiator.kind === "agent" ? q.name(run.initiator.id) : run.initiator.kind === "event" ? "An event (simulated)" : "A schedule (simulated)"],
          ["Scope", scopeText(core, run.scopeTeamIds)],
          ["Started", fmtDateTime(run.startedAt, tz) + ", " + runDuration(run, ctx.now) + (run.endedAt ? "" : " so far")],
          ["State", RUN_STATE_LABEL[run.state] + (run.waitingOwnerId && isRunActive(run) ? ", with " + q.name(run.waitingOwnerId) : "")],
          ["Next action", nextActionOf(core, run)],
          ["Tools held", (run.snapshot?.tools || []).map((t) => core.config.agentTools.find((x) => x.id === t)?.label || t).join(", ") || "None"],
          ["Usage and cost", run.usage?.reported ? String(run.usage.tokens ?? "") : "Unknown. The sample engine reports no usage."],
          ["Idempotency key", <span className="pk-mono" style={{ fontSize: 11.5 }}>{run.idempotencyKey}</span>]
        ]} />
      </Section>

      {run.outputs.length > 0 && (
        <Section label="Outputs">
          <div className="ag-outputs">
            {run.outputs.map((o, i) => (
              <div key={i} className="ag-output">
                <div className="ag-output-h"><b>{o.label}</b>{o.kind && o.id && <button type="button" className="ag-link" onClick={() => open({ kind: o.kind!, id: o.id! })}>Open {o.kind === "agentRun" ? runById(core, o.id)?.ref || "run" : describeRef(core, { kind: o.kind, id: o.id })}</button>}</div>
                {o.text && <p>{o.text}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {run.childRunIds.length > 0 && (
        <Section label="Delegated runs">
          <div className="pk-list">
            {run.childRunIds.map((id) => runById(core, id)).filter((r): r is AgentRun => !!r).map((c) => (
              <button key={c.id} type="button" className="pk-li pk-li--btn" onClick={() => nav.openRun(c.id)}>
                <span className="pk-mono">{c.ref}</span><span className="pk-grow ag-ellipsis">{q.name(c.agentId)}</span><RunPill run={c} />
              </button>
            ))}
          </div>
        </Section>
      )}

      {run.workers.length > 0 && (
        <Section label="Temporary workers">
          <div className="ag-workers">
            {run.workers.map((w) => (
              <div key={w.id} className="ag-worker">
                <div className="ag-output-h"><b>{w.label}</b><Chip tone={w.state === "completed" ? "ok" : w.state === "failed" ? "bad" : w.state === "active" ? "accent" : "neutral"}>{w.state === "active" ? "Active" : w.state === "completed" ? "Ended with its task" : w.state === "failed" ? "Failed" : "Cancelled"}</Chip></div>
                <div className="ag-muted">Template {core.config.agentTemplates.find((t) => t.id === w.templateId)?.label || w.templateId} · depth {w.depth} · scope {scopeText(core, w.scopeTeamIds)} · tools {w.tools.map((t) => core.config.agentTools.find((x) => x.id === t)?.label || t).join(", ") || "none"}</div>
                {w.output && <p>{w.output}</p>}
                <div className="ag-muted">Not a saved agent. It exists only inside {run.ref} and stays in its history.</div>
                {manage && <div style={{ marginTop: 8 }}><Button size="sm" onClick={() => { const r = store.run(saveWorkerAsAgent, run.id, w.id, ""); if (r.ok && r.id) nav.openAgent(r.id); }}>Save as a draft agent for review</Button></div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section label="Timeline">
        {run.steps.length === 0 ? <Empty title="No steps yet" /> : (
          <ol className="ag-timeline">
            {run.steps.map((st) => (
              <li key={st.id} className="ag-step" data-tone={KIND_TONE[st.kind] || "neutral"} data-status={st.status}>
                <span className="ag-step-dot" aria-hidden="true" />
                <div className="ag-step-b">
                  <div className="ag-step-h">
                    <b>{KIND_LABEL[st.kind]}</b>
                    <span className="ag-step-who">
                      {st.actor.kind === "agent" && (() => { const ag = core.config.agents.find((x) => x.id === st.actor.id); return ag ? <AgentFace shape={ag.shape} tint={ag.tint} state="complete" size={16} /> : null; })()}
                      {st.actor.kind === "worker" && <span className="ag-worker-dot" aria-hidden="true" />}
                      {actorName(st)}
                    </span>
                    <span className="ag-muted">{fmtDateTime(st.at, tz)}{st.attempt && st.attempt > 1 ? " · attempt " + st.attempt : ""}</span>
                  </div>
                  <div className="ag-step-s">{st.summary}</div>
                  {(st.input || st.output) && (
                    <details className="ag-io"><summary>{st.toolId ? (core.config.agentTools.find((t) => t.id === st.toolId)?.label || st.toolId) + ": input and result" : "Input and result"}</summary>
                      {st.input && <div><span className="ag-muted">Input</span> {st.input}</div>}
                      {st.output && <div><span className="ag-muted">Result</span> {st.output}</div>}
                    </details>
                  )}
                  {st.error && (
                    <details className="ag-io"><summary>Technical detail</summary><div className="pk-mono" style={{ fontSize: 11.5 }}>{st.error.technical}</div><div className="ag-muted">{st.error.retryable ? "Retryable" : "Not retryable as it is"}</div></details>
                  )}
                  {st.effectKey && <div className="ag-muted">Effect key {st.effectKey}: applied at most once.</div>}
                  {(st.sourceRefs.length > 0 || st.childRunId) && (
                    <div className="ag-refs">
                      {st.childRunId && <button type="button" className="ag-cite" onClick={() => nav.openRun(st.childRunId!)}><span>{runById(core, st.childRunId)?.ref || "Child run"}</span></button>}
                      {st.sourceRefs.map((r) => (
                        <button key={r.kind + r.id} type="button" className="ag-cite" onClick={() => open(r)} title={"Open " + r.kind}>
                          <span>{describeRef(core, r)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {run.appliedEffects.length > 0 && (
        <Section label="Applied effects">
          <ul className="ag-ul">{run.appliedEffects.map((e) => <li key={e.key}>{e.description} <span className="ag-muted">({fmtDateTime(e.at, tz)})</span></li>)}</ul>
        </Section>
      )}
    </SidePanel>
  );
}
