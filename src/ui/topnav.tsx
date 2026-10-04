/* The top bar: the module switcher (module title), a compact scope control
   next to it, then the module's pages. On desktop the pages are visible tabs
   by default; the page menu is for narrow screens or for people who choose
   "Pages as menu" (remembered per browser in PulseLogic). Global search stays
   its own control. The module switcher lists only enabled, permitted modules,
   grouped, and is where business modules are pinned to the side rail. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GROUP_LABEL, navigate, projectHealth, projectsFor, pageLabel, scopeKey, scopeOptions, store, useCore, visiblePages, type NavGroup, type PageId, type ScopeSel } from "../core";
import { attention, workCounts } from "./selectors";
import { pinnedPages, setPinned, usePinsVersion } from "./pins";
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

export function ScopeSwitch({ compact }: { compact?: boolean } = {}) {
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
      <button ref={p.btn} type="button" className={"tn-btn" + (compact ? " tn-btn--scope" : "")} aria-haspopup="dialog" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)}
        title={"Scope: " + cur.label + ". Applies to every page"} aria-label={"Scope: " + cur.label + ". Switch " + T.unit.toLowerCase() + " or team"}>
        <span className="tn-ico" style={{ color: compact ? "var(--dim)" : "var(--accent)" }}><Glyph d={ICONS.orgs} size={compact ? 13 : 15} /></span>
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

interface ModuleItem { page: PageId; label: string; icon: string; group: NavGroup; count?: number; countTitle?: string }

/** Small counts that help someone act, computed through the query layer in the current scope. */
function countFor(page: PageId): { n?: number; title?: string } {
  const { core, q } = store.get();
  const d = core.data;
  const nz = (n: number) => (n > 0 ? n : undefined);
  switch (page) {
    case "Work": { const wc = workCounts(q); return { n: nz(wc.mine + wc.approvals), title: "Your open tasks and decisions waiting on you" }; }
    case "Records": return { n: nz(q.issues().filter((i) => i.state === "open").length), title: "Open data issues" };
    case "Activity": return { n: nz(attention(q).length), title: "Items that need attention" };
    case "Agents": return { n: nz(d.agentRuns.filter((r) => r.state === "failed" || r.state === "waiting_approval").length), title: "Agent runs failed or waiting for approval" };
    case "People": {
      const rows = personRows(q);
      return { n: nz(rows.filter((r) => r.certIssue === "lapsed" || (r.probationDueDays !== null && r.probationDueDays <= 30) || r.docsOutstanding > 0).length), title: "People with an action due" };
    }
    case "Projects": return { n: nz(projectsFor(q).filter((p) => p.status === "active" && projectHealth(core, p, q.ctx.now).health !== "on_track").length), title: "Active projects at risk or off track" };
    case "Purchasing": return { n: nz(d.invoices.filter((i) => i.status === "exception").length), title: "Supplier invoices with a matching exception" };
    case "Standards": return { n: nz(d.obligations.filter((o) => o.state === "missing" || o.state === "rejected" || o.state === "expired").length), title: "Requirements missing, rejected or expired" };
    default: return {};
  }
}

function moduleItems(): ModuleItem[] {
  const { core, session } = store.get();
  return visiblePages(core, session.viewerId).map((p) => {
    const c = countFor(p.id);
    return { page: p.id, label: pageLabel(core.config, p.id), icon: ICONS[p.icon as keyof typeof ICONS] || ICONS.files, group: p.group, count: c.n, countTitle: c.title };
  });
}

