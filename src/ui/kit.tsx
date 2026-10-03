/* Shared working-page components. Every page built on the core uses these, so
   tables, panels, chips and forms behave the same everywhere. Styling lives in
   styles/kit.css and only uses the theme tokens. */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCore, store } from "../core";
import type { Tone } from "../core";

/* ── Basics ────────────────────────────────────────────────────────────── */

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean;
};

export function Button({ children, onClick, variant = "secondary", size = "md", disabled, title, type = "button", style, ...aria }: BtnProps) {
  const cls = "pk-btn" + (variant !== "secondary" ? " pk-btn--" + variant : "") + (size === "sm" ? " pk-btn--sm" : "");
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title} style={style} {...aria}>{children}</button>;
}

export function Chip({ tone = "neutral", children, plain, title }: { tone?: Tone; children: ReactNode; plain?: boolean; title?: string }) {
  return <span className={"pk-chip pk-tone-" + tone + (plain ? " pk-chip--plain" : "")} title={title}>{children}</span>;
}

export function Avatar({ name, size = 24, agent }: { name: string; size?: number; agent?: boolean }) {
  const initials = name === "Unassigned" ? "?" : name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flex: "none", borderRadius: agent ? "50%" : 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38), fontWeight: 600, background: agent ? "var(--accent-soft)" : "var(--surface-2)", color: agent ? "var(--accent)" : "var(--body)",
      border: "1px solid var(--border)" }}>{initials}</span>
  );
}

export function PersonName({ id }: { id?: string | null }) {
  const { q } = useCore();
  const n = q.name(id);
  const agent = !!id && id.startsWith("ag-");
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}><Avatar name={n} size={20} agent={agent} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{n}</span></span>;
}

export function Icon({ d, size = 14, sw = 1.7 }: { d: string; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export const ICON = {
  plus: "M12 5v14 M5 12h14",
  close: "M6 6l12 12 M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  down: "M6 9l6 6 6-6",
  up: "M6 15l6-6 6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  filter: "M4 6h16 M7 12h10 M10 18h4",
  columns: "M4 5h16v14H4z M10 5v14 M15 5v14",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  warn: "M12 4 2.5 20h19L12 4Z M12 10v4 M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8h.01",
  lock: "M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  arrow: "M5 12h14 M13 6l6 6-6 6"
};

/* ── Layout ────────────────────────────────────────────────────────────── */

export function PageHeader({ title, sub, primary, children }: {
  title: string; sub?: ReactNode; primary?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="pk-head">
      <div className="pk-grow">
        <h1 className="pk-title">{title}</h1>
        {sub && <div className="pk-sub">{sub}</div>}
      </div>
      {children}
      {primary}
    </div>
  );
}

export function Card({ title, right, children, style, bodyStyle }: { title?: ReactNode; right?: ReactNode; children: ReactNode; style?: CSSProperties; bodyStyle?: CSSProperties }) {
  return (
    <section className="pk-card" style={style}>
      {title && <div className="pk-card-h"><div className="pk-card-t pk-grow">{title}</div>{right}</div>}
      <div style={bodyStyle}>{children}</div>
    </section>
  );
}

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return <div className="pk-empty" role="status"><h3>{title}</h3>{body && <p>{body}</p>}{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}

export function Notice({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: string }) {
  return (
    <div className={"pk-notice pk-tone-" + tone} role={tone === "bad" ? "alert" : "note"}>
      <span style={{ flex: "none", marginTop: 1 }}><Icon d={icon || (tone === "bad" || tone === "warn" ? ICON.warn : ICON.info)} size={14} /></span>
      <div style={{ minWidth: 0, color: "var(--body)" }}>{children}</div>
    </div>
  );
}

export function NoAccess({ what }: { what: string }) {
  return <Empty title="Not available to you" body={"Your role cannot see " + what + ". Ask an administrator if you need it."} />;
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return <dl className="pk-kv" style={{ margin: 0 }}>{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function Section({ label, children, right }: { label: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="pk-section">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><span className="pk-eyebrow pk-grow">{label}</span>{right}</div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pk-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <span className="pk-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pk-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined ? " · " + t.count : ""}
        </button>
      ))}
    </div>
  );
}

/* ── Forms ─────────────────────────────────────────────────────────────── */

export function Field({ label, help, error, children, htmlFor }: { label: string; help?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="pk-field">
      <label className="pk-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <div className="pk-error" role="alert">{error}</div> : help ? <div className="pk-help">{help}</div> : null}
    </div>
  );
}

export function TextInput({ id, value, onChange, placeholder, type = "text", invalid, ariaLabel, onKeyDown }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; invalid?: boolean; ariaLabel?: string; onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return <input id={id} className="pk-input" type={type} value={value} placeholder={placeholder} aria-invalid={invalid || undefined} aria-label={ariaLabel}
    onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />;
}

export function TextArea({ id, value, onChange, placeholder, rows = 3, invalid }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; invalid?: boolean }) {
  return <textarea id={id} className="pk-textarea" rows={rows} value={value} placeholder={placeholder} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />;
}

