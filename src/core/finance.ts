/* Finance capability (optional module).

   Rules this file keeps everywhere:
   - Orders, commitments, invoices and payments are different stages of the
     same spend. They are reported side by side and never added together as
     if they were separate spend. "Committed" is only the part of an open
     order not yet invoiced, so committed and invoiced never overlap; "paid"
     is part of invoiced and is never subtracted again.
   - Currencies are never combined. Rows in another currency are reported
     separately with a note; nothing is converted.
   - Missing is not zero: a month without a plan has no plan, not a plan of 0.
   - Source update time, ingestion time and the source's last successful sync
     are kept apart.
   - Reading needs finance.view; changing needs finance.manage. Lists apply
     the viewer's permissions and the selected scope through the query layer. */

import { can, viewerOf } from "./access";
import { registerMetric } from "./metrics";
import { moduleEnabled } from "./modules";
import { draft, logEvent, nid, type Result } from "./ops";
import type { Q } from "./query";
import { addDays, DAY, ms } from "./time";
import type {
  Budget, CoreState, Ctx, Id, ISO, PurchaseOrder, Receivable, SupplierInvoice, Transaction
} from "./types";

export interface BudgetPosition {
  approved: number;
  /** Open orders (approved, sent, received), not yet invoiced in full. */
  committed: number;
  invoiced: number;
  paid: number;
  remaining: number;
  currency: string;
  orderIds: Id[];
  invoiceIds: Id[];
  transactionIds: Id[];
  notes: string[];
}

/** Plain definitions shown next to every stage figure. */
export const STAGE_DEFINITIONS: Record<"approved" | "committed" | "invoiced" | "paid" | "remaining", string> = {
  approved: "The amount approved for this budget.",
  committed: "The part of open purchase orders not yet invoiced. It never overlaps with invoiced.",
  invoiced: "Supplier invoices received against orders on this budget, excluding rejected invoices and possible duplicates.",
  paid: "Payments reported by the accounting source. Paid is part of invoiced, not extra spend.",
  remaining: "Approved minus committed minus invoiced. Paid is not subtracted again."
};

/** Order states that still hold a commitment. Draft, closed and cancelled orders do not. */
export const OPEN_ORDER: PurchaseOrder["status"][] = ["approved", "sent", "part_received", "received"];

/** An invoice counts towards spend unless it was rejected or is flagged as a possible duplicate. */
export const countsAsInvoiced = (inv: SupplierInvoice) => inv.status !== "rejected" && !inv.flags.includes("duplicate");

/** Invoiced amount on one order, in the order's own currency, from counted invoices only. */
export function invoicedOnOrder(s: CoreState, o: PurchaseOrder, exceptInvoiceId?: Id): number {
  return s.data.invoices.filter((i) => i.orderId === o.id && i.id !== exceptInvoiceId && countsAsInvoiced(i) && i.currency === o.currency)
    .reduce((n, i) => n + i.amount, 0);
}

/** The committed part of an order: what is still open and not yet invoiced. */
export function openCommitment(s: CoreState, o: PurchaseOrder): number {
  if (!OPEN_ORDER.includes(o.status)) return 0;
  return Math.max(0, o.total - invoicedOnOrder(s, o));
}

const fmtN = (n: number) => new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(n);

/** Money with its currency code, e.g. "EUR 12,600". Never converted. */
export function fmtMoney(n: number | null | undefined, currency: string): string {
  if (n === null || n === undefined || !isFinite(n)) return "No data";
  return (n < 0 ? "-" : "") + currency + " " + fmtN(Math.abs(n));
}