const PinGlyph = ({ on }: { on: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z M12 14v6" />
  </svg>
);

export function ModuleSwitch({ current, pagesAsTabs, toggleTabs, canTabs }: { current: PageId; pagesAsTabs?: boolean; toggleTabs?: () => void; canTabs?: boolean }) {
  const { core, session } = useCore();
  usePinsVersion();
  const p = usePopover();
  const items = moduleItems();
  const cur = items.find((i) => i.page === current) || { page: current, label: pageLabel(core.config, current), icon: ICONS.navAdmin, group: "shared" as NavGroup };
  const pinned = pinnedPages(core, session.viewerId);
  const groups: NavGroup[] = ["daily", "business", "shared"];
  const go = (page: PageId) => { p.setOpen(false); navigate({ page }); };
  const hasBusiness = items.some((i) => i.group === "business");
  return (
    <>
      <button ref={p.btn} type="button" className="tn-btn tn-btn--module" aria-haspopup="dialog" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)} aria-label={"Switch module. Current: " + cur.label}>
        <span className="tn-ico" style={{ color: "var(--accent)" }}><Glyph d={cur.icon} size={15} /></span>
        <span className="tn-lbl">{cur.label}</span>
        <Chevron />
      </button>
      <Pop p={p} width={340} label="Modules">
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g && i.page !== "Settings");
          if (!list.length) return null;
          return (
            <div key={g} className="tn-group">
              <div className="tn-eyebrow">{GROUP_LABEL[g]}</div>
              <div className="tn-list">
                {list.map((i) => {
                  const isPinned = pinned.includes(i.page);
                  return (
                    <div key={i.page} className="tn-modrow">
                      <button type="button" className="tn-mod" aria-current={i.page === current} onClick={() => go(i.page)}>
                        <span className="tn-ico"><Glyph d={i.icon} /></span>
                        <span className="tn-t" style={{ flex: 1 }}>{i.label}</span>
                        {i.count !== undefined && <span className="tn-count" title={i.countTitle}>{i.count}</span>}
                        {i.page === current && <Check />}
                      </button>
                      {g === "business" && (
                        <button type="button" className="tn-pin" aria-pressed={isPinned}
                          title={isPinned ? "Unpin from the side rail" : "Pin to the side rail"}
                          aria-label={(isPinned ? "Unpin " : "Pin ") + i.label + (isPinned ? " from" : " to") + " the side rail"}
                          onClick={() => setPinned(core, session.viewerId, i.page, !isPinned)}>
                          <PinGlyph on={isPinned} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {g === "business" && <div className="tn-note">Pinned modules sit in the side rail. The rest stay here.</div>}
            </div>
          );
        })}
        {!hasBusiness && <div className="tn-note">No business modules are switched on. An administrator can enable them in Settings, Modules and labels.</div>}
        <div className="tn-div" />
        <button type="button" className="tn-mod" aria-current={current === "Settings"} onClick={() => go("Settings")}>
          <span className="tn-ico"><Glyph d={ICONS.navAdmin} /></span>
          <span className="tn-t" style={{ flex: 1 }}>Settings</span>
          {current === "Settings" && <Check />}
        </button>
        {canTabs && toggleTabs && (
          <button type="button" className="tn-foot" onClick={() => { p.setOpen(false); toggleTabs(); }}>
            <Glyph d={ICONS.files} size={14} /> {pagesAsTabs ? "Show pages as a menu" : "Show pages as tabs"}
          </button>
        )}
      </Pop>
    </>
  );
}

/* ── Pages ─────────────────────────────────────────────────────────────── */

/** Page menu: narrow screens, or when someone chose "Pages as menu" on desktop. */
export function PageSwitch({ module, tabs, toggleTabs, canTabs }: { module: string; tabs: CtxTab[]; asTabs?: boolean; toggleTabs?: () => void; canTabs?: boolean }) {
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
        <div className="tn-eyebrow">{module.toUpperCase()} PAGES</div>
        <div className="tn-list">
          {tabs.map((t) => (
            <button key={t.label} type="button" className="tn-mod" aria-current={t.active} onClick={() => { p.setOpen(false); t.go(); }}>
              <span className="tn-t" style={{ flex: 1 }}>{t.label}</span>
              {t.count && t.count !== "0" && <span className="tn-count">{t.count}</span>}
              {t.active && <Check />}
            </button>
          ))}
        </div>
        {canTabs && toggleTabs && (
          <>
            <div className="tn-div" />
            <button type="button" className="tn-foot" onClick={() => { p.setOpen(false); toggleTabs(); }}>
              <Glyph d={ICONS.files} size={14} /> Show pages as tabs
            </button>
          </>
        )}
      </Pop>
    </>
  );
}
