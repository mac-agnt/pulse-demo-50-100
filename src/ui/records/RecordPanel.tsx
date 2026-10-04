/* The one record panel, one pattern everywhere: Overview / Related work /
   Files / History / Sources, with tabs that have nothing to show hidden.
   Any page can open it with a record id; every edit, relationship, comment
   and merge undo goes through ops, so the same record updates everywhere it
   appears. Related work lists the canonical tasks, requests, projects and
   obligations linked to the record; "Explore relationships" opens the
   Relationships tab focused on it. */

import { useMemo, useState } from "react";
import { useCore, store, ops, can, openObject, navigate, moduleEnabled, ms, fmtDateTime, ISSUE_LABEL, HOUR } from "../../core";
import type { AuditEvent, FieldValue, FileDoc, Id, Obligation, Project, RecordItem, RequestItem, Task, WorkflowRun } from "../../core";
import { Comments } from "../collab/Comments";
import {
  Button, Chip, Empty, Field, KV, Notice, PersonName, Section, Select, SidePanel, Tabs, TextInput, LABEL, toneOf
} from "../kit";
import {
  ACTOR_LABEL, ACTOR_TONE, FieldEditor, FieldText, Grow, ISSUE_STATE_LABEL, ISSUE_STATE_TONE, List, ListButton, OriginChip,
  RecordStatus, Ref, VISIBILITY_LABEL, When, fmtField, isOpenIssue, sourceLabel, typeOf
} from "./common";

type TabId = "overview" | "related" | "files" | "history" | "sources";

const latest = (xs: (string | null | undefined)[]) => xs.filter(Boolean).sort().pop() as string | undefined;

export function RecordPanel({ recordId, onClose }: { recordId: Id | null | undefined; onClose: () => void }) {
  const { q } = useCore();
  const r = recordId ? q.record(recordId) : undefined;
  if (!recordId) return null;
  if (!r) {
    return (
      <SidePanel open onClose={onClose} title="Record not available" width={560}>
        <Empty title="Not available to you" body="This record does not exist any more, or your role and teams do not give you access to it." />
      </SidePanel>
    );
  }
  return <RecordPanelBody key={r.id} r={r} onClose={onClose} />;
}

export default RecordPanel;

/** Projects and obligations that point at a record, through its tasks, requests, suppliers or requirements. */
function useRecordLinks(r: RecordItem, tasks: Task[], requests: RequestItem[]): { projects: Project[]; obligations: Obligation[] } {
  const { core, q } = useCore();
  const projIds = new Set<Id>([...tasks.map((t) => t.projectId), ...requests.map((x) => (typeof x.fields.projectId === "string" ? x.fields.projectId : undefined))].filter((x): x is Id => !!x));
  const projects = moduleEnabled(core.config, "projects")
    ? core.data.projects.filter((p) => projIds.has(p.id) && q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) : [];
  const supplierIds = new Set(core.data.suppliers.filter((x) => x.recordId === r.id).map((x) => x.id));
  const obligations = moduleEnabled(core.config, "standards")
    ? core.data.obligations.filter((o) => (o.subject.kind === "record" && o.subject.id === r.id) || (o.subject.kind === "supplier" && supplierIds.has(o.subject.id))) : [];
  return { projects, obligations };
}