/** Where a budget stands. Stages are reported side by side, never added together. */
export function budgetPosition(s: CoreState, budgetId: Id): BudgetPosition | null {
  const b = s.data.budgets.find((x) => x.id === budgetId);
  if (!b) return null;
  const notes: string[] = [];
  const orders = s.data.orders.filter((o) => o.budgetId === b.id && o.status !== "draft" && o.status !== "cancelled");
  const foreign = orders.filter((o) => o.currency !== b.currency);
  if (foreign.length) notes.push(foreign.length + " order" + (foreign.length === 1 ? " is" : "s are") + " in another currency (" + [...new Set(foreign.map((o) => o.currency))].join(", ")
    + ") and not counted in this " + b.currency + " budget: " + foreign.map((o) => o.ref).join(", ") + ".");
  const same = orders.filter((o) => o.currency === b.currency);

  let committed = 0;
  const orderIds: Id[] = [];
  for (const o of same) {
    const open = openCommitment(s, o);
    if (open > 0) { committed += open; orderIds.push(o.id); }
  }

  const onBudget = s.data.invoices.filter((i) => same.some((o) => o.id === i.orderId));
  const counted = onBudget.filter((i) => countsAsInvoiced(i) && i.currency === b.currency);
  const dup = onBudget.filter((i) => i.flags.includes("duplicate") && i.status !== "rejected");
  const rejected = onBudget.filter((i) => i.status === "rejected");
  const otherCur = onBudget.filter((i) => countsAsInvoiced(i) && i.currency !== b.currency);
  if (dup.length) notes.push(dup.length + " possible duplicate invoice" + (dup.length === 1 ? " is" : "s are") + " not counted until reviewed (" + dup.map((i) => i.ref).join(", ") + ").");
  if (rejected.length) notes.push(rejected.length + " rejected invoice" + (rejected.length === 1 ? " is" : "s are") + " not counted.");
  if (otherCur.length) notes.push(otherCur.length + " invoice" + (otherCur.length === 1 ? " is" : "s are") + " in another currency and not counted: " + otherCur.map((i) => i.ref + " (" + i.currency + ")").join(", ") + ".");
  const exceptions = counted.filter((i) => i.status === "exception" || i.status === "in_review");
  if (exceptions.length) notes.push("Invoiced includes " + exceptions.length + " invoice" + (exceptions.length === 1 ? "" : "s") + " still in matching review.");
  const invoiced = counted.reduce((n, i) => n + i.amount, 0);

  const countedIds = new Set(counted.map((i) => i.id));
  const pays = s.data.transactions.filter((t) => t.kind === "payment_out" && (t.budgetId === b.id || (!!t.invoiceId && countedIds.has(t.invoiceId))));
  const paySame = pays.filter((t) => t.currency === b.currency);
  if (pays.length > paySame.length) notes.push((pays.length - paySame.length) + " payment" + (pays.length - paySame.length === 1 ? " is" : "s are") + " in another currency and not counted.");
  const direct = paySame.filter((t) => !t.invoiceId || !countedIds.has(t.invoiceId));
  if (direct.length) notes.push(direct.length + " payment" + (direct.length === 1 ? "" : "s") + " (" + fmtMoney(direct.reduce((n, t) => n + Math.abs(t.amount), 0), b.currency)
    + ") came from the accounting source without an invoice in Pulse. It counts as paid, not as invoiced.");
  const paid = paySame.reduce((n, t) => n + Math.abs(t.amount), 0);

  const remaining = b.approved - committed - invoiced;
  if (remaining < 0) notes.push("Committed and invoiced together exceed the approved amount by " + fmtMoney(-remaining, b.currency) + ".");
  return { approved: b.approved, committed, invoiced, paid, remaining, currency: b.currency, orderIds, invoiceIds: counted.map((i) => i.id), transactionIds: paySame.map((t) => t.id), notes };
}

/** Every order on a budget (supporting records), in any state and currency. */
export const budgetOrders = (s: CoreState, budgetId: Id) => s.data.orders.filter((o) => o.budgetId === budgetId);

/* ── Plan versus actual by month ───────────────────────────────────────── */

export interface MonthRow {
  month: string;
  /** Null when the plan has no figure for the month. Missing is not zero. */
  planned: number | null;
  invoiced: number;
  paid: number;
  invoiceIds: Id[];
  transactionIds: Id[];
  /** Invoiced minus planned; null when there is no plan for the month. */
  variance: number | null;
}

