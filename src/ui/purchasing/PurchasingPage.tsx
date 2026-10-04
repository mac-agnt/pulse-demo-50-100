/* Purchasing module page. Renders the section chosen in the top bar (v.section):
   Requests, Orders, Suppliers, Receipts, Matching. Purchase requests are the
   canonical requests from Work; orders, receipts and invoices link to the
   same objects Finance shows. Budget columns hide when Finance is off or the
   viewer cannot read it; everything else works without Finance. */

import { useState } from "react";
import {
  FLAG_LABEL, invoiceMatch, invoicesFor, openCommitment, ordersFor, purchaseFormId, purchaseRequestsFor, receiptsFor, suppliersFor,
  type GoodsReceipt, type PurchaseOrder, type RequestItem, type Supplier, type SupplierInvoice
} from "../../core";
import { Button, Chip, DataTable, Empty, LABEL, Notice, type Column } from "../kit";
import { PageFrame, SegTabs, eyebrowOf } from "../frame";
import type { ModulePageProps } from "../modules/registry";
import { FlagChips, InvoiceChip, ModHead, Money, OrderChip, sendState, useFin, useFinFocus, type Fin, type FinPanel } from "../finance/common";
import { FinPanels, waitingOn } from "../finance/panels";


const SECTION_LABEL: Record<string, string> = { requests: "Requests", orders: "Orders", suppliers: "Suppliers", receipts: "Receipts", matching: "Matching" };

export default function PurchasingPage({ section }: ModulePageProps) {
  const f = useFin();
  const [panel, setPanel] = useState<FinPanel | null>(null);
  useFinFocus(setPanel);
  const sec = SECTION_LABEL[section] ? section : "requests";
  const eyebrow = eyebrowOf("Purchasing", SECTION_LABEL[sec], f.scope);
  let body;
  if (!f.purOn) body = <><ModHead eyebrow={eyebrow} title="Purchasing" /><Empty title="Purchasing is turned off" body="An administrator can turn it on in Settings, Experience, Modules. Its data is kept while it is off." /></>;
  else if (sec === "orders") body = <Orders f={f} eyebrow={eyebrow} open={setPanel} />;
  else if (sec === "suppliers") body = <Suppliers f={f} eyebrow={eyebrow} open={setPanel} />;
  else if (sec === "receipts") body = <Receipts f={f} eyebrow={eyebrow} open={setPanel} />;
  else if (sec === "matching") body = <Matching f={f} eyebrow={eyebrow} open={setPanel} />;
  else body = <Requests f={f} eyebrow={eyebrow} open={setPanel} />;
  return (
    <div className="pk fx">
      <PageFrame>{body}</PageFrame>
      <FinPanels panel={panel} setPanel={setPanel} />
    </div>
  );
}

type Open = (p: FinPanel) => void;
const supName = (f: Fin, id?: string) => f.core.data.suppliers.find((x) => x.id === id)?.name || "Unknown supplier";

/* ── Requests ──────────────────────────────────────────────────────────── */

