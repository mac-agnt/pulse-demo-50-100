/* Sample budgets, receivables, transactions, suppliers, orders, receipts and supplier invoices. Removable with the rest of the sample fixture layer.
   applyFinance() receives the sample config and data after the base sample is
   built and adds this module's rows and configuration to them.

   The accounting source here is simulated and read-only: its feed is a fixed
   set of rows, so reading it twice adds nothing the second time. */

import { registerAccountingAdapter, purchasingForms, type AccountingFeed } from "../purchasing";
import { addBusinessHours, addHours } from "../time";
import type {
  Approval, AuditEvent, Budget, CoreData, FileDoc, GoodsReceipt, Id, MetricDef, OrgConfig, PurchaseOrder, Receivable, RequestItem, Supplier, SupplierInvoice, Transaction, FieldValue
} from "../types";

const REF = "2026-03-11T10:00:00.000Z";
const at = (h: number) => addHours(REF, h);
const day = (d: number, h = 0) => at(24 * d + h);
const ACC = "s-accounting";

/* ── The simulated accounting feed (rows not yet read into Pulse) ──────── */

const PENDING_FEED: AccountingFeed = {
  invoices: [
    { externalId: "ACC-I-2001", supplierId: "sup-4", ref: "SW-7781", amount: 240, currency: "EUR", issuedAt: day(-1), dueAt: day(29), sourceUpdatedAt: day(-1, 2) },
    // Already in Pulse as inv-1: reading it again must not create a copy.
    { externalId: "ACC-I-1001", supplierId: "sup-2", ref: "EQ-5520", orderRef: "PO-101", amount: 18500, currency: "EUR", issuedAt: day(-19), dueAt: day(11), sourceUpdatedAt: day(-19, 3) }
  ],
  transactions: [
    { externalId: "ACC-T-2001", date: day(0, -2), amount: -6000, currency: "EUR", description: "Payment to Supplier C Ltd, PS-0418", counterparty: "Supplier C Ltd", kind: "payment_out",
      invoice: { supplierId: "sup-3", ref: "PS-0418" }, sourceUpdatedAt: day(0, -1) },
    // Already in Pulse as tx-1.
    { externalId: "ACC-T-1001", date: day(-5), amount: -18500, currency: "EUR", description: "Payment to Supplier B Ltd, EQ-5520", counterparty: "Supplier B Ltd", kind: "payment_out",
      invoice: { supplierId: "sup-2", ref: "EQ-5520" }, sourceUpdatedAt: day(-5, 2) }
  ]
};

registerAccountingAdapter(ACC, () => structuredClone(PENDING_FEED));

/* ── Rows ──────────────────────────────────────────────────────────────── */

const SUPPLIERS: Supplier[] = [
  { id: "sup-1", name: "Supplier A Ltd", category: "Facilities services", ownerId: "p-casey", status: "active", paymentTermsDays: 30 },
  { id: "sup-2", name: "Supplier B Ltd", category: "Equipment", ownerId: "p-jordan", status: "active", paymentTermsDays: 30 },
  { id: "sup-3", name: "Supplier C Ltd", category: "Professional services", ownerId: "p-avery", status: "active", paymentTermsDays: 14 },
  { id: "sup-4", name: "Supplier D Ltd", category: "Software", ownerId: "p-riley", status: "active", paymentTermsDays: 30 },
  { id: "sup-5", name: "Supplier E Ltd", category: "Training", ownerId: "p-avery", status: "onboarding", paymentTermsDays: 30,
    notes: "Insurance certificate requested before the first session." }
];

const months = (from: number, to: number, f: (m: number) => number | null): Record<string, number> => {
  const out: Record<string, number> = {};
  for (let m = from; m <= to; m++) { const v = f(m); if (v !== null) out["2026-" + String(m).padStart(2, "0")] = v; }
  return out;
};

