/* Data quality area: completeness (with partial and stale flags), open issues,
   stale source records and duplicates; issues opened and resolved per week;
   issues by kind; completeness by record type and by unit; source freshness;
   the most missed fields. Every number is counted from the records, issues and
   sync state in scope, and opens the records or issues behind it. */

import {
  useCore, compareMetric, missingFields, fmtDateTime, relative, ISSUE_LABEL, STALE_AFTER_HOURS, HOUR, ms,
  type DataIssue, type IssueKind, type MetricDef, type RecordItem, type SyncState, type Tone
} from "../../core";
import { Pill } from "../frame";
import { CompareTable, comparisonRows } from "./Comparison";
import { ExceptionsCard } from "./Exceptions";
import { BarRows, CardHead, EmptyNote, Glass, GridTable, MetricCard, PairChart, SplitFoot, SplitRows, type SplitRow } from "./parts";
import { figureOf, toIssues, toRecords } from "./blocks";
import { countByWeek, openDuplicates, weeklySeries, weeks } from "./series";
import { dashStore, metricView } from "./state";

const KINDS: IssueKind[] = ["missing_field", "duplicate", "unmapped_value", "conflict", "unmatched"];
const isOpen = (i: DataIssue) => i.state === "open" || i.state === "in_progress";

const SYNC: Record<SyncState["status"], [string, Tone]> = {
  ok: ["Up to date", "ok"], sample: ["Sample data", "accent"], stale: ["Stale", "warn"], error: ["Failing", "bad"], not_connected: ["Not connected", "neutral"]
};

