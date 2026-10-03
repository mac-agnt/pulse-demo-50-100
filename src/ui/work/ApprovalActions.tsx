/* Actions on an approval and its request, shown by authority:
   deciders decide, hand on and escalate; requesters edit, resubmit and
   withdraw; execution is its own step after the decision. */

import { useEffect, useState } from "react";
import { useCore, ops, navigate, eligibleApprovers } from "../../core";
import type { Approval, RequestFormDef, RequestItem } from "../../core";
import { Button, Chip, Field, KV, LABEL, Notice, Select, TextArea, TextInput, toneOf } from "../kit";
import { InlineError, useClock, useRunner, useViewer } from "./shared";
import { currentStage } from "../selectors";
import { fieldErrors, fromValues, RequestFields, toValues, type Draft } from "./RequestFields";

/* ── Decision ─────────────────────────────────────────────────────────── */

export function DecisionActions({ a, req, focusComment }: { a: Approval; req: RequestItem; focusComment?: boolean }) {
  const { core, ctx, q } = useCore();
  const { v, me, can: canDo } = useViewer();
  const { dt } = useClock();
  const { err, run } = useRunner();
  const hand = useRunner();
  const esc = useRunner();
  const [comment, setComment] = useState("");
  const [toId, setToId] = useState("");
  const [handReason, setHandReason] = useState("");
  // Opened from a card's Decline: bring the comment box into view and focus it (after the panel's own autofocus).
  useEffect(() => {
    if (!focusComment) return;
    const t = setTimeout(() => {
      const el = document.getElementById("ap-comment");
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
    }, 90);
    return () => clearTimeout(t);
  }, [focusComment]);
  const stage = currentStage(a);
  if (a.status !== "pending" || !stage) return <div className="wk-muted">No decision is waiting. This approval is {LABEL.approval[a.status].toLowerCase()}.</div>;

  const auth = ops.decisionAuthority(core, ctx, a);
  const rule = core.config.approvalRules.find((r) => r.id === a.ruleId);
  const scope = rule?.stages.find((x) => x.id === stage.stageId)?.scope || "organisation";
  const pool = eligibleApprovers(core, stage.eligibleRoles, scope, req.teamId)
    .filter((p, i, arr) => arr.indexOf(p) === i && p !== stage.assigneeId && !(rule?.prohibitSelfApproval && p === req.requesterId));
  const mayHand = canDo("approvals.delegate") && (stage.assigneeId === me || v.isOrgWide);
  const overdue = ops.isStageOverdue(a, ctx.now);
  const mayEscalate = canDo("tasks.manage");
  const stale = req.version !== a.reviewingVersion;
  const needReason = !comment.trim();

  const decide = (kind: "approve" | "decline" | "return") => { if (run(ops.decide, a.id, kind, comment).ok) setComment(""); };

  return (
    <div className="wk-stack">
      {auth.ok ? (
        <>
          {auth.onBehalfOf && <Notice>You are deciding on behalf of {q.name(auth.onBehalfOf)} under an active delegation. The record shows both names.</Notice>}
          {stale && <Notice tone="warn">The request changed since this review started. Reopen it to see the current version before deciding.</Notice>}
          {focusComment && <Notice tone="warn">To decline or return this, write the reason below first. The requester sees it.</Notice>}
          <Field label="Comment" htmlFor="ap-comment" help="Optional to approve. Needed to decline or return, so the requester knows what to do.">
            <TextArea id="ap-comment" value={comment} onChange={setComment} rows={2} />
          </Field>
          <div className="wk-row">
            <Button variant="primary" onClick={() => decide("approve")}>Approve {stage.label.toLowerCase()} stage</Button>
            <Button disabled={needReason} title={needReason ? "Add a reason first" : undefined} onClick={() => decide("return")}>Return for changes</Button>
            <Button variant="danger" disabled={needReason} title={needReason ? "Add a reason first" : undefined} onClick={() => decide("decline")}>Decline</Button>
          </div>
          {needReason && <div className="wk-small">Return and Decline need a reason in the comment.</div>}
          <InlineError text={err} />
        </>
      ) : (
        <Notice>{auth.reason}</Notice>
      )}

      <div className="wk-box">
        <div className="pk-eyebrow" style={{ marginBottom: 8 }}>Hand on</div>
        {mayHand ? (
          <>
            <div className="pk-grid2">
              <Field label="To" htmlFor="ap-hand">
                <Select id="ap-hand" value={toId} onChange={setToId}
                  options={[{ value: "", label: pool.length ? "Choose an eligible person" : "No one else is eligible" }, ...pool.map((p) => ({ value: p, label: q.name(p) }))]} />
              </Field>
              <Field label="Reason" htmlFor="ap-hand-reason"><TextInput id="ap-hand-reason" value={handReason} onChange={setHandReason} placeholder="Why it is moving" /></Field>
            </div>
            <div className="wk-row" style={{ marginTop: 8 }}>
              <span className="wk-small pk-grow">Only people holding an eligible role for this stage are listed.</span>
              <Button disabled={!toId || !handReason.trim()} title={!toId ? "Choose a person" : !handReason.trim() ? "Give a reason" : undefined}
                onClick={() => { if (hand.run(ops.reassignStage, a.id, toId, handReason).ok) { setToId(""); setHandReason(""); } }}>Hand on</Button>
            </div>
            <InlineError text={hand.err} />
          </>
        ) : <div className="wk-small">Only the current decision owner ({q.name(stage.assigneeId)}) or an administrator can hand this on.</div>}
      </div>

      {overdue && (
        <div className="wk-box">
          <div className="wk-row">
            <Chip tone="bad">Overdue</Chip>
            <span className="wk-muted pk-grow">Past its deadline of {dt(stage.dueAt)}, with {q.name(stage.assigneeId)}.</span>
            <Button disabled={!mayEscalate} title={mayEscalate ? undefined : "Escalation needs a manager or administrator."}
              onClick={() => esc.run(ops.escalate, a.id)}>Escalate</Button>
          </div>
          {!mayEscalate && <div className="wk-small" style={{ marginTop: 6 }}>Escalation needs a manager or administrator.</div>}
          <InlineError text={esc.err} />
        </div>
      )}
    </div>
  );
}

