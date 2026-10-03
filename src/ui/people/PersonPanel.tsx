/* One person's employment record: profile, employment, certificates,
   documents, leave, roles and scope, open tasks and history, with the actions
   their manager can take. Every action runs through a core op that re-checks
   permission and writes an audit event. */

import { useState } from "react";
import { useCore, ops, store, openObject, navigate, fmtDate, tenureLabel, can, ms } from "../../core";
import type { Id } from "../../core";
import type { Result } from "../../core/ops";
import { personRows } from "../../core/people";
import { SidePanel, Section, KV, Button } from "../kit";
import { Pill } from "../frame";
import { History } from "../work/shared";
import { InlineForm } from "./bits";
import {
  CONTRACT_LABEL, LEAVE_LABEL, STAGE_LABEL, STAGE_TONE, canManage, checklistTasks, inDays, isoDay, rangeLabel, renewalBooked, rolesOf, fmtYear
} from "./util";

type Pending = { kind: "cert"; id: Id } | { kind: "leaving" } | { kind: "pass" } | null;

const CERT_TEXT = { ok: "In date", due: "Due", lapsed: "Lapsed", missing: "Not recorded" } as const;
const CERT_TONE = { ok: "ok", due: "warn", lapsed: "bad", missing: "neutral" } as const;