const monthOf = (at: string) => at.slice(0, 7);

export function budgetMonths(from: ISO, to: ISO): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  for (let i = 0; i < 60; i++) {
    const key = y + "-" + String(m).padStart(2, "0");
    out.push(key);
    if (key >= end) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function planVsActual(s: CoreState, budgetId: Id): MonthRow[] {
  const b = s.data.budgets.find((x) => x.id === budgetId);
  const pos = budgetPosition(s, budgetId);
  if (!b || !pos) return [];
  const invs = s.data.invoices.filter((i) => pos.invoiceIds.includes(i.id));
  const txs = s.data.transactions.filter((t) => pos.transactionIds.includes(t.id));
  return budgetMonths(b.periodFrom, b.periodTo).map((month) => {
    const mi = invs.filter((i) => monthOf(i.issuedAt) === month);
    const mt = txs.filter((t) => monthOf(t.date) === month);
    const planned = typeof b.plan[month] === "number" ? b.plan[month] : null;
    const invoiced = mi.reduce((n, i) => n + i.amount, 0);
    return { month, planned, invoiced, paid: mt.reduce((n, t) => n + Math.abs(t.amount), 0), invoiceIds: mi.map((i) => i.id), transactionIds: mt.map((t) => t.id),
      variance: planned === null ? null : invoiced - planned };
  });
}

/* ── Access and scope ──────────────────────────────────────────────────── */

export function financeAccess(q: Q): { view: boolean; manage: boolean; reason: string | null } {
  const view = can(q.viewer, "finance.view");
  return { view, manage: view && can(q.viewer, "finance.manage"),
    reason: view ? null : "Finance figures need the finance.view permission. Your role does not have it." };
}

const unitOfTeam = (s: CoreState, teamId?: Id) => s.config.teams.find((t) => t.id === teamId)?.unitId;

/** Team and unit an order belongs to (its own tags, else its budget's or project's). */
export function orderPlace(s: CoreState, o: PurchaseOrder): { teamId?: Id; unitId?: Id } {
  const b = s.data.budgets.find((x) => x.id === o.budgetId);
  const p = s.data.projects.find((x) => x.id === o.projectId);
  const teamId = o.teamId || b?.teamId || p?.teamId;
  return { teamId, unitId: o.unitId || b?.unitId || p?.unitId || unitOfTeam(s, teamId) };
}

export function budgetPlace(s: CoreState, b: Budget): { teamId?: Id; unitId?: Id } {
  const p = s.data.projects.find((x) => x.id === b.projectId);
  const teamId = b.teamId || p?.teamId;
  return { teamId, unitId: b.unitId || p?.unitId || unitOfTeam(s, teamId) };
}

/** Team and unit of a transaction, from whatever it is linked to. */
export function transactionPlace(s: CoreState, t: Transaction): { teamId?: Id; unitId?: Id } {
  const b = s.data.budgets.find((x) => x.id === t.budgetId);
  if (b) return budgetPlace(s, b);
  const inv = s.data.invoices.find((x) => x.id === t.invoiceId);
  const o = inv && s.data.orders.find((x) => x.id === inv.orderId);
  if (o) return orderPlace(s, o);
  const r = s.data.receivables.find((x) => x.id === t.receivableId);
  if (r) return { unitId: r.unitId };
  const p = s.data.projects.find((x) => x.id === t.projectId);
  if (p) return { teamId: p.teamId, unitId: p.unitId || unitOfTeam(s, p.teamId) };
  return {};
}

/** Budgets the viewer may see, in the selected scope. Empty without finance.view. */
export function budgetsFor(q: Q, opt?: { ignoreScope?: boolean }): Budget[] {
  if (!financeAccess(q).view) return [];
  return q.s.data.budgets.filter((b) => {
    const pl = budgetPlace(q.s, b);
    return q.canSee({ ownerIds: [b.ownerId], ...pl, visibility: "unit" }) && q.inScope(pl, [b.ownerId], opt);
  });
}

export function receivablesFor(q: Q, opt?: { ignoreScope?: boolean }): Receivable[] {
  if (!financeAccess(q).view) return [];
  return q.s.data.receivables.filter((r) => {
    const pl = { unitId: r.unitId };
    return q.canSee({ ownerIds: [], ...pl, visibility: "unit" }) && q.inScope(pl, [], opt);
  });
}

export function transactionsFor(q: Q, opt?: { ignoreScope?: boolean }): Transaction[] {
  if (!financeAccess(q).view) return [];
  return q.s.data.transactions.filter((t) => {
    const pl = transactionPlace(q.s, t);
    return q.canSee({ ownerIds: [], ...pl, visibility: "unit" }) && q.inScope(pl, [], opt);
  });
}

/* ── Receivables ───────────────────────────────────────────────────────── */

export const receivableOutstanding = (r: Receivable) => (r.status === "paid" || r.status === "written_off" ? 0 : Math.max(0, r.amount - r.paidAmount));
export const receivableDaysOverdue = (r: Receivable, now: ISO) => (receivableOutstanding(r) > 0 && ms(r.dueAt) < ms(now) ? Math.floor((ms(now) - ms(r.dueAt)) / DAY) : 0);

export const AGE_BUCKETS = [
  { id: "current", label: "Not yet due" },
  { id: "d30", label: "1 to 30 days overdue" },
  { id: "d60", label: "31 to 60 days overdue" },
  { id: "d90", label: "61 to 90 days overdue" },
  { id: "d90p", label: "Over 90 days overdue" }
] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number]["id"];