/* ── Requester ────────────────────────────────────────────────────────── */

export function RequesterActions({ req, form }: { req: RequestItem; form?: RequestFormDef }) {
  const { err, run } = useRunner();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evNote, setEvNote] = useState("");
  const closed = req.status === "declined" || req.status === "withdrawn";
  const executed = req.execution.status === "succeeded";
  const material = (form?.fields || []).filter((f) => f.material).map((f) => f.label.toLowerCase());
  const errors = form ? fieldErrors(form.fields, draft) : {};
  const show = Object.fromEntries((form?.fields || []).map((f) => [f.key, true]));

  if (closed) return <div className="wk-muted">This request is {LABEL.request[req.status].toLowerCase()}. Raise a new request if it is still needed.</div>;

  return (
    <div className="wk-stack">
      <div className="wk-row">
        {req.status === "draft" && <Button variant="primary" onClick={() => run(ops.submitRequest, req.id)}>Submit</Button>}
        {req.status === "changes_requested" && <Button variant="primary" onClick={() => run(ops.submitRequest, req.id)}>Resubmit</Button>}
        {form && <Button disabled={executed} title={executed ? "The approved action already ran. Raise a new request instead." : undefined}
          onClick={() => { setDraft(fromValues(form.fields, req.fields)); setNote(""); setEditing(!editing); }}>{editing ? "Stop editing" : "Edit"}</Button>}
        {!confirm
          ? <Button variant="ghost" disabled={executed} title={executed ? "The approved action already ran, so it can no longer be withdrawn." : undefined} onClick={() => setConfirm(true)}>Withdraw</Button>
          : <><span className="wk-small">Withdraw {req.ref}? Reviewers stop seeing it as waiting.</span><Button variant="danger" onClick={() => { run(ops.withdrawRequest, req.id); setConfirm(false); }}>Confirm withdraw</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button></>}
      </div>
      {req.status === "changes_requested" && <div className="wk-small">A reviewer returned this for changes. Edit it, then resubmit to start a new review cycle.</div>}

      {editing && form && (
        <div className="wk-box wk-stack">
          {material.length > 0 && (
            <Notice tone="warn">Material fields: {material.join(", ")}. Changing one after a reviewer has approved a stage restarts the review from the first stage, and earlier approvals no longer apply.</Notice>
          )}
          <RequestFields defs={form.fields} draft={draft} onChange={setDraft} errors={errors} show={show} idPrefix="ed" />
          <Field label="What changed" htmlFor="ed-note" help="Kept with the new version."><TextInput id="ed-note" value={note} onChange={setNote} /></Field>
          <div className="wk-row">
            <span className="pk-grow" />
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" disabled={Object.keys(errors).length > 0} title={Object.keys(errors).length ? "Fix the highlighted fields first" : undefined}
              onClick={() => { if (run(ops.editRequest, req.id, toValues(form.fields, draft), note).ok) setEditing(false); }}>Save as version {req.version + 1}</Button>
          </div>
        </div>
      )}

      <div className="pk-grid2">
        <Field label="Evidence note title" htmlFor="rq-ev-t"><TextInput id="rq-ev-t" value={evTitle} onChange={setEvTitle} placeholder="For example: Source extract" /></Field>
        <Field label="Note" htmlFor="rq-ev-n"><TextInput id="rq-ev-n" value={evNote} onChange={setEvNote} placeholder="What it shows" /></Field>
      </div>
      <div className="wk-row">
        <span className="wk-small pk-grow">No file is uploaded in this demo. This records a named evidence note on the request.</span>
        <Button disabled={!evTitle.trim()} title={evTitle.trim() ? undefined : "Name the evidence first"}
          onClick={() => { if (run(ops.attachEvidence, { requestId: req.id }, evTitle, evNote).ok) { setEvTitle(""); setEvNote(""); } }}>Add evidence note</Button>
      </div>
      <InlineError text={err} />
    </div>
  );
}

