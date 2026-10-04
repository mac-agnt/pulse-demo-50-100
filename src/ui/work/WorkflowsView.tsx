/* Work > Workflows: the workflow runs in scope with their steps, owners and
   waiting states, failed and waiting runs first. Opening a run gives the safe
   recovery actions (assign an owner, retry the failed portion, skip with a
   reason, pause). Workflow templates are configured in Settings; this page
   links there rather than editing them. */

import { useState } from "react";
import { useCore, navigate, scopeLabel } from "../../core";
import type { WorkflowRun } from "../../core";
import { Btn, eyebrowOf, toneColor, toneSoft } from "../frame";
import { LABEL, toneOf } from "../kit";
import { Ico, useClock, useViewer, WI, WorkHead, type OpenPanel } from "./shared";

type RunFilter = "all" | "attention" | "failed" | "active" | "completed" | "templates";

export default function WorkflowsView({ openPanel, selected }: { openPanel: OpenPanel; selected?: string | null }) {
  const { core, ctx, q } = useCore();
  const { can: canDo } = useViewer();
  const [filter, setFilter] = useState<RunFilter>("attention");
  const runs = q.runs();
  const waiting = runs.filter((r) => r.status === "failed" || r.status === "awaiting_input" || r.status === "awaiting_approval" || (!r.assigneeId && r.status !== "completed"));
  const initial = waiting.length ? filter : filter === "attention" ? "all" : filter;
  if (core.config.capabilities.workflows === false) {
    return (
      <div className="wk-card wk-ap-empty" role="status" style={{ marginTop: 24 }}>
        <b>Workflows are switched off</b>
        <span>An administrator can switch them on in Settings, Experience, Enabled views.</span>
      </div>
    );
  }
  return (
    <>
      <WorkHead eyebrow={eyebrowOf("Work", "Workflows", scopeLabel(core, ctx.scope), waiting.length + " need a person")} title="Workflows"
        info="Workflow runs from requests, schedules and manual starts. Open a run to recover it. Templates and triggers are configured in Settings."
        primary={<Btn onClick={() => navigate({ page: "Settings", section: "workflows" })} disabled={!canDo("settings.edit")}
          title={canDo("settings.edit") ? "Workflow templates and triggers are configured in Settings" : "Only people who can change settings can edit workflow templates"}><Ico d={WI.cal} size={14} />Workflow settings</Btn>} />
      <AutomationRuns filter={initial} setFilter={setFilter} runs={runs} openPanel={openPanel} selected={selected} />
    </>
  );
}

const RUN_RANK: Record<WorkflowRun["status"], number> = { failed: 0, awaiting_input: 1, awaiting_approval: 2, paused: 3, running: 4, queued: 5, completed: 6 };

/** What a waiting run needs, and from whom. */
function waitingOn(r: WorkflowRun, name: (id?: string | null) => string): string {
  const step = r.steps.find((s) => s.status === "waiting" || s.status === "current");
  const who = r.assigneeId ? name(r.assigneeId) : "an owner";
  return (r.status === "awaiting_approval" ? "Decision" : "Input") + (step ? " on " + step.label.toLowerCase() : "") + ", from " + who;
}

