/* Metric engine. Dashboard tiles, comparisons, drill-downs and agent answers
   all call computeMetric, so a figure can never differ between them.
   Ratios aggregate from their underlying totals (never an average of
   percentages); missing data is reported as missing, never as zero. */

import { query, type Q } from "./query";
import { missingFields } from "./quality";
import { personRows } from "./people";
import { addDays, DAY, fmtHours, HOUR, ms } from "./time";
import type { CoreState, Ctx, Id, MetricDef, ScopeSel } from "./types";

export const STALE_AFTER_HOURS = 24;

export interface MetricResult {
  def: MetricDef;
  value: number | null;
  display: string;
  numerator?: number;
  denominator?: number;
  /** Exactly the objects the figure is computed from. */
  ids: Id[];
  entity: MetricDef["entity"];
  period: { start: string; end: string } | null;
  partial: boolean;
  stale: boolean;
  notes: string[];
  /** Contributors that could not be counted, and why. */
  missing: { label: string; reason: string }[];
  freshness: { label: string; at: string | null };
  sources: string[];
  previous: { value: number | null; display: string; period: { start: string; end: string } } | null;
  target?: number;
  /** Change against the previous period, in the metric's own unit. */
  delta: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export function formatMetric(def: MetricDef, v: number | null): string {
  if (v === null || !isFinite(v)) return "No data";
  if (def.unit === "percent") return (Math.round(v * 10) / 10) + "%";
  if (def.unit === "hours") return fmtHours(v);
  if (def.unit === "money") return new Intl.NumberFormat("en-IE", { style: "currency", currency: def.currency || "EUR", maximumFractionDigits: 0 }).format(v);
  return String(Math.round(v));
}

interface Raw { value: number | null; num?: number; den?: number; ids: Id[]; notes: string[]; partial?: boolean; missing?: { label: string; reason: string }[]; sources?: string[]; freshAt?: string | null; stale?: boolean }

function raw(q: Q, def: MetricDef, start: string, end: string): Raw {
  const s = q.s;
  const inPeriod = (at?: string) => !!at && at > start && at <= end;
  switch (def.id) {
    case "backlog": {
      const open = q.tasks().filter((t) => q.isOpenTask(t) && t.createdAt <= end);
      return { value: open.length, ids: open.map((t) => t.id), notes: [] };
    }
    case "overdue": {
      const late = q.tasks().filter((t) => q.isOverdue(t));
      return { value: late.length, ids: late.map((t) => t.id), notes: [] };
    }
    case "ontime": {
      const done = q.tasks().filter((t) => t.status === "done" && inPeriod(t.completedAt));
      const withDue = done.filter((t) => !!t.dueAt);
      const onTime = withDue.filter((t) => ms(t.completedAt) <= ms(t.dueAt));
      const notes = done.length > withDue.length ? [done.length - withDue.length + " completed tasks had no due time and are excluded."] : [];
      return { value: withDue.length ? (100 * onTime.length) / withDue.length : null, num: onTime.length, den: withDue.length, ids: withDue.map((t) => t.id), notes };
    }
    case "turnaround": {
      const decided = q.approvals().filter((a) => (a.status === "approved" || a.status === "declined") && inPeriod(a.decidedAt));
      const hours = decided.map((a) => (ms(a.decidedAt) - ms(a.submittedAt)) / HOUR);
      return { value: median(hours), den: decided.length, ids: decided.map((a) => a.id),
        notes: ["Calendar hours from submission to final decision. The service deadline uses business hours."] };
    }
    case "completeness": {
      const recs = q.records();
      let filled = 0, required = 0;
      const staleRecs: Id[] = [];
      const srcs = new Set<string>();
      let freshAt: string | null = null;
      for (const r of recs) {
        const t = s.config.recordTypes.find((x) => x.id === r.typeId);
        const req = t ? t.fields.filter((f) => f.required).length : 0;
        required += req;
        filled += req - missingFields(s, r).length;
        for (const ref of r.sourceRefs) {
          srcs.add(ref.sourceId);
          if (ref.syncedAt && (ms(end) - ms(ref.syncedAt)) / HOUR > STALE_AFTER_HOURS) staleRecs.push(r.id);
          if (ref.syncedAt && (!freshAt || ref.syncedAt < freshAt)) freshAt = ref.syncedAt;
        }
      }
      const missing: { label: string; reason: string }[] = [];
      if (staleRecs.length) {
        const teams = [...new Set(staleRecs.map((id) => recs.find((r) => r.id === id)?.teamId))].map((t) => q.teamLabel(t)).join(", ");
        missing.push({ label: staleRecs.length + " records (" + teams + ")", reason: "Source last synced more than " + STALE_AFTER_HOURS + " h ago; values may be out of date." });
      }
      return { value: required ? (100 * filled) / required : null, num: filled, den: required, ids: recs.map((r) => r.id), notes: [],
        partial: staleRecs.length > 0, stale: staleRecs.length > 0, missing, sources: [...srcs], freshAt };
    }
    case "issues": {
      const open = q.issues().filter((i) => i.state === "open" || i.state === "in_progress");
      return { value: open.length, ids: open.map((i) => i.id), notes: [] };
    }
    case "staleRecords": {
      const recs = q.records().filter((r) => r.sourceRefs.some((ref) => ref.syncedAt && (ms(end) - ms(ref.syncedAt)) / HOUR > STALE_AFTER_HOURS));
      return { value: recs.length, ids: recs.map((r) => r.id), notes: ["Counted from each record's last successful sync."], sources: [...new Set(recs.flatMap((r) => r.sourceRefs.map((x) => x.sourceId)))] };
    }
    case "headcount": {
      const rows = personRows(q);
      return { value: rows.length, ids: rows.map((r) => r.person.id), notes: ["Only people whose employment details you can see are counted."] };
    }
    case "certCompliance": {
      const rows = personRows(q).filter((r) => r.e.stage !== "onboarding");
      let ok = 0, req = 0;
      for (const r of rows) for (const c of r.certs) { req++; if (c.state === "ok" || c.state === "due") ok++; }
      return { value: req ? (100 * ok) / req : null, num: ok, den: req, ids: rows.map((r) => r.person.id), notes: ["Due within 30 days still counts as in date."] };
    }
    case "awayToday": {
      const rows = personRows(q).filter((r) => r.awayNow);
      return { value: rows.length, ids: rows.map((r) => r.person.id), notes: [] };
    }
    case "approvedValue": {
      const reqs = q.requests().filter((r) => r.status === "approved" && inPeriod(s.data.approvals.find((a) => a.id === r.approvalId)?.decidedAt));
      const valued = reqs.filter((r) => typeof r.fields.value === "number");
      const currencies = new Set(valued.map((r) => s.config.requestForms.find((f) => f.id === r.formId)?.fields.find((f) => f.key === "value")?.currency || "?"));
      if (currencies.size > 1) {
        return { value: null, ids: valued.map((r) => r.id), notes: ["Values are in more than one currency (" + [...currencies].join(", ") + "); they are not added together."], partial: true };
      }
      const sum = valued.reduce((n, r) => n + (r.fields.value as number), 0);
      return { value: valued.length ? sum : null, num: sum, den: valued.length, ids: valued.map((r) => r.id),
        notes: reqs.length > valued.length ? [reqs.length - valued.length + " approved requests have no value and are excluded."] : [] };
    }
  }
  return { value: null, ids: [], notes: ["No calculation is registered for this metric."] };
}

export function computeMetric(s: CoreState, ctx: Ctx, metricId: string): MetricResult | null {
  const def = s.config.metrics.find((m) => m.id === metricId);
  if (!def) return null;
  const q = query(s, ctx);
  const end = ctx.now;
  const start = def.periodDays ? addDays(end, -def.periodDays) : addDays(end, -36500);
  const r = raw(q, def, start, end);
  let previous: MetricResult["previous"] = null;
  if (def.periodDays) {
    const pEnd = start, pStart = addDays(start, -def.periodDays);
    const p = raw(q, def, pStart, pEnd);
    previous = { value: p.value, display: formatMetric(def, p.value), period: { start: pStart, end: pEnd } };
  }
  const live = def.entity === "task" || def.entity === "approval" || def.entity === "request" || def.entity === "person";
  const freshAt = live ? ctx.now : r.freshAt ?? null;
  return {
    def, value: r.value, display: formatMetric(def, r.value), numerator: r.num, denominator: r.den, ids: r.ids,
    entity: def.entity, period: def.periodDays ? { start, end } : null,
    partial: !!r.partial, stale: !!r.stale, notes: r.notes, missing: r.missing || [],
    freshness: { label: live ? "Live in Pulse" : r.stale ? "Partly stale" : freshAt ? "From last sync" : "Entered in Pulse", at: freshAt },
    sources: r.sources || (live ? ["pulse"] : []),
    previous, target: def.target,
    delta: previous && previous.value !== null && r.value !== null ? r.value - previous.value : null
  };
}

/** The same metric across units (or teams), each computed from its own totals. */
export function compareMetric(s: CoreState, ctx: Ctx, metricId: string, by: "unit" | "team"): { key: string; label: string; scope: ScopeSel; result: MetricResult }[] {
  const q = query(s, ctx);
  const v = q.viewer;
  const rows: { key: string; label: string; scope: ScopeSel; result: MetricResult }[] = [];
  if (by === "unit") {
    const ids = v.isOrgWide ? s.config.units.map((u) => u.id) : v.overseenUnitIds;
    for (const id of ids) {
      if (ctx.scope.kind === "unit" && ctx.scope.id !== id) continue;
      const scope: ScopeSel = { kind: "unit", id };
      const res = computeMetric(s, { ...ctx, scope }, metricId);
      if (res) rows.push({ key: "unit:" + id, label: s.config.units.find((u) => u.id === id)!.label, scope, result: res });
    }
  } else {
    const visibleTeams = v.isOrgWide ? s.config.teams.map((t) => t.id) : [...new Set([...v.overseenTeamIds, ...v.memberTeamIds])];
    for (const id of visibleTeams) {
      const t = s.config.teams.find((x) => x.id === id)!;
      if (ctx.scope.kind === "unit" && t.unitId !== ctx.scope.id) continue;
      if (ctx.scope.kind === "team" && ctx.scope.id !== id) continue;
      const scope: ScopeSel = { kind: "team", id };
      const res = computeMetric(s, { ...ctx, scope }, metricId);
      if (res) rows.push({ key: "team:" + id, label: t.label, scope, result: res });
    }
  }
  return rows;
}

/** Weekly series for a trend line, built from the same calculation. */
export function metricSeries(s: CoreState, ctx: Ctx, metricId: string, points = 8): { at: string; value: number | null }[] {
  const def = s.config.metrics.find((m) => m.id === metricId);
  if (!def || !def.periodDays) return [];
  const out: { at: string; value: number | null }[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const end = new Date(ms(ctx.now) - i * 7 * DAY).toISOString();
    const r = computeMetric(s, { ...ctx, now: end }, metricId);
    out.push({ at: end, value: r ? r.value : null });
  }
  return out;
}
