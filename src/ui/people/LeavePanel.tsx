/* Request leave. Submits the configured "Leave request" form through the normal
   request and approval flow; the leave appears on the People page once the
   decision is made and the request has run. */

import { useState } from "react";
import { useCore, ops, store, navigate, fmtDate } from "../../core";
import { SidePanel, Button, Empty, Notice } from "../kit";
import { RequestFields, fieldErrors, toValues, type Draft } from "../work/RequestFields";
import { LEAVE_LABEL } from "./util";

export const LEAVE_FORM = "form-leave";

export function LeavePanel({ onClose }: { onClose: () => void }) {
  const { core } = useCore();
  const form = core.config.requestForms.find((f) => f.id === LEAVE_FORM && f.enabled);
  const rule = form ? core.config.approvalRules.find((r) => r.id === form.approvalRuleId) : undefined;
  const [draft, setDraft] = useState<Draft>({});
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!form) {
    return (
      <SidePanel open onClose={onClose} title="Request leave" eyebrow="PEOPLE · LEAVE" width={480}>
        <Empty title="Leave requests are not set up" body="There is no enabled Leave request form. An administrator can add one in Settings, Request forms."
          action={<Button onClick={() => { onClose(); navigate({ page: "Settings", section: "requestForms" }); }}>Open request forms</Button>} />
      </SidePanel>
    );
  }

  const errors = fieldErrors(form.fields, draft);
  const show = tried ? Object.fromEntries(form.fields.map((f) => [f.key, true])) : Object.fromEntries(Object.keys(draft).map((k) => [k, true]));
  const kindLabel = form.fields.find((f) => f.key === "kind")?.options?.find((o) => o.value === draft.kind)?.label
    || (draft.kind && draft.kind in LEAVE_LABEL ? LEAVE_LABEL[draft.kind as keyof typeof LEAVE_LABEL] : "Leave");
  const rangeErr = draft.from && draft.to && draft.to < draft.from ? "The end date is before the start date." : null;

  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length || rangeErr) { setErr(rangeErr || "Fill in the highlighted fields. Nothing has been sent yet."); return; }
    const day = (d: string) => fmtDate(d + "T12:00:00Z", core.config.timezone);
    const title = kindLabel + ", " + day(draft.from) + (draft.to && draft.to !== draft.from ? " to " + day(draft.to) : "");
    const res = store.run(ops.createRequest, { formId: form.id, title, fields: toValues(form.fields, draft), evidenceFileIds: [], linkedRecordIds: [], submit: true });
    if (!res.ok) { setErr(res.error); return; }
    onClose();
  };

  return (
    <SidePanel open onClose={onClose} title="Request leave" eyebrow="PEOPLE · LEAVE" width={480}
      footer={<><Button variant="primary" onClick={submit}>Send for approval</Button><Button onClick={onClose}>Cancel</Button></>}>
      <p style={{ fontSize: 13, color: "var(--dim)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {form.description || (rule && rule.stages.length ? "Decided by: " + rule.stages.map((s) => s.label.toLowerCase()).join(", then ") + "." : "")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RequestFields defs={form.fields} draft={draft} onChange={(d) => { setDraft(d); setErr(null); }} errors={errors} show={show} idPrefix="leave" />
      </div>
      {err && <div style={{ marginTop: 14 }}><Notice tone="bad">{err}</Notice></div>}
      <div className="pp-foot">It goes through the same approvals as any other request. Once approved and run, it shows in Who's away.</div>
    </SidePanel>
  );
}
