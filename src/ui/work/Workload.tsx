/* Open work by person, for managers. Built from the actual open tasks in the
   teams the viewer oversees. Listed by name, never ranked: it helps balance
   work and is not a measure of anyone's performance. */

import { useCore, scopeTeams } from "../../core";
import type { Id } from "../../core";
import { Card, Empty, Notice, PersonName } from "../kit";
import { useViewer } from "./shared";

export function Workload({ onPick }: { onPick: (personId: string) => void }) {
  const { core, ctx, q } = useCore();
  const { v } = useViewer();
  let teams: Id[] = v.isOrgWide ? core.config.teams.map((t) => t.id) : v.overseenTeamIds;
  const sc = scopeTeams(core, ctx.scope);
  if (sc) teams = teams.filter((t) => sc.includes(t));

  const tasks = q.tasks({ ignoreScope: true }).filter((t) => q.isOpenTask(t) && !!t.teamId && teams.includes(t.teamId));
  const people = new Set<Id>(core.data.memberships.filter((m) => teams.includes(m.teamId)).map((m) => m.personId));
  tasks.forEach((t) => { if (t.assigneeId) people.add(t.assigneeId); });
  const rows = [...people]
    .filter((id) => core.data.people.some((p) => p.id === id && p.kind === "staff") || id.startsWith("ag-"))
    .map((id) => {
      const mine = tasks.filter((t) => t.assigneeId === id);
      const teamIds = core.data.memberships.filter((m) => m.personId === id && teams.includes(m.teamId)).map((m) => m.teamId);
      return { id, name: q.name(id), teams: teamIds.map((t) => q.teamLabel(t)).join(", ") || "Not a member", open: mine.length, overdue: mine.filter((t) => q.isOverdue(t)).length };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const unassigned = tasks.filter((t) => !t.assigneeId);

  if (!teams.length) {
    return <Card><Empty title="No teams to show" body="Open work by person covers the teams you oversee. Pick a team or unit you oversee in the scope control, or ask an administrator to set up teams in Settings." /></Card>;
  }

  return (
    <Card title="Open work by person" right={<span className="wk-small">{teams.map((t) => q.teamLabel(t)).join(", ")}</span>}>
      <div style={{ padding: "12px 14px 0" }}>
        <Notice>Counts of open tasks, to help balance work across the team. This is not a performance measure, and people are listed by name, not ranked.</Notice>
      </div>
      {rows.length === 0 ? <Empty title="No people in these teams yet" body="Add members to the team in Settings > People & access." /> : (
        <div className="pk-table-wrap" style={{ marginTop: 10 }}>
          <table className="pk-table" aria-label="Open work by person">
            <thead><tr><th>Person</th><th>Teams</th><th style={{ textAlign: "right" }}>Open</th><th style={{ textAlign: "right" }}>Overdue</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="pk-row" tabIndex={0} title={"Show " + r.name + "'s open tasks"}
                  onClick={() => onPick(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.id); } }}>
                  <td className="pk-strong"><PersonName id={r.id} /></td>
                  <td>{r.teams}</td>
                  <td style={{ textAlign: "right" }} className="pk-mono">{r.open}</td>
                  <td style={{ textAlign: "right", color: r.overdue ? "var(--bad)" : undefined }} className="pk-mono">{r.overdue ? r.overdue + " overdue" : "0"}</td>
                </tr>
              ))}
              <tr className="pk-row" tabIndex={0} onClick={() => onPick("none")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick("none"); } }}>
                <td className="pk-strong">Unassigned (team queues)</td>
                <td>{teams.map((t) => q.teamLabel(t)).join(", ")}</td>
                <td style={{ textAlign: "right" }} className="pk-mono">{unassigned.length}</td>
                <td style={{ textAlign: "right" }} className="pk-mono">{unassigned.filter((t) => q.isOverdue(t)).length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="pk-tfoot">Select a row to see those tasks in the In scope queue.</div>
    </Card>
  );
}