export function PersonPanel({ personId, onClose }: { personId: Id; onClose: () => void }) {
  const { core, q, ctx } = useCore();
  const tz = core.config.timezone;
  const [pending, setPending] = useState<Pending>(null);
  const r = personRows(q, { ignoreScope: true }).find((x) => x.person.id === personId);

  if (!r) {
    return (
      <SidePanel open onClose={onClose} title="Not available" eyebrow="PERSON">
        <p style={{ fontSize: 13, color: "var(--dim)" }}>This employment record is not visible to you, or it no longer exists.</p>
      </SidePanel>
    );
  }

  const e = r.e;
  const may = canManage(q, e);
  const isSelf = personId === ctx.viewerId;
  const why = "Only their manager or an administrator can do this.";
  const unitDef = core.config.units.find((u) => u.id === e.unitId);
  const onboarding = checklistTasks(core, personId, "onboarding");
  const offboarding = checklistTasks(core, personId, "offboarding");
  const leave = core.data.leave.filter((l) => l.personId === personId).sort((a, b) => b.from.localeCompare(a.from));
  const upcoming = leave.filter((l) => ms(l.to) >= ms(ctx.now)).reverse();
  const past = leave.filter((l) => ms(l.to) < ms(ctx.now)).slice(0, 6);
  const leaveRequests = q.requests({ ignoreScope: true }).filter((x) => x.formId === "form-leave" && x.requesterId === personId
    && (x.status === "submitted" || x.status === "changes_requested" || x.status === "draft"));
  const roles = rolesOf(core, personId);
  const tasks = q.tasks({ ignoreScope: true }).filter((t) => t.assigneeId === personId && q.isOpenTask(t))
    .sort((a, b) => (a.dueAt || "9").localeCompare(b.dueAt || "9"));
  const settle = (res: Result): string | null => {
    if (!res.ok) return res.error;
    setPending(null);
    return null;
  };

  const stageForm = pending?.kind === "leaving" ? (
    <div style={{ flex: 1, minWidth: 0 }}>
      <InlineForm confirm="Set leaving" onCancel={() => setPending(null)}
        fields={[{ key: "end", label: "Last working day", type: "date", initial: isoDay(ctx.now), min: isoDay(ctx.now) }, { key: "reason", label: "Reason (kept in the history)" }]}
        onSubmit={(v) => settle(store.run(ops.setStage, personId, "leaving", v.reason, v.end))} />
    </div>
  ) : pending?.kind === "pass" ? (
    <div style={{ flex: 1, minWidth: 0 }}>
      <InlineForm confirm="Pass probation" onCancel={() => setPending(null)}
        fields={[{ key: "reason", label: "Reason (kept in the history)", initial: "Probation review passed" }]}
        onSubmit={(v) => settle(store.run(ops.setStage, personId, "active", v.reason))} />
    </div>
  ) : null;

  const footer = stageForm ? stageForm : may ? (
    <>
      {(e.stage === "onboarding" || e.stage === "probation") && (
        <Button size="sm" disabled={onboarding.length > 0} title={onboarding.length ? "The onboarding checklist already exists." : undefined}
          onClick={() => store.run(ops.startChecklist, personId, "onboarding")}>{onboarding.length ? "Onboarding started" : "Start onboarding"}</Button>
      )}
      {e.stage !== "onboarding" && <Button size="sm" disabled={offboarding.length > 0} title={offboarding.length ? "The offboarding checklist already exists." : "Creates the offboarding tasks and marks them as leaving"}
        onClick={() => store.run(ops.startChecklist, personId, "offboarding")}>{offboarding.length ? "Offboarding started" : "Start offboarding"}</Button>}
      {e.stage !== "leaving" && <Button size="sm" onClick={() => setPending({ kind: "leaving" })}>Set leaving</Button>}
      {e.stage === "probation" && <Button size="sm" variant="primary" onClick={() => setPending({ kind: "pass" })}>Pass probation</Button>}
    </>
  ) : (
    <span style={{ fontSize: 12, color: "var(--faint)" }}>{isSelf ? "Your manager or an administrator changes your employment details." : why}</span>
  );

  return (
    <SidePanel open onClose={onClose} width={640} eyebrow={[r.team, r.unit].filter(Boolean).join(" · ").toUpperCase() || "PERSON"}
      chips={<Pill tone={STAGE_TONE[e.stage]}>{STAGE_LABEL[e.stage]}</Pill>}
      title={<span>{r.person.name}<span style={{ fontSize: 13, color: "var(--dim)", marginLeft: 10, fontWeight: 400 }}>{r.person.title}</span></span>}
      footer={footer}>

      <Section label="Profile">
        <KV items={[
          ["Email", r.person.email],
          ["Account", r.person.status === "active" ? "Active" : r.person.status === "invited" ? "Invited" : "Suspended"],
          ["Location", unitDef?.location || "Not set"]
        ]} />
      </Section>

      <Section label="Employment">
        <KV items={[
          ["Stage", STAGE_LABEL[e.stage]],
          ["Contract", CONTRACT_LABEL[e.contract]],
          ["Hours", e.hoursPerWeek + " a week"],
          ["Manager", e.managerId ? r.manager : "None"],
          ["Team", r.team],
          ["Unit", r.unit || "None"],
          ["Started", fmtYear(e.startDate, tz) + (r.tenureDays >= 0 ? ", " + tenureLabel(r.tenureDays) : "")],
          ["Probation ends", e.probationEnds ? fmtDate(e.probationEnds, tz) : "Not on probation"],
          ["Last day", e.endDate ? fmtDate(e.endDate, tz) : "Not set"]
        ]} />
      </Section>

      <Section label={"Certificates · " + r.certs.length}>
        {!r.certs.length ? <p className="pp-li-s">No certificates recorded.</p> : (
          <div className="pp-plist">
            {r.certs.map(({ cert, state, days }) => {
              const booked = renewalBooked(core, personId, cert.id, cert.expires);
              return (
                <div key={cert.id} className="pp-pi">
                  <div className="pp-li-main">
                    <div className="pp-li-t">{cert.name}</div>
                    <div className="pp-li-s">
                      {cert.expires ? (state === "lapsed" ? "Lapsed " : "Valid to ") + fmtYear(cert.expires, tz) + " (" + inDays(days ?? 0) + ")" : "No date recorded"}
                      {cert.renewEveryMonths ? ", renew every " + cert.renewEveryMonths + " months" : ""}
                    </div>
                  </div>
                  <Pill tone={CERT_TONE[state]}>{CERT_TEXT[state]}</Pill>
                  {may && (state !== "ok") && (booked
                    ? <span className="pp-done">Already booked</span>
                    : <Button size="sm" onClick={() => store.run(ops.bookRenewal, personId, cert.id)}>Book renewal</Button>)}
                  {may && <Button size="sm" onClick={() => setPending({ kind: "cert", id: cert.id })}>Record renewal</Button>}
                  {pending?.kind === "cert" && pending.id === cert.id && (
                    <InlineForm confirm="Save" onCancel={() => setPending(null)}
                      fields={[{ key: "exp", label: "New expiry date", type: "date",
                        initial: cert.renewEveryMonths ? isoDay(new Date(ms(ctx.now) + cert.renewEveryMonths * 30.4 * 86400000).toISOString()) : "" }]}
                      onSubmit={(v) => settle(store.run(ops.recordCertification, personId, cert.id, v.exp))} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section label={"Documents · " + e.documents.length}>
        {!e.documents.length ? <p className="pp-li-s">No documents sent for signature.</p> : (
          <div className="pp-plist">
            {e.documents.map((d) => (
              <div key={d.id} className="pp-pi">
                <div className="pp-li-main">
                  <div className="pp-li-t">{d.title}</div>
                  <div className="pp-li-s">Sent {fmtYear(d.sentAt, tz)}{d.signedAt ? ", signed " + fmtYear(d.signedAt, tz) : ""}</div>
                </div>
                {d.signedAt ? <Pill tone="ok">Signed</Pill> : <Pill tone="warn">Not signed</Pill>}
                {!d.signedAt && (may || isSelf) && <Button size="sm" onClick={() => store.run(ops.recordSignature, personId, d.id)}>Record signature</Button>}
              </div>
            ))}
          </div>
        )}
        {e.documents.some((d) => !d.signedAt) && <div className="pp-foot">No e-signature service is connected. Record a signature once the signed copy is on file.</div>}
      </Section>

      <Section label="Leave">
        {!upcoming.length && !past.length && !leaveRequests.length ? <p className="pp-li-s">No leave recorded.</p> : (
          <div className="pp-plist">
            {leaveRequests.map((x) => (
              <button key={x.id} type="button" className="pp-pi pp-link" style={{ width: "100%" }} onClick={() => openObject("request", x.id)}>
                <div className="pp-li-main"><div className="pp-li-t">{x.title}</div><div className="pp-li-s">{x.ref}, waiting for a decision</div></div>
                <Pill tone="accent">Requested</Pill>
              </button>
            ))}
            {upcoming.map((l) => (
              <div key={l.id} className="pp-pi">
                <div className="pp-li-main"><div className="pp-li-t">{LEAVE_LABEL[l.kind]}</div><div className="pp-li-s">{rangeLabel(l.from, l.to, tz)}</div></div>
                <Pill tone={ms(l.from) <= ms(ctx.now) ? "warn" : "neutral"}>{ms(l.from) <= ms(ctx.now) ? "Away now" : "Upcoming"}</Pill>
              </div>
            ))}
            {past.map((l) => (
              <div key={l.id} className="pp-pi">
                <div className="pp-li-main"><div className="pp-li-t" style={{ color: "var(--dim)" }}>{LEAVE_LABEL[l.kind]}</div><div className="pp-li-s">{rangeLabel(l.from, l.to, tz)}</div></div>
                <span className="pp-done">Taken</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label="Roles and scope" right={can(q.viewer, "settings.edit")
        ? <Button size="sm" variant="ghost" onClick={() => navigate({ page: "Settings", section: "roles" })}>Edit in Settings</Button> : undefined}>
        {!roles.length ? <p className="pp-li-s">No roles assigned.</p> : (
          <div className="pp-plist">
            {roles.map((x) => (
              <div key={x.id} className="pp-pi">
                <div className="pp-li-main"><div className="pp-li-t">{x.label}</div><div className="pp-li-s">{x.scope}</div></div>
              </div>
            ))}
          </div>
        )}
        <div className="pp-pi" style={{ border: 0, padding: "10px 0 0" }}>
          <span className="pp-li-s" style={{ flex: 1 }}>
            {e.lastAccessReview ? "Access last reviewed " + fmtDate(e.lastAccessReview, tz) : "Access never reviewed"}{r.accessReviewDue ? ", review due" : ""}
          </span>
          {(may || can(q.viewer, "settings.edit")) && <Button size="sm" onClick={() => store.run(ops.recordAccessReview, personId)}>Mark reviewed</Button>}
        </div>
      </Section>

      <Section label={"Open tasks · " + tasks.length}>
        <div className="pp-li-s" style={{ marginBottom: 8 }}>Workload, not a performance measure. {e.hoursPerWeek} contracted hours a week.</div>
        {!tasks.length ? <p className="pp-li-s">No open tasks.</p> : (
          <div className="pp-plist">
            {tasks.slice(0, 12).map((t) => (
              <button key={t.id} type="button" className="pp-pi pp-link" style={{ width: "100%" }} onClick={() => openObject("task", t.id)}>
                <div className="pp-li-main"><div className="pp-li-t">{t.title}</div>
                  <div className="pp-li-s">{t.dueAt ? "Due " + fmtDate(t.dueAt, tz) : "No due date"}</div></div>
                {q.isOverdue(t) && <Pill tone="bad">Overdue</Pill>}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section label="History">
        <History ids={[personId]} empty="No changes recorded for this person yet." />
      </Section>
    </SidePanel>
  );
}
