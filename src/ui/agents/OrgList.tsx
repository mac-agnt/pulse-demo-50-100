/* The same agent definitions as the chart, as an accessible tree table (List
   view) or, on narrow screens, a collapsible hierarchy. Every chart action is
   available here through the same menu. */

import { useMemo, useState } from "react";
import AgentFace from "../../components/AgentFace";
import { agentState, scopeText, useCore, type AgentDef, type Id } from "../../core";
import { Icon } from "../kit";
import { AG_ICON, ActionMenu, AvailabilityPill, WorkSummary, agentActions, faceState, type AgentNav } from "./shared";

interface Row { a: AgentDef; depth: number; kids: number; open: boolean }

function flatten(agents: AgentDef[], collapsed: Set<Id>, forceOpen: Set<Id>): Row[] {
  const ids = new Set(agents.map((a) => a.id));
  const kidsOf = (id: Id | null) => agents.filter((a) => (id === null ? !a.coordinatorId || !ids.has(a.coordinatorId) : a.coordinatorId === id));
  const out: Row[] = [];
  const seen = new Set<Id>();
  const walk = (a: AgentDef, depth: number) => {
    if (seen.has(a.id)) return;
    seen.add(a.id);
    const kids = kidsOf(a.id);
    const open = !collapsed.has(a.id) || forceOpen.has(a.id);
    out.push({ a, depth, kids: kids.length, open });
    if (open) kids.forEach((k) => walk(k, depth + 1));
  };
  kidsOf(null).forEach((r) => walk(r, 0));
  return out;
}

export function OrgList({ agents, isMatch, hits, nav, collapsed, onToggle, forceOpen, narrow }: {
  agents: AgentDef[]; isMatch: (a: AgentDef) => boolean; hits: Set<Id>; nav: AgentNav; collapsed: Set<Id>; onToggle: (id: Id) => void; forceOpen: Set<Id>; narrow?: boolean;
}) {
  const { core, q } = useCore();
  const [menuFor, setMenuFor] = useState<Id | null>(null);
  const rows = useMemo(() => flatten(agents, collapsed, forceOpen), [agents, collapsed, forceOpen]);
  const T = core.config.terminology;

  if (narrow) {
    return (
      <ul className="ag-tree" role="tree" aria-label="Agents by coordinator">
        {rows.map(({ a, depth, kids, open }) => {
          const w = agentState(q, a.id);
          return (
            <li key={a.id} role="treeitem" aria-level={depth + 1} aria-expanded={kids ? open : undefined} className={"ag-tree-row" + (isMatch(a) ? "" : " ag-node--dim") + (hits.has(a.id) ? " ag-node--hit" : "")}
              style={{ paddingLeft: 10 + depth * 16 }}>
              {kids > 0
                ? <button type="button" className="ag-icon-btn ag-tree-tog" onClick={() => onToggle(a.id)} aria-label={(open ? "Collapse " : "Expand ") + a.name}><Icon d={open ? AG_ICON.chevDown : AG_ICON.chevRight} size={12} sw={2.2} /></button>
                : <span className="ag-tree-tog" aria-hidden="true" />}
              <AgentFace shape={a.shape} tint={a.tint} state={faceState(a, w)} size={30} />
              <button type="button" className="ag-tree-main" onClick={() => nav.openAgent(a.id)}>
                <b>{a.name}</b>
                <span className="ag-tree-sub"><AvailabilityPill agent={a} /><WorkSummary w={w} compact /></span>
              </button>
              <ActionMenu label={"Actions for " + a.name} open={menuFor === a.id} onOpenChange={(o) => setMenuFor(o ? a.id : null)} items={agentActions(core, q, a, nav)} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="pk-card ag-list-card">
      <div className="pk-table-wrap">
        <table className="pk-table ag-list-table" aria-label="Agents by coordinator">
          <thead>
            <tr>
              <th style={{ width: "30%" }}>Agent</th>
              <th>Availability</th>
              <th>Active work</th>
              <th>Accountable owner</th>
              <th>Scope</th>
              <th style={{ width: 52 }}><span className="pk-hide-narrow">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, depth, kids, open }) => {
              const w = agentState(q, a.id);
              return (
                <tr key={a.id} className={"pk-row" + (isMatch(a) ? "" : " ag-node--dim") + (hits.has(a.id) ? " ag-row-hit" : "")} aria-level={depth + 1}>
                  <td>
                    <span className="ag-list-name" style={{ paddingLeft: depth * 22 }}>
                      {kids > 0
                        ? <button type="button" className="ag-icon-btn ag-tree-tog" onClick={() => onToggle(a.id)} aria-expanded={open} aria-label={(open ? "Collapse " : "Expand ") + a.name + ", " + kids + " agent" + (kids === 1 ? "" : "s")}>
                            <Icon d={open ? AG_ICON.chevDown : AG_ICON.chevRight} size={12} sw={2.2} /></button>
                        : <span className="ag-tree-tog" aria-hidden="true" />}
                      <AgentFace shape={a.shape} tint={a.tint} state={faceState(a, w)} size={26} />
                      <button type="button" className="ag-link" onClick={() => nav.openAgent(a.id)}>{a.name}</button>
                    </span>
                  </td>
                  <td><AvailabilityPill agent={a} /></td>
                  <td><WorkSummary w={w} /></td>
                  <td>{q.name(a.responsibleId)}</td>
                  <td>{scopeText(core, a.scope.teamIds)}</td>
                  <td><ActionMenu label={"Actions for " + a.name} open={menuFor === a.id} onOpenChange={(o) => setMenuFor(o ? a.id : null)} items={agentActions(core, q, a, nav)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pk-tfoot"><span className="pk-grow">{rows.length} of {agents.length} agents shown{agents.length > rows.length ? "; expand a branch to see the rest" : ""}. Indentation shows who coordinates whom; it grants no {T.team.toLowerCase()} access or tools.</span></div>
    </div>
  );
}