export function Select({ id, value, onChange, options, ariaLabel, invalid }: { id?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; ariaLabel?: string; invalid?: boolean }) {
  return (
    <select id={id} className="pk-select" value={value} aria-label={ariaLabel} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function useFieldId() {
  return useId();
}

/* ── Menus ─────────────────────────────────────────────────────────────── */

export interface MenuItem { label: string; onClick?: () => void; disabled?: boolean; note?: string }

export function Overflow({ label = "More actions", items, icon }: { label?: string; items: MenuItem[]; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button aria-label={label} title={label} aria-haspopup aria-expanded={open} onClick={() => setOpen(!open)}>{icon || <><Icon d={ICON.more} size={16} sw={2.4} /><span className="pk-hide-narrow">More</span></>}</Button>
      {open && (
        <div className="pk-menu" role="menu">
          {items.map((it, i) => it.note && !it.onClick
            ? <div key={i} className="pk-menu-note">{it.note}</div>
            : <button key={i} role="menuitem" disabled={it.disabled} title={it.note} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>)}
        </div>
      )}
    </div>
  );
}

/* ── Side panel ────────────────────────────────────────────────────────── */

export function SidePanel({ open, onClose, title, eyebrow, chips, children, footer, width = 600 }: {
  open: boolean; onClose: () => void; title: ReactNode; eyebrow?: ReactNode; chips?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus],button,input,select,textarea,[tabindex]")?.focus(), 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab" && panel.current) {
        const els = [...panel.current.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled"));
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key, true);
      // Restore focus to whatever opened the panel, so keyboard position is kept.
      const o = opener.current as HTMLElement | null;
      if (o && document.contains(o)) setTimeout(() => o.focus(), 0);
    };
  }, [open]);
  if (!open) return null;
  // Rendered into the themed app root, above the page's stacking context and the chat button.
  const host = (typeof document !== "undefined" && (document.querySelector("[data-theme]") || document.body)) as Element;
  return createPortal(
    <div className="pk-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} className="pk-panel pk" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ ["--pk-w" as string]: width + "px" } as CSSProperties}>
        <div className="pk-panel-h">
          <div className="pk-grow">
            {(eyebrow || chips) && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{eyebrow && <span className="pk-eyebrow">{eyebrow}</span>}{chips}</div>}
            <div id={titleId} style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-.4px", marginTop: eyebrow || chips ? 7 : 0, lineHeight: 1.3 }}>{title}</div>
          </div>
          <Button variant="ghost" size="sm" aria-label="Close panel" onClick={onClose}><Icon d={ICON.close} size={13} sw={2.2} /></Button>
        </div>
        <div className="pk-panel-b">{children}</div>
        {footer && <div className="pk-panel-f">{footer}</div>}
      </div>
    </div>,
    host
  );
}

/* ── Data table ────────────────────────────────────────────────────────── */

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Value used to sort, group and export. */
  value?: (row: T) => string | number | null | undefined;
  width?: number | string;
  align?: "left" | "right";
  /** Lower numbers stay on narrow screens; columns above 2 can hide. */
  priority?: number;
  defaultHidden?: boolean;
  strong?: boolean;
}

export interface TableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  selectedKey?: string | null;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  groupOptions?: { key: string; label: string }[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty: ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  caption?: string;
  /** Controlled view state so saved views can restore it. */
  state?: TableState;
  onState?: (s: TableState) => void;
  footerNote?: ReactNode;
}

export interface TableState { query: string; sort: { key: string; dir: "asc" | "desc" } | null; group: string; hidden: string[]; page: number }

export function useTableState(init?: Partial<TableState>): [TableState, (s: TableState) => void] {
  const [s, set] = useState<TableState>({ query: "", sort: null, group: "", hidden: [], page: 0, ...init });
  return [s, set];
}