const BUDGETS: Budget[] = [
  { id: "bg-ws", label: "Workspace upgrade", ownerId: "p-jordan", projectId: "pr-ws", unitId: "u-north", teamId: "t-a", currency: "EUR",
    periodFrom: "2026-01-01T00:00:00.000Z", periodTo: "2026-06-30T00:00:00.000Z", approved: 48000,
    // June has no plan yet: shown as "No plan", never as 0.
    plan: { "2026-01": 4000, "2026-02": 20000, "2026-03": 14000, "2026-04": 6000, "2026-05": 4000 },
    lines: [{ id: "bl-1", label: "Furniture and equipment", amount: 26000 }, { id: "bl-2", label: "Fit-out works", amount: 18000 }, { id: "bl-3", label: "Signage and moving", amount: 4000 }] },
  { id: "bg-svc", label: "Service improvement", ownerId: "p-avery", projectId: "pr-svc", unitId: "u-south", teamId: "t-c", currency: "EUR",
    periodFrom: "2026-02-01T00:00:00.000Z", periodTo: "2026-07-31T00:00:00.000Z", approved: 15000,
    plan: { "2026-02": 2000, "2026-03": 6000, "2026-04": 4000, "2026-05": 2000, "2026-06": 1000 } },
  { id: "bg-ops-north", label: "Unit North operating", ownerId: "p-casey", unitId: "u-north", currency: "EUR",
    periodFrom: "2026-01-01T00:00:00.000Z", periodTo: "2026-12-31T00:00:00.000Z", approved: 60000, plan: months(1, 12, () => 5000) }
];

const ORDERS: PurchaseOrder[] = [
  { id: "po-1", ref: "PO-101", supplierId: "sup-2", requestId: "req-p1", projectId: "pr-ws", budgetId: "bg-ws", teamId: "t-a", unitId: "u-north", ownerId: "p-morgan",
    lines: [{ id: "l1", description: "Height-adjustable desks", quantity: 20, unit: "each", unitPrice: 650, amount: 13000 },
      { id: "l2", description: "Task chairs", quantity: 20, unit: "each", unitPrice: 275, amount: 5500 }],
    total: 18500, currency: "EUR", status: "received", sentExternally: false, createdAt: day(-40), expectedAt: day(-22) },
  { id: "po-2", ref: "PO-102", supplierId: "sup-1", requestId: "req-p2", projectId: "pr-ws", budgetId: "bg-ws", teamId: "t-a", unitId: "u-north", ownerId: "p-jordan",
    lines: [{ id: "l1", description: "Partitions and lighting", amount: 7500 }, { id: "l2", description: "Flooring", amount: 4500 }],
    total: 12000, currency: "EUR", status: "part_received", sentExternally: false, createdAt: day(-30), expectedAt: day(5) },
  { id: "po-3", ref: "PO-103", supplierId: "sup-4", budgetId: "bg-ops-north", teamId: "t-b", unitId: "u-north", ownerId: "p-riley",
    lines: [{ id: "l1", description: "Room booking software, 12 months", quantity: 12, unit: "month", unitPrice: 300, amount: 3600 }],
    total: 3600, currency: "EUR", status: "sent", sentExternally: false, createdAt: day(-20), expectedAt: day(-14) },
  { id: "po-4", ref: "PO-104", supplierId: "sup-3", requestId: "req-p3", projectId: "pr-svc", budgetId: "bg-svc", teamId: "t-c", unitId: "u-south", ownerId: "p-quinn",
    lines: [{ id: "l1", description: "Service design workshops", quantity: 4, unit: "day", unitPrice: 1500, amount: 6000 }],
    total: 6000, currency: "EUR", status: "received", sentExternally: false, createdAt: day(-28), expectedAt: day(-12) },
  { id: "po-5", ref: "PO-105", supplierId: "sup-5", projectId: "pr-svc", budgetId: "bg-svc", teamId: "t-c", unitId: "u-south", ownerId: "p-avery",
    lines: [{ id: "l1", description: "Customer service training", quantity: 2, unit: "session", unitPrice: 1200, amount: 2400 }],
    total: 2400, currency: "EUR", status: "approved", sentExternally: false, createdAt: day(-3), expectedAt: day(18) }
];

