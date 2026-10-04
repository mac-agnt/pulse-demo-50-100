/* Purchasing capability (optional module).

   One canonical object each: a purchase request is a RequestItem (form
   form-purchase) and shows in Work; an invoice review is a RequestItem (form
   form-invoice-review) decided through the shared approval model. Approval
   is recorded separately from execution: approving a purchase request does
   not create the order until the approved action runs, and approving an
   invoice review marks the invoice approved for payment without paying it.

   Nothing here talks to a supplier, a bank or a ledger. Sending an order
   needs a connected ordering source and otherwise fails honestly. Payment
   status only changes when a transaction arrives from the accounting source. */

import { can, viewerOf, type Viewer } from "./access";
import { fmtMoney, invoicedOnOrder, isPayable, openCommitment, orderPlace, OPEN_ORDER } from "./finance";
import { registerMetric } from "./metrics";
import { moduleEnabled } from "./modules";
import { createRequest, draft, logEvent, nid, registerDecisionHook, registerEffect, type Result } from "./ops";
import type { Q } from "./query";
import { ms } from "./time";
import type {
  ApprovalRuleDef, CoreState, Ctx, GoodsReceipt, Id, ISO, MatchFlag, OrgConfig, PurchaseOrder, RequestFormDef, RequestItem,
  Supplier, SupplierInvoice, Transaction
} from "./types";

export const PURCHASE_FORM_ID = "form-purchase";
export const INVOICE_REVIEW_FORM_ID = "form-invoice-review";
export const PURCHASE_CURRENCIES = ["EUR", "GBP", "USD"];

const fail = (error: string): Result => ({ ok: false, error });

/* ── Configuration defaults (forms and approval rules) ─────────────────── */

export function supplierOptions(suppliers: Supplier[]) {
  return suppliers.map((x) => ({ value: x.id, label: x.name + (x.status === "blocked" ? " (blocked)" : "") }));
}

/** The purchase request and invoice review forms with their approval rules. */
export function purchasingForms(c: OrgConfig, suppliers: Supplier[]): { forms: RequestFormDef[]; rules: ApprovalRuleDef[] } {
  return {
    forms: [
      { id: PURCHASE_FORM_ID, label: "Purchase request", description: "Ask to buy goods or services from a supplier. Once approved, running the approved action creates the purchase order in Purchasing.",
        fields: [
          { key: "supplierId", label: "Supplier", kind: "select", required: true, material: true, options: supplierOptions(suppliers) },
          { key: "description", label: "What is needed", kind: "longtext", required: true, material: true },
          { key: "amount", label: "Amount", kind: "money", currency: c.finance.reportingCurrency, required: true, material: true, min: 0.01,
            help: "Above 5,000 a second decision from an administrator is needed." },
          { key: "currency", label: "Currency", kind: "select", required: true, material: true, options: PURCHASE_CURRENCIES.map((x) => ({ value: x, label: x })) },
          { key: "projectId", label: "Project reference", kind: "text", required: false, help: "Optional. Chosen from the project list in Purchasing." },
          { key: "budgetId", label: "Budget reference", kind: "text", required: false, material: true, help: "Optional. Chosen from the budget list in Purchasing when Finance is on." },
          { key: "neededBy", label: "Needed by", kind: "date", required: true }
        ],
        evidenceRequired: false, approvalRuleId: "rule-purchase", tasks: [],
        effect: { kind: "create-purchase-order", label: "Create the purchase order" }, enabled: true },
      { id: INVOICE_REVIEW_FORM_ID, label: "Invoice review", description: "Review a supplier invoice that does not match its order or receipt. Approving marks it approved for payment; it does not pay it.",
        fields: [
          { key: "invoiceId", label: "Invoice", kind: "text", required: true, material: true },
          { key: "reason", label: "Why it needs review", kind: "longtext", required: true },
          { key: "amount", label: "Invoice amount", kind: "money", required: true, material: true },
          { key: "orderTotal", label: "Order total", kind: "money", required: false }
        ],
        evidenceRequired: false, approvalRuleId: "rule-invoice-review",
        tasks: [{ title: "Check the invoice against its order and receipt", checklist: ["Compare the amounts line by line", "Confirm what was received", "Note the reason for any difference"] }],
        effect: { kind: "approve-invoice", label: "Approve the invoice for payment" }, enabled: true }
    ],
    rules: [
      { id: "rule-purchase", label: "Purchase request", formId: PURCHASE_FORM_ID, prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
        stages: [
          { id: "st-mgr", label: "Team manager", eligibleRoles: ["team_manager"], scope: "requester-team" },
          { id: "st-admin", label: "Administrator", eligibleRoles: ["admin"], scope: "organisation", when: { field: "amount", over: 5000 } }
        ] },
      { id: "rule-invoice-review", label: "Invoice review", formId: INVOICE_REVIEW_FORM_ID, prohibitSelfApproval: true, slaPolicyId: "sla-standard", escalateToRole: "admin",
        stages: [
          { id: "st-holder", label: "Budget holder", eligibleRoles: ["team_manager"], scope: "requester-team" },
          { id: "st-finance", label: "Finance approval", eligibleRoles: ["admin"], scope: "organisation", when: { field: "amount", over: 5000 } }
        ] }
    ]
  };
}

/** Keep the supplier choices on the purchase form in step with the supplier list. */
export function syncSupplierOptions(c: OrgConfig, suppliers: Supplier[]) {
  const form = c.requestForms.find((f) => f.id === (c.purchasing.requestFormId || PURCHASE_FORM_ID));
  const field = form?.fields.find((f) => f.key === "supplierId");
  if (field) field.options = supplierOptions(suppliers);
}