export function DataTable<T>(p: TableProps<T>) {
  const [inner, setInner] = useTableState({ sort: p.initialSort || null, hidden: p.columns.filter((c) => c.defaultHidden).map((c) => c.key) });
  const st = p.state || inner;
  const set = (patch: Partial<TableState>) => (p.onState || setInner)({ ...st, ...patch });
  const [colsOpen, setColsOpen] = useState(false);
  const narrow = useNarrow();
  const pageSize = p.pageSize || 10;

  const visibleCols = p.columns.filter((c) => !st.hidden.includes(c.key) && !(narrow && (c.priority || 1) > 2));
  const val = (c: Column<T> | undefined, r: T) => (c?.value ? c.value(r) : (r as Record<string, unknown>)[c?.key || ""]) as string | number | null | undefined;

  const filtered = useMemo(() => {
    const ql = st.query.trim().toLowerCase();
    let out = ql && p.searchText ? p.rows.filter((r) => p.searchText!(r).toLowerCase().includes(ql)) : p.rows;
    if (st.sort) {
      const c = p.columns.find((x) => x.key === st.sort!.key);
      const dir = st.sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = val(c, a), y = val(c, b);
        if (x === y) return 0;
        if (x === null || x === undefined || x === "") return 1;
        if (y === null || y === undefined || y === "") return -1;
        return (x < y ? -1 : 1) * dir;
      });
    }
    return out;
  }, [p.rows, st.query, st.sort, p.columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(st.page, pages - 1);
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const groupCol = p.columns.find((c) => c.key === st.group);
  const rows: ({ kind: "group"; label: string; n: number } | { kind: "row"; row: T })[] = [];
  if (groupCol) {
    const groups = new Map<string, T[]>();
    for (const r of slice) {
      const g = String(val(groupCol, r) ?? "None");
      groups.set(g, [...(groups.get(g) || []), r]);
    }
    for (const [g, list] of groups) { rows.push({ kind: "group", label: g, n: list.length }); list.forEach((r) => rows.push({ kind: "row", row: r })); }
  } else slice.forEach((r) => rows.push({ kind: "row", row: r }));

  const sortBy = (key: string) => {
    const cur = st.sort;
    set({ sort: !cur || cur.key !== key ? { key, dir: "asc" } : cur.dir === "asc" ? { key, dir: "desc" } : null, page: 0 });
  };

  return (
    <div className="pk-card" style={{ overflow: "visible" }}>
      <div className="pk-toolbar">
        {p.toolbarLeft}
        {p.searchText && (
          <div className="pk-search">
            <Icon d={ICON.search} size={13} />
            <input className="pk-input" value={st.query} placeholder={p.searchPlaceholder || "Search"} aria-label={p.searchPlaceholder || "Search"}
              onChange={(e) => set({ query: e.target.value, page: 0 })} />
          </div>
        )}
        <span className="pk-grow" />
        {p.groupOptions && p.groupOptions.length > 0 && (
          <div style={{ width: 150 }} className="pk-hide-narrow">
            <Select ariaLabel="Group rows by" value={st.group} onChange={(g) => set({ group: g })}
              options={[{ value: "", label: "No grouping" }, ...p.groupOptions.map((g) => ({ value: g.key, label: "Group: " + g.label }))]} />
          </div>
        )}
        <div style={{ position: "relative" }} className="pk-hide-narrow">
          <Button aria-label="Choose columns" title="Choose columns" aria-expanded={colsOpen} onClick={() => setColsOpen(!colsOpen)}><Icon d={ICON.columns} size={14} /></Button>
          {colsOpen && (
            <div className="pk-menu" role="group" aria-label="Columns" onMouseLeave={() => setColsOpen(false)}>
              {p.columns.map((c, i) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px", fontSize: 12.5, color: "var(--body)", cursor: i === 0 ? "default" : "pointer" }}>
                  <input type="checkbox" disabled={i === 0} checked={!st.hidden.includes(c.key)}
                    onChange={() => set({ hidden: st.hidden.includes(c.key) ? st.hidden.filter((k) => k !== c.key) : [...st.hidden, c.key] })} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        {p.toolbarRight}
      </div>
      {filtered.length === 0 ? p.empty : (
        <div className="pk-table-wrap">
          <table className="pk-table" aria-label={p.caption}>
            <thead>
              <tr>
                {visibleCols.map((c) => {
                  const sorted = st.sort?.key === c.key ? st.sort.dir : null;
                  return (
                    <th key={c.key} style={{ width: c.width, textAlign: c.align || "left" }} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}>
                      <button onClick={() => sortBy(c.key)}>{c.label}{sorted && <Icon d={sorted === "asc" ? ICON.up : ICON.down} size={11} sw={2.2} />}</button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => r.kind === "group"
                ? <tr key={"g" + i} className="pk-group"><td colSpan={visibleCols.length}>{r.label} · {r.n}</td></tr>
                : (
                  <tr key={p.rowKey(r.row)} className="pk-row" tabIndex={0} aria-selected={p.selectedKey === p.rowKey(r.row)}
                    onClick={() => p.onOpen?.(r.row)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onOpen?.(r.row); } }}>
                    {visibleCols.map((c) => (
                      <td key={c.key} className={c.strong ? "pk-strong" : undefined} style={{ textAlign: c.align || "left" }}>
                        {c.render ? c.render(r.row) : String(val(c, r.row) ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pk-tfoot">
        <span className="pk-grow">{filtered.length === p.rows.length ? p.rows.length + " rows" : filtered.length + " of " + p.rows.length + " rows"}{p.footerNote ? " · " : ""}{p.footerNote}</span>
        {pages > 1 && (
          <>
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => set({ page: page - 1 })} aria-label="Previous page">Previous</Button>
            <span className="pk-mono" style={{ fontSize: 11 }}>{page + 1} / {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => set({ page: page + 1 })} aria-label="Next page">Next</Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Utilities ─────────────────────────────────────────────────────────── */

export function useNarrow(px = 760) {
  const get = () => typeof window !== "undefined" && window.matchMedia("(max-width:" + px + "px)").matches;
  const [n, setN] = useState(get);
  useEffect(() => {
    const m = window.matchMedia("(max-width:" + px + "px)");
    const on = () => setN(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [px]);
  return n;
}

/** Download text as a file. Local only: nothing leaves the browser. */
export function downloadText(name: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

/** Global toast for operation results. */
export function CoreToast() {
  const { session, core } = useCore();
  // Display density from Settings > Experience applies to every working page.
  useEffect(() => { document.documentElement.dataset.density = core.config.density; }, [core.config.density]);
  const t = session.toast;
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!t) return;
    setShown(t.id);
    const h = setTimeout(() => setShown(null), t.kind === "error" ? 6000 : 4200);
    return () => clearTimeout(h);
  }, [t?.id]);
  return (
    <div aria-live="polite" role="status" style={{ position: "fixed", width: 0, height: 0 }}>
      {t && shown === t.id && (
        <div className="pk-toast">
          <span style={{ color: t.kind === "error" ? "var(--bad)" : "var(--ok)", flex: "none", marginTop: 1 }}><Icon d={t.kind === "error" ? ICON.warn : ICON.check} size={14} sw={2.2} /></span>
          <span>{t.text}</span>
          <button className="pk-btn pk-btn--ghost pk-btn--sm" aria-label="Dismiss" onClick={() => setShown(null)}><Icon d={ICON.close} size={11} sw={2.2} /></button>
        </div>
      )}
    </div>
  );
}

/** Small helper: read-only status tones used across pages. */
export const toneOf = {
  task: (status: string, overdue: boolean): Tone => overdue ? "bad" : status === "done" ? "ok" : status === "waiting" ? "warn" : status === "in_progress" ? "accent" : "neutral",
  approval: (status: string): Tone => status === "approved" ? "ok" : status === "declined" ? "bad" : status === "returned" || status === "stale" ? "warn" : "accent",
  exec: (status: string): Tone => status === "succeeded" ? "ok" : status === "failed" ? "bad" : status === "running" ? "accent" : "neutral",
  run: (status: string): Tone => status === "completed" ? "ok" : status === "failed" ? "bad" : status === "paused" ? "neutral" : status.startsWith("awaiting") ? "warn" : "accent",
  severity: (s: string): Tone => s === "high" ? "bad" : s === "medium" ? "warn" : "neutral"
};

export const LABEL = {
  task: { open: "Open", in_progress: "In progress", waiting: "Waiting", done: "Done", cancelled: "Cancelled" } as Record<string, string>,
  request: { draft: "Draft", submitted: "In review", changes_requested: "Changes requested", approved: "Approved", declined: "Declined", withdrawn: "Withdrawn" } as Record<string, string>,
  approval: { pending: "Pending", approved: "Approved", declined: "Declined", returned: "Returned", stale: "Needs re-review" } as Record<string, string>,
  exec: { not_started: "Not run yet", running: "Running", succeeded: "Done", failed: "Failed", not_applicable: "Not applicable" } as Record<string, string>,
  run: { queued: "Queued", running: "Running", awaiting_input: "Awaiting input", awaiting_approval: "Awaiting approval", completed: "Completed", failed: "Failed", paused: "Paused" } as Record<string, string>,
  priority: { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as Record<string, string>
};

export { store };
