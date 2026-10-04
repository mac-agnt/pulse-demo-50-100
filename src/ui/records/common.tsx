/* Shared pieces for the Records area: field formatting, origin chips, the
   inline field editor (with the authority outcome shown before saving),
   focus hand-off and small list helpers. */

import { useEffect, useState, type ReactNode } from "react";
import { useCore, store, ops, can, isEmpty, relative, fmtDateTime, openObject, type Focus } from "../../core";
import type {
  ActorKind, CoreState, DataIssue, FieldDef, FieldMeta, FieldValue, Id, RecordItem, RecordTypeDef, Tone, Viewer
} from "../../core";
import type { Q } from "../../core";
import { Button, Chip, Field, Select, TextArea, TextInput, Notice } from "../kit";
import "../../styles/records.css";

/* ── Lookups ───────────────────────────────────────────────────────────── */

export const typeOf = (core: CoreState, typeId: string): RecordTypeDef | undefined =>
  core.config.recordTypes.find((t) => t.id === typeId);

export function statusOf(core: CoreState, r: RecordItem): { label: string; tone: Tone } {
  const st = typeOf(core, r.typeId)?.statuses.find((s) => s.id === r.status);
  if (st) return { label: st.label, tone: st.tone };
  return { label: r.status.charAt(0).toUpperCase() + r.status.slice(1).replace(/_/g, " "), tone: "neutral" };
}

export function RecordStatus({ r }: { r: RecordItem }) {
  const { core } = useCore();
  const s = statusOf(core, r);
  return <Chip tone={s.tone}>{s.label}</Chip>;
}

export function sourceLabel(core: CoreState, id?: string | null): string {
  if (!id || id === "pulse") return "Pulse";
  return core.config.sources.find((s) => s.id === id)?.label || id;
}

export const VISIBILITY_LABEL: Record<string, string> = {
  organisation: "Whole organisation", unit: "Unit members", team: "Team members", owner: "Owner only"
};

export const ACTOR_LABEL: Record<ActorKind, string> = { person: "Person", agent: "Agent", system: "System", source: "Source" };
export const ACTOR_TONE: Record<ActorKind, Tone> = { person: "neutral", agent: "accent", system: "neutral", source: "warn" };

export const ISSUE_STATE_LABEL: Record<DataIssue["state"], string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed" };
export const ISSUE_STATE_TONE: Record<DataIssue["state"], Tone> = { open: "warn", in_progress: "accent", resolved: "ok", dismissed: "neutral" };
export const SEVERITY_LABEL: Record<DataIssue["severity"], string> = { high: "High", medium: "Medium", low: "Low" };

export const isOpenIssue = (i: DataIssue) => i.state === "open" || i.state === "in_progress";

/* ── Formatting ────────────────────────────────────────────────────────── */

/** Day with year, in the configured timezone. */
export function fmtDay(at: string | null | undefined, tz: string): string {
  if (!at) return "None";
  const d = new Date(at.length === 10 ? at + "T12:00:00Z" : at);
  if (isNaN(d.getTime())) return String(at);
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** A field value as text, or null when it is missing. */
export function fmtField(core: CoreState, q: Q, def: FieldDef | undefined, v: FieldValue | undefined): string | null {
  if (isEmpty(v ?? null)) return null;
  const tz = core.config.timezone;
  if (!def) return String(v);
  switch (def.kind) {
    case "date": return fmtDay(String(v), tz);
    case "money": {
      const n = typeof v === "number" ? v : Number(v);
      if (!isFinite(n)) return String(v);
      try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: def.currency || "EUR", maximumFractionDigits: 2 }).format(n); }
      catch { return String(n); }
    }
    case "number": return typeof v === "number" ? v.toLocaleString("en-GB") : String(v);
    case "select": return def.options?.find((o) => o.value === v)?.label || String(v);
    case "person": return q.name(String(v));
    case "record": { const r = q.record(String(v)); return r ? r.ref + " " + r.title : "Record not available"; }
    case "file": return q.file(String(v))?.title || "File not available";
    default: return String(v);
  }
}

export function FieldText({ def, value }: { def: FieldDef | undefined; value: FieldValue | undefined }) {
  const { core, q } = useCore();
  const t = fmtField(core, q, def, value);
  return t === null ? <span className="pk-faint">Missing</span> : <>{t}</>;
}

export function OriginChip({ meta }: { meta?: FieldMeta }) {
  const { core } = useCore();
  if (!meta) return null;
  if (meta.origin === "source") return <Chip tone="neutral" plain title={meta.sourceUpdatedAt ? "Updated at source " + fmtDateTime(meta.sourceUpdatedAt, core.config.timezone) : undefined}>Source: {sourceLabel(core, meta.sourceId)}</Chip>;
  if (meta.origin === "estimate") return <Chip tone="warn" plain>Estimate</Chip>;
  return <Chip tone="neutral" plain>Manual</Chip>;
}

