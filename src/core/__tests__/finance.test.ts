import { describe, expect, it } from "vitest";
import { sampleState, SAMPLE_REFERENCE } from "../fixtures/sample";
import { query } from "../query";
import * as ops from "../ops";
import { computeMetric } from "../metrics";
import {
  budgetPosition, budgetsFor, cashOutlook, receivablesFor, transactionsFor, receivablesAgeing, planVsActual, sumByCurrency
} from "../finance";
import {
  applyAccountingFeed, invoiceMatch, openInvoiceReview, purchaseRequestsFor, sendOrder, recordReceipt, setSupplierBlocked, syncAccounting, invoicesFor
} from "../purchasing";
import type { CoreState, Ctx, ScopeSel } from "../types";

const ctx = (viewerId: string, scope: ScopeSel = { kind: "organisation" }, now = SAMPLE_REFERENCE): Ctx => ({ viewerId, scope, now });
const ok = (r: ops.Result): CoreState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const err = (r: ops.Result) => (r.ok ? "" : r.error);

describe("budget position", () => {
  it("reports stages side by side without counting anything twice", () => {
    const s = sampleState();
    const p = budgetPosition(s, "bg-ws")!;
    // PO-101 fully invoiced (18,500), PO-102 over-invoiced (12,600 on 12,000): no open commitment left on either.
    expect(p.committed).toBe(0);
    expect(p.orderIds).toEqual([]);
    expect(p.invoiced).toBe(18500 + 12600);
    expect(p.invoiceIds.sort()).toEqual(["inv-1", "inv-3"]);
    expect(p.paid).toBe(18500);
    expect(p.transactionIds).toEqual(["tx-1"]);
    // Paid is part of invoiced and is not subtracted again.
    expect(p.remaining).toBe(48000 - 0 - (18500 + 12600));
  });

  it("an open order counts as committed only for the part not yet invoiced", () => {
    const s = sampleState();
    const p = budgetPosition(s, "bg-svc")!;
    // PO-104 is fully invoiced by PS-0418; the possible duplicate PS-418 is not counted. PO-105 is open and uninvoiced.
    expect(p.committed).toBe(2400);
    expect(p.orderIds).toEqual(["po-5"]);
    expect(p.invoiced).toBe(6000);
    expect(p.invoiceIds).toEqual(["inv-2"]);
    expect(p.notes.join(" ")).toMatch(/duplicate/);
    expect(p.committed + p.invoiced + p.remaining).toBe(p.approved);
  });

  it("a payment with no invoice in Pulse counts as paid, not invoiced, and says so", () => {
    const s = sampleState();
    const p = budgetPosition(s, "bg-ops-north")!;
    expect(p.paid).toBe(1480);
    expect(p.notes.join(" ")).toMatch(/without an invoice in Pulse/);
  });

  it("months without a plan stay empty rather than zero", () => {
    const rows = planVsActual(sampleState(), "bg-ws");
    expect(rows.find((r) => r.month === "2026-06")!.planned).toBeNull();
    expect(rows.find((r) => r.month === "2026-06")!.variance).toBeNull();
    expect(rows.find((r) => r.month === "2026-02")!.planned).toBe(20000);
  });
});

