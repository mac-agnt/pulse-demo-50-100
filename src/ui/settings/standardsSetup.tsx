/* Settings: Standards and requirements. Requirements (who they apply to, the
   evidence expected, renewal and reviewers), repeatable checks, and which
   policies people must acknowledge. Edits go through ops.updateConfig. */

import { useState } from "react";
import {
  useCore, store, applicableSubjects, allSubjects, ensureObligations, subjectKindLabel, SUBJECT_KINDS, CHECK_EVERY_LABEL, moduleEnabled,
  type CheckDef, type RequirementDef, type RequirementSubject, type CoreState
} from "../../core";
import { Button, Empty, Field, Notice, Select, TextArea, TextInput } from "../kit";
import {
  CheckList, InlineConfirm, ItemPicker, ListEditor, Lock, NumberInput, Preview, ReadOnlyLine, SaveBar, SubHead,
  errCount, newId, saveConfig, staffOptions, useCanEdit, useDraft
} from "./common";
import type { SectionProps } from "./SettingsPage";

type Errs = Record<string, string | undefined>;
type Tab = "requirements" | "checks" | "policies";

export function StandardsSetupSection(_p: SectionProps) {
  const { core } = useCore();
  const [tab, setTab] = useState<Tab>("requirements");
  const on = moduleEnabled(core.config, "standards");
  return (
    <div className="st-detail-b">
      {!on && <Notice tone="warn">The Standards module is off, so none of this shows in navigation. You can still prepare it here; switch it on in Modules and labels.</Notice>}
      <ItemPicker label="Standards settings" value={tab} onChange={(id) => setTab(id as Tab)} items={[
        { id: "requirements", label: "Requirements", note: String(core.config.standards.requirements.length) },
        { id: "checks", label: "Repeatable checks", note: String(core.config.standards.checks.length) },
        { id: "policies", label: "Policy acknowledgement", note: String(core.config.standards.acknowledgePolicyIds.length) }
      ]} />
      {tab === "requirements" && <RequirementsEditor />}
      {tab === "checks" && <ChecksEditor />}
      {tab === "policies" && <PoliciesEditor />}
    </div>
  );
}

/* ── Requirements ──────────────────────────────────────────────────────── */

function reqErrors(list: RequirementDef[], s: CoreState): Errs {
  const e: Errs = {};
  const labels = list.map((r) => r.label.trim().toLowerCase());
  list.forEach((r, i) => {
    if (!r.label.trim()) e[r.id + ":label"] = "Enter a name.";
    else if (labels.indexOf(r.label.trim().toLowerCase()) !== i) e[r.id + ":label"] = "Another requirement has this name.";
    if (!r.evidence.trim()) e[r.id + ":evidence"] = "Say what evidence is expected.";
    if (!r.reviewerRoleIds.length) e[r.id + ":reviewers"] = "Choose at least one reviewer role.";
    else if (!r.reviewerRoleIds.some((id) => s.config.roles.find((x) => x.id === id)?.permissions.includes("standards.review"))) {
      e[r.id + ":reviewers"] = "None of these roles has the Review evidence permission, so no one could decide.";
    }
    if (r.renewEveryMonths !== undefined && (!Number.isInteger(r.renewEveryMonths) || r.renewEveryMonths < 1 || r.renewEveryMonths > 120)) e[r.id + ":renew"] = "Use whole months from 1 to 120, or leave it empty.";
    if (r.certificateName && r.appliesTo !== "person") e[r.id + ":cert"] = "Certificates only apply to people.";
  });
  return e;
}

