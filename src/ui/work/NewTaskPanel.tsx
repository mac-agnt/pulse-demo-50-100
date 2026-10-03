/* Create a task. Members can leave it in the team queue or take it
   themselves; managers of the team can assign it to a member. */

import { useState } from "react";
import { useCore, ops } from "../../core";
import type { Priority } from "../../core";
import { Button, Field, LABEL, Select, SidePanel, TextArea, TextInput } from "../kit";
import { endOfDay, InlineError, useClock, useRunner, useViewer } from "./shared";

export function NewTaskPanel({ onClose, onCreated, defaultDue }: { onClose: () => void; onCreated: (id: string) => void; defaultDue?: string }) {
  const { core, q } = useCore();
  const { v, me, can: canDo, oversees } = useViewer();
  const { tz } = useClock();
  const { err, run } = useRunner();
  const teamIds = v.isOrgWide ? core.config.teams.map((t) => t.id) : [...new Set([...v.memberTeamIds, ...v.overseenTeamIds])];
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState(teamIds[0] || "");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState(defaultDue || "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [checklist, setChecklist] = useState("");
  const [criteria, setCriteria] = useState("");
  const [tried, setTried] = useState(false);

  const manages = canDo("tasks.manage") && (oversees(teamId) || !teamId);
  const members = teamId
    ? core.data.memberships.filter((m) => m.teamId === teamId).map((m) => m.personId)
    : core.data.people.filter((p) => p.kind === "staff").map((p) => p.id);
  const activeMembers = members.filter((id) => core.data.people.some((p) => p.id === id && p.status === "active"));
  const assigneeOptions = manages
    ? [{ value: "", label: "Leave in the team queue" }, ...activeMembers.map((id) => ({ value: id, label: q.name(id) + (id === me ? " (you)" : "") }))]
    : [{ value: "", label: "Leave in the team queue" }, { value: me, label: "Assign to me" }];

  const titleErr = tried && !title.trim() ? "Give the task a title." : null;

  const create = () => {
    setTried(true);
    if (!title.trim()) return;
    const res = run(ops.createTask, {
      title, teamId: teamId || undefined, assigneeId: assignee || null, priority,
      dueAt: due ? endOfDay(due, tz) : undefined,
      checklist: checklist.split("\n").map((l) => l.trim()).filter(Boolean),
      completionCriteria: criteria.trim() || undefined
    });
    if (res.ok && res.id) onCreated(res.id);
  };

  return (
    <SidePanel open onClose={onClose} title="New task" eyebrow="Tasks" width={520}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={create}>Create task</Button></>}>
      <div className="wk-stack">
        <Field label="Title" htmlFor="nt-title" error={titleErr}>
          <TextInput id="nt-title" value={title} onChange={setTitle} invalid={!!titleErr} placeholder="What needs doing" />
        </Field>
        <div className="pk-grid2">
          <Field label="Team" htmlFor="nt-team" help={teamIds.length ? undefined : "No teams are set up yet, so the task has no team."}>
            <Select id="nt-team" value={teamId} onChange={(t) => { setTeamId(t); setAssignee(""); }}
              options={teamIds.length ? teamIds.map((id) => ({ value: id, label: q.teamLabel(id) })) : [{ value: "", label: "No team" }]} />
          </Field>
          <Field label="Assignee" htmlFor="nt-assignee" help={manages ? undefined : "Only a manager of this team can assign work to someone else."}>
            <Select id="nt-assignee" value={assignee} onChange={setAssignee} options={assigneeOptions} />
          </Field>
          <Field label="Due date" htmlFor="nt-due" help={"Due at 17:00 (" + tz + ") on this date."}>
            <TextInput id="nt-due" type="date" value={due} onChange={setDue} />
          </Field>
          <Field label="Priority" htmlFor="nt-priority">
            <Select id="nt-priority" value={priority} onChange={(p) => setPriority(p as Priority)}
              options={["low", "normal", "high", "urgent"].map((p) => ({ value: p, label: LABEL.priority[p] }))} />
          </Field>
        </div>
        <Field label="Checklist" htmlFor="nt-check" help="One item per line. Every item must be ticked before the task can be marked done.">
          <TextArea id="nt-check" value={checklist} onChange={setChecklist} rows={3} />
        </Field>
        <Field label="Completion criteria" htmlFor="nt-criteria" help="What done looks like, so whoever picks it up knows when to stop.">
          <TextArea id="nt-criteria" value={criteria} onChange={setCriteria} rows={2} />
        </Field>
        <InlineError text={err} />
      </div>
    </SidePanel>
  );
}
