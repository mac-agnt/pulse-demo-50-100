/* Settings: grouped section list on the left (filtered by the top bar's group
   selection), one editor on the right. Switching section with unsaved
   changes asks first, inline. */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useCore } from "../../core";
import { Chip, PageHeader, useNarrow } from "../kit";
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsGroup, type SettingsSection } from "./registry";
import { DirtyCtx, InlineConfirm, useCanEdit } from "./common";
import { PeopleSection, StructureSection, RolesSection, DelegationSection } from "./organisation";
import { RequestFormsSection, ApprovalsSection, WorkflowsSection, SlaSection, NotificationsSection, AgentsSection } from "./control";
import { ConnectionsSection, MappingsSection, RecordTypesSection, MetricsSection } from "./systems";
import { AccessSection, DocumentsSection, AuditSection } from "./governance";
import { TerminologySection, ViewsSection, LayoutsSection, AppearanceSection, type AppearanceModel } from "./experience";
import { OrchestrationSection } from "./orchestration";
import { ProjectSetupSection } from "./projectSetup";
import { PurchasingRulesSection } from "./purchasingRules";
import { StandardsSetupSection } from "./standardsSetup";
import { ModulesSection } from "./modules";
import "../../styles/settings.css";

export interface SettingsV {
  adminGroupSel?: string | null;
  adminOpenId?: string | null;
  setAdminOpen?: (id: string | null) => void;
  appearance?: AppearanceModel;
}

export type SectionProps = { v: SettingsV };

const BODIES: Record<string, ComponentType<SectionProps>> = {
  people: PeopleSection, structure: StructureSection, roles: RolesSection, delegation: DelegationSection,
  requestForms: RequestFormsSection, approvals: ApprovalsSection, workflows: WorkflowsSection, sla: SlaSection,
  notifications: NotificationsSection, agents: AgentsSection, orchestration: OrchestrationSection,
  projectSetup: ProjectSetupSection, purchasingRules: PurchasingRulesSection, standardsSetup: StandardsSetupSection, modules: ModulesSection,
  connections: ConnectionsSection, mappings: MappingsSection, recordTypes: RecordTypesSection, metrics: MetricsSection,
  access: AccessSection, documents: DocumentsSection, audit: AuditSection,
  terminology: TerminologySection, views: ViewsSection, layouts: LayoutsSection, appearance: AppearanceSection
};

const GROUP_LABEL: Record<SettingsGroup, string> = {
  ORGANISATION: "Organisation", CONTROL: "Control", SYSTEMS: "Systems", GOVERNANCE: "Governance", EXPERIENCE: "Experience"
};

const ROW = 43; // row height (40) + gap (3)