const RECEIPTS: GoodsReceipt[] = [
  { id: "rc-1", orderId: "po-1", at: day(-21), by: "p-morgan", lines: [{ lineId: "l1", quantity: 20 }, { lineId: "l2", quantity: 20 }] },
  { id: "rc-2", orderId: "po-2", at: day(-6), by: "p-jordan", lines: [{ lineId: "l1", note: "Partitions and lighting installed; flooring still to come" }], fileId: "f-delivery-po102" },
  { id: "rc-3", orderId: "po-4", at: day(-12), by: "p-quinn", lines: [{ lineId: "l1", quantity: 4, note: "All four workshops held" }] }
];

const inv = (id: Id, ref: string, supplierId: Id, orderId: Id | undefined, amount: number, issuedD: number, dueD: number, status: SupplierInvoice["status"], flags: SupplierInvoice["flags"], extra: Partial<SupplierInvoice> = {}): SupplierInvoice =>
  ({ id, ref, supplierId, orderId, amount, currency: "EUR", issuedAt: day(issuedD), dueAt: day(dueD), status, flags, sourceId: ACC,
    sourceUpdatedAt: day(issuedD, 3), ingestedAt: day(issuedD, 5), externalId: "ACC-I-" + (1000 + Number(id.slice(4))), ...extra });

const INVOICES: SupplierInvoice[] = [
  inv("inv-1", "EQ-5520", "sup-2", "po-1", 18500, -19, 11, "paid", [], { paidAt: day(-5) }),
  inv("inv-2", "PS-0418", "sup-3", "po-4", 6000, -10, 4, "approved", [], { approvedAt: day(-2) }),
  // Above PO-102 by 5%, beyond the 2% tolerance. A part receipt exists.
  inv("inv-3", "FS-2231", "sup-1", "po-2", 12600, -4, 26, "exception", ["over_order"], { fileId: "f-inv-fs2231" }),
  // Same supplier, amount and order as PS-0418, different reference.
  inv("inv-4", "PS-418", "sup-3", "po-4", 6000, -9, 5, "exception", ["duplicate"]),
  // Nothing received on PO-103 yet.
  inv("inv-5", "SW-7702", "sup-4", "po-3", 3600, -6, 8, "exception", ["no_receipt"])
];

const rcv = (id: Id, ref: string, counterparty: string, recordId: Id, unitId: Id, amount: number, currency: string, issuedD: number, dueD: number, paid: number, projectId?: Id): Receivable =>
  ({ id, ref, counterparty, recordId, unitId, projectId, amount, currency, issuedAt: day(issuedD), dueAt: day(dueD), paidAmount: paid,
    status: paid >= amount ? "paid" : paid > 0 ? "part_paid" : "open", sourceId: ACC, sourceUpdatedAt: day(issuedD, 2), ingestedAt: day(issuedD, 4) });

const RECEIVABLES: Receivable[] = [
  rcv("ar-1", "SI-0107", "Partner organisation 1", "o-01", "u-north", 4200, "EUR", -50, -20, 4200),
  rcv("ar-2", "SI-0112", "Partner organisation 2", "o-02", "u-north", 7500, "EUR", -37, -7, 3000, "pr-svc"),
  rcv("ar-3", "SI-0115", "Partner organisation 3", "o-03", "u-south", 2000, "GBP", -14, 16, 0),
  rcv("ar-4", "SI-0118", "Partner organisation 1", "o-01", "u-north", 5800, "EUR", -9, 21, 0, "pr-svc")
];
RECEIVABLES[0].sourceUpdatedAt = day(-21, 2); RECEIVABLES[0].ingestedAt = day(-21, 4);
RECEIVABLES[1].sourceUpdatedAt = day(-6, 2); RECEIVABLES[1].ingestedAt = day(-6, 4);

const tx = (n: number, d: number, amount: number, currency: string, description: string, counterparty: string, kind: Transaction["kind"], links: Partial<Transaction>): Transaction =>
  ({ id: "tx-" + n, date: day(d), amount, currency, description, counterparty, kind, sourceId: ACC, sourceUpdatedAt: day(d, 2), ingestedAt: day(d, 4), externalId: "ACC-T-" + (1000 + n), ...links });

