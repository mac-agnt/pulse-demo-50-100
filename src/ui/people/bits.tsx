/* Small shared pieces for the People page. */

import { useState, type ReactNode } from "react";
import { Btn } from "../frame";

export function I({ d, size = 12, sw = 1.7 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export interface InlineField { key: string; label: string; type?: "text" | "date"; initial?: string; min?: string }

/** A small inline form under a row: one or two inputs, Confirm and Cancel.
    onSubmit returns an error message to keep the form open, or null when done. */
export function InlineForm({ fields, confirm, onSubmit, onCancel }: {
  fields: InlineField[]; confirm: string; onSubmit: (values: Record<string, string>) => string | null; onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.initial || ""])));
  const [err, setErr] = useState<string | null>(null);
  const submit = () => setErr(onSubmit(vals));
  return (
    <div className="pp-inline" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); submit(); } }}>
      {fields.map((f, i) => (
        <label key={f.key}>
          {f.label}
          <input type={f.type || "text"} value={vals[f.key] || ""} min={f.min} autoFocus={i === 0}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
        </label>
      ))}
      <Btn small primary onClick={submit}>{confirm}</Btn>
      <Btn small onClick={onCancel}>Cancel</Btn>
      {err && <div className="pp-err" role="alert">{err}</div>}
    </div>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <div className="pp-panel-empty">{children}</div>;
}