function RequirementsEditor() {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<RequirementDef[]>(core.config.standards.requirements);
  const [sel, setSel] = useState<string | null>(core.config.standards.requirements[0]?.id || null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const errors = reqErrors(d.draft, core);
  const i = Math.max(0, d.draft.findIndex((r) => r.id === sel));
  const r = d.draft[i];
  const E = (k: string) => (r ? errors[r.id + ":" + k] : undefined);
  const set = (fn: (x: RequirementDef) => void) => d.update((x) => fn(x[i]));
  const setSelector = (fn: (sel: NonNullable<RequirementDef["selector"]>) => void) => set((x) => {
    const s = { ...(x.selector || {}) };
    fn(s);
    const empty = !s.projectTypeIds?.length && !s.teamIds?.length && !s.unitIds?.length && !s.recordTypeId && !s.subjectIds?.length;
    x.selector = empty ? undefined : s;
  });
  const roles = core.config.roles;
  const rows = core.data.obligations.filter((o) => o.requirementId === r?.id).length;
  const untracked = (() => {
    let n = 0;
    for (const req of core.config.standards.requirements) {
      if (req.certificateName) continue;
      for (const sub of applicableSubjects(core, req)) if (!core.data.obligations.some((o) => o.requirementId === req.id && o.subject.kind === sub.kind && o.subject.id === sub.id)) n++;
    }
    return n;
  })();

  const add = () => {
    const id = newId("rq", d.draft.map((x) => x.id), "new");
    d.update((x) => { x.push({ id, label: "New requirement", description: "", appliesTo: "project", evidence: "", reviewerRoleIds: roles.filter((ro) => ro.permissions.includes("standards.review")).map((ro) => ro.id) }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      c.standards.requirements = d.draft.map((x) => ({ ...x, label: x.label.trim(), description: x.description.trim(), evidence: x.evidence.trim(), blocks: x.blocks?.trim() || undefined,
        certificateName: x.appliesTo === "person" ? x.certificateName || undefined : undefined }));
    }, "Updated standards requirements");
  };
  const remove = () => {
    d.update((x) => { x.splice(i, 1); });
    setSel(d.draft[i === 0 ? 1 : 0]?.id || null);
    setConfirmRemove(false);
  };

  if (!d.draft.length) {
    return <Empty title="No requirements yet" body="A requirement says what evidence a person, project, location, unit, record or supplier needs, who reviews it and how often it renews."
      action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a requirement</Button>} />;
  }
  const kindSubjects = allSubjects(core, r.appliesTo);
  const preview = applicableSubjects(core, r);
  const certNames = [...new Set([...core.config.people.requiredCertifications.map((c) => c.name), ...core.data.employment.flatMap((e) => e.certifications.map((c) => c.name))])];
  const showTeams = r.appliesTo === "person" || r.appliesTo === "project" || r.appliesTo === "record";
  const showUnits = r.appliesTo !== "supplier" && r.appliesTo !== "unit";

  return (
    <>
      {!canEdit && <ReadOnlyLine />}
      <ItemPicker label="Requirements" items={d.draft.map((x) => ({ id: x.id, label: x.label, note: Object.keys(errors).some((k) => k.startsWith(x.id + ":") && errors[k]) ? "needs fixing" : undefined }))}
        value={r.id} onChange={setSel} after={<Button size="sm" disabled={!canEdit} onClick={add}>Add requirement</Button>} />
      <Lock on={!canEdit}>
        <div className="st-grid">
          <Field label="Name" error={E("label")}><TextInput ariaLabel="Requirement name" value={r.label} invalid={!!E("label")} onChange={(v) => set((x) => { x.label = v; })} /></Field>
          <Field label="Applies to">
            <Select ariaLabel="Applies to" value={r.appliesTo} onChange={(v) => set((x) => { x.appliesTo = v as RequirementSubject; x.selector = undefined; if (v !== "person") x.certificateName = undefined; })}
              options={SUBJECT_KINDS.map((k) => ({ value: k, label: subjectKindLabel(core.config, k) }))} />
          </Field>
        </div>
        <Field label="Description" htmlFor="rq-desc"><TextArea id="rq-desc" rows={2} value={r.description} onChange={(v) => set((x) => { x.description = v; })} /></Field>
        <div className="st-grid">
          <Field label="Evidence expected" error={E("evidence")}><TextInput ariaLabel="Evidence expected" value={r.evidence} invalid={!!E("evidence")} onChange={(v) => set((x) => { x.evidence = v; })} placeholder="For example: Signed sign-off sheet" /></Field>
          <Field label="Renews every (months)" error={E("renew")} help="Leave empty if it never expires.">
            <NumberInput ariaLabel="Renewal months" value={r.renewEveryMonths} invalid={!!E("renew")} min={1} step={1} onChange={(v) => set((x) => { x.renewEveryMonths = v === null ? undefined : v; })} />
          </Field>
          <Field label="Owner"><Select ariaLabel="Requirement owner" value={r.ownerId || ""} onChange={(v) => set((x) => { x.ownerId = v || undefined; })} options={staffOptions(core, "No owner")} /></Field>
          <Field label="Holds back (optional)" help="Shown where this is not approved, for example: New orders to this supplier.">
            <TextInput ariaLabel="Holds back" value={r.blocks || ""} onChange={(v) => set((x) => { x.blocks = v || undefined; })} />
          </Field>
        </div>
        {r.appliesTo === "person" && (
          <Field label="Met by a certificate in People" error={E("cert")} help="When set, the certificate recorded in People is the evidence. Nothing is copied into Standards.">
            <Select ariaLabel="Certificate" value={r.certificateName || ""} onChange={(v) => set((x) => { x.certificateName = v || undefined; })}
              options={[{ value: "", label: "Not a certificate: collect evidence here" }, ...certNames.map((n) => ({ value: n, label: n }))]} />
          </Field>
        )}
        <SubHead>Reviewers</SubHead>
        {E("reviewers") && <div className="pk-error">{E("reviewers")}</div>}
        <CheckList label="Reviewer roles" value={r.reviewerRoleIds} onChange={(v) => set((x) => { x.reviewerRoleIds = v; })}
          options={roles.map((ro) => ({ value: ro.id, label: ro.label + (ro.permissions.includes("standards.review") ? "" : " (cannot review evidence)") }))} />
        <div className="pk-help">Reviews route to someone holding one of these roles for the subject, never to the person who asked. Deciding also needs the Review evidence permission.</div>

        <SubHead>Which {subjectKindLabel(core.config, r.appliesTo).toLowerCase()}</SubHead>
        {r.appliesTo === "project" && core.config.projects.types.length > 0 && (
          <Field label="Project types"><CheckList label="Project types" value={r.selector?.projectTypeIds || []} onChange={(v) => setSelector((s) => { s.projectTypeIds = v; })}
            options={core.config.projects.types.map((t) => ({ value: t.id, label: t.label }))} /></Field>
        )}
        {showTeams && core.config.teams.length > 0 && (
          <Field label={core.config.terminology.teams}><CheckList label="Teams" value={r.selector?.teamIds || []} onChange={(v) => setSelector((s) => { s.teamIds = v; })}
            options={core.config.teams.map((t) => ({ value: t.id, label: t.label }))} /></Field>
        )}
        {showUnits && core.config.capabilities.units && core.config.units.length > 0 && (
          <Field label={core.config.terminology.units}><CheckList label="Units" value={r.selector?.unitIds || []} onChange={(v) => setSelector((s) => { s.unitIds = v; })}
            options={core.config.units.map((u) => ({ value: u.id, label: u.label }))} /></Field>
        )}
        {r.appliesTo === "record" && (
          <Field label="Record type"><Select ariaLabel="Record type" value={r.selector?.recordTypeId || ""} onChange={(v) => setSelector((s) => { s.recordTypeId = v || undefined; })}
            options={[{ value: "", label: "Any record type" }, ...core.config.recordTypes.map((t) => ({ value: t.id, label: t.label }))]} /></Field>
        )}
        {kindSubjects.length > 0 && kindSubjects.length <= 40 && (
          <Field label="Only these (optional)" help="Leave all unticked to use the rules above.">
            <CheckList label="Specific subjects" value={r.selector?.subjectIds || []} onChange={(v) => setSelector((s) => { s.subjectIds = v; })}
              options={kindSubjects.map((x) => ({ value: x.id, label: x.label }))} />
          </Field>
        )}
        <Preview title="Applies to now">
          <div style={{ fontSize: 13, marginTop: 6 }}>{preview.length ? preview.length + ": " + preview.slice(0, 8).map((x) => x.label).join(", ") + (preview.length > 8 ? " and " + (preview.length - 8) + " more" : "") : "Nothing yet. Check the rules above."}</div>
        </Preview>
        <div className="st-row" style={{ marginTop: 8 }}>
          {!confirmRemove
            ? <Button variant="ghost" disabled={!canEdit} onClick={() => setConfirmRemove(true)}>Remove requirement</Button>
            : <InlineConfirm danger confirmLabel="Remove" onConfirm={remove} onCancel={() => setConfirmRemove(false)}>
                Remove {r.label}? {rows ? rows + " existing records are kept but no longer shown, and cannot block anything." : "Nothing has been recorded against it yet."} It takes effect when you save.
              </InlineConfirm>}
        </div>
      </Lock>
      {!d.dirty && untracked > 0 && canEdit && (
        <Notice tone="warn">{untracked} subject{untracked === 1 ? "" : "s"} have a requirement but no record yet; they show as missing.{" "}
          <Button size="sm" onClick={() => store.run(ensureObligations)}>Create the records</Button></Notice>
      )}
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Checks ────────────────────────────────────────────────────────────── */

function checkErrors(list: CheckDef[]): Errs {
  const e: Errs = {};
  for (const c of list) {
    if (!c.label.trim()) e[c.id + ":label"] = "Enter a name.";
    if (!c.checklist.filter((x) => x.trim()).length) e[c.id + ":list"] = "Add at least one thing to confirm.";
  }
  return e;
}

function ChecksEditor() {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<CheckDef[]>(core.config.standards.checks);
  const [sel, setSel] = useState<string | null>(core.config.standards.checks[0]?.id || null);
  const errors = checkErrors(d.draft);
  const i = Math.max(0, d.draft.findIndex((c) => c.id === sel));
  const c = d.draft[i];
  const E = (k: string) => (c ? errors[c.id + ":" + k] : undefined);
  const set = (fn: (x: CheckDef) => void) => d.update((x) => fn(x[i]));
  const add = () => {
    const id = newId("chk", d.draft.map((x) => x.id), "new");
    d.update((x) => { x.push({ id, label: "New check", appliesTo: "location", every: "month", checklist: [""] }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((cfg) => { cfg.standards.checks = d.draft.map((x) => ({ ...x, label: x.label.trim(), checklist: x.checklist.map((y) => y.trim()).filter(Boolean) })); }, "Updated repeatable checks");
  };
  const runs = (id: string) => core.data.checkRuns.filter((r) => r.checkId === id).length;
  if (!d.draft.length) {
    return <Empty title="No repeatable checks yet" body="A check is something confirmed every week, month or quarter for each location, unit or other subject. Each period's check is created once."
      action={<Button variant="primary" disabled={!canEdit} onClick={add}>Add a check</Button>} />;
  }
  return (
    <>
      {!canEdit && <ReadOnlyLine />}
      <ItemPicker label="Checks" items={d.draft.map((x) => ({ id: x.id, label: x.label }))} value={c.id} onChange={setSel}
        after={<Button size="sm" disabled={!canEdit} onClick={add}>Add check</Button>} />
      <Lock on={!canEdit}>
        <div className="st-grid">
          <Field label="Name" error={E("label")}><TextInput ariaLabel="Check name" value={c.label} invalid={!!E("label")} onChange={(v) => set((x) => { x.label = v; })} /></Field>
          <Field label="For each">
            <Select ariaLabel="Applies to" value={c.appliesTo} onChange={(v) => set((x) => { x.appliesTo = v as RequirementSubject; })}
              options={SUBJECT_KINDS.map((k) => ({ value: k, label: subjectKindLabel(core.config, k, false) }))} />
          </Field>
          <Field label="Repeats">
            <Select ariaLabel="Repeats" value={c.every} onChange={(v) => set((x) => { x.every = v as CheckDef["every"]; })}
              options={(Object.keys(CHECK_EVERY_LABEL) as CheckDef["every"][]).map((k) => ({ value: k, label: CHECK_EVERY_LABEL[k] }))} />
          </Field>
          <Field label="Owner"><Select ariaLabel="Check owner" value={c.ownerId || ""} onChange={(v) => set((x) => { x.ownerId = v || undefined; })} options={staffOptions(core, "No owner")} /></Field>
        </div>
        <SubHead>What to confirm</SubHead>
        {E("list") && <div className="pk-error">{E("list")}</div>}
        <ListEditor label="Checklist item" items={c.checklist} onChange={(v) => set((x) => { x.checklist = v; })} disabled={!canEdit} addLabel="Add item" />
        <Preview>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {CHECK_EVERY_LABEL[c.every]} for {allSubjects(core, c.appliesTo).length} {subjectKindLabel(core.config, c.appliesTo).toLowerCase()}. One check per subject and period, never duplicated. A failed check creates one follow-up task in Work.
            {runs(c.id) ? " " + runs(c.id) + " checks recorded so far are kept if you change this." : ""}
          </div>
        </Preview>
      </Lock>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Policies ──────────────────────────────────────────────────────────── */

function PoliciesEditor() {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<string[]>(core.config.standards.acknowledgePolicyIds);
  const policies = core.data.files.filter((f) => f.kind === "Policy" || d.draft.includes(f.id));
  return (
    <>
      {!canEdit && <ReadOnlyLine />}
      {!policies.length ? <Empty title="No policies yet" body="Add a document of the kind Policy in Records, Files. It then appears here so you can ask people to acknowledge it." /> : (
        <Lock on={!canEdit}>
          <div className="pk-help" style={{ marginBottom: 8 }}>Active staff who can see a ticked policy are asked to acknowledge its current version. A new version asks again.</div>
          <CheckList label="Policies people must acknowledge" value={d.draft} onChange={d.set}
            options={policies.map((f) => ({ value: f.id, label: f.title + " (version " + (f.versions[f.versions.length - 1]?.n || 0) + ")" }))} />
        </Lock>
      )}
      <SaveBar dirty={d.dirty} onSave={() => saveConfig((c) => { c.standards.acknowledgePolicyIds = [...d.draft]; }, "Updated policies needing acknowledgement")} onDiscard={d.reset} />
    </>
  );
}