/** Add the purchasing forms and rules when a clean configuration has none. */
export function setUpPurchasing(s0: CoreState, ctx: Ctx): Result {
  if (!can(viewerOf(s0, ctx.viewerId), "settings.edit")) return fail("Only an administrator can set up purchase requests.");
  const s = draft(s0);
  const { forms, rules } = purchasingForms(s.config, s.data.suppliers);
  let added = 0;
  for (const f of forms) if (!s.config.requestForms.some((x) => x.id === f.id)) { s.config.requestForms.push(f); added++; }
  for (const r of rules) if (!s.config.approvalRules.some((x) => x.id === r.id)) s.config.approvalRules.push(r);
  if (!s.config.purchasing.requestFormId) s.config.purchasing.requestFormId = PURCHASE_FORM_ID;
  if (!added) return { ok: true, state: s0, message: "Purchase requests are already set up." };
  logEvent(s, ctx, { action: "config.changed", objectType: "config", objectId: "config", recordIds: [], summary: "Set up purchase request and invoice review forms" });
  return { ok: true, state: s, message: "Purchase requests and invoice reviews are set up. Adjust their approval routing in Settings, Control." };
}

/* ── Visibility and scope ──────────────────────────────────────────────── */

const requesterOf = (s: CoreState, o: PurchaseOrder) => s.data.requests.find((r) => r.id === o.requestId)?.requesterId;

export function canSeeOrder(q: Q, o: PurchaseOrder): boolean {
  return q.canSee({ ownerIds: [o.ownerId, requesterOf(q.s, o)], ...orderPlace(q.s, o), visibility: "team" });
}

export function ordersFor(q: Q, opt?: { ignoreScope?: boolean }): PurchaseOrder[] {
  return q.s.data.orders.filter((o) => canSeeOrder(q, o) && q.inScope(orderPlace(q.s, o), [o.ownerId, requesterOf(q.s, o)], opt));
}

const handlesMoney = (v: Viewer) => can(v, "purchasing.manage") || can(v, "finance.view");

export function canSeeInvoice(q: Q, i: SupplierInvoice): boolean {
  const o = q.s.data.orders.find((x) => x.id === i.orderId);
  if (o) return canSeeOrder(q, o);
  return handlesMoney(q.viewer) && q.canSee({ ownerIds: [], visibility: "organisation" });
}

export function invoicesFor(q: Q, opt?: { ignoreScope?: boolean }): SupplierInvoice[] {
  return q.s.data.invoices.filter((i) => {
    if (!canSeeInvoice(q, i)) return false;
    const o = q.s.data.orders.find((x) => x.id === i.orderId);
    return o ? q.inScope(orderPlace(q.s, o), [o.ownerId, requesterOf(q.s, o)], opt) : q.inScope({}, [], opt);
  });
}

export function receiptsFor(q: Q, opt?: { ignoreScope?: boolean }): GoodsReceipt[] {
  const ids = new Set(ordersFor(q, opt).map((o) => o.id));
  return q.s.data.receipts.filter((r) => ids.has(r.orderId));
}

/** Suppliers are organisation-wide reference data. */
export function suppliersFor(q: Q): Supplier[] {
  return q.viewer.person.kind === "staff" ? q.s.data.suppliers : [];
}

export const purchaseFormId = (s: CoreState) => s.config.purchasing.requestFormId || PURCHASE_FORM_ID;

/** Purchase requests are canonical requests; the same objects show in Work. */
export function purchaseRequestsFor(q: Q, opt?: { ignoreScope?: boolean }): RequestItem[] {
  const fid = purchaseFormId(q.s);
  return q.requests(opt).filter((r) => r.formId === fid);
}

/* ── Matching ──────────────────────────────────────────────────────────── */

export const FLAG_LABEL: Record<MatchFlag, string> = {
  over_order: "Above order", no_receipt: "No receipt", duplicate: "Possible duplicate", no_order: "No order", currency_mismatch: "Currency differs"
};

export interface MatchResult {
  flags: MatchFlag[];
  /** Plain explanation for each flag. */
  explain: Partial<Record<MatchFlag, string>>;
  order?: PurchaseOrder;
  receipts: GoodsReceipt[];
  /** Counted invoices on the same order, excluding this one. */
  otherInvoiced: number | null;
  /** Order total plus tolerance; null when there is no comparable order. */
  limit: number | null;
  /** Invoiced on the order including this invoice, minus the order total. */
  difference: number | null;
  duplicateOf?: Id;
}

