/* Presentation state shared by the KPI band and the Dashboard page. They are
   separate components in the shell, so the open metric panel lives in a tiny
   module-level store. The active area comes from the shell (v.dashArea), and
   the chosen core KPIs are remembered per browser. Nothing here touches core
   state or permissions. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { query, formatMetric, metricAvailable, dashboardVisible, useCore, type CoreState, type Ctx, type DashboardDef, type MetricDef, type MetricResult, type Q, type ScopeSel, computeMetric } from "../../core";

export type CompareCol = "actual" | "target" | "variance" | "trend" | "owner" | "updated";
export const COMPARE_COLS: CompareCol[] = ["actual", "target", "variance", "trend", "owner", "updated"];

interface DashState {
  /** Metric panel open in the band or page. */
  metricId: string | null;
  /** Scope the open metric is explained for (a comparison row); null means the selected scope. */
  metricScope: ScopeSel | null;
  /** Reporting period in days for period measures; null keeps each measure's configured period. */
  period: number | null;
  /** Comparison table: the measure compared, visible columns and sort. Saved views store these. */
  compareMetric: string | null;
  columns: CompareCol[];
  sort: { key: CompareCol | "row"; dir: "asc" | "desc" } | null;
}

let state: DashState = { metricId: null, metricScope: null, period: null, compareMetric: null, columns: [...COMPARE_COLS], sort: null };
const listeners = new Set<() => void>();

export const dashStore = {
  get: () => state,
  set(patch: Partial<DashState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  }
};

export function useDashState(): DashState {
  return useSyncExternalStore(dashStore.subscribe, dashStore.get, dashStore.get);
}

/** The viewer's highest role: the assigned role with the most permissions. */
export function highestRoleId(core: CoreState, q: Q): string {
  let best: { id: string; n: number } | null = null;
  for (const ra of q.viewer.roles) {
    const def = core.config.roles.find((r) => r.id === ra.roleId);
    const n = def ? def.permissions.length : 0;
    if (!best || n > best.n) best = { id: ra.roleId, n };
  }
  return best?.id || "contributor";
}

/** The area shown: the one the shell asked for, else the first visible one. Views whose
    metrics all belong to a disabled module are not shown. */
export function areaOf(core: CoreState, id: string | undefined): DashboardDef | null {
  const list = core.config.dashboards.filter((d) => dashboardVisible(core.config, d));
  return list.find((d) => d.id === id) || list[0] || null;
}

/** Enabled metric definitions of an area whose module is on, in configured order. */
export function viewMetrics(core: CoreState, metricIds: string[]): MetricDef[] {
  return metricIds.map((id) => core.config.metrics.find((m) => m.id === id)).filter((m): m is MetricDef => !!m && metricAvailable(core.config, m));
}

/* ── Reporting period ──────────────────────────────────────────────────── */

const periodCache = new WeakMap<CoreState, Map<number, CoreState>>();

/** The same state with every period measure computed over `days`. Snapshot measures are unchanged. */
export function withPeriod(core: CoreState, days: number | null): CoreState {
  if (!days) return core;
  let m = periodCache.get(core);
  if (!m) { m = new Map(); periodCache.set(core, m); }
  let out = m.get(days);
  if (!out) {
    out = { ...core, config: { ...core.config, metrics: core.config.metrics.map((x) => (x.periodDays > 0 ? { ...x, periodDays: days } : x)) } };
    m.set(days, out);
  }
  return out;
}

/** Core state with the dashboard's chosen period applied, for the band, page and metric panel. */
export function useDashCore() {
  const snap = useCore();
  const { period } = useDashState();
  return { ...snap, core: withPeriod(snap.core, period) };
}

/** Who answers for an area: the first active organisation-wide administrator. Null when none is set up. */
export function areaOwner(core: CoreState): { name: string; role: string } | null {
  const ra = core.data.roleAssignments.find((r) => r.roleId === "admin" && r.scope.kind === "organisation"
    && core.data.people.some((p) => p.id === r.personId && p.status === "active"));
  if (!ra) return null;
  const p = core.data.people.find((x) => x.id === ra.personId)!;
  return { name: p.name, role: core.config.roles.find((r) => r.id === "admin")?.label || "Administrator" };
}

/* ── Core KPIs: chosen per browser ─────────────────────────────────────── */

export const CORE_MIN = 4;
export const CORE_MAX = 6;
const keyOf = (core: CoreState) => "pulse.coreKpis." + core.config.workspace.id;

export function defaultCoreKpis(core: CoreState): string[] {
  /* The first visible area's measures first, so the band matches the default view. */
  const first = areaOf(core, undefined);
  const avail = core.config.metrics.filter((m) => metricAvailable(core.config, m)).map((m) => m.id);
  const ordered = [...(first?.metricIds || []).filter((id) => avail.includes(id)), ...avail.filter((id) => !first?.metricIds.includes(id))];
  return ordered.slice(0, 5);
}

