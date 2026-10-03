/* Governance: access and audit policy, document governance, the audit log
   of configuration and organisation changes. */

import {
  addDays, can, fmtDate, fmtDateTime, useCore,
  type AuditEvent, type GovernancePolicy, type Permission
} from "../../core";
import { DataTable, Empty, Field, NoAccess, Notice, PersonName, type Column } from "../kit";
import { Lock, NumberInput, PERM_LABEL, Preview, ReadOnlyLine, SaveBar, SubHead, Toggle, errCount, saveConfig, useCanEdit, useDraft } from "./common";
import type { SectionProps } from "./SettingsPage";

/* ── Access & audit policy ─────────────────────────────────────────────── */

export function AccessSection(_p: SectionProps) {
  const { core, ctx } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<GovernancePolicy>(core.config.governance);
  const g = d.draft;
  const errors = {
    retention: !(Number.isInteger(g.auditRetentionDays) && g.auditRetentionDays >= 30) ? "Keep audit history for at least 30 days (whole days)." : undefined
  };
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.governance.exportRequiresPermission = g.exportRequiresPermission; c.governance.auditRetentionDays = g.auditRetentionDays; }, "Updated access and audit policy"); };

  const holders = (p: Permission) => {
    const roles = core.config.roles.filter((r) => r.permissions.includes(p));
    const people = new Set(core.data.roleAssignments.filter((ra) => roles.some((r) => r.id === ra.roleId))
      .map((ra) => ra.personId).filter((id) => core.data.people.find((x) => x.id === id)?.status === "active"));
    return { roles, people: people.size };
  };
  const shown: Permission[] = ["export", "audit.view", "settings.edit"];
  const cut = core.config.governance.auditRetentionDays;
  const olderThan = (days: number) => core.data.events.filter((e) => e.at < addDays(ctx.now, -days)).length;

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
          <Toggle checked={g.exportRequiresPermission} onChange={(v) => d.update((x) => { x.exportRequiresPermission = v; })}
            label="Exporting needs the Export data permission" />
          <div className="pk-help" style={{ marginTop: -8 }}>When off, anyone who can see rows can export them. Either way, an export only ever contains rows the person is allowed to see, and every export is logged.</div>
          <Field label="Keep audit history for, in days" error={errors.retention} help="Minimum 30 days.">
            <div style={{ maxWidth: 200 }}><NumberInput ariaLabel="Audit retention in days" min={30} step={1} value={g.auditRetentionDays} invalid={!!errors.retention} onChange={(v) => d.update((x) => { x.auditRetentionDays = v as number; })} /></div>
          </Field>
        </Lock>
        {d.dirty && !errors.retention && g.auditRetentionDays !== cut && (
          <Preview>
            With {g.auditRetentionDays} days, {olderThan(g.auditRetentionDays)} of the {core.data.events.length} stored audit entries are older than the limit. This demo does not delete anything; a production backend would remove them on its retention schedule.
          </Preview>
        )}
        <SubHead>Who holds sensitive permissions</SubHead>
        <div className="st-tbl-wrap">
          <table className="st-tbl" aria-label="Permission holders">
            <thead><tr><th>Permission</th><th>Roles</th><th>Active people</th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const h = holders(p);
                return <tr key={p}><td>{PERM_LABEL[p]}</td><td>{h.roles.map((r) => r.label).join(", ") || "No role"}</td><td className="st-c">{h.people}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <Notice>In this demo, permission checks run in the browser as a preview of the rules. A production backend must enforce the same rules on every query and action.</Notice>
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Document governance ───────────────────────────────────────────────── */