const TRANSACTIONS: Transaction[] = [
  tx(1, -5, -18500, "EUR", "Payment to Supplier B Ltd, EQ-5520", "Supplier B Ltd", "payment_out", { invoiceId: "inv-1", projectId: "pr-ws" }),
  tx(2, -21, 4200, "EUR", "Receipt from Partner organisation 1, SI-0107", "Partner organisation 1", "payment_in", { receivableId: "ar-1" }),
  // Paid straight from the bank feed with no supplier invoice in Pulse.
  tx(3, -8, -1480, "EUR", "Cleaning contract, February", "Supplier A Ltd", "payment_out", { budgetId: "bg-ops-north" }),
  tx(4, -6, 3000, "EUR", "Part payment from Partner organisation 2, SI-0112", "Partner organisation 2", "payment_in", { receivableId: "ar-2", projectId: "pr-svc" }),
  tx(5, -15, -350, "GBP", "Conference registration", "Event organiser", "payment_out", {})
];

const V = (id: string, n: number, h: number, by: Id, note: string, sizeKb: number) => ({ id, n, addedAt: at(h), addedBy: by, note, sizeKb });
const FILES: FileDoc[] = [
  { id: "f-inv-fs2231", title: "Supplier invoice FS-2231 (PDF)", kind: "Invoice", ownerId: "p-jordan", teamId: "t-a", unitId: "u-north", visibility: "team", linkedRecordIds: [],
    versions: [V("fv-inv-1", 1, -24 * 4 + 5, "p-jordan", "As received from Supplier A Ltd", 184), V("fv-inv-2", 2, -24 * 2, "p-jordan", "Reissued by the supplier with the order number added; amount unchanged", 186)],
    summary: "Invoice for fit-out works, phase 1: 12,600 against order PO-102 for 12,000.", sourceId: ACC },
  { id: "f-delivery-po102", title: "Delivery note, fit-out phase 1 (part)", kind: "Receipt", ownerId: "p-jordan", teamId: "t-a", unitId: "u-north", visibility: "team", linkedRecordIds: [],
    versions: [V("fv-dn-1", 1, -24 * 6, "p-jordan", "Signed on site", 62)], summary: "Partitions and lighting delivered and installed. Flooring outstanding.", sourceId: "pulse" }
];

/* ── Purchase requests: the same canonical requests Work shows ─────────── */

const sla = (h: number) => addBusinessHours(at(h), 16, "UTC");
let dn = 0;
const D = (stageId: string, actorId: Id, comment: string, h: number) => ({ id: "d-p" + (++dn), stageId, actorId, kind: "approve" as const, comment, at: at(h), requestVersion: 1, cycle: 1 });

function preq(n: number, title: string, requesterId: Id, teamId: Id, f: { supplierId: Id; description: string; amount: number; projectId?: Id; budgetId?: Id; neededBy: string }, h: number, extra: Partial<RequestItem> = {}): RequestItem {
  const fields: Record<string, FieldValue> = { supplierId: f.supplierId, description: f.description, amount: f.amount, currency: "EUR",
    projectId: f.projectId || null, budgetId: f.budgetId || null, neededBy: f.neededBy };
  return { id: "req-p" + n, ref: "REQ-" + (260 + n), formId: "form-purchase", title, requesterId, teamId, unitId: teamId === "t-c" ? "u-south" : "u-north",
    fields, version: 1, versions: [{ n: 1, fields: { ...fields }, at: at(h), by: requesterId, note: "Submitted" }], status: "approved",
    evidenceFileIds: [], linkedRecordIds: [], taskIds: [], approvalId: "ap-p" + n,
    execution: { status: "not_started", effect: "Create the purchase order", attempts: 0, appliedKeys: [] }, createdAt: at(h - 0.5), updatedAt: at(h), createdBy: requesterId, ...extra };
}

const done = (n: number, effect: string, h: number) => ({ status: "succeeded" as const, effect, attempts: 1, appliedKeys: ["req-p" + n + ":v1:create-purchase-order"], executedAt: at(h) });

