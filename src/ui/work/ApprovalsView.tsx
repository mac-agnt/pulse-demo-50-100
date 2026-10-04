/* Work > Approvals: a compact header, view tabs with counts and filter chips,
   then one card per request with its stage chips and View / Approve /
   Decline. Approve and Decline only show when the viewer has decision
   authority now; Decline needs a reason, so it opens the approval with the
   decision box focused. Decided cards show the execution state separately.
   Every request, including module forms (purchase, invoice review, evidence
   review, agent action, milestone change), is the same canonical object. */

import { useState } from "react";
import { useCore, ops, scopeLabel, ms, localDay } from "../../core";
import type { Approval, ApprovalStage, RequestItem, Tone } from "../../core";
import { SegTabs, FilterChip, Btn, eyebrowOf, toneColor, toneSoft } from "../frame";
import { LABEL } from "../kit";
import { currentStage, waitingOnMe } from "../selectors";
import { ageText, formOf, Ico, isAgent, shortWhen, useClock, useRunner, useViewer, WI, WorkHead, type OpenPanel } from "./shared";

type Lane = "mine" | "others" | "returned" | "decided";
interface Row { req: RequestItem; a?: Approval }

export default function ApprovalsView({ openPanel, selected }: { openPanel: OpenPanel; selected?: string | null }) {
  const { core, ctx, q } = useCore();
  const { me } = useViewer();
  const { tz, now } = useClock();
  // Open on decisions waiting on you; if there are none, show what is in progress instead of an empty page.
  const [lane, setLane] = useState<Lane>(() => (waitingOnMe(q).length ? "mine" : "others"));
  const [since, setSince] = useState("");
  const [form, setForm] = useState("");
  const [who, setWho] = useState("");
  const [team, setTeam] = useState("");
  const scopeName = scopeLabel(core, ctx.scope);

  const reqOf = (a: Approval) => q.request(a.requestId) || core.data.requests.find((r) => r.id === a.requestId)!;
  const mine = waitingOnMe(q);
  const mineIds = new Set(mine.map((a) => a.id));
  const inScope = q.approvals();
  const month = localDay(now, tz).slice(0, 7);
  const lanes: Record<Lane, Row[]> = {
    mine: mine.map((a) => ({ req: reqOf(a), a })),
    others: inScope.filter((a) => (a.status === "pending" || a.status === "stale") && !mineIds.has(a.id)).map((a) => ({ req: reqOf(a), a })),
    returned: inScope.filter((a) => a.status === "returned").map((a) => ({ req: reqOf(a), a })),
    decided: inScope.filter((a) => a.status === "approved" || a.status === "declined").map((a) => ({ req: reqOf(a), a }))
  };
  const decidedThisMonth = lanes.decided.filter((r) => r.a?.decidedAt && localDay(r.a.decidedAt, tz).slice(0, 7) === month).length;


  const at = (r: Row) => r.a?.submittedAt || r.req.createdAt;
  const base = lanes[lane];
  const rows = base
    .filter((r) => (!since || ms(now) - ms(at(r)) <= Number(since) * 864e5) && (!form || r.req.formId === form)
      && (!who || r.req.requesterId === who) && (!team || (r.req.teamId || "") === team))
    .sort((x, y) => lane === "decided"
      ? (y.a?.decidedAt || "").localeCompare(x.a?.decidedAt || "")
      : Number(!!y.a && ops.isStageOverdue(y.a, now)) - Number(!!x.a && ops.isStageOverdue(x.a, now)) || at(x).localeCompare(at(y)));

  const forms = [...new Set(base.map((r) => r.req.formId))];
  const requesters = [...new Set(base.map((r) => r.req.requesterId))];
  const teams = [...new Set(base.map((r) => r.req.teamId || ""))];
  const filtered = !!(since || form || who || team);
  const clear = () => { setSince(""); setForm(""); setWho(""); setTeam(""); };

  const tabs: { value: Lane; label: string; count: number }[] = [
    { value: "mine", label: "Awaiting you", count: lanes.mine.length },
    { value: "others", label: "Awaiting others", count: lanes.others.length },
    { value: "returned", label: "Returned", count: lanes.returned.length },
    { value: "decided", label: "Decided", count: lanes.decided.length }
  ];

  const formsReady = core.config.requestForms.some((x) => x.enabled);
  const EMPTY: Record<Lane, [string, string]> = {
    mine: ["Nothing waiting on you", "Requests appear here with every step and who it sits with, including decisions delegated to you."],
    others: ["Nothing else in review in " + scopeName, "Requests with someone else appear here. Try a wider scope from the top bar."],
    returned: ["Nothing returned in " + scopeName, "Requests sent back for changes appear here until they are resubmitted."],
    decided: ["No decided requests in " + scopeName, "Approved and declined requests appear here with whether the approved action has run."]
  };

  return (
    <>
      <WorkHead eyebrow={eyebrowOf("Work", "Approvals", scopeName, decidedThisMonth + " decided this month")} title="Approvals"
        info="Decisions and their stages. Every decision is recorded as the person who made it; running the approved action is a separate step."
        primary={<Btn primary disabled={!formsReady} title={formsReady ? undefined : "No request forms are configured yet."} onClick={() => openPanel({ kind: "newRequest" })}><Ico d={WI.plus} size={14} sw={2.1} />New request</Btn>} />

      <div className="wk-viewbar">
        <SegTabs label="Approval view" options={tabs} value={lane} onChange={setLane} />
        <span className="wk-vsep" aria-hidden="true" />
        <FilterChip label="Raised" value={since} onChange={setSince}
          options={[{ value: "", label: "Raised date" }, { value: "1", label: "Last 24 hours" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]} />
        {forms.length > 1 && (
          <FilterChip label="Form" value={form} onChange={setForm}
            options={[{ value: "", label: "Any form" }, ...forms.map((id) => ({ value: id, label: core.config.requestForms.find((x) => x.id === id)?.label || "Unknown form" }))]} />
        )}
        <FilterChip label="Raised by" value={who} onChange={setWho}
          options={[{ value: "", label: "Anyone" }, ...requesters.map((id) => ({ value: id, label: q.name(id) }))]} />
        {teams.length > 1 && (
          <FilterChip label="Team" value={team} onChange={setTeam}
            options={[{ value: "", label: "Any team" }, ...teams.map((id) => ({ value: id, label: q.teamLabel(id || undefined) }))]} />
        )}
        {filtered && <button type="button" className="wk-dashed-btn" onClick={clear}>Clear filters</button>}
      </div>

      <div className="wk-ap-list">
        {rows.map((r, i) => <ApprovalCard key={r.req.id} row={r} i={i} mine={!!r.a && mineIds.has(r.a.id)} selected={selected === r.req.id} openPanel={openPanel} />)}
        {rows.length === 0 && (
          <div className="wk-card wk-ap-empty">
            {core.data.requests.length === 0 ? (
              <><b>No requests yet</b><span>{formsReady ? "Raise one with the add button. It appears here with every step while it is decided." : "No request forms are configured yet. An administrator can add one in Settings > Control, then requests can be raised here."}</span></>
            ) : filtered ? (
              <><b>No requests match these filters</b><span>Clear a filter, or switch view.</span>
                <button type="button" className="wk-dashed-btn" style={{ margin: "14px auto 0" }} onClick={clear}>Clear filters</button></>
            ) : <><b>{EMPTY[lane][0]}</b><span>{EMPTY[lane][1]}</span></>}
          </div>
        )}
      </div>
    </>
  );
}

const DOT: Record<string, Tone> = { approved: "ok", pending: "warn", waiting: "neutral", declined: "bad", returned: "warn", skipped: "neutral" };

function ApprovalCard({ row, i, mine, selected, openPanel }: { row: Row; i: number; mine: boolean; selected: boolean; openPanel: OpenPanel }) {
  const { core, ctx, q } = useCore();
  const { me, can: canDo } = useViewer();
  const { tz, now, dt } = useClock();
  const { err, run } = useRunner();
  const { req, a } = row;
  const f = formOf(core, req);
  const stage = a ? currentStage(a) : undefined;
  const overdue = !!a && a.status === "pending" && ops.isStageOverdue(a, now);
  const auth = a && a.status === "pending" ? ops.decisionAuthority(core, ctx, a) : null;
  const view = () => openPanel(a ? { kind: "approval", id: a.id } : { kind: "request", id: req.id });

  const [statusText, tone]: [string, Tone] = req.status === "withdrawn" ? ["withdrawn", "neutral"]
    : req.status === "draft" ? ["draft", "neutral"]
    : !a ? [LABEL.request[req.status].toLowerCase(), "neutral"]
    : a.status === "pending" ? (mine ? ["awaiting you", "warn"] : ["awaiting " + q.name(stage?.assigneeId), "accent"])
    : a.status === "stale" ? ["needs re-review", "warn"]
    : a.status === "returned" ? ["returned", "warn"]
    : a.status === "approved" ? ["approved", "ok"] : ["declined", "bad"];

  const decisionAt = (st: ApprovalStage, kind: string) => a?.decisions.filter((d) => d.cycle === a.cycle && d.stageId === st.stageId && d.kind === kind).slice(-1)[0]?.at;
  const chips = a ? a.stages.filter((st) => st.status !== "skipped").map((st) => {
    const late = st.status === "pending" && !!st.dueAt && ms(st.dueAt) < ms(now);
    const state = st.status === "approved" ? "approved " + shortWhen(decisionAt(st, "approve"), now, tz)
      : st.status === "declined" ? "declined " + shortWhen(decisionAt(st, "decline"), now, tz)
      : st.status === "returned" ? "returned " + shortWhen(decisionAt(st, "return"), now, tz)
      : st.status === "pending" ? (late ? "overdue" : st.escalatedFromId ? "escalated" : "pending")
      : "next";
    return { key: st.stageId, who: st.assigneeId ? q.name(st.assigneeId) : "No one eligible", state: state.trim(), tone: late ? "bad" as Tone : DOT[st.status], title: st.label + " stage" };
  }) : [];

  const ex = req.execution;
  const approvers = a ? a.decisions.filter((d) => d.cycle === a.cycle && d.kind === "approve").map((d) => d.actorId) : [];
  const mayRun = req.requesterId === me || approvers.includes(me) || canDo("workflows.operate");
  const showRun = req.status === "approved" && a?.status === "approved" && ex.status !== "succeeded" && ex.status !== "not_applicable";
  const mayEscalate = canDo("tasks.manage");

  return (
    <article className="wk-ap" data-selected={selected || undefined} style={{ animationDelay: Math.min(i * 40, 320) + "ms" }}>
      <div className="wk-ap-top">
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="wk-ap-titlerow">
            <span className="wk-ref">{req.ref}</span>
            <span className="wk-ap-title">{req.title}</span>
            <span className="wk-ap-status" style={{ background: toneSoft(tone), color: toneColor(tone) }}>{statusText}</span>
            {overdue && <span className="wk-ap-status" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>Overdue</span>}
          </div>
          <div className="wk-ap-sub">
            {[f?.label, "raised by " + q.name(req.requesterId), req.teamId ? q.teamLabel(req.teamId) : null, req.version > 1 ? "version " + req.version : null].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span className="wk-ap-age" title={"Raised " + dt(a?.submittedAt || req.createdAt)}>{ageText(a?.submittedAt || req.createdAt, now)}</span>
      </div>

      <div className="wk-ap-bottom">
        <div className="wk-step" title="Requester">
          <span className="wk-step-dot" style={{ background: "var(--ok)" }} />
          <span className="wk-step-who">{q.name(req.requesterId)}</span>
          <span className="wk-step-state">{req.status === "draft" ? "drafted " : "raised "}{shortWhen(a?.submittedAt || req.createdAt, now, tz)}</span>
        </div>
        {chips.map((c) => (
          <div key={c.key} className="wk-step" title={c.title}>
            <span className="wk-step-dot" style={{ background: toneColor(c.tone) }} />
            <span className="wk-step-who">{c.who}</span>
            <span className="wk-step-state">{c.state}</span>
          </div>
        ))}
        {!a && req.status === "draft" && <span className="wk-small">Not submitted yet, so no one has been asked to decide.</span>}
        {a && (a.status === "approved") && (
          <span className="wk-ap-status" style={{ background: toneSoft(ex.status === "succeeded" ? "ok" : ex.status === "failed" ? "bad" : "neutral"), color: toneColor(ex.status === "succeeded" ? "ok" : ex.status === "failed" ? "bad" : "neutral") }}
            title={ex.status === "failed" ? ex.lastError : ex.effect}>Action: {LABEL.exec[ex.status]}</span>
        )}

        <div className="wk-spacer" />

        <button type="button" className="wk-view-btn" onClick={view}><Ico d={WI.eye} size={13} sw={1.8} />View</button>
        {overdue && mayEscalate && (
          <button type="button" className="wk-decline-btn" onClick={() => run(ops.escalate, a!.id)} title={"Past its deadline, with " + q.name(stage?.assigneeId)}>Escalate</button>
        )}
        {auth?.ok && (
          <>
            <button type="button" className="wk-approve-btn" onClick={() => run(ops.decide, a!.id, "approve", "")}
              title={auth.onBehalfOf ? "Approve on behalf of " + q.name(auth.onBehalfOf) : "Approve the " + (stage?.label.toLowerCase() || "current") + " stage"}>Approve</button>
            <button type="button" className="wk-decline-btn" onClick={() => openPanel({ kind: "approval", id: a!.id, intent: "decide" })}
              title="Declining needs a reason. Opens the decision box.">Decline</button>
          </>
        )}
        {showRun && (
          <button type="button" className="wk-approve-btn" disabled={!mayRun} onClick={() => run(ops.executeRequest, req.id)}
            title={mayRun ? "Runs " + (f?.effect.label || "the approved action") + ". An effect already applied is never repeated." : "Only the requester, an approver or a workflow operator can run this."}>
            {ex.attempts > 0 ? "Run approved action again" : "Run approved action"}
          </button>
        )}
      </div>
      {ex.status === "failed" && ex.lastError && a?.status === "approved" && <div className="wk-small" style={{ marginTop: 10, color: "var(--bad)" }}>Approved, but the action failed: {ex.lastError}</div>}
      {err && <div className="pk-error wk-inline-err" role="alert">{err}</div>}
    </article>
  );
}
