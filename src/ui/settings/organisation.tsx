/* Organisation: people, teams and units, roles, delegation. */

import { useMemo, useState } from "react";
import {
  can, fmtDate, ops, scopeOptions, store, useCore, viewerOf, zonedTime,
  type CoreState, type Person, type RoleDef, type RoleScope, type TeamDef, type UnitDef
} from "../../core";
import { Button, Chip, DataTable, Empty, Field, KV, Notice, Select, SidePanel, TextInput, type Column } from "../kit";
import {
  CheckList, InlineConfirm, Lock, PERMISSIONS, PERM_LABEL, Preview, ReadOnlyLine, SaveBar, SubHead, errCount, newId,
  saveConfig, scopeText, staffOptions, useCanEdit, useDirty, useDraft
} from "./common";
import type { SectionProps } from "./SettingsPage";

const STATUS_TONE = { active: "ok", invited: "warn", suspended: "bad" } as const;
const STATUS_LABEL = { active: "Active", invited: "Invited", suspended: "Suspended" } as const;

const openTask = (status: string) => status !== "done" && status !== "cancelled";

/* ── People & access ───────────────────────────────────────────────────── */

export function PeopleSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const roleLabel = (id: string) => core.config.roles.find((r) => r.id === id)?.label || id;
  const teamsOf = (pid: string) => core.data.memberships.filter((m) => m.personId === pid)
    .map((m) => core.config.teams.find((t) => t.id === m.teamId)?.label || "Unknown");
  const rolesOf = (pid: string) => core.data.roleAssignments.filter((r) => r.personId === pid)
    .map((r) => roleLabel(r.roleId) + " (" + scopeText(core, r.scope) + ")");

  const columns: Column<Person>[] = [
    { key: "name", label: "Name", strong: true, priority: 1, value: (p) => p.name },
    { key: "email", label: "Email", priority: 3, value: (p) => p.email },
    { key: "title", label: "Title", priority: 3, value: (p) => p.kind === "external" ? p.title + (p.organisation ? ", " + p.organisation : "") : p.title },
    { key: "kind", label: "Type", priority: 3, value: (p) => p.kind === "staff" ? "Staff" : "External" },
    { key: "status", label: "Status", priority: 2, value: (p) => STATUS_LABEL[p.status], render: (p) => <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip> },
    { key: "teams", label: core.config.terminology.teams, priority: 3, value: (p) => teamsOf(p.id).join(", ") || "None" },
    { key: "roles", label: "Roles", priority: 3, value: (p) => rolesOf(p.id).join("; ") || "None" }
  ];

  return (
    <div className="st-detail-b">
      {!canEdit && <ReadOnlyLine />}
      <DataTable rows={core.data.people} columns={columns} rowKey={(p) => p.id} onOpen={(p) => setOpenId(p.id)} selectedKey={openId}
        caption="People" searchText={(p) => [p.name, p.email, p.title, p.organisation || "", teamsOf(p.id).join(" ")].join(" ")} searchPlaceholder="Search people"
        groupOptions={[{ key: "status", label: "Status" }, { key: "kind", label: "Type" }]}
        initialSort={{ key: "name", dir: "asc" }}
        toolbarRight={<Button variant="primary" disabled={!canEdit} title={canEdit ? undefined : "Only administrators can invite people"} onClick={() => setInviting(true)}>Invite person</Button>}
        empty={<Empty title="No people match" body="Clear the search to see everyone." />} />
      {openId && <PersonPanel personId={openId} onClose={() => setOpenId(null)} />}
      {inviting && <InvitePanel onClose={() => setInviting(false)} />}
    </div>
  );
}

