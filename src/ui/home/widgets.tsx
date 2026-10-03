/* Home rail widgets. Each reads the shared query layer, so every item is the
   same canonical task, approval or record shown elsewhere, and every row
   opens that object. Nothing here creates work. */

import { useState, type ReactNode } from "react";
import { useCore, store, ops, navigate, openObject, relative, fmtHours, hoursBetween, addDays, ms, type AuditEvent, type Focus, type Id } from "../../core";
import { attention, currentStage, waitingOnMe } from "../selectors";
import { Chip, Icon, ICON, LABEL } from "../kit";

export function Widget({ title, count, children, onRemove, note }: { title: string; count?: ReactNode; children: ReactNode; onRemove?: () => void; note?: ReactNode }) {
  return (
    <section className="hm-card" aria-label={title}>
      <div className="hm-card-h">
        <h3 className="hm-card-t">{title}</h3>
        {count !== undefined && <span className="hm-count">{count}</span>}
        {onRemove && (
          <button type="button" className="hm-x" onClick={onRemove} aria-label={"Hide " + title} title={"Hide " + title}>
            <Icon d={ICON.close} size={11} sw={2.4} />
          </button>
        )}
      </div>
      {note && <div className="hm-note">{note}</div>}
      <div className="hm-body">{children}</div>
    </section>
  );
}

function Blank({ children }: { children: ReactNode }) {
  return <div className="hm-empty" role="status">{children}</div>;
}

const ofN = (shown: number, total: number) => (total > shown ? shown + " of " + total : String(total));

/* ── Personal ──────────────────────────────────────────────────────────── */