const REQUESTS: RequestItem[] = [
  preq(1, "Desks and chairs for the upgraded floor", "p-morgan", "t-a", { supplierId: "sup-2", description: "Twenty height-adjustable desks and twenty task chairs.", amount: 18500, projectId: "pr-ws", budgetId: "bg-ws", neededBy: "2026-02-20" },
    -24 * 43, { execution: done(1, "PO-101 created for Supplier B Ltd, EUR 18,500. It has not been sent to the supplier", -24 * 40) }),
  preq(2, "Fit-out works, phase 1", "p-taylor", "t-a", { supplierId: "sup-1", description: "Partitions, lighting and flooring for the second floor.", amount: 12000, projectId: "pr-ws", budgetId: "bg-ws", neededBy: "2026-03-16" },
    -24 * 33, { execution: done(2, "PO-102 created for Supplier A Ltd, EUR 12,000. It has not been sent to the supplier", -24 * 30) }),
  preq(3, "Service design workshops", "p-quinn", "t-c", { supplierId: "sup-3", description: "Four facilitated workshop days with frontline staff.", amount: 6000, projectId: "pr-svc", budgetId: "bg-svc", neededBy: "2026-02-27" },
    -24 * 31, { execution: done(3, "PO-104 created for Supplier C Ltd, EUR 6,000. It has not been sent to the supplier", -24 * 28) }),
  // Waiting on the second decision (over 5,000).
  preq(4, "Meeting room displays and cabling", "p-morgan", "t-a", { supplierId: "sup-2", description: "Three wall displays with cabling for the new meeting rooms.", amount: 6200, projectId: "pr-ws", budgetId: "bg-ws", neededBy: "2026-04-03" },
    -30, { status: "submitted" }),
  // Approved, but the approved action has not run: no order exists yet.
  preq(5, "Wayfinding signs for the new floor", "p-taylor", "t-a", { supplierId: "sup-1", description: "Door and wayfinding signs for the upgraded floor.", amount: 900, projectId: "pr-ws", budgetId: "bg-ws", neededBy: "2026-03-27" },
    -26)
];

const st = (stageId: string, label: string, roles: string[], assigneeId: Id | null, status: Approval["stages"][number]["status"], startedH?: number) =>
  ({ stageId, label, eligibleRoles: roles, assigneeId, status, startedAt: startedH === undefined ? undefined : at(startedH), dueAt: startedH === undefined ? undefined : sla(startedH) });
const MGR = ["team_manager"], ADM = ["admin"];

const APPROVALS: Approval[] = [
  { id: "ap-p1", requestId: "req-p1", ruleId: "rule-purchase", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-24 * 43), decidedAt: at(-24 * 41),
    decisions: [D("st-mgr", "p-jordan", "Matches the furniture line of the budget.", -24 * 42), D("st-admin", "p-robin", "Approved.", -24 * 41)],
    stages: [st("st-mgr", "Team manager", MGR, "p-jordan", "approved", -24 * 43), st("st-admin", "Administrator", ADM, "p-robin", "approved", -24 * 42)] },
  { id: "ap-p2", requestId: "req-p2", ruleId: "rule-purchase", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-24 * 33), decidedAt: at(-24 * 31),
    decisions: [D("st-mgr", "p-jordan", "Quote attached to the project file.", -24 * 32), D("st-admin", "p-robin", "Approved.", -24 * 31)],
    stages: [st("st-mgr", "Team manager", MGR, "p-jordan", "approved", -24 * 33), st("st-admin", "Administrator", ADM, "p-robin", "approved", -24 * 32)] },
  { id: "ap-p3", requestId: "req-p3", ruleId: "rule-purchase", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-24 * 31), decidedAt: at(-24 * 29),
    decisions: [D("st-mgr", "p-avery", "Agreed with the project plan.", -24 * 30), D("st-admin", "p-robin", "Approved.", -24 * 29)],
    stages: [st("st-mgr", "Team manager", MGR, "p-avery", "approved", -24 * 31), st("st-admin", "Administrator", ADM, "p-robin", "approved", -24 * 30)] },
  { id: "ap-p4", requestId: "req-p4", ruleId: "rule-purchase", cycle: 1, reviewingVersion: 1, status: "pending", submittedAt: at(-30),
    decisions: [D("st-mgr", "p-jordan", "Needed before the rooms open.", -20)],
    stages: [st("st-mgr", "Team manager", MGR, "p-jordan", "approved", -30), st("st-admin", "Administrator", ADM, "p-robin", "pending", -20)] },
  { id: "ap-p5", requestId: "req-p5", ruleId: "rule-purchase", cycle: 1, reviewingVersion: 1, status: "approved", submittedAt: at(-26), decidedAt: at(-6),
    decisions: [D("st-mgr", "p-jordan", "Fine.", -6)],
    stages: [st("st-mgr", "Team manager", MGR, "p-jordan", "approved", -26), { stageId: "st-admin", label: "Administrator", eligibleRoles: ADM, assigneeId: null, status: "skipped" }] }
];

