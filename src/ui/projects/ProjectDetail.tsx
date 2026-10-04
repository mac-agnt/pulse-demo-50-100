/* One project as a full page inside Projects. Focused tabs: Overview, Plan,
   Tasks, Budget (Finance only), Risks and decisions, Files and updates. The
   back link returns to the list with its filters and scroll position kept. */

import { useState, type ReactNode } from "react";
import {
  budgetPosition, can, fmtMoney, pageLabel, latestProjectUpdate, milestoneGate, milestoneSlipDays, moduleEnabled, ms, nextMilestoneOf, openObject,
  projectDay, projectHealth, projectPhaseLabel, projectProgress, projectTasks, projectTypeOf, store, updateProject, addProjectTask, projectFor,
  PROJECT_HEALTH_LABEL, PROJECT_STATUS_LABEL, STAGE_DEFINITIONS, type Project, type ProjectPatch, type Task
} from "../../core";
import { Btn, Pill, eyebrowOf } from "../frame";
import {
  Button, Chip, DataTable, Empty, Field, Icon, KV, LABEL, NoAccess, Notice, Overflow, PersonName, Select, SidePanel, Tabs, TextArea, TextInput, toneOf,
  type Column
} from "../kit";
import { TaskPanel } from "../work/TaskPanel";
import type { PanelState } from "../work/shared";
import { PlanTab } from "./PlanTab";
import { RisksTab } from "./RisksTab";
import { FilesTab, UpdatePanel } from "./FilesTab";
import { BACK_ICON, dayInput, Faint, HealthChip, ProgressBar, reasonsText, SlipChip, useProjectsCtx, type DetailTab } from "./shared";