function AutomationRuns({ filter, setFilter, runs, openPanel, selected }: {
  filter: RunFilter; setFilter: (f: RunFilter) => void; runs: WorkflowRun[]; openPanel: OpenPanel; selected?: string | null;
}) {
  const { core, q } = useCore();
  const { rel } = useClock();
  const templates = core.config.workflowTemplates;
  const tplLabel = (id: string) => templates.find((t) => t.id === id)?.label || "Unknown template";
  const attention = (r: WorkflowRun) => r.status === "failed" || r.status === "awaiting_input" || r.status === "awaiting_approval" || (!r.assigneeId && r.status !== "completed");
  const match: Record<Exclude<RunFilter, "templates">, (r: WorkflowRun) => boolean> = {
    all: () => true, attention, failed: (r) => r.status === "failed",
    active: (r) => r.status === "running" || r.status === "queued" || r.status === "paused", completed: (r) => r.status === "completed"
  };
  const pills: { id: RunFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: runs.length },
    { id: "attention", label: "Needs attention", count: runs.filter(attention).length },
    { id: "failed", label: "Failed", count: runs.filter(match.failed).length },
    { id: "active", label: "In flight", count: runs.filter(match.active).length },
    { id: "completed", label: "Completed", count: runs.filter(match.completed).length },
    { id: "templates", label: "Templates", count: templates.length }
  ];
  const rows = filter === "templates" ? [] : runs.filter(match[filter]).sort((a, b) => RUN_RANK[a.status] - RUN_RANK[b.status] || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section className="wk-card wk-runs" aria-label="Workflow runs" style={{ marginTop: 0 }}>
      <div className="wk-runs-h">
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="wk-card-t">Runs</div>
          <div className="wk-card-m">Failed and waiting runs first. The waiting column says what each run needs and from whom.</div>
        </div>
      </div>
      <div className="wk-pills" role="group" aria-label="Filter runs">
        {pills.map((p) => (
          <button key={p.id} type="button" className="wk-fpill" aria-pressed={filter === p.id} onClick={() => setFilter(p.id)}>
            {p.label}<span>{p.count}</span>
          </button>
        ))}
      </div>

      <div className="wk-runs-scroll">
        {filter === "templates" ? (
          <div className="wk-runs-table">
            <div className="wk-runs-row wk-runs-th"><div>Template</div><div>Trigger</div><div>Owner</div><div>Steps</div><div>Status</div></div>
            {templates.map((t) => (
              <button key={t.id} type="button" className="wk-runs-row wk-runs-tr" onClick={() => openPanel({ kind: "template", id: t.id })}>
                <div className="wk-run-name"><span className="wk-sq" style={{ background: t.enabled ? "var(--ok)" : "var(--dim)" }} />
                  <span style={{ minWidth: 0 }}><span className="wk-line-t" style={{ display: "block" }}>{t.label}</span><span className="wk-mono-s">{t.description}</span></span></div>
                <div className="wk-cell-2"><span>{t.trigger.detail}</span><span className="wk-mono-s">{t.trigger.kind}</span></div>
                <Owner id={t.ownerId} />
                <div className="wk-mono-s" style={{ color: "var(--ink)" }}>{t.steps.length}</div>
                <div><span className="wk-ap-status" style={{ background: toneSoft(t.enabled ? "ok" : "neutral"), color: toneColor(t.enabled ? "ok" : "neutral") }}>{t.enabled ? "Enabled" : "Off"}</span></div>
              </button>
            ))}
            {templates.length === 0 && <div className="wk-empty"><b>No workflow templates yet</b><span>An administrator can add templates in Settings &gt; Control &gt; Workflow templates.</span></div>}
          </div>
        ) : (
          <div className="wk-runs-table">
            <div className="wk-runs-row wk-runs-th"><div>Run</div><div>Status and waiting on</div><div>Owner</div><div>Updated</div><div>Steps</div></div>
            {rows.map((r, i) => {
              const tone = toneOf.run(r.status);
              const doneSteps = r.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
              const pct = r.steps.length ? Math.round((doneSteps / r.steps.length) * 100) : 0;
              return (
                <button key={r.id} type="button" className="wk-runs-row wk-runs-tr" data-selected={selected === r.id || undefined}
                  style={{ animationDelay: Math.min(i * 30, 300) + "ms" }} onClick={() => openPanel({ kind: "run", id: r.id })}>
                  <div className="wk-run-name"><span className="wk-sq" style={{ background: toneColor(tone) }} />
                    <span style={{ minWidth: 0 }}><span className="wk-line-t" style={{ display: "block" }}>{r.title}</span>
                      <span className="wk-mono-s">{r.ref} · {tplLabel(r.templateId)}</span></span></div>
                  <div className="wk-cell-2">
                    <span className="wk-ap-status" style={{ background: toneSoft(tone), color: toneColor(tone), width: "fit-content" }}>{LABEL.run[r.status]}</span>
                    {r.status === "failed" && r.failure && <span className="wk-mono-s" style={{ color: "var(--bad)" }} title={r.failure.message}>{r.failure.message}</span>}
                    {!r.assigneeId && r.status !== "completed" && <span className="wk-mono-s" style={{ color: "var(--warn)" }}>No owner</span>}
                    {(r.status === "awaiting_input" || r.status === "awaiting_approval") && <span className="wk-mono-s" style={{ color: "var(--warn)" }}>{waitingOn(r, q.name)}</span>}
                  </div>
                  <Owner id={r.assigneeId || r.ownerId} />
                  <div className="wk-mono-s" style={{ color: "var(--ink)" }}>{rel(r.updatedAt)}</div>
                  <div className="wk-steps">
                    <span className="wk-steps-track"><span style={{ transform: "scaleX(" + pct / 100 + ")", background: toneColor(tone) }} /></span>
                    <span className="wk-mono-s">{doneSteps}/{r.steps.length}</span>
                  </div>
                </button>
              );
            })}
            {rows.length === 0 && (
              runs.length === 0
                ? <div className="wk-empty"><b>No workflow runs yet</b><span>{templates.length ? "Runs start when a request is submitted, a schedule ticks, or someone starts one. They appear here with every step." : "No workflow templates are configured yet. An administrator can add one in Settings > Control, then runs appear here."}</span></div>
                : <div className="wk-empty"><b>Nothing matches that filter</b><span>Choose All to see every run you can see.</span></div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Owner({ id }: { id: string }) {
  const { q } = useCore();
  return (
    <div className="wk-owner">
      <span className="wk-owner-chip" data-agent={id.startsWith("ag-") || undefined}>{q.initials(id)}</span>
      <span className="wk-owner-n">{q.name(id)}</span>
    </div>
  );
}
