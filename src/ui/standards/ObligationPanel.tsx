/* One requirement for one subject: what is expected, the evidence received
   (file and exact version), the canonical review in Work, what it holds back
   and its history. A received file never shows as accepted. */

import { useState } from "react";
import {
  useCore, ops, openObject, can, obligationView, visibleViews, canSeeSubject, canHandleSubject, gatesFor, gateState, stateText,
  subjectKindLabel, receiveEvidence, attachEvidenceFile, startReview, EXPIRING_DAYS, type ObligationView
} from "../../core";
import { Button, Empty, Field, KV, Notice, NoAccess, Section, Select, SidePanel, TextInput, LABEL, Chip, PersonName } from "../kit";
import { DecisionActions } from "../work/ApprovalActions";
import { InlineError, useRunner } from "../work/shared";
import { LinkBtn, StatePill, useDates, useSubjectLink, type OpenStd } from "./shared";

export function ObligationPanel({ k, onClose, open }: { k: string; onClose: () => void; open: OpenStd }) {
  const { core, q, ctx } = useCore();
  const v = obligationView(core, k, ctx.now);
  const title = v ? v.requirement.label + ": " + v.subject.label : "Requirement";
  const extra = v ? [v.requirement.ownerId, v.obligation?.evidence?.receivedBy] : [];
  const visible = !!v && (canSeeSubject(q, v.subject, extra) || (!!v.review && !!q.request(v.review.id)));
  return (
    <SidePanel open onClose={onClose} title={title} width={640}
      eyebrow={v ? subjectKindLabel(core.config, v.subject.kind, false) + " requirement" : undefined}
      chips={v && visible ? <StatePill v={v} long /> : undefined}>
      {!v ? <Empty title="Not found" body="This requirement record no longer exists, or its requirement was removed in Settings." />
        : !visible ? <NoAccess what={"the standards record for " + v.subject.label} />
        : <Body v={v} open={open} />}
    </SidePanel>
  );
}