export function ProjectDetail({ id, tab, setTab, onBack, backLabel, focusMilestone }: {
  id: string; tab: DetailTab; setTab: (t: DetailTab) => void; onBack: () => void; backLabel: string; focusMilestone?: string | null;
}) {
  const { core, q, T, d, now } = useProjectsCtx();
  const [panel, setPanel] = useState<"update" | "edit" | null>(null);
  const p = projectFor(q, id);
  const back = (
    <button type="button" className="pj-back" onClick={onBack}><Icon d={BACK_ICON} size={14} sw={2} />Back to {backLabel}</button>
  );
  if (!p) {
    const exists = core.data.projects.some((x) => x.id === id);
    return <>{back}<Empty title={exists ? "Not available to you" : T.one + " not found"} body={exists ? "You cannot see this " + T.oneLower + ". Its owner or an administrator can give you access through its team." : "It may have been removed."} /></>;
  }
  const h = projectHealth(core, p, now);
  const financeOn = moduleEnabled(core.config, "finance");
  const type = projectTypeOf(core.config, p.typeId);
  const tabs: { value: DetailTab; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    { value: "plan", label: "Plan", count: core.data.milestones.filter((m) => m.projectId === p.id).length },
    { value: "tasks", label: "Tasks", count: projectTasks(core, p.id).filter((t) => t.status !== "done" && t.status !== "cancelled").length },
    ...(financeOn ? [{ value: "budget" as const, label: "Budget" }] : []),
    { value: "risks", label: "Risks and decisions", count: core.data.risks.filter((r) => r.projectId === p.id && r.state !== "closed").length },
    { value: "files", label: "Files and updates" }
  ];
  const cur = tabs.some((t) => t.value === tab) ? tab : "overview";
  const canChange = canChangeProject(p);

  function canChangeProject(pr: Project) {
    const v = q.viewer;
    if (pr.ownerId === v.person.id || (can(v, "projects.manage") && v.isOrgWide)) return true;
    const unitId = pr.unitId || core.config.teams.find((t) => t.id === pr.teamId)?.unitId;
    return can(v, "projects.manage") && ((!!pr.teamId && v.overseenTeamIds.includes(pr.teamId)) || (!!unitId && v.overseenUnitIds.includes(unitId)));
  }

  return (
    <>
      {back}
      <header className="pj-dhead">
        <div className="pj-dhead-main">
          <div className="pf-eyebrow">{eyebrowOf(pageLabel(core.config, "Projects"), p.ref, type?.label)}</div>
          <h1 className="pj-dtitle">{p.title}</h1>
          <div className="pj-dmeta">
            <Pill tone="accent">{projectPhaseLabel(core.config, p, p.phaseId)}</Pill>
            <HealthChip health={h.health} prefix="Computed: " title={reasonsText(h)} />
            <span className={"pj-reported" + (h.differs ? " pj-reported--differs" : "")}>Owner reports {h.reported ? PROJECT_HEALTH_LABEL[h.reported].toLowerCase() : "nothing yet"}</span>
            <span className="pj-faint">Owner</span><PersonName id={p.ownerId} />
            <span className="pj-faint pj-mono">{d(p.startDate)} to {d(p.endDate)}</span>
            {p.status !== "active" && <Chip tone="neutral">{PROJECT_STATUS_LABEL[p.status]}</Chip>}
          </div>
        </div>
        <div className="pj-dhead-side">
          <Btn primary onClick={() => setPanel("update")} disabled={!canChange} title={canChange ? undefined : "Only the owner or a manager of its team can post updates"}>Post update</Btn>
          <Overflow items={[
            { label: "Edit details", onClick: () => setPanel("edit"), disabled: !canChange },
            { label: "Open plan", onClick: () => setTab("plan") },
            { label: "Comment", onClick: () => setTab("files") }
          ]} />
        </div>
      </header>
      <div className="pj-tabs"><Tabs tabs={tabs} value={cur} onChange={setTab} /></div>
      <div className="pj-tabbody">
        {cur === "overview" && <Overview p={p} goPlan={() => setTab("plan")} />}
        {cur === "plan" && <PlanTab p={p} canChange={canChange} focusMilestone={focusMilestone} />}
        {cur === "tasks" && <TasksTab p={p} canChange={canChange} />}
        {cur === "budget" && financeOn && <BudgetTab p={p} canChange={canChange} />}
        {cur === "risks" && <RisksTab p={p} canChange={canChange} />}
        {cur === "files" && <FilesTab p={p} canChange={canChange} onPostUpdate={() => setPanel("update")} />}
      </div>
      {panel === "update" && <UpdatePanel p={p} onClose={() => setPanel(null)} />}
      {panel === "edit" && <EditPanel p={p} onClose={() => setPanel(null)} />}
    </>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────── */

function Overview({ p, goPlan }: { p: Project; goPlan: () => void }) {
  const { core, q, T, d, now } = useProjectsCtx();
  const h = projectHealth(core, p, now);
  const pr = projectProgress(core, p);
  const next = nextMilestoneOf(core, p.id);
  const gate = next ? milestoneGate(core, next) : null;
  const upd = latestProjectUpdate(core, p.id);
  const tpl = p.template ? core.config.projects.templates.find((t) => t.id === p.template!.id) : undefined;
  const where = p.teamId ? q.teamLabel(p.teamId) + (p.unitId || q.unitLabel(core.config.teams.find((t) => t.id === p.teamId)?.unitId) ? ", " + q.unitLabel(p.unitId || core.config.teams.find((t) => t.id === p.teamId)?.unitId) : "")
    : p.unitId ? q.unitLabel(p.unitId) : "Whole " + core.config.terminology.organisation.toLowerCase();
  const loc = p.locationId ? core.config.locations.find((l) => l.id === p.locationId)?.label : undefined;
  return (
    <div className="pj-ov">
      <div className="pj-col">
        <section className="pj-box">
          <div className="pk-eyebrow">Objective</div>
          <p className="pj-text">{p.objective || <Faint>No objective written yet.</Faint>}</p>
          <KV items={[
            ["Accountable owner", <PersonName id={p.ownerId} />],
            ["Belongs to", where],
            ...(loc ? [["Location", loc] as [string, ReactNode]] : []),
            ["Dates", d(p.startDate) + " to " + d(p.endDate)],
            ["Phase", projectPhaseLabel(core.config, p, p.phaseId)],
            ["Status", PROJECT_STATUS_LABEL[p.status]],
            ["Template", p.template ? (tpl?.label || p.template.id) + ", version " + p.template.version + (tpl && tpl.version > p.template.version ? " (template now version " + tpl.version + ")" : "") : "None"]
          ]} />
        </section>
        <section className="pj-box">
          <div className="pk-eyebrow">Progress</div>
          <div style={{ margin: "10px 0 6px" }}><ProgressBar pr={pr} wide /></div>
          <div className="pj-text">{pr.basisLabel}: {pr.text}.</div>
          {pr.excluded.map((x) => <div key={x} className="pj-faint">Left out: {x}.</div>)}
          <div className="pj-faint" style={{ marginTop: 4 }}>{pr.note} The basis is set in Settings, {T.one} types and phases.</div>
        </section>
        <section className="pj-box">
          <div className="pk-eyebrow">Latest update</div>
          {upd ? (
            <>
              <p className="pj-text">{upd.text}</p>
              <div className="pj-faint" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <PersonName id={upd.by} /><span>{d(upd.at)}</span><HealthChip health={upd.health} prefix="Reported: " />
              </div>
            </>
          ) : <p className="pj-text"><Faint>No update yet. The owner posts dated updates from the top of this page.</Faint></p>}
        </section>
      </div>
      <div className="pj-col">
        <section className="pj-box">
          <div className="pk-eyebrow">Health</div>
          <div className="pj-healthrow">
            <div><div className="pj-faint">Computed</div><HealthChip health={h.health} /></div>
            <div><div className="pj-faint">Owner reports</div><HealthChip health={h.reported} /></div>
          </div>
          {h.reasons.length ? (
            <ul className="pj-reasons">{h.reasons.map((r, i) => <li key={i} className={"pj-reason pj-reason--" + r.level}>{r.text}</li>)}</ul>
          ) : <div className="pj-faint" style={{ marginTop: 8 }}>{reasonsText(h)}</div>}
          {h.differs && <Notice tone="warn">Computed and reported health differ. Both are kept: the computed view does not overwrite what the owner reported.</Notice>}
          <div className="pj-faint" style={{ marginTop: 8 }}>At risk when the next milestone slips {core.config.projects.atRiskSlipDays} days or more, a task is overdue, a gate is unsatisfied within 14 days, or a high risk is open. Off track when a milestone is overdue.</div>
        </section>
        <section className="pj-box">
          <div className="pk-eyebrow">Next milestone</div>
          {next ? (
            <>
              <div className="pj-ms-title">{next.label}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                <span className="pj-mono" style={{ color: ms(next.dueAt) < ms(now) ? "var(--bad)" : undefined }}>Due {d(next.dueAt)}</span>
                <SlipChip days={milestoneSlipDays(core, next)} />
                {milestoneSlipDays(core, next) !== 0 && <span className="pj-faint">baseline {d(next.baselineAt)}</span>}
              </div>
              {gate && (
                <div className="pj-gatebox">
                  <div><b>Gate:</b> {gate.label} <Chip tone={gate.satisfied ? "ok" : "warn"}>{gate.satisfied ? "Satisfied" : gate.missing.length + " of " + gate.items.length + " outstanding"}</Chip></div>
                  {gate.items.map((it) => <div key={it.obligationId} className="pj-faint">{it.label}: {it.ok ? "approved" : it.state === "not_found" ? "not set up in Standards" : it.state.replace("_", " ")}</div>)}
                </div>
              )}
              <div style={{ marginTop: 10 }}><Button size="sm" onClick={goPlan}>Open plan</Button></div>
            </>
          ) : <Faint>No open milestones.</Faint>}
        </section>
      </div>
    </div>
  );
}

/* ── Tasks ─────────────────────────────────────────────────────────────── */

function TasksTab({ p, canChange }: { p: Project; canChange: boolean }) {
  const { core, q, T, d } = useProjectsCtx();
  const [which, setWhich] = useState<"open" | "all" | "done">("open");
  const [ms0, setMs] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const all = projectTasks(core, p.id);
  const visible = all.map((t) => q.task(t.id)).filter((t): t is Task => !!t);
  const hidden = all.length - visible.length;
  const open = (t: Task) => t.status !== "done" && t.status !== "cancelled";
  const rows = visible.filter((t) => (which === "all" || (which === "open" ? open(t) : t.status === "done")) && (!ms0 || t.milestoneId === ms0));
  const milestones = core.data.milestones.filter((m) => m.projectId === p.id);
  const est = all.filter((t) => t.status !== "cancelled" && typeof t.estimateHours === "number");
  const live = all.filter((t) => t.status !== "cancelled");

  const onOpen = (ps: PanelState | null) => {
    if (!ps?.id) return;
    if (ps.kind === "task") setTaskId(ps.id);
    else if (ps.kind === "approval" || ps.kind === "request" || ps.kind === "run" || ps.kind === "schedule") openObject(ps.kind, ps.id);
  };

  const columns: Column<Task>[] = [
    { key: "title", label: "Task", strong: true, priority: 1, width: "30%", value: (t) => t.title,
      render: (t) => <span className="pj-cell2"><span>{t.title}</span><span>{projectPhaseLabel(core.config, p, t.phaseId)}</span></span> },
    { key: "who", label: "Assignee", priority: 1, value: (t) => q.name(t.assigneeId), render: (t) => t.assigneeId ? <PersonName id={t.assigneeId} /> : <Faint>{q.teamLabel(t.teamId)} queue</Faint> },
    { key: "due", label: "Due", priority: 2, value: (t) => t.dueAt || "", render: (t) => <span style={{ color: q.isOverdue(t) ? "var(--bad)" : undefined }}>{t.dueAt ? d(t.dueAt) : "No date"}{q.isOverdue(t) ? ", overdue" : ""}</span> },
    { key: "status", label: "Status", priority: 1, value: (t) => t.status, render: (t) => <Chip tone={toneOf.task(t.status, q.isOverdue(t))}>{LABEL.task[t.status]}</Chip> },
    { key: "ms", label: "Milestone", priority: 3, value: (t) => milestones.find((m) => m.id === t.milestoneId)?.label || "",
      render: (t) => milestones.find((m) => m.id === t.milestoneId)?.label || <Faint>None</Faint> },
    { key: "est", label: "Estimate", priority: 3, align: "right", value: (t) => t.estimateHours ?? null, render: (t) => typeof t.estimateHours === "number" ? t.estimateHours + " h" : <Faint>Unestimated</Faint> },
    { key: "block", label: "Blocked by", priority: 3, value: (t) => q.blockers(t).length,
      render: (t) => { const b = q.blockers(t); return b.length ? <span title={b.map((x) => x.title).join(", ")} style={{ color: "var(--warn)" }}>{b.length} open</span> : <Faint>None</Faint>; } },
    { key: "ev", label: "Evidence", priority: 3, align: "right", value: (t) => t.evidenceFileIds.length, render: (t) => t.evidenceFileIds.length || <Faint>None</Faint> }
  ];

  return (
    <>
      <div className="pj-tabhead">
        <div className="pj-faint">
          These are the same tasks people see in Work. {live.length} tasks; {est.length} estimated ({est.reduce((n, t) => n + (t.estimateHours || 0), 0)} h), {live.length - est.length} unestimated.
          {hidden > 0 && " " + hidden + " task" + (hidden === 1 ? " is" : "s are") + " in teams you cannot see, so " + (hidden === 1 ? "it is" : "they are") + " counted but not listed."}
        </div>
        <Button variant="primary" onClick={() => setAdding(true)} disabled={!canChange} title={canChange ? undefined : "Only the owner or a manager of its team can add tasks"}>Add task</Button>
      </div>
      <div className="pj-table">
        <DataTable rows={rows} columns={columns} rowKey={(t) => t.id} onOpen={(t) => setTaskId(t.id)} selectedKey={taskId} caption={T.one + " tasks"}
          searchText={(t) => t.title + " " + q.name(t.assigneeId)} searchPlaceholder="Search tasks" pageSize={10}
          toolbarLeft={<>
            <Select ariaLabel="Which tasks" value={which} onChange={(x) => setWhich(x as typeof which)} options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }, { value: "all", label: "All tasks" }]} />
            <Select ariaLabel="Milestone" value={ms0} onChange={setMs} options={[{ value: "", label: "Any milestone" }, ...milestones.map((m) => ({ value: m.id, label: m.label }))]} />
          </>}
          empty={<Empty title={which === "open" ? "No open tasks" : "No tasks here"} body={canChange ? "Add a task, or create the " + T.oneLower + " from a template to start with its tasks." : undefined} />} />
      </div>
      {taskId && <TaskPanel key={taskId} taskId={taskId} onClose={() => setTaskId(null)} onOpen={onOpen} />}
      {adding && <AddTaskPanel p={p} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); setTaskId(id); }} />}
    </>
  );
}

