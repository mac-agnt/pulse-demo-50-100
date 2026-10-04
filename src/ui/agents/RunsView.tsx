/* Runs: every agent run the viewer may see in the selected scope, with goal,
   agent, parent run, scope, who started it, when, how long, state, who it is
   waiting on and the next action. Test runs are shown on request. */

import { useMemo, useState } from "react";
import { RUN_STATE_LABEL, can, fmtDateTime, nextActionOf, runById, runDuration, scopeLabel, scopeText, useCore, visibleRuns, type AgentRun, type Id } from "../../core";
import { Btn, FilterChip, eyebrowOf } from "../frame";
import { Button, DataTable, Empty, Select, SidePanel, type Column } from "../kit";
import { StartRunForm } from "./StartRunForm";
import { RunPill, type AgentNav } from "./shared";

type StateFilter = "all" | "active" | "waiting" | "failed" | "completed" | "cancelled" | "tests";

export function RunsView({ nav }: { nav: AgentNav }) {
  const { core, ctx, q } = useCore();
  const [state, setState] = useState<StateFilter>("all");
  const [agent, setAgent] = useState("");
  const [starting, setStarting] = useState(false);
  const all = useMemo(() => visibleRuns(q, { includeTests: true }), [q]);
  const rows = all.filter((r) => {
    if (agent && r.agentId !== agent) return false;
    if (state === "tests") return !!r.test;
    if (r.test) return false;
    if (state === "active") return ["queued", "planning", "running", "delegated"].includes(r.state);
    if (state === "waiting") return ["waiting_approval", "waiting_input", "stop_requested"].includes(r.state);
    if (state === "failed" || state === "completed" || state === "cancelled") return r.state === state;
    return true;
  });
  const tz = core.config.timezone;
  const initiator = (r: AgentRun) => r.initiator.kind === "person" || r.initiator.kind === "agent" ? q.name(r.initiator.id) : r.initiator.kind === "event" ? "Event (simulated)" : "Schedule (simulated)";
  const columns: Column<AgentRun>[] = [
    { key: "goal", label: "Goal", strong: true, value: (r) => r.goal, render: (r) => <span className="pf-cell2"><span>{r.goal}</span><span>{r.ref}{r.test ? " · test" : ""}</span></span>, width: "26%" },
    { key: "agent", label: "Agent", value: (r) => q.name(r.agentId) },
    { key: "parent", label: "Parent run", priority: 3, value: (r) => runById(core, r.parentRunId)?.ref || "", render: (r) => r.parentRunId ? (runById(core, r.parentRunId)?.ref || "") + " (" + q.name(runById(core, r.parentRunId)?.agentId) + ")" : "None" },
    { key: "scope", label: "Scope", priority: 3, value: (r) => scopeText(core, r.scopeTeamIds) },
    { key: "initiator", label: "Started by", priority: 3, value: initiator },
    { key: "started", label: "Started", value: (r) => r.startedAt, render: (r) => fmtDateTime(r.startedAt, tz) },
    { key: "duration", label: "Duration", priority: 3, value: (r) => (r.endedAt ? Date.parse(r.endedAt) : Date.parse(ctx.now)) - Date.parse(r.startedAt), render: (r) => runDuration(r, ctx.now) },
    { key: "state", label: "State", value: (r) => RUN_STATE_LABEL[r.state], render: (r) => <RunPill run={r} /> },
    { key: "waiting", label: "Waiting on", priority: 3, value: (r) => (r.waitingOwnerId && !["completed", "cancelled"].includes(r.state) ? q.name(r.waitingOwnerId) : ""),
      render: (r) => (r.waitingOwnerId && !["completed", "cancelled"].includes(r.state) ? q.name(r.waitingOwnerId) : "Nobody") },
    { key: "next", label: "Next action", priority: 3, value: (r) => nextActionOf(core, r) }
  ];
  const agents = core.config.agents.filter((a) => all.some((r) => r.agentId === a.id));
  const canRun = can(q.viewer, "agents.run");
  const startable = core.config.agents.filter((a) => !a.archived && (a.availability || (a.enabled ? "ready" : "paused")) === "ready");
  const [pick, setPick] = useState("");

  return (
    <>
      <div className="ag-head">
        <div className="pk-grow">
          <div className="pf-eyebrow">{eyebrowOf("Agents", "Runs", scopeLabel(core, ctx.scope))}</div>
          <h1 className="ag-title">Runs</h1>
          <div className="ag-sub">Every run is simulated by the local sample engine. Usage and cost are Unknown because no runtime reports them.</div>
        </div>
        <Btn primary onClick={() => setStarting(true)} disabled={!canRun || !startable.length} title={canRun ? undefined : "Needs the Start agent runs permission."}>Start a run</Btn>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onOpen={(r) => nav.openRun(r.id)} caption="Agent runs" pageSize={10}
        initialSort={{ key: "started", dir: "desc" }} searchText={(r) => r.goal + " " + r.ref + " " + q.name(r.agentId)} searchPlaceholder="Search runs"
        toolbarLeft={<>
          <FilterChip label="Filter by state" value={state} onChange={(v) => setState(v as StateFilter)} options={[
            { value: "all", label: "All states" }, { value: "active", label: "In progress" }, { value: "waiting", label: "Waiting on a person" },
            { value: "failed", label: "Failed" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }, { value: "tests", label: "Test runs" }]} />
          <FilterChip label="Filter by agent" value={agent} onChange={setAgent} options={[{ value: "", label: "All agents" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
        </>}
        empty={<Empty title={all.length ? "No runs match" : "No runs yet"} body={all.length ? "Change or clear the filters." : "Runs you start, own or that touch your teams appear here. Start one from an agent on the Organisation tab."}
          action={all.length ? <Button onClick={() => { setState("all"); setAgent(""); }}>Clear filters</Button> : undefined} />} />
      {starting && (
        <SidePanel open onClose={() => setStarting(false)} title="Start a run" eyebrow="Agents" width={600}>
          <div className="ag-form">
            <Select ariaLabel="Agent" value={pick} onChange={setPick} options={[{ value: "", label: "Choose an agent" }, ...startable.map((a) => ({ value: a.id, label: a.name }))]} />
            {pick && <StartRunForm key={pick} agentId={pick as Id} onDone={(id) => { setStarting(false); nav.openRun(id); }} onCancel={() => setStarting(false)} />}
          </div>
        </SidePanel>
      )}
    </>
  );
}
