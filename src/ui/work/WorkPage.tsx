/* Work. The top bar switches between Tasks, Approvals, People and Schedules
   (v.workSectionId). Schedules is also the home of automations and workflow
   runs, so an old "workflows" link lands there. This page renders the chosen
   section in the original page frame and hosts one side panel at a time, so
   links between a task, its request, a run and a schedule open the same
   canonical objects. */

import { useEffect, useState } from "react";
import { useCore, store } from "../../core";
import { PageFrame } from "../frame";
import PeoplePage from "../people/PeoplePage";
import TasksView from "./TasksView";
import ApprovalsView from "./ApprovalsView";
import SchedulesView from "./SchedulesView";
import { NewSchedulePanel } from "./NewSchedulePanel";
import { TaskPanel } from "./TaskPanel";
import { NewTaskPanel } from "./NewTaskPanel";
import { RequestForm } from "./RequestForm";
import { ApprovalPanel } from "./ApprovalPanel";
import { RunPanel, TemplatePanel } from "./RunPanel";
import { SchedulePanel } from "./SchedulePanel";
import type { PanelState } from "./shared";

const OWNED = ["task", "approval", "request", "run", "schedule"] as const;

export type WorkSection = "tasks" | "approvals" | "people" | "schedules";

export function workSectionOf(id?: string): WorkSection {
  if (id === "approvals" || id === "people" || id === "schedules") return id;
  if (id === "workflows") return "schedules";
  return "tasks";
}

export default function WorkPage({ v }: { v: { workSectionId?: string } }) {
  const { core, session } = useCore();
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [onlyTasks, setOnlyTasks] = useState<{ ids: string[]; label: string } | null>(null);
  const section = workSectionOf(v.workSectionId);

  // Focus hand-off from other pages: open the panel, then clear the focus.
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "ids" && f.ids) { setOnlyTasks({ ids: f.ids, label: f.label || "another page" }); store.setSession({ focus: null }); return; }
    if (!f || !f.id || !(OWNED as readonly string[]).includes(f.kind)) return;
    setPanel({ kind: f.kind as PanelState["kind"], id: f.id });
    store.setSession({ focus: null });
  }, [session.focus]);

  if (section === "people") return <PeoplePage v={v} />;

  const close = () => setPanel(null);
  const caps = core.config.capabilities;

  // Highlight the row whose panel is open.
  const selected = !panel?.id ? null
    : panel.kind === "approval" ? core.data.approvals.find((a) => a.id === panel.id)?.requestId || null
    : panel.id;

  return (
    <div className="pk">
      <PageFrame>
        {section === "approvals" ? (caps.approvals === false ? <Off label="Approvals" /> : <ApprovalsView openPanel={setPanel} selected={selected} />)
          : section === "schedules" ? <SchedulesView openPanel={setPanel} selected={selected} />
          : <TasksView openPanel={setPanel} selected={selected} only={onlyTasks} clearOnly={() => setOnlyTasks(null)} />}
      </PageFrame>

      {panel?.kind === "task" && panel.id && <TaskPanel key={panel.id} taskId={panel.id} onClose={close} onOpen={setPanel} />}
      {panel?.kind === "newSchedule" && <NewSchedulePanel onClose={close} onCreated={(id) => setPanel({ kind: "schedule", id })} />}
      {panel?.kind === "newTask" && <NewTaskPanel defaultDue={panel.due} onClose={close} onCreated={(id) => setPanel({ kind: "task", id })} />}
      {panel?.kind === "newRequest" && <RequestForm onClose={close} onCreated={(id) => setPanel({ kind: "request", id })} />}
      {panel?.kind === "approval" && panel.id && <ApprovalPanel key={panel.id + (panel.intent || "")} approvalId={panel.id} focusDecision={panel.intent === "decide"} onClose={close} onOpen={setPanel} />}
      {panel?.kind === "request" && panel.id && <ApprovalPanel key={panel.id} requestId={panel.id} onClose={close} onOpen={setPanel} />}
      {panel?.kind === "run" && panel.id && <RunPanel key={panel.id} runId={panel.id} onClose={close} onOpen={setPanel} />}
      {panel?.kind === "template" && panel.id && <TemplatePanel key={panel.id} templateId={panel.id} onClose={close} />}
      {panel?.kind === "schedule" && panel.id && <SchedulePanel key={panel.id} scheduleId={panel.id} onClose={close} onOpen={setPanel} />}
    </div>
  );
}

function Off({ label }: { label: string }) {
  return (
    <div className="wk-card wk-ap-empty" role="status" style={{ marginTop: 24 }}>
      <b>{label} are switched off</b>
      <span>An administrator can switch them on in Settings &gt; Experience &gt; Enabled views.</span>
    </div>
  );
}