/* ── Metrics and the Finance dashboard view ────────────────────────────── */

const METRICS: MetricDef[] = [
  { id: "invoiceExceptions", label: "Invoice exceptions", description: "Supplier invoices that do not match their order or receipt and are not yet decided.", unit: "count", aggregation: "count",
    formula: "count(supplier invoices in exception or in review)", entity: "invoice", periodDays: 0, better: "down", target: 0, enabled: true },
  { id: "approvedUnpaid", label: "Approved, not yet paid", description: "Supplier invoices approved for payment that the accounting source has not reported as paid.", unit: "money", currency: "EUR",
    aggregation: "sum", formula: "sum(amount) of supplier invoices approved for payment and not paid, EUR only", entity: "invoice", periodDays: 0, better: "down", enabled: true },
  { id: "payablesOverdue", label: "Supplier invoices overdue", description: "Supplier invoices past their due date and not yet paid. Rejected invoices and possible duplicates are left out.", unit: "money", currency: "EUR",
    aggregation: "sum", formula: "sum(amount) of unpaid supplier invoices past due, EUR only", entity: "invoice", periodDays: 0, better: "down", target: 0, enabled: true }
];

/* ── History ───────────────────────────────────────────────────────────── */

function history(): AuditEvent[] {
  const ev: AuditEvent[] = [];
  let n = 0;
  const push = (e: Omit<AuditEvent, "id">) => ev.push({ id: "e-fin-" + String(++n).padStart(2, "0"), ...e });
  const sup = (id: Id) => SUPPLIERS.find((x) => x.id === id)!.name;
  for (const r of REQUESTS) {
    const ap = APPROVALS.find((a) => a.id === r.approvalId)!;
    push({ at: r.versions[0].at, actorId: r.requesterId, actorKind: "person", action: "request.submitted", objectType: "request", objectId: r.id, recordIds: [],
      summary: "Submitted " + r.ref + ": " + r.title, teamId: r.teamId, unitId: r.unitId });
    for (const d of ap.decisions) push({ at: d.at, actorId: d.actorId, actorKind: "person", action: "approval.approve", objectType: "approval", objectId: ap.id, recordIds: [],
      summary: "Approved " + r.ref + " (version 1)", teamId: r.teamId, unitId: r.unitId });
    if (r.execution.status === "succeeded") {
      const o = ORDERS.find((x) => x.requestId === r.id)!;
      push({ at: r.execution.executedAt!, actorId: "system", actorKind: "system", action: "order.created", objectType: "order", objectId: o.id, recordIds: [], storyKey: "order:" + o.id,
        summary: "Created " + o.ref + " for " + sup(o.supplierId) + " from " + r.ref + ". Not sent.", teamId: o.teamId, unitId: o.unitId });
    }
  }
  push({ at: day(-19), actorId: "p-riley", actorKind: "person", action: "order.sent.outside", objectType: "order", objectId: "po-3", recordIds: [], storyKey: "order:po-3",
    summary: "Recorded PO-103 as sent outside Pulse: emailed to Supplier D Ltd", teamId: "t-b", unitId: "u-north" });
  for (const r of RECEIPTS) {
    const o = ORDERS.find((x) => x.id === r.orderId)!;
    push({ at: r.at, actorId: r.by, actorKind: "person", action: "order.received", objectType: "order", objectId: o.id, recordIds: [], storyKey: "order:" + o.id,
      summary: (o.status === "part_received" ? "Part received " : "Received ") + o.ref + (r.lines[0]?.note ? ": " + r.lines[0].note : ""), teamId: o.teamId, unitId: o.unitId });
  }
  for (const i of INVOICES) {
    const o = ORDERS.find((x) => x.id === i.orderId);
    push({ at: i.ingestedAt!, actorId: ACC, actorKind: "source", simulated: true, action: "invoice.received", objectType: "invoice", objectId: i.id, recordIds: [], storyKey: "invoice:" + i.id,
      summary: "Sample accounting system sent invoice " + i.ref + " from " + sup(i.supplierId) + " (EUR " + i.amount.toLocaleString("en-IE") + ")"
        + (i.flags.length ? "; flagged: " + i.flags.join(", ").replace(/_/g, " ") : "; matched"), teamId: o?.teamId, unitId: o?.unitId });
  }
  push({ at: day(-2), actorId: "p-avery", actorKind: "person", action: "invoice.approved", objectType: "invoice", objectId: "inv-2", recordIds: [], storyKey: "invoice:inv-2",
    summary: "PS-0418 matched its order and receipt and was approved for payment. Not paid yet.", teamId: "t-c", unitId: "u-south" });
  push({ at: day(-5, 4), actorId: ACC, actorKind: "source", simulated: true, action: "invoice.paid", objectType: "invoice", objectId: "inv-1", recordIds: [], storyKey: "invoice:inv-1",
    summary: "Sample accounting system reported payment of EQ-5520", teamId: "t-a", unitId: "u-north" });
  push({ at: day(-6, 4), actorId: ACC, actorKind: "source", simulated: true, action: "transaction.received", objectType: "transaction", objectId: "tx-4", recordIds: [], storyKey: "receivable:ar-2",
    summary: "Sample accounting system reported a part payment of EUR 3,000 on SI-0112", unitId: "u-north" });
  return ev;
}

