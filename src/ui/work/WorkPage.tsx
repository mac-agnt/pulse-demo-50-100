/* Work. The top bar picks the section (v.workSectionId): My work, Team work,
   Requests, Approvals, Workflows or Calendar. People moved to its own module;
   PulseLogic redirects old Work > People links. This page renders the chosen
   section and hosts one side panel at a time, so links between a task, its
   request, a run, a schedule and an appointment open the same canonical
   objects. */

import { useEffect, useState } from "react";
import { useCore, store } from "../../core";
import { PageFrame } from "../frame";
import { MyWorkView, TeamWorkView } from "./TasksView";
import ApprovalsView from "./ApprovalsView";
import RequestsView from "./RequestsView";
import WorkflowsView from "./WorkflowsView";
import CalendarView from "./CalendarView";
import { NewSchedulePanel } from "./NewSchedulePanel";
import { TaskPanel } from "./TaskPanel";
import { NewTaskPanel } from "./NewTaskPanel";
import { RequestForm } from "./RequestForm";
import { ApprovalPanel } from "./ApprovalPanel";
import { RunPanel, TemplatePanel } from "./RunPanel";
import { SchedulePanel } from "./SchedulePanel";
import { AppointmentPanel } from "./AppointmentPanel";
import type { PanelState } from "./shared";

const OWNED = ["task", "approval", "request", "run", "schedule", "appointment"] as const;

export type WorkSection = "mine" | "team" | "requests" | "approvals" | "workflows" | "calendar";

/** Current section ids, plus the older ones saved links may still use. */
export function workSectionOf(id?: string): WorkSection {
  if (id === "team" || id === "requests" || id === "approvals" || id === "workflows" || id === "calendar") return id;
  if (id === "schedules") return "calendar";
  return "mine";
}

export default function WorkPage({ v }: { v: { workSectionId?: string; section?: string; setWorkSection?: (id: string) => void } }) {
  const { core, session } = useCore();
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [onlyTasks, setOnlyTasks] = useState<{ ids: string[]; label: string } | null>(null);
  const section = workSectionOf(v.workSectionId);

  // Focus hand-off from other pages: open the panel, then clear the focus.
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "ids" && f.ids) {
      setOnlyTasks({ ids: f.ids, label: f.label || "another page" });
      store.setSession({ focus: null });
      if (section !== "team") v.setWorkSection?.("team");
      return;
    }
    if (!f || !f.id || !(OWNED as readonly string[]).includes(f.kind)) return;
    setPanel({ kind: f.kind as PanelState["kind"], id: f.id });
    store.setSession({ focus: null });
  }, [session.focus]);

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
          : section === "requests" ? <RequestsView openPanel={setPanel} selected={selected} />
          : section === "workflows" ? <WorkflowsView openPanel={setPanel} selected={selected} />
          : section === "calendar" ? <CalendarView openPanel={setPanel} selected={selected} />
          : section === "team" ? <TeamWorkView openPanel={setPanel} selected={selected} only={onlyTasks} clearOnly={() => setOnlyTasks(null)} />
          : <MyWorkView openPanel={setPanel} selected={selected} />}
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
      {panel?.kind === "appointment" && panel.id && <AppointmentPanel key={panel.id} appointmentId={panel.id} onClose={close} />}
      {panel?.kind === "newAppointment" && <AppointmentPanel defaultDay={panel.due} onClose={close} />}
    </div>
  );
}

function Off({ label }: { label: string }) {
  return (
    <div className="wk-card wk-ap-empty" role="status" style={{ marginTop: 24 }}>
      <b>{label} are switched off</b>
      <span>An administrator can switch them on in Settings, Experience, Enabled views.</span>
    </div>
  );
}