const normRef = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function invoiceMatch(s: CoreState, inv: SupplierInvoice): MatchResult {
  const tol = s.config.purchasing.tolerancePercent;
  const flags: MatchFlag[] = [];
  const explain: MatchResult["explain"] = {};
  const order = s.data.orders.find((o) => o.id === inv.orderId);
  const receipts = order ? s.data.receipts.filter((r) => r.orderId === order.id) : [];
  const pos = s.data.invoices.findIndex((x) => x.id === inv.id);
  const earlier = s.data.invoices.find((x, i) => x.id !== inv.id && (pos < 0 || i < pos) && x.supplierId === inv.supplierId && x.status !== "rejected"
    && (normRef(x.ref) === normRef(inv.ref) || (x.amount === inv.amount && x.currency === inv.currency && (x.orderId || "") === (inv.orderId || ""))));
  if (earlier) {
    flags.push("duplicate");
    explain.duplicate = normRef(earlier.ref) === normRef(inv.ref)
      ? "The same supplier already sent an invoice with reference " + earlier.ref + ". It is not counted until someone confirms it is not a duplicate."
      : "Same supplier, amount and order as " + earlier.ref + ", received earlier. It is not counted until someone confirms it is not a duplicate.";
  }
  let otherInvoiced: number | null = null, limit: number | null = null, difference: number | null = null;
  if (!order) {
    flags.push("no_order");
    explain.no_order = "No purchase order is linked, so there is nothing to compare the amount or the receipt with.";
  } else {
    if (order.currency !== inv.currency) {
      flags.push("currency_mismatch");
      explain.currency_mismatch = "The invoice is in " + inv.currency + " but " + order.ref + " is in " + order.currency + ". Amounts are not compared or converted.";
    } else {
      otherInvoiced = invoicedOnOrder(s, order, inv.id);
      limit = order.total * (1 + tol / 100);
      difference = otherInvoiced + inv.amount - order.total;
      if (!earlier && otherInvoiced + inv.amount > limit + 0.005) {
        flags.push("over_order");
        const pct = order.total ? (100 * difference) / order.total : 0;
        explain.over_order = "Invoiced on " + order.ref + " would be " + fmtMoney(otherInvoiced + inv.amount, inv.currency) + " against an order of " + fmtMoney(order.total, order.currency)
          + ": " + (Math.round(pct * 10) / 10) + "% over, above the " + tol + "% tolerance.";
      }
    }
    if (s.config.purchasing.requireReceipt && !receipts.length) {
      flags.push("no_receipt");
      explain.no_receipt = "Nothing has been recorded as received on " + order.ref + ", and a receipt is required before an invoice is matched.";
    }
  }
  return { flags, explain, order, receipts, otherInvoiced, limit, difference, duplicateOf: earlier?.id };
}

/** Write match flags and the matching status. Decided invoices keep their status. */
function applyMatch(s: CoreState, inv: SupplierInvoice) {
  const m = invoiceMatch(s, inv);
  inv.flags = m.flags;
  if (inv.status === "received" || inv.status === "matched" || inv.status === "exception") inv.status = m.flags.length ? "exception" : "matched";
  return m;
}

const canBuy = (v: Viewer) => can(v, "purchasing.manage");

/** Re-run matching for one invoice. */
export function matchInvoice(s0: CoreState, ctx: Ctx, invoiceId: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v)) return fail("Matching invoices needs the purchasing.manage permission.");
  if (!s0.data.invoices.some((i) => i.id === invoiceId)) return fail("Invoice not found.");
  const s = draft(s0);
  const inv = s.data.invoices.find((i) => i.id === invoiceId)!;
  const before = inv.flags.join(", ");
  const m = applyMatch(s, inv);
  logEvent(s, ctx, { action: "invoice.matched", objectType: "invoice", objectId: inv.id, recordIds: [], storyKey: "invoice:" + inv.id, ...placeOfInvoice(s, inv),
    summary: "Matched " + inv.ref + ": " + (m.flags.length ? m.flags.map((f) => FLAG_LABEL[f].toLowerCase()).join(", ") : "no differences"),
    before: { flags: before || null }, after: { flags: m.flags.join(", ") || null } });
  return { ok: true, state: s, message: m.flags.length ? "Matched. " + m.flags.length + " difference" + (m.flags.length === 1 ? "" : "s") + " flagged." : "Matched. No differences." };
}

/** Re-run matching on every undecided invoice, after the tolerance or receipt rule changes. */
export function rematchInvoices(s0: CoreState, ctx: Ctx): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v) && !can(v, "settings.edit")) return fail("Matching invoices needs the purchasing.manage permission.");
  const s = draft(s0);
  let changed = 0;
  for (const inv of s.data.invoices) {
    if (!(inv.status === "received" || inv.status === "matched" || inv.status === "exception")) continue;
    const before = inv.flags.join(",") + inv.status;
    applyMatch(s, inv);
    if (inv.flags.join(",") + inv.status !== before) changed++;
  }
  if (!changed) return { ok: true, state: s0, message: "Invoices matched again: no flags changed." };
  logEvent(s, ctx, { action: "invoice.rematched", objectType: "config", objectId: "purchasing", recordIds: [],
    summary: "Matched undecided invoices again with tolerance " + s.config.purchasing.tolerancePercent + "% and receipts " + (s.config.purchasing.requireReceipt ? "required" : "not required") + ": " + changed + " changed" });
  return { ok: true, state: s, message: "Invoices matched again with the new rules: " + changed + " changed." };
}

function placeOfInvoice(s: CoreState, inv: SupplierInvoice): { teamId?: Id; unitId?: Id } {
  const o = s.data.orders.find((x) => x.id === inv.orderId);
  return o ? orderPlace(s, o) : {};
}

/* ── Suppliers ─────────────────────────────────────────────────────────── */

export interface SupplierInput { name: string; category: string; paymentTermsDays: number; ownerId?: Id; notes?: string }

function checkSupplier(s: CoreState, n: SupplierInput, exceptId?: Id): string | null {
  if (!n.name.trim()) return "Give the supplier a name.";
  if (s.data.suppliers.some((x) => x.id !== exceptId && x.name.trim().toLowerCase() === n.name.trim().toLowerCase())) return "A supplier with that name already exists.";
  if (!n.category.trim()) return "Give a category, such as Equipment or Professional services.";
  if (!(n.paymentTermsDays >= 0 && n.paymentTermsDays <= 365)) return "Payment terms must be between 0 and 365 days.";
  if (n.ownerId && !s.data.people.some((p) => p.id === n.ownerId)) return "Choose an owner from the people list.";
  return null;
}

