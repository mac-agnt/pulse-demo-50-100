/* Shared blocks of the dashboard areas: metric cards, the weekly chart card,
   the "where it came from" split and the navigation hand-offs that open the
   exact objects behind a number. */

import {
  useCore, navigate, openObject, compareMetric,
  type DataIssue, type Id, type MetricDef, type Q, type ScopeSel
} from "../../core";
import { CardHead, ColumnChart, EmptyNote, Glass, MetricCard, SplitFoot, SplitRows, type CardFigure, type SplitRow } from "./parts";
import { weeklySeries, type WeekSeries } from "./series";
import { basisText, dashStore, deltaText, metricView, type MetricView } from "./state";

export function figureOf(v: MetricView): CardFigure {
  const r = v.result;
  const d = deltaText(r);
  const good = r.delta !== null && ((r.delta > 0 && r.def.better === "up") || (r.delta < 0 && r.def.better === "down"));
  const flags = [...(r.partial ? ["Partial"] : []), ...(r.stale ? ["Stale"] : [])];
  return {
    label: r.def.label, value: v.display, noData: v.noData,
    delta: v.noData ? undefined : d || undefined, deltaTone: good ? "ok" : "bad",
    hint: v.noData ? (v.explanation || "No data") : basisText(r), flags, title: v.explanation || r.def.description
  };
}

export const toRecords = (ids: Id[], label: string) => {
  dashStore.set({ metricId: null });
  navigate({ page: "Records", section: "browse", focus: { kind: "ids", ids, label } });
};

export const toIssues = (issues: DataIssue[]) => {
  dashStore.set({ metricId: null });
  if (issues.length === 1) openObject("issue", issues[0].id);
  else navigate({ page: "Records", section: "quality", focus: issues.length ? { kind: "ids", ids: issues.map((i) => i.id), label: "the dashboard" } : null });
};

export const toPeople = () => { dashStore.set({ metricId: null }); navigate({ page: "Work", section: "people" }); };

/** Where a click on a week bar goes, by what the bar counts. */
export function barTarget(series: WeekSeries, q: Q): ((i: number) => void) | undefined {
  if (series.entity === "record") return (i) => toRecords(series.points[i].ids, series.caption + ", week from " + series.points[i].label);
  if (series.entity === "issue") return (i) => { const set = new Set(series.points[i].ids); toIssues(q.issues().filter((x) => set.has(x.id))); };
  if (series.entity === "person") return () => toPeople();
  if (series.entity === "task") return (i) => {
    const ids = series.points[i].ids;
    dashStore.set({ metricId: null });
    if (ids.length === 1) openObject("task", ids[0]);
    else if (ids.length) navigate({ page: "Work", section: "tasks", focus: { kind: "ids", ids, label: series.caption + ", week from " + series.points[i].label } });
  };
  return undefined;
}

export function gridCols(n: number): string {
  return ["1fr", "1.7fr 1fr", "1.7fr 1fr 1fr", "1.7fr 1fr 1fr 1fr"][Math.max(0, Math.min(4, n) - 1)];
}

/** Metric cards of an area: the first is the LEAD card. */
export function MetricCards({ defs }: { defs: MetricDef[] }) {
  const { core, ctx, q } = useCore();
  const shown = defs.slice(0, 4);
  if (!shown.length) return <Glass><EmptyNote title="No measures in this area" body="An administrator can choose this area's measures in Settings, under role dashboards." /></Glass>;
  return (
    <div className="db-mgrid" style={{ ["--cols" as string]: gridCols(shown.length) }}>
      {shown.map((d, i) => {
        const v = metricView(core, ctx, d.id);
        if (!v) return null;
        return <MetricCard key={d.id} fig={figureOf(v)} series={weeklySeries(core, ctx, q, d.id)} hero={i === 0} delay={i * 70}
          onOpen={() => dashStore.set({ metricId: d.id })} />;
      })}
    </div>
  );
}

