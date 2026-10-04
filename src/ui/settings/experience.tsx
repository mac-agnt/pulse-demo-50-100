/* Experience: terminology, enabled views, role defaults, appearance. */

import { useCore, type Capability, type OrgConfig, type RoleLayout, type Terminology } from "../../core";
import { css } from "../../runtime/template";
import { Field, Icon, Notice, Segmented, Select, TextInput } from "../kit";
import { Lock, Preview, ReadOnlyLine, SaveBar, SubHead, Toggle, errCount, saveConfig, useCanEdit, useDraft } from "./common";
import type { SectionProps } from "./SettingsPage";

/* ── Terminology ───────────────────────────────────────────────────────── */

const TERMS: [keyof Terminology, string][] = [
  ["organisation", "Organisation"], ["unit", "Unit (one)"], ["units", "Units (several)"], ["team", "Team (one)"], ["teams", "Teams (several)"],
  ["record", "Record (one)"], ["records", "Records (several)"], ["request", "Request (one)"], ["requests", "Requests (several)"], ["task", "Task (one)"], ["tasks", "Tasks (several)"]
];

export function TerminologySection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<Terminology>(core.config.terminology);
  const T = d.draft;
  const errors: Record<string, string | undefined> = {};
  for (const [k] of TERMS) {
    if (!T[k].trim()) errors[k] = "Enter a word.";
    else if (T[k].trim().length > 24) errors[k] = "Keep it to 24 characters or fewer.";
  }
  const save = () => { if (!errCount(errors)) saveConfig((c) => { (Object.keys(T) as (keyof Terminology)[]).forEach((k) => { c.terminology[k] = T[k].trim(); }); }, "Updated terminology"); };
  const lc = (s: string) => s.toLowerCase();
  const openTasks = core.data.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const unit = core.config.units[0];
  const team = core.config.teams[0];

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
          <div className="st-grid">
            {TERMS.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={"term-" + k} error={errors[k]}>
                <TextInput id={"term-" + k} value={T[k]} invalid={!!errors[k]} onChange={(v) => d.update((x) => { x[k] = v; })} />
              </Field>
            ))}
          </div>
        </Lock>
        <Preview title="Preview: example labels">
          <ul>
            <li>Scope picker: My work, Whole {lc(T.organisation)}{core.config.capabilities.units ? ", " + (unit?.label || "a " + lc(T.unit)) + " (" + T.unit + ")" : ""}, {team?.label || "a " + lc(T.team)} ({T.team} you oversee)</li>
            <li>Buttons: New {lc(T.request)}, Add {lc(T.task)}, New {lc(T.record)}</li>
            <li>Counts: {openTasks} open {lc(openTasks === 1 ? T.task : T.tasks)} in the {lc(T.organisation)}</li>
            <li>Queues: {team?.queueLabel || (team?.label || T.team) + " queue"}</li>
            <li>Pages: {T.records}, browse all {lc(T.records)}; {T.requests} waiting for a decision</li>
          </ul>
          <div style={{ marginTop: 6 }}>These words flow into scope labels and page copy. Names of individual {lc(T.teams)}, {lc(T.units)} and {lc(T.records)} do not change.</div>
        </Preview>
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Enabled views ─────────────────────────────────────────────────────── */

const CAPS: { id: Capability; label: string; where: string; locked?: string }[] = [
  { id: "ontology", label: "Ontology", where: "Ontology tab in Records, always the first tab", locked: "Always on. The Ontology tab is part of the fixed Records layout." },
  { id: "files", label: "Files", where: "Files tab in Records" },
  { id: "contacts", label: "Contacts", where: "Contacts tab in Records" },
  { id: "dataQuality", label: "Data quality", where: "Data quality tab in Records" },
  { id: "approvals", label: "Approvals", where: "Approvals tab in Work" },
  { id: "workflows", label: "Workflows", where: "Automation runs in Work, Schedules" },
  { id: "schedules", label: "Schedules", where: "Schedules tab in Work" },
  { id: "reportSchedules", label: "Scheduled reports", where: "Report scheduling on the Dashboard" },
  { id: "agents", label: "Agents", where: "Agent answers and agent activity. The Agents page stays in the side rail" },
  { id: "units", label: "Units", where: "The unit level in the scope picker and in Teams & units" }
];

