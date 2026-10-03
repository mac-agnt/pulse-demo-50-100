/* The top bar for a multi-unit organisation: where you are (scope), which
   module, and which page inside it. Each is a switcher, so the whole product is
   reachable from the bar without opening the rail. Pages can be shown as tabs
   instead (the preference lives in PulseLogic and is remembered per browser). */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { navigate, scopeKey, scopeOptions, store, useCore, type Page, type ScopeSel } from "../core";
import { attention, workCounts } from "./selectors";
import { personRows } from "../core/people";
import { query as queryFor } from "../core/query";
import { ICONS } from "../logic/data";

interface CtxTab { label: string; active: boolean; go: () => void; count?: string }

function usePopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 400)) });
    const off = (e: MouseEvent) => { if (!btn.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", key); };
  }, [open]);
  return { open, setOpen, pos, btn, pop };
}

function Pop({ p, children, width = 380, label }: { p: ReturnType<typeof usePopover>; children: ReactNode; width?: number; label: string }) {
  if (!p.open) return null;
  const host = (document.querySelector("[data-theme]") || document.body) as Element;
  return createPortal(
    <div ref={p.pop} className="tn-pop pk" role="dialog" aria-label={label} style={{ top: p.pos.top, left: p.pos.left, width }}>{children}</div>,
    host
  );
}

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);
const Glyph = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
);

/* ── Scope ─────────────────────────────────────────────────────────────── */

export function ScopeSwitch() {
  const { core, session, q } = useCore();
  const p = usePopover();
  const [group, setGroup] = useState("All");
  const opts = scopeOptions(core, q.viewer);
  const useful = opts.some((o) => o.sel.kind === "team" || o.sel.kind === "unit");
  if (!useful) return null;
  const T = core.config.terminology;
  const cur = opts.find((o) => o.key === scopeKey(session.scope)) || opts[0];
  const isPlanned = (id: string) => core.config.units.find((u) => u.id === id)?.status === "planned";
  const units = opts.filter((o) => o.sel.kind === "unit" && !isPlanned((o.sel as { id: string }).id));
  const groups = ["All", ...new Set(units.map((o) => core.config.units.find((u) => u.id === (o.sel as { id: string }).id)?.group).filter(Boolean) as string[])];
  const pick = (sel: ScopeSel) => { store.setScope(sel); p.setOpen(false); };
  // Computed through the query layer with that scope, so the numbers match the pages.
  const countsFor = (sel: ScopeSel) => {
    const { core: c, ctx } = store.get();
    const qq = queryFor(c, { ...ctx, scope: sel });
    return { open: qq.tasks().filter((t) => qq.isOpenTask(t)).length, attention: attention(qq).length };
  };
  const plannedUnits = core.config.units.filter((u) => u.status === "planned" && (q.viewer.isOrgWide || q.viewer.overseenUnitIds.includes(u.id)));
  const unitRows = units.filter((o) => {
    const u = core.config.units.find((x) => x.id === (o.sel as { id: string }).id);
    return group === "All" || u?.group === group;
  });
  const teams = opts.filter((o) => o.sel.kind === "team");
  return (
    <>
      <button ref={p.btn} type="button" className="tn-btn" aria-haspopup="dialog" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)}
        title={"Scope: " + cur.label} aria-label={"Switch " + T.unit.toLowerCase() + " or team. Current: " + cur.label}>
        <span className="tn-ico" style={{ color: "var(--accent)" }}><Glyph d={ICONS.orgs} size={15} /></span>
        <span className="tn-lbl">{cur.label}</span>
        <Chevron />
      </button>
      <Pop p={p} width={400} label="Scope">
        <div className="tn-eyebrow">{T.unit.toUpperCase()} SCOPE</div>
        {groups.length > 2 && (
          <div className="tn-seg" role="group" aria-label="Group">
            {groups.map((g) => <button key={g} type="button" aria-pressed={g === group} onClick={() => setGroup(g)}>{g}</button>)}
          </div>
        )}
        <div className="tn-list">
          {opts.filter((o) => o.sel.kind === "organisation").map((o) => {
            const c = countsFor(o.sel);
            return (
              <button key={o.key} type="button" className="tn-row" aria-current={o.key === cur.key} onClick={() => pick(o.sel)}>
                <span className="tn-radio" data-on={o.key === cur.key} />
                <span className="tn-main"><span className="tn-t">{o.label}</span>
                  <span className="tn-s">{units.length} {units.length === 1 ? T.unit.toLowerCase() : T.units.toLowerCase()} operating{plannedUnits.length ? " · " + plannedUnits.length + " planned" : ""}</span></span>
                <span className="tn-r">{c.open} open</span>
              </button>
            );
          })}
          {unitRows.map((o) => {
            const u = core.config.units.find((x) => x.id === (o.sel as { id: string }).id)!;
            const c = countsFor(o.sel);
            return (
              <button key={o.key} type="button" className="tn-row" aria-current={o.key === cur.key} onClick={() => pick(o.sel)}>
                <span className="tn-radio" data-on={o.key === cur.key} />
                <span className="tn-main"><span className="tn-t">{u.label}</span>
                  <span className="tn-s">{q.name(u.ownerId)} · {c.open} open · {c.attention} need attention</span></span>
                <span className="tn-r">{u.location || u.group || ""}</span>
              </button>
            );
          })}
          {group === "All" || plannedUnits.some((u) => u.group === group) ? plannedUnits.filter((u) => group === "All" || u.group === group).map((u) => (
            <div key={u.id} className="tn-row tn-row--off" aria-disabled="true">
              <span className="tn-radio tn-radio--dash" />
              <span className="tn-main"><span className="tn-t">{u.label}</span><span className="tn-s">{u.location || "Not operating yet"} · no work yet</span></span>
              <span className="tn-r">Planned</span>
            </div>
          )) : null}
        </div>
        {teams.length > 0 && (
          <>
            <div className="tn-eyebrow" style={{ marginTop: 10 }}>{T.teams.toUpperCase()}</div>
            <div className="tn-chips">
              {teams.map((o) => <button key={o.key} type="button" aria-pressed={o.key === cur.key} onClick={() => pick(o.sel)}>{o.label}</button>)}
              {opts.filter((o) => o.sel.kind === "personal").map((o) => <button key={o.key} type="button" aria-pressed={o.key === cur.key} onClick={() => pick(o.sel)}>My work</button>)}
            </div>
          </>
        )}
        {q.viewer.permissions.has("settings.edit") && (
          <button type="button" className="tn-foot" onClick={() => { p.setOpen(false); navigate({ page: "Settings", section: "structure" }); }}>
            <Glyph d="M12 5v14 M5 12h14" size={14} /> Add a {T.unit.toLowerCase()} or {T.team.toLowerCase()}
          </button>
        )}
      </Pop>
    </>
  );
}

