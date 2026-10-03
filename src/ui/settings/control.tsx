/* Control: request forms, approval routing, workflow templates, deadlines,
   notification routing and agent controls. */

import { useState } from "react";
import {
  addBusinessHours, addHours, eligibleApprovers, fmtDateTime, useCore,
  type AgentDef, type ApprovalRuleDef, type ApprovalStageDef, type CoreState, type EffectKind, type FieldDef, type FieldKind,
  type NotificationRouteDef, type RequestFormDef, type RequestItem, type SlaPolicyDef, type StageScope, type WorkflowStepDef, type WorkflowTemplateDef
} from "../../core";
import { Button, Chip, Empty, Field, Notice, Select, TextArea, TextInput } from "../kit";
import {
  CheckList, CommaInput, ItemPicker, ListEditor, Lock, NumberInput, Preview, ReadOnlyLine, SaveBar, SubHead, Toggle,
  errCount, isValidTimezone, keyFromLabel, moveItem, newId, roleOptions, saveConfig, staffOptions, useCanEdit, useDraft
} from "./common";
import type { SectionProps } from "./SettingsPage";

type Errs = Record<string, string | undefined>;

/* ── Request forms ─────────────────────────────────────────────────────── */

const KIND_LABEL: Record<FieldKind, string> = {
  text: "Short text", longtext: "Long text", number: "Number", money: "Money", date: "Date", select: "Choice",
  person: "Person", email: "Email", record: "Record", file: "Document"
};
const KINDS = Object.keys(KIND_LABEL) as FieldKind[];

const EFFECTS: Record<EffectKind, { label: string; explain: string; needs: string[] }> = {
  "record-leave": { label: "Add the leave to the team calendar", needs: ["kind", "from", "to"],
    explain: "After the final approval, the leave is added to the requester's record and shows in People and on the team calendar. Needs fields with the keys kind, from and to." },
  "apply-correction": { label: "Apply the correction to the record", needs: ["recordId", "field", "newValue"],
    explain: "After the final approval, the corrected value is written to the linked record in Pulse, with an audit entry. Needs fields with the keys recordId, field and newValue." },
  "approve-file-version": { label: "Mark the reviewed version as approved", needs: ["fileId"],
    explain: "After the final approval, the latest version of the chosen document is marked approved. Needs a document field with the key fileId." },
  "create-fulfilment-task": { label: "Create a fulfilment task for the team", needs: [],
    explain: "After the final approval, an unassigned task is created in the requester's team queue and linked to the request." },
  "notify-external": { label: "Send the message through the email connection", needs: [],
    explain: "After the final approval, a message would be sent through the email connection. Email is not connected, so this step fails honestly and nothing is sent." }
};

function formErrors(forms: RequestFormDef[], rules: ApprovalRuleDef[]): Errs {
  const e: Errs = {};
  for (const f of forms) {
    if (!f.label.trim()) e[f.id + ":label"] = "Enter a name.";
    if (!f.fields.length) e[f.id + ":fields"] = "Add at least one field.";
    if (!rules.some((r) => r.id === f.approvalRuleId)) e[f.id + ":rule"] = rules.length ? "Choose an approval rule." : "Add an approval rule in Approval routing first.";
    const keys = f.fields.map((x) => x.key);
    f.fields.forEach((x, i) => {
      if (!x.label.trim()) e[f.id + ":f" + i] = "Enter a label.";
      else if (keys.indexOf(x.key) !== i) e[f.id + ":f" + i] = "Two fields share the key " + x.key + ".";
      else if (x.kind === "select" && !(x.options || []).length) e[f.id + ":f" + i] = "Add at least one choice.";
    });
    const missing = EFFECTS[f.effect.kind].needs.filter((k) => !keys.includes(k));
    if (missing.length) e[f.id + ":effect"] = "This action needs fields with the keys " + missing.join(", ") + ".";
  }
  return e;
}

