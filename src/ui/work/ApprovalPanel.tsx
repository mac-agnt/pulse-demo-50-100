/* The approval panel. Reusable from Home, Records and Work: give it an
   approval id or a request id. It shows the proposed change, supporting
   evidence, stages, decisions by review cycle, actions by authority, and the
   execution of the approved action as a separate step. */

import { useCore, openObject, ms } from "../../core";
import type { Approval, Decision, RequestItem } from "../../core";
import { Chip, KV, LABEL, NoAccess, Notice, PersonName, Section, SidePanel, toneOf } from "../kit";
import { formOf, History, LinkRow, Muted, Rows, useClock, REQ_TONE, type OpenPanel } from "./shared";
import { ProposedChange } from "./ProposedChange";
import { DecisionActions, ExecutionSection, RequesterActions } from "./ApprovalActions";

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