function readCore(core: CoreState): string[] | null {
  try {
    const raw = localStorage.getItem(keyOf(core));
    if (!raw) return null;
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

/** The core KPI ids for this browser, limited to enabled metrics; falls back to the default. */
export function useCoreKpis(core: CoreState): { ids: string[]; set: (ids: string[]) => void; reset: () => void; custom: boolean } {
  const key = keyOf(core);
  const [stored, setStored] = useState<string[] | null>(() => readCore(core));
  useEffect(() => { setStored(readCore(core)); }, [key]);
  const enabled = new Set(core.config.metrics.filter((m) => metricAvailable(core.config, m)).map((m) => m.id));
  const valid = (stored || []).filter((id) => enabled.has(id)).slice(0, CORE_MAX);
  const ids = valid.length ? valid : defaultCoreKpis(core);
  const set = (next: string[]) => {
    setStored(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage blocked: the choice lasts for this visit only */ }
  };
  const reset = () => {
    setStored(null);
    try { localStorage.removeItem(key); } catch { /* nothing stored */ }
  };
  return { ids, set, reset, custom: valid.length > 0 };
}

/* ── Metric views ──────────────────────────────────────────────────────── */

const ENTITY_WORD: Record<MetricDef["entity"], { plural: string; where: string }> = {
  task: { plural: "tasks", where: "Tasks appear once they are created in Work." },
  approval: { plural: "approvals", where: "Approvals appear once a request is submitted for a decision." },
  record: { plural: "records", where: "Records appear once they are added or a source is connected." },
  issue: { plural: "records", where: "Data issues are found once records exist." },
  request: { plural: "requests", where: "Requests appear once they are submitted in Work." },
  person: { plural: "people", where: "People appear once employment details are added in People." },
  project: { plural: "projects", where: "Projects appear once one is created in Projects." },
  invoice: { plural: "invoices", where: "Invoices appear once a supplier invoice is received in Purchasing." },
  requirement: { plural: "requirements", where: "Requirements appear once they are configured in Standards." },
  agentRun: { plural: "agent runs", where: "Agent runs appear once an agent is started." }
};

/** Is there anything at all to measure for this entity in the scope? */
function hasBasis(q: Q, entity: MetricDef["entity"]): boolean {
  switch (entity) {
    case "task": return q.tasks().length > 0;
    case "approval": return q.approvals().length > 0;
    case "record": case "issue": return q.records().length > 0;
    case "request": return q.requests().length > 0;
    case "person": return q.s.data.employment.length > 0;
    case "project": return q.s.data.projects.length > 0;
    case "invoice": return q.s.data.invoices.length > 0;
    case "requirement": return q.s.data.obligations.length > 0;
    case "agentRun": return q.s.data.agentRuns.length > 0;
  }
}

export interface MetricView {
  result: MetricResult;
  /** No underlying objects at all: show "No data", never zero. */
  noData: boolean;
  display: string;
  explanation: string | null;
}

/** computeMetric plus the "no data is not zero" rule, for any scope. */
export function metricView(core: CoreState, ctx: Ctx, metricId: string): MetricView | null {
  const result = computeMetric(core, ctx, metricId);
  if (!result) return null;
  const q = query(core, ctx);
  const basis = hasBasis(q, result.entity);
  const noData = !basis || result.value === null;
  const w = ENTITY_WORD[result.entity];
  const explanation = !basis ? "No " + w.plural + " in this scope yet. " + w.where
    : result.value === null ? (result.notes[0] || "Nothing in the period to calculate from.") : null;
  return { result, noData, display: noData ? "No data" : result.display, explanation };
}

/** "+3 vs previous period", direction judged against def.better. */
export function comparison(r: MetricResult): { text: string; tone: "ok" | "bad" | "neutral"; arrow: "up" | "down" | null } {
  if (!r.def.periodDays) return { text: "No previous period for a snapshot", tone: "neutral", arrow: null };
  if (!r.previous || r.previous.value === null || r.value === null || r.delta === null) return { text: "No previous period data to compare", tone: "neutral", arrow: null };
  if (Math.abs(r.delta) < 1e-9) return { text: "No change vs previous period", tone: "neutral", arrow: null };
  const up = r.delta > 0;
  const good = (up && r.def.better === "up") || (!up && r.def.better === "down");
  return { text: deltaText(r) + " vs previous period (" + (good ? "better" : "worse") + ")", tone: good ? "ok" : "bad", arrow: up ? "up" : "down" };
}

/** The bare change, "+2", "-4.5 pts", "+3 h". Empty when there is nothing to compare. */
export function deltaText(r: MetricResult): string {
  if (r.delta === null || Math.abs(r.delta) < 1e-9) return "";
  const mag = Math.abs(r.delta);
  const amount = r.def.unit === "percent" ? (Math.round(mag * 10) / 10) + " pts" : formatMetric(r.def, mag);
  return (r.delta > 0 ? "+" : "-") + amount;
}

/** One short line saying what the figure is compared with. */
export function basisText(r: MetricResult): string {
  if (!r.def.periodDays) return r.target !== undefined ? "snapshot, target " + formatMetric(r.def, r.target) : "snapshot";
  if (!r.previous || r.previous.value === null || r.value === null) return "last " + r.def.periodDays + " days, no earlier data";
  if (r.delta !== null && Math.abs(r.delta) < 1e-9) return "no change, last " + r.def.periodDays + " days";
  return "vs previous " + r.def.periodDays + " days";
}

export function targetText(r: MetricResult, noData: boolean): string | null {
  if (r.target === undefined) return null;
  const t = "Target " + formatMetric(r.def, r.target);
  if (noData || r.value === null) return t;
  const met = r.def.better === "up" ? r.value >= r.target : r.value <= r.target;
  return t + (met ? ", met" : ", not met");
}

export function periodLabel(defs: MetricDef[]): string {
  const days = [...new Set(defs.map((d) => d.periodDays))];
  if (!days.length) return "Now";
  if (days.length === 1) return days[0] ? "Last " + days[0] + " days" : "Now";
  const periodic = days.filter(Boolean);
  return "Now, and last " + periodic.join(" or ") + " days for period measures";
}