function PersonPanel({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { core, ctx } = useCore();
  const canEdit = useCanEdit();
  const person = core.data.people.find((p) => p.id === personId);
  const current = core.data.memberships.filter((m) => m.personId === personId).map((m) => m.teamId).sort();
  const teams = useDraft<string[]>(current);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  if (!person) return null;
  const T = core.config.terminology;

  const pending = core.data.approvals.filter((a) => a.status === "pending" && a.stages.some((st) => st.status === "pending" && st.assigneeId === personId))
    .map((a) => core.data.requests.find((r) => r.id === a.requestId)).filter(Boolean);
  const tasks = core.data.tasks.filter((t) => t.assigneeId === personId && openTask(t.status));
  const delegationsTo = core.data.delegations.filter((d) => d.active && d.toId === personId && d.until >= ctx.now);

  const saveTeams = () => {
    const add = teams.draft.filter((t) => !current.includes(t));
    const remove = current.filter((t) => !teams.draft.includes(t));
    for (const t of add) if (!store.run(ops.setMembership, personId, t, true).ok) return;
    for (const t of remove) if (!store.run(ops.setMembership, personId, t, false).ok) return;
    store.revalidate();
  };
  const setStatus = (status: Person["status"]) => {
    const res = store.run(ops.setPersonStatus, personId, status);
    if (res.ok) store.revalidate();
    setConfirmSuspend(false);
  };
  const isSelf = personId === ctx.viewerId;

  return (
    <SidePanel open onClose={onClose} title={person.name} eyebrow={person.kind === "staff" ? "Person" : "External contact"}
      chips={<Chip tone={STATUS_TONE[person.status]}>{STATUS_LABEL[person.status]}</Chip>}
      footer={teams.dirty ? (
        <>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>Unsaved {T.team.toLowerCase()} changes</span>
          <span className="pk-grow" />
          <Button variant="ghost" onClick={teams.reset}>Discard</Button>
          <Button variant="primary" onClick={saveTeams}>Save memberships</Button>
        </>
      ) : undefined}>
      <KV items={[
        ["Email", person.email],
        ["Title", person.title],
        ["Type", person.kind === "staff" ? "Staff" : "External" + (person.organisation ? ", " + person.organisation : "")],
        ["Open tasks", String(tasks.length)]
      ]} />
      <div className="pk-section">
        <SubHead>Roles</SubHead>
        <div className="pk-help" style={{ marginTop: 6 }}>
          {core.data.roleAssignments.filter((r) => r.personId === personId).map((r) => (core.config.roles.find((x) => x.id === r.roleId)?.label || r.roleId) + " (" + scopeText(core, r.scope) + ")").join("; ") || "No roles."}
          {" "}Change roles in Roles & permissions.
        </div>
      </div>
      <div className="pk-section">
        <SubHead>{T.teams}</SubHead>
        <div style={{ marginTop: 8 }}>
          {person.kind === "external" ? <div className="pk-help">External contacts are not members of {T.teams.toLowerCase()}.</div>
            : core.config.teams.length === 0 ? <div className="pk-help">No {T.teams.toLowerCase()} yet. Add them in Teams & units.</div>
            : <CheckList label={T.teams} disabled={!canEdit} value={teams.draft} onChange={(v) => teams.set([...v].sort())}
              options={core.config.teams.map((t) => ({ value: t.id, label: t.label }))} />}
        </div>
        {person.kind === "staff" && <div className="pk-help" style={{ marginTop: 6 }}>A person can belong to several {T.teams.toLowerCase()}. Membership decides which queues and scopes they see.</div>}
      </div>
      <div className="pk-section">
        <SubHead>Access</SubHead>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          {!canEdit && <ReadOnlyLine />}
          {person.status === "invited" && <div className="pk-help">Invited. No invitation email is sent from this demo, and there is no sign-in, so the status stays invited until changed here.</div>}
          {person.status === "suspended" ? (
            <div className="st-row">
              <span className="pk-help pk-grow">Suspended people keep their history but cannot act.</span>
              <Button disabled={!canEdit} onClick={() => setStatus("active")}>Restore access</Button>
            </div>
          ) : confirmSuspend ? (
            <InlineConfirm danger confirmLabel={"Suspend " + person.name} onConfirm={() => setStatus("suspended")} onCancel={() => setConfirmSuspend(false)}>
              <div style={{ fontWeight: 500 }}>Suspending removes all of {person.name}'s permissions at once.</div>
              {pending.length > 0
                ? <div style={{ marginTop: 6 }}>These pending decisions are assigned to them and will be blocked until reassigned or escalated:
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{pending.map((r) => <li key={r!.id}>{r!.ref}: {r!.title}</li>)}</ul></div>
                : <div style={{ marginTop: 6 }}>No pending decisions are assigned to them.</div>}
              <div style={{ marginTop: 6 }}>{tasks.length} open task{tasks.length === 1 ? "" : "s"} stay assigned to them{tasks.length ? " and will need reassigning" : ""}.
                {delegationsTo.length > 0 && " " + delegationsTo.length + " active delegation" + (delegationsTo.length === 1 ? "" : "s") + " to them stop working."}</div>
            </InlineConfirm>
          ) : (
            <div className="st-row">
              <span className="pk-help pk-grow">{isSelf ? "You cannot suspend yourself." : "Suspend to stop this person acting without deleting anything."}</span>
              <Button variant="danger" disabled={!canEdit || isSelf} title={isSelf ? "You cannot suspend yourself" : !canEdit ? "Only administrators can suspend people" : undefined}
                onClick={() => setConfirmSuspend(true)}>Suspend</Button>
            </div>
          )}
        </div>
      </div>
    </SidePanel>
  );
}

function InvitePanel({ onClose }: { onClose: () => void }) {
  const { core } = useCore();
  const [f, setF] = useState({ name: "", email: "", title: "", teamId: "" });
  const [tried, setTried] = useState(false);
  useDirty(!!(f.name || f.email || f.title));
  const T = core.config.terminology;
  const errors = {
    name: !f.name.trim() ? "Enter a name." : undefined,
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) ? "Enter a valid email address."
      : core.data.people.some((p) => p.email.toLowerCase() === f.email.trim().toLowerCase()) ? "Someone with this email is already here." : undefined
  };
  const submit = () => {
    setTried(true);
    if (errCount(errors)) return;
    const res = store.run(ops.invitePerson, f.name, f.email.trim(), f.title, f.teamId || undefined);
    if (res.ok) { store.revalidate(); onClose(); }
  };
  return (
    <SidePanel open onClose={onClose} title="Invite person" width={480}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Add as invited</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Notice>No email is sent from this demo. The person is added with the status Invited and the Contributor role for the whole {T.organisation.toLowerCase()}. Change their roles in Roles & permissions.</Notice>
        <Field label="Name" htmlFor="inv-name" error={tried ? errors.name : null}><TextInput id="inv-name" value={f.name} invalid={tried && !!errors.name} onChange={(name) => setF({ ...f, name })} /></Field>
        <Field label="Email" htmlFor="inv-email" error={tried ? errors.email : null}><TextInput id="inv-email" type="email" value={f.email} invalid={tried && !!errors.email} onChange={(email) => setF({ ...f, email })} /></Field>
        <Field label="Title" htmlFor="inv-title" help="Optional. Defaults to Member."><TextInput id="inv-title" value={f.title} onChange={(title) => setF({ ...f, title })} /></Field>
        <Field label={T.team} htmlFor="inv-team" help={core.config.teams.length ? "Optional. You can add more later." : "No " + T.teams.toLowerCase() + " yet. Add them in Teams & units."}>
          <Select id="inv-team" value={f.teamId} onChange={(teamId) => setF({ ...f, teamId })}
            options={[{ value: "", label: "No " + T.team.toLowerCase() }, ...core.config.teams.map((t) => ({ value: t.id, label: t.label }))]} />
        </Field>
      </div>
    </SidePanel>
  );
}