/** "<metric> by week": the lead measure if it has a period, else the area's first period measure, else the lead's weekly events. */
export function WeekChartCard({ defs }: { defs: MetricDef[] }) {
  const { core, ctx, q } = useCore();
  const def = (defs[0]?.periodDays ? defs[0] : defs.find((d) => d.periodDays > 0)) || defs[0];
  if (!def) return <Glass><CardHead title="By week" /><EmptyNote title="Nothing to chart" body="This area has no measures yet." /></Glass>;
  const series = weeklySeries(core, ctx, q, def.id);
  const v = metricView(core, ctx, def.id);
  const title = series?.rolling ? def.label + " by week" : series ? series.caption : def.label + " by week";
  const any = !!series && series.points.some((p) => p.value !== null && (series.rolling || p.value > 0));
  return (
    <Glass>
      <CardHead title={title} unit={series ? (series.rolling ? series.caption.toUpperCase() : "COUNT") : undefined}
        right={<button type="button" className="db-link" onClick={() => dashStore.set({ metricId: def.id })}>See the working</button>} />
      <div style={{ marginTop: 18 }}>
        {!series || !any || v?.noData ? (
          <EmptyNote title="No data for the last 8 weeks" body={v?.explanation || "Columns appear once there is activity in a week. Nothing is shown as zero that was not counted."} />
        ) : (
          <ColumnChart series={series} onBar={barTarget(series, q)} />
        )}
      </div>
    </Glass>
  );
}

/** "Where it came from": one measure split by unit (or team), with a total from the scope's own totals. */
export function WhereFrom({ def, by, title = "Where it came from", onRow }: { def: MetricDef | undefined; by: "unit" | "team"; title?: string; onRow?: (row: { key: string; label: string; ids: Id[]; scope: ScopeSel }) => void }) {
  const { core, ctx } = useCore();
  if (!def) return <Glass><CardHead title={title} /><EmptyNote title="Nothing to break down" body="This area has no measures yet." /></Glass>;
  const parts = compareMetric(core, ctx, def.id, by);
  const total = metricView(core, ctx, def.id);
  const noun = by === "unit" ? core.config.terminology.units : core.config.terminology.teams;
  const planned = new Set(core.config.units.filter((u) => u.status === "planned").map((u) => "unit:" + u.id));
  const rows: SplitRow[] = parts.map((p) => {
    const v = metricView(core, { ...ctx, scope: p.scope }, def.id);
    const none = !v || v.noData;
    return {
      key: p.key, label: p.label, value: none ? null : p.result.value, display: none ? "No data" : p.result.display,
      note: planned.has(p.key) ? "planned" : p.result.partial ? "partial" : undefined,
      title: def.label + " for " + p.label + (none ? ": no data" : ""),
      onClick: onRow ? () => onRow({ key: p.key, label: p.label, ids: p.result.ids, scope: p.scope }) : undefined
    };
  });
  const additive = def.aggregation === "count" || def.aggregation === "sum";
  const unitTag = def.unit === "percent" ? "%" : def.unit === "hours" ? "HOURS" : def.unit === "money" ? def.currency || "EUR" : "COUNT";
  return (
    <Glass style={{ display: "flex", flexDirection: "column" }}>
      <CardHead title={title} unit={def.label.toUpperCase() + " · " + unitTag} />
      {rows.length === 0 ? (
        <EmptyNote title={"No " + noun.toLowerCase() + " to split by"} body={ctx.scope.kind === "personal" ? "Your own work has no breakdown. Pick a wider scope in the top bar." : "No " + noun.toLowerCase() + " are set up in this scope yet."} />
      ) : (
        <>
          <SplitRows rows={rows} max={def.unit === "percent" ? 100 : undefined} />
          <SplitFoot label={additive ? "TOTAL" : "OVERALL, FROM TOTALS"} value={total ? total.display : "No data"}
            note={additive ? "Sum of the rows, counted once across the scope." : "Calculated from the scope's underlying totals, not an average of the rows."} />
        </>
      )}
    </Glass>
  );
}

