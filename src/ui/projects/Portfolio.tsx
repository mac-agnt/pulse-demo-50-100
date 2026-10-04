/* Projects > Portfolio. The table is the default comparison view; a board by
   phase is the alternative. Filters: owner, scope, type, computed health,
   phase and when the next milestone falls. One primary action: create a
   project from a template. */

import { useMemo, type ReactNode } from "react";
import {
  budgetPosition, can, fmtMoney, latestProjectUpdate, pageLabel, milestoneSlipDays, moduleEnabled, ms, nextMilestoneOf, projectHealth, projectPhaseLabel,
  projectPhases, projectProgress, projectsFor, projectTypeOf, scopeLabel, PROJECT_HEALTH_LABEL,
  type BudgetPosition, type Milestone, type Project, type ProjectHealth, type ProjectProgress
} from "../../core";
import { Btn, Hero, SegTabs, FilterChip, eyebrowOf } from "../frame";
import { Button, DataTable, Empty, PersonName, type Column, type TableState } from "../kit";
import { Faint, HealthChip, HealthPair, ProgressBar, SlipChip, useProjectsCtx } from "./shared";

export interface PortfolioFilters { owner: string; scope: string; type: string; health: string; phase: string; due: string }
export const EMPTY_FILTERS: PortfolioFilters = { owner: "", scope: "", type: "", health: "", phase: "", due: "" };

interface Row { p: Project; h: ProjectHealth; pr: ProjectProgress; next?: Milestone; slip: number; budget: BudgetPosition | null; updAt?: string; updText?: string }