export function createSupplier(s0: CoreState, ctx: Ctx, n: SupplierInput): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v)) return fail("Adding a supplier needs the purchasing.manage permission.");
  const err = checkSupplier(s0, n);
  if (err) return fail(err);
  const s = draft(s0);
  const id = nid(s, "sup");
  s.data.suppliers.push({ id, name: n.name.trim(), category: n.category.trim(), ownerId: n.ownerId || ctx.viewerId, status: "onboarding",
    paymentTermsDays: n.paymentTermsDays, notes: n.notes?.trim() || undefined });
  syncSupplierOptions(s.config, s.data.suppliers);
  logEvent(s, ctx, { action: "supplier.created", objectType: "supplier", objectId: id, recordIds: [], storyKey: "supplier:" + id, summary: "Added supplier " + n.name.trim() });
  return { ok: true, state: s, message: "Supplier added as onboarding. Mark it active once its details are checked.", id };
}

export function updateSupplier(s0: CoreState, ctx: Ctx, supplierId: Id, n: SupplierInput & { status?: "active" | "onboarding" }): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v)) return fail("Changing a supplier needs the purchasing.manage permission.");
  const cur = s0.data.suppliers.find((x) => x.id === supplierId);
  if (!cur) return fail("Supplier not found.");
  const err = checkSupplier(s0, n, supplierId);
  if (err) return fail(err);
  if (n.status && cur.status === "blocked") return fail("Unblock the supplier first; that needs a reason.");
  const s = draft(s0);
  const x = s.data.suppliers.find((y) => y.id === supplierId)!;
  const before = { name: x.name, category: x.category, paymentTermsDays: x.paymentTermsDays, status: x.status };
  x.name = n.name.trim(); x.category = n.category.trim(); x.paymentTermsDays = n.paymentTermsDays; x.ownerId = n.ownerId || x.ownerId; x.notes = n.notes?.trim() || undefined;
  if (n.status) x.status = n.status;
  syncSupplierOptions(s.config, s.data.suppliers);
  logEvent(s, ctx, { action: "supplier.updated", objectType: "supplier", objectId: x.id, recordIds: [], storyKey: "supplier:" + x.id, summary: "Updated supplier " + x.name,
    before, after: { name: x.name, category: x.category, paymentTermsDays: x.paymentTermsDays, status: x.status } });
  return { ok: true, state: s, message: "Saved." };
}

export function setSupplierBlocked(s0: CoreState, ctx: Ctx, supplierId: Id, blocked: boolean, reason: string): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v)) return fail("Blocking a supplier needs the purchasing.manage permission.");
  const cur = s0.data.suppliers.find((x) => x.id === supplierId);
  if (!cur) return fail("Supplier not found.");
  if (blocked === (cur.status === "blocked")) return fail(blocked ? "Already blocked." : "This supplier is not blocked.");
  if (!reason.trim()) return fail("Give a reason so others know why.");
  const s = draft(s0);
  const x = s.data.suppliers.find((y) => y.id === supplierId)!;
  x.status = blocked ? "blocked" : "active";
  syncSupplierOptions(s.config, s.data.suppliers);
  const open = s.data.orders.filter((o) => o.supplierId === x.id && OPEN_ORDER.includes(o.status)).length;
  logEvent(s, ctx, { action: blocked ? "supplier.blocked" : "supplier.unblocked", objectType: "supplier", objectId: x.id, recordIds: [], storyKey: "supplier:" + x.id,
    summary: (blocked ? "Blocked " : "Unblocked ") + x.name + ": " + reason.trim() });
  return { ok: true, state: s, message: blocked ? "Blocked. New orders to this supplier cannot be created." + (open ? " " + open + " open order" + (open === 1 ? " stays" : "s stay") + " as they are." : "") : "Unblocked." };
}

/* ── Orders and receipts ───────────────────────────────────────────────── */

/** Ask the ordering connection to send the order. Without one, nothing is sent. */
export function sendOrder(s0: CoreState, ctx: Ctx, orderId: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v)) return fail("Sending an order needs the purchasing.manage permission.");
  const o = s0.data.orders.find((x) => x.id === orderId);
  if (!o) return fail("Order not found.");
  if (o.status !== "approved") return fail(o.ref + " is " + ORDER_STATUS[o.status].toLowerCase() + ", so it cannot be sent.");
  const srcId = s0.config.purchasing.orderingSourceId;
  const src = srcId ? s0.config.sources.find((x) => x.id === srcId) : undefined;
  if (!src || !src.connected || src.kind !== "external") return fail("No ordering connection is configured; the order is approved in Pulse but nothing was sent.");
  const s = draft(s0);
  const x = s.data.orders.find((y) => y.id === orderId)!;
  x.status = "sent";
  x.sentExternally = true;
  logEvent(s, ctx, { action: "order.sent", objectType: "order", objectId: x.id, recordIds: [], storyKey: "order:" + x.id, ...orderPlace(s, x), summary: "Sent " + x.ref + " through " + src.label });
  return { ok: true, state: s, message: "Sent through " + src.label + "." };
}

/** Record that a person sent the order outside Pulse (email, phone, supplier portal). */
export function markOrderSent(s0: CoreState, ctx: Ctx, orderId: Id, how: string): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v)) return fail("Updating an order needs the purchasing.manage permission.");
  const o = s0.data.orders.find((x) => x.id === orderId);
  if (!o) return fail("Order not found.");
  if (o.status !== "approved") return fail(o.ref + " is " + ORDER_STATUS[o.status].toLowerCase() + ".");
  if (!how.trim()) return fail("Say how it was sent, for example by email to the supplier.");
  const s = draft(s0);
  const x = s.data.orders.find((y) => y.id === orderId)!;
  x.status = "sent";
  x.sentExternally = false;
  logEvent(s, ctx, { action: "order.sent.outside", objectType: "order", objectId: x.id, recordIds: [], storyKey: "order:" + x.id, ...orderPlace(s, x),
    summary: "Recorded " + x.ref + " as sent outside Pulse: " + how.trim() });
  return { ok: true, state: s, message: "Recorded as sent outside Pulse. Pulse did not contact the supplier." };
}