export function When({ at }: { at?: string | null }) {
  const { core, ctx } = useCore();
  if (!at) return <span className="pk-faint">None</span>;
  return <span title={fmtDateTime(at, core.config.timezone)}>{relative(at, ctx.now, core.config.timezone)}</span>;
}

/* ── Field editor ──────────────────────────────────────────────────────── */

export function coerce(def: FieldDef, raw: string): FieldValue {
  const t = raw.trim();
  if (t === "") return null;
  if (def.kind === "number" || def.kind === "money") {
    const n = Number(t);
    return isFinite(n) ? n : t;
  }
  return def.kind === "longtext" ? raw : t;
}

export const toRaw = (def: FieldDef, v: FieldValue | undefined) =>
  v === null || v === undefined ? "" : def.kind === "date" ? String(v).slice(0, 10) : String(v);

/** One input for a configured field, by its kind. */
export function FieldInput({ def, id, value, onChange, invalid }: { def: FieldDef; id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const { q } = useCore();
  if (def.kind === "select") {
    return <Select id={id} value={value} onChange={onChange} invalid={invalid}
      options={[{ value: "", label: def.options?.length ? "Choose" : "No options configured" }, ...(def.options || [])]} />;
  }
  if (def.kind === "person") {
    return <Select id={id} value={value} onChange={onChange} invalid={invalid}
      options={[{ value: "", label: "Choose a person" }, ...q.people().filter((p) => p.status !== "suspended").map((p) => ({ value: p.id, label: p.name }))]} />;
  }
  if (def.kind === "record") {
    return <Select id={id} value={value} onChange={onChange} invalid={invalid}
      options={[{ value: "", label: "Choose a record" }, ...q.records({ ignoreScope: true }).map((r) => ({ value: r.id, label: r.ref + " " + r.title }))]} />;
  }
  if (def.kind === "file") {
    return <Select id={id} value={value} onChange={onChange} invalid={invalid}
      options={[{ value: "", label: "Choose a file" }, ...q.files({ ignoreScope: true }).map((f) => ({ value: f.id, label: f.title }))]} />;
  }
  if (def.kind === "longtext") return <TextArea id={id} value={value} onChange={onChange} invalid={invalid} rows={3} />;
  const type = def.kind === "date" ? "date" : def.kind === "number" || def.kind === "money" ? "number" : def.kind === "email" ? "email" : "text";
  return <TextInput id={id} type={type} value={value} onChange={onChange} invalid={invalid} />;
}

/** What happens to a saved value, in words, before the user saves. */
export function authorityText(core: CoreState, r: RecordItem, field: string): { tone: Tone; text: string } {
  const a = ops.authorityOf(core, r, field);
  if (a.kind === "pulse") return { tone: "neutral", text: "Saved in Pulse only. " + a.label };
  if (a.kind === "writeback") return { tone: "accent", text: a.label };
  return { tone: "warn", text: "Saved in Pulse, pending source review. " + a.label };
}

/** Inline editor for one record field. Validates, states the authority outcome, then saves through ops. */
export function FieldEditor({ record, def, onDone, saveLabel = "Save" }: { record: RecordItem; def: FieldDef; onDone: () => void; saveLabel?: string }) {
  const { core } = useCore();
  const [raw, setRaw] = useState(toRaw(def, record.fields[def.key]));
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const value = coerce(def, raw);
  const err = ops.validateField(def, value);
  const auth = authorityText(core, record, def.key);
  const current = record.fields[def.key] ?? null;
  const overwritesSource = record.fieldMeta[def.key]?.origin === "source" && !isEmpty(current);
  const reasonNeeded = overwritesSource || auth.tone === "warn";
  const unchanged = (value ?? null) === current || toRaw(def, current) === raw;
  const id = "rc-f-" + record.id + "-" + def.key;
  const save = () => {
    setTried(true);
    if (err || unchanged) return;
    if (reasonNeeded && !reason.trim()) return;
    const res = store.run(ops.setRecordField, record.id, def.key, value, reason.trim());
    if (res.ok) onDone();
  };
  return (
    <div className="rc-edit">
      <Field label={def.label} htmlFor={id} error={tried || raw ? err : null} help={def.help}>
        <FieldInput def={def} id={id} value={raw} onChange={setRaw} invalid={!!err && (tried || !!raw)} />
      </Field>
      {def.kind === "select" && !def.options?.length && <Notice tone="warn">No options are configured for {def.label}. An administrator can add them in Settings.</Notice>}
      <Field label={reasonNeeded ? "Reason (required)" : "Reason (optional)"} htmlFor={id + "-r"}
        error={tried && reasonNeeded && !reason.trim() ? (overwritesSource ? "This replaces a value from a source system, so say why." : "Say why, so the source owner can review it.") : null}>
        <TextInput id={id + "-r"} value={reason} onChange={setReason} placeholder="For example: confirmed with the record owner" invalid={tried && reasonNeeded && !reason.trim()} />
      </Field>
      <Notice tone={auth.tone}>{auth.text}</Notice>
      <div className="rc-row">
        <Button variant="primary" size="sm" onClick={save} disabled={unchanged} title={unchanged ? "Change the value first" : undefined}>{saveLabel}</Button>
        <Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

/* ── Permissions mirrored for disabled states (ops re-check on save) ───── */

export function resolveBlock(core: CoreState, viewer: Viewer, i: DataIssue): string | null {
  if (i.ownerId === viewer.person.id || viewer.isOrgWide) return null;
  const recs = i.recordIds.map((id) => core.data.records.find((r) => r.id === id)).filter(Boolean) as RecordItem[];
  if (can(viewer, "records.edit") && can(viewer, "tasks.manage") && recs.some((r) => r.teamId && viewer.overseenTeamIds.includes(r.teamId))) return null;
  return "Only the issue owner, a manager of the team or an administrator can resolve this.";
}

export function exportBlock(core: CoreState, viewer: Viewer): string | null {
  return core.config.governance.exportRequiresPermission && !can(viewer, "export") ? "Your role cannot export data." : null;
}

/* ── Focus hand-off ────────────────────────────────────────────────────── */

/** Open the panel a cross-page link asked for, then clear the focus. */
export function useFocus(kinds: Focus["kind"][], onFocus: (f: Focus) => void) {
  const { session } = useCore();
  const f = session.focus;
  useEffect(() => {
    if (!f || !kinds.includes(f.kind)) return;
    onFocus(f);
    store.setSession({ focus: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);
}

/* ── Small list helpers ────────────────────────────────────────────────── */

export function ListButton({ onClick, children, title }: { onClick: () => void; children: ReactNode; title?: string }) {
  return <button type="button" className="pk-li pk-li--btn" onClick={onClick} title={title}>{children}</button>;
}

export function List({ children }: { children: ReactNode }) {
  return <div className="pk-list">{children}</div>;
}

export function Ref({ children }: { children: ReactNode }) {
  return <span className="pk-mono" style={{ fontSize: 11.5, color: "var(--dim)", flex: "none" }}>{children}</span>;
}

export function Grow({ children }: { children: ReactNode }) {
  return <span className="pk-grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>;
}

export function RecordRef({ id }: { id: Id }) {
  const { q } = useCore();
  const r = q.record(id);
  return <>{r ? r.ref : "Not available"}</>;
}

/* ── Where a file version is used beyond requests and tasks ────────────── */

export interface FileUse { key: string; label: string; sub: string; open: () => void }

/** Evidence on requirements, agent runs that read or produced the file, supplier invoices and receipts.
    Each names the exact version it refers to where that is recorded. */
export function fileUses(core: CoreState, q: Q, fileId: Id): FileUse[] {
  const out: FileUse[] = [];
  for (const o of core.data.obligations || []) {
    if (o.evidence?.fileId !== fileId) continue;
    const req = core.config.standards.requirements.find((r) => r.id === o.requirementId);
    out.push({ key: "ob:" + o.id, label: (req?.label || o.requirementId) + " evidence", sub: "Version " + o.evidence.version + " received, " + o.state.replace("_", " "),
      open: () => openObject("obligation", o.id) });
  }
  for (const r of core.data.agentRuns || []) {
    const read = r.steps.some((st) => st.sourceRefs.some((x) => x.kind === "file" && x.id === fileId));
    const made = r.outputs.some((o) => o.id === fileId);
    if (!read && !made) continue;
    const agent = core.config.agents.find((a) => a.id === r.agentId);
    out.push({ key: "run:" + r.id, label: r.ref + " " + r.goal, sub: (made ? "Output of " : "Read by ") + (agent?.name || "an agent") + (r.simulated ? ", sample run" : ""),
      open: () => openObject("agentRun", r.id) });
  }
  for (const i of core.data.invoices || []) {
    if (i.fileId !== fileId) continue;
    out.push({ key: "inv:" + i.id, label: "Invoice " + i.ref, sub: "Supplier invoice document, " + i.status.replace("_", " "), open: () => openObject("invoice", i.id) });
  }
  for (const g of core.data.receipts || []) {
    if (g.fileId !== fileId) continue;
    const po = core.data.orders.find((o) => o.id === g.orderId);
    out.push({ key: "gr:" + g.id, label: "Receipt for " + (po?.ref || "an order"), sub: "Goods or service receipt, " + q.name(g.by), open: () => (po ? openObject("order", po.id) : undefined) });
  }
  return out;
}
