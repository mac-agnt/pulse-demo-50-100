/* Renders configured request form fields by kind, with validation from the
   core. Used by the new request form and by the requester's edit. */

import { useCore, ops } from "../../core";
import type { FieldDef, FieldValue } from "../../core";
import { Field, Select, TextArea, TextInput } from "../kit";

export type Draft = Record<string, string>;

/** Form values as typed by the person, converted to field values. */
export function toValues(defs: FieldDef[], draft: Draft): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const d of defs) {
    const raw = (draft[d.key] ?? "").trim();
    if (!raw) { out[d.key] = null; continue; }
    out[d.key] = d.kind === "number" || d.kind === "money" ? (isFinite(Number(raw)) ? Number(raw) : raw) : raw;
  }
  return out;
}

export function fromValues(defs: FieldDef[], values: Record<string, FieldValue>): Draft {
  const out: Draft = {};
  for (const d of defs) {
    const v = values[d.key];
    out[d.key] = v === null || v === undefined ? "" : d.kind === "date" ? String(v).slice(0, 10) : String(v);
  }
  return out;
}

export function fieldErrors(defs: FieldDef[], draft: Draft): Record<string, string> {
  const vals = toValues(defs, draft);
  const errs: Record<string, string> = {};
  for (const d of defs) {
    const e = ops.validateField(d, vals[d.key] ?? null);
    if (e) errs[d.key] = e;
  }
  return errs;
}

export function RequestFields({ defs, draft, onChange, errors, show, idPrefix }: {
  defs: FieldDef[]; draft: Draft; onChange: (d: Draft) => void; errors: Record<string, string>; show: Record<string, boolean>; idPrefix: string;
}) {
  const { core, q } = useCore();
  const set = (k: string, v: string) => onChange({ ...draft, [k]: v });
  const recordDef = defs.find((d) => d.kind === "record");
  const chosenRecord = recordDef && draft[recordDef.key] ? q.record(draft[recordDef.key]) : undefined;
  const recordFields = chosenRecord ? core.config.recordTypes.find((t) => t.id === chosenRecord.typeId)?.fields || [] : [];

  return (
    <>
      {defs.map((d) => {
        const id = idPrefix + "-" + d.key;
        const err = show[d.key] ? errors[d.key] : null;
        const label = d.label + (d.kind === "money" ? " (" + (d.currency || "EUR") + ")" : "") + (d.required ? "" : " (optional)");
        const help = [d.help, d.material ? "Material: changing it after a decision restarts the review." : ""].filter(Boolean).join(" ") || undefined;
        let input;
        switch (d.kind) {
          case "longtext":
            input = <TextArea id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} rows={3} invalid={!!err} />;
            break;
          case "number": case "money":
            input = <TextInput id={id} type="number" value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err} />;
            break;
          case "date":
            input = <TextInput id={id} type="date" value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err} />;
            break;
          case "email":
            input = <TextInput id={id} type="email" value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err} />;
            break;
          case "select":
            input = <Select id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err}
              options={[{ value: "", label: "Choose an option" }, ...(d.options || [])]} />;
            break;
          case "record": {
            const recs = q.records({ ignoreScope: true });
            input = <Select id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err}
              options={[{ value: "", label: recs.length ? "Choose a record" : "No records you can see" }, ...recs.map((r) => ({ value: r.id, label: r.ref + " " + r.title }))]} />;
            break;
          }
          case "file": {
            const files = q.files({ ignoreScope: true });
            input = <Select id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err}
              options={[{ value: "", label: files.length ? "Choose a document" : "No documents you can see" }, ...files.map((f) => ({ value: f.id, label: f.title + " (version " + (f.versions[f.versions.length - 1]?.n || 1) + ")" }))]} />;
            break;
          }
          case "person": {
            const people = q.people().filter((p) => p.status === "active");
            input = <Select id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err}
              options={[{ value: "", label: "Choose a person" }, ...people.map((p) => ({ value: p.id, label: p.name + (p.organisation ? " (" + p.organisation + ")" : p.kind === "external" ? " (external)" : "") }))]} />;
            break;
          }
          default:
            // A free-text "field" next to a record picker names one of that record's fields: offer them.
            if (d.key === "field" && recordFields.length) {
              input = <Select id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err}
                options={[{ value: "", label: "Choose a field" }, ...recordFields.map((f) => ({ value: f.key, label: f.label }))]} />;
            } else {
              input = <TextInput id={id} value={draft[d.key] || ""} onChange={(v) => set(d.key, v)} invalid={!!err} />;
            }
        }
        return <Field key={d.key} label={label} htmlFor={id} error={err} help={help}>{input}</Field>;
      })}
    </>
  );
}
