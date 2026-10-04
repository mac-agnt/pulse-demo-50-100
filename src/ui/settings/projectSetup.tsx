/* Settings: Project types and phases. Edits go through ops.updateConfig.
   Labels change without changing ids: renaming "Project" to "Engagement" or a
   phase from "Approve" to "Sign-off" keeps every project, gate and figure
   working. Phases can be added, renamed and reordered; a phase still used by a
   project or a template cannot be removed. */

import { useState } from "react";
import { navigate, projectTerms, useCore, type ProjectSettings, type ProjectTypeDef } from "../../core";
import { Button, Field, Notice, Select, TextInput } from "../kit";
import {
  ItemPicker, Lock, NumberInput, Preview, ReadOnlyLine, SaveBar, SubHead, Toggle, errCount, keyFromLabel, moveItem, newId, saveConfig, useCanEdit, useDraft
} from "./common";
import type { SectionProps } from "./SettingsPage";

type Draft = Pick<ProjectSettings, "label" | "plural" | "types" | "progressBasis" | "atRiskSlipDays" | "cascadeMilestoneMoves">;

const BASIS: { value: ProjectSettings["progressBasis"]; label: string; help: string }[] = [
  { value: "milestones", label: "Milestones completed", help: "Completed milestones out of all milestones. Simple and hard to game." },
  { value: "tasks", label: "Tasks done", help: "Done tasks out of all tasks. A count of tasks, not effort." },
  { value: "estimate-hours", label: "Estimated hours done", help: "Estimated hours of done tasks out of all estimated hours. Unestimated tasks are left out and listed." }
];

