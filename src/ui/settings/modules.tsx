/* Settings > Experience > Modules and labels. Switch capability modules on or
   off and rename them and their page tabs, without changing ids, data or
   calculations. Disabling explains its impact first: the data is kept, the
   navigation, page tabs, palette entries, Home and Activity blocks and
   dashboard views made only of that module's figures are hidden, and other
   modules that depend on it are named. Edits go through ops.updateConfig. */

import { useState } from "react";
import { useCore, disableImpact, PAGES, MODULE_DEPENDENCIES, type ModuleConfig, type ModuleId } from "../../core";
import { Chip, Field, TextInput } from "../kit";
import { InlineConfirm, Lock, Preview, ReadOnlyLine, SaveBar, SubHead, Toggle, errCount, saveConfig, useCanEdit, useDraft } from "./common";
import type { SectionProps } from "./SettingsPage";

const MODULES: { id: ModuleId; blurb: string }[] = [
  { id: "projects", blurb: "Portfolio, plans, milestones, gates, risks and project tasks (the same tasks as Work)." },
  { id: "people", blurb: "Directory, teams, availability, onboarding, documents and training." },
  { id: "finance", blurb: "Budgets, receivables, payables and transactions from read-only accounting sources." },
  { id: "purchasing", blurb: "Purchase requests, orders, suppliers, receipts and invoice matching." },
  { id: "standards", blurb: "Requirements, checks, policies and evidence review." }
];

interface Draft { modules: Record<ModuleId, ModuleConfig>; projectLabel: string; projectPlural: string }

const MAX = 28;