export function Portfolio({ onOpen, onNew, filters, setFilters, mode, setMode, table, setTable }: {
  onOpen: (id: string) => void; onNew: () => void;
  filters: PortfolioFilters; setFilters: (f: PortfolioFilters) => void;
  mode: "table" | "board"; setMode: (m: "table" | "board") => void;
  table: TableState; setTable: (s: TableState) => void;
}) {
  const { core, ctx, q, T, d, now } = useProjectsCtx();
  const title = pageLabel(core.config, "Projects");
  const financeOn = moduleEnabled(core.config, "finance");
  const seeMoney = can(q.viewer, "finance.view");
  const canCreate = can(q.viewer, "projects.manage");
  const hasTemplates = core.config.projects.templates.length > 0;

  const all: Row[] = useMemo(() => projectsFor(q).map((p) => {
    const next = nextMilestoneOf(core, p.id);
    const upd = latestProjectUpdate(core, p.id);
    return {
      p, h: projectHealth(core, p, now), pr: projectProgress(core, p), next, slip: next ? milestoneSlipDays(core, next) : 0,
      budget: financeOn && seeMoney && p.budgetId ? budgetPosition(core, p.budgetId) : null, updAt: upd?.at, updText: upd?.text
    };
  }), [core, q, now, financeOn, seeMoney]);

  const unitOf = (p: Project) => p.unitId || core.config.teams.find((t) => t.id === p.teamId)?.unitId;
  const match = (r: Row) => {
    const f = filters;
    if (f.owner && r.p.ownerId !== f.owner) return false;
    if (f.type && r.p.typeId !== f.type) return false;
    if (f.health && r.h.health !== f.health) return false;
    if (f.phase && r.p.phaseId !== f.phase) return false;
    if (f.scope) {
      if (f.scope === "org" && (r.p.teamId || r.p.unitId)) return false;
      if (f.scope.startsWith("unit:") && unitOf(r.p) !== f.scope.slice(5)) return false;
      if (f.scope.startsWith("team:") && r.p.teamId !== f.scope.slice(5)) return false;
    }
    if (f.due) {
      if (f.due === "none") return !r.next;
      if (!r.next) return false;
      const days = (ms(r.next.dueAt) - ms(now)) / 864e5;
      if (f.due === "overdue" && days >= 0) return false;
      if (f.due === "14" && (days < 0 || days > 14)) return false;
      if (f.due === "30" && (days < 0 || days > 30)) return false;
      if (f.due === "later" && days <= 30) return false;
    }
    return true;
  };
  const rows = all.filter(match);
  const active = Object.values(filters).some(Boolean);

  const uniq = <K extends string>(xs: { value: K; label: string }[]) => xs.filter((x, i) => xs.findIndex((y) => y.value === x.value) === i);
  const chips = (
    <>
      <FilterChip label="Owner" value={filters.owner} onChange={(v) => setFilters({ ...filters, owner: v })}
        options={[{ value: "", label: "Any owner" }, ...uniq(all.map((r) => ({ value: r.p.ownerId, label: q.name(r.p.ownerId) })))]} />
      <FilterChip label="Scope" value={filters.scope} onChange={(v) => setFilters({ ...filters, scope: v })}
        options={[{ value: "", label: "Any scope" }, ...(all.some((r) => !r.p.teamId && !r.p.unitId) ? [{ value: "org", label: "Whole " + core.config.terminology.organisation.toLowerCase() }] : []),
          ...uniq(all.filter((r) => unitOf(r.p)).map((r) => ({ value: "unit:" + unitOf(r.p), label: q.unitLabel(unitOf(r.p)) }))),
          ...uniq(all.filter((r) => r.p.teamId).map((r) => ({ value: "team:" + r.p.teamId, label: q.teamLabel(r.p.teamId) })))]} />
      <FilterChip label="Type" value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })}
        options={[{ value: "", label: "Any type" }, ...core.config.projects.types.map((t) => ({ value: t.id, label: t.label }))]} />
      <FilterChip label="Computed health" value={filters.health} onChange={(v) => setFilters({ ...filters, health: v })}
        options={[{ value: "", label: "Any health" }, ...(["on_track", "at_risk", "off_track"] as const).map((h) => ({ value: h, label: PROJECT_HEALTH_LABEL[h] }))]} />
      <FilterChip label="Phase" value={filters.phase} onChange={(v) => setFilters({ ...filters, phase: v })}
        options={[{ value: "", label: "Any phase" }, ...uniq((filters.type ? core.config.projects.types.filter((t) => t.id === filters.type) : core.config.projects.types)
          .flatMap((t) => t.phases.map((ph) => ({ value: ph.id, label: ph.label }))))]} />
      <FilterChip label="Next milestone due" value={filters.due} onChange={(v) => setFilters({ ...filters, due: v })}
        options={[{ value: "", label: "Any due date" }, { value: "overdue", label: "Milestone overdue" }, { value: "14", label: "Due in 14 days" },
          { value: "30", label: "Due in 30 days" }, { value: "later", label: "Due later" }, { value: "none", label: "No open milestone" }]} />
      {active && <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>}
    </>
  );

  const columns: Column<Row>[] = [
    { key: "title", label: T.one, strong: true, priority: 1, width: "22%", value: (r) => r.p.title,
      render: (r) => <span className="pj-cell2"><span>{r.p.title}</span><span>{r.p.ref} · {projectTypeOf(core.config, r.p.typeId)?.label || "Unknown type"}</span></span> },
    { key: "owner", label: "Owner", priority: 2, value: (r) => q.name(r.p.ownerId), render: (r) => <PersonName id={r.p.ownerId} /> },
    { key: "phase", label: "Phase", priority: 2, value: (r) => projectPhases(core.config, r.p).findIndex((x) => x.id === r.p.phaseId),
      render: (r) => projectPhaseLabel(core.config, r.p, r.p.phaseId) },
    { key: "progress", label: "Progress", priority: 3, value: (r) => r.pr.value ?? -1, render: (r) => <ProgressBar pr={r.pr} /> },
    { key: "next", label: "Next milestone", priority: 1, value: (r) => r.next?.dueAt || "",
      render: (r) => r.next ? (
        <span className="pj-cell2">
          <span>{r.next.label}</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: ms(r.next.dueAt) < ms(now) ? "var(--bad)" : undefined }}>{d(r.next.dueAt)}{ms(r.next.dueAt) < ms(now) ? ", overdue" : ""}</span>
            <SlipChip days={r.slip} />
          </span>
        </span>
      ) : <Faint>No open milestone</Faint> },
    ...(financeOn ? [{ key: "budget", label: "Budget", priority: 3, align: "right" as const,
      value: (r: Row) => r.budget?.committed ?? null,
      render: (r: Row): ReactNode => !seeMoney ? <Faint>Needs finance access</Faint> : !r.p.budgetId ? <Faint>None linked</Faint> : !r.budget ? <Faint>Budget not found</Faint> : (
        <span className="pj-cell2 pj-right" title={"Approved " + fmtMoney(r.budget.approved, r.budget.currency) + ", committed " + fmtMoney(r.budget.committed, r.budget.currency)
          + ", invoiced " + fmtMoney(r.budget.invoiced, r.budget.currency) + ", paid " + fmtMoney(r.budget.paid, r.budget.currency) + ". Stages overlap and are not added together."}>
          <span>{fmtMoney(r.budget.committed, r.budget.currency)} committed</span>
          <span>of {fmtMoney(r.budget.approved, r.budget.currency)} approved</span>
        </span>
      ) }] : []),
    { key: "health", label: "Health", priority: 1, value: (r) => ["on_track", "at_risk", "off_track"].indexOf(r.h.health), render: (r) => <HealthPair h={r.h} compact /> },
    { key: "update", label: "Latest update", priority: 3, width: "18%", value: (r) => r.updAt || "",
      render: (r) => r.updAt ? <span className="pj-cell2" title={r.updText}><span>{r.updText}</span><span>{d(r.updAt)}</span></span> : <Faint>No update yet</Faint> }
  ];

  const newBtn = (
    <Btn primary onClick={onNew} disabled={!canCreate || !hasTemplates}
      title={!canCreate ? "Your role cannot create " + T.manyLower + " (needs Manage projects)" : !hasTemplates ? "Add a template in Templates first" : undefined}>
      New {T.oneLower}
    </Btn>
  );

  if (!core.data.projects.length) {
    return (
      <>
        <Hero eyebrow={eyebrowOf(title, "Portfolio")} title={title} actions={newBtn} />
        <Empty title={"Create a " + T.oneLower}
          body={hasTemplates ? "Start from a template: phases, milestones and tasks are dated from the start date you choose. Tasks go to the team queue in Work."
            : "There are no templates yet. Add a project type and a template, then create the first " + T.oneLower + " from it."}
          action={hasTemplates ? <Button variant="primary" onClick={onNew} disabled={!canCreate}>New {T.oneLower}</Button> : undefined} />
      </>
    );
  }

  return (
    <>
      <Hero eyebrow={eyebrowOf(title, "Portfolio", scopeLabel(core, ctx.scope))} title={title} infoOnly
        blurb={"Every " + T.oneLower + " you can see in this scope. Health is computed from milestones, tasks, gates and risks, and shown beside what the owner reports."}
        actions={<>
          <SegTabs label="View" value={mode} onChange={setMode} options={[{ value: "table", label: "Table" }, { value: "board", label: "Board by phase" }]} />
          {newBtn}
        </>} />
      {mode === "table" ? (
        <div className="pj-table">
          <DataTable rows={rows} columns={columns} rowKey={(r) => r.p.id} onOpen={(r) => onOpen(r.p.id)} state={table} onState={setTable}
            searchText={(r) => r.p.title + " " + r.p.ref + " " + q.name(r.p.ownerId)} searchPlaceholder={"Search " + T.manyLower}
            caption={T.many} pageSize={10} toolbarLeft={chips}
            empty={<Empty title={"No " + T.manyLower + " match"} body={all.length ? "Change or clear the filters." : "None are in this scope. Choose a wider scope in the top bar."}
              action={active ? <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button> : undefined} />}
            footerNote={"Progress basis: " + (rows[0]?.pr.basisLabel || "").toLowerCase()} />
        </div>
      ) : (
        <Board rows={rows} onOpen={onOpen} chips={chips} />
      )}
    </>
  );
}