function AddTaskPanel({ p, onClose, onAdded }: { p: Project; onClose: () => void; onAdded: (id: string) => void }) {
  const { core, q, T } = useProjectsCtx();
  const milestones = core.data.milestones.filter((m) => m.projectId === p.id && !m.completedAt);
  const teams = p.teamId ? [p.teamId] : core.config.teams.filter((t) => !p.unitId || t.unitId === p.unitId).map((t) => t.id);
  const [title, setTitle] = useState("");
  const [mid, setMid] = useState(milestones[0]?.id || "");
  const [team, setTeam] = useState(p.teamId || teams[0] || "");
  const [who, setWho] = useState("");
  const [due, setDue] = useState("");
  const [est, setEst] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const members = core.data.memberships.filter((m) => m.teamId === team).map((m) => m.personId)
    .filter((id) => core.data.people.some((x) => x.id === id && x.status === "active"));
  const save = () => {
    const r = store.run(addProjectTask, p.id, { title, milestoneId: mid || undefined, teamId: team || undefined, assigneeId: who || null, dueDate: due || undefined, estimateHours: est === "" ? undefined : Number(est) });
    if (r.ok && r.id) onAdded(r.id); else if (!r.ok) setErr(r.error);
  };
  return (
    <SidePanel open onClose={onClose} title="Add task" eyebrow={p.ref} width={520}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!title.trim()}>Add task</Button></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Title"><TextInput ariaLabel="Title" value={title} onChange={setTitle} /></Field>
        <Field label="Milestone" help="The task is due on the milestone date unless you set its own date.">
          <Select ariaLabel="Milestone" value={mid} onChange={setMid} options={[{ value: "", label: "No milestone" }, ...milestones.map((m) => ({ value: m.id, label: m.label }))]} />
        </Field>
        <div className="pj-grid2">
          <Field label={core.config.terminology.team}><Select ariaLabel="Team" value={team} onChange={(x) => { setTeam(x); setWho(""); }} options={teams.map((t) => ({ value: t, label: q.teamLabel(t) }))} /></Field>
          <Field label="Assignee"><Select ariaLabel="Assignee" value={who} onChange={setWho} options={[{ value: "", label: "Team queue" }, ...members.map((id) => ({ value: id, label: q.name(id) }))]} /></Field>
          <Field label="Due date"><input className="pk-input" type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Estimate, hours" help="Leave empty if not estimated."><input className="pk-input" type="number" min={0} step={0.5} aria-label="Estimate in hours" value={est} onChange={(e) => setEst(e.target.value)} placeholder="Unestimated" /></Field>
        </div>
        <div className="pk-help">The task appears in Work for the {core.config.terminology.team.toLowerCase()} and the assignee, linked to this {T.oneLower}.</div>
        {err && <div className="pk-error" role="alert">{err}</div>}
      </div>
    </SidePanel>
  );
}

