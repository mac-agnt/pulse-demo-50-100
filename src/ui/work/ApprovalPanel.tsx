/* The approval panel. Reusable from Home, Records and Work: give it an
   approval id or a request id. It shows the proposed change, supporting
   evidence, stages, decisions by review cycle, actions by authority, and the
   execution of the approved action as a separate step. */

import { useCore, openObject, ms } from "../../core";
import type { Approval, Decision, RequestFormDef, RequestItem } from "../../core";
import { Button, Chip, KV, LABEL, NoAccess, Notice, PersonName, Section, SidePanel, toneOf } from "../kit";
import { formOf, History, isAgent, LinkRow, Muted, Rows, useClock, REQ_TONE, type OpenPanel } from "./shared";
import { ProposedChange } from "./ProposedChange";
import { DecisionActions, ExecutionSection, RequesterActions } from "./ApprovalActions";
import { currentStage } from "../selectors";
import { Comments } from "../collab/Comments";

export interface ApprovalPanelProps { approvalId?: string; requestId?: string; onClose(): void; onOpen?: OpenPanel; focusDecision?: boolean }

export function ApprovalPanel({ approvalId, requestId, onClose, onOpen, focusDecision }: ApprovalPanelProps) {
  const { core, q } = useCore();
  const a0 = approvalId ? q.approval(approvalId) : undefined;
  const reqId = requestId || a0?.requestId;
  // An approver may see the approval through a stage or delegation; the request comes with it.
  const req = reqId ? q.request(reqId) || (a0 ? core.data.requests.find((r) => r.id === reqId) : undefined) : undefined;
  const a = a0 || (req?.approvalId ? q.approval(req.approvalId) : undefined);
  if (!req) return <SidePanel open onClose={onClose} title="Request"><NoAccess what="this request" /></SidePanel>;
  return <Body req={req} a={a} onClose={onClose} onOpen={onOpen} focusDecision={focusDecision} />;
}

const STAGE: Record<string, [string, "ok" | "bad" | "warn" | "neutral" | "accent"]> = {
  waiting: ["Not started yet", "neutral"], pending: ["Deciding now", "accent"], approved: ["Approved", "ok"],
  declined: ["Declined", "bad"], returned: ["Returned", "warn"], skipped: ["Does not apply", "neutral"]
};
const KIND: Record<Decision["kind"], string> = { approve: "Approved", decline: "Declined", return: "Returned for changes", delegate: "Handed on", escalate: "Escalated" };

