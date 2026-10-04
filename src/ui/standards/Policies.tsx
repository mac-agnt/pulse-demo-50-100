/* Standards > Policies: versioned policy documents with owner, effective and
   review dates, and acknowledgement progress per version. Acknowledging is
   always for yourself and for the current version. */

import { useCore, can, openObject, navigate, policyFiles, policyProgress, acknowledgePolicy, canSeeEmployment, type FileDoc } from "../../core";
import { Panel } from "../frame";
import { Button, Empty, KV, Notice, Section, SidePanel } from "../kit";
import { InlineError, useRunner } from "../work/shared";
import { Status, StdTable, Two, useDates, type OpenStd } from "./shared";

export function usePolicies() {
  const { core, q, ctx } = useCore();
  const files = policyFiles(core).filter((f) => !!q.file(f.id));
  return files.map((f) => ({ f, p: policyProgress(core, f, ctx.now) }));
}

export function Policies({ open }: { open: OpenStd }) {
  const { q, ctx } = useCore();
  const { d } = useDates();
  const rows = usePolicies().sort((a, b) => Number(b.p.outstanding.includes(ctx.viewerId)) - Number(a.p.outstanding.includes(ctx.viewerId)) || a.f.title.localeCompare(b.f.title));
  return (
    <Panel pad={false}>
      <StdTable label="Policies" rows={rows} rowKey={(x) => x.f.id} onOpen={(x) => open({ kind: "policy", id: x.f.id })}
        empty={<Empty title="No policies yet" body="Policies are documents of the kind Policy in Records, Files. Add one there, then choose in Settings whether people must acknowledge it."
          action={<Button onClick={() => navigate({ page: "Records", section: "files" })}>Open Files</Button>} />}
        cols={[
          { key: "title", label: "Policy", width: "28%", render: (x) => <Two a={x.f.title} b={x.f.summary} /> },
          { key: "owner", label: "Owner", hideNarrow: true, render: (x) => q.name(x.f.ownerId) },
          { key: "version", label: "Version", render: (x) => "Version " + x.p.version },
          { key: "effective", label: "Effective", hideNarrow: true, render: (x) => d(x.f.effectiveDate) },
          { key: "review", label: "Review by", render: (x) => x.f.reviewDate ? (x.p.reviewOverdue ? <Status tone="bad">Overdue, {d(x.f.reviewDate)}</Status> : d(x.f.reviewDate)) : "Not set" },
          { key: "ack", label: "Acknowledged", render: (x) => x.p.requiresAck
            ? <Status tone={x.p.outstanding.length ? "warn" : "ok"}>{x.p.acknowledged.length} of {x.p.required.length}, version {x.p.version}</Status>
            : <span className="std-na">Not required</span> },
          { key: "you", label: "You", render: (x) => !x.p.requiresAck || !x.p.required.includes(ctx.viewerId) ? <span className="std-na">Not asked</span>
            : x.p.outstanding.includes(ctx.viewerId) ? <Status tone="warn">To acknowledge</Status> : <Status tone="ok">Done</Status> }
        ]} />
    </Panel>
  );
}

export function PolicyPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { core, q, ctx } = useCore();
  const { d, dy } = useDates();
  const { err, run } = useRunner();
  const f: FileDoc | undefined = q.file(id);
  const p = f ? policyProgress(core, f, ctx.now) : null;
  const mine = !!p && p.outstanding.includes(ctx.viewerId);
  // Names of people still to acknowledge are shown only where the viewer can see their employment details.
  const visibleOutstanding = p ? p.outstanding.filter((pid) => { const e = core.data.employment.find((x) => x.personId === pid); return pid === ctx.viewerId || (!!e && canSeeEmployment(q, e)); }) : [];
  return (
    <SidePanel open onClose={onClose} width={580} eyebrow="Policy" title={f?.title || "Policy"}
      chips={p?.requiresAck ? <Status tone={p.outstanding.length ? "warn" : "ok"}>{p.acknowledged.length} of {p.required.length} acknowledged</Status> : undefined}
      footer={f ? <><Button onClick={() => openObject("file", f.id)}>Open in Files</Button><span className="pk-grow" />
        {mine && <Button variant="primary" onClick={() => run(acknowledgePolicy, f.id)}>Acknowledge version {p!.version}</Button>}</> : undefined}>
      {!f || !p ? <Empty title="Not available" body="This policy does not exist or you cannot see it." /> : (
        <>
          <div className="pk-help" style={{ marginBottom: 12 }}>{f.summary}</div>
          <KV items={[
            ["Owner", q.name(f.ownerId)],
            ["Current version", "Version " + p.version + ", added " + d(f.versions[f.versions.length - 1]?.addedAt)],
            ["Effective", dy(f.effectiveDate)],
            ["Review by", f.reviewDate ? dy(f.reviewDate) + (p.reviewOverdue ? " (overdue)" : "") : "Not set"],
            ["Acknowledgement", p.requiresAck ? "Required from active staff who can see it" : "Not required"]
          ]} />
          {mine && <Notice tone="warn">You have not acknowledged version {p.version} yet. Acknowledging records that you have read this version.</Notice>}
          <InlineError text={err} />
          {p.requiresAck && (
            <>
              <Section label="By version">
                <div className="pk-list">
                  {[...p.byVersion].reverse().map((x) => (
                    <div key={x.n} className="pk-li">
                      <span className="pk-grow">Version {x.n}{x.n === p.version ? " (current)" : ""}</span>
                      <span className="pk-mono" style={{ fontSize: 12 }}>{x.acknowledged} acknowledged</span>
                    </div>
                  ))}
                </div>
                <div className="pk-help" style={{ marginTop: 6 }}>An acknowledgement covers one version. A new version needs a new acknowledgement.</div>
              </Section>
              <Section label={"Still to acknowledge version " + p.version + " (" + p.outstanding.length + ")"}>
                {!p.outstanding.length ? <div className="pk-help">Everyone asked has acknowledged the current version.</div>
                  : !visibleOutstanding.length ? <div className="pk-help">{p.outstanding.length} people. Names are shown to their managers.</div>
                  : <div className="pk-list">{visibleOutstanding.map((pid) => <div key={pid} className="pk-li"><span className="pk-grow">{q.name(pid)}</span></div>)}
                    {p.outstanding.length > visibleOutstanding.length && <div className="pk-li pk-help">{p.outstanding.length - visibleOutstanding.length} more outside your reach</div>}</div>}
              </Section>
            </>
          )}
          {!p.requiresAck && can(q.viewer, "settings.edit") && (
            <div className="pk-help" style={{ marginTop: 12 }}>To ask people to acknowledge it, tick it in Settings, Standards and requirements.</div>
          )}
        </>
      )}
    </SidePanel>
  );
}