/* ── Budget ────────────────────────────────────────────────────────────── */

function BudgetTab({ p, canChange }: { p: Project; canChange: boolean }) {
  const { core, q, T, d } = useProjectsCtx();
  const [pick, setPick] = useState("");
  if (!can(q.viewer, "finance.view")) return <NoAccess what="budget figures. It needs the View finance permission" />;
  if (!p.budgetId) {
    const options = core.data.budgets.filter((b) => !b.projectId || b.projectId === p.id);
    return (
      <Empty title="No budget linked" body={"Link a budget to see approved, committed, invoiced and paid figures for this " + T.oneLower + "."}
        action={canChange && options.length ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Select ariaLabel="Budget" value={pick} onChange={setPick} options={[{ value: "", label: "Choose a budget" }, ...options.map((b) => ({ value: b.id, label: b.label }))]} />
            <Button variant="primary" disabled={!pick} onClick={() => store.run(updateProject, p.id, { budgetId: pick }, "Linked a budget")}>Link budget</Button>
          </div>
        ) : undefined} />
    );
  }
  const pos = budgetPosition(core, p.budgetId);
  const b = core.data.budgets.find((x) => x.id === p.budgetId);
  if (!pos || !b) return <Notice tone="warn">The linked budget ({p.budgetId}) is not in the finance data. It may have been removed; an owner can link another one.</Notice>;
  const tile = (key: keyof typeof STAGE_DEFINITIONS, label: string, value: number) => (
    <div className="pj-stage">
      <div className="pk-eyebrow">{label}</div>
      <div className="pj-stage-v">{fmtMoney(value, pos.currency)}</div>
      <div className="pj-faint">{STAGE_DEFINITIONS[key]}</div>
    </div>
  );
  const orders = core.data.orders.filter((o) => pos.orderIds.includes(o.id) || o.budgetId === b.id);
  const invoices = pos.invoiceIds.map((id) => core.data.invoices.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i);
  const txs = pos.transactionIds.map((id) => core.data.transactions.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  const supplier = (id: string) => core.data.suppliers.find((s) => s.id === id)?.name || "Unknown supplier";
  return (
    <>
      <div className="pj-tabhead">
        <div>
          <div className="pj-ms-title">{b.label}</div>
          <div className="pj-faint">Owner {q.name(b.ownerId)} · {d(b.periodFrom)} to {d(b.periodTo)} · {b.currency}</div>
        </div>
        <Button onClick={() => openObject("budget", b.id)}>Open in Finance</Button>
      </div>
      <div className="pj-stages">
        {tile("approved", "Approved", pos.approved)}
        {tile("committed", "Committed", pos.committed)}
        {tile("invoiced", "Invoiced", pos.invoiced)}
        {tile("paid", "Paid", pos.paid)}
      </div>
      <Notice>These are stages of the same spend: an order becomes an invoice, then a payment. They are shown side by side and never added together. Remaining against approved: <b>{fmtMoney(pos.remaining, pos.currency)}</b>. {STAGE_DEFINITIONS.remaining}</Notice>
      {pos.notes.map((n) => <div key={n} className="pj-faint" style={{ marginTop: 6 }}>{n}</div>)}
      <div className="pj-recs">
        <RecList title="Orders" empty="No orders on this budget." items={orders.map((o) => ({ id: o.id, main: o.ref + " · " + supplier(o.supplierId), side: fmtMoney(o.total, o.currency) + " · " + o.status.replace("_", " "), open: () => openObject("order", o.id) }))} />
        <RecList title="Invoices" empty="No invoices on this budget." items={invoices.map((i) => ({ id: i.id, main: i.ref + " · " + supplier(i.supplierId), side: fmtMoney(i.amount, i.currency) + " · " + i.status.replace("_", " ") + (i.flags.length ? " · " + i.flags.join(", ").replace(/_/g, " ") : ""), open: () => openObject("invoice", i.id), warn: i.flags.length > 0 }))} />
        <RecList title="Payments" empty="No payments reported by the accounting source." items={txs.map((t) => ({ id: t.id, main: t.description, side: d(t.date) + " · " + fmtMoney(t.amount, t.currency) }))} />
      </div>
    </>
  );
}