export function RequestFormsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<RequestFormDef[]>(core.config.requestForms);
  const [sel, setSel] = useState<string | null>(core.config.requestForms[0]?.id || null);
  const rules = core.config.approvalRules;
  const errors = formErrors(d.draft, rules);
  const fi = Math.max(0, d.draft.findIndex((f) => f.id === sel));
  const form = d.draft[fi];
  const saved = form && core.config.requestForms.find((f) => f.id === form.id);
  const E = (k: string) => (form ? errors[form.id + ":" + k] : undefined);
  const set = (fn: (f: RequestFormDef) => void) => d.update((x) => fn(x[fi]));

  const add = () => {
    const id = newId("form", d.draft.map((f) => f.id), "new");
    d.update((x) => { x.push({ id, label: "New form", description: "", fields: [{ key: "description", label: "What is needed", kind: "longtext", required: true, material: true }],
      evidenceRequired: false, approvalRuleId: rules[0]?.id || "", tasks: [], effect: { kind: "create-fulfilment-task", label: EFFECTS["create-fulfilment-task"].label }, enabled: false }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => { c.requestForms = d.draft.map((f) => ({ ...f, label: f.label.trim(), description: f.description.trim() })); }, "Updated request forms");
  };

  const pickerItems = d.draft.map((f) => ({ id: f.id, label: f.label, note: Object.keys(errors).some((k) => k.startsWith(f.id + ":") && errors[k]) ? "needs fixing" : !f.enabled ? "off" : undefined }));
  const requestsUsing = (formId: string) => core.data.requests.filter((r) => r.formId === formId);

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        {d.draft.length === 0 ? (
          <Empty title="No request forms yet" body="Request forms are how people ask for something that needs a decision. Add one, give it fields and an approval rule, then switch it on."
            action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a form</Button>} />
        ) : (
          <>
            <ItemPicker label="Request forms" items={pickerItems} value={form.id} onChange={setSel}
              after={<Button size="sm" disabled={!canEdit} onClick={add}>Add form</Button>} />
            <Lock on={!canEdit}>
            <Toggle checked={form.enabled} disabled={!canEdit} onChange={(v) => set((f) => { f.enabled = v; })}
              label={form.enabled ? "On: people can raise this request" : "Off: hidden from people raising requests"} />
            <div className="st-grid">
              <Field label="Name" error={E("label")}><TextInput ariaLabel="Form name" value={form.label} invalid={!!E("label")} onChange={(v) => set((f) => { f.label = v; })} /></Field>
              <Field label="Approval rule" error={E("rule")}>
                <Select ariaLabel="Approval rule" value={form.approvalRuleId} invalid={!!E("rule")} onChange={(v) => set((f) => { f.approvalRuleId = v; })}
                  options={[{ value: "", label: "Choose a rule" }, ...rules.map((r) => ({ value: r.id, label: r.label }))]} />
              </Field>
            </div>
            <Field label="Description" htmlFor="rf-desc"><TextArea id="rf-desc" value={form.description} rows={2} onChange={(v) => set((f) => { f.description = v; })} /></Field>
            <Toggle checked={form.evidenceRequired} disabled={!canEdit} onChange={(v) => set((f) => { f.evidenceRequired = v; })} label="Evidence must be attached before submitting" />

            <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => set((f) => { f.fields.push({ key: keyFromLabel("New field", f.fields.map((x) => x.key)), label: "New field", kind: "text", required: false }); })}>Add field</Button>}>Fields</SubHead>
            {E("fields") && <div className="pk-error">{E("fields")}</div>}
            <FieldsTable fields={form.fields} savedKeys={saved ? saved.fields.map((x) => x.key) : []} canEdit={canEdit} errorAt={(i) => E("f" + i)}
              onChange={(fields) => set((f) => { f.fields = fields; })} showMaterial />

            <SubHead>On approval</SubHead>
            {saved ? (
              <div className="st-box">
                <div style={{ fontWeight: 500, fontSize: 13 }}>{form.effect.label}</div>
                <div className="pk-help" style={{ marginTop: 4 }}>{EFFECTS[form.effect.kind].explain}</div>
                <div className="pk-help" style={{ marginTop: 4 }}>The action is fixed once a form is saved, so existing requests keep their meaning.</div>
              </div>
            ) : (
              <Field label="What runs on approval" error={E("effect")} help={EFFECTS[form.effect.kind].explain}>
                <Select ariaLabel="What runs on approval" value={form.effect.kind} onChange={(k) => set((f) => { f.effect = { kind: k as EffectKind, label: EFFECTS[k as EffectKind].label }; })}
                  options={(Object.keys(EFFECTS) as EffectKind[]).map((k) => ({ value: k, label: EFFECTS[k].label }))} />
              </Field>
            )}
            {saved && E("effect") && <div className="pk-error">{E("effect")}</div>}
            {form.tasks.length > 0 && <div className="pk-help">Tasks created with each request: {form.tasks.map((t) => t.title).join("; ")}.</div>}
            {saved && requestsUsing(form.id).length > 0 && <div className="pk-help">{requestsUsing(form.id).length} existing requests use this form. Removing a field keeps their stored values.</div>}

            </Lock>
            <FormPreview form={form} s={core} />
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

function FieldsTable({ fields, savedKeys, canEdit, onChange, errorAt, showMaterial, showPattern }: {
  fields: FieldDef[]; savedKeys: string[]; canEdit: boolean; onChange: (f: FieldDef[]) => void; errorAt: (i: number) => string | undefined; showMaterial?: boolean; showPattern?: boolean;
}) {
  const upd = (i: number, fn: (f: FieldDef) => void) => onChange(fields.map((f, j) => { if (j !== i) return f; const n = structuredClone(f); fn(n); return n; }));
  if (!fields.length) return <div className="pk-help">No fields yet.</div>;
  return (
    <div className="st-tbl-wrap">
      <table className="st-tbl" aria-label="Fields">
        <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Choices</th>{showPattern && <th>Pattern</th>}<th>Required</th>{showMaterial && <th title="Editing a material field after approval forces a renewed review">Material</th>}<th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
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
                  <Select ariaLabel="Field type" value={f.kind} onChange={(v) => upd(i, (x) => { x.kind = v as FieldKind; })}
                    options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
                </td>
                <td style={{ minWidth: 150 }}>
                  {f.kind === "select"
                    ? <CommaInput ariaLabel="Choices, separated by commas" disabled={!canEdit} placeholder="First, Second" value={(f.options || []).map((o) => o.label)}
                        onCommit={(labels) => upd(i, (x) => { x.options = labels.map((l) => ({ value: (x.options || []).find((o) => o.label === l)?.value || l.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: l })); })} />
                    : <span className="pk-faint">Not used</span>}
                </td>
                {showPattern && (
                  <td style={{ minWidth: 140 }}>
                    {f.kind === "text" || f.kind === "email"
                      ? <TextInput ariaLabel="Pattern" value={f.pattern || ""} placeholder="Optional" onChange={(v) => upd(i, (x) => { x.pattern = v || undefined; })} />
                      : <span className="pk-faint">Not used</span>}
                  </td>
                )}
                <td className="st-c"><input type="checkbox" aria-label={"Required: " + f.label} checked={!!f.required} disabled={!canEdit} style={{ accentColor: "var(--accent)" }} onChange={(e) => upd(i, (x) => { x.required = e.target.checked; })} /></td>
                {showMaterial && <td className="st-c"><input type="checkbox" aria-label={"Material: " + f.label} checked={!!f.material} disabled={!canEdit} style={{ accentColor: "var(--accent)" }} onChange={(e) => upd(i, (x) => { x.material = e.target.checked; })} /></td>}
                <td style={{ whiteSpace: "nowrap" }}>
                  <Button size="sm" variant="ghost" disabled={!canEdit || i === 0} aria-label={"Move " + f.label + " up"} onClick={() => { const n = [...fields]; moveItem(n, i, -1); onChange(n); }}>Up</Button>
                  <Button size="sm" variant="ghost" disabled={!canEdit} aria-label={"Remove " + f.label} onClick={() => onChange(fields.filter((_, j) => j !== i))}>Remove</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FormPreview({ form, s }: { form: RequestFormDef; s: CoreState }) {
  const rule = s.config.approvalRules.find((r) => r.id === form.approvalRuleId);
  return (
    <Preview title="Preview: what a requester sees">
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{form.label || "Untitled form"}</div>
      {form.description && <div className="pk-help" style={{ marginTop: 2 }}>{form.description}</div>}
      <div style={{ display: "grid", gap: 10, marginTop: 10, maxWidth: 460 }}>
        <Field label="Title (required)"><input className="pk-input" disabled aria-label="Title" /></Field>
        {form.fields.map((f, i) => (
          <Field key={i} label={(f.label || "Untitled") + (f.required ? " (required)" : "")} help={f.help || (f.material ? "Changing this after approval needs a renewed review." : undefined)}>
            {f.kind === "longtext" ? <textarea className="pk-textarea" disabled rows={2} aria-label={f.label} />
              : f.kind === "select" ? <select className="pk-select" disabled aria-label={f.label}><option>{(f.options || []).map((o) => o.label).join(" / ") || "No choices yet"}</option></select>
              : <input className="pk-input" disabled aria-label={f.label} placeholder={KIND_LABEL[f.kind]} />}
          </Field>
        ))}
      </div>
      {form.evidenceRequired && <div style={{ marginTop: 8 }}>Evidence must be attached before submitting.</div>}
      <div style={{ marginTop: 8 }}>Decided by: {rule ? rule.stages.map((st) => st.label + (st.when ? " (only over " + st.when.over + ")" : "")).join(", then ") : "no rule chosen"}.</div>
      <div>On approval: {form.effect.label}.</div>
      {!form.enabled && <div style={{ marginTop: 4 }}>This form is off, so requesters cannot see it yet.</div>}
    </Preview>
  );
}

/* ── Approval routing ──────────────────────────────────────────────────── */

const SCOPE_LABEL: Record<StageScope, string> = { "requester-team": "Requester's team", "requester-unit": "Requester's unit", organisation: "Whole organisation" };

function ruleErrors(rules: ApprovalRuleDef[]): Errs {
  const e: Errs = {};
  for (const r of rules) {
    if (!r.label.trim()) e[r.id + ":label"] = "Enter a name.";
    if (!r.stages.length) e[r.id + ":stages"] = "Add at least one stage.";
    r.stages.forEach((st, i) => {
      if (!st.label.trim()) e[r.id + ":s" + i] = "Enter a stage name.";
      else if (!st.eligibleRoles.length) e[r.id + ":s" + i] = "Choose at least one role.";
      else if (st.when && (!st.when.field || st.when.over === null || !isFinite(st.when.over) || st.when.over < 0)) e[r.id + ":s" + i] = "Choose a field and an amount of 0 or more.";
    });
  }
  return e;
}

/** Who each stage would route to right now, using the same rules as submission. */
function routePreview(s: CoreState, rule: ApprovalRuleDef, req: RequestItem) {
  const notes: string[] = [];
  const stages = rule.stages.map((st) => {
    const applies = !st.when || (typeof req.fields[st.when.field] === "number" && (req.fields[st.when.field] as number) > st.when.over);
    if (!applies) return { st, applies, pool: [] as string[], to: null as string | null, self: false, fallback: false };
    const rank = (pid: string) => Math.min(...s.data.roleAssignments.filter((ra) => ra.personId === pid && st.eligibleRoles.includes(ra.roleId))
      .map((ra) => (ra.scope.kind === "team" ? 0 : ra.scope.kind === "unit" ? 1 : 2)));
    let pool = eligibleApprovers(s, st.eligibleRoles, st.scope, req.teamId).sort((a, b) => rank(a) - rank(b));
    const self = rule.prohibitSelfApproval && pool.includes(req.requesterId);
    if (self) pool = pool.filter((p) => p !== req.requesterId);
    let fallback = false;
    if (!pool.length) { pool = eligibleApprovers(s, [rule.escalateToRole], "organisation", req.teamId).filter((p) => p !== req.requesterId); fallback = true; }
    return { st, applies, pool, to: pool[0] || null, self, fallback };
  });
  return { stages, notes };
}

export function ApprovalsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const T = core.config.terminology;
  const d = useDraft<ApprovalRuleDef[]>(core.config.approvalRules);
  const [sel, setSel] = useState<string | null>(core.config.approvalRules[0]?.id || null);
  const [sampleId, setSampleId] = useState("");
  const errors = ruleErrors(d.draft);
  const ri = Math.max(0, d.draft.findIndex((r) => r.id === sel));
  const rule = d.draft[ri];
  const E = (k: string) => (rule ? errors[rule.id + ":" + k] : undefined);
  const set = (fn: (r: ApprovalRuleDef) => void) => d.update((x) => fn(x[ri]));
  const roles = roleOptions(core);
  const name = (id: string | null) => core.data.people.find((p) => p.id === id)?.name || "Nobody";

  const formsUsing = (ruleId: string) => core.config.requestForms.filter((f) => f.approvalRuleId === ruleId);
  const numericFields = rule ? formsUsing(rule.id).flatMap((f) => f.fields.filter((x) => x.kind === "number" || x.kind === "money")) : [];
  const uniqNumeric = numericFields.filter((f, i) => numericFields.findIndex((x) => x.key === f.key) === i);
  const samples = rule ? core.data.requests.filter((r) => formsUsing(rule.id).some((f) => f.id === r.formId)) : [];
  const sample = samples.find((r) => r.id === sampleId) || samples[0];
  const removeBlock = (id: string) => {
    if (!core.config.approvalRules.some((r) => r.id === id)) return null;
    if (formsUsing(id).length) return "Forms still use this rule: " + formsUsing(id).map((f) => f.label).join(", ") + ".";
    if (core.data.approvals.some((a) => a.ruleId === id && a.status === "pending")) return "Pending approvals still follow this rule.";
    return null;
  };

  const add = () => {
    const id = newId("rule", d.draft.map((r) => r.id), "new");
    d.update((x) => { x.push({ id, label: "New rule", formId: "", prohibitSelfApproval: true, slaPolicyId: core.config.slaPolicies[0]?.id || "", escalateToRole: "admin",
      stages: [{ id: "st-1", label: T.team + " manager", eligibleRoles: ["team_manager"], scope: "requester-team" }] }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      for (const r of c.approvalRules) if (!d.draft.some((x) => x.id === r.id)) { const b = removeBlock(r.id); if (b) return r.label + ": " + b; }
      c.approvalRules = d.draft;
    }, "Updated approval routing");
  };
  const stageUpd = (i: number, fn: (st: ApprovalStageDef) => void) => set((r) => fn(r.stages[i]));

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        {d.draft.length === 0 ? (
          <Empty title="No approval rules yet" body="An approval rule says who decides a request, in which order, and what happens when nobody is available. Add one, then link request forms to it."
            action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a rule</Button>} />
        ) : (
          <>
            <ItemPicker label="Approval rules" items={d.draft.map((r) => ({ id: r.id, label: r.label, note: Object.keys(errors).some((k) => k.startsWith(r.id + ":") && errors[k]) ? "needs fixing" : undefined }))}
              value={rule.id} onChange={(id) => { setSel(id); setSampleId(""); }} after={<Button size="sm" disabled={!canEdit} onClick={add}>Add rule</Button>} />
            <Lock on={!canEdit}>
            <div className="st-grid">
              <Field label="Name" error={E("label")}><TextInput ariaLabel="Rule name" value={rule.label} invalid={!!E("label")} onChange={(v) => set((r) => { r.label = v; })} /></Field>
              <Field label="Deadline policy">
                <Select ariaLabel="Deadline policy" value={rule.slaPolicyId} onChange={(v) => set((r) => { r.slaPolicyId = v; })}
                  options={[{ value: "", label: "No deadline" }, ...core.config.slaPolicies.map((p) => ({ value: p.id, label: p.label }))]} />
              </Field>
              <Field label="Escalate to role" help="Used when nobody eligible is available, or a stage runs late.">
                <Select ariaLabel="Escalate to role" value={rule.escalateToRole} onChange={(v) => set((r) => { r.escalateToRole = v; })} options={roles} />
              </Field>
            </div>
            <Toggle checked={rule.prohibitSelfApproval} disabled={!canEdit} onChange={(v) => set((r) => { r.prohibitSelfApproval = v; })}
              label="Prohibit self-approval: a requester never decides their own request" />
            <div className="pk-help">Used by: {formsUsing(rule.id).map((f) => f.label).join(", ") || "no form yet. Link a form to this rule in Request forms."}</div>

            <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => set((r) => { r.stages.push({ id: newId("st", r.stages.map((s) => s.id)), label: "", eligibleRoles: [], scope: "requester-team" }); })}>Add stage</Button>}>Stages, in order</SubHead>
            {E("stages") && <div className="pk-error">{E("stages")}</div>}
            {rule.stages.map((st, i) => (
              <div key={st.id} className="st-box" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="st-row">
                  <Chip tone="neutral" plain>Stage {i + 1}</Chip>
                  <span className="pk-grow" />
                  <Button size="sm" variant="ghost" disabled={!canEdit || i === 0} onClick={() => set((r) => moveItem(r.stages, i, -1))}>Move up</Button>
                  <Button size="sm" variant="ghost" disabled={!canEdit || i === rule.stages.length - 1} onClick={() => set((r) => moveItem(r.stages, i, 1))}>Move down</Button>
                  <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => set((r) => { r.stages.splice(i, 1); })}>Remove</Button>
                </div>
                <div className="st-grid">
                  <Field label="Stage name"><TextInput ariaLabel="Stage name" value={st.label} invalid={!!E("s" + i)} onChange={(v) => stageUpd(i, (x) => { x.label = v; })} /></Field>
                  <Field label="Decided within">
                    <Select ariaLabel="Decided within" value={st.scope} onChange={(v) => stageUpd(i, (x) => { x.scope = v as StageScope; })}
                      options={(Object.keys(SCOPE_LABEL) as StageScope[]).filter((k) => k !== "requester-unit" || core.config.capabilities.units || st.scope === k)
                        .map((k) => ({ value: k, label: SCOPE_LABEL[k].replace("team", T.team.toLowerCase()).replace("unit", T.unit.toLowerCase()).replace("organisation", T.organisation.toLowerCase()) }))} />
                  </Field>
                </div>
                <Field label="Eligible roles"><CheckList label="Eligible roles" disabled={!canEdit} value={st.eligibleRoles} onChange={(v) => stageUpd(i, (x) => { x.eligibleRoles = v; })} options={roles} /></Field>
                <Toggle checked={!!st.when} disabled={!canEdit || (!st.when && !uniqNumeric.length)}
                  title={!uniqNumeric.length ? "No number or money field on the forms that use this rule" : undefined}
                  onChange={(v) => stageUpd(i, (x) => { x.when = v ? { field: uniqNumeric[0]?.key || "", over: 0 } : undefined; })}
                  label={uniqNumeric.length || st.when ? "Only when a value is over a threshold" : "Only when a value is over a threshold (needs a number or money field on a linked form)"} />
                {st.when && (
                  <div className="st-grid">
                    <Field label="Field">
                      <Select ariaLabel="Threshold field" value={st.when.field} onChange={(v) => stageUpd(i, (x) => { x.when!.field = v; })}
                        options={[...uniqNumeric.map((f) => ({ value: f.key, label: f.label })), ...(uniqNumeric.some((f) => f.key === st.when!.field) ? [] : [{ value: st.when.field, label: st.when.field || "Choose" }])]} />
                    </Field>
                    <Field label="Over"><NumberInput ariaLabel="Threshold amount" min={0} value={st.when.over} invalid={!!E("s" + i)} onChange={(v) => stageUpd(i, (x) => { x.when!.over = v as number; })} /></Field>
                  </div>
                )}
                {E("s" + i) && <div className="pk-error">{E("s" + i)}</div>}
              </div>
            ))}
            {removeBlock(rule.id) === null && (
              <div><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => { d.update((x) => { x.splice(ri, 1); }); setSel(null); }}>Remove this rule</Button></div>
            )}

            </Lock>
            <Preview title="Preview: routing now">
              {!samples.length ? <div>No existing requests use this rule yet, so there is nothing to route. Routing is worked out when a request is submitted.</div> : (
                <>
                  <div className="st-row" style={{ marginBottom: 8 }}>
                    <span>Sample request</span>
                    <div style={{ minWidth: 220, flex: "0 1 320px" }}>
                      <Select ariaLabel="Sample request" value={sample!.id} onChange={setSampleId} options={samples.map((r) => ({ value: r.id, label: r.ref + ": " + r.title }))} />
                    </div>
                  </div>
                  <div>Requested by {name(sample!.requesterId)} in {core.config.teams.find((t) => t.id === sample!.teamId)?.label || "no " + T.team.toLowerCase()}.</div>
                  <ul style={{ marginTop: 4 }}>
                    {routePreview(core, rule, sample!).stages.map(({ st, applies, pool, to, self, fallback }, i) => (
                      <li key={i}>
                        <strong>{st.label || "Stage " + (i + 1)}</strong>:{" "}
                        {!applies ? "skipped, the value is not over " + st.when!.over + "."
                          : to ? <>routes to {name(to)}{pool.length > 1 ? " (also eligible: " + pool.slice(1).map(name).join(", ") + ")" : ""}.</>
                          : "nobody is eligible, and nobody holds the escalation role either. It would wait unassigned."}
                        {self && " The requester is eligible but cannot approve their own request, so it goes to the next person."}
                        {fallback && to && " Nobody eligible in scope, so it goes to the escalation role."}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 4 }}>This is how the rule would route if the request were submitted now. Decisions already made are not changed.</div>
                </>
              )}
            </Preview>
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Workflow templates ────────────────────────────────────────────────── */

const STEP_KIND: Record<WorkflowStepDef["kind"], string> = { task: "Task", approval: "Approval", action: "Action", notify: "Notification", check: "Check" };

export function WorkflowsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<WorkflowTemplateDef[]>(core.config.workflowTemplates);
  const [sel, setSel] = useState<string | null>(core.config.workflowTemplates[0]?.id || null);
  const ti = Math.max(0, d.draft.findIndex((w) => w.id === sel));
  const wf = d.draft[ti];
  const set = (fn: (w: WorkflowTemplateDef) => void) => d.update((x) => fn(x[ti]));
  const errors: Errs = {};
  d.draft.forEach((w) => {
    if (!w.label.trim()) errors[w.id + ":label"] = "Enter a name.";
    if (!w.ownerId) errors[w.id + ":owner"] = "Choose an owner.";
    if (!w.steps.length) errors[w.id + ":steps"] = "Add at least one step.";
    w.steps.forEach((st, i) => { if (!st.label.trim()) errors[w.id + ":s" + i] = "Enter a step name."; });
    if (w.trigger.kind !== "manual" && !w.trigger.detail.trim()) errors[w.id + ":trigger"] = "Describe when it starts.";
  });
  const E = (k: string) => (wf ? errors[wf.id + ":" + k] : undefined);
  const runs = wf ? core.data.runs.filter((r) => r.templateId === wf.id) : [];
  const activeRuns = runs.filter((r) => r.status !== "completed").length;

  const add = () => {
    const id = newId("wf", d.draft.map((w) => w.id), "new");
    d.update((x) => { x.push({ id, label: "New template", description: "", ownerId: core.data.people.find((p) => p.kind === "staff" && p.status === "active")?.id || "",
      trigger: { kind: "manual", detail: "" }, steps: [{ id: "s-1", label: "First step", kind: "task", effect: "local" }], enabled: false }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      for (const w of c.workflowTemplates) if (!d.draft.some((x) => x.id === w.id) && core.data.runs.some((r) => r.templateId === w.id && r.status !== "completed"))
        return w.label + " still has runs in progress. Let them finish first.";
      c.workflowTemplates = d.draft;
    }, "Updated workflow templates");
  };
  const stepUpd = (i: number, fn: (s: WorkflowStepDef) => void) => set((w) => fn(w.steps[i]));

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        {d.draft.length === 0 ? (
          <Empty title="No workflow templates yet" body="A template is a reusable list of steps with an owner and a trigger. Add one, then start runs from Work."
            action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a template</Button>} />
        ) : (
          <>
            <ItemPicker label="Workflow templates" items={d.draft.map((w) => ({ id: w.id, label: w.label, note: !w.enabled ? "off" : undefined }))} value={wf.id} onChange={setSel}
              after={<Button size="sm" disabled={!canEdit} onClick={add}>Add template</Button>} />
            <Lock on={!canEdit}>
            <Toggle checked={wf.enabled} disabled={!canEdit} onChange={(v) => set((w) => { w.enabled = v; })} label={wf.enabled ? "On: new runs can start" : "Off: no new runs start"} />
            <div className="st-grid">
              <Field label="Name" error={E("label")}><TextInput ariaLabel="Template name" value={wf.label} invalid={!!E("label")} onChange={(v) => set((w) => { w.label = v; })} /></Field>
              <Field label="Owner" error={E("owner")}><Select ariaLabel="Owner" value={wf.ownerId} invalid={!!E("owner")} onChange={(v) => set((w) => { w.ownerId = v; })} options={staffOptions(core, "Choose an owner")} /></Field>
              <Field label="Trigger">
                <Select ariaLabel="Trigger" value={wf.trigger.kind} onChange={(v) => set((w) => { w.trigger.kind = v as WorkflowTemplateDef["trigger"]["kind"]; })}
                  options={[{ value: "manual", label: "Started by a person" }, { value: "schedule", label: "On a schedule" }, { value: "event", label: "When something happens" }]} />
              </Field>
            </div>
            <Field label="Trigger detail" error={E("trigger")} help={wf.trigger.kind === "schedule" ? "Schedules run from Work > Schedules. No background scheduler runs in this demo." : undefined}>
              <TextInput ariaLabel="Trigger detail" value={wf.trigger.detail} invalid={!!E("trigger")} placeholder={wf.trigger.kind === "manual" ? "Optional" : "For example: a request is submitted"} onChange={(v) => set((w) => { w.trigger.detail = v; })} />
            </Field>
            <Field label="Description" htmlFor="wf-desc"><TextArea id="wf-desc" rows={2} value={wf.description} onChange={(v) => set((w) => { w.description = v; })} /></Field>

            <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => set((w) => { w.steps.push({ id: newId("s", w.steps.map((s) => s.id)), label: "", kind: "task", effect: "local" }); })}>Add step</Button>}>Steps</SubHead>
            {E("steps") && <div className="pk-error">{E("steps")}</div>}
            <div className="st-tbl-wrap">
              <table className="st-tbl" aria-label="Steps">
                <thead><tr><th>#</th><th>Step</th><th>Kind</th><th>Effect</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
                <tbody>
                  {wf.steps.map((st, i) => (
                    <tr key={st.id}>
                      <td className="pk-mono">{i + 1}</td>
                      <td style={{ minWidth: 180 }}>
                        <TextInput ariaLabel="Step name" value={st.label} invalid={!!E("s" + i)} onChange={(v) => stepUpd(i, (x) => { x.label = v; })} />
                        {E("s" + i) && <div className="pk-error">{E("s" + i)}</div>}
                        {st.effect === "external" && <div className="pk-help">Needs a connection. Runs stop at this step until one is set up.</div>}
                      </td>
                      <td style={{ minWidth: 120 }}><Select ariaLabel="Step kind" value={st.kind} onChange={(v) => stepUpd(i, (x) => { x.kind = v as WorkflowStepDef["kind"]; })} options={Object.entries(STEP_KIND).map(([value, label]) => ({ value, label }))} /></td>
                      <td style={{ minWidth: 150 }}>
                        <Select ariaLabel="Step effect" value={st.effect || ""} onChange={(v) => stepUpd(i, (x) => { x.effect = (v || undefined) as WorkflowStepDef["effect"]; })}
                          options={[{ value: "", label: "No effect" }, { value: "local", label: "Changes Pulse" }, { value: "external", label: "External system" }]} />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Button size="sm" variant="ghost" disabled={!canEdit || i === 0} onClick={() => set((w) => moveItem(w.steps, i, -1))}>Up</Button>
                        <Button size="sm" variant="ghost" disabled={!canEdit || i === wf.steps.length - 1} onClick={() => set((w) => moveItem(w.steps, i, 1))}>Down</Button>
                        <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => set((w) => { w.steps.splice(i, 1); })}>Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Lock>
            <Preview>
              {runs.length ? <>{runs.length} run{runs.length === 1 ? "" : "s"} used this template ({activeRuns} not completed). Runs already started keep their own steps; changes apply to new runs only.</>
                : "No runs have used this template yet. Changes apply to new runs."}
              {wf.steps.some((s) => s.effect === "external") && <div style={{ marginTop: 4 }}>{wf.steps.filter((s) => s.effect === "external").length} step(s) need an external connection. None is connected in this demo, so runs stop there and say why.</div>}
            </Preview>
            {!runs.some((r) => r.status !== "completed") && (
              <div><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => { d.update((x) => { x.splice(ti, 1); }); setSel(null); }}>Remove this template</Button></div>
            )}
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Deadlines & escalation ────────────────────────────────────────────── */

export function SlaSection(_p: SectionProps) {
  const { core, ctx } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<{ policies: SlaPolicyDef[]; timezone: string }>({ policies: core.config.slaPolicies, timezone: core.config.timezone });
  const [sel, setSel] = useState<string | null>(core.config.slaPolicies[0]?.id || null);
  const pi = Math.max(0, d.draft.policies.findIndex((p) => p.id === sel));
  const pol = d.draft.policies[pi];
  const set = (fn: (p: SlaPolicyDef) => void) => d.update((x) => fn(x.policies[pi]));
  const errors: Errs = {};
  if (!isValidTimezone(d.draft.timezone)) errors.tz = "Not a recognised timezone. Use an IANA name such as Europe/Dublin or UTC.";
  d.draft.policies.forEach((p) => {
    if (!p.label.trim()) errors[p.id + ":label"] = "Enter a name.";
    if (!(p.targetHours > 0)) errors[p.id + ":target"] = "Enter a number of hours above 0.";
    if (!(p.remindAtPercent >= 1 && p.remindAtPercent <= 99)) errors[p.id + ":remind"] = "Enter a percentage from 1 to 99.";
  });
  const E = (k: string) => (pol ? errors[pol.id + ":" + k] : undefined);
  const block = (id: string) => {
    if (id === "sla-task") return "Pulse uses this policy for the tasks it creates.";
    const rules = core.config.approvalRules.filter((r) => r.slaPolicyId === id);
    if (rules.length) return "Used by " + rules.map((r) => r.label).join(", ") + ".";
    return null;
  };
  const tz = isValidTimezone(d.draft.timezone) ? d.draft.timezone : core.config.timezone;
  const due = pol && pol.targetHours > 0 ? (pol.calendar === "business" ? addBusinessHours(ctx.now, pol.targetHours, tz) : addHours(ctx.now, pol.targetHours)) : null;
  const remind = pol && pol.targetHours > 0 && pol.remindAtPercent > 0 ? (pol.calendar === "business" ? addBusinessHours(ctx.now, pol.targetHours * pol.remindAtPercent / 100, tz) : addHours(ctx.now, pol.targetHours * pol.remindAtPercent / 100)) : null;

  const add = () => {
    const id = newId("sla", d.draft.policies.map((p) => p.id), "new");
    d.update((x) => { x.policies.push({ id, label: "New deadline", targetHours: 8, calendar: "business", businessHours: "09:00-17:00, Monday to Friday", pauseWhenWaiting: true, remindAtPercent: 75, escalateToRole: "admin" }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      for (const p of c.slaPolicies) if (!d.draft.policies.some((x) => x.id === p.id)) { const b = block(p.id); if (b) return p.label + ": " + b; }
      c.slaPolicies = d.draft.policies;
      c.timezone = d.draft.timezone.trim();
    }, "Updated deadlines and timezone");
  };

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
        <Field label="Reference timezone" error={errors.tz} help="Deadlines, schedules and dates across Pulse are worked out in this timezone.">
          <div style={{ maxWidth: 320 }}><TextInput ariaLabel="Reference timezone" value={d.draft.timezone} invalid={!!errors.tz} onChange={(v) => d.update((x) => { x.timezone = v; })} /></div>
        </Field>
        </Lock>
        <SubHead>Deadline policies</SubHead>
        {d.draft.policies.length === 0 ? (
          <Empty title="No deadline policies" body="Add a policy to give decisions and tasks a target time." action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a policy</Button>} />
        ) : (
          <>
            <ItemPicker label="Deadline policies" items={d.draft.policies.map((p) => ({ id: p.id, label: p.label }))} value={pol.id} onChange={setSel}
              after={<Button size="sm" disabled={!canEdit} onClick={add}>Add policy</Button>} />
            <Lock on={!canEdit}>
            <div className="st-grid">
              <Field label="Name" error={E("label")}><TextInput ariaLabel="Policy name" value={pol.label} invalid={!!E("label")} onChange={(v) => set((p) => { p.label = v; })} /></Field>
              <Field label="Target, in hours" error={E("target")}><NumberInput ariaLabel="Target hours" min={0} step={0.5} value={pol.targetHours} invalid={!!E("target")} onChange={(v) => set((p) => { p.targetHours = v as number; })} /></Field>
              <Field label="Calendar">
                <Select ariaLabel="Calendar" value={pol.calendar} onChange={(v) => set((p) => { p.calendar = v as SlaPolicyDef["calendar"]; })}
                  options={[{ value: "business", label: "Business hours only" }, { value: "calendar", label: "Every hour (calendar time)" }]} />
              </Field>
              <Field label="Remind at, % of target" error={E("remind")}><NumberInput ariaLabel="Remind at percent" min={1} value={pol.remindAtPercent} invalid={!!E("remind")} onChange={(v) => set((p) => { p.remindAtPercent = v as number; })} /></Field>
              <Field label="Escalate to role"><Select ariaLabel="Escalate to role" value={pol.escalateToRole} onChange={(v) => set((p) => { p.escalateToRole = v; })} options={roleOptions(core)} /></Field>
            </div>
            {pol.calendar === "business" && (
              <Field label="Business hours" help="Shown to people. Deadlines are calculated on 09:00 to 17:00, Monday to Friday, in the reference timezone.">
                <TextInput ariaLabel="Business hours" value={pol.businessHours} onChange={(v) => set((p) => { p.businessHours = v; })} />
              </Field>
            )}
            <Toggle checked={pol.pauseWhenWaiting} disabled={!canEdit} onChange={(v) => set((p) => { p.pauseWhenWaiting = v; })} label="Pause the clock while waiting on the requester" />
            </Lock>
            <Preview>
              {due ? <>A decision submitted now ({fmtDateTime(ctx.now, tz)}) would be due at <strong>{fmtDateTime(due, tz)}</strong> ({tz}).
                {remind && <> A reminder would go to the owner at {fmtDateTime(remind, tz)}.</>} If it is still open then, it escalates to {roleOptions(core).find((r) => r.value === pol.escalateToRole)?.label || "the escalation role"}.</>
                : "Enter a target to see when a decision would be due."}
            </Preview>
            {block(pol.id) === null && <div><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => { d.update((x) => { x.policies.splice(pi, 1); }); setSel(null); }}>Remove this policy</Button></div>}
            {block(pol.id) && <div className="pk-help">Cannot be removed: {block(pol.id)}</div>}
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Notification routing ──────────────────────────────────────────────── */

const EVENTS: { value: string; label: string }[] = [
  { value: "approval.pending", label: "Decision waiting" }, { value: "approval.escalated", label: "Decision escalated" },
  { value: "approval.decided", label: "Decision made" }, { value: "request.returned", label: "Request returned for changes" },
  { value: "task.assigned", label: "Task assigned" }, { value: "task.overdue", label: "Task overdue" },
  { value: "run.failed", label: "Workflow run failed" }, { value: "issue.opened", label: "Data issue opened" },
  { value: "sync.failed", label: "Source sync failed" }
];

export function NotificationsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<NotificationRouteDef[]>(core.config.notificationRoutes);
  const errors: Errs = {};
  d.draft.forEach((r, i) => {
    if (!r.label.trim()) errors["l" + i] = "Enter a label.";
    if (!r.recipients.trim()) errors["r" + i] = "Say who receives it.";
  });
  const upd = (i: number, fn: (r: NotificationRouteDef) => void) => d.update((x) => fn(x[i]));
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.notificationRoutes = d.draft; }, "Updated notification routing"); };
  const evLabel = (e: string) => EVENTS.find((x) => x.value === e)?.label || e;

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => d.update((x) => { x.push({ id: newId("nr", x.map((r) => r.id)), event: "task.assigned", label: "Task assigned", channel: "in-app", recipients: "Assignee" }); })}>Add route</Button>}>Routes</SubHead>
        <Lock on={!canEdit}>
        {d.draft.length === 0 ? <Empty title="No notification routes" body="Without routes, people only see changes when they open a page. Add a route for the events that need someone's attention." /> : (
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label="Notification routes">
              <thead><tr><th>Event</th><th>Label</th><th>Channel</th><th>Recipients</th><th>Delivery</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
              <tbody>
                {d.draft.map((r, i) => {
                  const saved = core.config.notificationRoutes.some((x) => x.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td style={{ minWidth: 160 }}>
                        {saved ? <span>{evLabel(r.event)} <span className="pk-mono pk-faint" style={{ fontSize: 10.5 }}>{r.event}</span></span>
                          : <Select ariaLabel="Event" value={r.event} onChange={(v) => upd(i, (x) => { x.event = v; x.label = evLabel(v); })} options={EVENTS} />}
                      </td>
                      <td style={{ minWidth: 150 }}><TextInput ariaLabel="Label" value={r.label} invalid={!!errors["l" + i]} onChange={(v) => upd(i, (x) => { x.label = v; })} />{errors["l" + i] && <div className="pk-error">{errors["l" + i]}</div>}</td>
                      <td style={{ minWidth: 110 }}><Select ariaLabel="Channel" value={r.channel} onChange={(v) => upd(i, (x) => { x.channel = v as NotificationRouteDef["channel"]; })} options={[{ value: "in-app", label: "In Pulse" }, { value: "email", label: "Email" }]} /></td>
                      <td style={{ minWidth: 170 }}><TextInput ariaLabel="Recipients" value={r.recipients} invalid={!!errors["r" + i]} onChange={(v) => upd(i, (x) => { x.recipients = v; })} />{errors["r" + i] && <div className="pk-error">{errors["r" + i]}</div>}</td>
                      <td style={{ minWidth: 180 }}>{r.channel === "email" ? <><Chip tone="warn">Not connected</Chip><div className="pk-help" style={{ marginTop: 3 }}>Needs an email connection; nothing is sent in this demo.</div></> : <Chip tone="ok">Shown in Pulse</Chip>}</td>
                      <td><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => d.update((x) => { x.splice(i, 1); })}>Remove</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </Lock>
        <div className="pk-help">Recipients are described in words (for example: current stage owner) and resolved from roles when the event happens.</div>
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Agent controls ────────────────────────────────────────────────────── */

export function AgentsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const T = core.config.terminology;
  const d = useDraft<AgentDef[]>(core.config.agents);
  const [sel, setSel] = useState<string | null>(core.config.agents[0]?.id || null);
  const ai = Math.max(0, d.draft.findIndex((a) => a.id === sel));
  const ag = d.draft[ai];
  const set = (fn: (a: AgentDef) => void) => d.update((x) => fn(x[ai]));
  const errors: Errs = {};
  d.draft.forEach((a) => {
    if (!a.name.trim()) errors[a.id + ":name"] = "Enter a name.";
    if (!a.purpose.trim()) errors[a.id + ":purpose"] = "Say what it is for.";
    if (!a.responsibleId) errors[a.id + ":resp"] = "Choose the responsible person.";
    if (a.scope.teamIds !== "all" && !a.scope.teamIds.length) errors[a.id + ":scope"] = "Choose at least one " + T.team.toLowerCase() + ".";
    if (a.permittedActions.some((x) => !x.trim()) || a.approvalRequired.some((x) => !x.trim())) errors[a.id + ":lists"] = "Remove empty lines.";
  });
  const E = (k: string) => (ag ? errors[ag.id + ":" + k] : undefined);
  const add = () => {
    const id = newId("ag", d.draft.map((a) => a.id), "new");
    const like = d.draft[0];
    d.update((x) => { x.push({ id, name: "New agent", purpose: "", responsibleId: "", scope: { teamIds: "all" }, permittedActions: ["Read records in the asker's scope"], approvalRequired: [],
      shape: like?.shape || "crown-pebble", tint: like?.tint || "#191c1f", enabled: false }); });
    setSel(id);
  };
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.agents = d.draft.map((a) => ({ ...a, permittedActions: a.permittedActions.map((s) => s.trim()), approvalRequired: a.approvalRequired.map((s) => s.trim()) })); }, "Updated agent controls"); };

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Notice>Agent work uses the same tasks, approvals and authority rules as people. An agent never decides an approval, and anything listed under "needs approval" goes to a person first. No AI model is connected in this demo, so agents answer with labelled sample responses.</Notice>
        {d.draft.length === 0 ? (
          <Empty title="No agents configured" body="Add an agent with a clear purpose, a responsible person and a limited scope." action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add an agent</Button>} />
        ) : (
          <>
            <ItemPicker label="Agents" items={d.draft.map((a) => ({ id: a.id, label: a.name, note: !a.enabled ? "off" : undefined }))} value={ag.id} onChange={setSel}
              after={<Button size="sm" disabled={!canEdit} onClick={add}>Add agent</Button>} />
            <Lock on={!canEdit}>
            <Toggle checked={ag.enabled} disabled={!canEdit} onChange={(v) => set((a) => { a.enabled = v; })} label={ag.enabled ? "On" : "Off: it does nothing and is hidden from chat"} />
            <div className="st-grid">
              <Field label="Name" error={E("name")}><TextInput ariaLabel="Agent name" value={ag.name} invalid={!!E("name")} onChange={(v) => set((a) => { a.name = v; })} /></Field>
              <Field label="Responsible person" error={E("resp")} help="Answers for what the agent does.">
                <Select ariaLabel="Responsible person" value={ag.responsibleId} invalid={!!E("resp")} onChange={(v) => set((a) => { a.responsibleId = v; })} options={staffOptions(core, "Choose a person")} />
              </Field>
            </div>
            <Field label="Purpose" htmlFor="ag-purpose" error={E("purpose")}><TextArea id="ag-purpose" rows={2} value={ag.purpose} invalid={!!E("purpose")} onChange={(v) => set((a) => { a.purpose = v; })} /></Field>
            <Field label="Data scope" error={E("scope")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Toggle checked={ag.scope.teamIds === "all"} disabled={!canEdit} onChange={(v) => set((a) => { a.scope = { teamIds: v ? "all" : [] }; })} label={"All " + T.teams.toLowerCase() + " (still limited to what the person asking can see)"} />
                {ag.scope.teamIds !== "all" && (
                  <CheckList label={T.teams} disabled={!canEdit} value={ag.scope.teamIds} onChange={(v) => set((a) => { a.scope = { teamIds: v }; })}
                    options={core.config.teams.map((t) => ({ value: t.id, label: t.label }))} />
                )}
              </div>
            </Field>
            <div className="pk-grid2">
              <Field label="Permitted actions"><ListEditor label="Permitted action" items={ag.permittedActions} disabled={!canEdit} placeholder="For example: read records" onChange={(v) => set((a) => { a.permittedActions = v; })} /></Field>
              <Field label="Needs approval before acting"><ListEditor label="Action needing approval" items={ag.approvalRequired} disabled={!canEdit} placeholder="For example: change a record value" onChange={(v) => set((a) => { a.approvalRequired = v; })} /></Field>
            </div>
            {E("lists") && <div className="pk-error">{E("lists")}</div>}
            </Lock>
            <div><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => { d.update((x) => { x.splice(ai, 1); }); setSel(null); }}>Remove this agent</Button></div>
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}