describe("invoice matching and review", () => {
  it("sample flags agree with the matching rules", () => {
    const s = sampleState();
    for (const inv of s.data.invoices.filter((i) => i.status === "exception" || i.status === "matched")) {
      expect(invoiceMatch(s, inv).flags.sort()).toEqual([...inv.flags].sort());
    }
  });

  it("flags an invoice above its order by more than the tolerance and opens exactly one review", () => {
    let s = sampleState();
    const m = invoiceMatch(s, s.data.invoices.find((i) => i.id === "inv-3")!);
    expect(m.flags).toEqual(["over_order"]);
    expect(m.explain.over_order).toMatch(/5% over, above the 2% tolerance/);
    const before = s.data.requests.length;
    const res = openInvoiceReview(s, ctx("p-casey", { kind: "unit", id: "u-north" }), "inv-3");
    s = ok(res);
    expect(s.data.requests.length).toBe(before + 1);
    const inv = s.data.invoices.find((i) => i.id === "inv-3")!;
    expect(inv.status).toBe("in_review");
    const req = s.data.requests.find((r) => r.id === inv.requestId)!;
    expect(req.formId).toBe("form-invoice-review");
    expect(req.evidenceFileIds).toContain("f-inv-fs2231");
    expect(req.status).toBe("submitted");
    // Opening it again returns the same review and creates nothing.
    const again = openInvoiceReview(s, ctx("p-casey", { kind: "unit", id: "u-north" }), "inv-3");
    expect(again.ok && again.state).toBe(s);
    expect(again.ok && again.id).toBe(req.id);
    expect(s.data.requests.filter((r) => r.fields.invoiceId === "inv-3").length).toBe(1);
  });

  it("approving the review marks the invoice approved for payment, never paid", () => {
    let s = ok(openInvoiceReview(sampleState(), ctx("p-casey"), "inv-3"));
    const inv0 = s.data.invoices.find((i) => i.id === "inv-3")!;
    const ap = s.data.approvals.find((a) => a.requestId === inv0.requestId)!;
    // The requester cannot approve their own review.
    expect(err(ops.decide(s, ctx("p-casey"), ap.id, "approve", ""))).toMatch(/cannot approve/);
    const txBefore = s.data.transactions.length;
    s = ok(ops.decide(s, ctx("p-jordan"), ap.id, "approve", "Extra partition agreed on site."));
    expect(s.data.invoices.find((i) => i.id === "inv-3")!.status).toBe("in_review");
    s = ok(ops.decide(s, ctx("p-robin"), ap.id, "approve", "Fine."));
    const inv = s.data.invoices.find((i) => i.id === "inv-3")!;
    expect(inv.status).toBe("approved");
    expect(inv.approvedAt).toBeTruthy();
    expect(inv.paidAt).toBeUndefined();
    expect(s.data.transactions.length).toBe(txBefore);
    expect(s.data.events.some((e) => e.storyKey === "invoice:inv-3" && e.action === "invoice.approved")).toBe(true);
    // Running the approved action still does not pay.
    s = ok(ops.executeRequest(s, ctx("p-robin"), inv0.requestId!));
    expect(s.data.invoices.find((i) => i.id === "inv-3")!.status).toBe("approved");
  });

  it("declining the review rejects the invoice and it stops counting as invoiced", () => {
    let s = ok(openInvoiceReview(sampleState(), ctx("p-casey"), "inv-3"));
    const ap = s.data.approvals.find((a) => a.requestId === s.data.invoices.find((i) => i.id === "inv-3")!.requestId)!;
    s = ok(ops.decide(s, ctx("p-jordan"), ap.id, "decline", "Not agreed with the supplier."));
    expect(s.data.invoices.find((i) => i.id === "inv-3")!.status).toBe("rejected");
    expect(budgetPosition(s, "bg-ws")!.invoiced).toBe(18500);
  });

  it("recording a receipt clears the missing receipt flag", () => {
    let s = sampleState();
    expect(invoiceMatch(s, s.data.invoices.find((i) => i.id === "inv-5")!).flags).toEqual(["no_receipt"]);
    s = ok(recordReceipt(s, ctx("p-riley"), "po-3", { full: true, note: "" }));
    const inv = s.data.invoices.find((i) => i.id === "inv-5")!;
    expect(inv.flags).toEqual([]);
    expect(inv.status).toBe("matched");
  });

  it("only the accounting source marks an invoice paid", () => {
    let s = sampleState();
    expect(s.data.invoices.find((i) => i.id === "inv-2")!.status).toBe("approved");
    s = ok(syncAccounting(s, ctx("p-robin")));
    const inv = s.data.invoices.find((i) => i.id === "inv-2")!;
    expect(inv.status).toBe("paid");
    const tx = s.data.transactions.find((t) => t.invoiceId === "inv-2")!;
    expect(tx.ingestedAt).toBe(SAMPLE_REFERENCE);
    expect(tx.sourceUpdatedAt).not.toBe(tx.ingestedAt);
    expect(s.data.sync.find((x) => x.sourceId === "s-accounting")!.lastSuccessAt).toBe(SAMPLE_REFERENCE);
  });
});

