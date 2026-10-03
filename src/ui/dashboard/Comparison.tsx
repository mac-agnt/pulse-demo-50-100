/* One comparison: units (or teams) as rows, the view's measures as columns.
   Each cell is computed from that unit's own totals; the totals row is the
   scope-level figure, never an average of the rows. */

import { useState, type ReactNode } from "react";
import { useCore, compareMetric, scopeLabel, type CoreState, type Ctx, type MetricDef, type ScopeSel } from "../../core";
import { Button, Notice, SidePanel } from "../kit";
import { CardHead, EmptyNote, Flag, Glass, GridTable } from "./parts";
import { MetricDetail, MetricStatusChips } from "./MetricPanel";
import { comparison, metricView, type MetricView } from "./state";

export interface CompRow { key: string; label: string; scope: ScopeSel; cells: Record<string, MetricView | null> }

export function comparisonRows(core: CoreState, ctx: Ctx, defs: MetricDef[]): { by: "unit" | "team"; rows: CompRow[]; totals: Record<string, MetricView | null> } {
  const unitsOn = core.config.capabilities.units && defs.length > 0 && compareMetric(core, ctx, defs[0].id, "unit").length > 1;
  const by: "unit" | "team" = unitsOn ? "unit" : "team";
  const rows = new Map<string, CompRow>();
  for (const d of defs) {
    for (const r of compareMetric(core, ctx, d.id, by)) {
      const row = rows.get(r.key) || { key: r.key, label: r.label, scope: r.scope, cells: {} };
      row.cells[d.id] = metricView(core, { ...ctx, scope: r.scope }, d.id);
      rows.set(r.key, row);
    }
  }
  const totals: Record<string, MetricView | null> = {};
  for (const d of defs) totals[d.id] = metricView(core, ctx, d.id);
  return { by, rows: [...rows.values()], totals };
}

function cellOf(v: MetricView | null | undefined): ReactNode {
  if (!v) return <span style={{ color: "var(--faint)" }}>None</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }} title={v.explanation || undefined}>
      <span style={{ color: v.noData ? "var(--faint)" : "var(--ink)" }}>{v.display}</span>
      {v.result.partial && <Flag title={v.result.missing.map((m) => m.label + ": " + m.reason).join(" ")}>Partial</Flag>}
      {v.result.stale && !v.result.partial && <Flag title="Some source data is older than 24 hours">Stale</Flag>}
    </span>
  );
}

/** Units (or teams) against the area's measures, in the original table style. Rows open the unit detail. */
export function CompareTable({ defs, data }: { defs: MetricDef[]; data: ReturnType<typeof comparisonRows> }) {
  const { core, ctx } = useCore();
  const [open, setOpen] = useState<CompRow | null>(null);
  const T = core.config.terminology;
  const noun = data.by === "unit" ? T.units : T.teams;
  const scopeName = scopeLabel(core, ctx.scope);
  const planned = new Set(core.config.units.filter((u) => u.status === "planned").map((u) => "unit:" + u.id));
  const template = "minmax(150px,1.6fr) " + defs.map(() => "minmax(110px,.9fr)").join(" ");

  return (
    <Glass style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 12px" }}>
        <CardHead title={"By " + (data.by === "unit" ? T.unit : T.team).toLowerCase()} unit={scopeName.toUpperCase()} />
      </div>
      {defs.length === 0 ? (
        <EmptyNote title="No measures in this area" body="Choose measures for this area in Settings to compare them." />
      ) : data.rows.length === 0 ? (
        <EmptyNote title={"No " + noun.toLowerCase() + " to compare"}
          body={ctx.scope.kind === "personal"
            ? "Your own work has no " + T.team.toLowerCase() + " breakdown. Pick a " + T.team.toLowerCase() + " or " + T.unit.toLowerCase() + " in the scope control to compare."
            : "No " + noun.toLowerCase() + " are set up in this scope yet. An administrator can add them in Settings under Organisation."} />
      ) : (
        <>
          <GridTable caption={"Measures by " + noun.toLowerCase()} template={template} minWidth={150 + defs.length * 120}
            cols={[data.by === "unit" ? T.unit : T.team, ...defs.map((d) => d.label)]}
            rows={[
              ...data.rows.map((r) => ({
                key: r.key, label: "Open " + r.label + " details", onClick: () => setOpen(r),
                cells: [
                  <span style={{ color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                    {planned.has(r.key) && <span className="db-flag db-flag--muted">PLANNED</span>}
                  </span>,
                  ...defs.map((d) => cellOf(r.cells[d.id]))
                ]
              })),
              { key: "total", total: true, cells: [<span style={{ color: "var(--ink)", fontWeight: 500 }}>Total, {scopeName}</span>, ...defs.map((d) => cellOf(data.totals[d.id]))] }
            ]} />
          <div className="db-foot-note">Totals are calculated from the underlying totals of the scope, never averaged across rows. Select a row for its detail.</div>
        </>
      )}
      <UnitPanel row={open} defs={defs} onClose={() => setOpen(null)} />
    </Glass>
  );
}

/** One unit or team: its measures, each with the objects behind it. */
export function UnitPanel({ row, defs, onClose }: { row: CompRow | null; defs: MetricDef[]; onClose: () => void }) {
  const { core, ctx } = useCore();
  const [metricId, setMetricId] = useState<string | null>(null);
  if (!row) return null;
  const rowCtx: Ctx = { ...ctx, scope: row.scope };
  const pick = metricId && defs.some((d) => d.id === metricId) ? metricId : defs[0]?.id || null;
  const view = pick ? row.cells[pick] || metricView(core, rowCtx, pick) : null;
  return (
    <SidePanel open onClose={() => { setMetricId(null); onClose(); }} width={720}
      eyebrow={row.scope.kind === "unit" ? core.config.terminology.unit : core.config.terminology.team} title={row.label}
      footer={<><span className="pk-grow" /><Button onClick={() => { setMetricId(null); onClose(); }}>Close</Button></>}>
      <ul className="pk-list db-ul" aria-label={"Measures for " + row.label}>
        {defs.map((d) => {
          const v = row.cells[d.id];
          if (!v) return null;
          const cmp = comparison(v.result);
          const on = d.id === pick;
          return (
            <li key={d.id} className="db-li-wrap"><button type="button" className="pk-li pk-li--btn" aria-pressed={on}
              style={on ? { background: "var(--accent-faint)" } : undefined} onClick={() => setMetricId(d.id)}>
              <span className="pk-grow" style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "var(--ink)" }}>{d.label}</span>
                <span className="pk-muted" style={{ display: "block", fontSize: 11.5, marginTop: 2 }}>{v.noData ? v.explanation : cmp.text}</span>
              </span>
              <MetricStatusChips view={v} />
              <span style={{ fontSize: 15, fontWeight: 500, color: v.noData ? "var(--faint)" : "var(--ink)" }}>{v.display}</span>
            </button></li>
          );
        })}
      </ul>
      {view && (
        <div style={{ marginTop: 18 }}>
          <Notice>Showing {view.result.def.label} for {row.label}. Values come from this {(row.scope.kind === "unit" ? core.config.terminology.unit : core.config.terminology.team).toLowerCase()}'s own totals.</Notice>
          <div style={{ marginTop: 12 }}><MetricDetail view={view} ctx={rowCtx} /></div>
        </div>
      )}
    </SidePanel>
  );
}