function RecordPanelBody({ r, onClose }: { r: RecordItem; onClose: () => void }) {
  const { core, q } = useCore();
  const type = typeOf(core, r.typeId);
  const related = q.related(r.id);
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => t.linkedRecordIds.includes(r.id));
  const requests = q.requests({ ignoreScope: true }).filter((x) => x.linkedRecordIds.includes(r.id) || x.fields.recordId === r.id);
  const files = q.files({ ignoreScope: true }).filter((f) => f.linkedRecordIds.includes(r.id));
  const runs = q.runs({ ignoreScope: true }).filter((x) => x.affectedRecordIds.includes(r.id));
  const { projects, obligations } = useRecordLinks(r, tasks, requests);
  const timeline = q.timeline(r.id);
  const mappings = core.config.fieldMappings.filter((m) => m.recordTypeId === r.typeId);
  const canEdit = can(q.viewer, "records.edit");
  const workCount = tasks.length + requests.length + projects.length + obligations.length + runs.length;

  const tabs: { value: TabId; label: string; count?: number }[] = [{ value: "overview", label: "Overview" }];
  if (workCount > 0) tabs.push({ value: "related", label: "Related work", count: workCount });
  if (files.length > 0) tabs.push({ value: "files", label: "Files", count: files.length });
  tabs.push({ value: "history", label: "History", count: timeline.length });
  if (r.sourceRefs.length > 0 || mappings.length > 0) tabs.push({ value: "sources", label: "Sources", count: r.sourceRefs.length });
  const [tab, setTab] = useState<TabId>("overview");
  const active = tabs.some((t) => t.value === tab) ? tab : "overview";

  return (
    <SidePanel open onClose={onClose} width={640} eyebrow={(type?.label || "Record") + " · " + r.ref}
      chips={<><RecordStatus r={r} />{r.mergedInto && <Chip tone="neutral">Merged</Chip>}</>} title={r.title}>
      {tabs.length > 1 && <Tabs tabs={tabs} value={active} onChange={setTab} />}
      {active === "overview" && <Overview r={r} canEdit={canEdit} related={related} onClose={onClose} />}
      {active === "related" && <RelatedWork tasks={tasks} requests={requests} projects={projects} obligations={obligations} runs={runs} />}
      {active === "files" && <FilesTab files={files} />}
      {active === "history" && <History r={r} events={timeline} />}
      {active === "sources" && <Sources r={r} />}
    </SidePanel>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────── */

function Overview({ r, canEdit, related, onClose }: { r: RecordItem; canEdit: boolean; related: { record: RecordItem; label: string; direction: "out" | "in" }[]; onClose: () => void }) {
  const { core, q } = useCore();
  const type = typeOf(core, r.typeId);
  const [editing, setEditing] = useState<string | null>(null);
  const issues = q.issues({ ignoreScope: true }).filter((i) => i.recordIds.includes(r.id) && isOpenIssue(i));
  const survivor = r.mergedInto ? q.record(r.mergedInto) : undefined;
  const canMerge = can(q.viewer, "records.merge");
  const editable = canEdit && !r.mergedInto;
  const absorbed = core.data.records.filter((x) => x.mergedInto === r.id).map((x) => q.record(x.id)).filter(Boolean) as RecordItem[];

  return (
    <>
      {r.mergedInto && (
        <div className="pk-section">
          <Notice tone="warn">
            <div>Merged into {survivor ? survivor.ref + " " + survivor.title : "a record you cannot see"}. Its history and source references now live on that record.</div>
            <div className="rc-row" style={{ marginTop: 8 }}>
              {survivor && <Button size="sm" onClick={() => openObject("record", survivor.id)}>Open {survivor.ref}</Button>}
              <Button size="sm" disabled={!canMerge} title={canMerge ? undefined : "Undoing a merge needs the merge permission."}
                onClick={() => store.run(ops.unmergeRecord, r.id)}>Undo merge</Button>
              {!canMerge && <span className="rc-small">Undoing a merge needs the merge permission.</span>}
            </div>
          </Notice>
        </div>
      )}
      <div className="pk-section">
        <KV items={[
          ["Type", type?.label || r.typeId],
          ["Reference", <span className="pk-mono">{r.ref}</span>],
          ["Status", <RecordStatus r={r} />],
          ["Owner", <PersonName id={r.ownerId} />],
          [core.config.terminology.team, r.teamId ? q.teamLabel(r.teamId) + (r.unitId ? ", " + q.unitLabel(r.unitId) : "") : "No team"],
          ["Visibility", VISIBILITY_LABEL[r.visibility] || r.visibility]
        ]} />
      </div>

      <Section label="Fields" right={!canEdit ? <span className="rc-small">Your role cannot edit records.</span> : undefined}>
        {!type || type.fields.length === 0 ? <div className="rc-small">This record type has no configured fields.</div> : (
          <div className="rc-fields">
            {type.fields.map((def) => (
              editing === def.key
                ? <FieldEditor key={def.key} record={r} def={def} onDone={() => setEditing(null)} />
                : (
                  <div key={def.key} className="rc-field">
                    <div className="rc-field-l">{def.label}{def.required ? " *" : ""}</div>
                    <div className="rc-field-v"><FieldText def={def} value={r.fields[def.key]} /></div>
                    <div className="rc-field-x">
                      <OriginChip meta={r.fieldMeta[def.key]} />
                      {r.fieldMeta[def.key]?.pendingSourceReview && <Chip tone="warn" title="Pulse holds a correction the source system has not accepted yet.">Pending source review</Chip>}
                      {editable && <Button size="sm" variant="ghost" onClick={() => setEditing(def.key)} aria-label={"Edit " + def.label}>Edit</Button>}
                    </div>
                  </div>
                )
            ))}
          </div>
        )}
        {type && type.fields.some((f) => f.required) && <div className="rc-small" style={{ marginTop: 6 }}>* Required by the {type.label.toLowerCase()} type.</div>}
      </Section>

      {absorbed.length > 0 && (
        <Section label={"Merged into this record · " + absorbed.length}>
          <List>
            {absorbed.map((x) => (
              <ListButton key={x.id} onClick={() => openObject("record", x.id)} title="Open the merged record, where the merge can be undone">
                <Ref>{x.ref}</Ref><Grow>{x.title}</Grow><span className="rc-small" style={{ flex: "none" }}>Open to undo</span>
              </ListButton>
            ))}
          </List>
        </Section>
      )}

      <Section label={"Open data issues · " + issues.length}>
        {issues.length === 0 ? <div className="rc-small">No open data issues for this record.</div> : (
          <List>
            {issues.map((i) => (
              <ListButton key={i.id} onClick={() => openObject("issue", i.id)} title="Open in Data quality">
                <Chip tone={toneOf.severity(i.severity)} plain>{ISSUE_LABEL[i.kind]}</Chip>
                <Grow>{i.title}</Grow>
                <Chip tone={ISSUE_STATE_TONE[i.state]}>{ISSUE_STATE_LABEL[i.state]}</Chip>
              </ListButton>
            ))}
          </List>
        )}
      </Section>

      <RelatedRecords r={r} canEdit={canEdit} related={related} onClose={onClose} />

      <Section label="Comments">
        <Comments objectType="record" objectId={r.id} />
      </Section>
    </>
  );
}

/* ── Related records (record-to-record links) ─────────────────────────── */

function RelatedRecords({ r, canEdit, related, onClose }: { r: RecordItem; canEdit: boolean; related: { record: RecordItem; label: string; direction: "out" | "in" }[]; onClose: () => void }) {
  const { core, q } = useCore();
  const [adding, setAdding] = useState(false);
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("relates to");
  const relatedIds = new Set(related.map((x) => x.record.id));
  const candidates = q.records({ ignoreScope: true }).filter((x) => x.id !== r.id && !relatedIds.has(x.id));
  const add = () => {
    if (!to) return;
    const res = store.run(ops.addRelationship, r.id, to, label.trim() || "relates to");
    if (res.ok) { setAdding(false); setTo(""); setLabel("relates to"); }
  };
  const explore = () => { onClose(); navigate({ page: "Records", section: "relationships", focus: { kind: "record", id: r.id } }); };
  return (
    <Section label={"Related records · " + related.length}
      right={<span className="rc-row">
        {core.config.capabilities.ontology && <Button size="sm" variant="ghost" onClick={explore} title="Open Relationships focused on this record">Explore relationships</Button>}
        {canEdit && !r.mergedInto && !adding && <Button size="sm" onClick={() => setAdding(true)}>Add relationship</Button>}
      </span>}>
      {adding && (
        <div className="rc-fields" style={{ marginBottom: 10 }}>
          <div className="rc-edit">
            <Field label="Related record" htmlFor="rc-rel-to">
              <Select id="rc-rel-to" value={to} onChange={setTo}
                options={[{ value: "", label: candidates.length ? "Choose a record" : "No other records you can see" }, ...candidates.map((x) => ({ value: x.id, label: x.ref + " " + x.title }))]} />
            </Field>
            <Field label="Relationship" htmlFor="rc-rel-label" help={"Reads as: " + r.ref + " " + (label.trim() || "relates to") + " the chosen record."}>
              <TextInput id="rc-rel-label" value={label} onChange={setLabel} />
            </Field>
            <div className="rc-row">
              <Button variant="primary" size="sm" disabled={!to} title={!to ? "Choose a record first" : undefined} onClick={add}>Add</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      {related.length === 0 ? <div className="rc-small">No related records yet.</div> : (
        <List>
          {related.map((x) => (
            <ListButton key={x.record.id + x.direction} onClick={() => openObject("record", x.record.id)}>
              <span className="rc-small" style={{ flex: "none", minWidth: 110 }}>{x.direction === "out" ? "This " + x.label : x.label + " this"}</span>
              <Ref>{x.record.ref}</Ref>
              <Grow>{x.record.title}</Grow>
              <RecordStatus r={x.record} />
            </ListButton>
          ))}
        </List>
      )}
    </Section>
  );
}

/* ── Related work ──────────────────────────────────────────────────────── */

const OB_LABEL: Record<Obligation["state"], string> = { missing: "Missing", received: "Received, not reviewed", under_review: "Under review", approved: "Approved", rejected: "Rejected", expired: "Expired" };
const OB_TONE: Record<Obligation["state"], "ok" | "warn" | "bad" | "neutral" | "accent"> = { missing: "bad", received: "warn", under_review: "accent", approved: "ok", rejected: "bad", expired: "bad" };

function RelatedWork({ tasks, requests, projects, obligations, runs }: { tasks: Task[]; requests: RequestItem[]; projects: Project[]; obligations: Obligation[]; runs: WorkflowRun[] }) {
  const { core, q } = useCore();
  const reqTone = (s: string) => s === "approved" ? "ok" as const : s === "declined" ? "bad" as const : s === "changes_requested" ? "warn" as const : s === "submitted" ? "accent" as const : "neutral" as const;
  return (
    <>
      <Section label={"Tasks · " + tasks.length}>
        {tasks.length === 0 ? <div className="rc-small">No tasks linked to this record.</div> : (
          <List>
            {tasks.map((t) => {
              const overdue = q.isOverdue(t);
              return (
                <ListButton key={t.id} onClick={() => openObject("task", t.id)}>
                  <Grow>{t.title}</Grow>
                  <span className="rc-small" style={{ flex: "none" }}>{q.name(t.assigneeId)}</span>
                  <Chip tone={toneOf.task(t.status, overdue)}>{overdue ? "Overdue" : LABEL.task[t.status]}</Chip>
                </ListButton>
              );
            })}
          </List>
        )}
      </Section>

      <Section label={"Requests and approvals · " + requests.length}>
        {requests.length === 0 ? <div className="rc-small">No requests reference this record.</div> : (
          <List>
            {requests.map((x) => (
              <ListButton key={x.id} onClick={() => openObject("request", x.id)}>
                <Ref>{x.ref}</Ref>
                <Grow>{x.title}</Grow>
                <Chip tone={reqTone(x.status)}>{LABEL.request[x.status]}</Chip>
                {x.execution.status === "failed" && <Chip tone="bad">Execution failed</Chip>}
              </ListButton>
            ))}
          </List>
        )}
      </Section>

      {projects.length > 0 && (
        <Section label={(core.config.projects.plural || "Projects") + " · " + projects.length}>
          <List>
            {projects.map((p) => (
              <ListButton key={p.id} onClick={() => openObject("project", p.id)}>
                <Ref>{p.ref}</Ref><Grow>{p.title}</Grow><span className="rc-small" style={{ flex: "none" }}>{q.name(p.ownerId)}</span>
              </ListButton>
            ))}
          </List>
        </Section>
      )}

      {obligations.length > 0 && (
        <Section label={"Requirements · " + obligations.length}>
          <List>
            {obligations.map((o) => (
              <ListButton key={o.id} onClick={() => openObject("obligation", o.id)}>
                <Grow>{core.config.standards.requirements.find((x) => x.id === o.requirementId)?.label || o.requirementId}</Grow>
                <Chip tone={OB_TONE[o.state]}>{OB_LABEL[o.state]}</Chip>
              </ListButton>
            ))}
          </List>
        </Section>
      )}

      {runs.length > 0 && (
        <Section label={"Workflow runs · " + runs.length}>
          <List>
            {runs.map((x) => (
              <ListButton key={x.id} onClick={() => openObject("run", x.id)}>
                <Ref>{x.ref}</Ref>
                <Grow>{x.title}</Grow>
                <Chip tone={toneOf.run(x.status)}>{LABEL.run[x.status]}</Chip>
              </ListButton>
            ))}
          </List>
        </Section>
      )}
    </>
  );
}

/* ── Files ─────────────────────────────────────────────────────────────── */

function FilesTab({ files }: { files: FileDoc[] }) {
  return (
    <Section label={"Files · " + files.length}>
      <List>
        {files.map((f) => {
          const v = [...f.versions].sort((a, b) => b.n - a.n)[0];
          return (
            <ListButton key={f.id} onClick={() => openObject("file", f.id)}>
              <Grow>{f.title}</Grow>
              <span className="rc-small" style={{ flex: "none" }}>{f.kind}{v ? ", v" + v.n + (v.approved ? " approved" : " not approved") : ""}</span>
              {f.restrictedTo?.length ? <Chip tone="warn">Restricted</Chip> : null}
            </ListButton>
          );
        })}
      </List>
      <div className="rc-small" style={{ marginTop: 6 }}>Open a file for its versions, owner, access and where each version was used.</div>
    </Section>
  );
}

/* ── History ───────────────────────────────────────────────────────────── */

function History({ r, events }: { r: RecordItem; events: AuditEvent[] }) {
  const { core, q } = useCore();
  const type = typeOf(core, r.typeId);
  const sourceUpdated = latest(Object.values(r.fieldMeta).map((m) => m.sourceUpdatedAt));
  const lastSynced = latest(r.sourceRefs.map((s) => s.syncedAt));
  const fmtVal = (key: string, v: FieldValue | undefined) => {
    const def = type?.fields.find((f) => f.key === key);
    return fmtField(core, q, def, v) ?? "empty";
  };
  const labelOf = (key: string) => type?.fields.find((f) => f.key === key)?.label || key;
  const changes = (e: AuditEvent) => {
    const keys = [...new Set([...Object.keys(e.before || {}), ...Object.keys(e.after || {})])].filter((k) => k !== "moved");
    return keys.map((k) => ({ k, before: e.before?.[k], after: e.after?.[k], hasBefore: !!e.before && k in e.before }));
  };

  return (
    <>
      <div className="pk-section">
        <KV items={[
          ["Created", <When at={r.createdAt} />],
          ["Last changed", <When at={r.updatedAt} />],
          ["Source updated", sourceUpdated ? <When at={sourceUpdated} /> : <span className="pk-faint">No source values</span>],
          ["Last synced", lastSynced ? <When at={lastSynced} /> : <span className="pk-faint">Not synced</span>]
        ]} />
      </div>
      <Section label={"Timeline · " + events.length}>
        {events.length === 0 && <div className="rc-small" style={{ marginBottom: 10 }}>No recorded activity yet beyond the record's creation.</div>}
        <div className="pk-timeline">
          {events.map((e) => (
            <div key={e.id} className="pk-step">
              <div className="pk-step-rail"><span className="pk-step-dot" aria-hidden="true">{ACTOR_LABEL[e.actorKind][0]}</span><span className="pk-step-line" /></div>
              <div className="pk-step-body">
                <div className="rc-row" style={{ gap: 6 }}>
                  <Chip tone={ACTOR_TONE[e.actorKind]} plain>{ACTOR_LABEL[e.actorKind]}</Chip>
                  <span style={{ fontSize: 12.5, color: "var(--ink)" }}>{q.name(e.actorId)}</span>
                  {e.onBehalfOfId && <span className="rc-small">for {q.name(e.onBehalfOfId)}</span>}
                  {e.simulated && <Chip tone="neutral" plain>Simulated</Chip>}
                  <span className="pk-grow" />
                  <span className="rc-small"><When at={e.at} /></span>
                </div>
                <div style={{ fontSize: 13, color: "var(--body)", marginTop: 4, lineHeight: 1.45 }}>{e.summary}</div>
                {changes(e).map((c) => (
                  <div key={c.k} className="rc-small" style={{ marginTop: 3 }}>
                    {labelOf(c.k)}: {c.hasBefore ? fmtVal(c.k, c.before) + " to " : "now "}{fmtVal(c.k, c.after)}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pk-step">
            <div className="pk-step-rail"><span className="pk-step-dot" aria-hidden="true">C</span></div>
            <div className="pk-step-body">
              <div className="rc-row" style={{ gap: 6 }}>
                <span style={{ fontSize: 12.5, color: "var(--ink)" }}>Record created</span>
                {r.sourceRefs.length > 0 && <span className="rc-small">first seen from {sourceLabel(core, r.sourceRefs[0].sourceId)}</span>}
                <span className="pk-grow" />
                <span className="rc-small" title={fmtDateTime(r.createdAt, core.config.timezone)}><When at={r.createdAt} /></span>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ── Sources ───────────────────────────────────────────────────────────── */

const SYNC_LABEL: Record<string, string> = { not_connected: "Not connected", sample: "Simulated", ok: "Connected", stale: "Stale", error: "Sync error" };
const SYNC_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { not_connected: "neutral", sample: "neutral", ok: "ok", stale: "warn", error: "bad" };

function Sources({ r }: { r: RecordItem }) {
  const { core, ctx } = useCore();
  const type = typeOf(core, r.typeId);
  const mappings = core.config.fieldMappings.filter((m) => m.recordTypeId === r.typeId);
  const now = ms(ctx.now);
  const sourceIds = useMemo(() => [...new Set(r.sourceRefs.map((s) => s.sourceId))], [r.sourceRefs]);

  return (
    <>
      <Section label={"Source references · " + r.sourceRefs.length}>
        {r.sourceRefs.length === 0 ? (
          <Notice>Entered in Pulse. No source system holds this record, so Pulse is where it is kept.</Notice>
        ) : (
          <div className="rc-mini-wrap">
            <table className="rc-mini">
              <thead><tr><th>Source</th><th>External id</th><th>Last synced</th><th>State</th></tr></thead>
              <tbody>
                {r.sourceRefs.map((s) => {
                  const stale = !!s.syncedAt && now - ms(s.syncedAt) > 24 * HOUR;
                  return (
                    <tr key={s.sourceId + s.externalId}>
                      <td>{sourceLabel(core, s.sourceId)}</td>
                      <td className="pk-mono">{s.externalId || "None"}</td>
                      <td>{s.syncedAt ? <When at={s.syncedAt} /> : <span className="pk-faint">Never</span>}</td>
                      <td>{!s.syncedAt ? <Chip tone="neutral">Not synced</Chip> : stale ? <Chip tone="warn" title="Last synced more than 24 hours ago">Stale</Chip> : <Chip tone="ok">Current</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {sourceIds.length > 0 && (
        <Section label="Connection">
          <div className="rc-stack">
            {sourceIds.map((id) => {
              const src = core.config.sources.find((s) => s.id === id);
              const sync = core.data.sync.find((s) => s.sourceId === id);
              return (
                <Notice key={id} tone={src?.connected ? "neutral" : "warn"}>
                  <div className="rc-row" style={{ gap: 6 }}>
                    <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{sourceLabel(core, id)}</strong>
                    {sync && <Chip tone={SYNC_TONE[sync.status] || "neutral"}>{SYNC_LABEL[sync.status] || sync.status}</Chip>}
                    {!src?.connected && <Chip tone="neutral" plain>Not connected</Chip>}
                  </div>
                  {sync?.message && <div style={{ marginTop: 4 }}>{sync.message}</div>}
                  {sync && <div className="rc-small" style={{ marginTop: 4 }}>Last attempt: {sync.lastAttemptAt ? fmtDateTime(sync.lastAttemptAt, core.config.timezone) : "never"}. Last success: {sync.lastSuccessAt ? fmtDateTime(sync.lastSuccessAt, core.config.timezone) : "never"}.</div>}
                  {!src?.connected && src?.prerequisite && <div className="rc-small" style={{ marginTop: 4 }}>{src.prerequisite}</div>}
                  {!src && <div className="rc-small" style={{ marginTop: 4 }}>This source is no longer configured.</div>}
                </Notice>
              );
            })}
          </div>
        </Section>
      )}

      <Section label="Field authority">
        {mappings.length === 0 ? (
          <div className="rc-small">No field mappings for the {type?.label.toLowerCase() || "record"} type. Pulse is the source of truth for every field.</div>
        ) : (
          <div className="rc-mini-wrap">
            <table className="rc-mini">
              <thead><tr><th>Field</th><th>Authoritative system</th><th>Source field</th><th>Write-back</th></tr></thead>
              <tbody>
                {mappings.map((m) => {
                  const src = core.config.sources.find((s) => s.id === m.sourceId);
                  return (
                    <tr key={m.id}>
                      <td>{type?.fields.find((f) => f.key === m.fieldKey)?.label || m.fieldKey}</td>
                      <td>{m.authority === "pulse" ? "Pulse" : sourceLabel(core, m.sourceId)}{m.authority === "source" && src && !src.connected ? <span className="rc-small"> (not connected)</span> : null}</td>
                      <td className="pk-mono">{m.sourceField || "None"}</td>
                      <td>{m.writeBack ? (src?.connected ? "On" : "On, but the source is not connected") : "Off"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="rc-small" style={{ marginTop: 6 }}>Fields not listed are held in Pulse only.</div>
      </Section>
    </>
  );
}