export function ageBucket(r: Receivable, now: ISO): AgeBucket {
  const d = receivableDaysOverdue(r, now);
  return d === 0 ? "current" : d <= 30 ? "d30" : d <= 60 ? "d60" : d <= 90 ? "d90" : "d90p";
}

/** Ageing per currency. Currencies are never added together. */
export function receivablesAgeing(rows: Receivable[], now: ISO): { currency: string; buckets: Record<AgeBucket, { amount: number; ids: Id[] }>; total: number }[] {
  const byCur = new Map<string, Receivable[]>();
  for (const r of rows) if (receivableOutstanding(r) > 0) byCur.set(r.currency, [...(byCur.get(r.currency) || []), r]);
  return [...byCur.entries()].map(([currency, list]) => {
    const buckets = Object.fromEntries(AGE_BUCKETS.map((b) => [b.id, { amount: 0, ids: [] as Id[] }])) as Record<AgeBucket, { amount: number; ids: Id[] }>;
    for (const r of list) { const b = buckets[ageBucket(r, now)]; b.amount += receivableOutstanding(r); b.ids.push(r.id); }
    return { currency, buckets, total: list.reduce((n, r) => n + receivableOutstanding(r), 0) };
  });
}

/** Sum by currency. Never one combined figure. */
export function sumByCurrency<T>(rows: T[], amount: (r: T) => number, currency: (r: T) => string): { currency: string; amount: number; n: number }[] {
  const m = new Map<string, { amount: number; n: number }>();
  for (const r of rows) {
    const c = currency(r);
    const cur = m.get(c) || { amount: 0, n: 0 };
    cur.amount += amount(r);
    cur.n += 1;
    m.set(c, cur);
  }
  return [...m.entries()].map(([c, v]) => ({ currency: c, ...v }));
}

/* ── Payables and dated obligations ────────────────────────────────────── */

/** Supplier invoices still to pay: not paid, not rejected, not a possible duplicate. */
export const isPayable = (i: SupplierInvoice) => i.status !== "paid" && i.status !== "rejected" && !i.flags.includes("duplicate");

export interface DueItem {
  key: string;
  date: ISO;
  direction: "in" | "out";
  kind: "receivable" | "invoice";
  id: Id;
  label: string;
  counterparty: string;
  amount: number;
  currency: string;
  overdue: boolean;
  state: string;
}