export function DataQualityArea({ defs, data }: { defs: MetricDef[]; data: ReturnType<typeof comparisonRows> }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const records = q.records();
  const issues = q.issues();
  const open = issues.filter(isOpen);
  const noRecords = records.length === 0;

  /* ── Cards: the area's measures, then duplicates ── */
  const cardIds = ["completeness", "issues", "staleRecords"].filter((id) => defs.some((d) => d.id === id));
  const extra = defs.filter((d) => !cardIds.includes(d.id)).map((d) => d.id);
  const shown = [...cardIds, ...extra].slice(0, 3);
  const dups = openDuplicates(q);
  const dupSeries = { caption: "Duplicates found per week", unit: "COUNT", entity: "issue" as const, rolling: false,
    points: countByWeek(issues.filter((i) => i.kind === "duplicate"), (i) => i.detectedAt, (i) => i.id, weeks(ctx.now, 8), tz) };

  /* ── Opened vs resolved per week ── */
  const wins = weeks(ctx.now, 8);
  const opened = { caption: "Issues opened per week", unit: "COUNT", entity: "issue" as const, rolling: false, points: countByWeek(issues, (i) => i.detectedAt, (i) => i.id, wins, tz) };
  const closed = { caption: "Issues resolved per week", unit: "COUNT", entity: "issue" as const, rolling: false,
    points: countByWeek(issues.filter((i) => (i.state === "resolved" || i.state === "dismissed") && i.resolution), (i) => i.resolution?.at, (i) => i.id, wins, tz) };
  const anyWeek = opened.points.some((p) => (p.value || 0) > 0) || closed.points.some((p) => (p.value || 0) > 0);

  /* ── Issues by kind ── */
  const kindRows: SplitRow[] = KINDS.map((k) => {
    const list = open.filter((i) => i.kind === k);
    return { key: k, label: k === "unmatched" ? "Unmatched" : ISSUE_LABEL[k], value: list.length, display: String(list.length),
      title: list.length ? "Open in Records, Data quality" : undefined, onClick: list.length ? () => toIssues(list) : undefined };
  });

  /* ── Completeness by record type (same formula as the metric) ── */
  const byType: SplitRow[] = core.config.recordTypes.map((t) => {
    const recs = records.filter((r) => r.typeId === t.id);
    const req = t.fields.filter((f) => f.required).length * recs.length;
    const filled = recs.reduce((n, r) => n + t.fields.filter((f) => f.required).length - missingFields(core, r).length, 0);
    const v = req ? (100 * filled) / req : null;
    return { key: t.id, label: t.plural, value: v, display: v === null ? "No data" : Math.round(v * 10) / 10 + "%",
      title: req ? filled + " of " + req + " required fields filled across " + recs.length + " " + t.plural.toLowerCase() : "No " + t.plural.toLowerCase() + " in this scope",
      onClick: recs.length ? () => toRecords(recs.map((r) => r.id), t.plural + " in " + "this scope") : undefined };
  });

  /* ── Completeness by unit or team (the metric engine, per scope) ── */
  const compDef = core.config.metrics.find((m) => m.id === "completeness");
  const byUnit: SplitRow[] = compDef ? compareMetric(core, ctx, "completeness", data.by).map((p) => {
    const v = metricView(core, { ...ctx, scope: p.scope }, "completeness");
    const none = !v || v.noData;
    return { key: p.key, label: p.label, value: none ? null : p.result.value, display: none ? "No data" : p.result.display,
      note: p.result.stale ? "stale" : p.result.partial ? "partial" : undefined,
      title: none ? "No records" : p.result.numerator + " of " + p.result.denominator + " required fields filled" + (p.result.partial ? ". Partial: " + p.result.missing.map((m) => m.reason).join(" ") : ""),
      onClick: p.result.ids.length ? () => toRecords(p.result.ids, "Completeness, " + p.label) : undefined };
  }) : [];

  /* ── Source freshness ── */
  const staleRef = (syncedAt: string | null) => !!syncedAt && (ms(ctx.now) - ms(syncedAt)) / HOUR > STALE_AFTER_HOURS;
  const sourceIds = [...new Set([...core.config.sources.map((s) => s.id), ...core.data.sync.map((s) => s.sourceId)])];
  const srcRows = sourceIds.map((id) => {
    const def = core.config.sources.find((s) => s.id === id);
    const sync = core.data.sync.find((s) => s.sourceId === id);
    const recs: RecordItem[] = id === "pulse"
      ? records.filter((r) => r.sourceRefs.length === 0 || r.sourceRefs.some((x) => x.sourceId === "pulse"))
      : records.filter((r) => r.sourceRefs.some((x) => x.sourceId === id));
    const stale = recs.filter((r) => r.sourceRefs.some((x) => x.sourceId === id && staleRef(x.syncedAt)));
    const [label, tone] = sync ? SYNC[sync.status] : def?.connected ? SYNC.ok : SYNC.not_connected;
    const name = def?.label || id;
    return {
      key: id, label: name + ": " + recs.length + " records" + (stale.length ? ", " + stale.length + " stale" : ""),
      onClick: recs.length ? () => toRecords(stale.length ? stale.map((r) => r.id) : recs.map((r) => r.id), name + (stale.length ? ", stale records" : ", records")) : undefined,
      cells: [
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          {sync?.message && <span style={{ fontSize: 11.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis" }} title={sync.message}>{sync.message}</span>}
        </span>,
        <span title={sync?.lastAttemptAt ? fmtDateTime(sync.lastAttemptAt, tz) : undefined}>{id === "pulse" ? "Live" : sync?.lastAttemptAt ? relative(sync.lastAttemptAt, ctx.now, tz) : "Never"}</span>,
        <span title={sync?.lastSuccessAt ? fmtDateTime(sync.lastSuccessAt, tz) : undefined}>{id === "pulse" ? "Live" : sync?.lastSuccessAt ? relative(sync.lastSuccessAt, ctx.now, tz) : "Never"}</span>,
        <Pill tone={tone}>{label}</Pill>,
        <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>{recs.length}</span>,
        <span style={{ fontFamily: "var(--mono)", color: stale.length ? "var(--warn)" : "var(--faint)" }}>{stale.length}</span>
      ]
    };
  });

  /* ── Top missing fields ── */
  const missing = new Map<string, { field: string; type: string; ids: string[] }>();
  for (const i of open) {
    if (i.kind !== "missing_field" || !i.field) continue;
    const rec = records.find((r) => r.id === i.recordIds[0]);
    if (!rec) continue;
    const t = core.config.recordTypes.find((x) => x.id === rec.typeId);
    const k = rec.typeId + ":" + i.field;
    const row = missing.get(k) || { field: t?.fields.find((f) => f.key === i.field)?.label || i.field, type: t?.label || rec.typeId, ids: [] };
    if (!row.ids.includes(rec.id)) row.ids.push(rec.id);
    missing.set(k, row);
  }
  const topMissing = [...missing.entries()].sort((a, b) => b[1].ids.length - a[1].ids.length).slice(0, 6);

  return (
    <>
      <div className="db-mgrid" style={{ ["--cols" as string]: "1.7fr 1fr 1fr 1fr" }}>
        {shown.map((id, i) => {
          const v = metricView(core, ctx, id);
          if (!v) return null;
          return <MetricCard key={id} fig={figureOf(v)} series={weeklySeries(core, ctx, q, id)} hero={i === 0} delay={i * 70} onOpen={() => dashStore.set({ metricId: id })} />;
        })}
        <MetricCard key="dups" delay={shown.length * 70} series={dupSeries}
          fig={{ label: "Duplicates", value: noRecords ? "No data" : String(dups.length), noData: noRecords,
            hint: noRecords ? "No records in this scope yet." : "open, snapshot", title: "Open duplicate issues in this scope. Opens Records, Data quality." }}
          onOpen={() => toIssues(dups)} />
      </div>

      <div className="db-main">
        <Glass>
          <CardHead title="Issues opened and resolved by week" unit="COUNT" />
          <div style={{ marginTop: 18 }}>
            {!anyWeek ? (
              <EmptyNote title="No issues opened or resolved in the last 8 weeks"
                body={noRecords ? "Data issues are found once records exist." : "Issues are counted from when they were found and when they were resolved or dismissed."} />
            ) : (
              <>
                <PairChart a={opened} b={closed} labels={["Opened", "Resolved or dismissed"]} />
                <div className="db-foot-note" style={{ padding: "10px 0 0" }}>A missing field that is filled in closes its issue without a resolution entry, so it is not counted as resolved.</div>
              </>
            )}
          </div>
        </Glass>
        <Glass style={{ display: "flex", flexDirection: "column" }}>
          <CardHead title="Issues by kind" unit="OPEN · COUNT" />
          {noRecords ? <EmptyNote title="No records yet" body="Data issues are found once records exist." /> : (
            <>
              <SplitRows rows={kindRows} />
              <SplitFoot label="TOTAL OPEN" value={String(open.length)} note="Each open issue is counted once." />
            </>
          )}
        </Glass>
      </div>

      <div className="db-two">
        <Glass>
          <CardHead title="Completeness by record type" unit="% REQUIRED FIELDS" />
          <div style={{ marginTop: 16 }}>
            {noRecords ? <EmptyNote title="No records yet" body="Completeness is measured once records exist." /> : <BarRows rows={byType} percent />}
          </div>
        </Glass>
        <Glass>
          <CardHead title={"Completeness by " + (data.by === "unit" ? core.config.terminology.unit : core.config.terminology.team).toLowerCase()} unit="% REQUIRED FIELDS" />
          <div style={{ marginTop: 16 }}>
            {byUnit.length === 0
              ? <EmptyNote title={"No " + (data.by === "unit" ? core.config.terminology.units : core.config.terminology.teams).toLowerCase() + " to compare"} body="Set them up in Settings, under Organisation." />
              : <BarRows rows={byUnit} percent />}
          </div>
        </Glass>
      </div>

      <div style={{ marginTop: 12 }}>
        <Glass style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 12px" }}><CardHead title="Source freshness" unit={"STALE AFTER " + STALE_AFTER_HOURS + " H"} /></div>
          <GridTable caption="Source freshness" template="minmax(200px,2fr) minmax(110px,1fr) minmax(110px,1fr) minmax(130px,1fr) minmax(80px,.6fr) minmax(70px,.5fr)" minWidth={720}
            cols={["Source", "Last attempt", "Last success", "Status", "Records", "Stale"]} rows={srcRows} />
          <div className="db-foot-note">Records counts only records you can see in this scope. Select a source to open its records, stale ones first.</div>
        </Glass>
      </div>

      <div className="db-main">
        <Glass style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 12px" }}><CardHead title="Top missing fields" unit="OPEN · RECORDS" /></div>
          {topMissing.length === 0 ? (
            <EmptyNote title={noRecords ? "No records yet" : "No required fields are missing"} body={noRecords ? "Missing fields are found once records exist." : "Every required field is filled on the records in this scope."} />
          ) : (
            <GridTable caption="Top missing fields" template="minmax(140px,1.4fr) minmax(120px,1fr) minmax(70px,.5fr)" minWidth={360}
              cols={["Field", "Record type", "Records"]}
              rows={topMissing.map(([k, m]) => ({ key: k, label: m.field + " missing on " + m.ids.length + " " + m.type.toLowerCase() + " records. Open them",
                onClick: () => toRecords(m.ids, m.field + " missing"),
                cells: [<span style={{ color: "var(--ink)" }}>{m.field}</span>, m.type, <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>{m.ids.length}</span>] }))} />
          )}
        </Glass>
        <ExceptionsCard kinds={["issue"]} title="High-severity issues" />
      </div>

      <div style={{ marginTop: 12 }}><CompareTable defs={defs} data={data} /></div>
    </>
  );
}
