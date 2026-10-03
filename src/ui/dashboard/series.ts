/* Weekly series for sparklines and column charts. Period measures use the
   metric engine's own metricSeries (the same calculation at each week end).
   Snapshot measures have no history, so their bars count real events by week
   from the objects' own timestamps, and say which events they count. Nothing
   is estimated or filled in. */

import { metricSeries, formatMetric, personRows, DAY, ms, type CoreState, type Ctx, type Id, type Q } from "../../core";

export interface WeekPoint { label: string; start: string; end: string; value: number | null; display: string; ids: Id[] }

export interface WeekSeries {
  /** What the bars count, in plain words. */
  caption: string;
  /** Short unit tag for chart headers. */
  unit: string;
  points: WeekPoint[];
  /** Entity of the ids in each point, when the points carry ids. */
  entity: "task" | "record" | "issue" | "person" | null;
  /** Points are metric values (rolling) rather than event counts. */
  rolling: boolean;
}

const dayFmt = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" });

/** n weekly windows ending now (past) or starting now (next). */
export function weeks(now: string, n: number, dir: "past" | "next" = "past"): { start: string; end: string }[] {
  const t = ms(now);
  const out: { start: string; end: string }[] = [];
  for (let i = 0; i < n; i++) {
    const k = dir === "past" ? n - 1 - i : i;
    const a = dir === "past" ? t - (k + 1) * 7 * DAY : t + k * 7 * DAY;
    out.push({ start: new Date(a).toISOString(), end: new Date(a + 7 * DAY).toISOString() });
  }
  return out;
}

/** Count objects into weekly windows by a timestamp. */
export function countByWeek<T>(items: T[], at: (x: T) => string | null | undefined, id: (x: T) => Id, wins: { start: string; end: string }[], tz: string): WeekPoint[] {
  const f = dayFmt(tz);
  return wins.map((w) => {
    const hit = items.filter((x) => { const a = at(x); return !!a && a > w.start && a <= w.end; });
    return { label: f.format(new Date(w.start)), start: w.start, end: w.end, value: hit.length, display: String(hit.length), ids: hit.map(id) };
  });
}

/** Weekly series for a metric, or null when nothing honest can be drawn. */
export function weeklySeries(core: CoreState, ctx: Ctx, q: Q, metricId: string, n = 8): WeekSeries | null {
  const def = core.config.metrics.find((m) => m.id === metricId);
  if (!def) return null;
  const tz = core.config.timezone;
  const f = dayFmt(tz);
  if (def.periodDays > 0) {
    const pts = metricSeries(core, ctx, metricId, n).map((p) => {
      const start = new Date(ms(p.at) - 7 * DAY).toISOString();
      return { label: f.format(new Date(start)), start, end: p.at, value: p.value, display: p.value === null ? "none" : formatMetric(def, p.value), ids: [] };
    });
    return { caption: "Rolling " + def.periodDays + " days, weekly", unit: def.unit === "percent" ? "%" : def.unit === "hours" ? "HOURS" : def.unit === "money" ? (def.currency || "EUR") : "COUNT",
      points: pts, entity: null, rolling: true };
  }
  const past = weeks(ctx.now, n, "past");
  const next = weeks(ctx.now, n, "next");
  const ev = (caption: string, points: WeekPoint[], entity: WeekSeries["entity"]): WeekSeries => ({ caption, unit: "COUNT", points, entity, rolling: false });
  switch (metricId) {
    case "backlog":
      return ev("Tasks created per week", countByWeek(q.tasks(), (t) => t.createdAt, (t) => t.id, past, tz), "task");
    case "overdue": {
      /* A task went overdue in the week its due time passed while it was still open. */
      const late = q.tasks().filter((t) => t.dueAt && t.status !== "cancelled" && ms(t.dueAt) <= ms(ctx.now)
        && (q.isOpenTask(t) || (t.completedAt && ms(t.completedAt) > ms(t.dueAt))));
      return ev("Tasks that went overdue per week", countByWeek(late, (t) => t.dueAt, (t) => t.id, past, tz), "task");
    }
    case "completeness":
      return ev("Records added per week", countByWeek(q.records(), (r) => r.createdAt, (r) => r.id, past, tz), "record");
    case "issues":
      return ev("Issues found per week", countByWeek(q.issues(), (i) => i.detectedAt, (i) => i.id, past, tz), "issue");
    case "staleRecords": {
      const last = (r: { sourceRefs: { syncedAt: string | null }[] }) => r.sourceRefs.map((x) => x.syncedAt).filter((x): x is string => !!x).sort().pop();
      return ev("Records by week of last sync", countByWeek(q.records().filter((r) => r.sourceRefs.some((x) => x.syncedAt)), last, (r) => r.id, past, tz), "record");
    }
    case "headcount":
      return ev("Starters per week", countByWeek(personRows(q), (r) => r.e.startDate, (r) => r.person.id, past, tz), "person");
    case "certCompliance": {
      const certs = personRows(q).flatMap((r) => r.certs.filter((c) => c.cert.expires).map((c) => ({ at: c.cert.expires as string, id: r.person.id })));
      return ev("Certificates expiring per week, next " + n + " weeks", countByWeek(certs, (c) => c.at, (c) => c.id, next, tz), "person");
    }
    case "awayToday": {
      const rows = personRows(q);
      const ids = new Set(rows.map((r) => r.person.id));
      const leave = q.s.data.leave.filter((l) => l.status === "approved" && ids.has(l.personId));
      const pts = next.map((w) => {
        const who = [...new Set(leave.filter((l) => l.from <= w.end && l.to >= w.start).map((l) => l.personId))];
        return { label: f.format(new Date(w.start)), start: w.start, end: w.end, value: who.length, display: String(who.length), ids: who };
      });
      return ev("People on leave per week, next " + n + " weeks", pts, "person");
    }
  }
  return null;
}

/** Duplicate issues still open in scope. */
export const openDuplicates = (q: Q) => q.issues().filter((i) => i.kind === "duplicate" && (i.state === "open" || i.state === "in_progress"));