/* ── Modules ───────────────────────────────────────────────────────────── */

interface ModuleItem { page: Page; label: string; icon: string; count?: number; divider?: boolean }

function moduleItems(): ModuleItem[] {
  const { core, q } = store.get();
  const wc = workCounts(q);
  const people = personRows(q);
  const peopleAttention = people.filter((r) => r.certIssue === "lapsed" || (r.probationDueDays !== null && r.probationDueDays <= 30) || r.docsOutstanding > 0).length;
  const caps = core.config.capabilities;
  return [
    { page: "Home", label: "Home", icon: ICONS.helios },
    { page: "Agents", label: "Agents", icon: ICONS.navAgents, count: caps.agents ? core.config.agents.filter((a) => a.enabled).length : undefined, divider: true },
    { page: "Dashboard", label: "Dashboard", icon: ICONS.navDash },
    { page: "Work", label: "Work", icon: ICONS.navWork, count: wc.tasks + wc.approvals + peopleAttention || undefined },
    { page: "Records", label: "Records", icon: ICONS.navRecords, count: q.issues().filter((i) => i.state === "open").length || undefined },
    { page: "Activity", label: "Activity", icon: ICONS.pulseLine, count: attention(q).length || undefined, divider: true },
    { page: "Settings", label: "Settings", icon: ICONS.navAdmin }
  ];
}

export function ModuleSwitch({ current }: { current: Page }) {
  useCore();
  const p = usePopover();
  const items = moduleItems();
  const cur = items.find((i) => i.page === current) || items[0];
  return (
    <>
      <button ref={p.btn} type="button" className="tn-btn" aria-haspopup="dialog" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)} aria-label={"Switch module. Current: " + cur.label}>
        <span className="tn-ico" style={{ color: "var(--accent)" }}><Glyph d={cur.icon} size={15} /></span>
        <span className="tn-lbl">{cur.label}</span>
        <Chevron />
      </button>
      <Pop p={p} width={330} label="Go to">
        <div className="tn-eyebrow">GO TO</div>
        <div className="tn-list">
          {items.map((i) => (
            <div key={i.page}>
              <button type="button" className="tn-mod" aria-current={i.page === current} onClick={() => { p.setOpen(false); navigate({ page: i.page }); }}>
                <span className="tn-ico"><Glyph d={i.icon} /></span>
                <span className="tn-t" style={{ flex: 1 }}>{i.label}</span>
                {i.count !== undefined && <span className="tn-count">{i.count}</span>}
                {i.page === current && <Check />}
              </button>
              {i.divider && <div className="tn-div" />}
            </div>
          ))}
        </div>
      </Pop>
    </>
  );
}

/* ── Pages ─────────────────────────────────────────────────────────────── */

export function PageSwitch({ module, tabs, asTabs, toggleTabs }: { module: string; tabs: CtxTab[]; asTabs: boolean; toggleTabs: () => void }) {
  const p = usePopover();
  if (!tabs.length) return null;
  const cur = tabs.find((t) => t.active) || tabs[0];
  return (
    <>
      <span className="tn-slash" aria-hidden="true">/</span>
      <button ref={p.btn} type="button" className="tn-btn tn-btn--page" aria-haspopup="dialog" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)} aria-label={"Switch page. Current: " + cur.label}>
        <span className="tn-lbl">{cur.label}</span>
        {cur.count && cur.count !== "0" && <span className="tn-count tn-count--hot">{cur.count}</span>}
        <Chevron />
      </button>
      <Pop p={p} width={320} label={module + " pages"}>
        <div className="tn-eyebrow">{module.toUpperCase()} · {tabs.length} PAGES</div>
        <div className="tn-list">
          {tabs.map((t) => (
            <button key={t.label} type="button" className="tn-mod" aria-current={t.active} onClick={() => { p.setOpen(false); t.go(); }}>
              <span className="tn-t" style={{ flex: 1 }}>{t.label}</span>
              {t.count && t.count !== "0" && <span className="tn-count">{t.count}</span>}
              {t.active && <Check />}
            </button>
          ))}
        </div>
        <div className="tn-div" />
        <button type="button" className="tn-foot" onClick={() => { p.setOpen(false); toggleTabs(); }}>
          <Glyph d={ICONS.files} size={14} /> {asTabs ? "Show pages as a menu instead" : "Show pages as tabs instead"}
        </button>
      </Pop>
    </>
  );
}
