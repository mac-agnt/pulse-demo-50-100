/* Work > Requests: every request the viewer can see, from every form
   (including module forms such as purchase, invoice review, evidence review,
   agent action and milestone change), as the same canonical objects that
   Approvals and the module pages show. A row opens the request with its
   linked approval; New request validates against the form. */

import { useMemo, useState } from "react";
import { useCore, scopeLabel, ms } from "../../core";
import type { RequestItem, Tone } from "../../core";
import { SegTabs, FilterChip, Btn, Pill, eyebrowOf } from "../frame";
import { LABEL } from "../kit";
import { currentStage } from "../selectors";
import { Ico, isAgent, shortWhen, useClock, useViewer, WI, WorkHead, type OpenPanel } from "./shared";

type Lane = "open" | "mine" | "decided" | "all";
const OPEN = new Set(["draft", "submitted", "changes_requested"]);
const TONE: Record<string, Tone> = { draft: "neutral", submitted: "accent", changes_requested: "warn", approved: "ok", declined: "bad", withdrawn: "neutral" };
const EXEC_TONE: Record<string, Tone> = { not_started: "neutral", running: "accent", succeeded: "ok", failed: "bad", not_applicable: "neutral" };

export default function RequestsView({ openPanel, selected }: { openPanel: OpenPanel; selected?: string | null }) {
  const { core, ctx, q } = useCore();
  const { me } = useViewer();
  const { tz, now } = useClock();
  const [lane, setLane] = useState<Lane>("open");
  const [form, setForm] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const scopeName = scopeLabel(core, ctx.scope);

  /* Requests in scope plus everything the viewer raised, once each. */
  const pool = useMemo(() => {
    const m = new Map<string, RequestItem>();
    for (const r of q.requests()) m.set(r.id, r);
    for (const r of q.requests({ ignoreScope: true })) if (r.requesterId === me || r.createdBy === me) m.set(r.id, r);
    return [...m.values()];
  }, [q, me]);

  const lanes: Record<Lane, RequestItem[]> = {
    open: pool.filter((r) => OPEN.has(r.status) || (r.status === "approved" && (r.execution.status === "not_started" || r.execution.status === "failed" || r.execution.status === "running"))),
    mine: pool.filter((r) => r.requesterId === me || r.createdBy === me),
    decided: pool.filter((r) => r.status === "approved" || r.status === "declined" || r.status === "withdrawn"),
    all: pool
  };
  const agentRaised = (r: RequestItem) => isAgent(r.requesterId) || isAgent(r.createdBy) || typeof r.fields.agentRunId === "string";
  const rows = lanes[lane].filter((r) => (!form || r.formId === form) && (!status || r.status === status) && (!origin || (origin === "agent" ? agentRaised(r) : !agentRaised(r))))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const forms = [...new Set(pool.map((r) => r.formId))];
  const formLabel = (id: string) => core.config.requestForms.find((x) => x.id === id)?.label || "Unknown form";
  const formsReady = core.config.requestForms.some((x) => x.enabled);
  const filtered = !!(form || status || origin);

  return (
    <>
      <WorkHead eyebrow={eyebrowOf("Work", "Requests", scopeName, pool.length + " visible")} title="Requests"
        info="Every request you can see, from every form. A purchase request, an invoice review or an agent action is the same request here as in its module and in Approvals."
        primary={<Btn primary disabled={!formsReady} title={formsReady ? undefined : "No request forms are configured yet. An administrator can add one in Settings, Control."}
          onClick={() => openPanel({ kind: "newRequest" })}><Ico d={WI.plus} size={14} sw={2.1} />New request</Btn>} />

      <div className="wk-viewbar">
        <SegTabs label="Request view" value={lane} onChange={setLane} options={[
          { value: "open", label: "Open", count: lanes.open.length }, { value: "mine", label: "Raised by me", count: lanes.mine.length },
          { value: "decided", label: "Closed", count: lanes.decided.length }, { value: "all", label: "All", count: lanes.all.length }]} />
        <span className="wk-vsep" aria-hidden="true" />
        {forms.length > 1 && <FilterChip label="Form" value={form} onChange={setForm} options={[{ value: "", label: "Any form" }, ...forms.map((id) => ({ value: id, label: formLabel(id) }))]} />}
        <FilterChip label="Status" value={status} onChange={setStatus}
          options={[{ value: "", label: "Any status" }, ...Object.keys(LABEL.request).map((k) => ({ value: k, label: LABEL.request[k] }))]} />
        <FilterChip label="Raised by" value={origin} onChange={setOrigin} options={[{ value: "", label: "People and agents" }, { value: "person", label: "People" }, { value: "agent", label: "Agents" }]} />
        {filtered && <button type="button" className="wk-dashed-btn" onClick={() => { setForm(""); setStatus(""); setOrigin(""); }}>Clear filters</button>}
      </div>

      <section className="wk-card wk-tcard" aria-label="Requests">
        {rows.length > 0 ? (
          <div className="wk-scroll">
            <table className="wk-table" style={{ minWidth: 920 }}>
              <thead><tr><th>Request</th><th>Form</th><th>Raised by</th><th>Status</th><th>Decision with</th><th>Approved action</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const a = r.approvalId ? q.approval(r.approvalId) : undefined;
                  const st = a ? currentStage(a) : undefined;
                  const open = () => openPanel(a ? { kind: "approval", id: a.id } : { kind: "request", id: r.id });
                  return (
                    <tr key={r.id} tabIndex={0} data-selected={selected === r.id || undefined} onClick={open}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }} aria-label={"Open " + r.ref + " " + r.title}>
                      <td className="wk-strong" title={r.title}><span className="wk-ref">{r.ref}</span>{r.title}</td>
                      <td>{formLabel(r.formId)}</td>
                      <td>{q.name(r.requesterId)}{agentRaised(r) && <span className="wk-small"> (agent)</span>}</td>
                      <td><Pill tone={TONE[r.status]}>{a?.status === "stale" ? "Needs re-review" : LABEL.request[r.status]}</Pill></td>
                      <td>{st ? q.name(st.assigneeId) + (st.dueAt && ms(st.dueAt) < ms(now) ? ", overdue" : "") : <span className="pk-faint">{r.status === "draft" ? "Not submitted" : "Nobody"}</span>}</td>
                      <td>{r.status === "approved" ? <Pill tone={EXEC_TONE[r.execution.status]}>{LABEL.exec[r.execution.status]}</Pill> : <span className="pk-faint">After approval</span>}</td>
                      <td className="pk-mono" style={{ fontSize: 12 }}>{shortWhen(r.updatedAt, now, tz)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="wk-empty" style={{ borderTop: 0 }}>
            {core.data.requests.length === 0
              ? <><b>No requests yet</b><span>{formsReady ? "Raise one with New request. It shows here with its approval and the action approval runs." : "No request forms are configured yet. An administrator can add one in Settings, Control."}</span></>
              : filtered ? <><b>No requests match these filters</b><span>Clear a filter, or switch view.</span></>
              : <><b>Nothing in this view</b><span>Requests in {scopeName}, and everything you raised, appear here.</span></>}
          </div>
        )}
      </section>
    </>
  );
}
