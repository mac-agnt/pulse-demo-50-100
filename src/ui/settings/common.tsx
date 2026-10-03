/* Shared pieces for the settings editors: local drafts with an unsaved-changes
   guard, the save bar, read-only handling, toggles, check lists and the
   preview box. Every editor saves through ops (updateConfig or an org op). */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { can, ops, store, useCore, type OrgConfig, type Permission, type RoleScope, type CoreState } from "../../core";
import { Button, Icon, ICON } from "../kit";

/* ── Unsaved-changes registry ──────────────────────────────────────────── */

export const DirtyCtx = createContext<{ set: (key: string, dirty: boolean) => void }>({ set: () => {} });

let dirtySeq = 0;

/** Report that this editor holds unsaved input, so switching section asks first. */
export function useDirty(dirty: boolean) {
  const ctx = useContext(DirtyCtx);
  const key = useRef("d" + (++dirtySeq)).current;
  useEffect(() => { ctx.set(key, dirty); }, [dirty]);
  useEffect(() => () => ctx.set(key, false), []);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T,>(v: T): T => (v === undefined ? v : structuredClone(v));

/** A local draft of some configuration. It follows the saved value until the
    user edits it, then stays put until saved or discarded. */
export function useDraft<T>(source: T) {
  const [draft, setDraft] = useState<T>(() => clone(source));
  const last = useRef(JSON.stringify(source));
  const srcStr = JSON.stringify(source);
  useEffect(() => {
    if (srcStr === last.current) return;
    // Someone saved: if we were not editing, follow the new saved value.
    setDraft((d) => (JSON.stringify(d) === last.current ? clone(source) : d));
    last.current = srcStr;
  }, [srcStr]);
  const dirty = !same(draft, source);
  useDirty(dirty);
  return {
    draft,
    dirty,
    set: setDraft,
    update(fn: (d: T) => void) {
      setDraft((d) => { const n = clone(d); fn(n); return n; });
    },
    reset() { setDraft(clone(source)); }
  };
}

/* ── Permission ────────────────────────────────────────────────────────── */

export function useCanEdit() {
  const { q } = useCore();
  return can(q.viewer, "settings.edit");
}

export function ReadOnlyLine({ text }: { text?: string }) {
  return (
    <div className="st-readonly" role="note">
      <Icon d={ICON.lock} size={13} />
      <span>{text || "Only administrators can change this. You are seeing the current values."}</span>
    </div>
  );
}

/* ── Save bar ──────────────────────────────────────────────────────────── */

export function SaveBar({ dirty, onSave, onDiscard, errors = 0, saveLabel = "Save changes" }: {
  dirty: boolean; onSave: () => void; onDiscard: () => void; errors?: number; saveLabel?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="st-savebar" role="region" aria-label="Unsaved changes">
      <span style={{ fontSize: 12.5, fontWeight: 500 }}>Unsaved changes</span>
      {errors > 0 && <span className="pk-error">{errors === 1 ? "1 field needs fixing before you can save." : errors + " fields need fixing before you can save."}</span>}
      <span className="pk-grow" />
      <Button variant="ghost" onClick={onDiscard}>Discard</Button>
      <Button variant="primary" onClick={onSave} disabled={errors > 0} title={errors > 0 ? "Fix the highlighted fields first" : undefined}>{saveLabel}</Button>
    </div>
  );
}

/** Save configuration through the shared operation. Returns true on success. */
export function saveConfig(apply: (c: OrgConfig) => string | void, summary: string): boolean {
  const res = store.run(ops.updateConfig, apply, summary);
  if (res.ok) store.revalidate();
  return res.ok;
}

/* ── Inputs ────────────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label, disabled, title }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <label className="st-toggle" title={title}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} aria-checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function CheckList({ options, value, onChange, disabled, label }: {
  options: { value: string; label: string; disabled?: boolean; note?: string }[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean; label: string;
}) {
  if (!options.length) return <div className="pk-help">None available.</div>;
  return (
    <div className="st-checks" role="group" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className="st-check" title={o.note}>
          <input type="checkbox" checked={value.includes(o.value)} disabled={disabled || o.disabled}
            onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function NumberInput({ id, value, onChange, invalid, ariaLabel, disabled, min, step }: {
  id?: string; value: number | null | undefined; onChange: (v: number | null) => void; invalid?: boolean; ariaLabel?: string; disabled?: boolean; min?: number; step?: number;
}) {
  return (
    <input id={id} className="pk-input" type="number" inputMode="decimal" min={min} step={step} disabled={disabled} aria-label={ariaLabel} aria-invalid={invalid || undefined}
      value={value === null || value === undefined || Number.isNaN(value) ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
  );
}

/** Pick one item of a list inside a section (forms, rules, templates). */
export function ItemPicker({ items, value, onChange, label, after }: {
  items: { id: string; label: string; note?: string }[]; value: string | null; onChange: (id: string) => void; label: string; after?: ReactNode;
}) {
  return (
    <div className="st-pick" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={it.id === value} onClick={() => onChange(it.id)}>
          {it.label || "Untitled"}{it.note && <span className="pk-count">{it.note}</span>}
        </button>
      ))}
      {after}
    </div>
  );
}

