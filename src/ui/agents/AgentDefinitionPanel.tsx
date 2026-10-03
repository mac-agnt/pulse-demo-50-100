/* Side panel with an agent's definition: what it is for, who answers for it,
   what it may read and do, what needs approval first, and the outcomes that
   can be evidenced. Administration lives in Settings, under Agent controls. */

import { useMemo } from "react";
import { useCore, navigate, openObject, can } from "../../core";
import type { AgentDef } from "../../core";
import { Chip, Empty, KV, PersonName, Section, SidePanel, toneOf, LABEL } from "../kit";
import { Btn } from "../frame";
import { agentIssueIds, agentOutcomes, agentTasks, ISSUE_STATE_LABEL, ISSUE_STATE_TONE } from "./outcomes";
import { teamsText } from "./thread";

export default function AgentDefinitionPanel({ agent, open, onClose }: { agent: AgentDef; open: boolean; onClose: () => void }) {
  const { q, core } = useCore();
  const T = core.config.terminology;
  const canManage = can(q.viewer, "agents.manage");
  const outcome = useMemo(() => agentOutcomes(q).find((o) => o.agent.id === agent.id), [q, agent.id]);
  const tasks = agentTasks(q, agent.id).filter((t) => q.isOpenTask(t));
  const issues = useMemo(() => {
    const all = new Map(q.issues({ ignoreScope: true }).map((i) => [i.id, i]));
    return agentIssueIds(q, agent.id).map((id) => all.get(id)).filter((i): i is NonNullable<typeof i> => !!i && (i.state === "open" || i.state === "in_progress"));
  }, [q, agent.id]);

  const list = (items: string[], none: string) => items.length
    ? <ul className="ag-def-list">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    : <span className="pk-muted">{none}</span>;

  const go = (fn: () => void) => { onClose(); fn(); };

  return (
    <SidePanel open={open} onClose={onClose} width={560} eyebrow="Agent definition" title={agent.name}
      chips={<Chip tone={agent.enabled ? "ok" : "neutral"}>{agent.enabled ? "Enabled" : "Disabled"}</Chip>}
      footer={
        <Btn primary onClick={() => go(() => navigate({ page: "Settings", section: "agents" }))}
          title={canManage ? "Change this agent in Settings, under Agent controls" : "Only administrators can change agents; you can view the settings"}>
          {canManage ? "Edit in Settings" : "View in Settings"}
        </Btn>
      }>
      <KV items={[
        ["Purpose", agent.purpose],
        ["Responsible person", <PersonName id={agent.responsibleId} />],
        ["Data scope", teamsText(core, agent)],
        ["Permitted actions", list(agent.permittedActions, "None")],
        ["Needs approval", list(agent.approvalRequired, "Nothing it may do needs approval")]
      ]} />

      <Section label="Outcomes">
        {outcome ? (
          <div className="ag-out">
            <div className="ag-out-tile">
              <span className="ag-out-l">Data issues opened</span>
              <span className="ag-out-v">{outcome.issuesOpened.length}</span>
              <span className="ag-out-s">{outcome.issuesOpened.length ? outcome.issuesResolved + " later resolved" : "None opened"}</span>
            </div>
            <div className="ag-out-tile">
              <span className="ag-out-l">{T.tasks} created</span>
              <span className="ag-out-v">{outcome.tasksCreated.length}</span>
              <span className="ag-out-s">{outcome.tasksCreated.length ? outcome.tasksDone + " done" : "None created"}</span>
            </div>
            <div className="ag-out-tile">
              <span className="ag-out-l">Time saved</span>
              <span className="ag-out-v ag-out-v--muted">Not measured</span>
              <span className="ag-out-s">No defined measure</span>
            </div>
          </div>
        ) : <Empty title="No outcomes" body="Nothing this agent did is recorded in your scope." />}
        <div className="ag-def-note">Only outcomes recorded in the audit trail count, within your current scope.</div>
      </Section>

      <Section label="Open work from this agent">
        {tasks.length + issues.length === 0 ? (
          <Empty title="Nothing open" body={"No open " + T.tasks.toLowerCase() + " or data issues created by " + agent.name + " in your current scope."} />
        ) : (
          <div className="pk-list">
            {tasks.map((t) => (
              <button key={t.id} className="pk-li pk-li--btn" onClick={() => go(() => openObject("task", t.id))}>
                <Chip plain>{T.task}</Chip>
                <span className="pk-grow ag-ellipsis">{t.title}</span>
                <Chip tone={toneOf.task(t.status, q.isOverdue(t))}>{q.isOverdue(t) ? "Overdue" : LABEL.task[t.status]}</Chip>
              </button>
            ))}
            {issues.map((i) => (
              <button key={i.id} className="pk-li pk-li--btn" onClick={() => go(() => openObject("issue", i.id))}>
                <Chip plain>Data issue</Chip>
                <span className="pk-grow ag-ellipsis">{i.title}</span>
                <Chip tone={ISSUE_STATE_TONE[i.state]}>{ISSUE_STATE_LABEL[i.state]}</Chip>
              </button>
            ))}
          </div>
        )}
        <div className="ag-def-note">Work an agent creates is ordinary work: the same {T.tasks.toLowerCase()}, {T.requests.toLowerCase()} and approvals people use, with a human owner. An agent never sees more than the person asking it.</div>
      </Section>
    </SidePanel>
  );
}