/* ── Execution ────────────────────────────────────────────────────────── */

export function ExecutionSection({ req, a, form }: { req: RequestItem; a?: Approval; form?: RequestFormDef }) {
  const { me, can: canDo } = useViewer();
  const { dt } = useClock();
  const { err, run } = useRunner();
  const ex = req.execution;
  const approved = req.status === "approved" && a?.status === "approved";
  const approvers = a ? a.decisions.filter((d) => d.cycle === a.cycle && d.kind === "approve").map((d) => d.actorId) : [];
  const allowed = req.requesterId === me || approvers.includes(me) || canDo("workflows.operate");
  const reason = !approved ? "Runs only after the request is approved." : ex.status === "succeeded" ? "Already applied for this version." : !allowed ? "Only the requester, an approver or a workflow operator can run this." : "";
  const external = form?.effect.kind === "notify-external";

  return (
    <div className="wk-stack">
      <KV items={[
        ["Status", <Chip key="s" tone={toneOf.exec(ex.status)}>{LABEL.exec[ex.status]}</Chip>],
        ["What runs", form?.effect.label || ex.effect || "Nothing configured"],
        ["Attempts", String(ex.attempts)],
        ["Last run", ex.executedAt ? dt(ex.executedAt) : "Not yet"]
      ]} />
      {ex.status === "succeeded" && <div className="wk-muted">Result: {ex.effect}.</div>}
      {ex.status === "failed" && ex.lastError && <Notice tone="bad">Approved, but the action failed: {ex.lastError}</Notice>}
      {external && (
        <div className="wk-small">This sends through the email connection, which is not connected in this demo, so running it fails and nothing is sent. An administrator can connect a provider in Settings &gt; Systems.</div>
      )}
      <div className="wk-row">
        <Button variant="primary" disabled={!!reason} title={reason || undefined} onClick={() => run(ops.executeRequest, req.id)}>{ex.attempts > 0 && ex.status !== "succeeded" ? "Run approved action again" : "Run approved action"}</Button>
        {external && ex.status === "failed" && <Button variant="ghost" onClick={() => navigate({ page: "Settings", section: "connections" })}>Open connections</Button>}
        <span className="wk-small pk-grow">{reason || "Running again never repeats an effect that was already applied: each effect is recorded once for this version."}</span>
      </div>
      {ex.status === "not_applicable" && <div className="wk-small">Nothing runs: the request was {LABEL.request[req.status].toLowerCase()}.</div>}
      <InlineError text={err} />
    </div>
  );
}
