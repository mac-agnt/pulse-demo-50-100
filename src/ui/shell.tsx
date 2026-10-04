/* Shell pieces driven by the core: the scope control, the scope-change notice,
   the discreet demo indicator with its Demo menu (role preview, reset, clean
   template) and the viewer chip in the top bar. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { scopeKey, scopeOptions, store, useCore, viewerOf } from "../core";
import { SAMPLE_PREVIEW_PEOPLE } from "../core/fixtures/sample";
import { Icon, ICON } from "./kit";

/** Hidden when there is only one useful scope (no team or unit to switch to). */
export function ScopeControl() {
  const { core, session, q } = useCore();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const opts = scopeOptions(core, q.viewer);
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 276) });
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!opts.some((o) => o.sel.kind === "team" || o.sel.kind === "unit")) return null;
  const cur = opts.find((o) => o.key === scopeKey(session.scope)) || opts[0];
  return (
    <div ref={ref} className="pk" style={{ position: "relative", flex: "none" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={"Scope: " + cur.label + ". Change scope"}
        title="Scope applies to Home, Dashboard, Work, Records and Activity"
        style={{ height: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 12px 0 14px", borderRadius: 999, border: "1px solid var(--border)",
          background: "var(--surface-2)", color: "var(--ink)", font: "inherit", fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", maxWidth: 220 }}>
        <span className="pk-eyebrow" style={{ fontSize: 8.5 }}>Scope</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{cur.label}</span>
        <Icon d={ICON.down} size={12} sw={2} />
      </button>
      {open && pos && createPortal(
        <div ref={menu} className="pk-menu pk" role="listbox" aria-label="Scope" style={{ position: "fixed", top: pos.top, left: Math.max(8, pos.left), right: "auto", minWidth: 260, zIndex: 90 }}>
          {opts.map((o) => (
            <button key={o.key} role="option" aria-selected={o.key === cur.key} onClick={() => { store.setScope(o.sel); setOpen(false); }}
              style={{ height: "auto", padding: "8px 10px", flexDirection: "column", alignItems: "flex-start", gap: 2, background: o.key === cur.key ? "var(--accent-faint)" : undefined }}>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>{o.label}</span>
              <span style={{ fontSize: 11, color: "var(--faint)" }}>{o.detail}</span>
            </button>
          ))}
        </div>,
        (document.querySelector("[data-theme]") || document.body) as Element
      )}
    </div>
  );
}

export function ScopeNotice() {
  const { session } = useCore();
  if (!session.scopeNotice) return null;
  return (
    <div className="pk" role="status" style={{ position: "relative", zIndex: 4, margin: "10px 28px 0", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      borderRadius: "var(--r-md,12px)", background: "var(--warn-soft)", color: "var(--body)", fontSize: 12.5 }}>
      <span style={{ color: "var(--warn)" }}><Icon d={ICON.info} size={14} /></span>
      <span className="pk-grow">{session.scopeNotice}</span>
      <button className="pk-btn pk-btn--ghost pk-btn--sm" onClick={() => store.setSession({ scopeNotice: null })}>Dismiss</button>
    </div>
  );
}

function roleLine(core: ReturnType<typeof useCore>["core"], personId: string) {
  const v = viewerOf(core, personId);
  const r = v.roles.find((x) => x.roleId !== "contributor") || v.roles[0];
  if (!r) return "No role";
  const label = core.config.roles.find((x) => x.id === r.roleId)?.label || r.roleId;
  const where = r.scope.kind === "team" ? core.config.teams.find((t) => t.id === (r.scope as { teamId: string }).teamId)?.label
    : r.scope.kind === "unit" ? core.config.units.find((u) => u.id === (r.scope as { unitId: string }).unitId)?.label : "";
  return label + (where ? ", " + where : "");
}

/** The one persistent demo indicator: a discreet pill in the rail that says
    which data is loaded and opens the Demo menu (role preview, reset, clean
    template). Replaces the large "Previewing as" card. */
export function DemoIndicator({ open }: { open: boolean }) {
  const { core, q } = useCore();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({ left: 16, bottom: 80 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const sample = core.mode === "sample";
  const label = sample ? "Sample data" : "Clean template";
  useEffect(() => {
    if (!show) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 308)), bottom: Math.max(8, window.innerHeight - r.top + 8) });
    const off = (e: MouseEvent) => { if (!btn.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setShow(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setShow(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [show]);
  const me = q.viewer.person;
  return (
    <>
      <button ref={btn} type="button" className={"dm-pill" + (open ? "" : " dm-pill--shut") + (sample ? "" : " dm-pill--clean")}
        aria-haspopup="dialog" aria-expanded={show} onClick={() => setShow(!show)}
        title={label + ". Previewing as " + me.name + ". Open the Demo menu"} aria-label={label + ". Previewing as " + me.name + ". Open the Demo menu"}>
        {open ? (<><span className="dm-dot" aria-hidden="true" /><span>{label}</span><span className="dm-who">{me.name.split(" ")[0]}</span></>) : (sample ? "DEMO" : "CLEAN")}
      </button>
      {show && createPortal(
        <div ref={menu} className="dm-menu pk" role="dialog" aria-label="Demo" style={{ left: pos.left, bottom: pos.bottom }}>
          <DemoMenu onDone={() => setShow(false)} />
        </div>,
        (document.querySelector("[data-theme]") || document.body) as Element
      )}
    </>
  );
}

function DemoMenu({ onDone }: { onDone: () => void }) {
  const { core, session, q } = useCore();
  const [confirm, setConfirm] = useState<null | "sample" | "clean">(null);
  const sample = core.mode === "sample";
  const me = q.viewer.person;
  const preview = sample ? SAMPLE_PREVIEW_PEOPLE.filter((id) => core.data.people.some((p) => p.id === id))
    : core.data.people.filter((p) => p.kind === "staff").map((p) => p.id);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="pk-eyebrow pk-grow">Demo</span>
        <span className={"pk-chip pk-chip--plain " + (sample ? "pk-tone-warn" : "pk-tone-neutral")} style={{ fontSize: 10 }}>{sample ? "Sample data" : "Clean template"}</span>
      </div>
      <div className="dm-row">
        <span style={{ width: 32, height: 32, flex: "none", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{q.initials(me.id)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roleLine(core, me.id)}</div>
        </div>
      </div>
      {preview.length > 1 && (
        <label style={{ display: "block", marginTop: 12 }}>
          <span className="pk-help" style={{ display: "block", marginBottom: 4 }}>Role preview (not sign-in)</span>
          <select className="pk-select" value={session.viewerId} onChange={(e) => store.setViewer(e.target.value)} style={{ height: 32, fontSize: 12.5 }}>
            {preview.map((id) => <option key={id} value={id}>{q.name(id)}, {roleLine(core, id)}</option>)}
          </select>
        </label>
      )}
      <div className="dm-note">Role preview shows what each role can see and do. It is not authentication.</div>
      {confirm ? (
        <div className="dm-actions" role="alertdialog" aria-label="Confirm">
          <span className="pk-help">{confirm === "clean" ? "Switch to the empty clean template?" : sample ? "Reset the sample data?" : "Load the sample data?"} Local changes in this browser are lost.</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="pk-btn pk-btn--sm pk-btn--primary" onClick={() => { store.reset(confirm); setConfirm(null); onDone(); }}>
              {confirm === "clean" ? "Switch to clean template" : sample ? "Reset sample" : "Load sample"}
            </button>
            <button type="button" className="pk-btn pk-btn--sm" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="dm-actions">
          <button type="button" className="pk-btn pk-btn--sm" onClick={() => setConfirm("sample")}>{sample ? "Reset sample data" : "Load sample data"}</button>
          {sample && <button type="button" className="pk-btn pk-btn--sm" onClick={() => setConfirm("clean")}>Switch to clean template</button>}
        </div>
      )}
      <div className="dm-note">{sample
        ? "Sample organisation, stored only in this browser. Connections, sign-in, AI and scheduling are simulated; Settings, Connections says what each needs."
        : "Empty template with no sample people, records or agents. Stored only in this browser."}</div>
    </>
  );
}

/** Top-bar chip for the current viewer (replaces the static profile). */
export function ViewerChip({ showText }: { showText: boolean }) {
  const { core, q } = useCore();
  const me = q.viewer.person;
  return (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 9, height: 42, padding: "0 12px 0 6px", borderRadius: 999 }} title={me.name}>
      <span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{q.initials(me.id)}</span>
      {showText && (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, whiteSpace: "nowrap" }}>{me.name}</div>
          <div style={{ fontSize: 10.5, color: "var(--faint)", lineHeight: 1.2, whiteSpace: "nowrap" }}>{roleLine(core, me.id)}</div>
        </div>
      )}
    </div>
  );
}

export function BrandName() {
  const { core } = useCore();
  return <>{core.config.workspace.name}</>;
}

export function BrandMark() {
  const { core } = useCore();
  return <>{core.config.workspace.shortName.slice(0, 2)}</>;
}