/* ── Teams & units ─────────────────────────────────────────────────────── */

interface Structure { teams: TeamDef[]; units: UnitDef[] }

function teamUsage(s: CoreState, teamId: string) {
  return {
    members: s.data.memberships.filter((m) => m.teamId === teamId).length,
    records: s.data.records.filter((r) => r.teamId === teamId && !r.mergedInto).length,
    openTasks: s.data.tasks.filter((t) => t.teamId === teamId && openTask(t.status)).length,
    tasks: s.data.tasks.filter((t) => t.teamId === teamId).length,
    openRequests: s.data.requests.filter((r) => r.teamId === teamId && (r.status === "submitted" || r.status === "changes_requested" || r.status === "draft")).length,
    openRuns: s.data.runs.filter((r) => r.teamId === teamId && r.status !== "completed").length
  };
}

export function StructureSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const T = core.config.terminology;
  const unitsOn = core.config.capabilities.units;
  const d = useDraft<Structure>({ teams: core.config.teams, units: core.config.units });
  const savedTeam = (id: string) => core.config.teams.find((t) => t.id === id);
  const savedUnit = (id: string) => core.config.units.find((u) => u.id === id);

  const errors: Record<string, string | undefined> = {};
  d.draft.teams.forEach((t) => {
    if (!t.label.trim()) errors["t:" + t.id] = "Enter a name.";
    else if (d.draft.teams.some((o) => o.id !== t.id && o.label.trim().toLowerCase() === t.label.trim().toLowerCase())) errors["t:" + t.id] = "Another " + T.team.toLowerCase() + " has this name.";
  });
  d.draft.units.forEach((u) => {
    if (!u.label.trim()) errors["u:" + u.id] = "Enter a name.";
    else if (d.draft.units.some((o) => o.id !== u.id && o.label.trim().toLowerCase() === u.label.trim().toLowerCase())) errors["u:" + u.id] = "Another " + T.unit.toLowerCase() + " has this name.";
  });

  const removedTeams = core.config.teams.filter((t) => !d.draft.teams.some((x) => x.id === t.id));
  const renamedTeams = d.draft.teams.filter((t) => savedTeam(t.id) && savedTeam(t.id)!.label !== t.label);
  const addedTeams = d.draft.teams.filter((t) => !savedTeam(t.id));
  const removedUnits = core.config.units.filter((u) => !d.draft.units.some((x) => x.id === u.id));
  const renamedUnits = d.draft.units.filter((u) => savedUnit(u.id) && savedUnit(u.id)!.label !== u.label);

  const teamBlock = (t: TeamDef) => {
    if (!savedTeam(t.id)) return null;
    const u = teamUsage(core, t.id);
    if (u.members) return u.members + " member" + (u.members === 1 ? "" : "s") + " still belong to it. Move them first.";
    if (u.openTasks || u.openRequests || u.openRuns) return "It still has open work (" + [u.openTasks && u.openTasks + " tasks", u.openRequests && u.openRequests + " requests", u.openRuns && u.openRuns + " runs"].filter(Boolean).join(", ") + "). Finish or move it first.";
    return null;
  };
  const unitBlock = (u: UnitDef) => {
    const teams = d.draft.teams.filter((t) => t.unitId === u.id).length;
    if (teams) return teams + " " + (teams === 1 ? T.team : T.teams).toLowerCase() + " still belong to it.";
    const tagged = core.data.records.filter((r) => r.unitId === u.id).length + core.data.tasks.filter((t) => t.unitId === u.id && openTask(t.status)).length;
    if (savedUnit(u.id) && tagged) return tagged + " records or open tasks are tagged to it.";
    return null;
  };

  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      for (const t of removedTeams) { const b = teamBlock(t); if (b) return t.label + ": " + b; }
      c.teams = d.draft.teams.map((t) => ({ ...t, label: t.label.trim(), queueLabel: t.queueLabel?.trim() || undefined, unitId: t.unitId || undefined, ownerId: t.ownerId || undefined }));
      c.units = d.draft.units.map((u) => ({ ...u, label: u.label.trim(), ownerId: u.ownerId || undefined }));
    }, "Updated " + T.teams.toLowerCase() + " and " + T.units.toLowerCase());
  };

  const owners = staffOptions(core, "No owner");

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => d.update((x) => { x.teams.push({ id: newId("t", x.teams.map((t) => t.id)), label: "" }); })}>Add {T.team.toLowerCase()}</Button>}>{T.teams}</SubHead>
        <Lock on={!canEdit}>
        {d.draft.teams.length === 0 ? (
          <Empty title={"No " + T.teams.toLowerCase() + " yet"} body={T.teams + " hold queues of work and decide who sees what. Add the first one to start assigning people and records."} />
        ) : (
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label={T.teams}>
              <thead><tr>
                <th>Name</th>{unitsOn && <th>{T.unit}</th>}<th>Owner</th><th>Queue label</th><th>Members</th><th>Records</th><th>Open tasks</th><th><span className="pk-hide-narrow">Actions</span></th>
              </tr></thead>
              <tbody>
                {d.draft.teams.map((t, i) => {
                  const u = savedTeam(t.id) ? teamUsage(core, t.id) : null;
                  const block = teamBlock(t);
                  return (
                    <tr key={t.id}>
                      <td style={{ minWidth: 150 }}>
                        <TextInput ariaLabel={T.team + " name"} value={t.label} invalid={!!errors["t:" + t.id]} onChange={(v) => d.update((x) => { x.teams[i].label = v; })} />
                        {errors["t:" + t.id] && <div className="pk-error">{errors["t:" + t.id]}</div>}
                      </td>
                      {unitsOn && <td style={{ minWidth: 130 }}><Select ariaLabel={T.unit} value={t.unitId || ""} onChange={(v) => d.update((x) => { x.teams[i].unitId = v || undefined; })}
                        options={[{ value: "", label: "No " + T.unit.toLowerCase() }, ...d.draft.units.map((un) => ({ value: un.id, label: un.label || "Untitled" }))]} /></td>}
                      <td style={{ minWidth: 140 }}><Select ariaLabel="Owner" value={t.ownerId || ""} onChange={(v) => d.update((x) => { x.teams[i].ownerId = v || undefined; })} options={owners} /></td>
                      <td style={{ minWidth: 130 }}><TextInput ariaLabel="Queue label" value={t.queueLabel || ""} placeholder={(t.label || T.team) + " queue"} onChange={(v) => d.update((x) => { x.teams[i].queueLabel = v; })} /></td>
                      <td className="st-c">{u ? u.members : 0}</td>
                      <td className="st-c">{u ? u.records : 0}</td>
                      <td className="st-c">{u ? u.openTasks : 0}</td>
                      <td>
                        <Button size="sm" variant="ghost" disabled={!canEdit || !!block} title={block || "Remove"} aria-label={"Remove " + (t.label || "team")}
                          onClick={() => d.update((x) => { x.teams.splice(i, 1); })}>Remove</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pk-help">A {T.team.toLowerCase()} with members or open work cannot be removed. Hover the disabled button to see why.</div>

        <SubHead right={unitsOn ? <Button size="sm" disabled={!canEdit} onClick={() => d.update((x) => { x.units.push({ id: newId("u", x.units.map((u) => u.id)), label: "" }); })}>Add {T.unit.toLowerCase()}</Button> : undefined}>{T.units}</SubHead>
        {!unitsOn ? (
          <Notice>{T.units} are optional and switched off, so they are hidden from scopes and pages. They group several {T.teams.toLowerCase()} under one lead. Switch them on in Enabled views if you need that level.</Notice>
        ) : d.draft.units.length === 0 ? (
          <Empty title={"No " + T.units.toLowerCase() + " yet"} body={"Add a " + T.unit.toLowerCase() + " to group " + T.teams.toLowerCase() + " under one lead."} />
        ) : (
          <div className="st-tbl-wrap">
            <table className="st-tbl" aria-label={T.units}>
              <thead><tr><th>Name</th><th>Owner</th><th>{T.teams}</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
              <tbody>
                {d.draft.units.map((u, i) => {
                  const block = unitBlock(u);
                  return (
                    <tr key={u.id}>
                      <td style={{ minWidth: 150 }}>
                        <TextInput ariaLabel={T.unit + " name"} value={u.label} invalid={!!errors["u:" + u.id]} onChange={(v) => d.update((x) => { x.units[i].label = v; })} />
                        {errors["u:" + u.id] && <div className="pk-error">{errors["u:" + u.id]}</div>}
                      </td>
                      <td style={{ minWidth: 140 }}><Select ariaLabel="Owner" value={u.ownerId || ""} onChange={(v) => d.update((x) => { x.units[i].ownerId = v || undefined; })} options={owners} /></td>
                      <td>{d.draft.teams.filter((t) => t.unitId === u.id).map((t) => t.label).join(", ") || "None"}</td>
                      <td><Button size="sm" variant="ghost" disabled={!canEdit || !!block} title={block || "Remove"} onClick={() => d.update((x) => { x.units.splice(i, 1); })}>Remove</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        </Lock>
        {d.dirty && (
          <Preview>
            <ul>
              {renamedTeams.map((t) => {
                const u = teamUsage(core, t.id);
                return <li key={t.id}>{savedTeam(t.id)!.label} becomes {t.label || "(no name)"}: {u.records} records, {u.tasks} tasks and {u.members} members show the new name. Nothing is moved.</li>;
              })}
              {renamedUnits.map((u) => <li key={u.id}>{savedUnit(u.id)!.label} becomes {u.label || "(no name)"} everywhere it appears, including the scope picker.</li>)}
              {addedTeams.map((t) => <li key={t.id}>New {T.team.toLowerCase()} {t.label || "(no name)"}: empty until people and work are added.</li>)}
              {removedTeams.map((t) => <li key={t.id}>{t.label} is removed. {teamUsage(core, t.id).records} records tagged to it keep their history but no longer appear in a {T.team.toLowerCase()} scope.</li>)}
              {removedUnits.map((u) => <li key={u.id}>{u.label} is removed.</li>)}
              {!renamedTeams.length && !renamedUnits.length && !addedTeams.length && !removedTeams.length && !removedUnits.length && <li>Owner or queue label changes only.</li>}
            </ul>
          </Preview>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}

/* ── Roles & permissions ───────────────────────────────────────────────── */

export function RolesSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<RoleDef[]>(core.config.roles);
  const holders = (roleId: string) => new Set(core.data.roleAssignments.filter((r) => r.roleId === roleId).map((r) => r.personId)).size;

  const errors: Record<string, string | undefined> = {};
  d.draft.forEach((r) => {
    if (!r.label.trim()) errors["l:" + r.id] = "Enter a name.";
    else if (d.draft.some((o) => o.id !== r.id && o.label.trim().toLowerCase() === r.label.trim().toLowerCase())) errors["l:" + r.id] = "Another role has this name.";
  });
  const admin = d.draft.find((r) => r.id === "admin");
  if (admin && !admin.permissions.includes("settings.edit")) errors["l:admin"] = "Administrator must keep Change settings, or nobody could change settings.";

  const save = () => {
    if (errCount(errors)) return;
    saveConfig((c) => {
      const removed = c.roles.filter((r) => !d.draft.some((x) => x.id === r.id));
      for (const r of removed) if (core.data.roleAssignments.some((a) => a.roleId === r.id)) return r.label + " is still assigned. Remove the assignments first.";
      c.roles = d.draft.map((r) => ({ ...r, label: r.label.trim(), description: r.description.trim() }));
    }, "Updated role definitions");
  };

  const changes = d.draft.map((r) => {
    const before = core.config.roles.find((x) => x.id === r.id);
    if (!before) return { r, added: r.permissions, removed: [] as string[], isNew: true };
    return { r, added: r.permissions.filter((p) => !before.permissions.includes(p)), removed: before.permissions.filter((p) => !r.permissions.includes(p)), isNew: false };
  }).filter((c) => c.isNew || c.added.length || c.removed.length);

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <SubHead right={<Button size="sm" disabled={!canEdit} onClick={() => d.update((x) => { x.push({ id: newId("role", x.map((r) => r.id), "custom"), label: "New role", description: "", permissions: ["records.view"] }); })}>Add role</Button>}>Role definitions</SubHead>
        <Lock on={!canEdit}>
        <div className="st-grid">
          {d.draft.map((r, i) => {
            const n = holders(r.id);
            const builtIn = ["admin", "team_manager", "contributor"].includes(r.id);
            return (
              <div key={r.id} className="st-box" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Field label="Name" error={errors["l:" + r.id]}><TextInput ariaLabel="Role name" value={r.label} invalid={!!errors["l:" + r.id]} onChange={(v) => d.update((x) => { x[i].label = v; })} /></Field>
                <Field label="Description"><TextInput ariaLabel="Role description" value={r.description} onChange={(v) => d.update((x) => { x[i].description = v; })} /></Field>
                <div className="st-row">
                  <span className="pk-help pk-grow">{n} {n === 1 ? "person holds" : "people hold"} this role</span>
                  {!builtIn && <Button size="sm" variant="ghost" disabled={!canEdit || n > 0} title={n > 0 ? "Remove the assignments first" : "Remove role"} onClick={() => d.update((x) => { x.splice(i, 1); })}>Remove</Button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="st-tbl-wrap">
          <table className="st-tbl" aria-label="Permission matrix">
            <thead><tr><th>Permission</th>{d.draft.map((r) => <th key={r.id} className="st-c" style={{ textAlign: "center" }}>{r.label || "Untitled"}</th>)}</tr></thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p}>
                  <td>{PERM_LABEL[p]}</td>
                  {d.draft.map((r, i) => (
                    <td key={r.id} className="st-c">
                      <input type="checkbox" aria-label={PERM_LABEL[p] + " for " + r.label} checked={r.permissions.includes(p)} disabled={!canEdit}
                        style={{ accentColor: "var(--accent)" }}
                        onChange={(e) => d.update((x) => { x[i].permissions = e.target.checked ? [...x[i].permissions, p] : x[i].permissions.filter((y) => y !== p); })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </Lock>
        {changes.length > 0 && (
          <Preview>
            <ul>
              {changes.map(({ r, added, removed, isNew }) => (
                <li key={r.id}>
                  {r.label || "Untitled"}{isNew ? " (new, nobody holds it yet)" : " (" + holders(r.id) + " " + (holders(r.id) === 1 ? "person" : "people") + ")"}
                  {added.length > 0 && <>: gains {added.map((p) => PERM_LABEL[p as keyof typeof PERM_LABEL]).join(", ")}</>}
                  {removed.length > 0 && <>{added.length ? "; " : ": "}loses {removed.map((p) => PERM_LABEL[p as keyof typeof PERM_LABEL]).join(", ")}</>}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 6 }}>Changes apply at the moment of each person's next action. Decisions already made are not changed.</div>
          </Preview>
        )}
        <Assignments />
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} saveLabel="Save role definitions" />
    </>
  );
}

function scopeFromKey(k: string): RoleScope {
  if (k.startsWith("unit:")) return { kind: "unit", unitId: k.slice(5) };
  if (k.startsWith("team:")) return { kind: "team", teamId: k.slice(5) };
  return { kind: "organisation" };
}

function Assignments() {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const [f, setF] = useState({ personId: "", roleId: core.config.roles[0]?.id || "", scope: "organisation" });
  const [removing, setRemoving] = useState<string | null>(null);
  useDirty(!!f.personId);
  const T = core.config.terminology;
  const scope = scopeFromKey(f.scope);
  const dup = core.data.roleAssignments.some((r) => r.personId === f.personId && r.roleId === f.roleId && JSON.stringify(r.scope) === JSON.stringify(scope));
  const adminCount = core.data.roleAssignments.filter((r) => r.roleId === "admin").length;

  const scopeOpts = [
    { value: "organisation", label: "Whole " + T.organisation.toLowerCase() },
    ...(core.config.capabilities.units ? core.config.units.map((u) => ({ value: "unit:" + u.id, label: T.unit + ": " + u.label })) : []),
    ...core.config.teams.map((t) => ({ value: "team:" + t.id, label: T.team + ": " + t.label }))
  ];

  const preview = useMemo(() => {
    if (!f.personId || !f.roleId) return null;
    const after: CoreState = { ...core, data: { ...core.data, roleAssignments: [...core.data.roleAssignments, { id: "preview", personId: f.personId, roleId: f.roleId, scope }] } };
    const vb = viewerOf(core, f.personId), va = viewerOf(after, f.personId);
    const before = scopeOptions(core, vb).map((o) => o.label);
    const scopes = scopeOptions(after, va).map((o) => ({ label: o.label, isNew: !before.includes(o.label) }));
    const gained = [...va.permissions].filter((p) => !vb.permissions.has(p));
    return { scopes, gained };
  }, [core, f.personId, f.roleId, f.scope]);

  const add = () => {
    const res = store.run(ops.setRoleAssignment, f.personId, f.roleId, scope, true);
    if (res.ok) { store.revalidate(); setF({ ...f, personId: "" }); }
  };
  const remove = (id: string) => {
    const ra = core.data.roleAssignments.find((r) => r.id === id);
    if (!ra) return;
    const res = store.run(ops.setRoleAssignment, ra.personId, ra.roleId, ra.scope, false);
    if (res.ok) store.revalidate();
    setRemoving(null);
  };
  const name = (id: string) => core.data.people.find((p) => p.id === id)?.name || "Unknown";
  const roleLabel = (id: string) => core.config.roles.find((r) => r.id === id)?.label || id;
  const rows = [...core.data.roleAssignments].sort((a, b) => name(a.personId).localeCompare(name(b.personId)));

  return (
    <>
      <SubHead>Role assignments</SubHead>
      <Lock on={!canEdit}>
      <div className="st-box" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="st-grid">
          <Field label="Person" htmlFor="ra-person"><Select id="ra-person" value={f.personId} onChange={(personId) => setF({ ...f, personId })} options={staffOptions(core, "Choose a person")} /></Field>
          <Field label="Role" htmlFor="ra-role"><Select id="ra-role" value={f.roleId} onChange={(roleId) => setF({ ...f, roleId })} options={core.config.roles.map((r) => ({ value: r.id, label: r.label }))} /></Field>
          <Field label="Scope" htmlFor="ra-scope"><Select id="ra-scope" value={f.scope} onChange={(s) => setF({ ...f, scope: s })} options={scopeOpts} /></Field>
        </div>
        {preview && (
          <Preview>
            <div>{name(f.personId)} will be able to select: {preview.scopes.map((s, i) => <span key={s.label}>{i ? ", " : ""}{s.label}{s.isNew ? " (new)" : ""}</span>)}.</div>
            <div>{preview.gained.length ? "New permissions: " + preview.gained.map((p) => PERM_LABEL[p]).join(", ") + "." : "No new permissions; they already hold everything this role gives."}</div>
            <div style={{ marginTop: 4 }}>The change applies at the moment of their next action.</div>
          </Preview>
        )}
        <div className="st-row">
          {dup && <span className="pk-error">They already hold this role at this scope.</span>}
          <span className="pk-grow" />
          <Button variant="primary" disabled={!canEdit || !f.personId || !f.roleId || dup} title={!canEdit ? "Only administrators can assign roles" : !f.personId ? "Choose a person first" : undefined} onClick={add}>Add assignment</Button>
        </div>
      </div>
      </Lock>
      <div className="st-tbl-wrap">
        <table className="st-tbl" aria-label="Role assignments">
          <thead><tr><th>Person</th><th>Role</th><th>Scope</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const lastAdmin = r.roleId === "admin" && adminCount === 1;
              return removing === r.id ? (
                <tr key={r.id}><td colSpan={4}>
                  <InlineConfirm danger confirmLabel="Remove" onConfirm={() => remove(r.id)} onCancel={() => setRemoving(null)}>
                    Remove {roleLabel(r.roleId)} ({scopeText(core, r.scope)}) from {name(r.personId)}? Decisions they no longer have authority for are blocked at the moment they try.
                  </InlineConfirm>
                </td></tr>
              ) : (
                <tr key={r.id}>
                  <td>{name(r.personId)}</td>
                  <td>{roleLabel(r.roleId)}</td>
                  <td>{scopeText(core, r.scope)}</td>
                  <td><Button size="sm" variant="ghost" disabled={!canEdit || lastAdmin} title={lastAdmin ? "This is the only administrator. Add another one first." : undefined}
                    onClick={() => setRemoving(r.id)}>Remove</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Ownership & delegation ────────────────────────────────────────────── */

export function DelegationSection(_p: SectionProps) {
  const { core, ctx, q } = useCore();
  const canEdit = useCanEdit();
  const canDelegate = can(q.viewer, "approvals.delegate") || canEdit;
  const tz = core.config.timezone;
  const [f, setF] = useState({ fromId: ctx.viewerId, toId: "", ruleIds: [] as string[], until: "", reason: "" });
  const [tried, setTried] = useState(false);
  useDirty(!!(f.toId || f.ruleIds.length || f.until || f.reason));
  const name = (id: string) => core.data.people.find((p) => p.id === id)?.name || "Unknown";
  const rules = core.config.approvalRules;
  const ruleLabel = (id: string) => rules.find((r) => r.id === id)?.label || id;
  const today = ctx.now.slice(0, 10);

  const list = core.data.delegations.filter((d) => canEdit || d.fromId === ctx.viewerId || d.toId === ctx.viewerId);
  const untilIso = /^\d{4}-\d{2}-\d{2}$/.test(f.until) ? zonedTime(+f.until.slice(0, 4), +f.until.slice(5, 7), +f.until.slice(8, 10), 23, 59, tz) : "";
  const errors = {
    toId: !f.toId ? "Choose who will decide." : f.toId === f.fromId ? "Choose someone else." : undefined,
    ruleIds: !f.ruleIds.length ? "Pick at least one approval rule." : undefined,
    until: !untilIso ? "Choose an end date." : untilIso <= ctx.now ? "The end date must be in the future." : undefined,
    reason: !f.reason.trim() ? "Say why." : undefined
  };
  const fromOptions = core.data.people.filter((p) => p.kind === "staff" && p.status === "active" && can(viewerOf(core, p.id), "approvals.delegate")).map((p) => ({ value: p.id, label: p.name }));

  const submit = () => {
    setTried(true);
    if (errCount(errors)) return;
    const res = store.run(ops.addDelegation, f.fromId, f.toId, f.ruleIds, untilIso, f.reason);
    if (res.ok) { setF({ fromId: ctx.viewerId, toId: "", ruleIds: [], until: "", reason: "" }); setTried(false); }
  };
  const revoke = (id: string) => store.run(ops.revokeDelegation, id);
  const status = (dl: typeof list[number]) => !dl.active ? { t: "Revoked", tone: "neutral" as const } : dl.until < ctx.now ? { t: "Expired", tone: "neutral" as const } : { t: "Active", tone: "ok" as const };

  return (
    <div className="st-detail-b">
      <Notice>Delegation lets one person decide approvals on another's behalf. It covers only the rules and dates chosen, never covers the delegate's own requests, and does not bypass permissions: the delegate still needs to be allowed to see the request.</Notice>
      <SubHead>{canEdit ? "All delegations" : "Delegations involving you"}</SubHead>
      {list.length === 0 ? (
        <Empty title="No delegations" body={canDelegate ? "Add one below when someone needs to cover your decisions." : "Nobody has delegated decisions to or from you."} />
      ) : (
        <div className="st-tbl-wrap">
          <table className="st-tbl" aria-label="Delegations">
            <thead><tr><th>From</th><th>To</th><th>Rules</th><th>Until</th><th>Reason</th><th>Status</th><th><span className="pk-hide-narrow">Actions</span></th></tr></thead>
            <tbody>
              {list.map((dl) => {
                const st = status(dl);
                const mayRevoke = dl.active && (dl.fromId === ctx.viewerId || canEdit);
                return (
                  <tr key={dl.id}>
                    <td>{name(dl.fromId)}</td><td>{name(dl.toId)}</td>
                    <td>{dl.ruleIds.map(ruleLabel).join(", ")}</td>
                    <td>{fmtDate(dl.until, tz)}</td>
                    <td style={{ maxWidth: 240 }}>{dl.reason}</td>
                    <td><Chip tone={st.tone}>{st.t}</Chip></td>
                    <td>{dl.active && <Button size="sm" variant="ghost" disabled={!mayRevoke} title={mayRevoke ? undefined : "Only the delegator or an administrator can revoke this"} onClick={() => revoke(dl.id)}>Revoke</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SubHead>Add a delegation</SubHead>
      {!canDelegate ? <ReadOnlyLine text="Only people who can delegate approvals, and administrators, can add delegations." />
        : rules.length === 0 ? <Empty title="No approval rules yet" body="Add an approval rule in Approval routing before delegating decisions." />
        : (
          <div className="st-box" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="st-grid">
              <Field label="On behalf of" htmlFor="dg-from" help={canEdit ? "Administrators can delegate for anyone who may delegate approvals." : "You can delegate your own decisions."}>
                {canEdit ? <Select id="dg-from" value={f.fromId} onChange={(fromId) => setF({ ...f, fromId })} options={fromOptions.some((o) => o.value === f.fromId) ? fromOptions : [{ value: f.fromId, label: name(f.fromId) }, ...fromOptions]} />
                  : <div id="dg-from" className="pk-input" style={{ display: "flex", alignItems: "center" }}>{name(f.fromId)}</div>}
              </Field>
              <Field label="Delegate to" htmlFor="dg-to" error={tried ? errors.toId : null}>
                <Select id="dg-to" value={f.toId} invalid={tried && !!errors.toId} onChange={(toId) => setF({ ...f, toId })}
                  options={[{ value: "", label: "Choose a person" }, ...core.data.people.filter((p) => p.kind === "staff" && p.status === "active" && p.id !== f.fromId).map((p) => ({ value: p.id, label: p.name }))]} />
              </Field>
              <Field label="Until" htmlFor="dg-until" error={tried ? errors.until : null} help={"Ends at 23:59 (" + tz + ")."}>
                <input id="dg-until" className="pk-input" type="date" min={today} value={f.until} aria-invalid={(tried && !!errors.until) || undefined} onChange={(e) => setF({ ...f, until: e.target.value })} />
              </Field>
            </div>
            <Field label="Approval rules covered" error={tried ? errors.ruleIds : null}>
              <CheckList label="Approval rules covered" value={f.ruleIds} onChange={(ruleIds) => setF({ ...f, ruleIds })} options={rules.map((r) => ({ value: r.id, label: r.label }))} />
            </Field>
            <Field label="Reason" htmlFor="dg-reason" error={tried ? errors.reason : null}>
              <TextInput id="dg-reason" value={f.reason} invalid={tried && !!errors.reason} onChange={(reason) => setF({ ...f, reason })} placeholder="For example: covering while away" />
            </Field>
            {f.toId && f.ruleIds.length > 0 && untilIso && (
              <Preview>
                {name(f.toId)} may decide {f.ruleIds.map(ruleLabel).join(", ")} for {name(f.fromId)} until {fmtDate(untilIso, tz, true)}.
                {" "}Not covered: {name(f.toId)}'s own requests, other rules, and anything after that date.
              </Preview>
            )}
            <div className="st-row"><span className="pk-grow" /><Button variant="primary" onClick={submit}>Add delegation</Button></div>
          </div>
        )}
    </div>
  );
}