function Body({ req, a, onClose, onOpen, focusDecision }: { req: RequestItem; a?: Approval; onClose: () => void; onOpen?: OpenPanel; focusDecision?: boolean }) {
  const { core, ctx, q } = useCore();
  const { dt } = useClock();
  const form = formOf(core, req);
  const me = q.viewer.person.id;
  const openTask = (id: string) => (onOpen ? onOpen({ kind: "task", id }) : openObject("task", id));

  return (
    <SidePanel open onClose={onClose} width={700} eyebrow={req.ref + (form ? " · " + form.label : "")} title={req.title}
      chips={<>
        <Chip tone={REQ_TONE[req.status]}>{LABEL.request[req.status]}</Chip>
        {(req.status === "approved" || req.execution.status === "failed" || req.execution.status === "succeeded") &&
          <Chip tone={toneOf.exec(req.execution.status)}>Action: {LABEL.exec[req.execution.status]}</Chip>}
      </>}>

      <KV items={[
        ["Requester", <PersonName key="r" id={req.requesterId} />],
        ["Team", q.teamLabel(req.teamId)],
        ["Raised", dt(req.createdAt)],
        ["Version", String(req.version)]
      ]} />

      {a?.policyException && <div style={{ marginTop: 14 }}><Notice tone="warn">{a.policyException}</Notice></div>}

      <AgentOrigin req={req} />

      <Section label="Decision summary"><Summary req={req} a={a} form={form} /></Section>

      <Section label="Proposed change"><ProposedChange req={req} form={form} /></Section>

      <Section label="Supporting records and evidence">
        {req.linkedRecordIds.length + req.evidenceFileIds.length + req.taskIds.length === 0 ? <Muted>Nothing linked.</Muted> : (
          <Rows>
            {req.linkedRecordIds.map((id) => {
              const r = q.record(id);
              return r ? <LinkRow key={id} onClick={() => openObject("record", id)} right={<span className="wk-small">Record</span>}><span className="wk-ref">{r.ref}</span><span className="wk-wrap">{r.title}</span></LinkRow>
                : <div key={id} className="pk-li pk-muted">A record you cannot see</div>;
            })}
            {req.evidenceFileIds.map((id) => {
              const f = q.file(id);
              return f ? <LinkRow key={id} onClick={() => openObject("file", id)} right={<span className="wk-small">Evidence</span>}><span className="wk-wrap">{f.title}</span></LinkRow>
                : <div key={id} className="pk-li pk-muted">A document you cannot see</div>;
            })}
            {req.taskIds.map((id) => {
              const t = q.task(id);
              return t ? <LinkRow key={id} onClick={() => openTask(id)} right={<Chip tone={toneOf.task(t.status, q.isOverdue(t))}>{LABEL.task[t.status]}</Chip>}><span className="wk-wrap">{t.title}</span></LinkRow>
                : <div key={id} className="pk-li pk-muted">A task you cannot see</div>;
            })}
          </Rows>
        )}
        {form?.evidenceRequired && req.evidenceFileIds.length === 0 && <div className="wk-small" style={{ marginTop: 6 }}>This form needs evidence before it can be submitted.</div>}
      </Section>

      {a ? (
        <>
          <Section label={"Stages · review cycle " + a.cycle}>
            <div className="pk-timeline">
              {a.stages.map((st, i) => {
                const [label, tone] = STAGE[st.status];
                const late = st.status === "pending" && !!st.dueAt && ms(st.dueAt) < ms(ctx.now);
                return (
                  <div key={st.stageId} className="pk-step">
                    <div className="pk-step-rail"><div className="pk-step-dot">{i + 1}</div>{i < a.stages.length - 1 && <div className="pk-step-line" />}</div>
                    <div className="pk-step-body">
                      <div className="wk-row"><span style={{ fontSize: 13, color: "var(--ink)" }}>{st.label}</span><Chip tone={tone}>{label}</Chip>{late && <Chip tone="bad">Overdue</Chip>}</div>
                      <div className="wk-small" style={{ marginTop: 4, lineHeight: 1.6 }}>
                        {st.status === "skipped" ? "Skipped: the condition for this stage does not apply." : <>
                          {st.assigneeId ? q.name(st.assigneeId) : "No eligible person"}
                          {st.startedAt ? ", started " + dt(st.startedAt) : ""}
                          {st.dueAt ? ", due " + dt(st.dueAt) : ""}
                          {st.escalatedFromId ? ", escalated from " + q.name(st.escalatedFromId) : ""}
                        </>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section label="Decision">
            <DecisionActions a={a} req={req} focusComment={focusDecision} />
          </Section>

          <Section label="Decision history">
            <Decisions a={a} />
          </Section>
        </>
      ) : (
        <Section label="Decision"><Muted>{req.status === "draft" ? "Not submitted yet, so no one has been asked to decide." : "No approval is attached to this request."}</Muted></Section>
      )}

      {req.requesterId === me && <Section label="Your request"><RequesterActions req={req} form={form} /></Section>}

      <Section label="Approved action"><ExecutionSection req={req} a={a} form={form} /></Section>

      <Section label="Comments"><Comments objectType="request" objectId={req.id} /></Section>

      <Section label="History"><History ids={[req.id, ...(a ? [a.id] : [])]} /></Section>
    </SidePanel>
  );
}

function Decisions({ a }: { a: Approval }) {
  const { q } = useCore();
  const { dt } = useClock();
  if (!a.decisions.length) return <Muted>No decisions yet.</Muted>;
  const cycles = [...new Set(a.decisions.map((d) => d.cycle))].sort((x, y) => y - x);
  return (
    <div>
      {cycles.map((c) => (
        <div key={c} className="wk-cycle">
          <div className="wk-cycle-h">
            <span>Review cycle {c}</span>
            {c < a.cycle ? <Chip tone="neutral">Earlier review, no longer applies</Chip> : <Chip tone="accent">Current review</Chip>}
          </div>
          <Rows>
            {a.decisions.filter((d) => d.cycle === c).sort((x, y) => y.at.localeCompare(x.at)).map((d) => (
              <div key={d.id} className="pk-li wk-event">
                <span className="wk-event-who"><PersonName id={d.actorId} /></span>
                <span className="pk-grow wk-wrap">
                  <span style={{ color: "var(--ink)" }}>{KIND[d.kind]}</span>
                  {d.onBehalfOfId ? " on behalf of " + q.name(d.onBehalfOfId) : ""}
                  {", " + (a.stages.find((s) => s.stageId === d.stageId)?.label.toLowerCase() || "stage") + " stage, version " + d.requestVersion}
                  {d.comment ? <><br /><span className="pk-muted">{d.comment}</span></> : null}
                </span>
                <span className="pk-mono wk-time">{dt(d.at)}</span>
              </div>
            ))}
          </Rows>
        </div>
      ))}
    </div>
  );
}

/** Requests raised by an agent name the agent and link to the run that raised them. */
function AgentOrigin({ req }: { req: RequestItem }) {
  const { core, q } = useCore();
  const runId = typeof req.fields.agentRunId === "string" ? req.fields.agentRunId : undefined;
  const agentId = isAgent(req.requesterId) ? req.requesterId : isAgent(req.createdBy) ? req.createdBy : undefined;
  const run = runId ? core.data.agentRuns.find((r) => r.id === runId) : undefined;
  const agent = core.config.agents.find((x) => x.id === (agentId || run?.agentId));
  if (!agent && !runId) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <Notice>
        <div>Raised by {agent ? agent.name + ", an agent" : "an agent run"}{agent ? ". " + q.name(agent.responsibleId) + " is the person responsible for it" : ""}. An agent cannot approve its own restricted action: a person decides here, and the run waits for that decision.</div>
        {runId && (
          <div className="wk-row" style={{ marginTop: 8 }}>
            <Button size="sm" onClick={() => openObject("agentRun", runId)}>Open the run{run ? " " + run.ref : ""}</Button>
            {!run && <span className="wk-small">The run is not available to you, or no longer exists.</span>}
          </div>
        )}
      </Notice>
    </div>
  );
}

/** What changed, why it matters, the evidence, who decides and what approval does, in one place. */
function Summary({ req, a, form }: { req: RequestItem; a?: Approval; form?: RequestFormDef }) {
  const { core, q } = useCore();
  const stage = a ? currentStage(a) : undefined;
  const roles = (stage?.eligibleRoles || []).map((r) => core.config.roles.find((x) => x.id === r)?.label || r).join(" or ");
  const why = ["reason", "summary", "description", "justification", "impact", "message"].map((k) => req.fields[k]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const prev = req.version > 1 ? req.versions.find((x) => x.n === req.version - 1) : undefined;
  const changed = prev ? Object.keys({ ...prev.fields, ...req.fields }).filter((k) => (prev.fields[k] ?? null) !== (req.fields[k] ?? null)) : [];
  const label = (k: string) => form?.fields.find((f) => f.key === k)?.label || k;
  const evidence = req.evidenceFileIds.length;
  const decision = !a ? (req.status === "draft" ? "Not submitted" : "No approval attached") : LABEL.approval[a.status];
  return (
    <dl className="wk-ap-why">
      <dt>What changed</dt>
      <dd>{prev ? (changed.length ? "Version " + req.version + " changed " + changed.map(label).join(", ").toLowerCase() + "." : "Resubmitted with no field changes.") : (form?.description || "A new " + (form?.label.toLowerCase() || "request") + ".")}</dd>
      <dt>Why it matters</dt>
      <dd>{why || <span className="pk-muted">The requester gave no reason.</span>}</dd>
      <dt>Evidence</dt>
      <dd>{evidence ? evidence + " item" + (evidence === 1 ? "" : "s") + " attached, listed below" : form?.evidenceRequired ? <span style={{ color: "var(--warn)" }}>Required, none attached</span> : "None attached, not required"}</dd>
      <dt>Responsible reviewer</dt>
      <dd>{stage ? q.name(stage.assigneeId) + " (" + stage.label.toLowerCase() + " stage" + (roles ? ", " + roles : "") + ")" : a ? "No decision is waiting" : "Assigned when submitted"}</dd>
      <dt>Effect of approval</dt>
      <dd>{form?.effect.label || "Nothing runs automatically"}{form?.effect.kind === "notify-external" ? ". Needs an external connection." : ""}</dd>
      <dt>Decision and execution</dt>
      <dd>Decision: {decision}. Action: {LABEL.exec[req.execution.status]}. They are recorded separately: an approved action can still be waiting to run or fail.</dd>
    </dl>
  );
}