export function MyWork({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const [errors, setErrors] = useState<Record<Id, string>>({});
  const me = q.viewer.person.id;
  const mine = q.tasks({ ignoreScope: true }).filter((t) => t.assigneeId === me && q.isOpenTask(t))
    .sort((a, b) => (a.dueAt || "￿").localeCompare(b.dueAt || "￿"));
  const shown = mine.slice(0, 6);
  const tz = core.config.timezone;
  const check = (id: Id) => {
    const res = store.run(ops.setTaskStatus, id, "done");
    setErrors((e) => {
      const n = { ...e };
      if (res.ok) delete n[id]; else n[id] = res.error;
      return n;
    });
  };
  return (
    <Widget title="My work" count={ofN(shown.length, mine.length)} onRemove={onRemove}>
      {shown.length === 0 ? <Blank>Nothing assigned to you yet. Tasks you claim or are given appear here.</Blank> : (
        <ul className="hm-list">
          {shown.map((t) => {
            const late = q.isOverdue(t);
            return (
              <li key={t.id} className="hm-row">
                <button type="button" className="hm-check" onClick={() => check(t.id)} aria-label={"Mark done: " + t.title} title="Mark done">
                  <Icon d={ICON.check} size={10} sw={3} />
                </button>
                <div className="pk-grow">
                  <button type="button" className="hm-link" onClick={() => openObject("task", t.id)}>{t.title}</button>
                  {errors[t.id] && <div className="hm-err" role="alert">{errors[t.id]}</div>}
                </div>
                <span className={"hm-meta" + (late ? " hm-bad" : "")}>{t.dueAt ? (late ? "Overdue, " : "") + relative(t.dueAt, ctx.now, tz) : "No due date"}</span>
              </li>
            );
          })}
        </ul>
      )}
      {mine.length > shown.length && (
        <button type="button" className="hm-more" onClick={() => navigate({ page: "Work", section: "tasks" })}>All my tasks in Work</button>
      )}
    </Widget>
  );
}

export function WaitingOnMe({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const list = waitingOnMe(q).sort((a, b) => (currentStage(a)?.dueAt || "￿").localeCompare(currentStage(b)?.dueAt || "￿"));
  const shown = list.slice(0, 5);
  return (
    <Widget title="Decisions waiting on you" count={ofN(shown.length, list.length)} onRemove={onRemove}>
      {shown.length === 0 ? <Blank>No decisions are waiting on you.</Blank> : (
        <ul className="hm-list">
          {shown.map((a) => {
            const req = q.request(a.requestId);
            const st = currentStage(a);
            const since = st?.startedAt || a.submittedAt;
            const late = !!st?.dueAt && ms(st.dueAt) < ms(ctx.now);
            return (
              <li key={a.id}>
                <button type="button" className="hm-row hm-row--btn" onClick={() => openObject("approval", a.id)}>
                  <div className="pk-grow">
                    <div className="hm-title"><span className="pk-mono hm-ref">{req?.ref}</span> {req?.title || "Request"}</div>
                    <div className="hm-sub">{st?.label || "Decision"}, waiting since {relative(since, ctx.now, tz)}</div>
                  </div>
                  <span className={"hm-meta" + (late ? " hm-bad" : "")}>{st?.dueAt ? (late ? "Late, was due " : "Due ") + relative(st.dueAt, ctx.now, tz) : "No deadline"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

const OPENABLE: Partial<Record<AuditEvent["objectType"], Focus["kind"]>> = {
  record: "record", task: "task", request: "request", approval: "approval", run: "run", schedule: "schedule", issue: "issue", file: "file"
};

export function Briefing({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const from = addDays(ctx.now, -1);
  const recent = q.events().filter((e) => e.at > from && e.at <= ctx.now).sort((a, b) => b.at.localeCompare(a.at));
  const shown = recent.slice(0, 5);
  const open = (e: AuditEvent) => {
    const kind = OPENABLE[e.objectType];
    if (kind) openObject(kind, e.objectId);
    else if (e.recordIds[0]) openObject("record", e.recordIds[0]);
    else openObject("event", e.id);
  };
  return (
    <Widget title="Briefing" count={ofN(shown.length, recent.length)} onRemove={onRemove}
      note="Summary of recorded events in this scope over the last 24 hours. Not written by AI.">
      {shown.length === 0 ? <Blank>Nothing was recorded in this scope in the last 24 hours.</Blank> : (
        <ul className="hm-list">
          {shown.map((e) => (
            <li key={e.id}>
              <button type="button" className="hm-row hm-row--btn" onClick={() => open(e)}>
                <div className="pk-grow">
                  <div className="hm-title hm-wrap">{e.summary}</div>
                  <div className="hm-sub">{q.name(e.actorId)}{e.simulated ? ", sample only" : ""}</div>
                </div>
                <span className="hm-meta">{relative(e.at, ctx.now, tz)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 && <button type="button" className="hm-more" onClick={() => navigate({ page: "Activity", section: "all" })}>All activity</button>}
    </Widget>
  );
}

/* ── Management ────────────────────────────────────────────────────────── */

const KIND: Record<string, string> = { run: "Run failed", execution: "Action failed", task: "Overdue", approval: "Decision late", issue: "Data issue", blocked: "Blocked" };

export function Priorities({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const all = attention(q);
  const top = all.slice(0, 5);
  return (
    <Widget title="Priorities" count={ofN(top.length, all.length)} onRemove={onRemove}>
      {top.length === 0 ? <Blank>Nothing needs attention in this scope.</Blank> : (
        <ol className="hm-list">
          {top.map((it) => (
            <li key={it.key} className="hm-row hm-row--stack">
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Chip tone={it.tone}>{KIND[it.kind]}</Chip>
                <span className="hm-meta">{it.kind === "task" || it.kind === "approval" ? "Due " : "Since "}{relative(it.since, ctx.now, tz)}</span>
              </div>
              <div className="hm-title hm-wrap">{it.title}</div>
              <div className="hm-sub hm-wrap">{it.reason} · Responsible: {q.name(it.ownerId)}</div>
              <div><button type="button" className="pk-btn pk-btn--sm" onClick={() => openObject(it.objectKind, it.id)}>{it.next}</button></div>
            </li>
          ))}
        </ol>
      )}
      {all.length > top.length && <button type="button" className="hm-more" onClick={() => navigate({ page: "Activity", section: "attention" })}>All {all.length} in Activity</button>}
    </Widget>
  );
}

export function TeamDecisions({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const mineIds = new Set(waitingOnMe(q).map((a) => a.id));
  const pending = q.approvals().filter((a) => a.status === "pending" && currentStage(a))
    .sort((a, b) => Number(mineIds.has(b.id)) - Number(mineIds.has(a.id))
      || (currentStage(a)!.startedAt || a.submittedAt).localeCompare(currentStage(b)!.startedAt || b.submittedAt));
  const shown = pending.slice(0, 5);
  return (
    <Widget title="Decisions" count={ofN(shown.length, pending.length)} onRemove={onRemove}>
      {shown.length === 0 ? <Blank>No decisions are pending in this scope.</Blank> : (
        <ul className="hm-list">
          {shown.map((a) => {
            const req = q.request(a.requestId);
            const st = currentStage(a)!;
            const since = st.startedAt || a.submittedAt;
            const mine = mineIds.has(a.id);
            const late = !!st.dueAt && ms(st.dueAt) < ms(ctx.now);
            return (
              <li key={a.id}>
                <button type="button" className="hm-row hm-row--btn" onClick={() => openObject("approval", a.id)}>
                  <div className="pk-grow">
                    <div className="hm-title"><span className="pk-mono hm-ref">{req?.ref}</span> {req?.title || "Request"}</div>
                    <div className="hm-sub">{mine ? "With you" : "With " + q.name(st.assigneeId)}, waited {fmtHours(hoursBetween(since, ctx.now))}</div>
                  </div>
                  {late ? <Chip tone="warn">Late</Chip> : <span className="hm-meta">{st.dueAt ? "Due " + relative(st.dueAt, ctx.now, tz) : ""}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

export function TeamExceptions({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const v = q.viewer;
  const sel = ctx.scope;
  const teams = core.config.teams.filter((t) =>
    sel.kind === "team" ? t.id === sel.id
      : sel.kind === "unit" ? t.unitId === sel.id
        : v.isOrgWide || v.overseenTeamIds.includes(t.id) || v.memberTeamIds.includes(t.id));
  const tasks = q.tasks();
  const rows = teams.map((t) => {
    const own = tasks.filter((x) => x.teamId === t.id);
    const overdue = own.filter((x) => q.isOverdue(x));
    const blocked = own.filter((x) => q.isOpenTask(x) && q.blockers(x).length > 0);
    /* Work opens one task per hand-off, so the most overdue comes first. */
    const byDue = (a: { dueAt?: string }, b: { dueAt?: string }) => (a.dueAt || "\uffff").localeCompare(b.dueAt || "\uffff");
    const ids = [...new Set([...overdue.sort(byDue), ...blocked.sort(byDue)].map((x) => x.id))];
    return { t, overdue: overdue.length, blocked: blocked.length, ids };
  });
  const T = core.config.terminology;
  return (
    <Widget title={T.team + " exceptions"} count={rows.filter((r) => r.ids.length).length + " of " + rows.length} onRemove={onRemove}>
      {rows.length === 0 ? <Blank>No {T.teams.toLowerCase()} in this scope yet. An administrator can add them in Settings.</Blank> : (
        <ul className="hm-list">
          {rows.map((r) => (
            <li key={r.t.id}>
              <button type="button" className="hm-row hm-row--btn" disabled={!r.ids.length}
                title={r.ids.length ? "Opens the most urgent of these tasks in Work" : "Nothing overdue or blocked"}
                onClick={() => openObject("task", r.ids[0])}>
                <div className="pk-grow"><div className="hm-title">{r.t.label}</div></div>
                {r.ids.length === 0 ? <span className="hm-meta">No exceptions</span> : (
                  <span style={{ display: "flex", gap: 6 }}>
                    {r.overdue > 0 && <Chip tone="bad">{r.overdue} overdue</Chip>}
                    {r.blocked > 0 && <Chip tone="warn">{r.blocked} blocked</Chip>}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

export function Upcoming({ onRemove }: { onRemove?: () => void }) {
  const { core, ctx, q } = useCore();
  const tz = core.config.timezone;
  const end = addDays(ctx.now, 7);
  const inWindow = (at?: string) => !!at && at > ctx.now && at <= end;
  type Item = { key: string; at: string; title: string; sub: string; open: () => void };
  const items: Item[] = [];
  for (const t of q.tasks()) {
    if (q.isOpenTask(t) && inWindow(t.dueAt)) items.push({ key: "t" + t.id, at: t.dueAt!, title: t.title, sub: "Task, " + LABEL.task[t.status].toLowerCase() + ", " + q.name(t.assigneeId), open: () => openObject("task", t.id) });
  }
  for (const a of q.approvals()) {
    const st = currentStage(a);
    if (a.status === "pending" && st && inWindow(st.dueAt)) {
      const req = q.request(a.requestId);
      items.push({ key: "a" + a.id, at: st.dueAt!, title: (req?.ref ? req.ref + " " : "") + (req?.title || "Request"), sub: "Decision, " + st.label + ", " + q.name(st.assigneeId), open: () => openObject("approval", a.id) });
    }
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  const shown = items.slice(0, 6);
  return (
    <Widget title="Upcoming deadlines" count={ofN(shown.length, items.length)} onRemove={onRemove} note="Tasks and decision stages due in the next 7 days.">
      {shown.length === 0 ? <Blank>Nothing is due in this scope in the next 7 days.</Blank> : (
        <ul className="hm-list">
          {shown.map((it) => (
            <li key={it.key}>
              <button type="button" className="hm-row hm-row--btn" onClick={it.open}>
                <div className="pk-grow">
                  <div className="hm-title">{it.title}</div>
                  <div className="hm-sub">{it.sub}</div>
                </div>
                <span className="hm-meta">{relative(it.at, ctx.now, tz)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
