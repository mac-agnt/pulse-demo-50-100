/* Agents workspace. The top bar draws the tabs; this page reads v.section:
   organisation (default, the chart), runs, templates. Agent details, run
   details and the Add agent flow open as side panels over the current view,
   so the chart keeps its position when a panel closes. Links from elsewhere
   (openObject("agent" | "agentRun", id)) arrive through the session focus. */

import { useEffect, useMemo, useState } from "react";
import { navigate, store, useCore, type Id } from "../../core";
import { Btn, PageFrame, Panel } from "../frame";
import { AddAgentPanel } from "./AddAgentPanel";
import { AgentPanel } from "./AgentPanel";
import { OrgView } from "./OrgView";
import { RunPanel } from "./RunPanel";
import { RunsView } from "./RunsView";
import { TemplatesView } from "./TemplatesView";
import type { AgentNav, PanelMode, PanelTab } from "./shared";
import "../../styles/agents.css";

type PanelState =
  | { kind: "agent"; id: Id; tab: PanelTab; mode: PanelMode; n: number }
  | { kind: "run"; id: Id; back?: Id }
  | { kind: "add"; coordinatorId?: Id | null; templateId?: string; n: number }
  | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AgentsPage({ v }: { v?: any }) {
  const { core, session } = useCore();
  const section: string = v?.section === "runs" || v?.section === "templates" ? v.section : "organisation";
  const [panel, setPanel] = useState<PanelState>(null);

  const nav: AgentNav = useMemo(() => ({
    openAgent: (id, tab = "overview", mode = null) => setPanel({ kind: "agent", id, tab, mode, n: Date.now() }),
    addAgent: (coordinatorId, templateId) => setPanel({ kind: "add", coordinatorId, templateId, n: Date.now() }),
    openRun: (id) => setPanel((p) => ({ kind: "run", id, back: p?.kind === "agent" ? p.id : p?.kind === "run" ? p.back : undefined }))
  }), []);

  useEffect(() => {
    const f = session.focus;
    if (!f || !f.id) return;
    if (f.kind === "agent") nav.openAgent(f.id);
    else if (f.kind === "agentRun") nav.openRun(f.id);
    else return;
    store.setSession({ focus: null });
  }, [session.focus]);

  if (!core.config.capabilities.agents) {
    return (
      <PageFrame>
        <Panel style={{ marginTop: 40 }}>
          <div className="pf-empty" style={{ borderTop: 0 }}>
            <b>Agents are switched off</b>
            <span>This organisation has the agents capability turned off. An administrator can switch it on in Settings, under Enabled views.</span>
            <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ page: "Settings", section: "views" })}>Open Enabled views</Btn></div>
          </div>
        </Panel>
      </PageFrame>
    );
  }

  return (
    <div className="pk ag-page">
      <PageFrame wide>
        {section === "runs" ? <RunsView nav={nav} /> : section === "templates" ? <TemplatesView nav={nav} />
          : <OrgView nav={nav} selectedId={panel?.kind === "agent" ? panel.id : null} />}
      </PageFrame>
      {panel?.kind === "agent" && <AgentPanel key={panel.id + panel.n} agentId={panel.id} tab={panel.tab} mode={panel.mode} onClose={() => setPanel(null)} nav={nav} />}
      {panel?.kind === "run" && <RunPanel key={panel.id} runId={panel.id} nav={nav}
        onClose={() => setPanel(panel.back ? { kind: "agent", id: panel.back, tab: "runs", mode: null, n: Date.now() } : null)} />}
      {panel?.kind === "add" && <AddAgentPanel key={panel.n} coordinatorId={panel.coordinatorId} templateId={panel.templateId} onClose={() => setPanel(null)} nav={nav} />}
    </div>
  );
}
