/* Organisation (the Agents landing view): who exists, what each is
   responsible for, who coordinates whom, who answers for it and what is
   running, waiting or failing now. Chart on desktop, List view for the same
   definitions, collapsible hierarchy on narrow screens. */

import { useMemo, useState } from "react";
import AgentFace from "../../components/AgentFace";
import { agentState, availabilityOf, can, scopeLabel, useCore, visibleRuns, RUN_STATE_LABEL, type AgentDef, type Id } from "../../core";
import { Btn, FilterChip, SegTabs, eyebrowOf } from "../frame";
import { Icon, useNarrow } from "../kit";
import { OrgChart } from "./OrgChart";
import { OrgList } from "./OrgList";
import { AG_ICON, type AgentNav } from "./shared";

type Status = "all" | "ready" | "draft" | "paused" | "connection_required" | "running" | "waiting" | "failed" | "archived";

/* View choices survive switching tabs. */
const kept = { mode: "chart" as "chart" | "list", collapsed: new Set<Id>(), groups: new Set<Id>() };

export function OrgView({ nav, selectedId }: { nav: AgentNav; selectedId: Id | null }) {
  const { core, ctx, q } = useCore();
  const narrow = useNarrow();
  const [mode, setModeState] = useState(kept.mode);
  const [collapsed, setCollapsed] = useState<Set<Id>>(kept.collapsed);
  const [groups, setGroups] = useState<Set<Id>>(kept.groups);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [scope, setScope] = useState("all");
  const [overlay, setOverlay] = useState("");
  const [fitSignal, setFitSignal] = useState(0);
  const setMode = (m: "chart" | "list") => { kept.mode = m; setModeState(m); };
  const toggle = (id: Id) => { const n = new Set(collapsed); if (n.has(id)) n.delete(id); else n.add(id); kept.collapsed = n; setCollapsed(n); };
  const expandGroup = (id: Id) => { const n = new Set(groups).add(id); kept.groups = n; setGroups(n); };
  const canManage = can(q.viewer, "agents.manage");

  const all = core.config.agents;
  const shown = useMemo(() => all.filter((a) => (status === "archived" ? true : !a.archived)), [all, status]);
  const isMatch = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (a: AgentDef) => {
      if (needle && !(a.name + " " + a.purpose + " " + q.name(a.responsibleId)).toLowerCase().includes(needle)) return false;
      if (scope !== "all" && a.scope.teamIds !== "all" && !a.scope.teamIds.includes(scope)) return false;
      if (status === "all") return true;
      if (status === "archived") return !!a.archived;
      const w = agentState(q, a.id);
      if (status === "running") return w.running > 0;
      if (status === "waiting") return w.waitingApproval + w.waitingInput + w.stopRequested > 0;
      if (status === "failed") return w.failed > 0;
      return !a.archived && availabilityOf(a) === status;
    };
  }, [query, scope, status, q]);
  const filtering = !!query.trim() || scope !== "all" || status !== "all";
  const hits = useMemo(() => new Set(filtering ? shown.filter(isMatch).map((a) => a.id) : []), [filtering, shown, isMatch]);
  // Matches inside a collapsed branch open it.
  const forceOpen = useMemo(() => {
    const out = new Set<Id>();
    for (const id of hits) {
      let cur = core.config.agents.find((a) => a.id === id)?.coordinatorId;
      let guard = 0;
      while (cur && guard++ < 20) { out.add(cur); cur = core.config.agents.find((a) => a.id === cur)?.coordinatorId; }
    }
    return out;
  }, [hits, core]);

  const runs = visibleRuns(q, { ignoreScope: true }).filter((r) => !r.parentRunId && (r.childRunIds.length || r.workers.length));
  const live = all.filter((a) => !a.archived);
  const counts = live.reduce((c, a) => { const w = agentState(q, a.id); c.running += w.running; c.waiting += w.waitingApproval + w.waitingInput; c.failed += w.failed; return c; }, { running: 0, waiting: 0, failed: 0 });

  const header = (
    <div className="ag-head">
      <div className="pk-grow">
        <div className="pf-eyebrow">{eyebrowOf("Agents", "Organisation", scopeLabel(core, ctx.scope))}</div>
        <h1 className="ag-title">Organisation</h1>
        <div className="ag-sub">
          {live.length} agent{live.length === 1 ? "" : "s"} · {counts.running} running · {counts.waiting} waiting on a person · {counts.failed} failed. Runs are simulated by the local sample engine.
        </div>
      </div>
      <Btn primary onClick={() => nav.addAgent(null)} disabled={!canManage} title={canManage ? undefined : "Adding agents needs the Manage agents permission."}>
        <Icon d={AG_ICON.plus} size={14} sw={2.2} />Add agent
      </Btn>
    </div>
  );

  if (!live.length && status !== "archived") {
    return (
      <>
        {header}
        <div className="ag-empty">
          <AgentFace shape="crown-pebble" tint="#191c1f" state="idle" size={56} />
          <h2>Add your first agent</h2>
          <p>An agent has one responsibility, an accountable person, a scope and the tools it may use. Restricted actions always wait for a person to approve them in Work. Start from a template or from blank; it is saved as a draft and does nothing until you test and activate it.</p>
          <Btn primary onClick={() => nav.addAgent(null)} disabled={!canManage} title={canManage ? undefined : "Adding agents needs the Manage agents permission."}>Add your first agent</Btn>
          {!canManage && <p className="ag-muted">Ask someone with the Manage agents permission to add one.</p>}
        </div>
      </>
    );
  }

  const teams = core.config.teams;
  return (
    <>
      {header}
      <div className="ag-toolbar" role="toolbar" aria-label="Chart tools">
        <label className="ag-search">
          <Icon d={AG_ICON.search} size={13} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents or owners" aria-label="Search agents or owners" />
        </label>
        <FilterChip label="Filter by status" value={status} onChange={(v) => setStatus(v as Status)} options={[
          { value: "all", label: "All statuses" }, { value: "ready", label: "Ready" }, { value: "draft", label: "Draft" }, { value: "paused", label: "Paused" },
          { value: "connection_required", label: "Connection required" }, { value: "running", label: "Running" }, { value: "waiting", label: "Waiting on a person" },
          { value: "failed", label: "Failed" }, { value: "archived", label: "Archived" }]} />
        <FilterChip label="Filter by scope" value={scope} onChange={setScope} options={[{ value: "all", label: "Any scope" }, ...teams.map((t) => ({ value: t.id, label: "Covers " + t.label }))]} />
        {!narrow && mode === "chart" && (
          <FilterChip label="Show a run's delegation" value={overlay} onChange={setOverlay}
            options={[{ value: "", label: "Run overlay off" }, ...runs.map((r) => ({ value: r.id, label: r.ref + " " + r.goal + " (" + RUN_STATE_LABEL[r.state].toLowerCase() + ")" }))]} />
        )}
        <span className="pk-grow" />
        {filtering && <span className="ag-muted" aria-live="polite">{hits.size} match{hits.size === 1 ? "" : "es"}</span>}
        {filtering && <Btn small onClick={() => { setQuery(""); setStatus("all"); setScope("all"); }}>Clear</Btn>}
        {!narrow && <SegTabs label="View" value={mode} onChange={setMode} options={[{ value: "chart", label: "Chart" }, { value: "list", label: "List" }]} />}
      </div>
      {narrow
        ? <OrgList narrow agents={shown} isMatch={isMatch} hits={hits} nav={nav} collapsed={collapsed} onToggle={toggle} forceOpen={forceOpen} />
        : mode === "list"
          ? <OrgList agents={shown} isMatch={isMatch} hits={hits} nav={nav} collapsed={collapsed} onToggle={toggle} forceOpen={forceOpen} />
          : <OrgChart agents={shown} isMatch={isMatch} hits={hits} selectedId={selectedId} overlayRunId={overlay || null} nav={nav} collapsed={collapsed} onToggle={toggle}
              expandedGroups={groups} onExpandGroup={expandGroup} forceOpen={forceOpen} fitSignal={fitSignal} />}
      {!narrow && mode === "chart" && filtering && hits.size === 0 && (
        <div className="ag-muted" role="status" style={{ marginTop: 8 }}>No agent matches. <button type="button" className="ag-link" onClick={() => setFitSignal((n) => n + 1)}>Fit the chart</button> or clear the filters.</div>
      )}
    </>
  );
}
