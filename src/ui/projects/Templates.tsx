/* Projects > Templates. Each template lists its version, phases and
   milestone and task counts, and how many projects were created from it (and
   from which version). Creating a project opens the dated preview; editing a
   template saves a new version and never touches existing projects. */

import { useState } from "react";
import {
  can, pageLabel, projectPhaseLabel, projectTypeOf, saveProjectTemplate, store, validateProjectTemplate, viewerOf,
  type ProjectTemplateDef
} from "../../core";
import { Btn, Hero, eyebrowOf } from "../frame";
import { Button, DataTable, Empty, Field, Notice, Select, SidePanel, TextArea, TextInput, type Column } from "../kit";
import { useProjectsCtx } from "./shared";

export function Templates({ onCreate }: { onCreate: (templateId: string) => void }) {
  const { core, q, T } = useProjectsCtx();
  const [editing, setEditing] = useState<ProjectTemplateDef | null>(null);
  const v = q.viewer;
  const canEdit = can(v, "settings.edit") || (can(v, "projects.manage") && v.isOrgWide);
  const canCreate = can(v, "projects.manage");
  const list = core.config.projects.templates;

  const blank = (): ProjectTemplateDef => {
    const type = core.config.projects.types[0];
    let id = "tpl-new", n = 2;
    while (list.some((t) => t.id === id)) id = "tpl-new-" + n++;
    return { id, label: "", description: "", typeId: type?.id || "", version: 0, durationDays: 60,
      milestones: type ? [{ key: "m1", label: "First milestone", phaseId: type.phases[0]?.id || "", offsetDays: 20 }] : [], tasks: [] };
  };

  const columns: Column<ProjectTemplateDef>[] = [
    { key: "label", label: "Template", strong: true, priority: 1, width: "28%", value: (t) => t.label,
      render: (t) => <span className="pj-cell2"><span>{t.label}</span><span>{t.description}</span></span> },
    { key: "type", label: "Type", priority: 2, value: (t) => projectTypeOf(core.config, t.typeId)?.label || "Unknown" },
    { key: "version", label: "Version", priority: 1, align: "right", value: (t) => t.version },
    { key: "phases", label: "Phases", priority: 3, value: (t) => (projectTypeOf(core.config, t.typeId)?.phases || []).map((p) => p.label).join(", ") },
    { key: "ms", label: "Milestones", priority: 2, align: "right", value: (t) => t.milestones.length },
    { key: "tasks", label: "Tasks", priority: 2, align: "right", value: (t) => t.tasks.length,
      render: (t) => <span title={t.tasks.filter((x) => x.estimateHours === undefined).length + " without an estimate"}>{t.tasks.length}</span> },
    { key: "days", label: "Duration", priority: 3, align: "right", value: (t) => t.durationDays, render: (t) => t.durationDays + " days" },
    { key: "used", label: "Used by", priority: 3, value: (t) => core.data.projects.filter((p) => p.template?.id === t.id).length,
      render: (t) => {
        const used = core.data.projects.filter((p) => p.template?.id === t.id);
        const older = used.filter((p) => p.template!.version < t.version).length;
        return used.length ? used.length + " " + (used.length === 1 ? T.oneLower : T.manyLower) + (older ? ", " + older + " on an earlier version" : "") : <span className="pj-faint">Not used yet</span>;
      } },
    { key: "act", label: "", priority: 1, align: "right", value: () => "",
      render: (t) => (
        <span style={{ display: "inline-flex", gap: 6 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => onCreate(t.id)} disabled={!canCreate} title={canCreate ? undefined : "Needs the Manage projects permission"}>Use</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(structuredClone(t))} disabled={!canEdit} title={canEdit ? undefined : "Only an administrator can change templates"}>Edit</Button>
        </span>
      ) }
  ];

  return (
    <>
      <Hero eyebrow={eyebrowOf(pageLabel(core.config, "Projects"), "Templates")} title="Templates" infoOnly
        blurb={"A template creates a " + T.oneLower + " with phases, milestones and tasks dated from the start date you choose. Editing one saves a new version; " + T.manyLower + " already created keep theirs."}
        actions={<Btn primary onClick={() => setEditing(blank())} disabled={!canEdit} title={canEdit ? undefined : "Only an administrator can add templates"}>New template</Btn>} />
      <div className="pj-table">
        <DataTable rows={list} columns={columns} rowKey={(t) => t.id} onOpen={(t) => canEdit ? setEditing(structuredClone(t)) : onCreate(t.id)} caption="Templates"
          searchText={(t) => t.label + " " + t.description} searchPlaceholder="Search templates"
          empty={<Empty title="No templates yet" body={"Add a template so " + T.manyLower + " start with the same phases, milestones and tasks."}
            action={canEdit ? <Button variant="primary" onClick={() => setEditing(blank())}>New template</Button> : undefined} />} />
      </div>
      {editing && <TemplateEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateEditor({ initial, onClose }: { initial: ProjectTemplateDef; onClose: () => void }) {
  const { core, ctx, T } = useProjectsCtx();
  const [t, setT] = useState<ProjectTemplateDef>(initial);
  const [err, setErr] = useState<string | null>(null);
  const isNew = !core.config.projects.templates.some((x) => x.id === initial.id);
  const type = projectTypeOf(core.config, t.typeId);
  const phases = (type?.phases || []).map((p) => ({ value: p.id, label: p.label }));
  const reqs = core.config.standards.requirements.filter((r) => r.appliesTo === "project");
  const errors = validateProjectTemplate(core.config, t);
  const used = core.data.projects.filter((p) => p.template?.id === t.id).length;
  const set = (fn: (x: ProjectTemplateDef) => void) => setT((cur) => { const n = structuredClone(cur); fn(n); return n; });
  const nextKey = (prefix: string, keys: string[]) => { let i = keys.length + 1; while (keys.includes(prefix + i)) i++; return prefix + i; };
  const num = (s: string) => (s === "" ? NaN : Number(s));

  const save = () => {
    const r = store.run(saveProjectTemplate, t);
    if (r.ok) onClose(); else setErr(r.error);
  };
  return (
    <SidePanel open onClose={onClose} title={isNew ? "New template" : t.label || "Template"} eyebrow={isNew ? "TEMPLATE" : "TEMPLATE · VERSION " + initial.version} width={760}
      footer={<>
        <span className="pk-help pk-grow">{isNew ? "Saves as version 1." : "Saves as version " + (initial.version + 1) + ". " + (used ? used + " " + (used === 1 ? T.oneLower + " keeps" : T.manyLower + " keep") + " the version they were created from." : "")}</span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={errors.length > 0} title={errors[0]}>Save template</Button>
      </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="pj-grid2">
          <Field label="Name"><TextInput ariaLabel="Template name" value={t.label} onChange={(x) => set((d) => { d.label = x; })} /></Field>
          <Field label="Type" help="Phases come from the type.">
            <Select ariaLabel="Type" value={t.typeId} onChange={(x) => set((d) => {
              d.typeId = x;
              const first = projectTypeOf(core.config, x)?.phases[0]?.id || "";
              const ids = (projectTypeOf(core.config, x)?.phases || []).map((p) => p.id);
              d.milestones.forEach((m) => { if (!ids.includes(m.phaseId)) m.phaseId = first; });
              d.tasks.forEach((k) => { if (!ids.includes(k.phaseId)) k.phaseId = first; });
            })} options={core.config.projects.types.map((x) => ({ value: x.id, label: x.label }))} />
          </Field>
        </div>
        <Field label="Description"><TextArea value={t.description} onChange={(x) => set((d) => { d.description = x; })} rows={2} /></Field>
        <div style={{ maxWidth: 200 }}>
          <Field label="Duration, in days">
            <input className="pk-input" type="number" min={1} aria-label="Duration in days" value={Number.isFinite(t.durationDays) ? t.durationDays : ""} onChange={(e) => set((d) => { d.durationDays = num(e.target.value); })} />
          </Field>
        </div>

        <div className="pk-eyebrow">Milestones (day counted from the start date)</div>
        <div className="pj-edit-list">
          {t.milestones.map((m, i) => (
            <div key={m.key} className="pj-edit-row">
              <TextInput ariaLabel={"Milestone " + (i + 1) + " name"} value={m.label} onChange={(x) => set((d) => { d.milestones[i].label = x; })} />
              <Select ariaLabel={"Milestone " + (i + 1) + " phase"} value={m.phaseId} onChange={(x) => set((d) => { d.milestones[i].phaseId = x; })} options={phases} />
              <input className="pk-input pj-num" type="number" min={0} aria-label={"Milestone " + (i + 1) + " day"} value={Number.isFinite(m.offsetDays) ? m.offsetDays : ""}
                onChange={(e) => set((d) => { d.milestones[i].offsetDays = num(e.target.value); })} />
              <Select ariaLabel={"Milestone " + (i + 1) + " comes after"} value={m.dependsOn?.[0] || ""} onChange={(x) => set((d) => { d.milestones[i].dependsOn = x ? [x] : []; })}
                options={[{ value: "", label: "No predecessor" }, ...t.milestones.filter((o) => o.key !== m.key).map((o) => ({ value: o.key, label: "After " + (o.label || o.key) }))]} />
              <Select ariaLabel={"Milestone " + (i + 1) + " gate"} value={m.gate ? m.gate.requirementIds.join(",") : ""}
                onChange={(x) => set((d) => { d.milestones[i].gate = x ? { label: d.milestones[i].gate?.label || "Evidence accepted", requirementIds: x.split(",") } : undefined; })}
                options={[{ value: "", label: "No gate" },
                  ...(m.gate ? [{ value: m.gate.requirementIds.join(","), label: "Gate: " + m.gate.requirementIds.map((id) => reqs.find((r) => r.id === id)?.label || id).join(" and ") }] : []),
                  ...(reqs.length > 1 ? [{ value: reqs.map((r) => r.id).join(","), label: "Gate: all " + reqs.length + " requirements" }] : []),
                  ...reqs.map((r) => ({ value: r.id, label: "Gate: " + r.label }))]
                  .filter((o, k, arr) => arr.findIndex((z) => z.value === o.value) === k)} />
              <Button size="sm" variant="ghost" aria-label={"Remove milestone " + (i + 1)} onClick={() => set((d) => {
                d.milestones.splice(i, 1);
                d.milestones.forEach((x) => { x.dependsOn = (x.dependsOn || []).filter((k) => k !== m.key); });
                d.tasks.forEach((x) => { if (x.milestoneKey === m.key) x.milestoneKey = undefined; });
              })}>Remove</Button>
            </div>
          ))}
          <div><Button size="sm" disabled={!type} onClick={() => set((d) => { d.milestones.push({ key: nextKey("m", d.milestones.map((x) => x.key)), label: "", phaseId: phases[0]?.value || "", offsetDays: d.durationDays || 0 }); })}>Add milestone</Button></div>
          {!reqs.length && <div className="pk-help">No project requirements are configured in Standards, so gates cannot be added here.</div>}
        </div>

        <div className="pk-eyebrow">Tasks (leave the estimate empty when the work is not estimated)</div>
        <div className="pj-edit-list">
          {t.tasks.map((k, i) => (
            <div key={k.key} className="pj-edit-row pj-edit-row--task">
              <TextInput ariaLabel={"Task " + (i + 1) + " title"} value={k.title} onChange={(x) => set((d) => { d.tasks[i].title = x; })} />
              <Select ariaLabel={"Task " + (i + 1) + " phase"} value={k.phaseId} onChange={(x) => set((d) => { d.tasks[i].phaseId = x; })} options={phases} />
              <input className="pk-input pj-num" type="number" min={0} aria-label={"Task " + (i + 1) + " start day"} title="Start day" value={Number.isFinite(k.offsetDays) ? k.offsetDays : ""}
                onChange={(e) => set((d) => { d.tasks[i].offsetDays = num(e.target.value); })} />
              <input className="pk-input pj-num" type="number" min={0} aria-label={"Task " + (i + 1) + " duration in days"} title="Duration, days" value={Number.isFinite(k.durationDays) ? k.durationDays : ""}
                onChange={(e) => set((d) => { d.tasks[i].durationDays = num(e.target.value); })} />
              <input className="pk-input pj-num" type="number" min={0} step={0.5} aria-label={"Task " + (i + 1) + " estimate in hours"} title="Estimate, hours" placeholder="Unestimated"
                value={k.estimateHours === undefined ? "" : k.estimateHours} onChange={(e) => set((d) => { d.tasks[i].estimateHours = e.target.value === "" ? undefined : Number(e.target.value); })} />
              <Select ariaLabel={"Task " + (i + 1) + " milestone"} value={k.milestoneKey || ""} onChange={(x) => set((d) => { d.tasks[i].milestoneKey = x || undefined; })}
                options={[{ value: "", label: "No milestone" }, ...t.milestones.map((m) => ({ value: m.key, label: "For " + (m.label || m.key) }))]} />
              <Button size="sm" variant="ghost" aria-label={"Remove task " + (i + 1)} onClick={() => set((d) => {
                d.tasks.splice(i, 1);
                d.tasks.forEach((x) => { x.dependsOn = (x.dependsOn || []).filter((z) => z !== k.key); });
              })}>Remove</Button>
            </div>
          ))}
          <div><Button size="sm" disabled={!type} onClick={() => set((d) => { d.tasks.push({ key: nextKey("t", d.tasks.map((x) => x.key)), title: "", phaseId: phases[0]?.value || "", offsetDays: 0, durationDays: 5 }); })}>Add task</Button></div>
        </div>
        {type && t.milestones.length > 0 && (
          <div className="pk-help">Phases in this type: {type.phases.map((p) => projectPhaseLabel(core.config, t, p.id)).join(", ")}.</div>
        )}
        {errors.length > 0 && <Notice tone="warn">{errors[0]}{errors.length > 1 ? " (" + (errors.length - 1) + " more)" : ""}</Notice>}
        {err && <div className="pk-error" role="alert">{err}</div>}
        {!can(viewerOf(core, ctx.viewerId), "settings.edit") && <div className="pk-help">You can edit templates because you manage {T.manyLower} across the organisation.</div>}
      </div>
    </SidePanel>
  );
}