export function DocumentsSection(_p: SectionProps) {
  const { core, ctx, q } = useCore();
  const canEdit = useCanEdit();
  const tz = core.config.timezone;
  const d = useDraft({ reviewDocumentsEveryDays: core.config.governance.reviewDocumentsEveryDays, restrictedDocsInAnswers: core.config.governance.restrictedDocsInAnswers });
  const errors = { every: !(Number.isInteger(d.draft.reviewDocumentsEveryDays) && d.draft.reviewDocumentsEveryDays >= 1) ? "Enter a whole number of days, 1 or more." : undefined };
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.governance.reviewDocumentsEveryDays = d.draft.reviewDocumentsEveryDays; c.governance.restrictedDocsInAnswers = d.draft.restrictedDocsInAnswers; }, "Updated document governance"); };

  const visible = q.files({ ignoreScope: true });
  const hiddenRestricted = core.data.files.filter((f) => f.restrictedTo?.length && !visible.includes(f)).length;
  const restricted = visible.filter((f) => f.restrictedTo?.length);
  const name = (id: string) => core.data.people.find((p) => p.id === id)?.name || "Unknown";
  const lastChange = (f: (typeof visible)[number]) => f.versions[f.versions.length - 1]?.addedAt || f.effectiveDate || "";
  const pastReview = visible.filter((f) => f.reviewDate && f.reviewDate < ctx.now);
  const dueByPolicy = (days: number) => visible.filter((f) => !f.reviewDate && lastChange(f) && addDays(lastChange(f), days) < ctx.now);

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <Lock on={!canEdit}>
          <Field label="Review documents every, in days" error={errors.every} help="Applies to documents without their own review date.">
            <div style={{ maxWidth: 200 }}><NumberInput ariaLabel="Review interval in days" min={1} step={1} value={d.draft.reviewDocumentsEveryDays} invalid={!!errors.every} onChange={(v) => d.update((x) => { x.reviewDocumentsEveryDays = v as number; })} /></div>
          </Field>
          <Toggle checked={d.draft.restrictedDocsInAnswers} onChange={(v) => d.update((x) => { x.restrictedDocsInAnswers = v; })}
            label="Restricted documents may be cited in answers" />
          <div className="pk-help" style={{ marginTop: -8 }}>When off, restricted documents are never cited in answers, even to people allowed to open them. When on, they are cited only to people allowed to open them.</div>
        </Lock>
        {d.dirty && !errors.every && (
          <Preview>
            With a review every {d.draft.reviewDocumentsEveryDays} days, {dueByPolicy(d.draft.reviewDocumentsEveryDays).length} document{dueByPolicy(d.draft.reviewDocumentsEveryDays).length === 1 ? "" : "s"} without their own review date would be due now
            {" "}(currently {dueByPolicy(core.config.governance.reviewDocumentsEveryDays).length}).
            {d.draft.restrictedDocsInAnswers !== core.config.governance.restrictedDocsInAnswers && (d.draft.restrictedDocsInAnswers
              ? " Restricted documents would become citable to the people allowed to open them."
              : " Restricted documents would stop being cited for everyone.")}
          </Preview>
        )}
        <SubHead>Restricted documents</SubHead>
        {restricted.length === 0 ? <Empty title="No restricted documents you can see" body="A document restricted at its source shows here for administrators and the people it is restricted to." /> : (
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label="Restricted documents">
              <thead><tr><th>Document</th><th>Owner</th><th>Restricted to</th><th>Review date</th></tr></thead>
              <tbody>{restricted.map((f) => <tr key={f.id}><td>{f.title}</td><td>{name(f.ownerId)}</td><td>{(f.restrictedTo || []).map(name).join(", ")} and administrators</td><td>{f.reviewDate ? fmtDate(f.reviewDate, tz) : "None"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {hiddenRestricted > 0 && <div className="pk-help">{hiddenRestricted} restricted document{hiddenRestricted === 1 ? " is" : "s are"} not listed because you cannot open {hiddenRestricted === 1 ? "it" : "them"}.</div>}
        <SubHead>Past their review date</SubHead>
        {pastReview.length === 0 ? <Empty title="Nothing past its review date" body="Documents with a review date in the past appear here." /> : (
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label="Documents past review">
              <thead><tr><th>Document</th><th>Owner</th><th>Review date</th><th>Latest version</th></tr></thead>
              <tbody>{pastReview.map((f) => <tr key={f.id}><td>{f.title}</td><td>{name(f.ownerId)}</td><td>{fmtDate(f.reviewDate, tz)}</td><td>{f.versions.length ? "v" + f.versions[f.versions.length - 1].n + ", " + fmtDate(lastChange(f), tz) : "None"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Audit log ─────────────────────────────────────────────────────────── */

const ACTION_LABEL: Record<string, string> = {
  "config.changed": "Configuration", "org.membership": "Membership", "org.role": "Role", "org.invited": "Invitation",
  "org.status": "Access status", "org.delegation": "Delegation", "org.delegation.revoked": "Delegation revoked"
};

export function AuditSection(_p: SectionProps) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  if (!can(q.viewer, "audit.view")) return <div className="st-detail-b"><NoAccess what="the audit log" /></div>;
  const rows = core.data.events.filter((e) => e.objectType === "config" || e.action.startsWith("org.")).slice().sort((a, b) => b.at.localeCompare(a.at));
  const columns: Column<AuditEvent>[] = [
    { key: "at", label: "When", priority: 1, value: (e) => e.at, render: (e) => fmtDateTime(e.at, tz), width: 130 },
    { key: "who", label: "Who", priority: 2, value: (e) => q.name(e.actorId), render: (e) => <PersonName id={e.actorId} />, width: 170 },
    { key: "kind", label: "Area", priority: 3, value: (e) => ACTION_LABEL[e.action] || e.action, width: 140 },
    { key: "summary", label: "What changed", priority: 1, strong: true, value: (e) => e.summary + (e.simulated ? " (simulated)" : "") }
  ];
  return (
    <div className="st-detail-b">
      <DataTable rows={rows} columns={columns} rowKey={(e) => e.id} caption="Configuration and organisation changes"
        searchText={(e) => [e.summary, q.name(e.actorId), ACTION_LABEL[e.action] || e.action].join(" ")} searchPlaceholder="Search changes"
        initialSort={{ key: "at", dir: "desc" }} groupOptions={[{ key: "kind", label: "Area" }, { key: "who", label: "Who" }]}
        empty={rows.length ? <Empty title="No changes match" body="Clear the search to see every change." />
          : <Empty title="No configuration changes yet" body="Every change saved in Settings, and every change to people, roles and delegation, is listed here with who made it and when." />} />
    </div>
  );
}