/** Incoming (receivables) and outgoing (supplier invoices) amounts by date. */
export function obligationsAhead(q: Q, invoices: SupplierInvoice[], days: number): DueItem[] {
  const now = q.ctx.now;
  const until = addDays(now, days);
  const sup = (id: Id) => q.s.data.suppliers.find((x) => x.id === id)?.name || "Unknown supplier";
  const out: DueItem[] = [];
  for (const r of receivablesFor(q)) {
    const amt = receivableOutstanding(r);
    if (amt <= 0 || r.dueAt > until) continue;
    out.push({ key: "r:" + r.id, date: r.dueAt, direction: "in", kind: "receivable", id: r.id, label: r.ref, counterparty: r.counterparty, amount: amt, currency: r.currency,
      overdue: ms(r.dueAt) < ms(now), state: r.status === "part_paid" ? "Part paid" : "Open" });
  }
  for (const i of invoices) {
    if (!isPayable(i) || i.dueAt > until) continue;
    out.push({ key: "i:" + i.id, date: i.dueAt, direction: "out", kind: "invoice", id: i.id, label: i.ref, counterparty: sup(i.supplierId), amount: i.amount, currency: i.currency,
      overdue: ms(i.dueAt) < ms(now), state: INVOICE_STATUS[i.status] });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const INVOICE_STATUS: Record<SupplierInvoice["status"], string> = {
  received: "Received", matched: "Matched", exception: "Exception", in_review: "In review", approved: "Approved for payment", rejected: "Rejected", paid: "Paid"
};

/* ── Cash outlook ──────────────────────────────────────────────────────── */

export interface CashWeek { from: ISO; to: ISO; incoming: number; outgoing: number; balance: number; ids: Id[] }

export type CashOutlook =
  | { available: false; reason: string; missing: string[] }
  | {
      available: true;
      currency: string;
      opening: { amount: number; asOf: ISO; sourceLabel: string };
      sinceOpening: { amount: number; transactionIds: Id[] };
      startBalance: number;
      weeks: CashWeek[];
      assumptions: string[];
      missing: string[];
    };

/** A simple cash outlook. Drawn only when an opening balance exists, and only for the whole organisation. */
export function cashOutlook(q: Q, weeks = 8): CashOutlook {
  const s = q.s;
  const cur = s.config.finance.reportingCurrency;
  if (!financeAccess(q).view) return { available: false, reason: "Needs the finance.view permission.", missing: [] };
  const ob = s.config.finance.openingBalance;
  if (!ob) return { available: false, reason: "No opening balance is configured, so no cash outlook is drawn. An administrator can set one in Settings, Control, Purchasing and finance rules.",
    missing: ["Opening bank balance and the date it applies from"] };
  if (q.ctx.scope.kind !== "organisation") return { available: false, reason: "Cash is held by the whole organisation, so the outlook is only drawn in the whole organisation scope. Mixing one unit's payments with the organisation's bank balance would mislead.", missing: [] };
  const srcLabel = s.config.sources.find((x) => x.id === ob.sourceId)?.label || "Unknown source";
  const now = q.ctx.now;
  const assumptions: string[] = [
    "Starts from the opening balance of " + fmtMoney(ob.amount, cur) + " reported by " + srcLabel + ", plus transactions dated after it.",
    "Receivables are paid in full on their due date.",
    "Supplier invoices are paid on their due date, including those still in review. Possible duplicates and rejected invoices are left out.",
    "Only " + cur + " amounts are included. Nothing is converted."
  ];
  const missing: string[] = ["Payroll, tax and other regular payments are not held in Pulse and are not included."];
  const txs = s.data.transactions.filter((t) => t.date > ob.asOf && t.date <= now);
  const txSame = txs.filter((t) => t.currency === cur);
  if (txs.length > txSame.length) missing.push((txs.length - txSame.length) + " transaction" + (txs.length - txSame.length === 1 ? "" : "s") + " in another currency left out.");
  const since = txSame.reduce((n, t) => n + t.amount, 0);
  const start = ob.amount + since;
  const recs = s.data.receivables.filter((r) => receivableOutstanding(r) > 0);
  const overdueRecs = recs.filter((r) => ms(r.dueAt) < ms(now));
  if (overdueRecs.length) missing.push(overdueRecs.length + " overdue receivable" + (overdueRecs.length === 1 ? "" : "s") + " (" + sumByCurrency(overdueRecs, receivableOutstanding, (r) => r.currency).map((x) => fmtMoney(x.amount, x.currency)).join(", ")
    + ") left out: there is no expected payment date.");
  const otherRecs = recs.filter((r) => r.currency !== cur);
  if (otherRecs.length) missing.push(otherRecs.length + " receivable" + (otherRecs.length === 1 ? "" : "s") + " in another currency left out.");
  const pay = s.data.invoices.filter(isPayable);
  const otherPay = pay.filter((i) => i.currency !== cur);
  if (otherPay.length) missing.push(otherPay.length + " supplier invoice" + (otherPay.length === 1 ? "" : "s") + " in another currency left out.");
  const overduePay = pay.filter((i) => i.currency === cur && ms(i.dueAt) < ms(now));
  if (overduePay.length) assumptions.push(overduePay.length + " supplier invoice" + (overduePay.length === 1 ? " is" : "s are") + " already past due and counted in the first week.");
  const openOrders = s.data.orders.filter((o) => openCommitment(s, o) > 0);
  if (openOrders.length) missing.push(openOrders.length + " open order" + (openOrders.length === 1 ? "" : "s") + " not yet invoiced (" + sumByCurrency(openOrders, (o) => openCommitment(s, o), (o) => o.currency).map((x) => fmtMoney(x.amount, x.currency)).join(", ")
    + ") left out: no invoice, so no due date.");

  const out: CashWeek[] = [];
  let bal = start;
  for (let w = 0; w < weeks; w++) {
    const from = addDays(now, 7 * w), to = addDays(now, 7 * (w + 1));
    const inRange = (d: ISO) => (w === 0 ? d <= to : d > from && d <= to);
    const ins = recs.filter((r) => r.currency === cur && ms(r.dueAt) >= ms(now) && inRange(r.dueAt));
    const outs = pay.filter((i) => i.currency === cur && inRange(i.dueAt));
    const incoming = ins.reduce((n, r) => n + receivableOutstanding(r), 0);
    const outgoing = outs.reduce((n, i) => n + i.amount, 0);
    bal += incoming - outgoing;
    out.push({ from, to, incoming, outgoing, balance: bal, ids: [...ins.map((r) => r.id), ...outs.map((i) => i.id)] });
  }
  return { available: true, currency: cur, opening: { amount: ob.amount, asOf: ob.asOf, sourceLabel: srcLabel }, sinceOpening: { amount: since, transactionIds: txSame.map((t) => t.id) },
    startBalance: start, weeks: out, assumptions, missing };
}

/* ── Freshness ─────────────────────────────────────────────────────────── */

export interface SourceFreshness {
  sourceId: string | null;
  label: string;
  kind: "pulse" | "sample" | "external" | "none";
  connected: boolean;
  status: string;
  lastSuccessAt: ISO | null;
  lastAttemptAt: ISO | null;
  message: string;
  prerequisite: string;
}

/** The accounting source and its last successful sync, kept apart from row times. */
export function accountingFreshness(s: CoreState): SourceFreshness {
  const id = s.config.finance.accountingSourceId;
  const src = id ? s.config.sources.find((x) => x.id === id) : undefined;
  if (!src) return { sourceId: null, label: "No accounting source", kind: "none", connected: false, status: "not_connected", lastSuccessAt: null, lastAttemptAt: null,
    message: "No accounting source is configured. Payments and transactions cannot be read.", prerequisite: "Add a read-only accounting connection in Settings, Systems, Connections." };
  const sync = s.data.sync.find((x) => x.sourceId === src.id);
  return { sourceId: src.id, label: src.label, kind: src.kind, connected: src.connected, status: sync?.status || "not_connected",
    lastSuccessAt: sync?.lastSuccessAt || null, lastAttemptAt: sync?.lastAttemptAt || null, message: sync?.message || "", prerequisite: src.prerequisite };
}

/* ── Changes (finance.manage) ──────────────────────────────────────────── */

export interface NewBudget {
  label: string;
  ownerId: Id;
  currency: string;
  approved: number;
  periodFrom: string;
  periodTo: string;
  projectId?: Id;
  unitId?: Id;
  teamId?: Id;
}

export function createBudget(s0: CoreState, ctx: Ctx, n: NewBudget): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "finance.manage")) return { ok: false, error: "Creating a budget needs the finance.manage permission." };
  if (!moduleEnabled(s0.config, "finance")) return { ok: false, error: "Finance is turned off for this organisation." };
  if (!n.label.trim()) return { ok: false, error: "Give the budget a name." };
  if (!(n.approved > 0)) return { ok: false, error: "Enter an approved amount above 0." };
  if (!/^[A-Z]{3}$/.test(n.currency)) return { ok: false, error: "Use a three-letter currency code, such as EUR." };
  if (isNaN(Date.parse(n.periodFrom)) || isNaN(Date.parse(n.periodTo)) || n.periodTo < n.periodFrom) return { ok: false, error: "Give a valid period: the end must be after the start." };
  if (!s0.data.people.some((p) => p.id === n.ownerId)) return { ok: false, error: "Choose an owner." };
  if (n.projectId && !s0.data.projects.some((p) => p.id === n.projectId)) return { ok: false, error: "That project no longer exists." };
  const s = draft(s0);
  const id = nid(s, "bg");
  const toIso = (d: string) => (d.length === 10 ? d + "T00:00:00.000Z" : d);
  s.data.budgets.push({ id, label: n.label.trim(), ownerId: n.ownerId, projectId: n.projectId, unitId: n.unitId, teamId: n.teamId, currency: n.currency, approved: n.approved,
    periodFrom: toIso(n.periodFrom), periodTo: toIso(n.periodTo), plan: {} });
  logEvent(s, ctx, { action: "budget.created", objectType: "budget", objectId: id, recordIds: [], teamId: n.teamId, unitId: n.unitId, storyKey: "budget:" + id,
    summary: "Created budget " + n.label.trim() + " (" + fmtMoney(n.approved, n.currency) + ")" });
  return { ok: true, state: s, message: "Budget created. Add a monthly plan to compare planned and actual spend.", id };
}

