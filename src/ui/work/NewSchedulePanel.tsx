/* Set up recurring work: a task produced on a cadence, one instance per
   occurrence. Managers of the team (or operators) only. */

import { useState } from "react";
import { useCore, ops, cadenceLabel, nextOccurrence, fmtDateTime } from "../../core";
import type { Priority, Schedule } from "../../core";
import { Button, Field, LABEL, Select, SidePanel, TextArea, TextInput } from "../kit";
import { InlineError, useRunner, useViewer } from "./shared";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function NewSchedulePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { core, ctx } = useCore();
  const { v, can: canDo } = useViewer();
  const { err, run } = useRunner();
  const teamIds = v.isOrgWide ? core.config.teams.map((t) => t.id) : v.overseenTeamIds;
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState(teamIds[0] || "");
  const [every, setEvery] = useState<Schedule["cadence"]["every"]>("week");
  const [weekday, setWeekday] = useState("1");
  const [monthday, setMonthday] = useState("1");
  const [time, setTime] = useState("09:00");
  const [dueIn, setDueIn] = useState("8");
  const [priority, setPriority] = useState<Priority>("normal");
  const [checklist, setChecklist] = useState("");
  const allowed = canDo("tasks.manage") || canDo("workflows.operate");
  const [h, m] = time.split(":").map(Number);
  const cadence: Schedule["cadence"] = { every, hour: h || 0, minute: m || 0, weekday: every === "week" ? Number(weekday) : undefined, monthday: every === "month" ? Number(monthday) : undefined };
  const next = nextOccurrence(cadence, ctx.now, core.config.timezone);

  const save = () => {
    const r = run(ops.createSchedule, { label: label || title, teamId: teamId || undefined, cadence,
      task: { title, priority, checklist: checklist.split("\n").map((x) => x.trim()).filter(Boolean), dueInHours: Number(dueIn) || 8 } });
    if (r.ok && r.id) onCreated(r.id);
  };

  return (
    <SidePanel open onClose={onClose} title="New recurring work" eyebrow="Schedules"
      footer={<><span className="pk-help pk-grow">Each occurrence creates one task in the team queue. Repeats never duplicate.</span>
        <Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!allowed} title={allowed ? undefined : "Only a manager can set up recurring work."} onClick={save}>Set up</Button></>}>
      {!allowed && <p className="pk-help">Only a manager or workflow operator can set up recurring work. You can still schedule a one-off task.</p>}
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Task title"><TextInput value={title} onChange={setTitle} placeholder="For example: Review the team access list" /></Field>
        <Field label="Name in the schedule (optional)"><TextInput value={label} onChange={setLabel} placeholder="Defaults to the task title" /></Field>
        <Field label="Team"><Select value={teamId} onChange={setTeamId} options={teamIds.map((id) => ({ value: id, label: core.config.teams.find((t) => t.id === id)?.label || id }))} /></Field>
        <div className="pk-grid2">
          <Field label="Repeats"><Select value={every} onChange={(x) => setEvery(x as typeof every)} options={[{ value: "day", label: "Every day" }, { value: "week", label: "Every week" }, { value: "month", label: "Every month" }]} /></Field>
          {every === "week" && <Field label="On"><Select value={weekday} onChange={setWeekday} options={DAYS.map((d, i) => ({ value: String(i), label: d }))} /></Field>}
          {every === "month" && <Field label="Day of month"><Select value={monthday} onChange={setMonthday} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} /></Field>}
          <Field label="At"><TextInput type="time" value={time} onChange={setTime} /></Field>
          <Field label="Due after (hours)"><TextInput type="number" value={dueIn} onChange={setDueIn} /></Field>
          <Field label="Priority"><Select value={priority} onChange={(x) => setPriority(x as Priority)} options={(["low", "normal", "high", "urgent"] as Priority[]).map((p) => ({ value: p, label: LABEL.priority[p] }))} /></Field>
        </div>
        <Field label="Checklist (one per line)"><TextArea value={checklist} onChange={setChecklist} rows={3} /></Field>
        <p className="pk-help">{cadenceLabel(cadence, core.config.timezone)}. Next occurrence {fmtDateTime(next, core.config.timezone)}.</p>
        <InlineError text={err} />
      </div>
    </SidePanel>
  );
}