function Body({ v, open }: { v: ObligationView; open: OpenStd }) {
  const { core, q, ctx } = useCore();
  const { d, dy } = useDates();
  const link = useSubjectLink();
  const o = v.obligation;
  const req = v.requirement;
  const roles = req.reviewerRoleIds.map((r) => core.config.roles.find((x) => x.id === r)?.label || r).join(", ") || "Administrator";
  const mayHandle = canHandleSubject(core, ctx.viewerId, v.subject, req);
  const subjectOpen = link(v.subject);
  const gates = o ? gatesFor(core, o.id) : [];

  return (
    <>
      <StateNotice v={v} />
      <KV items={[
        ["Requirement", req.label],
        [subjectKindLabel(core.config, v.subject.kind, false), subjectOpen ? <LinkBtn key="s" onClick={subjectOpen}>{v.subject.label}</LinkBtn> : v.subject.label],
        ["Evidence expected", req.evidence || "Not described"],
        ["Renewal", req.renewEveryMonths ? "Every " + req.renewEveryMonths + " months" : "No renewal"],
        ["Due", o?.dueAt ? d(o.dueAt) : "No date set"],
        ["Valid to", v.expiresAt ? dy(v.expiresAt) : v.state === "approved" ? "No expiry" : "Not approved"],
        ["Decided", o?.decidedAt ? q.name(o.decidedBy) + ", " + d(o.decidedAt) : "Not decided"],
        ["Reviewers", roles]
      ]} />
      {!v.applies && <Notice tone="warn">This requirement no longer applies to {v.subject.label} under its current configuration. The record is kept for history.</Notice>}

      {v.source === "certificate" ? <CertificateSection v={v} /> : (
        <>
          <Section label="Evidence received"><EvidenceBlock v={v} /></Section>
          {v.review && <Section label="Review in Work"><ReviewBlock v={v} /></Section>}
          {v.state === "received" && o && (
            <Section label="Next step"><StartReview id={o.id} roles={roles} mayHandle={mayHandle} /></Section>
          )}
          {(v.state === "missing" || v.state === "rejected" || v.state === "expired" || v.state === "received" || v.expiring) && (
            <Section label={v.state === "received" ? "Replace the received file" : "Receive evidence"}>
              {mayHandle ? <ReceiveForm v={v} onReceived={(id) => { if (id && id !== v.key) open({ kind: "obligation", key: id }); }} />
                : <Notice>Only the owner of {v.subject.label}, the requirement owner or a reviewer in scope can record evidence for it.</Notice>}
            </Section>
          )}
        </>
      )}

      {(gates.length > 0 || req.blocks) && (
        <Section label="Holds back">
          <div className="pk-list">
            {gates.map((g) => {
              const gs = gateState(core, ctx.now, g.milestone.gate!.obligationIds);
              return (
                <button key={g.milestone.id} type="button" className="pk-li pk-li--btn" onClick={() => g.project && openObject("project", g.project.id)}>
                  <span className="pk-grow">{(g.project?.title || "Project") + ": " + g.milestone.label} gate{g.milestone.gate?.label ? " (" + g.milestone.gate.label + ")" : ""}</span>
                  <Chip tone={g.milestone.completedAt ? "neutral" : gs.satisfied ? "ok" : "warn"}>{g.milestone.completedAt ? "Milestone done" : gs.satisfied ? "Satisfied" : gs.waiting.length + " waiting"}</Chip>
                </button>
              );
            })}
            {req.blocks && <div className="pk-li"><span className="pk-grow">{req.blocks}</span><Chip tone={v.state === "approved" ? "ok" : "warn"}>{v.state === "approved" ? "Not held back" : "Held back"}</Chip></div>}
          </div>
          {req.blocks && <div className="pk-help" style={{ marginTop: 6 }}>Shown from the requirement's configuration. Pulse lists it here; other modules decide whether to enforce it.</div>}
        </Section>
      )}

      <Section label="History"><HistoryList v={v} /></Section>
    </>
  );
}

function StateNotice({ v }: { v: ObligationView }) {
  const { core } = useCore();
  const { dy } = useDates();
  const t = stateText(core, v);
  switch (v.state) {
    case "received": return <Notice tone="warn">Received, not accepted. A received file is not evidence until a reviewer approves it and the acceptance runs.</Notice>;
    case "under_review": return v.review?.status === "approved"
      ? <Notice tone="warn">The review was approved. The evidence counts as accepted once the approved action runs (below).</Notice>
      : <Notice>Under review: {t.replace(/^under review/, "").trim() || "waiting on a reviewer"}. It is not accepted yet.</Notice>;
    case "rejected": return <Notice tone="bad">Rejected{v.obligation?.rejectionReason ? ": " + v.obligation.rejectionReason : ""}. New evidence is needed.</Notice>;
    case "expired": return <Notice tone="bad">Expired{v.expiresAt ? " on " + dy(v.expiresAt) : ""}. Receive renewed evidence and start its review.</Notice>;
    case "missing": return <Notice tone="warn">Nothing received yet.</Notice>;
    case "approved": return v.expiring
      ? <Notice tone="warn">Approved, but it expires within {EXPIRING_DAYS} days. Renewed evidence can be received now.</Notice>
      : <Notice tone="ok">Approved: the evidence was reviewed and accepted. This records evidence, not legal compliance.</Notice>;
  }
}

function EvidenceBlock({ v }: { v: ObligationView }) {
  const { core, q } = useCore();
  const { d } = useDates();
  const ev = v.obligation?.evidence;
  if (!ev) return <div className="pk-help">No file has been received.</div>;
  const f = q.file(ev.fileId);
  const raw = core.data.files.find((x) => x.id === ev.fileId);
  const latest = raw?.versions[raw.versions.length - 1]?.n;
  return (
    <div className="pk-list">
      <div className="pk-li">
        <span className="pk-grow std-two">
          <span>{f ? f.title : "A document you cannot see"}</span>
          <span>Version {ev.version}{latest ? " of " + latest : ""}, received {d(ev.receivedAt)} by {q.name(ev.receivedBy)}</span>
        </span>
        {f && <Button size="sm" onClick={() => openObject("file", f.id)}>Open in Files</Button>}
      </div>
      {latest && latest > ev.version && (
        <div className="pk-li"><span className="pk-help">A newer version ({latest}) exists. This record covers version {ev.version} only; receive the newer one to review it.</span></div>
      )}
    </div>
  );
}

function ReviewBlock({ v }: { v: ObligationView }) {
  const { core, q, ctx } = useCore();
  const { err, run } = useRunner();
  const r = v.review!;
  const req = q.request(r.id) || r;
  const a = core.data.approvals.find((x) => x.id === req.approvalId);
  const stage = a?.stages.find((x) => x.status === "pending");
  const approvers = a ? a.decisions.filter((x) => x.cycle === a.cycle && x.kind === "approve").map((x) => x.actorId) : [];
  const me = ctx.viewerId;
  const mayRun = req.requesterId === me || approvers.includes(me) || can(q.viewer, "workflows.operate");
  const waitingAcceptance = req.status === "approved" && req.execution.status !== "succeeded";
  return (
    <div className="pk-list" style={{ padding: 0 }}>
      <div className="pk-li">
        <span className="pk-grow std-two">
          <span>{req.ref}: {req.title}</span>
          <span>{LABEL.request[req.status]}{stage ? ", with " + q.name(stage.assigneeId) : ""}. Acceptance: {LABEL.exec[req.execution.status].toLowerCase()}</span>
        </span>
        <Button size="sm" onClick={() => openObject("request", req.id)}>Open in Work</Button>
      </div>
      {a && a.status === "pending" && (
        <div className="pk-li" style={{ display: "block" }}><DecisionActions a={a} req={req} /></div>
      )}
      {waitingAcceptance && (
        <div className="pk-li" style={{ display: "block" }}>
          {req.execution.status === "failed" && req.execution.lastError && <Notice tone="bad">Acceptance failed: {req.execution.lastError}</Notice>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            <Button variant="primary" disabled={!mayRun} title={mayRun ? undefined : "Only the requester, an approver or a workflow operator can run this."}
              onClick={() => run(ops.executeRequest, req.id)}>Accept evidence</Button>
            <span className="pk-help">{mayRun ? "Runs the approved action once: the evidence is accepted and readiness updates." : "Only the requester, an approver or a workflow operator can run this."}</span>
          </div>
          <InlineError text={err} />
        </div>
      )}
    </div>
  );
}

function StartReview({ id, roles, mayHandle }: { id: string; roles: string; mayHandle: boolean }) {
  const { err, run } = useRunner();
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="primary" disabled={!mayHandle} title={mayHandle ? undefined : "Only the subject owner, the requirement owner or a reviewer in scope can start this."}
          onClick={() => run(startReview, id)}>Start review</Button>
        <span className="pk-help">Creates one review request in Work for a reviewer ({roles}). Starting again opens the same request.</span>
      </div>
      <InlineError text={err} />
    </div>
  );
}

function ReceiveForm({ v, onReceived }: { v: ObligationView; onReceived: (id?: string) => void }) {
  const { q } = useCore();
  const { err, run } = useRunner();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [fileId, setFileId] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const files = q.files({ ignoreScope: true }).filter((f) => f.versions.length)
    .sort((a, b) => Number(b.kind === "Evidence") - Number(a.kind === "Evidence") || (b.versions[b.versions.length - 1].addedAt).localeCompare(a.versions[a.versions.length - 1].addedAt));
  const submit = () => {
    const res = mode === "existing" ? run(receiveEvidence, v.key, fileId) : run(attachEvidenceFile, v.key, title, note);
    if (res.ok) { setFileId(""); setTitle(""); setNote(""); onReceived(res.id); }
  };
  const ready = mode === "existing" ? !!fileId : !!title.trim();
  return (
    <div className="std-stack">
      <div className="std-row" role="radiogroup" aria-label="Where the evidence comes from">
        <label className="std-radio"><input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> A document already in Files</label>
        <label className="std-radio"><input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> A new file record</label>
      </div>
      {mode === "existing" ? (
        <Field label="Document" htmlFor="std-file" help="The current version is recorded. Later versions need their own receipt.">
          <Select id="std-file" value={fileId} onChange={setFileId}
            options={[{ value: "", label: files.length ? "Choose a document" : "No documents you can see" },
              ...files.map((f) => ({ value: f.id, label: f.title + " (version " + f.versions[f.versions.length - 1].n + ", " + f.kind + ")" }))]} />
        </Field>
      ) : (
        <div className="pk-grid2">
          <Field label="File name" htmlFor="std-new-t"><TextInput id="std-new-t" value={title} onChange={setTitle} placeholder="For example: Inspection report 2026" /></Field>
          <Field label="Note" htmlFor="std-new-n"><TextInput id="std-new-n" value={note} onChange={setNote} placeholder="What it shows" /></Field>
        </div>
      )}
      {mode === "new" && <div className="pk-help">No file is uploaded in this demo. This creates a file record in Records, Files, as version 1.</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button variant={v.state === "received" ? "secondary" : "primary"} disabled={!ready} title={ready ? undefined : mode === "existing" ? "Choose a document first" : "Name the file first"} onClick={submit}>Record as received</Button>
        <span className="pk-help">Receiving is not accepting. A reviewer decides next.</span>
      </div>
      <InlineError text={err} />
    </div>
  );
}

function CertificateSection({ v }: { v: ObligationView }) {
  const { core, q, ctx } = useCore();
  const { dy } = useDates();
  const { err, run } = useRunner();
  const c = v.certificate;
  const e = core.data.employment.find((x) => x.personId === v.subject.id);
  const manager = can(q.viewer, "tasks.manage") && (q.viewer.isOrgWide || e?.managerId === ctx.viewerId || (!!e?.teamId && q.viewer.overseenTeamIds.includes(e.teamId)));
  return (
    <Section label="Certificate in People">
      <Notice>This requirement reads the {v.requirement.certificateName} certificate held in People, the one place it is recorded. Nothing is copied here.</Notice>
      <div className="pk-list" style={{ marginTop: 10 }}>
        <div className="pk-li">
          <span className="pk-grow std-two">
            <span>{v.requirement.certificateName}</span>
            <span>{!c ? "Not on this person's record" : !c.expires ? "Not recorded yet" : (v.state === "expired" ? "Expired " : "Valid to ") + dy(c.expires)}</span>
          </span>
          {core.config.modules.people?.enabled && <Button size="sm" onClick={() => openObject("person", v.subject.id)}>Open in People</Button>}
          {c && manager && (v.state !== "approved" || v.expiring) && <Button size="sm" onClick={() => run(ops.bookRenewal, v.subject.id, c.id)}>Book renewal</Button>}
        </div>
      </div>
      <InlineError text={err} />
    </Section>
  );
}

function HistoryList({ v }: { v: ObligationView }) {
  const { q } = useCore();
  const { d } = useDates();
  const o = v.obligation;
  if (!o) return <div className="pk-help">{v.source === "certificate" ? "Certificate changes are in the person's history in People." : "No history yet. The record is created when evidence first arrives."}</div>;
  const a = q.s.data.approvals.find((x) => x.id === v.review?.approvalId);
  const ids = new Set([o.id, v.review?.id, a?.id].filter(Boolean) as string[]);
  const events = q.events({ ignoreScope: true }).filter((e) => e.storyKey === "obligation:" + o.id || ids.has(e.objectId))
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i).sort((x, y) => y.at.localeCompare(x.at));
  if (!events.length) return <div className="pk-help">No history yet.</div>;
  return (
    <div className="pk-list">
      {events.slice(0, 25).map((e) => (
        <div key={e.id} className="pk-li" style={{ alignItems: "flex-start" }}>
          <span style={{ flex: "none", width: 150 }}><PersonName id={e.actorId} /></span>
          <span className="pk-grow" style={{ whiteSpace: "normal" }}>{e.summary}</span>
          <span className="pk-mono" style={{ flex: "none", fontSize: 11, color: "var(--faint)" }}>{d(e.at)}</span>
        </div>
      ))}
    </div>
  );
}

export function ReceivePanel({ onClose, open }: { onClose: () => void; open: OpenStd }) {
  const { core, q } = useCore();
  const [key, setKey] = useState("");
  const needs = visibleViews(q).filter((v) => v.applies && v.source !== "certificate" && (v.state === "missing" || v.state === "rejected" || v.state === "expired" || v.expiring || v.state === "received"))
    .filter((v) => canHandleSubject(core, q.viewer.person.id, v.subject, v.requirement));
  return (
    <SidePanel open onClose={onClose} title="Receive evidence" eyebrow="Standards" width={560}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!key} title={key ? undefined : "Choose a requirement first"} onClick={() => open({ kind: "obligation", key })}>Continue</Button></>}>
      {!needs.length ? <Empty title="Nothing needs evidence from you" body="Requirements you can act on are all approved or in review. Requirements for subjects you do not own or review are not listed." /> : (
        <>
          <Field label="Requirement and subject" htmlFor="std-pick" help="Only requirements you can record evidence for are listed.">
            <Select id="std-pick" value={key} onChange={setKey}
              options={[{ value: "", label: "Choose" }, ...needs.map((v) => ({ value: v.key, label: v.requirement.label + ": " + v.subject.label + " (" + stateText(core, v) + ")" }))]} />
          </Field>
          <Notice>Next you choose the document. Receiving it records the file and version; it is accepted only after review.</Notice>
        </>
      )}
      {!can(q.viewer, "standards.review") && <div className="pk-help" style={{ marginTop: 10 }}>Your role cannot review evidence, but you can record evidence for things you own.</div>}
    </SidePanel>
  );
}