/* ── Metrics ───────────────────────────────────────────────────────────── */

registerMetric("overdueReceivables", (q, def) => {
  if (!moduleEnabled(q.s.config, "finance")) return { value: null, ids: [], notes: ["Finance is turned off."] };
  if (!financeAccess(q).view) return { value: null, ids: [], notes: ["Needs the finance.view permission."] };
  const cur = def.currency || q.s.config.finance.reportingCurrency;
  const all = receivablesFor(q);
  const overdue = all.filter((r) => receivableDaysOverdue(r, q.ctx.now) > 0);
  const same = overdue.filter((r) => r.currency === cur);
  const other = overdue.filter((r) => r.currency !== cur);
  const notes = ["Outstanding amount on receivables past their due date, in " + cur + "."];
  if (other.length) notes.push(other.length + " overdue receivable" + (other.length === 1 ? " is" : "s are") + " in another currency and reported separately: "
    + sumByCurrency(other, receivableOutstanding, (r) => r.currency).map((x) => fmtMoney(x.amount, x.currency)).join(", ") + ".");
  const fr = accountingFreshness(q.s);
  return { value: all.length ? same.reduce((n, r) => n + receivableOutstanding(r), 0) : null, ids: same.map((r) => r.id), notes, partial: other.length > 0,
    sources: fr.sourceId ? [fr.sourceId] : [], freshAt: fr.lastSuccessAt };
});
