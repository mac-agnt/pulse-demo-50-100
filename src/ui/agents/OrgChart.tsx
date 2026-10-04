/* The organisation chart canvas: automatic top-down layout, orthogonal
   reporting connectors, zoom (buttons, ctrl or cmd with the wheel, + and -),
   pan (drag, wheel, arrow keys), fit to view, collapsible branches and an
   optional overlay of one run's runtime delegation drawn as dashed curves,
   never as reporting lines. The view position survives the side panel and
   switching tabs. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AgentFace from "../../components/AgentFace";
import { agentState, runTree, useCore, type AgentActivity, type AgentDef, type CoreState, type Id, type Q } from "../../core";
import { Icon } from "../kit";
import { AG_ICON, ActionMenu, AvailabilityPill, WorkSummary, agentActions, faceState, ownerAndScope, workText, type AgentNav } from "./shared";
import { connectorPath, delegationPath, layoutChart, type LNode } from "./layout";

interface View { x: number; y: number; k: number; fitted: boolean }
/* Kept outside the component so closing a panel or switching tabs returns to the same place. */
let memo: View = { x: 0, y: 0, k: 1, fitted: false };

const clampK = (k: number) => Math.min(1.6, Math.max(0.35, k));

export function OrgChart({ agents, isMatch, hits, selectedId, overlayRunId, nav, collapsed, onToggle, expandedGroups, onExpandGroup, forceOpen, fitSignal }: {
  agents: AgentDef[];
  isMatch: (a: AgentDef) => boolean;
  hits: Set<Id>;
  selectedId: Id | null;
  overlayRunId: Id | null;
  nav: AgentNav;
  collapsed: Set<Id>;
  onToggle: (id: Id) => void;
  expandedGroups: Set<Id>;
  onExpandGroup: (id: Id) => void;
  forceOpen: Set<Id>;
  fitSignal: number;
}) {
  const { core, q } = useCore();
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(memo);
  const [size, setSize] = useState({ w: 0, h: 560 });
  const [menuFor, setMenuFor] = useState<Id | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const layout = useMemo(() => layoutChart(agents, { collapsed, expandedGroups, forceOpen }), [agents, collapsed, expandedGroups, forceOpen]);
  const work = useMemo(() => new Map(agents.map((a) => [a.id, agentState(q, a.id)])), [agents, q]);
  const set = (v: View) => { memo = v; setView(v); };

  // The canvas fills the rest of the window height.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const h = Math.max(440, Math.round(window.innerHeight - top - 20));
      el.style.height = h + "px";
      setSize({ w: el.clientWidth, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  /* Fit to view. On first open the chart never goes below a readable 80%:
     it starts at the top, centred, and the rest is a pan or "Fit" away. */
  const fit = (readable = false) => {
    if (!size.w) return;
    const pad = 40;
    const whole = Math.min((size.w - pad * 2) / layout.width, (size.h - pad * 2) / layout.height, 1.05);
    const k = clampK(readable ? Math.max(whole, 0.8) : whole);
    set({ k, x: (size.w - layout.width * k) / 2, y: k > whole ? pad : Math.max(pad, (size.h - layout.height * k) / 2), fitted: true });
  };
  useEffect(() => { if (!memo.fitted && size.w > 0) fit(true); }, [size.w, size.h]);
  useEffect(() => { if (fitSignal) fit(false); }, [fitSignal]);

  const zoomAt = (factor: number, cx = size.w / 2, cy = size.h / 2) => {
    const k = clampK(view.k * factor);
    const r = k / view.k;
    set({ k, x: cx - (cx - view.x) * r, y: cy - (cy - view.y) * r, fitted: true });
  };

  // Wheel: ctrl or cmd zooms around the pointer; otherwise pans. Native listener so preventDefault works.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const k = clampK(memo.k * Math.exp(-e.deltaY * 0.0022));
        const ratio = k / memo.k;
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        set({ k, x: cx - (cx - memo.x) * ratio, y: cy - (cy - memo.y) * ratio, fitted: true });
      } else {
        set({ ...memo, x: memo.x - e.deltaX, y: memo.y - e.deltaY, fitted: true });
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== host.current) return;
    const step = 48;
    if (e.key === "ArrowLeft") set({ ...view, x: view.x + step });
    else if (e.key === "ArrowRight") set({ ...view, x: view.x - step });
    else if (e.key === "ArrowUp") set({ ...view, y: view.y + step });
    else if (e.key === "ArrowDown") set({ ...view, y: view.y - step });
    else if (e.key === "+" || e.key === "=") zoomAt(1.2);
    else if (e.key === "-") zoomAt(1 / 1.2);
    else if (e.key === "0") fit(false);
    else return;
    e.preventDefault();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".ag-node,.ag-group,.ag-canvas-ctl,.ag-legend")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    set({ ...view, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y, fitted: true });
  };
  const onPointerUp = () => { drag.current = null; setDragging(false); };

  // Bring the first search hit into view.
  const firstHit = [...hits][0];
  useEffect(() => {
    if (!firstHit || !size.w) return;
    const n = layout.byAgent.get(firstHit);
    if (!n) return;
    const sx = view.x + n.x * view.k, sy = view.y + n.y * view.k;
    if (sx < 0 || sy < 0 || sx + n.w * view.k > size.w || sy + n.h * view.k > size.h) {
      set({ ...view, x: size.w / 2 - (n.x + n.w / 2) * view.k, y: size.h / 3 - (n.y + n.h / 2) * view.k, fitted: true });
    }
  }, [firstHit, layout, size.w]);

  const overlay = useMemo(() => (overlayRunId ? runTree(core, overlayRunId) : null), [core, overlayRunId]);
  const overlayAgents = new Set(overlay?.runs.map((r) => r.agentId) || []);
  const transform: CSSProperties = { transform: "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")", width: layout.width, height: layout.height };

  return (
    <div ref={host} className="ag-canvas" tabIndex={0} role="region" onKeyDown={onKey} data-dragging={dragging || undefined}
      aria-label="Organisation chart. Arrow keys pan, plus and minus zoom, 0 fits the chart to the view."
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="ag-stage" style={transform}>
        <svg className="ag-wires" width={layout.width} height={layout.height + 80} aria-hidden="true">
          <defs>
            <marker id="ag-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--accent)" />
            </marker>
          </defs>
          {layout.edges.map((e) => <path key={e.parent.key} d={connectorPath(e.parent, e.kids)} className="ag-wire" />)}
          {overlay && overlay.edges.map((e) => {
            const a = layout.byAgent.get(e.from), b = layout.byAgent.get(e.to);
            return a && b ? <path key={e.runId} d={delegationPath(a, b)} className="ag-wire-run" markerEnd="url(#ag-arrow)" /> : null;
          })}
        </svg>
        {layout.nodes.map((n) => n.kind === "group"
          ? <GroupNode key={n.key} n={n} onExpand={() => onExpandGroup(n.parentKey!)} />
          : <AgentNode key={n.key} n={n} core={core} q={q} w={work.get(n.agent!.id)!} dim={!isMatch(n.agent!)} hit={hits.has(n.agent!.id)}
              selected={selectedId === n.agent!.id} inRun={overlayAgents.has(n.agent!.id)} menuOpen={menuFor === n.agent!.id}
              setMenu={(o) => setMenuFor(o ? n.agent!.id : null)} onToggle={() => onToggle(n.agent!.id)} nav={nav} />)}
        {overlay && overlay.workers.map((w) => {
          const run = overlay.runs.find((r) => r.id === w.runId);
          const n = run && layout.byAgent.get(run.agentId);
          if (!run || !n) return null;
          const i = run.workers.indexOf(w);
          return (
            <div key={w.id} className="ag-worker-chip" style={{ left: n.x + 12, top: n.y + n.h + 10 + i * 30 }} title={"Temporary worker in " + run.ref + ". " + (w.output || "")}>
              <span className="ag-worker-dot" aria-hidden="true" />{w.label}<em>{w.state === "active" ? "active" : w.state}</em>
            </div>
          );
        })}
      </div>
      <div className="ag-canvas-ctl" role="group" aria-label="Zoom">
        <button type="button" className="ag-icon-btn" onClick={() => zoomAt(1.2)} aria-label="Zoom in" title="Zoom in (ctrl or cmd with the wheel)"><Icon d={AG_ICON.zoomIn} size={15} /></button>
        <span className="ag-zoom" aria-live="polite">{Math.round(view.k * 100)}%</span>
        <button type="button" className="ag-icon-btn" onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out" title="Zoom out"><Icon d={AG_ICON.zoomOut} size={15} /></button>
        <button type="button" className="ag-icon-btn" onClick={() => fit(false)} aria-label="Fit to view" title="Fit to view (0)"><Icon d={AG_ICON.fit} size={15} /></button>
      </div>
      {overlay && (
        <div className="ag-legend" aria-label="Legend">
          <span><i className="ag-legend-line" />Reports to</span>
          <span><i className="ag-legend-run" />Delegated in this run</span>
          {overlay.workers.length > 0 && <span><i className="ag-legend-worker" />Temporary worker</span>}
        </div>
      )}
    </div>
  );
}

