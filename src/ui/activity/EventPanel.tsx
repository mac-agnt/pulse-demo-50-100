/* Detail panel for one audit event: what happened, who did it, the object it
   touched, the before/after values, and the full timeline of every record it
   touched (sync, human changes, approvals, execution and agent actions). */

import { useMemo, type ReactNode } from "react";
import { useCore, openObject, fmtDateTime, relative } from "../../core";
import type { AuditEvent } from "../../core";
import { Button, Chip, Empty, Icon, ICON, KV, NoAccess, Notice, PersonName, Section, SidePanel } from "../kit";
import { ACTOR_KIND_LABEL, ACTOR_KIND_TONE, actionLabel, eventCategory, fieldLabel, fmtValue, objectResolver } from "./eventInfo";

export default function EventPanel({ eventId, onClose, onSelect }: { eventId: string | null; onClose: () => void; onSelect: (id: string) => void }) {
  const { q, ctx, core } = useCore();
  const tz = core.config.timezone;
  const resolve = useMemo(() => objectResolver(q), [q]);
  const e: AuditEvent | undefined = eventId ? q.events({ ignoreScope: true }).find((x) => x.id === eventId) : undefined;

  if (!eventId) return null;
  if (!e) {
    return (
      <SidePanel open onClose={onClose} title="Event" eyebrow="Activity">
        <NoAccess what="this event, or it no longer exists" />
      </SidePanel>
    );
  }

  const obj = resolve(e);
  const go = (kind: Parameters<typeof openObject>[0], id: string) => { onClose(); openObject(kind, id); };
  const diffKeys = [...new Set([...Object.keys(e.before || {}), ...Object.keys(e.after || {})])];
  const unitId = e.unitId || q.s.config.teams.find((t) => t.id === e.teamId)?.unitId;
  const unit = q.unitLabel(unitId);
  const team = e.teamId ? q.teamLabel(e.teamId) + (unit ? ", " + unit : "") : unit || "No team (organisation level)";

  return (
    <SidePanel open onClose={onClose} width={640} eyebrow={actionLabel(e.action)} title={e.summary}
      chips={<>
        <Chip tone={ACTOR_KIND_TONE[e.actorKind]} plain>{ACTOR_KIND_LABEL[e.actorKind]}</Chip>
        {e.simulated && <Chip tone="warn">Simulated</Chip>}
      </>}
      footer={obj.open ? <Button variant="primary" onClick={() => go(obj.open!.kind, obj.open!.id)}>Open {obj.type.toLowerCase()}<Icon d={ICON.arrow} size={13} /></Button> : undefined}>
      <KV items={[
        ["Actor", <PersonName id={e.actorId} />],
        ...(e.onBehalfOfId ? [["On behalf of", <PersonName id={e.onBehalfOfId} />] as [string, ReactNode]] : []),
        ["When", fmtDateTime(e.at, tz) + " (" + relative(e.at, ctx.now, tz) + ")"],
        ["Action", <span className="pk-mono" style={{ fontSize: 12 }}>{e.action}</span>],
        ["Team", team]
      ]} />

      <Section label="Object">
        <div className="pk-list">
          {obj.open ? (
            <button className="pk-li pk-li--btn" onClick={() => go(obj.open!.kind, obj.open!.id)}>
              <Chip plain>{obj.type}</Chip>
              <span className="pk-grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>{obj.label}</span>
              <Icon d={ICON.arrow} size={13} />
            </button>
          ) : (
            <div className="pk-li">
              <Chip plain>{obj.type}</Chip>
              <span className="pk-grow pk-muted">{obj.label}{obj.hidden ? "" : ". This object has no page to open."}</span>
            </div>
          )}
        </div>
      </Section>

      {diffKeys.length > 0 && (
        <Section label="Change">
          <div className="pk-table-wrap" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md,12px)" }}>
            <table className="pk-table" style={{ minWidth: 0 }} aria-label="Values before and after">
              <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
              <tbody>
                {diffKeys.map((k) => (
                  <tr key={k}>
                    <td className="pk-strong">{fieldLabel(q, e, k)}</td>
                    <td>{e.before && k in e.before ? fmtValue(e.before[k]) : "Not recorded"}</td>
                    <td>{e.after && k in e.after ? fmtValue(e.after[k]) : "Not recorded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {e.simulated && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="warn">This event was simulated in the demo. Nothing outside Pulse was contacted: no email was sent, no scheduler or external system ran.</Notice>
        </div>
      )}

      {e.recordIds.length > 0 && e.recordIds.map((rid) => <RecordTimeline key={rid} recordId={rid} currentId={e.id} onSelect={onSelect} />)}
    </SidePanel>
  );
}

function RecordTimeline({ recordId, currentId, onSelect }: { recordId: string; currentId: string; onSelect: (id: string) => void }) {
  const { q, ctx, core } = useCore();
  const tz = core.config.timezone;
  const r = q.record(recordId);
  if (!r) {
    return <Section label="Timeline"><Empty title="Record not available" body="You cannot see this record, so its timeline is hidden." /></Section>;
  }
  const items = q.timeline(recordId);
  return (
    <Section label={"Timeline for " + r.ref}
      right={<Button size="sm" variant="ghost" onClick={() => openObject("record", r.id)}>Open record</Button>}>
      <div className="pk-muted" style={{ fontSize: 12, marginBottom: 8 }}>{r.title}. Newest first: syncs and imports, changes by people, approvals, execution and agent actions.</div>
      {items.length === 0 ? <Empty title="No recorded history" body="Nothing has been recorded against this record yet." /> : (
        <div className="pk-list">
          {items.map((t) => (
            <button key={t.id} className="pk-li pk-li--btn act-tl" aria-current={t.id === currentId || undefined} onClick={() => onSelect(t.id)}>
              <span className="act-tl-when pk-mono">{fmtDateTime(t.at, tz)}</span>
              <span className="pk-grow" style={{ minWidth: 0 }}>
                <span className="act-tl-sum">{t.summary}</span>
                <span className="act-tl-meta">
                  <Chip tone={ACTOR_KIND_TONE[t.actorKind]} plain>{ACTOR_KIND_LABEL[t.actorKind]}</Chip>
                  <span>{eventCategory(t)}</span>
                  <span>{q.name(t.actorId)}</span>
                  {t.simulated && <Chip tone="warn" plain>Simulated</Chip>}
                  <span className="pk-faint">{relative(t.at, ctx.now, tz)}</span>
                </span>
              </span>
              {t.id === currentId && <Chip tone="accent" plain>This event</Chip>}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
