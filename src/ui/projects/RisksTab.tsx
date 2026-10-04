/* Project > Risks and decisions: issue, severity, known impact, owner, next
   action and a related approval request when there is one. */

import { useState } from "react";
import { openObject, removeProjectRisk, saveProjectRisk, store, type Project, type ProjectRisk } from "../../core";
import { Button, Chip, Empty, Field, PersonName, Select, SidePanel, TextArea, TextInput, toneOf } from "../kit";
import { Faint, useProjectsCtx } from "./shared";

const KIND: Record<ProjectRisk["kind"], string> = { risk: "Risk", issue: "Issue", decision: "Decision" };
const STATE: Record<ProjectRisk["state"], string> = { open: "Open", mitigating: "Mitigating", closed: "Closed" };
const SEV: Record<ProjectRisk["severity"], string> = { high: "High", medium: "Medium", low: "Low" };

export function RisksTab({ p, canChange }: { p: Project; canChange: boolean }) {
  const { core, q, d } = useProjectsCtx();
  const me = q.viewer.person.id;
  const [edit, setEdit] = useState<ProjectRisk | "new" | null>(null);
  const all = core.data.risks.filter((r) => r.projectId === p.id);
  const order = (a: ProjectRisk, b: ProjectRisk) => (a.state === "closed" ? 1 : 0) - (b.state === "closed" ? 1 : 0) || ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity);
  const risks = all.filter((r) => r.kind !== "decision").sort(order);
  const decisions = all.filter((r) => r.kind === "decision").sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const table = (rows: ProjectRisk[], decision: boolean) => (
    <div className="pk-card pj-table" style={{ overflow: "hidden" }}>
      <div className="pk-table-wrap">
        <table className="pk-table" aria-label={decision ? "Decisions" : "Risks and issues"}>
          <thead><tr>
            <th>{decision ? "Decision" : "Risk or issue"}</th>{!decision && <th>Severity</th>}<th>{decision ? "Consequence" : "Known impact"}</th><th>Owner</th><th>Next action</th><th>State</th><th>Related request</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const req = r.requestId ? q.request(r.requestId) : undefined;
              const canEdit = canChange || r.ownerId === me;
              return (
                <tr key={r.id} className="pk-row" tabIndex={0} onClick={() => canEdit && setEdit(r)} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && canEdit) { e.preventDefault(); setEdit(r); } }}
                  title={canEdit ? "Edit" : "Only the owner of this entry, the project owner or a manager can change it"}>
                  <td className="pk-strong"><span className="pj-cell2"><span>{r.title}</span><span>{KIND[r.kind]} · logged {d(r.createdAt)}</span></span></td>
                  {!decision && <td><Chip tone={toneOf.severity(r.severity)}>{SEV[r.severity]}</Chip></td>}
                  <td style={{ whiteSpace: "normal" }}>{r.impact || <Faint>Not known</Faint>}</td>
                  <td><PersonName id={r.ownerId} /></td>
                  <td style={{ whiteSpace: "normal" }}>{r.nextAction || <Faint>None</Faint>}</td>
                  <td><Chip tone={r.state === "closed" ? "neutral" : r.state === "mitigating" ? "accent" : "warn"}>{STATE[r.state]}</Chip></td>
                  <td>{r.requestId ? (req
                    ? <button type="button" className="pj-linkbtn" onClick={(e) => { e.stopPropagation(); openObject("request", req.id); }}>{req.ref}</button>
                    : <Faint>A request you cannot see</Faint>) : <Faint>None</Faint>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="pj-tabhead">
        <div className="pj-faint">Open high risks count towards computed health. Decisions are kept as a record with their owner and consequence.</div>
        <Button variant="primary" onClick={() => setEdit("new")} disabled={!canChange} title={canChange ? undefined : "Only the owner or a manager of its team can log risks"}>Add risk or decision</Button>
      </div>
      <div className="pk-eyebrow" style={{ margin: "4px 2px 8px" }}>Risks and issues · {risks.filter((r) => r.state !== "closed").length} open</div>
      {risks.length ? table(risks, false) : <Empty title="No risks logged" body="Log a risk or issue with its impact, owner and next action." />}
      <div className="pk-eyebrow" style={{ margin: "18px 2px 8px" }}>Decisions · {decisions.length}</div>
      {decisions.length ? table(decisions, true) : <Empty title="No decisions recorded" body="Record decisions so the reason and owner stay with the plan." />}
      {edit && <RiskPanel p={p} risk={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function RiskPanel({ p, risk, onClose }: { p: Project; risk: ProjectRisk | null; onClose: () => void }) {
  const { core, q } = useProjectsCtx();
  const [f, setF] = useState({
    kind: risk?.kind || "risk" as ProjectRisk["kind"], title: risk?.title || "", severity: risk?.severity || "medium" as ProjectRisk["severity"],
    impact: risk?.impact || "", ownerId: risk?.ownerId || p.ownerId, nextAction: risk?.nextAction || "", state: risk?.state || "open" as ProjectRisk["state"],
    requestId: risk?.requestId || ""
  });
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const staff = core.data.people.filter((x) => x.kind === "staff" && x.status !== "suspended");
  const requests = q.requests({ ignoreScope: true });
  const save = () => {
    const r = store.run(saveProjectRisk, p.id, { ...f, requestId: f.requestId || undefined }, risk?.id);
    if (r.ok) onClose(); else setErr(r.error);
  };
  const remove = () => {
    const r = store.run(removeProjectRisk, risk!.id);
    if (r.ok) onClose(); else setErr(r.error);
  };
  return (
    <SidePanel open onClose={onClose} title={risk ? risk.title : "Add risk or decision"} eyebrow={p.ref} width={560}
      footer={<>
        {risk && (confirm
          ? <><span className="pk-help">Remove it? The history keeps a record.</span><Button size="sm" variant="danger" onClick={remove}>Remove</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button></>
          : <Button variant="ghost" onClick={() => setConfirm(true)}>Remove</Button>)}
        <span className="pk-grow" />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={!f.title.trim()}>{risk ? "Save" : "Add"}</Button>
      </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="pj-grid2">
          <Field label="Kind"><Select ariaLabel="Kind" value={f.kind} onChange={(x) => setF({ ...f, kind: x as ProjectRisk["kind"] })} options={(Object.keys(KIND) as ProjectRisk["kind"][]).map((k) => ({ value: k, label: KIND[k] }))} /></Field>
          <Field label="Severity"><Select ariaLabel="Severity" value={f.severity} onChange={(x) => setF({ ...f, severity: x as ProjectRisk["severity"] })} options={(Object.keys(SEV) as ProjectRisk["severity"][]).map((k) => ({ value: k, label: SEV[k] }))} /></Field>
        </div>
        <Field label="Title"><TextInput ariaLabel="Title" value={f.title} onChange={(x) => setF({ ...f, title: x })} /></Field>
        <Field label={f.kind === "decision" ? "Consequence" : "Known impact"} help="What happens if it is not handled, as far as it is known. Leave money out unless it is known.">
          <TextArea value={f.impact} onChange={(x) => setF({ ...f, impact: x })} rows={2} />
        </Field>
        <div className="pj-grid2">
          <Field label="Owner"><Select ariaLabel="Owner" value={f.ownerId} onChange={(x) => setF({ ...f, ownerId: x })} options={staff.map((x) => ({ value: x.id, label: x.name }))} /></Field>
          <Field label="State"><Select ariaLabel="State" value={f.state} onChange={(x) => setF({ ...f, state: x as ProjectRisk["state"] })} options={(Object.keys(STATE) as ProjectRisk["state"][]).map((k) => ({ value: k, label: STATE[k] }))} /></Field>
        </div>
        <Field label="Next action"><TextInput ariaLabel="Next action" value={f.nextAction} onChange={(x) => setF({ ...f, nextAction: x })} /></Field>
        <Field label="Related request" help="Link the approval request that deals with it, if there is one.">
          <Select ariaLabel="Related request" value={f.requestId} onChange={(x) => setF({ ...f, requestId: x })}
            options={[{ value: "", label: "None" }, ...requests.map((r) => ({ value: r.id, label: r.ref + " " + r.title }))]} />
        </Field>
        {err && <div className="pk-error" role="alert">{err}</div>}
      </div>
    </SidePanel>
  );
}
