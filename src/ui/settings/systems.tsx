/* Systems: connections and sync health, field mapping and source of truth,
   record types, metric definitions. Nothing here pretends a connection works. */

import { useState } from "react";
import {
  computeMetric, fmtDateTime, HOUR, missingFields, ms, ops, STALE_AFTER_HOURS, useCore,
  type CodeMappingDef, type CoreState, type DashboardDef, type FieldDef, type FieldKind, type FieldMappingDef, type MetricDef,
  type RecordTypeDef, type StatusDef, type SyncState, type Tone, type Visibility
} from "../../core";
import { Button, Chip, Empty, Field, KV, Notice, Select, TextInput } from "../kit";
import {
  CheckList, CommaInput, ItemPicker, Lock, NumberInput, Preview, ReadOnlyLine, SaveBar, SubHead, Toggle,
  errCount, keyFromLabel, newId, saveConfig, useCanEdit, useDraft
} from "./common";
import type { SectionProps } from "./SettingsPage";

type Errs = Record<string, string | undefined>;

/* ── Connections & sync ────────────────────────────────────────────────── */

const SYNC: Record<SyncState["status"], { label: string; tone: Tone; recovery: string }> = {
  not_connected: { label: "Not connected", tone: "neutral",
    recovery: "Nothing to recover. Connecting needs a backend with credentials for this system and a field mapping. Until then Pulse neither sends nor receives anything through it." },
  sample: { label: "Sample", tone: "accent",
    recovery: "Simulated data for the sample organisation. Treat figures from it as examples. Rows show the time of their last simulated sync, so stale rows are flagged honestly." },
  ok: { label: "OK", tone: "ok", recovery: "Working. Nothing to do." },
  stale: { label: "Stale", tone: "warn",
    recovery: "The last success is older than expected. Check the source system is reachable, then run a sync from the backend. Records keep their last known values and are marked stale." },
  error: { label: "Error", tone: "bad",
    recovery: "The last attempt failed. Read the message, fix the cause (often expired credentials), then retry from the backend. The failed attempt changed no data." }
};
const KIND_LABEL = { pulse: "Entered in Pulse", sample: "Sample source", external: "External system" } as const;

export function ConnectionsSection(_p: SectionProps) {
  const { core, ctx } = useCore();
  const tz = core.config.timezone;
  const [checked, setChecked] = useState<Record<string, string>>({});
  const syncOf = (id: string): SyncState => core.data.sync.find((s) => s.sourceId === id)
    || { sourceId: id, lastAttemptAt: null, lastSuccessAt: null, status: "not_connected", message: "No sync has been attempted." };

  const check = (id: string, kind: string) => {
    const st = syncOf(id);
    const msg = kind === "pulse" ? "Data entered in Pulse is its own source. There is nothing to sync."
      : "No connection is configured, so there is nothing to sync." + (st.lastSuccessAt ? " The last recorded success was " + fmtDateTime(st.lastSuccessAt, tz) + (st.status === "sample" ? " (simulated)." : ".") : " There has never been a successful sync.");
    setChecked({ ...checked, [id]: msg + " Checked " + fmtDateTime(ctx.now, tz) + "." });
  };

  return (
    <div className="st-detail-b">
      <Notice>Status here is read from what Pulse has stored. This demo has no backend, stores no credentials and cannot connect to anything, so no source is shown as connected unless it really is.</Notice>
      {core.config.sources.map((src) => {
        const st = syncOf(src.id);
        const sx = SYNC[st.status];
        const recs = core.data.records.filter((r) => r.sourceRefs.some((x) => x.sourceId === src.id));
        const stale = recs.filter((r) => r.sourceRefs.some((x) => x.sourceId === src.id && x.syncedAt && (ms(ctx.now) - ms(x.syncedAt)) > STALE_AFTER_HOURS * HOUR));
        return (
          <section key={src.id} className="st-box" style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label={src.label}>
            <div className="st-row">
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }} className="pk-grow">{src.label}</h3>
              <Chip tone="neutral" plain>{KIND_LABEL[src.kind]}</Chip>
              <Chip tone={sx.tone}>{sx.label}</Chip>
            </div>
            <KV items={[
              ["Last attempt", st.lastAttemptAt ? fmtDateTime(st.lastAttemptAt, tz) : "Never"],
              ["Last success", st.lastSuccessAt ? fmtDateTime(st.lastSuccessAt, tz) : "Never"],
              ["Records from it", String(recs.length)],
              ["Stale over " + STALE_AFTER_HOURS + " h", src.kind === "pulse" ? "Not applicable" : String(stale.length)]
            ]} />
            <div style={{ fontSize: 12.5 }}><span className="pk-muted">Message: </span>{st.message || "None"}</div>
            {src.prerequisite && <div style={{ fontSize: 12.5 }}><span className="pk-muted">Prerequisite: </span>{src.prerequisite}</div>}
            <div className="pk-help">{src.kind === "pulse" ? "Data entered in Pulse. No sync needed." : sx.recovery}</div>
            <div className="st-row">
              <Button size="sm" onClick={() => check(src.id, src.kind)}>Check status</Button>
              {checked[src.id] && <span role="status" className="pk-help pk-grow">{checked[src.id]}</span>}
            </div>
          </section>
        );
      })}
      {core.config.sources.length <= 1 && <Empty title="Only Pulse data so far" body="No other sources are set up. Connecting a source system needs a backend; once one exists, it appears here with its sync status." />}
    </div>
  );
}

