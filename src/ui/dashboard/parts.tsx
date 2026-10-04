/* Building blocks of the dashboard views, in the original Pulse design:
   glass cards, the view header, the column chart and the grid table. They
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


export interface GridRow { key: string; cells: ReactNode[]; onClick?: () => void; label?: string; total?: boolean }

/** The original grid table: mono uppercase headers, hairline rows. Scrolls sideways inside its card. */
export function GridTable({ cols, template, rows, minWidth = 560, caption }: { cols: ReactNode[]; template: string; rows: GridRow[]; minWidth?: number; caption: string }) {
  return (
    <div className="db-gt-wrap">
      <div className="db-gt" role="table" aria-label={caption} style={{ minWidth }}>
        <div className="db-gt-h" role="row" style={{ gridTemplateColumns: template }}>
          {cols.map((c, i) => <div key={i} role="columnheader" className="db-gt-hc" style={{ textAlign: i === 0 ? "left" : "right" }}>{c}</div>)}
        </div>
        {rows.map((r) => {
          const cells = r.cells.map((c, i) => <div key={i} role="cell" className="db-gt-c" style={{ textAlign: i === 0 ? "left" : "right", justifyContent: i === 0 ? "flex-start" : "flex-end" }}>{c}</div>);
          /* A clickable row is a focusable row, not a button, so cells may hold their own links. */
          return r.onClick
            ? <div key={r.key} role="row" tabIndex={0} className={"ix11 db-gt-r db-gt-r--btn" + (r.total ? " db-gt-r--total" : "")} style={{ gridTemplateColumns: template }}
                onClick={r.onClick} aria-label={r.label} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); r.onClick!(); } }}>{cells}</div>
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