export function applyFinance(c: OrgConfig, d: CoreData): void {
  c.sources.push({ id: ACC, label: "Sample accounting system", kind: "sample", connected: false,
    prerequisite: "Simulated, read-only feed in sample mode. A real connection needs an accounting adapter with read access. Pulse never writes, posts or pays through it." });
  c.finance = { reportingCurrency: "EUR", accountingSourceId: ACC, openingBalance: { amount: 64000, asOf: "2026-03-01T00:00:00.000Z", sourceId: ACC } };
  c.purchasing = { tolerancePercent: 2, requireReceipt: true, requestFormId: "form-purchase" };

  d.suppliers.push(...structuredClone(SUPPLIERS));
  const { forms, rules } = purchasingForms(c, d.suppliers);
  c.requestForms.push(...forms);
  c.approvalRules.push(...rules);
  c.metrics.push(...METRICS.map((m) => ({ ...m })));
  c.dashboards.push({ id: "finance", module: "finance", label: "Finance", description: "Supplier invoices: exceptions, approved but unpaid, and overdue.",
    metricIds: METRICS.map((m) => m.id), defaultForRoles: [] });

  d.budgets.push(...structuredClone(BUDGETS));
  d.orders.push(...structuredClone(ORDERS));
  d.receipts.push(...structuredClone(RECEIPTS));
  d.invoices.push(...structuredClone(INVOICES));
  d.receivables.push(...structuredClone(RECEIVABLES));
  d.transactions.push(...structuredClone(TRANSACTIONS));
  d.files.push(...structuredClone(FILES));
  d.requests.push(...structuredClone(REQUESTS));
  d.approvals.push(...structuredClone(APPROVALS));
  d.sync.push({ sourceId: ACC, lastAttemptAt: at(-3), lastSuccessAt: at(-3), status: "sample",
    message: "Simulated read-only feed. Invoices, receivables and payments up to 3 h ago." });

  /* Projects that have a budget point at it (projects are applied first). */
  for (const b of BUDGETS) {
    const p = b.projectId ? d.projects.find((x) => x.id === b.projectId) : undefined;
    if (p && !p.budgetId) p.budgetId = b.id;
  }
  d.events.push(...history());
  d.events.sort((a, b) => a.at.localeCompare(b.at));
}
