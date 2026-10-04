/* The comparison table: one measure, like for like, across units (or teams).
   Every row uses the same measure, the same period and its own totals, with
   actual, target, variance, trend against the previous period, the owner and
   the last update. The totals row is the scope-level figure, never an average
   of the rows. Rows open the unit profile; every number opens the working. */

import type { ReactNode } from "react";
import { compareMetric, formatMetric, relative, scopeLabel, type CoreState, type Ctx, type MetricDef, type ScopeSel } from "../../core";
import { FilterChip } from "../frame";
import { CardHead, EmptyNote, Flag, Glass, GridTable } from "./parts";
import { COMPARE_COLS, dashStore, deltaText, metricView, useDashCore, useDashState, type CompareCol, type MetricView } from "./state";

export interface CompRow { key: string; label: string; scope: ScopeSel; ownerId?: string; planned: boolean; view: MetricView | null }

const COL_LABEL: Record<CompareCol, string> = { actual: "Actual", target: "Target", variance: "Variance", trend: "Trend", owner: "Owner", updated: "Last update" };

/** Rows for one measure: units when there are several, else teams. */
export function comparisonRows(core: CoreState, ctx: Ctx, def: MetricDef | undefined): { by: "unit" | "team"; rows: CompRow[]; total: MetricView | null } {
  if (!def) return { by: "team", rows: [], total: null };
  const units = core.config.capabilities.units ? compareMetric(core, ctx, def.id, "unit") : [];
  const by: "unit" | "team" = units.length > 1 ? "unit" : "team";
  const parts = by === "unit" ? units : compareMetric(core, ctx, def.id, "team");
  const teamOwner = (id: string) => {
    const t = core.config.teams.find((x) => x.id === id);
    return t?.ownerId || core.data.roleAssignments.find((r) => r.scope.kind === "team" && r.scope.teamId === id && r.roleId !== "contributor")?.personId;
  };
  const unitOwner = (id: string) => core.config.units.find((u) => u.id === id)?.ownerId
    || core.data.roleAssignments.find((r) => r.scope.kind === "unit" && r.scope.unitId === id && r.roleId !== "contributor")?.personId;
  const rows = parts.map((p) => {
    const id = p.scope.kind === "unit" || p.scope.kind === "team" ? p.scope.id : "";
    return {
      key: p.key, label: p.label, scope: p.scope,
      ownerId: by === "unit" ? unitOwner(id) : teamOwner(id),
      planned: by === "unit" && core.config.units.find((u) => u.id === id)?.status === "planned",
      view: metricView(core, { ...ctx, scope: p.scope }, def.id)
    };
  });
  return { by, rows, total: metricView(core, ctx, def.id) };
}

function variance(def: MetricDef, v: MetricView | null): { text: string; tone: "ok" | "bad" | "neutral"; n: number | null } {
  if (!v || v.noData || v.result.value === null || def.target === undefined) return { text: def.target === undefined ? "No target" : "No data", tone: "neutral", n: null };
  const d = v.result.value - def.target;
  const good = def.better === "up" ? d >= 0 : d <= 0;
  const mag = Math.abs(d);
  const amount = def.unit === "percent" ? (Math.round(mag * 10) / 10) + " pts" : formatMetric(def, mag);
  return { text: Math.abs(d) < 1e-9 ? "On target" : (d > 0 ? "+" : "-") + amount, tone: Math.abs(d) < 1e-9 ? "ok" : good ? "ok" : "bad", n: d };
}

function Actual({ v, onOpen }: { v: MetricView | null; onOpen: () => void }) {
  if (!v) return <span style={{ color: "var(--faint)" }}>None</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <button type="button" className="db-link" style={{ color: v.noData ? "var(--faint)" : "var(--ink)", fontSize: 14 }} title={v.explanation || "Open the working"}
        onClick={(e) => { e.stopPropagation(); onOpen(); }}>{v.display}</button>
      {v.result.partial && <Flag title={v.result.missing.map((m) => m.label + ": " + m.reason).join(" ") || "Some contributors could not be counted"}>Partial</Flag>}
      {v.result.stale && <Flag title="Some source data is older than 24 hours">Stale</Flag>}
    </span>
  );
}