export function ProjectSetupSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const src = core.config.projects;
  const d = useDraft<Draft>({ label: src.label, plural: src.plural, types: src.types, progressBasis: src.progressBasis, atRiskSlipDays: src.atRiskSlipDays, cascadeMilestoneMoves: src.cascadeMilestoneMoves });
  const [sel, setSel] = useState<string | null>(src.types[0]?.id || null);
  const x = d.draft;
  const ti = Math.max(0, x.types.findIndex((t) => t.id === sel));
  const type: ProjectTypeDef | undefined = x.types[ti];
  const T = projectTerms(core.config);

  const usedPhase = (typeId: string, phaseId: string) => {
    const projects = core.data.projects.filter((p) => p.typeId === typeId && (p.phaseId === phaseId || core.data.milestones.some((m) => m.projectId === p.id && m.phaseId === phaseId))).length;
    const templates = src.templates.filter((t) => t.typeId === typeId && (t.milestones.some((m) => m.phaseId === phaseId) || t.tasks.some((k) => k.phaseId === phaseId))).map((t) => t.label);
    return projects || templates.length ? (projects ? projects + " " + (projects === 1 ? T.oneLower : T.manyLower) : "") + (projects && templates.length ? " and " : "") + (templates.length ? "template " + templates.join(", ") : "") : null;
  };
  const usedType = (typeId: string) => {
    const n = core.data.projects.filter((p) => p.typeId === typeId).length + src.templates.filter((t) => t.typeId === typeId).length;
    return n ? n + " " + (n === 1 ? "item uses" : "items use") + " this type" : null;
  };

  const errors: Record<string, string | undefined> = {};
  if (!x.label.trim()) errors.label = "Enter a word.";
  if (!x.plural.trim()) errors.plural = "Enter a word.";
  if (!(Number.isInteger(x.atRiskSlipDays) && x.atRiskSlipDays >= 1)) errors.slip = "Enter a whole number of days, 1 or more.";
  x.types.forEach((t) => {
    if (!t.label.trim()) errors[t.id + ":label"] = "Name the type.";
    if (!t.phases.length) errors[t.id + ":phases"] = "A type needs at least one phase.";
    t.phases.forEach((p) => { if (!p.label.trim()) errors[t.id + ":" + p.id] = "Name the phase."; });
  });
  const set = (fn: (t: ProjectTypeDef) => void) => d.update((dd) => fn(dd.types[ti]));

  const addType = () => {
    const id = newId("type", x.types.map((t) => t.id), "new");
    d.update((dd) => { dd.types.push({ id, label: "New type", fields: [], phases: [{ id: "start", label: "Start" }, { id: "finish", label: "Finish" }] }); });
    setSel(id);
  };
  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      for (const t of c.projects.types) {
        const next = x.types.find((n) => n.id === t.id);
        if (!next) { const u = usedType(t.id); if (u) return t.label + " cannot be removed: " + u + "."; continue; }
        for (const ph of t.phases) if (!next.phases.some((n) => n.id === ph.id)) { const u = usedPhase(t.id, ph.id); if (u) return ph.label + " cannot be removed: used by " + u + "."; }
      }
      c.projects.label = x.label.trim();
      c.projects.plural = x.plural.trim();
      c.projects.types = x.types.map((t) => ({ ...t, label: t.label.trim(), phases: t.phases.map((p) => ({ ...p, label: p.label.trim() })) }));
      c.projects.progressBasis = x.progressBasis;
      c.projects.atRiskSlipDays = x.atRiskSlipDays;
      c.projects.cascadeMilestoneMoves = x.cascadeMilestoneMoves;
    }, "Updated " + x.label.trim().toLowerCase() + " setup");
  };
  const navOverride = core.config.modules.projects?.label;

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
          <SubHead>Name</SubHead>
          <div className="st-grid">
            <Field label="One" error={errors.label} help="For example Project, Engagement or Initiative."><TextInput ariaLabel="Label for one" value={x.label} invalid={!!errors.label} onChange={(v) => d.update((dd) => { dd.label = v; })} /></Field>
            <Field label="Several" error={errors.plural}><TextInput ariaLabel="Label for several" value={x.plural} invalid={!!errors.plural} onChange={(v) => d.update((dd) => { dd.plural = v; })} /></Field>
          </div>
          {navOverride && navOverride !== x.plural && <Notice>The navigation shows “{navOverride}” because a module label is set in Settings, Experience. Pages and messages use “{x.plural || "..."}”.</Notice>}

          <SubHead>Progress and health</SubHead>
          <div className="st-grid">
            <Field label="Progress is measured by" help={BASIS.find((b) => b.value === x.progressBasis)?.help}>
              <Select ariaLabel="Progress basis" value={x.progressBasis} onChange={(v) => d.update((dd) => { dd.progressBasis = v as ProjectSettings["progressBasis"]; })}
                options={BASIS.map((b) => ({ value: b.value, label: b.label }))} />
            </Field>
            <Field label="At risk when the next milestone slips by" error={errors.slip} help="Days later than its baseline date.">
              <NumberInput ariaLabel="At-risk slip in days" min={1} step={1} value={x.atRiskSlipDays} invalid={!!errors.slip} onChange={(v) => d.update((dd) => { dd.atRiskSlipDays = v as number; })} />
            </Field>
          </div>
          <Toggle checked={x.cascadeMilestoneMoves} disabled={!canEdit} onChange={(v) => d.update((dd) => { dd.cascadeMilestoneMoves = v; })}
            label="When a milestone moves, move the milestones and tasks that depend on it by the same number of days" />
          <div className="pk-help">{x.cascadeMilestoneMoves
            ? "Dependants move automatically. A move that would push any of them past the end date still needs an approved change request."
            : "Dependants keep their dates. The impact preview lists them as proposed, and any that fall before their predecessor are flagged at risk."}</div>
        </Lock>

        <SubHead right={<Button size="sm" disabled={!canEdit} onClick={addType}>Add type</Button>}>Types and phases</SubHead>
        {type ? (
          <>
            <ItemPicker label="Types" items={x.types.map((t) => ({ id: t.id, label: t.label, note: String(t.phases.length) }))} value={type.id} onChange={setSel} />
            <Lock on={!canEdit}>
              <div style={{ maxWidth: 340 }}>
                <Field label="Type name" error={errors[type.id + ":label"]}><TextInput ariaLabel="Type name" value={type.label} invalid={!!errors[type.id + ":label"]} onChange={(v) => set((t) => { t.label = v; })} /></Field>
              </div>
              <div className="pk-label" style={{ marginTop: 4 }}>Phases, in order</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }} role="group" aria-label="Phases">
                {type.phases.map((ph, i) => {
                  const used = usedPhase(type.id, ph.id);
                  return (
                    <div key={ph.id} className="st-row" style={{ flexWrap: "nowrap" }}>
                      <span className="pk-mono pk-help" style={{ width: 18 }}>{i + 1}</span>
                      <div className="pk-grow"><TextInput ariaLabel={"Phase " + (i + 1)} value={ph.label} invalid={!!errors[type.id + ":" + ph.id]} onChange={(v) => set((t) => { t.phases[i].label = v; })} /></div>
                      <span className="pk-help pk-hide-narrow" title="The id never changes when the phase is renamed">{ph.id}</span>
                      <Button size="sm" variant="ghost" disabled={!canEdit || i === 0} aria-label={"Move " + ph.label + " up"} onClick={() => set((t) => moveItem(t.phases, i, -1))}>Up</Button>
                      <Button size="sm" variant="ghost" disabled={!canEdit || i === type.phases.length - 1} aria-label={"Move " + ph.label + " down"} onClick={() => set((t) => moveItem(t.phases, i, 1))}>Down</Button>
                      <Button size="sm" variant="ghost" disabled={!canEdit || !!used} title={used ? "Used by " + used : undefined} aria-label={"Remove " + ph.label}
                        onClick={() => set((t) => { t.phases.splice(i, 1); })}>Remove</Button>
                    </div>
                  );
                })}
                {errors[type.id + ":phases"] && <div className="pk-error">{errors[type.id + ":phases"]}</div>}
                <div><Button size="sm" disabled={!canEdit} onClick={() => set((t) => { t.phases.push({ id: keyFromLabel("phase " + (t.phases.length + 1), t.phases.map((p) => p.id)), label: "New phase" }); })}>Add phase</Button></div>
              </div>
              {usedType(type.id) === null && x.types.length > 1 && (
                <div><Button size="sm" variant="ghost" onClick={() => { d.update((dd) => { dd.types.splice(ti, 1); }); setSel(null); }}>Remove this type</Button></div>
              )}
            </Lock>
            <Preview>
              Reordering phases changes which gates must be satisfied before a later phase can start. Renaming keeps the ids, so {core.data.projects.filter((p) => p.typeId === type.id).length} {T.manyLower} of this type, their milestones and gates keep working.
            </Preview>
          </>
        ) : <Notice>No types yet. Add one to start creating {x.plural.toLowerCase() || T.manyLower}.</Notice>}

        <SubHead right={<Button size="sm" onClick={() => navigate({ page: "Projects", section: "templates" })}>Open templates</Button>}>Templates</SubHead>
        {src.templates.length === 0 ? <div className="pk-help">No templates yet. Templates are created and edited in {T.many}, Templates.</div> : (
          <div className="pk-list">
            {src.templates.map((t) => (
              <div key={t.id} className="pk-li">
                <span className="pk-grow">{t.label}</span>
                <span className="pk-help">{x.types.find((y) => y.id === t.typeId)?.label || "Unknown type"}</span>
                <span className="pk-help">version {t.version}</span>
                <span className="pk-help">{t.milestones.length} milestones, {t.tasks.length} tasks</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}
