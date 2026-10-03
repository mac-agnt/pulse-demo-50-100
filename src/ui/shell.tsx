/* Shell pieces driven by the core: the scope control in the top bar, the
   viewer card and role preview in the rail, and the scope-change notice. */

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

/** Rail card: who you are previewing as, and the sample-mode controls. */
export function ViewerCard({ open }: { open: boolean }) {
  const { core, session, q } = useCore();
  const [confirm, setConfirm] = useState<null | "sample" | "clean">(null);
  const me = q.viewer.person;
  const preview = core.mode === "sample" ? SAMPLE_PREVIEW_PEOPLE.filter((id) => core.data.people.some((p) => p.id === id)) : core.data.people.filter((p) => p.kind === "staff").map((p) => p.id);
  if (!open) {
    return (
      <div className="pk" title={me.name + " · " + (core.mode === "sample" ? "Sample data, role preview" : "Clean template")}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 0" }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{q.initials(me.id)}</span>
        <span className="pk-chip pk-tone-warn pk-chip--plain" style={{ fontSize: 9, height: 18, padding: "0 6px" }}>{core.mode === "sample" ? "SAMPLE" : "CLEAN"}</span>
      </div>
    );
  }
  return (
    <div className="pk" style={{ margin: "6px 4px 4px", padding: "14px 14px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="pk-eyebrow pk-grow">{core.mode === "sample" ? "Previewing as" : "Signed in (demo)"}</span>
        <span className="pk-chip pk-tone-warn pk-chip--plain" title="Sample data. Integrations, sign-in, AI and scheduling are simulated." style={{ fontSize: 9.5, height: 19 }}>
          {core.mode === "sample" ? "SAMPLE DATA" : "CLEAN TEMPLATE"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <span style={{ width: 36, height: 36, flex: "none", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600 }}>{q.initials(me.id)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roleLine(core, me.id)}</div>
        </div>
      </div>
      {preview.length > 1 && (
        <label style={{ display: "block", marginTop: 10 }}>
          <span className="pk-help" style={{ display: "block", marginBottom: 4 }}>Role preview (not sign-in)</span>
          <select className="pk-select" value={session.viewerId} onChange={(e) => store.setViewer(e.target.value)} style={{ height: 30, fontSize: 12 }}>
            {preview.map((id) => <option key={id} value={id}>{q.name(id)} · {roleLine(core, id)}</option>)}
          </select>
        </label>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {confirm ? (
          <>
            <span className="pk-help pk-grow" style={{ alignSelf: "center" }}>{confirm === "clean" ? "Switch to the empty template?" : "Reset sample data?"} Local changes are lost.</span>
            <button className="pk-btn pk-btn--sm pk-btn--primary" onClick={() => { store.reset(confirm); setConfirm(null); }}>Yes</button>
            <button className="pk-btn pk-btn--sm" onClick={() => setConfirm(null)}>No</button>
          </>
        ) : (
          <>
            <button className="pk-btn pk-btn--sm" style={{ flex: "1 1 auto", padding: "0 8px" }} onClick={() => setConfirm("sample")}>{core.mode === "sample" ? "Reset sample" : "Load sample"}</button>
            {core.mode === "sample" && <button className="pk-btn pk-btn--sm" style={{ flex: "1 1 auto", padding: "0 8px" }} onClick={() => setConfirm("clean")}>Clean template</button>}
          </>
        )}
      </div>
    </div>
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
