/* Outcomes that can be evidenced for agents in the current scope. Only defined
   measures are shown; anything else is labelled "Not measured". */

import AgentFace from "../../components/AgentFace";
import { useCore, navigate } from "../../core";
import { Panel, Btn } from "../frame";
import { agentOutcomes } from "./outcomes";

export default function AgentOutcomesCard() {
  const { q, core } = useCore();
  const rows = agentOutcomes(q);
  const T = core.config.terminology;
  const cols = "minmax(180px,1.6fr) repeat(4,minmax(0,1fr)) minmax(0,.9fr)";

  return (
    <Panel pad={false} style={{ overflow: "hidden" }} title="Agent outcomes" meta="Defined, evidenced outcomes only, within your current scope.">
      {rows.length === 0 ? (
        <div className="pf-empty">
          <b>No agents set up</b>
          <span>Agents are set up in Settings, under Agent controls. Their outcomes appear here once they open issues or create {T.tasks.toLowerCase()}.</span>
          <div style={{ marginTop: 14 }}><Btn small onClick={() => navigate({ page: "Settings", section: "agents" })}>Set up an agent</Btn></div>
        </div>
      ) : (
        <div className="pf-table-wrap">
          <div style={{ minWidth: 760 }} role="table" aria-label="Agent outcomes">
            <div className="pf-th" role="row" style={{ gridTemplateColumns: cols }}>
              <div role="columnheader">Agent</div>
              <div role="columnheader" style={{ textAlign: "right" }}>Data issues opened</div>
              <div role="columnheader" style={{ textAlign: "right" }}>Later resolved</div>
              <div role="columnheader" style={{ textAlign: "right" }}>{T.tasks} created</div>
              <div role="columnheader" style={{ textAlign: "right" }}>{T.tasks} done</div>
              <div role="columnheader">Time saved</div>
            </div>
            {rows.map((r) => (
              <div key={r.agent.id} className="pf-tr" role="row" style={{ gridTemplateColumns: cols, cursor: "default" }}>
                <span role="cell" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, color: "var(--ink)", fontWeight: 500 }}>
                  <AgentFace shape={r.agent.shape} tint={r.agent.tint} state={r.agent.enabled ? "complete" : "idle"} size={26} />
                  <span className="pf-cell">{r.agent.name}{!r.agent.enabled && <span style={{ color: "var(--faint)", fontWeight: 400 }}> (disabled)</span>}</span>
                </span>
                <span role="cell" style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.issuesOpened.length}</span>
                <span role="cell" style={{ textAlign: "right", fontFamily: "var(--mono)" }} title={r.issuesDismissed ? r.issuesDismissed + " dismissed" : undefined}>
                  {r.issuesOpened.length ? r.issuesResolved + " of " + r.issuesOpened.length : "None opened"}
                </span>
                <span role="cell" style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.tasksCreated.length}</span>
                <span role="cell" style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.tasksCreated.length ? r.tasksDone + " of " + r.tasksCreated.length : "None created"}</span>
                <span role="cell" style={{ color: "var(--dim)" }}>Not measured</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="act-def">
        <p><strong>Data issues opened</strong>: issues an agent opened, from the audit trail. <strong>Later resolved</strong>: those issues now marked resolved (dismissed issues are not counted).</p>
        <p><strong>{T.tasks} created</strong>: {T.tasks.toLowerCase()} whose creator is the agent. <strong>Done</strong>: those now marked done.</p>
        <p>Time saved, answer accuracy and any other effect of agents are not measured.</p>
      </div>
    </Panel>
  );
}