function Board({ rows, onOpen, chips }: { rows: Row[]; onOpen: (id: string) => void; chips: ReactNode }) {
  const { core, q, T, d, now } = useProjectsCtx();
  const types = core.config.projects.types.filter((t) => rows.some((r) => r.p.typeId === t.id));
  return (
    <div className="pk-card">
      <div className="pk-toolbar">{chips}</div>
      {rows.length === 0 && <Empty title={"No " + T.manyLower + " match"} body="Change or clear the filters." />}
      {types.map((t) => (
        <section key={t.id} className="pj-board-type" aria-label={t.label}>
          <div className="pk-eyebrow" style={{ padding: "12px 16px 0" }}>{t.label}</div>
          <div className="pj-board" style={{ gridTemplateColumns: "repeat(" + t.phases.length + ", minmax(220px, 1fr))" }}>
            {t.phases.map((ph) => {
              const list = rows.filter((r) => r.p.typeId === t.id && r.p.phaseId === ph.id);
              return (
                <div key={ph.id} className="pj-lane">
                  <div className="pj-lane-h"><span>{ph.label}</span><span className="pk-count">{list.length}</span></div>
                  {list.map((r) => (
                    <button key={r.p.id} type="button" className="pj-card" onClick={() => onOpen(r.p.id)}>
                      <span className="pj-card-t">{r.p.title}</span>
                      <span className="pj-faint">{r.p.ref} · {q.name(r.p.ownerId)}</span>
                      <ProgressBar pr={r.pr} />
                      <span className="pj-faint">{r.next ? "Next: " + r.next.label + ", " + d(r.next.dueAt) + (ms(r.next.dueAt) < ms(now) ? " (overdue)" : "") : "No open milestone"}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><HealthChip health={r.h.health} />
                        <span className={"pj-reported" + (r.h.differs ? " pj-reported--differs" : "")}>{r.h.reported ? "Reported " + PROJECT_HEALTH_LABEL[r.h.reported].toLowerCase() : "Not reported"}</span></span>
                    </button>
                  ))}
                  {list.length === 0 && <div className="pj-lane-empty">None</div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
