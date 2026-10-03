/* Supporting panels under the people list. Each one answers a question a
   manager of a 50 to 250 person organisation asks every week, from the same
   rows the list uses: who is away, what lapses, whose probation ends, who is
   joining or leaving, what is unsigned, how work is spread, whose access needs
   a second look. */

import { useState } from "react";
import { useCore, ops, store, navigate, fmtDate, leaveInWindow, can } from "../../core";
import type { Id } from "../../core";
import type { PersonRow } from "../../core/people";
import { Btn, Panel, Pill } from "../frame";
import { InlineForm, PanelEmpty } from "./bits";
import {
  LEAVE_LABEL, canManage, checklistTasks, daysFrom, inDays, rangeLabel, renewalBooked, rolesOf, shortDoc
} from "./util";

type Open = (personId: Id) => void;

function Who({ r, onOpen, sub }: { r: PersonRow; onOpen: Open; sub?: string }) {
  const { q } = useCore();
  return (
    <>
      <span className="pp-av" style={{ width: 30, height: 30, fontSize: 10.5 }} aria-hidden="true">{q.initials(r.person.id)}</span>
      <div className="pp-li-main">
        <button type="button" className="pp-link pp-li-t" onClick={() => onOpen(r.person.id)}>{r.person.name}</button>
        {sub && <div className="pp-li-s">{sub}</div>}
      </div>
    </>
  );
}

/* ── Who's away ─────────────────────────────────────────────────────────── */

export function AwayPanel({ onOpen }: { onOpen: Open }) {
  const { core, q, ctx } = useCore();
  const tz = core.config.timezone;
  const all = leaveInWindow(q, 0, 14);
  const now = ctx.now;
  const today = all.filter((x) => x.entry.from <= now && x.entry.to >= now);
  const soon = all.filter((x) => x.entry.from > now);
  const line = (x: (typeof all)[number]) => (
    <div key={x.entry.id} className="pp-li">
      <Who r={x.row} onOpen={onOpen} sub={LEAVE_LABEL[x.entry.kind] + ", " + x.row.team} />
      <span className="pp-done">{rangeLabel(x.entry.from, x.entry.to, tz)}</span>
    </div>
  );
  return (
    <Panel title="Who's away" meta="Approved leave, today and the next 14 days">
      {!all.length ? <PanelEmpty>Nobody is away in the next 14 days.</PanelEmpty> : (
        <div className="pp-list">
          <div className="pp-sub">Today · {today.length}</div>
          {today.length ? today.map(line) : <div className="pp-li-s" style={{ padding: "4px 0 8px" }}>Everyone is in today.</div>}
          {soon.length > 0 && <div className="pp-sub">Next 14 days · {soon.length}</div>}
          {soon.map(line)}
        </div>
      )}
      <div className="pp-foot">Leave appears here once its request is approved.</div>
    </Panel>
  );
}

/* ── Certificates ───────────────────────────────────────────────────────── */