export function recordReceipt(s0: CoreState, ctx: Ctx, orderId: Id, r: { full: boolean; note: string }): Result {
  const v = viewerOf(s0, ctx.viewerId);
  const o = s0.data.orders.find((x) => x.id === orderId);
  if (!o) return fail("Order not found.");
  if (!canBuy(v) && o.ownerId !== v.person.id && requesterOf(s0, o) !== v.person.id) return fail("Only the order owner, its requester or someone with purchasing.manage can record a receipt.");
  if (!(o.status === "approved" || o.status === "sent" || o.status === "part_received")) return fail(o.ref + " is " + ORDER_STATUS[o.status].toLowerCase() + "; nothing more can be received.");
  if (!r.full && !r.note.trim()) return fail("Say what arrived, so the part receipt can be checked later.");
  const s = draft(s0);
  const x = s.data.orders.find((y) => y.id === orderId)!;
  const id = nid(s, "rc");
  s.data.receipts.push({ id, orderId: x.id, at: ctx.now, by: ctx.viewerId,
    lines: r.full ? x.lines.map((l) => ({ lineId: l.id, quantity: l.quantity, note: r.note.trim() || undefined })) : [{ lineId: x.lines[0]?.id || "l1", note: r.note.trim() }] });
  x.status = r.full ? "received" : "part_received";
  for (const inv of s.data.invoices.filter((i) => i.orderId === x.id)) applyMatch(s, inv);
  logEvent(s, ctx, { action: "order.received", objectType: "order", objectId: x.id, recordIds: [], storyKey: "order:" + x.id, ...orderPlace(s, x),
    summary: (r.full ? "Received " : "Part received ") + x.ref + (r.note.trim() ? ": " + r.note.trim() : "") });
  return { ok: true, state: s, message: (r.full ? "Receipt recorded. " : "Part receipt recorded. ") + "Invoices on " + x.ref + " were matched again.", id };
}

export const ORDER_STATUS: Record<PurchaseOrder["status"], string> = {
  draft: "Draft", approved: "Approved", sent: "Sent", part_received: "Part received", received: "Received", closed: "Closed", cancelled: "Cancelled"
};

/* ── Invoice review (one canonical request) ────────────────────────────── */

const OPEN_REQ = new Set(["draft", "submitted", "changes_requested", "approved"]);

export function openInvoiceReview(s0: CoreState, ctx: Ctx, invoiceId: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!canBuy(v) && !can(v, "finance.manage")) return fail("Opening an invoice review needs purchasing.manage or finance.manage.");
  const inv0 = s0.data.invoices.find((i) => i.id === invoiceId);
  if (!inv0) return fail("Invoice not found.");
  const existing = s0.data.requests.find((r) => r.id === inv0.requestId);
  if (existing && OPEN_REQ.has(existing.status)) return { ok: true, state: s0, message: "A review already exists: " + existing.ref + ". Nothing new was created.", id: existing.id };
  if (inv0.status === "paid" || inv0.status === "rejected" || inv0.status === "approved") return fail(inv0.ref + " is already " + (inv0.status === "approved" ? "approved for payment" : inv0.status) + ".");
  const m = invoiceMatch(s0, inv0);
  if (!m.flags.length) return fail(inv0.ref + " matches its order and receipt, so no review is needed.");
  const form = s0.config.requestForms.find((f) => f.effect.kind === "approve-invoice" && f.enabled);
  if (!form) return fail("No invoice review form is set up. An administrator can set it up from Purchasing, Matching.");
  const sup = s0.data.suppliers.find((x) => x.id === inv0.supplierId)?.name || "Unknown supplier";
  const place = placeOfInvoice(s0, inv0);
  const reason = m.flags.map((f) => m.explain[f]).filter(Boolean).join(" ");
  const res = createRequest(s0, ctx, {
    formId: form.id, title: "Invoice review: " + inv0.ref + ", " + sup,
    fields: { invoiceId: inv0.id, reason, amount: inv0.amount, orderTotal: m.order ? m.order.total : null },
    evidenceFileIds: inv0.fileId ? [inv0.fileId] : [], linkedRecordIds: [], teamId: place.teamId, submit: true
  });
  if (!res.ok) return res;
  const s = res.state;
  const reqId = res.id!;
  const inv = s.data.invoices.find((i) => i.id === invoiceId)!;
  inv.flags = m.flags;
  inv.requestId = reqId;
  inv.status = "in_review";
  const req = s.data.requests.find((r) => r.id === reqId)!;
  logEvent(s, ctx, { action: "invoice.review.opened", objectType: "invoice", objectId: inv.id, recordIds: [], storyKey: "invoice:" + inv.id, ...place,
    summary: "Opened review " + req.ref + " for " + inv.ref + " (" + m.flags.map((f) => FLAG_LABEL[f].toLowerCase()).join(", ") + ")" });
  return { ok: true, state: s, message: res.message + " Approving it marks the invoice approved for payment; it does not pay it.", id: reqId };
}