describe("accounting ingestion", () => {
  it("is idempotent: reading the same feed twice adds nothing the second time", () => {
    let s = sampleState();
    const invBefore = s.data.invoices.length, txBefore = s.data.transactions.length;
    s = ok(syncAccounting(s, ctx("p-robin")));
    // One new invoice and one new payment; the repeated EQ-5520 rows are already in Pulse.
    expect(s.data.invoices.length).toBe(invBefore + 1);
    expect(s.data.transactions.length).toBe(txBefore + 1);
    const added = s.data.invoices[s.data.invoices.length - 1];
    expect(added.flags).toEqual(["no_order"]);
    const again = ok(syncAccounting(s, ctx("p-robin", { kind: "organisation" }, "2026-03-11T12:00:00.000Z")));
    expect(again.data.invoices.length).toBe(s.data.invoices.length);
    expect(again.data.transactions.length).toBe(s.data.transactions.length);
  });

  it("flags a different reference with the same supplier, amount and order as a possible duplicate", () => {
    const s = sampleState();
    const res = ok(applyAccountingFeed(s, ctx("p-robin"), "s-accounting", { transactions: [], invoices: [
      { externalId: "X-1", supplierId: "sup-2", ref: "EQ-5520-B", orderRef: "PO-101", amount: 18500, currency: "EUR", issuedAt: SAMPLE_REFERENCE, dueAt: SAMPLE_REFERENCE, sourceUpdatedAt: SAMPLE_REFERENCE }
    ] }));
    const added = res.data.invoices[res.data.invoices.length - 1];
    expect(added.flags).toContain("duplicate");
    expect(budgetPosition(res, "bg-ws")!.invoiced).toBe(budgetPosition(s, "bg-ws")!.invoiced);
  });

  it("needs finance.manage", () => {
    expect(err(syncAccounting(sampleState(), ctx("p-casey")))).toMatch(/finance.manage/);
  });
});

describe("purchase requests", () => {
  it("approval then execution creates one order linked to request, budget and project; a repeat does nothing", () => {
    let s = sampleState();
    s = ok(ops.createRequest(s, ctx("p-morgan"), { formId: "form-purchase", title: "Whiteboards", evidenceFileIds: [], linkedRecordIds: [], teamId: "t-a", submit: true,
      fields: { supplierId: "sup-2", description: "Four whiteboards.", amount: 800, currency: "EUR", projectId: "pr-ws", budgetId: "bg-ws", neededBy: "2026-03-30" } }));
    const req = s.data.requests[s.data.requests.length - 1];
    const ap = s.data.approvals.find((a) => a.id === req.approvalId)!;
    expect(ap.stages.filter((x) => x.status !== "skipped").length).toBe(1);
    const ordersBefore = s.data.orders.length;
    s = ok(ops.decide(s, ctx("p-jordan"), ap.id, "approve", ""));
    // Decision is not execution: no order yet.
    expect(s.data.orders.length).toBe(ordersBefore);
    s = ok(ops.executeRequest(s, ctx("p-morgan"), req.id));
    expect(s.data.orders.length).toBe(ordersBefore + 1);
    const o = s.data.orders.find((x) => x.requestId === req.id)!;
    expect(o).toMatchObject({ budgetId: "bg-ws", projectId: "pr-ws", supplierId: "sup-2", total: 800, status: "approved", sentExternally: false });
    expect(budgetPosition(s, "bg-ws")!.committed).toBe(800);
    const again = ops.executeRequest(s, ctx("p-morgan"), req.id);
    expect(again.ok && again.state.data.orders.length).toBe(ordersBefore + 1);
    // It is the same canonical request Work shows.
    expect(purchaseRequestsFor(query(s, ctx("p-morgan"))).some((r) => r.id === req.id)).toBe(true);
  });

  it("over 5,000 needs a second decision from an administrator", () => {
    const s = sampleState();
    const ap = s.data.approvals.find((a) => a.id === "ap-p4")!;
    expect(ap.stages.find((x) => x.status === "pending")!.assigneeId).toBe("p-robin");
  });

  it("an approved request for a blocked supplier fails honestly and creates nothing", () => {
    let s = ok(setSupplierBlocked(sampleState(), ctx("p-casey"), "sup-1", true, "Insurance lapsed"));
    const before = s.data.orders.length;
    s = ok(ops.executeRequest(s, ctx("p-taylor"), "req-p5"));
    expect(s.data.orders.length).toBe(before);
    expect(s.data.requests.find((r) => r.id === "req-p5")!.execution.status).toBe("failed");
  });

  it("sending an order without an ordering connection fails and changes nothing", () => {
    const s = sampleState();
    expect(err(sendOrder(s, ctx("p-casey"), "po-5"))).toBe("No ordering connection is configured; the order is approved in Pulse but nothing was sent.");
    expect(s.data.orders.find((o) => o.id === "po-5")!.status).toBe("approved");
  });
});

