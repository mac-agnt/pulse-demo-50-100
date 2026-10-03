/* Building blocks of the dashboard areas, in the original Pulse design:
   glass cards, the area header, metric cards with bar sparklines, the column
   chart, the "where it came from" split, bar rows and the grid table. They
   only draw what they are given; every figure comes from the metric engine
   or from counting real objects. */

import type { CSSProperties, ReactNode } from "react";
import type { WeekSeries } from "./series";

export const AREA_COLOR = "var(--accent)";

export function Glass({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return <section className={"db-card" + (className ? " " + className : "")} style={style}>{children}</section>;
}

export function CardHead({ title, unit, right }: { title: ReactNode; unit?: ReactNode; right?: ReactNode }) {
  return (
    <div className="db-card-h">
      <h3 className="db-card-t">{title}</h3>
      {unit && <span className="db-card-u">{unit}</span>}
      {right}
    </div>
  );
}

export function EmptyNote({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="db-empty">
      <b>{title}</b>
      {body && <span>{body}</span>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function AreaHeader({ label, description, owner }: { label: string; description: string; owner: { name: string; role: string } | null }) {
  return (
    <div className="db-area-h">
      <span className="db-area-sq" style={{ background: AREA_COLOR }} aria-hidden="true" />
      <h2 className="db-area-t">{label}</h2>
      <span className="db-area-d" title={description}>{description}</span>
      {owner && <span className="db-area-o" title={"Responsible: " + owner.name + ", " + owner.role}>{owner.name.toUpperCase()}</span>}
    </div>
  );
}

/** Bar sparkline: the last bar in the area colour, earlier ones on the track. Null weeks are faint stubs. */
export function Sparkline({ series, hero }: { series: WeekSeries | null; hero?: boolean }) {
  if (!series || !series.points.length) return <div className="db-spark" style={{ height: hero ? 40 : 26 }} aria-hidden="true" />;
  const vals = series.points.map((p) => p.value).filter((v): v is number => v !== null);
  const peak = Math.max(1e-9, ...vals);
  const max = hero ? 36 : 22;
  const last = series.points.length - 1;
  const summary = series.caption + ": " + series.points.map((p) => p.label + " " + p.display).join(", ");
  return (
    <div className="db-spark-wrap" title={summary}>
      <div className="db-spark" style={{ height: hero ? 40 : 26 }} role="img" aria-label={summary}>
        {series.points.map((p, i) => (
          <div key={i} className="db-spark-bar" style={{
            height: p.value === null ? 3 : Math.max(3, Math.round((p.value / peak) * max)),
            background: i === last && p.value !== null ? AREA_COLOR : "var(--track)",
            opacity: p.value === null ? 0.45 : 1,
            animationDelay: i * 30 + "ms"
          }} />
        ))}
      </div>
      <div className="db-spark-cap">{series.caption.toUpperCase()}</div>
    </div>
  );
}

export interface CardFigure {
  label: string;
  value: string;
  noData: boolean;
  delta?: string;
  deltaTone?: "ok" | "bad" | "neutral";
  hint: string;
  flags?: string[];
  title?: string;
}

export function MetricCard({ fig, series, hero, delay, onOpen }: { fig: CardFigure; series: WeekSeries | null; hero?: boolean; delay: number; onOpen: () => void }) {
  const tone = fig.deltaTone === "ok" ? "var(--ok)" : fig.deltaTone === "bad" ? "var(--bad)" : "var(--dim)";
  return (
    <button type="button" className={"ix16 db-mcard" + (hero ? " db-mcard--hero" : "")} style={{ animationDelay: delay + "ms" }} onClick={onOpen}
      aria-label={fig.label + ": " + fig.value + ". Open the working"} title={fig.title}>
      <span className="db-mcard-top">
        <span className="db-mcard-l">{fig.label}</span>
        {(fig.flags || []).map((f) => <span key={f} className="db-flag db-flag--card">{f.toUpperCase()}</span>)}
        {hero && <span className="db-lead" style={{ color: AREA_COLOR }}>LEAD</span>}
      </span>
      <span className={"db-mcard-v" + (fig.noData ? " db-mcard-v--none" : "")} style={{ fontSize: fig.noData ? (hero ? 26 : 20) : hero ? 34 : 24 }}>{fig.value}</span>
      <span className="db-mcard-d">
        {fig.delta && <span style={{ fontSize: 11.5, color: tone, whiteSpace: "nowrap" }}>{fig.delta}</span>}
        <span className="db-mcard-hint">{fig.hint}</span>
      </span>
      <Sparkline series={fig.noData ? null : series} hero={hero} />
    </button>
  );
}

/** The original column chart: a value over each column, the peak in the area colour. */
export function ColumnChart({ series, onBar }: { series: WeekSeries; onBar?: (i: number) => void }) {
  const vals = series.points.map((p) => p.value).filter((v): v is number => v !== null);
  const peak = vals.length ? Math.max(...vals) : 0;
  /* One highlighted column: the latest week at the peak. */
  const peakAt = peak > 0 ? series.points.map((p) => p.value).lastIndexOf(peak) : -1;
  return (
    <div className="db-cols" role="list" aria-label={series.caption}>
      {series.points.map((p, i) => {
        const isPeak = i === peakAt;
        const h = p.value === null ? 4 : peak > 0 ? Math.max(6, Math.round((100 * p.value) / peak)) : 4;
        const body = (
          <>
            <span className="db-col-v" style={{ opacity: isPeak ? 1 : 0.55 }}>{p.display}</span>
            <span className="db-col-bar" style={{ height: h + "%", background: isPeak ? AREA_COLOR : "var(--track)", opacity: p.value === null ? 0.4 : 1, animationDelay: i * 35 + "ms" }} />
            <span className="db-col-l">{p.label}</span>
          </>
        );
        const label = "Week from " + p.label + ": " + p.display;
        return onBar && p.ids.length
          ? <button key={i} type="button" role="listitem" className="db-col db-col--btn" onClick={() => onBar(i)} aria-label={label + ". Open these"} title={label}>{body}</button>
          : <div key={i} role="listitem" className="db-col" aria-label={label} title={label}>{body}</div>;
      })}
    </div>
  );
}

/** Two counts per week side by side, the first in the area colour. */
export function PairChart({ a, b, labels }: { a: WeekSeries; b: WeekSeries; labels: [string, string] }) {
  const peak = Math.max(1, ...a.points.map((p) => p.value || 0), ...b.points.map((p) => p.value || 0));
  return (
    <>
      <div className="db-cols" role="list" aria-label={labels[0] + " and " + labels[1] + " per week"}>
        {a.points.map((p, i) => {
          const q = b.points[i];
          const label = "Week from " + p.label + ": " + labels[0].toLowerCase() + " " + p.display + ", " + labels[1].toLowerCase() + " " + q.display;
          return (
            <div key={i} role="listitem" className="db-col" title={label} aria-label={label}>
              <span className="db-col-v">{p.display}<span style={{ opacity: 0.6 }}> / {q.display}</span></span>
              <span className="db-pair">
                <span className="db-col-bar" style={{ height: Math.max(3, Math.round((100 * (p.value || 0)) / peak)) + "%", background: AREA_COLOR, animationDelay: i * 35 + "ms" }} />
                <span className="db-col-bar" style={{ height: Math.max(3, Math.round((100 * (q.value || 0)) / peak)) + "%", background: "var(--neutral)", animationDelay: i * 35 + 20 + "ms" }} />
              </span>
              <span className="db-col-l">{p.label}</span>
            </div>
          );
        })}
      </div>
      <div className="db-legend">
        <span><i style={{ background: AREA_COLOR }} />{labels[0]}</span>
        <span><i style={{ background: "var(--neutral)" }} />{labels[1]}</span>
      </div>
    </>
  );
}

export interface SplitRow { key: string; label: string; value: number | null; display: string; note?: string; onClick?: () => void; title?: string }

/** "Where it came from": label, thin bar, value; the largest in the area colour. */
export function SplitRows({ rows, max }: { rows: SplitRow[]; max?: number }) {
  const top = max ?? Math.max(0, ...rows.map((r) => r.value || 0));
  return (
    <div className="db-split">
      {rows.map((r, i) => {
        const pct = r.value === null || top <= 0 ? 0 : Math.max(2, Math.round((100 * r.value) / top));
        const lead = r.value !== null && r.value === top && top > 0;
        const body = (
          <>
            <span className="db-split-k" title={r.label}>{r.label}{r.note && <span className="db-split-n">{r.note}</span>}</span>
            <span className="db-split-track"><span className="db-split-bar" style={{ width: pct + "%", background: lead ? AREA_COLOR : "var(--neutral)", animationDelay: i * 40 + "ms" }} /></span>
            <span className="db-split-v" style={{ color: r.value === null ? "var(--faint)" : undefined }}>{r.display}</span>
          </>
        );
        return r.onClick
          ? <button key={r.key} type="button" className="db-split-row db-split-row--btn" onClick={r.onClick} title={r.title} aria-label={r.label + ": " + r.display + (r.title ? ". " + r.title : "")}>{body}</button>
          : <div key={r.key} className="db-split-row" title={r.title}>{body}</div>;
      })}
    </div>
  );
}

export function SplitFoot({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="db-split-foot" title={note}>
      <span className="db-split-fk">{label}</span>
      <span className="db-split-fv">{value}</span>
    </div>
  );
}

/** Taller bar rows, for percentages and rankings. */
export function BarRows({ rows, percent }: { rows: SplitRow[]; percent?: boolean }) {
  const top = percent ? 100 : Math.max(0, ...rows.map((r) => r.value || 0));
  const best = Math.max(...rows.map((r) => r.value ?? -1));
  return (
    <div className="db-rows">
      {rows.map((r, i) => {
        const pct = r.value === null || top <= 0 ? 0 : Math.max(3, Math.round((100 * r.value) / top));
        const body = (
          <>
            <span className="db-rows-k" title={r.label}>{r.label}</span>
            <span className="db-rows-track"><span className="db-rows-bar" style={{ width: pct + "%", background: r.value !== null && r.value === best ? AREA_COLOR : "var(--neutral)", animationDelay: i * 40 + "ms" }} /></span>
            <span className="db-rows-v" style={{ color: r.value === null ? "var(--faint)" : undefined }}>{r.display}{r.note && <span className="db-split-n">{r.note}</span>}</span>
          </>
        );
        return r.onClick
          ? <button key={r.key} type="button" className="db-rows-row db-rows-row--btn" onClick={r.onClick} title={r.title} aria-label={r.label + ": " + r.display + (r.title ? ". " + r.title : "")}>{body}</button>
          : <div key={r.key} className="db-rows-row" title={r.title}>{body}</div>;
      })}
    </div>
  );
}

export interface GridRow { key: string; cells: ReactNode[]; onClick?: () => void; label?: string; total?: boolean }

/** The original grid table: mono uppercase headers, hairline rows. Scrolls sideways inside its card. */
export function GridTable({ cols, template, rows, minWidth = 560, caption }: { cols: string[]; template: string; rows: GridRow[]; minWidth?: number; caption: string }) {
  return (
    <div className="db-gt-wrap">
      <div className="db-gt" role="table" aria-label={caption} style={{ minWidth }}>
        <div className="db-gt-h" role="row" style={{ gridTemplateColumns: template }}>
          {cols.map((c, i) => <div key={i} role="columnheader" className="db-gt-hc" style={{ textAlign: i === 0 ? "left" : "right" }}>{c}</div>)}
        </div>
        {rows.map((r) => {
          const cells = r.cells.map((c, i) => <div key={i} role="cell" className="db-gt-c" style={{ textAlign: i === 0 ? "left" : "right", justifyContent: i === 0 ? "flex-start" : "flex-end" }}>{c}</div>);
          return r.onClick
            ? <button key={r.key} type="button" role="row" className={"ix11 db-gt-r db-gt-r--btn" + (r.total ? " db-gt-r--total" : "")} style={{ gridTemplateColumns: template }} onClick={r.onClick} aria-label={r.label}>{cells}</button>
            : <div key={r.key} role="row" className={"db-gt-r" + (r.total ? " db-gt-r--total" : "")} style={{ gridTemplateColumns: template }}>{cells}</div>;
        })}
      </div>
    </div>
  );
}

/** A small amber marker for partial or stale figures. */
export function Flag({ children, title }: { children: string; title?: string }) {
  return <span className="db-flag db-flag--card" title={title}>{children.toUpperCase()}</span>;
}