export function ModulesSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const c = core.config;
  const d = useDraft<Draft>({ modules: c.modules, projectLabel: c.projects.label, projectPlural: c.projects.plural });
  const [confirm, setConfirm] = useState(false);
  const D = d.draft;

  const errors: Record<string, string | undefined> = {};
  const check = (key: string, v: string | undefined, required = false) => {
    const t = (v || "").trim();
    if (required && !t) errors[key] = "Enter a label.";
    else if (t.length > MAX) errors[key] = "Keep it to " + MAX + " characters or fewer.";
  };
  check("projectLabel", D.projectLabel, true);
  check("projectPlural", D.projectPlural, true);
  for (const m of MODULES) {
    check(m.id + ":label", D.modules[m.id]?.label);
    for (const [k, v] of Object.entries(D.modules[m.id]?.sectionLabels || {})) check(m.id + ":" + k, v);
  }

  const turningOff = MODULES.filter((m) => c.modules[m.id]?.enabled && !D.modules[m.id]?.enabled);
  const turningOn = MODULES.filter((m) => !c.modules[m.id]?.enabled && D.modules[m.id]?.enabled);

  const setMod = (id: ModuleId, fn: (mc: ModuleConfig) => void) => d.update((x) => {
    const mc = x.modules[id] || { enabled: false };
    fn(mc);
    x.modules[id] = mc;
  });

  const doSave = () => {
    const parts = [
      ...turningOff.map((m) => pageOf(m.id).label + " off"),
      ...turningOn.map((m) => pageOf(m.id).label + " on")
    ];
    const ok = saveConfig((cfg) => {
      for (const m of MODULES) {
        const src = D.modules[m.id] || { enabled: false };
        const labels = Object.fromEntries(Object.entries(src.sectionLabels || {}).map(([k, v]) => [k, (v || "").trim()]).filter(([, v]) => v));
        cfg.modules[m.id] = { enabled: !!src.enabled, ...(src.label?.trim() ? { label: src.label.trim() } : {}), ...(Object.keys(labels).length ? { sectionLabels: labels } : {}) };
      }
      cfg.projects.label = D.projectLabel.trim();
      cfg.projects.plural = D.projectPlural.trim();
    }, "Modules and labels" + (parts.length ? ": " + parts.join(", ") : ": labels updated"));
    if (ok) setConfirm(false);
  };
  const save = () => {
    if (errCount(errors)) return;
    if (turningOff.length) setConfirm(true); else doSave();
  };

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <p className="pk-help" style={{ margin: 0 }}>Labels change what people read, never ids, links or calculations. A module that is off keeps all of its data and history; switching it back on restores everything.</p>
        <Lock on={!canEdit}>
          {MODULES.map((m) => {
            const mc = D.modules[m.id] || { enabled: false };
            const def = pageOf(m.id);
            const off = c.modules[m.id]?.enabled && !mc.enabled;
            const impact = off ? disableImpact(core, m.id) : [];
            const deps = (MODULE_DEPENDENCIES[m.id] || []).filter((x) => !D.modules[x.needs]?.enabled);
            return (
              <div key={m.id} className="st-box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <SubHead right={<>
                  {c.modules[m.id]?.enabled ? <Chip tone="ok" plain>On now</Chip> : <Chip plain>Off now</Chip>}
                  <Toggle checked={!!mc.enabled} onChange={(on) => setMod(m.id, (x) => { x.enabled = on; })} label={mc.enabled ? "Enabled" : "Disabled"} disabled={!canEdit} />
                </>}>
                  {mc.label?.trim() || (m.id === "projects" ? D.projectPlural || def.label : def.label)}
                </SubHead>
                <div className="pk-help" style={{ marginTop: -6 }}>{m.blurb}</div>
                {off && (
                  <div className="st-preview" role="note" aria-live="polite">
                    <span className="pk-eyebrow">If you switch it off</span>
                    <ul>
                      <li>Hidden: its side rail and module switcher entry, page tabs, palette shortcuts, Home and Activity items and any dashboard view made only of its figures.</li>
                      {impact.length ? impact.map((t) => <li key={t}>{t}</li>) : <li>It holds no data yet, so nothing is kept back.</li>}
                      <li>Kept: every record, event and link. Switching it back on shows them again.</li>
                    </ul>
                  </div>
                )}
                {mc.enabled && deps.length > 0 && (
                  <div className="st-preview" role="note">{deps.map((x) => <div key={x.needs}>Works best with {pageOf(x.needs).label} on. {x.why}</div>)}</div>
                )}
                <div className="st-grid">
                  {m.id === "projects" ? (
                    <>
                      <Field label="One item is called" htmlFor="mod-proj-1" error={errors.projectLabel} help="Used in buttons and detail titles, for example Engagement.">
                        <TextInput id="mod-proj-1" value={D.projectLabel} invalid={!!errors.projectLabel} onChange={(v) => d.update((x) => { x.projectLabel = v; })} />
                      </Field>
                      <Field label="Several are called" htmlFor="mod-proj-n" error={errors.projectPlural} help="Used for the module name unless you set a navigation label.">
                        <TextInput id="mod-proj-n" value={D.projectPlural} invalid={!!errors.projectPlural} onChange={(v) => d.update((x) => { x.projectPlural = v; })} />
                      </Field>
                    </>
                  ) : null}
                  <Field label="Navigation label" htmlFor={"mod-l-" + m.id} error={errors[m.id + ":label"]} help={"Blank uses " + (m.id === "projects" ? "the plural above" : "“" + def.label + "”") + "."}>
                    <TextInput id={"mod-l-" + m.id} value={mc.label || ""} placeholder={m.id === "projects" ? D.projectPlural : def.label} invalid={!!errors[m.id + ":label"]}
                      onChange={(v) => setMod(m.id, (x) => { x.label = v; })} />
                  </Field>
                </div>
                <div>
                  <div className="pk-label" style={{ marginBottom: 6 }}>Page tab labels</div>
                  <div className="st-grid">
                    {def.sections.map((sec) => (
                      <Field key={sec.id} label={sec.label} htmlFor={"mod-s-" + m.id + "-" + sec.id} error={errors[m.id + ":" + sec.id]}>
                        <TextInput id={"mod-s-" + m.id + "-" + sec.id} value={mc.sectionLabels?.[sec.id] || ""} placeholder={sec.label} invalid={!!errors[m.id + ":" + sec.id]}
                          onChange={(v) => setMod(m.id, (x) => { x.sectionLabels = { ...(x.sectionLabels || {}), [sec.id]: v }; })} />
                      </Field>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </Lock>
        <Preview title="Preview: business modules in navigation">
          {MODULES.filter((m) => D.modules[m.id]?.enabled).length === 0 ? <div>No business modules. Home, Dashboard, Work, Records, Agents and Activity still work.</div> : (
            <ul>
              {MODULES.filter((m) => D.modules[m.id]?.enabled).map((m) => {
                const mc = D.modules[m.id];
                const label = mc.label?.trim() || (m.id === "projects" ? D.projectPlural.trim() : pageOf(m.id).label);
                return <li key={m.id}><b>{label}</b>: {pageOf(m.id).sections.map((s) => mc.sectionLabels?.[s.id]?.trim() || s.label).join(", ")}</li>;
              })}
            </ul>
          )}
        </Preview>
        {confirm && (
          <InlineConfirm confirmLabel={"Switch off " + turningOff.map((m) => pageOf(m.id).label).join(" and ")} danger onConfirm={doSave} onCancel={() => setConfirm(false)}>
            {turningOff.map((m) => pageOf(m.id).label).join(" and ")} will disappear from navigation for everyone. Data is kept and returns when switched back on.
          </InlineConfirm>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={() => { d.reset(); setConfirm(false); }} />
    </>
  );
}

function pageOf(m: ModuleId) {
  return PAGES.find((p) => p.module === m)!;
}