function RecList({ title, items, empty }: { title: string; empty: string; items: { id: string; main: string; side: string; open?: () => void; warn?: boolean }[] }) {
  return (
    <section className="pj-box">
      <div className="pk-eyebrow">{title} · {items.length}</div>
      {items.length === 0 ? <div className="pj-faint" style={{ marginTop: 8 }}>{empty}</div> : (
        <div className="pk-list" style={{ marginTop: 8 }}>
          {items.map((it) => it.open ? (
            <button key={it.id} type="button" className="pk-li pk-li--btn" onClick={it.open}>
              <span className="pk-grow">{it.main}</span><span className="pj-faint" style={{ color: it.warn ? "var(--warn)" : undefined }}>{it.side}</span>
            </button>
          ) : (
            <div key={it.id} className="pk-li"><span className="pk-grow">{it.main}</span><span className="pj-faint">{it.side}</span></div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Edit details ──────────────────────────────────────────────────────── */

function EditPanel({ p, onClose }: { p: Project; onClose: () => void }) {
  const { core, tz, T } = useProjectsCtx();
  const [title, setTitle] = useState(p.title);
  const [objective, setObjective] = useState(p.objective);
  const [owner, setOwner] = useState(p.ownerId);
  const [status, setStatus] = useState<Project["status"]>(p.status);
  const [start, setStart] = useState(dayInput(p.startDate, tz));
  const [end, setEnd] = useState(dayInput(p.endDate, tz));
  const [err, setErr] = useState<string | null>(null);
  const staff = core.data.people.filter((x) => x.kind === "staff" && x.status === "active");
  const save = () => {
    const patch: ProjectPatch = {};
    if (title !== p.title) patch.title = title;
    if (objective !== p.objective) patch.objective = objective;
    if (owner !== p.ownerId) patch.ownerId = owner;
    if (status !== p.status) patch.status = status;
    if (start !== dayInput(p.startDate, tz)) { const v = projectDay(start, tz, 9); if (!v) return setErr("Enter a valid start date."); patch.startDate = v; }
    if (end !== dayInput(p.endDate, tz)) { const v = projectDay(end, tz, 17); if (!v) return setErr("Enter a valid end date."); patch.endDate = v; }
    const r = store.run(updateProject, p.id, patch, "");
    if (r.ok) onClose(); else setErr(r.error);
  };
  return (
    <SidePanel open onClose={onClose} title={"Edit " + T.oneLower} eyebrow={p.ref} width={560}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Name"><TextInput ariaLabel="Name" value={title} onChange={setTitle} /></Field>
        <Field label="Objective"><TextArea value={objective} onChange={setObjective} rows={3} /></Field>
        <div className="pj-grid2">
          <Field label="Accountable owner"><Select ariaLabel="Owner" value={owner} onChange={setOwner} options={staff.map((x) => ({ value: x.id, label: x.name }))} /></Field>
          <Field label="Status"><Select ariaLabel="Status" value={status} onChange={(x) => setStatus(x as Project["status"])}
            options={(Object.keys(PROJECT_STATUS_LABEL) as Project["status"][]).map((k) => ({ value: k, label: PROJECT_STATUS_LABEL[k] }))} /></Field>
          <Field label="Start date"><input className="pk-input" type="date" aria-label="Start date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End date" help="Milestones are not moved by this."><input className="pk-input" type="date" aria-label="End date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="pk-help">Health is reported with an update, not edited here. Milestone dates change from the Plan tab with an impact preview.</div>
        {err && <div className="pk-error" role="alert">{err}</div>}
      </div>
    </SidePanel>
  );
}