describe("currencies, scope and permission", () => {
  it("currencies are never summed together", () => {
    const s = sampleState();
    const q = query(s, ctx("p-robin"));
    const ageing = receivablesAgeing(receivablesFor(q), SAMPLE_REFERENCE);
    expect(ageing.map((a) => a.currency).sort()).toEqual(["EUR", "GBP"]);
    expect(ageing.find((a) => a.currency === "GBP")!.total).toBe(2000);
    const sums = sumByCurrency(transactionsFor(q), (t) => t.amount, (t) => t.currency);
    expect(sums.find((x) => x.currency === "GBP")!.amount).toBe(-350);
    const m = computeMetric(s, ctx("p-robin"), "approvedUnpaid")!;
    expect(m.value).toBe(6000);
  });

  it("a contributor without finance.view cannot read finance rows", () => {
    const s = sampleState();
    const q = query(s, ctx("p-morgan", { kind: "team", id: "t-a" }));
    expect(budgetsFor(q, { ignoreScope: true })).toEqual([]);
    expect(receivablesFor(q, { ignoreScope: true })).toEqual([]);
    expect(transactionsFor(q, { ignoreScope: true })).toEqual([]);
    expect(cashOutlook(q).available).toBe(false);
    expect(computeMetric(s, ctx("p-morgan"), "overdueReceivables")?.value ?? null).toBeNull();
  });

  it("a unit lead sees only their unit's budgets and invoices, and no cash outlook", () => {
    const s = sampleState();
    const q = query(s, ctx("p-casey", { kind: "unit", id: "u-north" }));
    expect(budgetsFor(q).map((b) => b.id).sort()).toEqual(["bg-ops-north", "bg-ws"]);
    expect(invoicesFor(q, { ignoreScope: true }).some((i) => i.id === "inv-2")).toBe(false);
    const out = cashOutlook(q);
    expect(out.available).toBe(false);
  });

  it("the cash outlook starts from the opening balance plus later transactions and lists its gaps", () => {
    const q = query(sampleState(), ctx("p-robin"));
    const out = cashOutlook(q);
    if (!out.available) throw new Error(out.reason);
    expect(out.startBalance).toBe(64000 - 18500 - 1480 + 3000);
    expect(out.missing.join(" ")).toMatch(/Payroll/);
    expect(out.missing.join(" ")).toMatch(/overdue receivable/);
  });

  it("no opening balance means no outlook, with the reason", () => {
    const s = sampleState();
    s.config.finance.openingBalance = undefined;
    const out = cashOutlook(query(s, ctx("p-robin")));
    expect(out.available).toBe(false);
  });
});