export default function SettingsPage({ v }: { v: SettingsV }) {
  const { core, ctx } = useCore();
  const canEdit = useCanEdit();
  const narrow = useNarrow();

  const groups = SETTINGS_GROUPS.filter((g) => !v.adminGroupSel || g === v.adminGroupSel);
  const visible = SETTINGS_SECTIONS.filter((s) => groups.includes(s.group));
  const requested = (visible.find((s) => s.id === v.adminOpenId) || visible[0] || SETTINGS_SECTIONS[0]).id;

  const [shown, setShown] = useState(requested);
  const [pending, setPending] = useState<string | null>(null);

  // Editors register unsaved input here.
  const dirtyKeys = useRef(new Set<string>());
  const [dirty, setDirty] = useState(false);
  const setKey = useCallback((key: string, d: boolean) => {
    if (d) dirtyKeys.current.add(key); else dirtyKeys.current.delete(key);
    setDirty(dirtyKeys.current.size > 0);
  }, []);
  const dirtyApi = useMemo(() => ({ set: setKey }), [setKey]);

  useEffect(() => {
    if (requested === shown) { setPending(null); return; }
    if (dirty) setPending(requested);
    else setShown(requested);
  }, [requested]);

  // Saving clears the guard; a pending switch can then go ahead without asking.
  useEffect(() => { if (!dirty && pending) { setShown(pending); setPending(null); } }, [dirty]);

  const open = (id: string) => v.setAdminOpen?.(id);
  const keepEditing = () => { setPending(null); if (SETTINGS_SECTIONS.find((s) => s.id === shown && groups.includes(s.group))) v.setAdminOpen?.(shown); };
  const discardAndGo = () => { if (pending) { dirtyKeys.current.clear(); setDirty(false); setShown(pending); setPending(null); } };

  const section = SETTINGS_SECTIONS.find((s) => s.id === shown) || SETTINGS_SECTIONS[0];
  const pendingSection = SETTINGS_SECTIONS.find((s) => s.id === pending);
  const Body = BODIES[section.id];

  // Small counts on list rows, derived from the data.
  const badges: Record<string, { text: string; tone: "warn" | "bad" | "neutral" } | undefined> = useMemo(() => {
    const invited = core.data.people.filter((p) => p.status === "invited").length;
    const reviewDue = core.data.files.filter((f) => f.reviewDate && f.reviewDate < ctx.now).length;
    const failing = core.data.sync.filter((s) => s.status === "error" || s.status === "stale").length;
    return {
      people: invited ? { text: invited + " invited", tone: "warn" } : undefined,
      documents: reviewDue ? { text: reviewDue + " due", tone: "warn" } : undefined,
      connections: failing ? { text: failing + " need attention", tone: "bad" } : undefined
    };
  }, [core, ctx.now]);

  return (
    <DirtyCtx.Provider value={dirtyApi}>
      <div className="pk pk-page">
        <PageHeader title="Settings" sub={"How Pulse is set up for " + core.config.workspace.name + "." + (canEdit ? "" : " Your role can view these settings; only administrators can change them.")} />
        <div className="st-layout">
          {narrow ? (
            <div className="pk-field">
              <label className="pk-label" htmlFor="st-section-select">Section</label>
              <select id="st-section-select" className="pk-select" value={shown} onChange={(e) => open(e.target.value)}>
                {groups.map((g) => (
                  <optgroup key={g} label={GROUP_LABEL[g]}>
                    {SETTINGS_SECTIONS.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <nav className="st-nav" aria-label="Settings sections">
              {groups.map((g) => <NavGroup key={g} group={g} shown={shown} open={open} badges={badges} />)}
            </nav>
          )}
          <section className="pk-card st-detail" aria-labelledby="st-detail-title">
            <div className="st-detail-h">
              <div className="pk-grow">
                <span className="pk-eyebrow">{GROUP_LABEL[section.group]}</span>
                <h2 id="st-detail-title" className="st-detail-t">{section.title}</h2>
                <div className="pk-sub">{section.blurb}</div>
              </div>
            </div>
            {pendingSection && (
              <div style={{ padding: "12px 22px 0" }}>
                <InlineConfirm confirmLabel={"Discard and open " + pendingSection.title} cancelLabel="Keep editing" danger onConfirm={discardAndGo} onCancel={keepEditing}>
                  You have unsaved changes in {section.title}. Keep editing, or discard them and open {pendingSection.title}.
                </InlineConfirm>
              </div>
            )}
            <Body key={section.id} v={v} />
          </section>
        </div>
      </div>
    </DirtyCtx.Provider>
  );
}

function NavGroup({ group, shown, open, badges }: {
  group: SettingsGroup; shown: string; open: (id: string) => void; badges: Record<string, { text: string; tone: "warn" | "bad" | "neutral" } | undefined>;
}) {
  const list: SettingsSection[] = SETTINGS_SECTIONS.filter((s) => s.group === group);
  const at = list.findIndex((s) => s.id === shown);
  return (
    <div>
      <div className="st-grp-h"><span aria-hidden="true" /><span className="st-grp-label">{group}</span><span className="st-grp-count">{list.length}</span></div>
      <div style={{ position: "relative" }}>
      <span aria-hidden="true" className="st-thumb" style={{ transform: "translateY(" + (at < 0 ? 0 : at * ROW) + "px)", opacity: at < 0 ? 0 : 1 }} />
      <ul className="st-list">
        {list.map((s) => {
          const b = badges[s.id];
          return (
            <li key={s.id}>
              <button type="button" className="st-item" aria-current={s.id === shown} onClick={() => open(s.id)} title={s.blurb}>
                <span className="st-item-t">{s.title}</span>
                {b && <Chip tone={b.tone} plain>{b.text}</Chip>}
              </button>
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}