export function Preview({ title = "Preview", children }: { title?: string; children: ReactNode }) {
  return <div className="st-preview" aria-live="polite"><span className="pk-eyebrow">{title}</span>{children}</div>;
}

export function SubHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="st-row" style={{ marginTop: 4 }}>
      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, flex: 1, minWidth: 0 }}>{children}</h3>
      {right}
    </div>
  );
}

/** Small inline confirmation, used instead of window.confirm. */
export function InlineConfirm({ children, confirmLabel, onConfirm, onCancel, cancelLabel = "Cancel", danger }: {
  children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; cancelLabel?: string; danger?: boolean;
}) {
  return (
    <div className="st-confirm" role="alertdialog" aria-live="assertive">
      <div className="pk-grow" style={{ minWidth: 200 }}>{children}</div>
      <Button size="sm" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
      <Button size="sm" variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

export const PERM_LABEL: Record<Permission, string> = {
  "records.view": "View records",
  "records.edit": "Edit records",
  "records.merge": "Merge records",
  "tasks.manage": "Assign and manage tasks",
  "approvals.decide": "Decide approvals",
  "approvals.delegate": "Delegate approvals",
  "workflows.operate": "Operate workflow runs",
  "settings.edit": "Change settings",
  "export": "Export data",
  "audit.view": "View audit history",
  "agents.manage": "Manage agents",
  "views.share": "Share saved views"
};
export const PERMISSIONS = Object.keys(PERM_LABEL) as Permission[];

/** A new id that does not collide with the given ones. */
export function newId(prefix: string, existing: string[], label?: string) {
  const base = prefix + "-" + ((label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "new");
  let id = base, n = 2;
  while (existing.includes(id)) id = base + "-" + n++;
  return id;
}

/** A field key from a label: "Needed by" becomes "neededBy". */
export function keyFromLabel(label: string, existing: string[]) {
  const words = label.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const base = words.length ? words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("") : "field";
  let k = base, n = 2;
  while (existing.includes(k)) k = base + n++;
  return k;
}

export function scopeText(s: CoreState, sc: RoleScope) {
  const T = s.config.terminology;
  if (sc.kind === "organisation") return T.organisation;
  if (sc.kind === "unit") return T.unit + ": " + (s.config.units.find((u) => u.id === sc.unitId)?.label || "Unknown");
  return T.team + ": " + (s.config.teams.find((t) => t.id === sc.teamId)?.label || "Unknown");
}

export const isValidTimezone = (tz: string) => {
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return !!tz.trim(); } catch { return false; }
};

/** Count of entries in an error map. */
export const errCount = (e: Record<string, string | undefined>) => Object.values(e).filter(Boolean).length;

export function moveItem<T>(list: T[], i: number, by: -1 | 1) {
  const j = i + by;
  if (j < 0 || j >= list.length) return;
  const [x] = list.splice(i, 1);
  list.splice(j, 0, x);
}

export function staffOptions(s: CoreState, includeEmpty?: string) {
  const out = s.data.people.filter((p) => p.kind === "staff" && p.status !== "suspended").map((p) => ({ value: p.id, label: p.name }));
  return includeEmpty !== undefined ? [{ value: "", label: includeEmpty }, ...out] : out;
}

export function roleOptions(s: CoreState) {
  return s.config.roles.map((r) => ({ value: r.id, label: r.label }));
}

/** Edit a list of short strings (permitted actions, checklist items). */
export function ListEditor({ items, onChange, label, placeholder, disabled, addLabel = "Add" }: {
  items: string[]; onChange: (v: string[]) => void; label: string; placeholder?: string; disabled?: boolean; addLabel?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} role="group" aria-label={label}>
      {items.length === 0 && <div className="pk-help">None yet.</div>}
      {items.map((it, i) => (
        <div key={i} className="st-row" style={{ flexWrap: "nowrap" }}>
          <div className="pk-grow">
            <input className="pk-input" aria-label={label + " " + (i + 1)} value={it} placeholder={placeholder} disabled={disabled}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
          <Button size="sm" variant="ghost" disabled={disabled} aria-label={"Remove " + label.toLowerCase() + " " + (i + 1)} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <div><Button size="sm" disabled={disabled} onClick={() => onChange([...items, ""])}>{addLabel}</Button></div>
    </div>
  );
}

/** Text input that commits a comma-separated list on blur, so typing commas works. */
export function CommaInput({ value, onCommit, ariaLabel, disabled, placeholder }: { value: string[]; onCommit: (v: string[]) => void; ariaLabel: string; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState(value.join(", "));
  const joined = value.join(", ");
  useEffect(() => { setText(joined); }, [joined]);
  return (
    <input className="pk-input" aria-label={ariaLabel} value={text} disabled={disabled} placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.split(",").map((x) => x.trim()).filter(Boolean))} />
  );
}

/** Disables every control inside for viewers who cannot edit. */
export function Lock({ on, children }: { on: boolean; children: ReactNode }) {
  return <fieldset className="st-fieldset" disabled={on}>{children}</fieldset>;
}
