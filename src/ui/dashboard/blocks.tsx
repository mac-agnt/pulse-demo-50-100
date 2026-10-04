/* Shared blocks of the dashboard views: the one trend chart card and the
   navigation hand-offs that open the exact objects behind a number. */

import { navigate, openObject, type DataIssue, type Id, type MetricDef, type Q } from "../../core";
import { CardHead, ColumnChart, EmptyNote, Glass } from "./parts";
import { weeklySeries, type WeekSeries } from "./series";
import { dashStore, metricView, useDashCore } from "./state";

export const toRecords = (ids: Id[], label: string) => {
  dashStore.set({ metricId: null });
  navigate({ page: "Records", section: "browse", focus: { kind: "ids", ids, label } });
};

export const toIssues = (issues: DataIssue[]) => {
  dashStore.set({ metricId: null });
  if (issues.length === 1) openObject("issue", issues[0].id);
  else navigate({ page: "Records", section: "quality", focus: issues.length ? { kind: "ids", ids: issues.map((i) => i.id), label: "the dashboard" } : null });
};

export const toPeople = () => { dashStore.set({ metricId: null }); navigate({ page: "People", section: "directory" }); };

/** Where a click on a week bar goes, by what the bar counts. */
export function barTarget(series: WeekSeries, q: Q): ((i: number) => void) | undefined {
  if (series.entity === "record") return (i) => toRecords(series.points[i].ids, series.caption + ", week from " + series.points[i].label);
  if (series.entity === "issue") return (i) => { const set = new Set(series.points[i].ids); toIssues(q.issues().filter((x) => set.has(x.id))); };
  if (series.entity === "person") return () => toPeople();
  if (series.entity === "task") return (i) => {
    const ids = series.points[i].ids;
    dashStore.set({ metricId: null });
    if (ids.length === 1) openObject("task", ids[0]);
    else if (ids.length) navigate({ page: "Work", section: "team", focus: { kind: "ids", ids, label: series.caption + ", week from " + series.points[i].label } });
  };
  return undefined;
}

/** "<metric> by week": the lead measure if it has a period, else the area's first period measure, else the lead's weekly events. */
export function WeekChartCard({ defs, metricId }: { defs: MetricDef[]; metricId?: string | null }) {
  const { core, ctx, q } = useDashCore();
  const chosen = metricId ? defs.find((d) => d.id === metricId) : undefined;
  const def = chosen || (defs[0]?.periodDays ? defs[0] : defs.find((d) => d.periodDays > 0)) || defs[0];
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