/* ── Field mapping & source of truth ───────────────────────────────────── */

const affected = (s: CoreState, m: FieldMappingDef) =>
  s.data.records.filter((r) => !r.mergedInto && r.typeId === m.recordTypeId && (m.sourceId === "pulse" ? (r.fieldMeta[m.fieldKey]?.origin !== "source") : r.fieldMeta[m.fieldKey]?.sourceId === m.sourceId)).length;

export function MappingsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<{ fieldMappings: FieldMappingDef[]; codeMappings: CodeMappingDef[] }>({ fieldMappings: core.config.fieldMappings, codeMappings: core.config.codeMappings });
  const types = core.config.recordTypes;
  const sources = core.config.sources;
  const srcOf = (id: string) => sources.find((s) => s.id === id);
  const fieldsOf = (typeId: string) => types.find((t) => t.id === typeId)?.fields || [];
  const label = (typeId: string, key: string) => fieldsOf(typeId).find((f) => f.key === key)?.label || key;

  const errors: Errs = {};
  d.draft.fieldMappings.forEach((m, i) => {
    if (!m.fieldKey) errors["f" + i] = "Choose a field.";
    else if (d.draft.fieldMappings.some((o, j) => j < i && o.recordTypeId === m.recordTypeId && o.fieldKey === m.fieldKey)) errors["f" + i] = "This field is already mapped.";
    else if (m.sourceId !== "pulse" && !m.sourceField.trim()) errors["f" + i] = "Enter the field name in the source.";
  });
  d.draft.codeMappings.forEach((c, i) => {
    if (!c.field.trim() || !c.from.trim() || !c.to.trim()) errors["c" + i] = "Fill field, source code and value.";
    else if (d.draft.codeMappings.some((o, j) => j < i && o.sourceId === c.sourceId && o.field === c.field && o.from === c.from)) errors["c" + i] = "This code is already mapped.";
  });

  const updF = (i: number, fn: (m: FieldMappingDef) => void) => d.update((x) => fn(x.fieldMappings[i]));
  const updC = (i: number, fn: (m: CodeMappingDef) => void) => d.update((x) => fn(x.codeMappings[i]));
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.fieldMappings = d.draft.fieldMappings; c.codeMappings = d.draft.codeMappings; }, "Updated field and code mappings"); };

  const changed = d.draft.fieldMappings.filter((m) => JSON.stringify(m) !== JSON.stringify(core.config.fieldMappings.find((x) => x.id === m.id)));
  const removed = core.config.fieldMappings.filter((m) => !d.draft.fieldMappings.some((x) => x.id === m.id));
  const selectField = (field: string) => types.flatMap((t) => t.fields).find((f) => f.key === field && f.kind === "select");
  const openUnmapped = (c: CodeMappingDef) => core.data.issues.filter((i) => i.kind === "unmapped_value" && i.sourceValue === c.from && i.field === c.field && (i.state === "open" || i.state === "in_progress")).length;

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <SubHead right={<Button size="sm" disabled={!canEdit || !types.length} onClick={() => d.update((x) => { x.fieldMappings.push({ id: newId("fm", x.fieldMappings.map((m) => m.id)), recordTypeId: types[0].id, fieldKey: "", sourceId: sources[0]?.id || "pulse", sourceField: "", authority: "pulse", writeBack: false }); })}>Add mapping</Button>}>Field mappings</SubHead>
        <div className="pk-help">Authority decides which value stands when Pulse and a source disagree. Write-back sends Pulse corrections to the source, and needs a connected source.</div>
        <Lock on={!canEdit}>
          {d.draft.fieldMappings.length === 0 ? <Empty title="No field mappings" body="Every field is owned by Pulse until a source is mapped. Add a mapping once a source system exists." /> : (
            <div className="st-tbl-wrap">
              <table className="st-tbl" aria-label="Field mappings">
                <thead><tr><th>Record type</th><th>Field</th><th>Source</th><th>Source field</th><th>Authority</th><th>Write-back</th><th>Records</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
                <tbody>
                  {d.draft.fieldMappings.map((m, i) => {
                    const src = srcOf(m.sourceId);
                    const wbReason = !src ? "Unknown source." : src.kind === "pulse" ? "Pulse is the source; nothing to write back to." : !src.connected ? src.label + " is not connected, so nothing can be written back." : null;
                    return (
                      <tr key={m.id}>
                        <td style={{ minWidth: 130 }}><Select ariaLabel="Record type" value={m.recordTypeId} onChange={(v) => updF(i, (x) => { x.recordTypeId = v; x.fieldKey = ""; })} options={types.map((t) => ({ value: t.id, label: t.label }))} /></td>
                        <td style={{ minWidth: 140 }}>
                          <Select ariaLabel="Field" value={m.fieldKey} invalid={!!errors["f" + i]} onChange={(v) => updF(i, (x) => { x.fieldKey = v; })}
                            options={[{ value: "", label: "Choose" }, ...fieldsOf(m.recordTypeId).map((f) => ({ value: f.key, label: f.label }))]} />
                          {errors["f" + i] && <div className="pk-error">{errors["f" + i]}</div>}
                        </td>
                        <td style={{ minWidth: 150 }}><Select ariaLabel="Source" value={m.sourceId} onChange={(v) => updF(i, (x) => { x.sourceId = v; if (v === "pulse") { x.sourceField = ""; x.authority = "pulse"; } x.writeBack = false; })} options={sources.map((s) => ({ value: s.id, label: s.label }))} /></td>
                        <td style={{ minWidth: 120 }}>{m.sourceId === "pulse" ? <span className="pk-faint">Not used</span> : <TextInput ariaLabel="Source field" value={m.sourceField} onChange={(v) => updF(i, (x) => { x.sourceField = v; })} />}</td>
                        <td style={{ minWidth: 110 }}><Select ariaLabel="Authority" value={m.authority} onChange={(v) => updF(i, (x) => { x.authority = v as FieldMappingDef["authority"]; })}
                          options={[{ value: "source", label: "Source" }, { value: "pulse", label: "Pulse" }]} /></td>
                        <td style={{ minWidth: 120 }}>
                          <Toggle checked={m.writeBack} disabled={!!wbReason || !canEdit} title={wbReason || undefined} onChange={(v) => updF(i, (x) => { x.writeBack = v; })} label={m.writeBack ? "On" : "Off"} />
                          {wbReason && m.sourceId !== "pulse" && <div className="pk-help">Not connected</div>}
                        </td>
                        <td className="st-c">{affected(core, m)}</td>
                        <td><Button size="sm" variant="ghost" onClick={() => d.update((x) => { x.fieldMappings.splice(i, 1); })}>Remove</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Lock>
        {(changed.length > 0 || removed.length > 0) && (
          <Preview>
            <ul>
              {changed.map((m) => {
                const before = core.config.fieldMappings.find((x) => x.id === m.id);
                const n = affected(core, m);
                const tl = types.find((t) => t.id === m.recordTypeId)?.label || m.recordTypeId;
                return (
                  <li key={m.id}>
                    {label(m.recordTypeId, m.fieldKey) || "Unchosen field"} on {tl}: {n} record{n === 1 ? "" : "s"} affected.
                    {before && before.authority !== m.authority && (m.authority === "pulse"
                      ? " Pulse values will stand; newer source values become conflicts to review."
                      : " Source values will overwrite Pulse on the next sync; Pulse corrections wait for the source to accept them.")}
                    {!before && " New mapping."}
                  </li>
                );
              })}
              {removed.map((m) => <li key={m.id}>Mapping for {label(m.recordTypeId, m.fieldKey)} removed: {affected(core, m)} records fall back to Pulse as the owner of this field.</li>)}
            </ul>
          </Preview>
        )}

        <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => d.update((x) => { x.codeMappings.push({ id: newId("cm", x.codeMappings.map((c) => c.id)), sourceId: sources.find((s) => s.kind !== "pulse")?.id || "pulse", field: "", from: "", to: "" }); })}>Add code</Button>}>Code mappings</SubHead>
        <div className="pk-help">Translate a source system's codes into the values Pulse uses. Unmapped codes are kept as they arrive and show up in Data quality, never guessed.</div>
        <Lock on={!canEdit}>
          {d.draft.codeMappings.length === 0 ? <Empty title="No code mappings" body="Add one when a source sends codes (for example REV) that should become a Pulse value (for example Review)." /> : (
            <div className="st-tbl-wrap">
              <table className="st-tbl" aria-label="Code mappings">
                <thead><tr><th>Source</th><th>Field</th><th>Source code</th><th>Pulse value</th><th>Open issues</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
                <tbody>
                  {d.draft.codeMappings.map((c, i) => {
                    const sf = selectField(c.field);
                    return (
                      <tr key={c.id}>
                        <td style={{ minWidth: 150 }}><Select ariaLabel="Source" value={c.sourceId} onChange={(v) => updC(i, (x) => { x.sourceId = v; })} options={sources.map((s) => ({ value: s.id, label: s.label }))} /></td>
                        <td style={{ minWidth: 120 }}><TextInput ariaLabel="Field key" value={c.field} invalid={!!errors["c" + i]} onChange={(v) => updC(i, (x) => { x.field = v; })} /></td>
                        <td style={{ minWidth: 100 }}><TextInput ariaLabel="Source code" value={c.from} onChange={(v) => updC(i, (x) => { x.from = v; })} /></td>
                        <td style={{ minWidth: 130 }}>
                          {sf ? <Select ariaLabel="Pulse value" value={c.to} onChange={(v) => updC(i, (x) => { x.to = v; })} options={[{ value: "", label: "Choose" }, ...(sf.options || [])]} />
                            : <TextInput ariaLabel="Pulse value" value={c.to} onChange={(v) => updC(i, (x) => { x.to = v; })} />}
                          {errors["c" + i] && <div className="pk-error">{errors["c" + i]}</div>}
                        </td>
                        <td className="st-c" title="Open unmapped-value issues with this code. Resolve them in Records, Data quality.">{openUnmapped(c)}</td>
                        <td><Button size="sm" variant="ghost" onClick={() => d.update((x) => { x.codeMappings.splice(i, 1); })}>Remove</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Lock>
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Record types ──────────────────────────────────────────────────────── */

const KIND_NAME: Record<FieldKind, string> = {
  text: "Short text", longtext: "Long text", number: "Number", money: "Money", date: "Date", select: "Choice",
  person: "Person", email: "Email", record: "Record", file: "Document"
};
const TONES: { value: Tone; label: string }[] = [
  { value: "neutral", label: "Neutral" }, { value: "ok", label: "Good" }, { value: "warn", label: "Needs attention" }, { value: "bad", label: "Problem" }, { value: "accent", label: "Highlight" }
];
const VIS: { value: Visibility; label: string }[] = [
  { value: "organisation", label: "Whole organisation" }, { value: "unit", label: "Its unit" }, { value: "team", label: "Its team" }, { value: "owner", label: "Owner and managers only" }
];

export function RecordTypesSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<RecordTypeDef[]>(core.config.recordTypes);
  const [sel, setSel] = useState<string | null>(core.config.recordTypes[0]?.id || null);
  const ti = Math.max(0, d.draft.findIndex((t) => t.id === sel));
  const rt = d.draft[ti];
  const saved = rt && core.config.recordTypes.find((t) => t.id === rt.id);
  const set = (fn: (t: RecordTypeDef) => void) => d.update((x) => fn(x[ti]));
  const recsOf = (typeId: string) => core.data.records.filter((r) => r.typeId === typeId && !r.mergedInto);

  const errors: Errs = {};
  d.draft.forEach((t) => {
    if (!t.label.trim()) errors[t.id + ":label"] = "Enter a name.";
    if (!t.plural.trim()) errors[t.id + ":plural"] = "Enter the plural.";
    if (!t.fields.length) errors[t.id + ":fields"] = "Add at least one field.";
    if (!t.statuses.length) errors[t.id + ":statuses"] = "Add at least one status.";
    const keys = t.fields.map((f) => f.key);
    t.fields.forEach((f, i) => {
      if (!f.label.trim()) errors[t.id + ":f" + i] = "Enter a label.";
      else if (keys.indexOf(f.key) !== i) errors[t.id + ":f" + i] = "Two fields share the key " + f.key + ".";
      else if (f.pattern) { try { new RegExp(f.pattern); } catch { errors[t.id + ":f" + i] = "The pattern is not a valid regular expression."; } }
    });
    t.statuses.forEach((s, i) => { if (!s.label.trim()) errors[t.id + ":s" + i] = "Enter a label."; });
    const before = core.config.recordTypes.find((x) => x.id === t.id);
    if (before) {
      for (const f of before.fields) if (!keys.includes(f.key)) {
        const n = recsOf(t.id).filter((r) => r.fields[f.key] !== null && r.fields[f.key] !== undefined && r.fields[f.key] !== "").length;
        if (n) errors[t.id + ":rm:" + f.key] = f.label + " cannot be removed: " + n + " records hold a value for it.";
      }
      for (const s of before.statuses) if (!t.statuses.some((x) => x.id === s.id)) {
        const n = recsOf(t.id).filter((r) => r.status === s.id).length;
        if (n) errors[t.id + ":rms:" + s.id] = s.label + " cannot be removed: " + n + " records have this status.";
      }
    }
  });
  const typeErrs = rt ? Object.entries(errors).filter(([k, v]) => v && (k.startsWith(rt.id + ":rm:") || k.startsWith(rt.id + ":rms:"))).map(([, v]) => v!) : [];
  const E = (k: string) => (rt ? errors[rt.id + ":" + k] : undefined);

  // Preview: what the saved records would look like under the draft definition.
  const previewState: CoreState = { ...core, config: { ...core.config, recordTypes: d.draft } };
  const recs = rt ? recsOf(rt.id) : [];
  const newlyRequired = rt ? rt.fields.filter((f) => f.required && !saved?.fields.find((x) => x.key === f.key)?.required) : [];
  const incompleteNow = recs.filter((r) => missingFields(core, r).length > 0).length;
  const incompleteAfter = recs.filter((r) => missingFields(previewState, r).length > 0).length;
  const perField = newlyRequired.map((f) => ({ f, n: recs.filter((r) => missingFields(previewState, r).includes(f.key) && !missingFields(core, r).includes(f.key)).length }));
  const patternFails = rt ? rt.fields.filter((f) => f.pattern && f.pattern !== saved?.fields.find((x) => x.key === f.key)?.pattern && !errors[rt.id + ":f" + rt.fields.indexOf(f)])
    .map((f) => ({ f, n: recs.filter((r) => { const v = r.fields[f.key]; return v !== null && v !== undefined && v !== "" && !!ops.validateField(f, v); }).length })) : [];

  const add = () => {
    const id = newId("rt", d.draft.map((t) => t.id), "new");
    d.update((x) => { x.push({ id, label: "New type", plural: "New types", defaultVisibility: "team",
      fields: [{ key: "reference", label: "Reference", kind: "text", required: true }],
      statuses: [{ id: "active", label: "Active", tone: "ok" }, { id: "closed", label: "Closed", tone: "neutral", closed: true }] }); });
    setSel(id);
  };
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.recordTypes = d.draft; }, "Updated record types"); };
  const typeBlock = (id: string) => {
    const n = recsOf(id).length;
    if (n) return n + " records use this type.";
    if (core.config.fieldMappings.some((m) => m.recordTypeId === id)) return "Field mappings use this type.";
    if (d.draft.length === 1) return "Keep at least one record type.";
    return null;
  };

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        {d.draft.length === 0 ? (
          <Empty title="No record types" body="Add a record type to describe what this organisation keeps track of." action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a record type</Button>} />
        ) : (
          <>
            <ItemPicker label="Record types" items={d.draft.map((t) => ({ id: t.id, label: t.label, note: String(recsOf(t.id).length) }))} value={rt.id} onChange={setSel}
              after={<Button size="sm" disabled={!canEdit} onClick={add}>Add type</Button>} />
            <Lock on={!canEdit}>
              <div className="st-grid">
                <Field label="Name" error={E("label")}><TextInput ariaLabel="Type name" value={rt.label} invalid={!!E("label")} onChange={(v) => set((t) => { t.label = v; })} /></Field>
                <Field label="Plural" error={E("plural")}><TextInput ariaLabel="Plural" value={rt.plural} invalid={!!E("plural")} onChange={(v) => set((t) => { t.plural = v; })} /></Field>
                <Field label="Visible by default to"><Select ariaLabel="Default visibility" value={rt.defaultVisibility} onChange={(v) => set((t) => { t.defaultVisibility = v as Visibility; })} options={VIS} /></Field>
              </div>
              <SubHead right={<Button size="sm" onClick={() => set((t) => { t.fields.push({ key: keyFromLabel("New field", t.fields.map((f) => f.key)), label: "New field", kind: "text", required: false }); })}>Add field</Button>}>Fields</SubHead>
              {E("fields") && <div className="pk-error">{E("fields")}</div>}
              <TypeFields fields={rt.fields} savedKeys={saved ? saved.fields.map((f) => f.key) : []} errorAt={(i) => E("f" + i)} onChange={(fields) => set((t) => { t.fields = fields; })} />
              {typeErrs.map((e) => <div key={e} className="pk-error">{e}</div>)}
              <SubHead right={<Button size="sm" onClick={() => set((t) => { t.statuses.push({ id: newId("st", t.statuses.map((s) => s.id)), label: "", tone: "neutral" }); })}>Add status</Button>}>Statuses</SubHead>
              {E("statuses") && <div className="pk-error">{E("statuses")}</div>}
              <div className="st-tbl-wrap">
                <table className="st-tbl" aria-label="Statuses">
                  <thead><tr><th>Label</th><th>Shown as</th><th>Closes the record</th><th>Records</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
                  <tbody>
                    {rt.statuses.map((s: StatusDef, i) => (
                      <tr key={s.id}>
                        <td style={{ minWidth: 150 }}><TextInput ariaLabel="Status label" value={s.label} invalid={!!E("s" + i)} onChange={(v) => set((t) => { t.statuses[i].label = v; })} />{E("s" + i) && <div className="pk-error">{E("s" + i)}</div>}</td>
                        <td style={{ minWidth: 140 }}><div className="st-row" style={{ flexWrap: "nowrap" }}><Select ariaLabel="Tone" value={s.tone} onChange={(v) => set((t) => { t.statuses[i].tone = v as Tone; })} options={TONES} /><Chip tone={s.tone}>{s.label || "Status"}</Chip></div></td>
                        <td className="st-c"><input type="checkbox" aria-label={"Closes the record: " + s.label} checked={!!s.closed} style={{ accentColor: "var(--accent)" }} onChange={(e) => set((t) => { t.statuses[i].closed = e.target.checked || undefined; })} /></td>
                        <td className="st-c">{recs.filter((r) => r.status === s.id).length}</td>
                        <td><Button size="sm" variant="ghost" onClick={() => set((t) => { t.statuses.splice(i, 1); })}>Remove</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {typeBlock(rt.id) === null
                ? <div><Button size="sm" variant="ghost" onClick={() => { d.update((x) => { x.splice(ti, 1); }); setSel(null); }}>Remove this record type</Button></div>
                : <div className="pk-help">This type cannot be removed: {typeBlock(rt.id)}</div>}
            </Lock>
            <Preview>
              <div>{recs.length} existing {rt.label.toLowerCase() || "record"} records. Incomplete now: {incompleteNow}. Incomplete with these changes: {incompleteAfter}.</div>
              {perField.length > 0 && <ul style={{ marginTop: 4 }}>{perField.map(({ f, n }) => <li key={f.key}>Making {f.label} required: {n} existing record{n === 1 ? "" : "s"} would become incomplete and appear in Data quality.</li>)}</ul>}
              {patternFails.length > 0 && <ul style={{ marginTop: 4 }}>{patternFails.map(({ f, n }) => <li key={f.key}>New pattern for {f.label}: {n} stored value{n === 1 ? "" : "s"} do not match. They are kept, but must be fixed on their next edit.</li>)}</ul>}
            </Preview>
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

function TypeFields({ fields, savedKeys, onChange, errorAt }: { fields: FieldDef[]; savedKeys: string[]; onChange: (f: FieldDef[]) => void; errorAt: (i: number) => string | undefined }) {
  const upd = (i: number, fn: (f: FieldDef) => void) => onChange(fields.map((f, j) => { if (j !== i) return f; const n = structuredClone(f); fn(n); return n; }));
  return (
    <div className="st-tbl-wrap">
      <table className="st-tbl" aria-label="Fields">
        <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Choices</th><th>Pattern</th><th>Required</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
        <tbody>
          {fields.map((f, i) => {
            const isNew = !savedKeys.includes(f.key);
            return (
              <tr key={i}>
                <td style={{ minWidth: 150 }}>
                  <TextInput ariaLabel="Field label" value={f.label} invalid={!!errorAt(i)}
                    onChange={(v) => upd(i, (x) => { x.label = v; if (isNew) x.key = keyFromLabel(v || "field", fields.filter((_, j) => j !== i).map((y) => y.key)); })} />
                  {errorAt(i) && <div className="pk-error">{errorAt(i)}</div>}
                </td>
                <td><span className="pk-mono" style={{ fontSize: 11 }}>{f.key}</span></td>
                <td style={{ minWidth: 120 }}>
                  {isNew ? <Select ariaLabel="Field type" value={f.kind} onChange={(v) => upd(i, (x) => { x.kind = v as FieldKind; })} options={(Object.keys(KIND_NAME) as FieldKind[]).map((k) => ({ value: k, label: KIND_NAME[k] }))} />
                    : <span title="The type of a saved field is fixed so stored values stay valid">{KIND_NAME[f.kind]}</span>}
                </td>
                <td style={{ minWidth: 150 }}>
                  {f.kind === "select" ? <CommaInput ariaLabel="Choices, separated by commas" placeholder="First, Second" value={(f.options || []).map((o) => o.label)} onCommit={(labels) => upd(i, (x) => { x.options = labels.map((l) => ({ value: (x.options || []).find((o) => o.label === l)?.value || l.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: l })); })} />
                    : <span className="pk-faint">Not used</span>}
                </td>
                <td style={{ minWidth: 140 }}>
                  {f.kind === "text" || f.kind === "email" ? <TextInput ariaLabel="Pattern" value={f.pattern || ""} placeholder="Optional" onChange={(v) => upd(i, (x) => { x.pattern = v || undefined; })} /> : <span className="pk-faint">Not used</span>}
                </td>
                <td className="st-c"><input type="checkbox" aria-label={"Required: " + f.label} checked={!!f.required} style={{ accentColor: "var(--accent)" }} onChange={(e) => upd(i, (x) => { x.required = e.target.checked; })} /></td>
                <td><Button size="sm" variant="ghost" aria-label={"Remove " + f.label} onClick={() => onChange(fields.filter((_, j) => j !== i))}>Remove</Button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Metric definitions ────────────────────────────────────────────────── */

export function MetricsSection(_p: SectionProps) {
  const { core, ctx } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<{ metrics: MetricDef[]; dashboards: DashboardDef[] }>({ metrics: core.config.metrics, dashboards: core.config.dashboards });
  const errors: Errs = {};
  d.draft.metrics.forEach((m, i) => {
    if (!m.label.trim()) errors["l" + i] = "Enter a label.";
    if (m.target !== undefined && (!isFinite(m.target) || (m.unit === "percent" && (m.target < 0 || m.target > 100)) || m.target < 0)) errors["t" + i] = m.unit === "percent" ? "Enter 0 to 100." : "Enter 0 or more.";
  });
  d.draft.dashboards.forEach((db, i) => { if (!db.metricIds.length) errors["d" + i] = "A dashboard needs at least one metric."; });
  const warnings = d.draft.dashboards.flatMap((db) => {
    const out: string[] = [];
    if (db.metricIds.length > 6) out.push(db.label + " has " + db.metricIds.length + " metrics. Aim for 4 to 6 primary metrics so the important ones stand out.");
    const off = db.metricIds.map((id) => d.draft.metrics.find((m) => m.id === id)).filter((m) => m && !m.enabled) as MetricDef[];
    if (off.length) out.push(off.map((m) => m.label).join(", ") + (off.length === 1 ? " is" : " are") + " switched off, so " + db.label + " will not show " + (off.length === 1 ? "it" : "them") + ".");
    return out;
  });
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.metrics = d.draft.metrics; c.dashboards = d.draft.dashboards; }, "Updated metric definitions and dashboards"); };
  const unitSuffix = (m: MetricDef) => m.unit === "percent" ? "%" : m.unit === "hours" ? "h" : m.unit === "money" ? (m.currency || "") : "";

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <div className="pk-help">Formulas and periods are fixed by the metric engine so every figure means the same thing everywhere. You can switch metrics on or off, rename them, set targets and choose which dashboards show them.</div>
        <Lock on={!canEdit}>
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label="Metrics">
              <thead><tr><th>On</th><th>Label</th><th>Current value</th><th>Target</th><th>Period</th><th>Formula</th></tr></thead>
              <tbody>
                {d.draft.metrics.map((m, i) => {
                  const cur = core.config.metrics.find((x) => x.id === m.id)?.enabled ? computeMetric(core, ctx, m.id) : null;
                  return (
                    <tr key={m.id}>
                      <td className="st-c"><input type="checkbox" aria-label={"Switch on " + m.label} checked={m.enabled} style={{ accentColor: "var(--accent)" }} onChange={(e) => d.update((x) => { x.metrics[i].enabled = e.target.checked; })} /></td>
                      <td style={{ minWidth: 170 }}>
                        <TextInput ariaLabel="Metric label" value={m.label} invalid={!!errors["l" + i]} onChange={(v) => d.update((x) => { x.metrics[i].label = v; })} />
                        {errors["l" + i] && <div className="pk-error">{errors["l" + i]}</div>}
                        <div className="pk-help">{m.description}</div>
                      </td>
                      <td>{cur ? cur.display : <span className="pk-faint">Off</span>}</td>
                      <td style={{ minWidth: 110 }}>
                        <div className="st-row" style={{ flexWrap: "nowrap", gap: 6 }}>
                          <NumberInput ariaLabel={"Target for " + m.label} min={0} value={m.target ?? null} invalid={!!errors["t" + i]} onChange={(v) => d.update((x) => { x.metrics[i].target = v === null ? undefined : v; })} />
                          <span className="pk-faint">{unitSuffix(m)}</span>
                        </div>
                        {errors["t" + i] && <div className="pk-error">{errors["t" + i]}</div>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{m.periodDays ? "Last " + m.periodDays + " days" : "Point in time"}</td>
                      <td style={{ minWidth: 220 }}><span className="pk-mono" style={{ fontSize: 11, whiteSpace: "normal" }}>{m.formula}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SubHead>Dashboards</SubHead>
          {d.draft.dashboards.length === 0 ? <Empty title="No dashboards" body="Dashboards group metrics for a role." /> : d.draft.dashboards.map((db, i) => (
            <div key={db.id} className="st-box" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="st-row">
                <strong style={{ fontSize: 13, fontWeight: 500 }} className="pk-grow">{db.label}</strong>
                <Chip tone={db.metricIds.length > 6 ? "warn" : db.metricIds.length === 0 ? "bad" : "neutral"}>{db.metricIds.length} metric{db.metricIds.length === 1 ? "" : "s"}</Chip>
              </div>
              <div className="pk-help">{db.description}</div>
              <CheckList label={"Metrics on " + db.label} value={db.metricIds} onChange={(v) => d.update((x) => { x.dashboards[i].metricIds = d.draft.metrics.map((m) => m.id).filter((id) => v.includes(id)); })}
                options={d.draft.metrics.map((m) => ({ value: m.id, label: m.label + (m.enabled ? "" : " (off)") }))} />
              {errors["d" + i] && <div className="pk-error">{errors["d" + i]}</div>}
            </div>
          ))}
        </Lock>
        {warnings.length > 0 && <Notice tone="warn"><ul style={{ margin: 0, paddingLeft: 18 }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul></Notice>}
        <div className="pk-help">Guidance: 4 to 6 primary metrics per dashboard. More than 6 is allowed but makes it harder to see what matters.</div>
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}
