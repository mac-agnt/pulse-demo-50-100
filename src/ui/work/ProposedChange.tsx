/* What a request asks for: the current version's fields, a diff against the
   previous version, and the before/after for corrections and file reviews. */

import { useCore } from "../../core";
import type { FieldDef, FieldValue, RequestFormDef, RequestItem } from "../../core";
import { Chip } from "../kit";
import { Muted, useClock, useFieldText } from "./shared";

export function ProposedChange({ req, form }: { req: RequestItem; form?: RequestFormDef }) {
  const { core, q } = useCore();
  const { dt } = useClock();
  const correction = form?.effect.kind === "apply-correction";
  const fieldText = useFieldText();
  // A correction names a record field by key: show its label.
  const text = (d: FieldDef | undefined, val: FieldValue | undefined) => {
    if (d?.key === "field" && correction && typeof val === "string" && val) {
      const lbl = core.config.recordTypes.flatMap((t) => t.fields).find((f) => f.key === val)?.label;
      if (lbl) return lbl;
    }
    return fieldText(d, val);
  };
  const defs: FieldDef[] = form?.fields || Object.keys(req.fields).map((k) => ({ key: k, label: k, kind: "text" as const }));
  const cur = req.versions.find((x) => x.n === req.version) || { n: req.version, fields: req.fields, at: req.updatedAt, by: req.requesterId, note: "" };
  const prev = req.version > 1 ? req.versions.find((x) => x.n === req.version - 1) : undefined;
  const changed = prev ? defs.filter((d) => (prev.fields[d.key] ?? null) !== (cur.fields[d.key] ?? null)) : [];

  const fileReview = form?.effect.kind === "approve-file-version";
  const rec = correction ? q.record(String(req.fields.recordId || "")) : undefined;
  const recField = rec ? core.config.recordTypes.find((t) => t.id === rec.typeId)?.fields.find((f) => f.key === req.fields.field) : undefined;
  const file = fileReview ? q.file(String(req.fields.fileId || "")) : undefined;
  const latest = file?.versions[file.versions.length - 1];

  return (
    <div className="wk-stack">
      <div className="wk-row">
        <Chip tone="neutral" plain>Version {req.version}</Chip>
        <span className="wk-small">{cur.note ? cur.note + ", " : ""}{q.name(cur.by)}, {dt(cur.at)}</span>
      </div>
      <dl className="wk-dl">
        {defs.map((d) => (
          <div key={d.key} style={{ display: "contents" }}>
            <dt>{d.label}{d.material ? " *" : ""}</dt>
            <dd>{text(d, cur.fields[d.key])}</dd>
          </div>
        ))}
      </dl>
      {defs.some((d) => d.material) && <div className="wk-small">* Material field: changing it after a decision restarts the review.</div>}

      {correction && (
        <div className="wk-box">
          <div className="pk-eyebrow" style={{ marginBottom: 8 }}>Correction</div>
          {rec ? (
            <div className="wk-diff">
              <div className="wk-diff-h">Field on {rec.ref}</div><div className="wk-diff-h">Value on the record now</div><div className="wk-diff-h">Proposed value</div>
              <div className="wk-diff-k">{recField?.label || String(req.fields.field || "Not given")}</div>
              <div>{text(recField, rec.fields[String(req.fields.field)] ?? null)}</div>
              <div className="wk-diff-new">{text(recField, req.fields.newValue ?? null)}</div>
            </div>
          ) : <Muted>The record is not visible to you, or no longer exists.</Muted>}
          {req.execution.status === "succeeded" && <div className="wk-small" style={{ marginTop: 6 }}>The correction has already been applied, so the record now shows the proposed value.</div>}
        </div>
      )}

      {fileReview && (
        <div className="wk-box">
          <div className="pk-eyebrow" style={{ marginBottom: 8 }}>Document under review</div>
          {file && latest ? (
            <dl className="wk-dl">
              <dt>Document</dt><dd>{file.title} ({file.kind})</dd>
              <dt>Latest version</dt><dd>Version {latest.n}: {latest.note}</dd>
              <dt>Added</dt><dd>{q.name(latest.addedBy)}, {dt(latest.addedAt)}</dd>
              <dt>Approved</dt><dd>{latest.approved ? "Yes" : "Not yet"}</dd>
            </dl>
          ) : <Muted>You cannot see this document. Its source permissions restrict it.</Muted>}
        </div>
      )}

      {prev && (
        <div>
          <div className="wk-small" style={{ marginBottom: 6 }}>Changes since version {prev.n}</div>
          {changed.length === 0 ? <Muted>No field values changed.</Muted> : (
            <div className="wk-diff">
              <div className="wk-diff-h">Field</div><div className="wk-diff-h">Version {prev.n}</div><div className="wk-diff-h">Version {cur.n}</div>
              {changed.map((d) => (
                <div key={d.key} style={{ display: "contents" }}>
                  <div className="wk-diff-k">{d.label}{d.material ? " (material)" : ""}</div>
                  <div>{text(d, prev.fields[d.key] ?? null)}</div>
                  <div className="wk-diff-new">{text(d, cur.fields[d.key] ?? null)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
