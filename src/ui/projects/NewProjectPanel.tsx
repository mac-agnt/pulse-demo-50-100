/* Create a project from a template. The preview shows exactly the dates the
   operation will produce (the same previewTemplate function), anchored to the
   chosen start date. The idempotency key is made once per open panel, so a
   double click or a retry never creates a second project. */

import { useRef, useState } from "react";
import { can, createProjectFromTemplate, previewTemplate, projectPhaseLabel, projectTypeOf, store } from "../../core";
import { Button, Field, Notice, Select, SidePanel, TextArea, TextInput } from "../kit";
import { dayInput, newKey, useProjectsCtx } from "./shared";

export function NewProjectPanel({ templateId, onClose, onCreated }: { templateId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { core, q, T, d, now, tz } = useProjectsCtx();
  const v = q.viewer;
  const key = useRef(newKey("np")).current;
  const templates = core.config.projects.templates;
  const [tpl, setTpl] = useState(templateId || templates[0]?.id || "");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [start, setStart] = useState(dayInput(now, tz));
  const [owner, setOwner] = useState(v.person.id);
  const where = [
    ...(v.isOrgWide ? [{ value: "org", label: "Whole " + core.config.terminology.organisation.toLowerCase() }] : []),
    ...core.config.units.filter((u) => u.status !== "planned" && (v.isOrgWide || v.overseenUnitIds.includes(u.id))).map((u) => ({ value: "unit:" + u.id, label: core.config.terminology.unit + ": " + u.label })),
    ...core.config.teams.filter((t) => v.isOrgWide || v.overseenTeamIds.includes(t.id)).map((t) => ({ value: "team:" + t.id, label: core.config.terminology.team + ": " + t.label }))
  ];
  const [scope, setScope] = useState(where.find((w) => w.value.startsWith("team:"))?.value || where[0]?.value || "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const def = templates.find((t) => t.id === tpl);
  const pv = def ? previewTemplate(core.config, def.id, start) : null;
  const staff = core.data.people.filter((p) => p.kind === "staff" && p.status === "active");
  const allowed = can(v, "projects.manage");

  const submit = () => {
    if (busy) return;
    setBusy(true);
    const [kind, id] = scope.split(":");
    const r = store.run(createProjectFromTemplate, {
      templateId: tpl, title, startDate: start, ownerId: owner, objective, key,
      teamId: kind === "team" ? id : undefined, unitId: kind === "unit" ? id : undefined
    });
    setBusy(false);
    if (r.ok && r.id) onCreated(r.id);
    else if (!r.ok) setErr(r.error);
  };

  return (
    <SidePanel open onClose={onClose} title={"New " + T.oneLower} eyebrow="FROM A TEMPLATE" width={640}
      footer={<>
        <span className="pk-grow" />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={!allowed || !pv || !title.trim() || !scope || busy}
          title={!allowed ? "Your role cannot create " + T.manyLower : undefined}>Create {T.oneLower}</Button>
      </>}>
      {!allowed && <Notice tone="warn">Your role cannot create {T.manyLower}. It needs the Manage projects permission.</Notice>}
      {templates.length === 0 ? <Notice>There are no templates. An administrator can add one in Templates.</Notice> : (
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Template">
            <Select ariaLabel="Template" value={tpl} onChange={setTpl} options={templates.map((t) => ({ value: t.id, label: t.label + " (version " + t.version + ")" }))} />
          </Field>
          <Field label="Name"><TextInput ariaLabel="Name" value={title} onChange={setTitle} placeholder={"What is this " + T.oneLower + " called?"} /></Field>
          <Field label="Objective" help="One or two sentences on the outcome."><TextArea value={objective} onChange={setObjective} rows={2} /></Field>
          <div className="pj-grid2">
            <Field label="Start date" help={"Every date is counted from this day (" + tz + ")."}>
              <input className="pk-input" type="date" aria-label="Start date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Owner"><Select ariaLabel="Owner" value={owner} onChange={setOwner} options={staff.map((p) => ({ value: p.id, label: p.name }))} /></Field>
          </div>
          <Field label="Belongs to" help={where.length ? "Tasks go to this team's queue in Work. Only teams and units you manage are listed." : undefined}>
            {where.length ? <Select ariaLabel="Belongs to" value={scope} onChange={setScope} options={where} />
              : <Notice tone="warn">You do not manage a team or unit, so there is nowhere you can create one.</Notice>}
          </Field>
          {def && pv && (
            <div className="pj-preview" aria-live="polite">
              <div className="pk-eyebrow">Preview of generated dates</div>
              <div className="pj-faint" style={{ margin: "6px 0 10px" }}>
                {projectTypeOf(core.config, def.typeId)?.label} · runs {d(pv.start)} to {d(pv.end)} · {pv.milestones.length} milestones · {pv.tasks.length} tasks
                ({pv.tasks.filter((t) => t.estimateHours === undefined).length} without an estimate)
              </div>
              <table className="pj-mini">
                <thead><tr><th>Milestone</th><th>Phase</th><th>Due</th><th>Gate</th></tr></thead>
                <tbody>
                  {pv.milestones.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td>{projectPhaseLabel(core.config, def, m.phaseId)}</td>
                      <td className="pj-mono">{d(m.dueAt)}</td>
                      <td>{m.gate ? m.gate.label : <span className="pj-faint">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pv.milestones.some((m) => m.gate) && (
                <div className="pj-faint" style={{ marginTop: 8 }}>Gate requirements become requirement records for this {T.oneLower} in Standards, starting as missing.</div>
              )}
            </div>
          )}
          {err && <div className="pk-error" role="alert">{err}</div>}
        </div>
      )}
    </SidePanel>
  );
}