/** A matched invoice needs no review: a person with authority approves it for payment. Nothing is paid. */
export function approveMatchedInvoice(s0: CoreState, ctx: Ctx, invoiceId: Id): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "finance.manage") && !canBuy(v)) return fail("Approving an invoice for payment needs purchasing.manage or finance.manage.");
  const inv0 = s0.data.invoices.find((i) => i.id === invoiceId);
  if (!inv0) return fail("Invoice not found.");
  const m = invoiceMatch(s0, inv0);
  if (inv0.status !== "matched" || m.flags.length) return fail(inv0.ref + " is not a clean match, so it goes through a review instead.");
  const o = s0.data.orders.find((x) => x.id === inv0.orderId);
  if (o && (o.ownerId === v.person.id || requesterOf(s0, o) === v.person.id)) return fail("You raised or own this order, so someone else approves its invoice.");
  const s = draft(s0);
  const inv = s.data.invoices.find((i) => i.id === invoiceId)!;
  inv.status = "approved";
  inv.approvedAt = ctx.now;
  logEvent(s, ctx, { action: "invoice.approved", objectType: "invoice", objectId: inv.id, recordIds: [], storyKey: "invoice:" + inv.id, ...placeOfInvoice(s, inv),
    summary: inv.ref + " matched its order and receipt and was approved for payment. Not paid yet." });
  return { ok: true, state: s, message: "Approved for payment. Nothing was paid: payment is recorded when the accounting source reports it." };
}

const isInvoiceReview = (s: CoreState, r: RequestItem) => s.config.requestForms.find((f) => f.id === r.formId)?.effect.kind === "approve-invoice";

registerDecisionHook((s, ctx, r, a, kind) => {
  if (!isInvoiceReview(s, r)) return;
  const inv = s.data.invoices.find((i) => i.id === r.fields.invoiceId);
  if (!inv || inv.status === "paid") return;
  const place = placeOfInvoice(s, inv);
  if (kind === "approve" && a.status === "approved") {
    inv.status = "approved";
    inv.approvedAt = ctx.now;
    logEvent(s, ctx, { action: "invoice.approved", objectType: "invoice", objectId: inv.id, recordIds: [], storyKey: "invoice:" + inv.id, ...place,
      summary: inv.ref + " approved for payment through " + r.ref + ". Not paid: payment is recorded only when the accounting source reports it." });
  } else if (kind === "decline") {
    inv.status = "rejected";
    logEvent(s, ctx, { action: "invoice.rejected", objectType: "invoice", objectId: inv.id, recordIds: [], storyKey: "invoice:" + inv.id, ...place,
      summary: inv.ref + " rejected through " + r.ref + ". It is no longer counted as invoiced." });
  }
});

registerEffect("approve-invoice", (s, ctx, r) => {
  const inv = s.data.invoices.find((i) => i.id === r.fields.invoiceId);
  if (!inv) return { ok: false, error: "The invoice no longer exists." };
  if (inv.status === "rejected") return { ok: false, error: inv.ref + " was rejected, so it cannot be approved for payment." };
  if (inv.status === "paid") return { ok: true, effect: inv.ref + " is already paid according to the accounting source" };
  if (inv.status !== "approved") { inv.status = "approved"; inv.approvedAt = ctx.now; }
  return { ok: true, effect: inv.ref + " approved for payment. Nothing was paid or posted; payment is recorded when the accounting source reports it" };
});

/* ── Purchase request to order ─────────────────────────────────────────── */

registerEffect("create-purchase-order", (s, ctx, r) => {
  if (!moduleEnabled(s.config, "purchasing")) return { ok: false, error: "Purchasing is turned off, so no order was created." };
  const existing = s.data.orders.find((o) => o.requestId === r.id);
  if (existing) return { ok: true, effect: existing.ref + " already exists for " + r.ref + "; nothing was repeated" };
  const sup = s.data.suppliers.find((x) => x.id === r.fields.supplierId);
  if (!sup) return { ok: false, error: "The supplier on this request no longer exists. No order was created." };
  if (sup.status === "blocked") return { ok: false, error: sup.name + " is blocked. No order was created." };
  const amount = typeof r.fields.amount === "number" ? r.fields.amount : Number(r.fields.amount);
  if (!(amount > 0)) return { ok: false, error: "The request has no valid amount. No order was created." };
  const currency = String(r.fields.currency || s.config.finance.reportingCurrency);
  const projectId = typeof r.fields.projectId === "string" && r.fields.projectId ? r.fields.projectId : undefined;
  const budgetId = typeof r.fields.budgetId === "string" && r.fields.budgetId ? r.fields.budgetId : undefined;
  if (projectId && !s.data.projects.some((p) => p.id === projectId)) return { ok: false, error: "The project on this request no longer exists. No order was created." };
  const budget = budgetId ? s.data.budgets.find((b) => b.id === budgetId) : undefined;
  if (budgetId && !budget) return { ok: false, error: "The budget on this request no longer exists. No order was created." };
  const id = nid(s, "po");
  let n = 100 + s.data.orders.length + 1;
  while (s.data.orders.some((o) => o.ref === "PO-" + n)) n++;
  const ref = "PO-" + n;
  const needed = typeof r.fields.neededBy === "string" && r.fields.neededBy ? new Date(r.fields.neededBy + (r.fields.neededBy.length === 10 ? "T12:00:00Z" : "")).toISOString() : undefined;
  s.data.orders.push({ id, ref, supplierId: sup.id, requestId: r.id, projectId, budgetId, teamId: r.teamId, unitId: r.unitId, ownerId: r.requesterId,
    lines: [{ id: "l1", description: String(r.fields.description || r.title), amount }], total: amount, currency, status: "approved", sentExternally: false,
    createdAt: ctx.now, expectedAt: needed });
  logEvent(s, ctx, { action: "order.created", objectType: "order", objectId: id, recordIds: [], storyKey: "order:" + id, teamId: r.teamId, unitId: r.unitId,
    summary: "Created " + ref + " for " + sup.name + " (" + fmtMoney(amount, currency) + ") from " + r.ref + (budget ? ", on budget " + budget.label : "") + ". Not sent." });
  const note = budget && budget.currency !== currency ? " The order is in " + currency + " and the budget in " + budget.currency + ", so it is not counted against the budget." : "";
  return { ok: true, effect: ref + " created for " + sup.name + ", " + fmtMoney(amount, currency) + ". It has not been sent to the supplier" + note };
});