function Requests({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const [show, setShow] = useState<"open" | "toOrder" | "ordered" | "all">("open");
  const all = purchaseRequestsFor(q);
  const orderOf = (r: RequestItem) => core.data.orders.find((o) => o.requestId === r.id);
  const lanes = {
    open: (r: RequestItem) => r.status === "draft" || r.status === "submitted" || r.status === "changes_requested",
    toOrder: (r: RequestItem) => r.status === "approved" && !orderOf(r),
    ordered: (r: RequestItem) => !!orderOf(r),
    all: () => true
  };
  const rows = all.filter(lanes[show]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const formMissing = !core.config.requestForms.some((x) => x.id === purchaseFormId(core) && x.enabled);
  const amountOf = (r: RequestItem) => (typeof r.fields.amount === "number" ? r.fields.amount : Number(r.fields.amount));
  const budgetOf = (r: RequestItem) => (typeof r.fields.budgetId === "string" ? core.data.budgets.find((b) => b.id === r.fields.budgetId)?.label || "" : "");
  const orderCell = (r: RequestItem) => {
    const o = orderOf(r);
    if (o) return <span>{o.ref}<span className="fx-sub">{sendState(o)}</span></span>;
    if (r.execution.status === "failed") return <Chip tone="bad">Order failed</Chip>;
    if (r.status === "approved") return <Chip tone="warn">Not created yet</Chip>;
    return <span className="fx-faint">After approval</span>;
  };
  const statusCell = (r: RequestItem) => {
    const w = r.status === "submitted" ? waitingOn(q, r) : "";
    return <span><Chip tone={r.status === "approved" ? "ok" : r.status === "declined" || r.status === "withdrawn" ? "bad" : r.status === "changes_requested" ? "warn" : "accent"}>{LABEL.request[r.status]}</Chip>
      {w && <span className="fx-sub">{"Waiting on " + w}</span>}</span>;
  };
  const cols: Column<RequestItem>[] = [
    { key: "ref", label: "Ref", priority: 2, value: (r) => r.ref, render: (r) => <span className="pk-mono">{r.ref}</span> },
    { key: "title", label: "Request", strong: true, priority: 1, value: (r) => r.title, render: (r) => <span>{r.title}<span className="fx-sub">{supName(f, String(r.fields.supplierId || ""))}</span></span> },
    { key: "amount", label: "Amount", align: "right", priority: 1, value: amountOf, render: (r) => <Money n={amountOf(r)} cur={String(r.fields.currency || f.cur)} /> },
    ...(f.showBudget ? [{ key: "budget", label: "Budget", priority: 3, value: budgetOf, render: (r: RequestItem) => budgetOf(r) || <span className="fx-faint">None</span> } as Column<RequestItem>] : []),
    { key: "who", label: "Requester", priority: 3, value: (r) => q.name(r.requesterId) },
    { key: "status", label: "Decision", priority: 2, value: (r) => r.status, render: statusCell },
    { key: "order", label: "Order", priority: 2, value: (r) => orderOf(r)?.ref || "", render: orderCell }
  ];
  const count = (k: keyof typeof lanes) => all.filter(lanes[k]).length;
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Purchase requests" meta="The same requests Work shows. Decisions follow the approval routing; the order is created when the approved action runs, and is never sent without a connection."
        action={<Button variant="primary" onClick={() => open({ kind: "newRequest" })}>New purchase request</Button>} />
      {formMissing && <Notice tone="warn">Purchase requests are not set up yet. New purchase request explains how to set them up.</Notice>}
      <DataTable<RequestItem> rows={rows} columns={cols} rowKey={(r) => r.id} onOpen={(r) => open({ kind: "request", id: r.id })} caption="Purchase requests"
        searchText={(r) => r.ref + " " + r.title + " " + supName(f, String(r.fields.supplierId || "")) + " " + q.name(r.requesterId)} searchPlaceholder="Search requests"
        toolbarLeft={<SegTabs label="Show" value={show} onChange={setShow} options={[
          { value: "open", label: "In review", count: count("open") }, { value: "toOrder", label: "Approved, no order", count: count("toOrder") },
          { value: "ordered", label: "Ordered", count: count("ordered") }, { value: "all", label: "All", count: all.length }]} />}
        empty={<Empty title={all.length ? "Nothing in this view" : "No purchase requests yet"} body={all.length ? undefined : "Raise one to buy goods or services; it goes through the usual approval routing."}
          action={all.length ? undefined : <Button variant="primary" onClick={() => open({ kind: "newRequest" })}>New purchase request</Button>} />} />
    </>
  );
}

/* ── Orders ────────────────────────────────────────────────────────────── */

function Orders({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const [show, setShow] = useState<"open" | "done" | "all">("open");
  const all = ordersFor(q);
  const isOpen = (o: PurchaseOrder) => o.status === "approved" || o.status === "sent" || o.status === "part_received";
  const rows = all.filter((o) => show === "all" || (show === "open" ? isOpen(o) : !isOpen(o))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const budgetOf = (o: PurchaseOrder) => core.data.budgets.find((b) => b.id === o.budgetId)?.label || "";
  const rc = (o: PurchaseOrder) => core.data.receipts.filter((r) => r.orderId === o.id);
  const cols: Column<PurchaseOrder>[] = [
    { key: "ref", label: "Order", strong: true, priority: 1, value: (o) => o.ref, render: (o) => <span>{o.ref}<span className="fx-sub">{supName(f, o.supplierId)}</span></span> },
    { key: "what", label: "What", priority: 3, value: (o) => o.lines[0]?.description || "", render: (o) => (o.lines[0]?.description || "") + (o.lines.length > 1 ? " and " + (o.lines.length - 1) + " more" : "") },
    { key: "total", label: "Total", align: "right", priority: 1, value: (o) => o.total, render: (o) => <Money n={o.total} cur={o.currency} /> },
    { key: "open", label: "Open commitment", align: "right", priority: 3, value: (o) => openCommitment(core, o), render: (o) => <Money n={openCommitment(core, o)} cur={o.currency} /> },
    ...(f.showBudget ? [{ key: "budget", label: "Budget", priority: 3, value: budgetOf, render: (o: PurchaseOrder) => budgetOf(o) || <span className="fx-faint">None</span> } as Column<PurchaseOrder>] : []),
    { key: "status", label: "Status", priority: 2, value: (o) => o.status, render: (o) => <OrderChip o={o} /> },
    { key: "sent", label: "Sending", priority: 3, value: sendState, render: (o) => <span className={o.status === "approved" ? "fx-dim" : undefined}>{sendState(o)}</span> },
    { key: "rc", label: "Receipts", priority: 3, value: (o) => rc(o).length, render: (o) => rc(o).length ? f.d(rc(o)[rc(o).length - 1].at) : <span className="fx-faint">None</span> }
  ];
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Orders" meta="Orders are created from approved purchase requests. Pulse sends an order only through a configured ordering connection."
        action={<Button variant="primary" onClick={() => open({ kind: "newRequest" })}>New purchase request</Button>} />
      <DataTable<PurchaseOrder> rows={rows} columns={cols} rowKey={(o) => o.id} onOpen={(o) => open({ kind: "order", id: o.id })} caption="Purchase orders"
        searchText={(o) => o.ref + " " + supName(f, o.supplierId) + " " + o.lines.map((l) => l.description).join(" ")} searchPlaceholder="Search orders"
        toolbarLeft={<SegTabs label="Show" value={show} onChange={setShow} options={[{ value: "open", label: "Open" }, { value: "done", label: "Received or closed" }, { value: "all", label: "All" }]} />}
        empty={<Empty title={all.length ? "Nothing in this view" : "No orders yet"} body={all.length ? undefined : "An order is created when an approved purchase request runs its approved action."} />} />
    </>
  );
}

/* ── Suppliers ─────────────────────────────────────────────────────────── */

function Suppliers({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const all = suppliersFor(q);
  const orders = ordersFor(q, { ignoreScope: true });
  const invoices = invoicesFor(q, { ignoreScope: true });
  const reqState = (s: Supplier) => {
    const obs = core.data.obligations.filter((o) => o.subject.kind === "supplier" && o.subject.id === s.id);
    if (!obs.length) return <span className="fx-faint">None apply</span>;
    const gaps = obs.filter((o) => o.state !== "approved").length;
    return gaps ? <Chip tone="warn">{gaps + " of " + obs.length + " not approved"}</Chip> : <Chip tone="ok">{"All " + obs.length + " approved"}</Chip>;
  };
  const cols: Column<Supplier>[] = [
    { key: "name", label: "Supplier", strong: true, priority: 1, value: (s) => s.name },
    { key: "cat", label: "Category", priority: 2, value: (s) => s.category },
    { key: "status", label: "Status", priority: 1, value: (s) => s.status, render: (s) => <Chip tone={s.status === "active" ? "ok" : s.status === "blocked" ? "bad" : "warn"}>{s.status === "active" ? "Active" : s.status === "blocked" ? "Blocked" : "Onboarding"}</Chip> },
    { key: "terms", label: "Terms", priority: 3, value: (s) => s.paymentTermsDays, render: (s) => s.paymentTermsDays + " days" },
    { key: "orders", label: "Open orders", align: "right", priority: 3, value: (s) => orders.filter((o) => o.supplierId === s.id && openCommitment(core, o) > 0).length },
    { key: "inv", label: "Invoices to pay", align: "right", priority: 3, value: (s) => invoices.filter((i) => i.supplierId === s.id && i.status !== "paid" && i.status !== "rejected").length },
    ...(f.standardsOn ? [{ key: "req", label: "Requirements", priority: 2, value: (s: Supplier) => core.data.obligations.filter((o) => o.subject.kind === "supplier" && o.subject.id === s.id && o.state !== "approved").length,
      render: reqState } as Column<Supplier>] : [])
  ];
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Suppliers" meta="Shared across the organisation. Blocked suppliers cannot receive new orders."
        action={<Button variant="primary" disabled={!f.canBuy} title={f.canBuy ? undefined : "Needs purchasing.manage"} onClick={() => open({ kind: "newSupplier" })}>Add supplier</Button>} />
      <DataTable<Supplier> rows={all} columns={cols} rowKey={(s) => s.id} onOpen={(s) => open({ kind: "supplier", id: s.id })} caption="Suppliers" initialSort={{ key: "name", dir: "asc" }}
        searchText={(s) => s.name + " " + s.category} searchPlaceholder="Search suppliers"
        empty={<Empty title="No suppliers yet" body="Add the organisations you buy from; purchase requests pick from this list."
          action={f.canBuy ? <Button variant="primary" onClick={() => open({ kind: "newSupplier" })}>Add supplier</Button> : undefined} />} />
    </>
  );
}

/* ── Receipts ──────────────────────────────────────────────────────────── */

function Receipts({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const rows = [...receiptsFor(q)].sort((a, b) => b.at.localeCompare(a.at));
  const ord = (r: GoodsReceipt) => core.data.orders.find((o) => o.id === r.orderId);
  const what = (r: GoodsReceipt) => {
    const o = ord(r);
    const partial = !o || r.lines.length < o.lines.length || r.lines.some((x) => x.quantity === undefined && !!x.note);
    const note = r.lines.find((x) => x.note)?.note;
    return (partial ? "Part" : "Everything on the order") + (note ? ": " + note : "");
  };
  const cols: Column<GoodsReceipt>[] = [
    { key: "at", label: "Date", priority: 1, value: (r) => r.at, render: (r) => f.d(r.at) },
    { key: "order", label: "Order", strong: true, priority: 1, value: (r) => ord(r)?.ref || "", render: (r) => <span>{ord(r)?.ref}<span className="fx-sub">{supName(f, ord(r)?.supplierId)}</span></span> },
    { key: "what", label: "What arrived", priority: 2, value: what },
    { key: "by", label: "Recorded by", priority: 3, value: (r) => q.name(r.by) },
    { key: "file", label: "Evidence", priority: 3, value: (r) => (r.fileId ? q.file(r.fileId)?.title || "Restricted" : ""), render: (r) => (r.fileId ? q.file(r.fileId)?.title || "Restricted" : <span className="fx-faint">None</span>) }
  ];
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Receipts" meta="What arrived against each order. Recording a receipt matches that order's invoices again."
        action={<Button variant="primary" onClick={() => open({ kind: "newReceipt" })}>Record receipt</Button>} />
      <DataTable<GoodsReceipt> rows={rows} columns={cols} rowKey={(r) => r.id} onOpen={(r) => open({ kind: "order", id: r.orderId })} caption="Receipts"
        searchText={(r) => (ord(r)?.ref || "") + " " + supName(f, ord(r)?.supplierId) + " " + what(r)} searchPlaceholder="Search receipts"
        empty={<Empty title="No receipts yet" body="Record what arrives against an order; invoices are matched against it." />} />
    </>
  );
}

/* ── Matching ──────────────────────────────────────────────────────────── */

function Matching({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const [show, setShow] = useState<"attention" | "matched" | "all">("attention");
  const all = invoicesFor(q);
  const need = (i: SupplierInvoice) => i.status === "exception" || i.status === "in_review" || i.status === "received";
  const rows = all.filter((i) => show === "all" || (show === "attention" ? need(i) : !need(i))).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const p = core.config.purchasing;
  type Row = SupplierInvoice;
  const m = (i: Row) => invoiceMatch(core, i);
  const cols: Column<Row>[] = [
    { key: "inv", label: "Invoice", strong: true, priority: 1, value: (i) => i.ref, render: (i) => <span>{i.ref}<span className="fx-sub">{supName(f, i.supplierId)}</span></span> },
    { key: "order", label: "Order total", align: "right", priority: 2, value: (i) => m(i).order?.total ?? null,
      render: (i) => { const o = m(i).order; return o ? <span><Money n={o.total} cur={o.currency} /><span className="fx-sub">{o.ref}</span></span> : <span className="fx-faint">No order</span>; } },
    { key: "amount", label: "Invoice", align: "right", priority: 1, value: (i) => i.amount, render: (i) => <Money n={i.amount} cur={i.currency} /> },
    { key: "diff", label: "Invoiced minus order", align: "right", priority: 2, value: (i) => m(i).difference,
      render: (i) => { const x = m(i); return x.difference === null ? <span className="fx-faint">Not comparable</span> : <Money n={x.difference} cur={i.currency} signed />; } },
    { key: "rcpt", label: "Receipt", priority: 3, value: (i) => m(i).receipts.length, render: (i) => { const x = m(i); return !x.order ? <span className="fx-faint">No order</span> : x.receipts.length ? (x.order.status === "part_received" ? "Part received" : "Received") : <span className="fx-neg">None</span>; } },
    { key: "flags", label: "Differences", priority: 1, value: (i) => i.flags.map((x) => FLAG_LABEL[x]).join(" "), render: (i) => <FlagChips flags={i.flags} /> },
    { key: "status", label: "Status", priority: 2, value: (i) => i.status, render: (i) => <InvoiceChip inv={i} /> },
    { key: "review", label: "Review", priority: 3, value: (i) => core.data.requests.find((r) => r.id === i.requestId)?.ref || "",
      render: (i) => { const r = core.data.requests.find((x) => x.id === i.requestId); return r ? <span className="pk-mono">{r.ref}</span> : <span className="fx-faint">None</span>; } }
  ];
  const n = all.filter(need).length;
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Matching"
        meta={"Each invoice against its order and receipt. Tolerance " + p.tolerancePercent + "% above the order; " + (p.requireReceipt ? "a receipt is required." : "no receipt required.")
          + " Approving an invoice marks it approved for payment; it never pays it."} />
      <DataTable<Row> rows={rows} columns={cols} rowKey={(i) => i.id} onOpen={(i) => open({ kind: "invoice", id: i.id })} caption="Invoice matching"
        searchText={(i) => i.ref + " " + supName(f, i.supplierId) + " " + i.flags.map((x) => FLAG_LABEL[x]).join(" ")} searchPlaceholder="Search invoices"
        toolbarLeft={<SegTabs label="Show" value={show} onChange={setShow} options={[{ value: "attention", label: "Needs attention", count: n }, { value: "matched", label: "Matched or decided" }, { value: "all", label: "All" }]} />}
        empty={<Empty title={all.length ? "Nothing needs attention" : "No supplier invoices yet"} body={all.length ? "Every invoice in this scope matches or has been decided." : "Invoices arrive from the accounting source."} />}
        footerNote="amounts in different currencies are never compared or converted" />
    </>
  );
}