function AgentNode({ n, core, q, w, dim, hit, selected, inRun, menuOpen, setMenu, onToggle, nav }: {
  n: LNode; core: CoreState; q: Q; w: AgentActivity; dim: boolean; hit: boolean; selected: boolean; inRun: boolean;
  menuOpen: boolean; setMenu: (o: boolean) => void; onToggle: () => void; nav: AgentNav;
}) {
  const a = n.agent!;
  const text = workText(w);
  const cls = "ag-node" + (dim ? " ag-node--dim" : "") + (hit ? " ag-node--hit" : "") + (selected ? " ag-node--sel" : "") + (inRun ? " ag-node--run" : "") + (menuOpen ? " ag-node--menu" : "");
  return (
    <div className={cls} style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
      onContextMenu={(e) => { e.preventDefault(); setMenu(true); }}
      onKeyDown={(e) => { if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") { e.preventDefault(); setMenu(true); } }}>
      <div className="ag-node-top">
        <span className="ag-node-face"><AgentFace shape={a.shape} tint={a.tint} state={faceState(a, w)} size={38} /></span>
        <button type="button" className="ag-node-main" onClick={() => nav.openAgent(a.id)} aria-label={a.name + (a.archived ? ", archived" : "") + ". " + text + ". Open details"}>
          <span className="ag-node-name">{a.name}</span>
          <span className="ag-node-purpose">{a.purpose}</span>
        </button>
        <ActionMenu label={"Actions for " + a.name} open={menuOpen} onOpenChange={setMenu} items={agentActions(core, q, a, nav)} />
      </div>
      <div className="ag-node-status">
        <AvailabilityPill agent={a} />
        <WorkSummary w={w} compact={text.length > 24} />
      </div>
      <div className="ag-node-meta" title={ownerAndScope(core, a)}>{ownerAndScope(core, a)}</div>
      {n.childCount > 0 && (
        <button type="button" className="ag-node-toggle" onClick={onToggle} aria-expanded={!n.collapsed}
          aria-label={(n.collapsed ? "Expand " : "Collapse ") + a.name + "'s branch, " + n.childCount + " agent" + (n.childCount === 1 ? "" : "s")}>
          <Icon d={n.collapsed ? AG_ICON.chevRight : AG_ICON.chevDown} size={11} sw={2.2} />{n.childCount}
        </button>
      )}
    </div>
  );
}

function GroupNode({ n, onExpand }: { n: LNode; onExpand: () => void }) {
  const names = (n.hidden || []).map((a) => a.name);
  return (
    <button type="button" className="ag-group" style={{ left: n.x, top: n.y, width: n.w, height: n.h }} onClick={onExpand}
      aria-label={"Show " + names.length + " more agents: " + names.join(", ")}>
      <b>{names.length} more agents</b>
      <span>{names.slice(0, 3).join(", ")}{names.length > 3 ? " and " + (names.length - 3) + " more" : ""}</span>
    </button>
  );
}
