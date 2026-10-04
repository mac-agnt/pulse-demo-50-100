/* Company updates in Activity: published updates for the viewer's audience,
   and drafted recaps waiting for someone who can publish them. A recap is
   drafted from recorded events on request; an audit event is never turned
   into an announcement automatically. Nothing is emailed. */

import { useState } from "react";
import {
  addressableAudiences, audienceLabel, can, publishersFor, relative, store, useCore, visibleUpdates,
  draftRecap, publishUpdate, discardUpdate, fmtDateTime, type CompanyUpdate, type UpdateAudience
} from "../../core";
import { Panel, Btn, FilterChip } from "../frame";
import { Chip } from "../kit";

const audKey = (a: UpdateAudience) => (a.kind === "organisation" ? "organisation" : a.kind + ":" + a.id);
const parseAud = (k: string): UpdateAudience => {
  if (k === "organisation") return { kind: "organisation" };
  const [kind, id] = k.split(":");
  return kind === "unit" ? { kind: "unit", id } : { kind: "team", id };
};

export default function CompanyUpdates() {
  const { core, ctx, q } = useCore();
  const [aud, setAud] = useState("");
  const v = q.viewer;
  const canPublish = can(v, "updates.publish");
  const canDraft = can(v, "audit.view") || canPublish;
  const all = visibleUpdates(core, ctx.viewerId).filter((u) => u.state !== "discarded");
  const audiences = [...new Map(all.map((u) => [audKey(u.audience), u.audience])).values()];
  const list = all.filter((u) => !aud || audKey(u.audience) === aud);
  const drafts = list.filter((u) => u.state === "draft");
  const published = list.filter((u) => u.state === "published");

  return (
    <Panel title="Company updates" meta="Published updates for your audience, and recaps drafted from the audit log. Nothing here is emailed."
      right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {audiences.length > 1 && (
          <FilterChip label="Audience" value={aud} onChange={setAud}
            options={[{ value: "", label: "Every audience" }, ...audiences.map((a) => ({ value: audKey(a), label: audienceLabel(core, a) }))]} />
        )}
        <Btn small onClick={() => store.run(draftRecap, {})} disabled={!canDraft}
          title={canDraft ? "Draft a recap of today's recorded events in this scope. It stays a draft until published." : "Drafting recaps needs audit access or permission to publish updates."}>
          Draft today's recap
        </Btn>
      </div>}>
      {list.length === 0 ? (
        <div className="act-upd-empty">No company updates yet. {canDraft ? "Draft a recap of today's events, review it, then publish it to an audience." : "Updates appear here once someone publishes one to your audience."}</div>
      ) : (
        <div className="act-upd-list">
          {drafts.map((u) => <DraftCard key={u.id} u={u} canPublish={canPublish} />)}
          {published.map((u) => (
            <article key={u.id} className="act-upd">
              <div className="act-upd-h">
                <span className="act-upd-t">{u.title}</span>
                <Chip tone="ok" plain>Published</Chip>
                <Chip plain>{audienceLabel(core, u.audience)}</Chip>
              </div>
              <Body text={u.body} />
              <div className="act-upd-meta">{q.name(u.publishedBy)}, {relative(u.publishedAt, ctx.now, core.config.timezone)}</div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Body({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220 || text.split("\n").length > 3;
  return (
    <>
      <div className={"act-upd-b" + (open || !long ? "" : " act-upd-b--clip")}>{text}</div>
      {long && <button type="button" className="act-link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Show less" : "Show all"}</button>}
    </>
  );
}

function DraftCard({ u, canPublish }: { u: CompanyUpdate; canPublish: boolean }) {
  const { core, ctx, q } = useCore();
  const opts = addressableAudiences(core, q.viewer);
  const [aud, setAud] = useState(audKey(u.audience));
  const [confirm, setConfirm] = useState(false);
  const chosen = parseAud(aud);
  const canReach = opts.some((a) => audKey(a) === aud);
  const publishers = publishersFor(core, u.audience).filter((id) => id !== ctx.viewerId);
  const mayDiscard = u.draftedBy === ctx.viewerId || (canPublish && canReach);
  return (
    <article className="act-upd act-upd--draft">
      <div className="act-upd-h">
        <span className="act-upd-t">{u.title}</span>
        <Chip tone="warn" plain>Draft, not published</Chip>
        <Chip plain>{audienceLabel(core, u.audience)}</Chip>
      </div>
      <Body text={u.body} />
      <div className="act-upd-meta">Drafted by {q.name(u.draftedBy)}, {fmtDateTime(u.draftedAt, core.config.timezone)}{u.eventIds.length ? ", from " + u.eventIds.length + " recorded events" : ""}</div>
      <div className="act-upd-f">
        {canPublish ? (
          <>
            <label className="act-upd-aud">
              <span className="pk-help">Publish to</span>
              <select className="pk-select" value={aud} onChange={(e) => { setAud(e.target.value); setConfirm(false); }} aria-label="Audience">
                {!canReach && <option value={aud}>{audienceLabel(core, chosen)} (outside what you can address)</option>}
                {opts.map((a) => <option key={audKey(a)} value={audKey(a)}>{audienceLabel(core, a)}</option>)}
              </select>
            </label>
            {confirm ? (
              <>
                <span className="pk-help">Publish to {audienceLabel(core, chosen)}? Everyone in it will see this in Activity.</span>
                <Btn small primary onClick={() => { store.run(publishUpdate, u.id, { audience: chosen }); setConfirm(false); }}>Publish</Btn>
                <Btn small onClick={() => setConfirm(false)}>Cancel</Btn>
              </>
            ) : (
              <Btn small primary disabled={!canReach} onClick={() => setConfirm(true)} title={canReach ? undefined : "Choose an audience you can address"}>Review and publish</Btn>
            )}
          </>
        ) : (
          <span className="pk-help">Needs someone who can publish updates{publishers.length ? ": " + publishers.map((id) => q.name(id)).join(", ") : ". Nobody with that permission covers this audience yet"}.</span>
        )}
        <span className="act-grow" />
        {mayDiscard && <Btn small onClick={() => store.run(discardUpdate, u.id)}>Discard draft</Btn>}
      </div>
    </article>
  );
}