export function ViewsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<OrgConfig["capabilities"]>(core.config.capabilities);
  const before = core.config.capabilities;
  const appear = CAPS.filter((c) => !c.locked && d.draft[c.id] && !before[c.id]);
  const disappear = CAPS.filter((c) => !c.locked && !d.draft[c.id] && before[c.id]);
  const save = () => saveConfig((c) => { c.capabilities = { ...d.draft, ontology: true }; }, "Updated enabled views");

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label="Enabled views">
              <thead><tr><th>View</th><th>Where it shows</th></tr></thead>
              <tbody>
                {CAPS.map((c) => (
                  <tr key={c.id}>
                    <td style={{ minWidth: 170 }}>
                      {c.locked
                        ? <span className="st-toggle" title={c.locked}><Icon d="M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z" size={13} /><span>{c.label}: always on</span></span>
                        : <Toggle checked={d.draft[c.id]} onChange={(v) => d.update((x) => { x[c.id] = v; })} label={c.label} />}
                    </td>
                    <td>{c.where}{c.locked ? ". " + c.locked : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Lock>
        {d.dirty && (
          <Preview>
            {appear.length > 0 && <div>Will appear: {appear.map((c) => c.where).join("; ")}.</div>}
            {disappear.length > 0 && <div>Will disappear: {disappear.map((c) => c.where).join("; ")}.</div>}
            {disappear.some((c) => c.id === "units") && core.config.units.length > 0 && <div>{core.config.units.length} {core.config.terminology.units.toLowerCase()} stay stored and their {core.config.terminology.teams.toLowerCase()} keep their link; anyone using a unit scope switches to their widest valid scope.</div>}
          </Preview>
        )}
        <Notice>Switching a view off only hides it. It never changes permissions: what each person may see and do still comes from their roles.</Notice>
      </div>
      <SaveBar dirty={d.dirty} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Role defaults & dashboards ────────────────────────────────────────── */

const DENSITY = [{ value: "comfortable" as const, label: "Comfortable" }, { value: "compact" as const, label: "Compact" }];

export function LayoutsSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<{ roleLayouts: Record<string, RoleLayout>; density: OrgConfig["density"] }>({ roleLayouts: core.config.roleLayouts, density: core.config.density });
  const dashboards = core.config.dashboards;
  const layoutOf = (roleId: string): RoleLayout => d.draft.roleLayouts[roleId] || { homeView: "personal", dashboardId: dashboards[0]?.id || "" };
  const people = (roleId: string) => new Set(core.data.roleAssignments.filter((r) => r.roleId === roleId).map((r) => r.personId)).size;
  const errors: Record<string, string | undefined> = {};
  core.config.roles.forEach((r) => { if (dashboards.length && !dashboards.some((db) => db.id === layoutOf(r.id).dashboardId)) errors[r.id] = "Choose a dashboard."; });
  const setLayout = (roleId: string, patch: Partial<RoleLayout>) => d.update((x) => { x.roleLayouts[roleId] = { ...layoutOf(roleId), ...patch }; });
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.roleLayouts = d.draft.roleLayouts; c.density = d.draft.density; }, "Updated role defaults"); };
  const changed = core.config.roles.filter((r) => JSON.stringify(d.draft.roleLayouts[r.id]) !== JSON.stringify(core.config.roleLayouts[r.id]));

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label="Role defaults">
              <thead><tr><th>Role</th><th>People</th><th>Home mode</th><th>Home opens on</th><th>Default dashboard</th></tr></thead>
              <tbody>
                {core.config.roles.map((r) => {
                  const l = layoutOf(r.id);
                  return (
                    <tr key={r.id}>
                      <td>{r.label}</td>
                      <td className="st-c">{people(r.id)}</td>
                      <td style={{ minWidth: 130 }}><Select ariaLabel={"Home mode for " + r.label} value={l.homeMode || "chat"} onChange={(v) => setLayout(r.id, { homeMode: v as "chat" | "today" })}
                        options={[{ value: "chat", label: "Chat" }, { value: "today", label: "Today briefing" }]} /></td>
                      <td style={{ minWidth: 170 }}><Select ariaLabel={"Home view for " + r.label} value={l.homeView} onChange={(v) => setLayout(r.id, { homeView: v as RoleLayout["homeView"] })}
                        options={[{ value: "personal", label: "Personal: my work" }, { value: "management", label: "Management: my scope" }]} /></td>
                      <td style={{ minWidth: 170 }}>
                        {dashboards.length ? <Select ariaLabel={"Dashboard for " + r.label} value={l.dashboardId} invalid={!!errors[r.id]} onChange={(v) => setLayout(r.id, { dashboardId: v })}
                          options={[...(dashboards.some((db) => db.id === l.dashboardId) ? [] : [{ value: l.dashboardId, label: "Choose" }]), ...dashboards.map((db) => ({ value: db.id, label: db.label }))]} />
                          : <span className="pk-faint">No dashboards yet</span>}
                        {errors[r.id] && <div className="pk-error">{errors[r.id]}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Field label="Display density" help="The organisation default, stored in the configuration.">
            <div><Segmented label="Display density" options={DENSITY} value={d.draft.density} onChange={(v) => d.update((x) => { x.density = v; })} /></div>
          </Field>
        </Lock>
        {changed.length > 0 && (
          <Preview>
            <ul>
              {changed.map((r) => {
                const l = layoutOf(r.id);
                return <li key={r.id}>{r.label} ({people(r.id)} {people(r.id) === 1 ? "person" : "people"}): Home opens in {l.homeMode === "today" ? "Today" : "Chat"} mode and the {l.homeView} view, Dashboard opens on {dashboards.find((db) => db.id === l.dashboardId)?.label || "no dashboard"}.</li>;
              })}
            </ul>
            <div style={{ marginTop: 4 }}>Defaults only choose where people start. Anyone can still switch between Chat and Today (their choice is remembered in their browser), and defaults never change what they may see.</div>
          </Preview>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Appearance & density ──────────────────────────────────────────────── */

export interface ThemeCard { label: string; on: boolean; pick: () => void; cardStyle: string; mockStyle: string; barStyle: string; cardMockStyle: string; dotStyle: string; lineStyle: string }
export interface AppearanceModel { groups: { label: string; cards: ThemeCard[] }[] }

export function AppearanceSection({ v }: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<OrgConfig["density"]>(core.config.density);
  const groups = v.appearance?.groups || [];
  const save = () => saveConfig((c) => { c.density = d.draft; }, "Set display density to " + d.draft);

  return (
    <>
      <div className="st-detail-b">
        <SubHead>Theme</SubHead>
        <div className="pk-help" style={{ marginTop: -6 }}>Your theme applies to this browser only. It is not part of the organisation configuration, so anyone can change it.</div>
        {groups.length === 0 ? <div className="pk-help">Themes are not available here.</div> : groups.map((g) => (
          <div key={g.label}>
            <div className="pk-eyebrow" style={{ marginBottom: 10 }}>{g.label}</div>
            <div className="st-themes" role="group" aria-label={g.label + " themes"}>
              {g.cards.map((t) => (
                <button key={t.label} type="button" aria-pressed={t.on} onClick={t.pick} style={css(t.cardStyle)}>
                  <div style={css(t.mockStyle)} aria-hidden="true">
                    <div style={css(t.barStyle)} />
                    <div style={css(t.cardMockStyle)} />
                    <div style={css(t.dotStyle)} />
                    <div style={css(t.lineStyle)} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9 }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{t.label}</span>
                    {t.on && <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}><Icon d="M5 12.5l4.5 4.5L19 7" size={14} sw={2.4} />In use</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        <SubHead>Display density</SubHead>
        {!canEdit && <ReadOnlyLine text="Only administrators can change the organisation default density." />}
        <Lock on={!canEdit}>
          <div><Segmented label="Display density" options={DENSITY} value={d.draft} onChange={(x) => d.set(x)} /></div>
          <div className="pk-help" style={{ marginTop: -6 }}>The organisation default, stored in the configuration. Also editable in Role defaults & dashboards.</div>
        </Lock>
      </div>
      <SaveBar dirty={d.dirty} onSave={save} onDiscard={d.reset} />
    </>
  );
}