/** The table. Sort, columns and the compared measure live in the dashboard state, so saved views keep them. */
export function CompareTable({ defs, onRow }: { defs: MetricDef[]; onRow: (row: CompRow) => void }) {
  const { core, ctx, q } = useDashCore();
  const st = useDashState();
  const def = defs.find((d) => d.id === st.compareMetric) || defs[0];
  const data = comparisonRows(core, ctx, def);
  const T = core.config.terminology;
  const noun = data.by === "unit" ? T.unit : T.team;
  const scopeName = scopeLabel(core, ctx.scope);
  const cols = COMPARE_COLS.filter((c) => st.columns.includes(c));
  const sort = st.sort;
  const val = (r: CompRow, k: CompareCol | "row"): string | number => {
    if (k === "row") return r.label;
    if (k === "actual") return r.view?.result.value ?? -Infinity;
    if (k === "variance") return def ? variance(def, r.view).n ?? -Infinity : 0;
    if (k === "trend") return r.view?.result.delta ?? -Infinity;
    if (k === "owner") return q.name(r.ownerId);
    if (k === "updated") return r.view?.result.freshness.at || "";
    return 0;
  };
  const rows = sort ? [...data.rows].sort((a, b) => {
    const x = val(a, sort.key), y = val(b, sort.key);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return sort.dir === "asc" ? c : -c;
  }) : data.rows;
  /* A row's number opens the working for that row's own scope; the total opens it for the selected scope. */
  const openMetric = (scope?: ScopeSel) => { if (def) dashStore.set({ metricId: def.id, metricScope: scope || null }); };

  const cell = (r: CompRow | null, c: CompareCol, v: MetricView | null): ReactNode => {
    if (!def) return null;
    switch (c) {
      case "actual": return <Actual v={v} onOpen={() => openMetric(r?.scope)} />;
      case "target": return def.target !== undefined ? formatMetric(def, def.target) + (def.better === "up" ? " or more" : " or less") : <span style={{ color: "var(--faint)" }}>None set</span>;
      case "variance": { const x = variance(def, v); return <span style={{ color: x.tone === "bad" ? "var(--bad)" : x.tone === "ok" ? "var(--ok)" : "var(--faint)" }}>{x.text}</span>; }
      case "trend": {
        if (!v || v.noData) return <span style={{ color: "var(--faint)" }}>No data</span>;
        if (!def.periodDays) return <span style={{ color: "var(--faint)" }}>Snapshot</span>;
        const d = deltaText(v.result);
        if (!d) return <span style={{ color: "var(--faint)" }}>{v.result.previous?.value === null || !v.result.previous ? "No earlier data" : "No change"}</span>;
        const good = (v.result.delta! > 0 && def.better === "up") || (v.result.delta! < 0 && def.better === "down");
        return <span style={{ color: good ? "var(--ok)" : "var(--bad)" }} title={"Against the previous " + def.periodDays + " days"}>{(v.result.delta! > 0 ? "Up " : "Down ") + d.replace(/^[+-]/, "")}</span>;
      }
      case "owner": return r ? (r.ownerId ? q.name(r.ownerId) : <span style={{ color: "var(--faint)" }}>None set</span>) : "";
      case "updated": return v ? <span title={v.result.freshness.label}>{v.result.freshness.at ? relative(v.result.freshness.at, ctx.now, core.config.timezone) : v.result.freshness.label}</span> : "";
    }
  };

  const setSort = (key: CompareCol | "row") => dashStore.set({ sort: sort?.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "row" || key === "owner" ? "asc" : "desc" } });
  const head = (key: CompareCol | "row", label: string) => (
    <button type="button" className="db-sort" onClick={() => setSort(key)} aria-label={"Sort by " + label}>
      {label}{sort?.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
  const template = "minmax(150px,1.4fr) " + cols.map((c) => c === "owner" || c === "updated" ? "minmax(120px,1fr)" : "minmax(100px,.8fr)").join(" ");

  return (
    <Glass style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}><CardHead title={"Compared by " + noun.toLowerCase()} unit={scopeName.toUpperCase() + (def ? " · " + def.label.toUpperCase() : "")} /></div>
        {defs.length > 1 && <FilterChip label="Measure compared" value={def?.id || ""} onChange={(id) => dashStore.set({ compareMetric: id })} options={defs.map((d) => ({ value: d.id, label: d.label }))} />}
        <FilterChip label="Columns" value="" onChange={(c) => { if (!c) return; const k = c as CompareCol; dashStore.set({ columns: st.columns.includes(k) ? st.columns.filter((x) => x !== k) : [...st.columns, k] }); }}
          options={[{ value: "", label: "Columns (" + cols.length + ")" }, ...COMPARE_COLS.map((c) => ({ value: c, label: (st.columns.includes(c) ? "Hide " : "Show ") + COL_LABEL[c].toLowerCase() }))]} />
      </div>
      {!def ? (
        <EmptyNote title="No measures in this view" body="An administrator can choose this view's measures in Settings, under role dashboards." />
      ) : data.rows.length === 0 ? (
        <EmptyNote title={"No " + (data.by === "unit" ? T.units : T.teams).toLowerCase() + " to compare"}
          body={ctx.scope.kind === "personal" ? "Your own work has no breakdown. Pick a " + T.team.toLowerCase() + " or " + T.unit.toLowerCase() + " in the scope control." : "No " + (data.by === "unit" ? T.units : T.teams).toLowerCase() + " are set up in this scope yet."} />
      ) : (
        <>
          <GridTable caption={def.label + " by " + noun.toLowerCase()} template={template} minWidth={150 + cols.length * 120}
            cols={[head("row", noun), ...cols.map((c) => head(c, COL_LABEL[c]))]}
            rows={[
              ...rows.map((r) => ({
                key: r.key, label: "Open the profile of " + r.label, onClick: () => onRow(r),
                cells: [
                  <span style={{ color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                    {r.planned && <span className="db-flag db-flag--muted" title="Planned: not yet operating, so not compared">PLANNED</span>}
                  </span>,
                  ...cols.map((c) => r.planned && c !== "owner" ? <span style={{ color: "var(--faint)" }}>Not compared</span> : cell(r, c, r.view))
                ]
              })),
              { key: "total", total: true, cells: [<span style={{ color: "var(--ink)", fontWeight: 500 }}>Total, {scopeName}</span>, ...cols.map((c) => c === "owner" ? "" : cell(null, c, data.total))] }
            ]} />
          <div className="db-foot-note">Same measure and period for every row ({def.periodDays ? "last " + def.periodDays + " days" : "snapshot now"}). The total is calculated from the scope's own totals, never averaged across rows. Select a row for its profile.</div>
        </>
      )}
    </Glass>
  );
}