export function CertsPanel({ rows, onOpen }: { rows: PersonRow[]; onOpen: Open }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const items = rows.flatMap((r) => r.certs.filter((c) => c.state === "lapsed" || c.state === "due").map((c) => ({ r, c })))
    .sort((a, b) => (a.c.days ?? 0) - (b.c.days ?? 0));
  return (
    <Panel title="Certificates lapsed or due in 30 days" meta={items.length ? items.length + " to renew" : "Required training and certificates"}>
      {!items.length ? <PanelEmpty>Every recorded certificate is in date for at least 30 days.</PanelEmpty> : (
        <div className="pp-list">
          {items.map(({ r, c }) => {
            const booked = renewalBooked(core, r.person.id, c.cert.id, c.cert.expires);
            const lapsed = c.state === "lapsed";
            const may = canManage(q, r.e);
            return (
              <div key={r.person.id + c.cert.id} className="pp-li">
                <Who r={r} onOpen={onOpen} sub={c.cert.name + ", " + (lapsed ? "lapsed " : "expires ") + fmtDate(c.cert.expires || undefined, tz)} />
                <Pill tone={lapsed ? "bad" : "warn"}>{lapsed ? "Lapsed" : "Due"} {inDays(c.days ?? 0)}</Pill>
                {booked ? <span className="pp-done" title="A renewal task already exists for this certificate.">Already booked</span>
                  : <Btn small disabled={!may} title={may ? "Creates a renewal task for their manager" : "Only their manager or an administrator can book this."}
                      onClick={() => store.run(ops.bookRenewal, r.person.id, c.cert.id)}>Book renewal</Btn>}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ── Probation reviews ──────────────────────────────────────────────────── */

export function ProbationPanel({ rows, onOpen }: { rows: PersonRow[]; onOpen: Open }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const [passing, setPassing] = useState<Id | null>(null);
  const items = rows.filter((r) => r.e.stage === "probation").sort((a, b) => (a.probationDueDays ?? 999) - (b.probationDueDays ?? 999));
  return (
    <Panel title="Probation reviews due" meta={"Probation runs " + core.config.people.probationMonths + " months"}>
      {!items.length ? <PanelEmpty>Nobody is on probation.</PanelEmpty> : (
        <div className="pp-list">
          {items.map((r) => {
            const d = r.probationDueDays;
            const may = canManage(q, r.e);
            return (
              <div key={r.person.id} className="pp-wrap">
                <div className="pp-li">
                  <Who r={r} onOpen={onOpen} sub={r.e.probationEnds ? "Review by " + fmtDate(r.e.probationEnds, tz) : "No review date set"} />
                  {d !== null && <Pill tone={d < 0 ? "bad" : d <= 30 ? "warn" : "neutral"}>{d < 0 ? "Overdue " + -d + " d" : inDays(d)}</Pill>}
                  <Btn small disabled={!may} title={may ? undefined : "Only their manager or an administrator can do this."}
                    onClick={() => setPassing(passing === r.person.id ? null : r.person.id)}>Pass probation</Btn>
                </div>
                {passing === r.person.id && (
                  <InlineForm confirm="Confirm" onCancel={() => setPassing(null)}
                    fields={[{ key: "reason", label: "Reason (kept in the history)", initial: "Probation review passed" }]}
                    onSubmit={(v) => {
                      const res = store.run(ops.setStage, r.person.id, "active", v.reason);
                      if (!res.ok) return res.error;
                      setPassing(null);
                      return null;
                    }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ── Onboarding and offboarding ─────────────────────────────────────────── */

export function JoinersPanel({ rows, onOpen }: { rows: PersonRow[]; onOpen: Open }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const items = rows.filter((r) => r.e.stage === "onboarding" || r.e.stage === "leaving");
  return (
    <Panel title="Onboarding and offboarding" meta="Checklist progress from the tasks each checklist created">
      {!items.length ? <PanelEmpty>Nobody is joining or leaving right now.</PanelEmpty> : (
        <div className="pp-list">
          {items.map((r) => {
            const which = r.e.stage === "onboarding" ? "onboarding" as const : "offboarding" as const;
            const tasks = checklistTasks(core, r.person.id, which);
            const done = tasks.filter((t) => t.status === "done").length;
            const may = canManage(q, r.e);
            const when = which === "onboarding" ? "Starts " + fmtDate(r.e.startDate, tz) : "Last day " + (r.e.endDate ? fmtDate(r.e.endDate, tz) : "not set");
            return (
              <div key={r.person.id} className="pp-li" style={{ alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <Who r={r} onOpen={onOpen} sub={(which === "onboarding" ? "Joining, " : "Leaving, ") + when} />
                </div>
                {tasks.length ? (
                  <div style={{ width: 120, flex: "none" }}>
                    <div className="pp-done" style={{ textAlign: "right" }}>{done} of {tasks.length} done</div>
                    <div className="pp-bar" style={{ width: Math.max(4, Math.round((100 * done) / tasks.length)) + "%", marginLeft: "auto",
                      background: done === tasks.length ? "var(--ok)" : "var(--accent)" }} />
                  </div>
                ) : (
                  <Btn small disabled={!may} title={may ? "Creates one task per checklist item for their manager" : "Only their manager or an administrator can start this."}
                    onClick={() => store.run(ops.startChecklist, r.person.id, which)}>Start checklist</Btn>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ── Documents to sign ──────────────────────────────────────────────────── */

export function DocsPanel({ rows, onOpen }: { rows: PersonRow[]; onOpen: Open }) {
  const { core, q, ctx } = useCore();
  const tz = core.config.timezone;
  const items = rows.flatMap((r) => r.e.documents.filter((d) => !d.signedAt).map((d) => ({ r, d })))
    .sort((a, b) => a.d.sentAt.localeCompare(b.d.sentAt));
  return (
    <Panel title="Documents to sign" meta={items.length ? items.length + " outstanding" : "Contracts, handbooks and policies"}>
      {!items.length ? <PanelEmpty>Everything sent has been signed.</PanelEmpty> : (
        <div className="pp-list">
          {items.map(({ r, d }) => {
            const may = r.person.id === ctx.viewerId || canManage(q, r.e);
            const age = -daysFrom(d.sentAt, ctx.now);
            return (
              <div key={d.id} className="pp-li">
                <Who r={r} onOpen={onOpen} sub={shortDoc(d.title) + ", sent " + fmtDate(d.sentAt, tz)} />
                <Pill tone={age > 14 ? "warn" : "neutral"}>{age} d</Pill>
                <Btn small disabled={!may} title={may ? "Record that you hold the signed copy" : "Only the person, their manager or an administrator can record this."}
                  onClick={() => store.run(ops.recordSignature, r.person.id, d.id)}>Record signature</Btn>
              </div>
            );
          })}
        </div>
      )}
      <div className="pp-foot">No e-signature service is connected. Record a signature once the signed copy is on file.</div>
    </Panel>
  );
}

/* ── Workload ───────────────────────────────────────────────────────────── */

export function WorkloadPanel({ rows, onOpen }: { rows: PersonRow[]; onOpen: Open }) {
  const items = [...rows].sort((a, b) => b.openTasks - a.openTasks || b.overdueTasks - a.overdueTasks).slice(0, 8);
  const max = Math.max(1, ...items.map((r) => r.openTasks));
  return (
    <Panel title="Workload by person" meta="Open and overdue tasks next to contracted hours. Not a performance measure.">
      {!items.length ? <PanelEmpty>No one in this view.</PanelEmpty> : (
        <div className="pp-list">
          {items.map((r) => (
            <div key={r.person.id} className="pp-li">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <Who r={r} onOpen={onOpen} sub={r.e.hoursPerWeek + " h/wk contracted" + (r.awayNow ? ", away now" : "")} />
              </div>
              <div style={{ width: 132, flex: "none", textAlign: "right" }}>
                <div style={{ fontSize: 12.5, color: "var(--body)", whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: "var(--mono)" }}>{r.openTasks}</span> open
                  {r.overdueTasks > 0 && <span style={{ color: "var(--bad)" }}>, <span style={{ fontFamily: "var(--mono)" }}>{r.overdueTasks}</span> overdue</span>}
                </div>
                {r.openTasks > 0 && <div className="pp-bar" style={{ width: Math.round((100 * r.openTasks) / max) + "%", marginLeft: "auto", background: "var(--neutral)" }} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {rows.length > items.length && <div className="pp-foot">Showing the 8 people with the most open tasks.</div>}
    </Panel>
  );
}

/* ── Access review ──────────────────────────────────────────────────────── */

export function AccessPanel({ rows, onOpen }: { rows: PersonRow[]; onOpen: Open }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const items = rows.filter((r) => r.accessReviewDue);
  const admin = can(q.viewer, "settings.edit");
  return (
    <Panel title="Access review due" meta={"Roles reviewed less recently than every " + core.config.people.accessReviewEveryDays + " days"}
      right={<Btn small onClick={() => navigate({ page: "Settings", section: "roles" })}>Roles in Settings</Btn>}>
      {!items.length ? <PanelEmpty>Every access review is up to date.</PanelEmpty> : (
        <div className="pp-list">
          {items.map((r) => {
            const roles = rolesOf(core, r.person.id);
            const may = admin || canManage(q, r.e);
            const last = r.e.lastAccessReview ? "last reviewed " + fmtDate(r.e.lastAccessReview, tz) : "never reviewed";
            return (
              <div key={r.person.id} className="pp-li">
                <Who r={r} onOpen={onOpen} sub={(roles.map((x) => x.label + " (" + x.scope + ")").join(", ") || "No roles") + ", " + last} />
                <Btn small disabled={!may} title={may ? "Record that you checked their roles and scope" : "Only a manager or an administrator can review access."}
                  onClick={() => store.run(ops.recordAccessReview, r.person.id)}>Mark reviewed</Btn>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

