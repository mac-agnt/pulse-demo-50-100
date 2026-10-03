/* Metric panel: how a figure is defined and calculated, where it came from,
   how fresh it is, what could not be counted, and the exact objects behind it. */

import { useCore, navigate, fmtDateTime, fmtDate, formatMetric, scopeLabel, type Ctx } from "../../core";
import { Button, Chip, Icon, ICON, KV, Notice, Section, SidePanel } from "../kit";
import { DrillTable } from "./DrillTable";
import { comparison, dashStore, metricView, targetText, useDashState, type MetricView } from "./state";

const AGG: Record<string, string> = { count: "Count", ratio: "Ratio of totals", median: "Median", sum: "Sum" };
const UNIT: Record<string, string> = { count: "Count", percent: "Percent", hours: "Hours", money: "Money" };

export function MetricStatusChips({ view }: { view: MetricView }) {
  const r = view.result;
  return (
    <>
      {r.partial && <Chip tone="warn" title="Some contributors could not be counted">Partial</Chip>}
      {r.stale && <Chip tone="warn" title="Source data older than 24 hours">Stale</Chip>}
    </>
  );
}

/** The full explanation of one metric in one scope. Used by the metric panel and the unit detail panel. */
export function MetricDetail({ view, ctx }: { view: MetricView; ctx: Ctx }) {
  const { core } = useCore();
  const r = view.result;
  const d = r.def;
  const tz = core.config.timezone;
  const cmp = comparison(r);
  const srcLabel = (id: string) => core.config.sources.find((s) => s.id === id)?.label || id;
  const items: [string, React.ReactNode][] = [
    ["Value", view.display],
    ["Scope", scopeLabel(core, ctx.scope)],
    ["Aggregation", AGG[d.aggregation] || d.aggregation],
    ["Unit", UNIT[d.unit] + (d.currency ? " (" + d.currency + ")" : "")]
  ];
  if (d.aggregation === "ratio" && r.numerator !== undefined && r.denominator !== undefined) {
    items.push(["Numerator", String(r.numerator)], ["Denominator", String(r.denominator)]);
  } else if (r.denominator !== undefined) {
    items.push(["Based on", r.denominator + " " + (r.entity === "approval" ? "decisions" : r.entity + "s")]);
  }
  items.push(["Period", r.period ? fmtDateTime(r.period.start, tz) + " to " + fmtDateTime(r.period.end, tz) : "Snapshot as of " + fmtDateTime(ctx.now, tz)]);
  items.push(["Previous period", r.previous ? r.previous.display + " (" + fmtDate(r.previous.period.start, tz) + " to " + fmtDate(r.previous.period.end, tz) + ")" : "None for a snapshot"]);
  items.push(["Target", r.target !== undefined ? formatMetric(d, r.target) + (d.better === "up" ? " or higher" : " or lower") : "None set"]);
  items.push(["Sources", r.sources.length ? r.sources.map(srcLabel).join(", ") : "None"]);
  items.push(["Freshness", r.freshness.label + (r.freshness.at ? ", " + fmtDateTime(r.freshness.at, tz) : "")]);

  return (
    <>
      {view.explanation && <Notice>{view.explanation}</Notice>}
      <div style={{ marginTop: view.explanation ? 12 : 0 }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--body)", lineHeight: 1.55 }}>{d.description}</p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--dim)" }}>Comparison: {cmp.text}.{targetText(r, view.noData) ? " " + targetText(r, view.noData) + "." : ""}</p>
      </div>
      <KV items={items} />
      <Section label="Formula">
        <code className="pk-mono" style={{ display: "block", fontSize: 12, padding: "10px 12px", borderRadius: "var(--r-sm,9px)", background: "var(--chip)", border: "1px solid var(--chip-border)", color: "var(--body)", whiteSpace: "pre-wrap" }}>{d.formula}</code>
        {d.periodDays > 0 && <p className="pk-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>The previous period uses the same calculation over the {d.periodDays} days before the current period.</p>}
      </Section>
      {r.notes.length > 0 && (
        <Section label="Notes">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--body)", lineHeight: 1.6 }}>{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </Section>
      )}
      <Section label={"Not counted (" + r.missing.length + ")"}>
        {r.missing.length === 0
          ? <p className="pk-muted" style={{ fontSize: 12.5, margin: 0 }}>Every contributor in scope was counted.</p>
          : <div className="pk-list">{r.missing.map((m, i) => (
            <div key={i} className="pk-li" style={{ alignItems: "flex-start" }}>
              <span style={{ color: "var(--warn)", marginTop: 2 }}><Icon d={ICON.warn} size={13} /></span>
              <div className="pk-grow"><div style={{ color: "var(--ink)" }}>{m.label}</div><div className="pk-muted" style={{ fontSize: 12, marginTop: 2 }}>{m.reason}</div></div>
            </div>
          ))}</div>}
      </Section>
      <Section label={"Counted objects (" + r.ids.length + ")"}>
        <DrillTable result={r} />
      </Section>
    </>
  );
}

/** Opened from a band tile, or by a focus hand-off of kind "metric". */
export function MetricPanel() {
  const { core, ctx } = useCore();
  const { metricId } = useDashState();
  const view = metricId ? metricView(core, ctx, metricId) : null;
  const close = () => dashStore.set({ metricId: null });
  if (!view) return null;
  const r = view.result;
  const toRecords = r.entity === "record" && r.ids.length > 0;
  return (
    <SidePanel open onClose={close} width={720} eyebrow="Metric" title={r.def.label}
      chips={<MetricStatusChips view={view} />}
      footer={<>
        {r.entity === "record" && (
          <Button variant="primary" disabled={!toRecords} title={toRecords ? undefined : "No records are counted in this scope"}
            onClick={() => { close(); navigate({ page: "Records", section: "browse", focus: { kind: "ids", ids: r.ids, label: r.def.label } }); }}>
            Open in Records
          </Button>
        )}
        {r.entity === "issue" && (
          <Button variant="primary" disabled={!r.ids.length} title={r.ids.length ? undefined : "No open issues in this scope"}
            onClick={() => { close(); navigate({ page: "Records", section: "quality" }); }}>
            Open data quality
          </Button>
        )}
        {r.entity === "person" && (
          <Button variant="primary" onClick={() => { close(); navigate({ page: "Work", section: "people" }); }}>
            Open Work, People
          </Button>
        )}
        <span className="pk-grow" />
        <Button onClick={close}>Close</Button>
      </>}>
      <MetricDetail view={view} ctx={ctx} />
    </SidePanel>
  );
}