/* ── Accounting source (read-only) ─────────────────────────────────────── */

export interface FeedInvoice { externalId: string; supplierId: Id; ref: string; orderRef?: string; amount: number; currency: string; issuedAt: ISO; dueAt: ISO; sourceUpdatedAt: ISO }
export interface FeedTransaction {
  externalId: string; date: ISO; amount: number; currency: string; description: string; counterparty: string; kind: Transaction["kind"];
  invoice?: { supplierId: Id; ref: string }; receivableRef?: string; budgetId?: Id; sourceUpdatedAt: ISO;
}
export interface AccountingFeed { invoices: FeedInvoice[]; transactions: FeedTransaction[] }

type AccountingAdapter = (s: CoreState, now: ISO) => AccountingFeed;
const adapters: Record<string, AccountingAdapter> = {};

/** A read-only adapter for one source. The sample fixture registers a simulated one. */
export function registerAccountingAdapter(sourceId: string, a: AccountingAdapter) { adapters[sourceId] = a; }

/** Apply rows read from the accounting source. Idempotent: a row already in Pulse is never added twice. */
export function applyAccountingFeed(s0: CoreState, ctx: Ctx, sourceId: string, feed: AccountingFeed): Result {
  const v = viewerOf(s0, ctx.viewerId);
  if (!can(v, "finance.manage")) return fail("Reading from the accounting source needs the finance.manage permission.");
  const src = s0.config.sources.find((x) => x.id === sourceId);
  if (!src) return fail("That source is not configured.");
  const s = draft(s0);
  const simulated = src.kind === "sample";
  let newInv = 0, newTx = 0, already = 0;
  const skipped: string[] = [];
  for (const row of feed.invoices) {
    const sup = s.data.suppliers.find((x) => x.id === row.supplierId);
    if (!sup) { skipped.push(row.ref + " (supplier not in Pulse)"); continue; }
    if (s.data.invoices.some((i) => (i.externalId && i.externalId === row.externalId) || (i.supplierId === row.supplierId && normRef(i.ref) === normRef(row.ref)))) { already++; continue; }
    const order = row.orderRef ? s.data.orders.find((o) => o.ref === row.orderRef) : undefined;
    const id = nid(s, "inv");
    const inv: SupplierInvoice = { id, ref: row.ref, supplierId: sup.id, orderId: order?.id, amount: row.amount, currency: row.currency, issuedAt: row.issuedAt, dueAt: row.dueAt,
      status: "received", flags: [], sourceId, sourceUpdatedAt: row.sourceUpdatedAt, ingestedAt: ctx.now, externalId: row.externalId };
    s.data.invoices.push(inv);
    const m = applyMatch(s, inv);
    newInv++;
    logEvent(s, ctx, { actorId: sourceId, actorKind: "source", simulated, action: "invoice.received", objectType: "invoice", objectId: id, recordIds: [], storyKey: "invoice:" + id,
      ...placeOfInvoice(s, inv), summary: src.label + " sent invoice " + row.ref + " from " + sup.name + " (" + fmtMoney(row.amount, row.currency) + ")"
        + (m.flags.length ? "; flagged: " + m.flags.map((f) => FLAG_LABEL[f].toLowerCase()).join(", ") : "; matched") });
  }
  for (const row of feed.transactions) {
    if (s.data.transactions.some((t) => t.externalId === row.externalId)) { already++; continue; }
    const inv = row.invoice ? s.data.invoices.find((i) => i.supplierId === row.invoice!.supplierId && normRef(i.ref) === normRef(row.invoice!.ref)) : undefined;
    const rec = row.receivableRef ? s.data.receivables.find((r) => r.ref === row.receivableRef) : undefined;
    const id = nid(s, "tx");
    const o = inv ? s.data.orders.find((x) => x.id === inv.orderId) : undefined;
    s.data.transactions.push({ id, date: row.date, amount: row.amount, currency: row.currency, description: row.description, counterparty: row.counterparty, kind: row.kind,
      invoiceId: inv?.id, receivableId: rec?.id, budgetId: row.budgetId, projectId: o?.projectId || rec?.projectId, sourceId, sourceUpdatedAt: row.sourceUpdatedAt, ingestedAt: ctx.now,
      externalId: row.externalId });
    newTx++;
    let what = "";
    if (inv && row.kind === "payment_out" && inv.status !== "paid") {
      const before = inv.status;
      inv.status = "paid";
      inv.paidAt = row.date;
      what = "; " + inv.ref + " is now paid" + (before !== "approved" ? " (it was " + before.replace("_", " ") + " in Pulse, so check why it was paid before approval)" : "");
      logEvent(s, ctx, { actorId: sourceId, actorKind: "source", simulated, action: "invoice.paid", objectType: "invoice", objectId: inv.id, recordIds: [], storyKey: "invoice:" + inv.id,
        ...placeOfInvoice(s, inv), summary: src.label + " reported payment of " + inv.ref + " on " + row.date.slice(0, 10), before: { status: before }, after: { status: "paid" } });
    }
    if (rec && row.kind === "payment_in") {
      rec.paidAmount += row.amount;
      rec.status = rec.paidAmount >= rec.amount ? "paid" : "part_paid";
      rec.sourceUpdatedAt = row.sourceUpdatedAt;
      rec.ingestedAt = ctx.now;
      what = "; " + rec.ref + " is now " + rec.status.replace("_", " ");
    }
    logEvent(s, ctx, { actorId: sourceId, actorKind: "source", simulated, action: "transaction.received", objectType: "transaction", objectId: id, recordIds: [],
      storyKey: inv ? "invoice:" + inv.id : rec ? "receivable:" + rec.id : "transaction:" + id,
      summary: src.label + " reported " + row.description + " (" + fmtMoney(row.amount, row.currency) + ")" + what });
  }
  const sync = s.data.sync.find((x) => x.sourceId === sourceId);
  const msg = (simulated ? "Simulated read-only feed. " : "") + "Last read " + newInv + " new invoice" + (newInv === 1 ? "" : "s") + " and " + newTx + " new transaction" + (newTx === 1 ? "" : "s")
    + (already ? "; " + already + " row" + (already === 1 ? " was" : "s were") + " already in Pulse" : "") + ".";
  if (sync) { sync.lastAttemptAt = ctx.now; sync.lastSuccessAt = ctx.now; sync.status = simulated ? "sample" : "ok"; sync.message = msg; }
  else s.data.sync.push({ sourceId, lastAttemptAt: ctx.now, lastSuccessAt: ctx.now, status: simulated ? "sample" : "ok", message: msg });
  if (newInv || newTx) logEvent(s, ctx, { actorId: sourceId, actorKind: "source", simulated, action: "sync.completed", objectType: "config", objectId: sourceId, recordIds: [], summary: src.label + ": " + msg });
  return { ok: true, state: s, message: "Read from " + src.label + (simulated ? " (simulated)" : "") + ": " + newInv + " new invoice" + (newInv === 1 ? "" : "s") + ", " + newTx + " new transaction" + (newTx === 1 ? "" : "s") + "."
    + (already ? " " + already + " already in Pulse; nothing was duplicated." : "") + (skipped.length ? " Not imported: " + skipped.join(", ") + "." : "") };
}

/** Read the configured accounting source. Fails honestly when there is nothing to read from. */
export function syncAccounting(s0: CoreState, ctx: Ctx): Result {
  const id = s0.config.finance.accountingSourceId;
  const src = id ? s0.config.sources.find((x) => x.id === id) : undefined;
  if (!src) return fail("No accounting source is configured. Add a read-only accounting connection in Settings, Systems, then choose it in Purchasing and finance rules.");
  if (src.kind === "external" && !src.connected) return fail(src.label + " is not connected. Nothing was read.");
  const adapter = adapters[src.id];
  if (!adapter) return fail("No adapter for " + src.label + " runs in this demo. Nothing was read.");
  return applyAccountingFeed(s0, ctx, src.id, adapter(s0, ctx.now));
}

/* ── Metrics ───────────────────────────────────────────────────────────── */

registerMetric("invoiceExceptions", (q) => {
  if (!moduleEnabled(q.s.config, "purchasing")) return { value: null, ids: [], notes: ["Purchasing is turned off."] };
  const all = invoicesFor(q);
  const ex = all.filter((i) => i.status === "exception" || i.status === "in_review");
  return { value: all.length ? ex.length : null, ids: ex.map((i) => i.id), notes: ["Invoices that do not match their order or receipt and are not yet decided."] };
});

const moneyMetric = (pick: (q: Q, i: SupplierInvoice) => boolean, what: string) => (q: Q, def: { currency?: string }) => {
  if (!moduleEnabled(q.s.config, "purchasing")) return { value: null, ids: [], notes: ["Purchasing is turned off."] };
  const cur = def.currency || q.s.config.finance.reportingCurrency;
  const all = invoicesFor(q);
  const hit = all.filter((i) => pick(q, i));
  const same = hit.filter((i) => i.currency === cur);
  const other = hit.filter((i) => i.currency !== cur);
  const notes = [what + ", in " + cur + "."];
  if (other.length) notes.push(other.length + " invoice" + (other.length === 1 ? " is" : "s are") + " in another currency and not added: " + other.map((i) => fmtMoney(i.amount, i.currency)).join(", ") + ".");
  return { value: all.length ? same.reduce((n, i) => n + i.amount, 0) : null, ids: same.map((i) => i.id), notes, partial: other.length > 0 };
};

registerMetric("approvedUnpaid", moneyMetric((_q, i) => i.status === "approved", "Supplier invoices approved for payment that the accounting source has not yet reported as paid"));
registerMetric("payablesOverdue", moneyMetric((q, i) => isPayable(i) && ms(i.dueAt) < ms(q.ctx.now), "Supplier invoices past their due date and not yet paid"));

/** Committed spend: the uninvoiced part of open orders. Ids are order ids. */
registerMetric("committedSpend", (q, def) => {
  if (!moduleEnabled(q.s.config, "purchasing")) return { value: null, ids: [], notes: ["Purchasing is turned off."] };
  const cur = def.currency || q.s.config.finance.reportingCurrency;
  const orders = ordersFor(q).filter((o) => openCommitment(q.s, o) > 0);
  const same = orders.filter((o) => o.currency === cur);
  const other = orders.filter((o) => o.currency !== cur);
  const notes = ["The part of open purchase orders not yet invoiced, in " + cur + ". Invoiced amounts are not included, so nothing is counted twice."];
  if (other.length) notes.push(other.length + " order" + (other.length === 1 ? " is" : "s are") + " in another currency and not added.");
  return { value: ordersFor(q).length ? same.reduce((n, o) => n + openCommitment(q.s, o), 0) : null, ids: same.map((o) => o.id), notes, partial: other.length > 0 };
});

/* ── Read helpers for pages ────────────────────────────────────────────── */

/** Invoices counted on an order (for the order panel). */
export const orderInvoices = (s: CoreState, orderId: Id) => s.data.invoices.filter((i) => i.orderId === orderId);
