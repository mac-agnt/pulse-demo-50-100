/* Detail and create panels shared by Finance and Purchasing. Each one reads
   the canonical objects through the core helpers and changes them only
   through core operations (store.run), so the same invoice, order, request or
   budget looks and behaves the same from either page and from Work. */

import { useState, type ReactNode } from "react";
import {
  accountingFreshness, approveMatchedInvoice, budgetOrders, budgetPosition, budgetsFor, can, canSeeInvoice, canSeeOrder, createBudget, createSupplier,
  FLAG_LABEL, fmtDate, fmtMoney, invoiceMatch, markOrderSent, matchInvoice, moduleEnabled, openCommitment, openInvoiceReview, openObject, ops,
  ORDER_STATUS, ordersFor, planVsActual, PURCHASE_CURRENCIES, purchaseFormId, receivableDaysOverdue, receivableOutstanding, receivablesFor, recordReceipt,
  sendOrder, setSupplierBlocked, setUpPurchasing, STAGE_DEFINITIONS, store, transactionsFor, updateSupplier, countsAsInvoiced,
  type Budget, type FieldValue, type Id, type PurchaseOrder, type RequestItem
} from "../../core";
import type { Result } from "../../core/ops";
import { Button, Chip, Empty, Field, KV, LABEL, Notice, Section, Select, SidePanel, TextArea, TextInput, toneOf } from "../kit";
import { ClickRow, EventList, FlagChips, InvoiceChip, Money, OrderChip, ReceivableChip, sendState, useFin, type FinPanel } from "./common";

type Open = (p: FinPanel) => void;

export function FinPanels({ panel, setPanel }: { panel: FinPanel | null; setPanel: (p: FinPanel | null) => void }) {
  if (!panel) return null;
  const close = () => setPanel(null);
  const id = panel.id || "";
  switch (panel.kind) {
    case "invoice": return <InvoicePanel key={id} id={id} onClose={close} open={setPanel} />;
    case "order": return <OrderPanel key={id} id={id} onClose={close} open={setPanel} />;
    case "supplier": return <SupplierPanel key={id} id={id} onClose={close} open={setPanel} />;
    case "budget": return <BudgetPanel key={id} id={id} onClose={close} open={setPanel} />;
    case "receivable": return <ReceivablePanel key={id} id={id} onClose={close} />;
    case "transaction": return <TransactionPanel key={id} id={id} onClose={close} open={setPanel} />;
    case "request": return <PurchaseRequestPanel key={id} id={id} onClose={close} open={setPanel} />;
    case "newRequest": return <NewPurchaseRequest onClose={close} open={setPanel} />;
    case "newSupplier": return <NewSupplier onClose={close} open={setPanel} />;
    case "newBudget": return <NewBudget onClose={close} open={setPanel} />;
    case "newReceipt": return <NewReceipt onClose={close} open={setPanel} presetOrderId={panel.id} />;
  }
}

/** Run an operation and keep its error next to the button that caused it. */
function useRun() {
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Result) => { const r = fn(); setErr(r.ok ? null : r.error); return r; };
  return { err, setErr, run };
}

const Missing = ({ what, onClose }: { what: string; onClose: () => void }) => (
  <SidePanel open onClose={onClose} title={what} width={520}>
    <Empty title="Not available" body={"This " + what.toLowerCase() + " does not exist, or your role cannot see it."} />
  </SidePanel>
);

function Link({ onClick, children, title }: { onClick: () => void; children: ReactNode; title?: string }) {
  return <button type="button" className="fx-link" onClick={onClick} title={title}>{children}</button>;
}

/* ── Supplier invoice ──────────────────────────────────────────────────── */

function InvoicePanel({ id, onClose, open }: { id: Id; onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q, d } = f;
  const { err, run } = useRun();
  const inv = core.data.invoices.find((i) => i.id === id);
  if (!inv || !canSeeInvoice(q, inv)) return <Missing what="Invoice" onClose={onClose} />;
  const sup = core.data.suppliers.find((x) => x.id === inv.supplierId);
  const m = invoiceMatch(core, inv);
  const o = m.order;
  const req = inv.requestId ? core.data.requests.find((r) => r.id === inv.requestId) : undefined;
  const ap = req ? core.data.approvals.find((a) => a.id === req.approvalId) : undefined;
  const waiting = ap?.stages.find((x) => x.status === "pending");
  const fr = accountingFreshness(core);
  const budget = f.showBudget && o?.budgetId ? core.data.budgets.find((b) => b.id === o.budgetId) : undefined;
  const pos = budget ? budgetPosition(core, budget.id) : null;
  const file = inv.fileId ? q.file(inv.fileId) : undefined;
  const reviewOpen = !!req && ["draft", "submitted", "changes_requested", "approved"].includes(req.status);
  const mayReview = f.canBuy || can(q.viewer, "finance.manage");
  const rcpt = m.receipts;
  const tol = core.config.purchasing.tolerancePercent;

  const footer = (
    <div className="fx-row" style={{ width: "100%" }}>
      {inv.status === "exception" && !reviewOpen && (
        <Button variant="primary" disabled={!mayReview} title={mayReview ? undefined : "Needs purchasing.manage or finance.manage"}
          onClick={() => run(() => store.run(openInvoiceReview, inv.id))}>Open review</Button>
      )}
      {inv.status === "matched" && !m.flags.length && (
        <Button variant="primary" disabled={!mayReview} title={mayReview ? undefined : "Needs purchasing.manage or finance.manage"}
          onClick={() => run(() => store.run(approveMatchedInvoice, inv.id))}>Approve for payment</Button>
      )}
      {req && <Button onClick={() => openObject("request", req.id)}>{"Open " + req.ref + " in Work"}</Button>}
      <span className="pk-grow" />
      {f.canBuy && (inv.status === "received" || inv.status === "matched" || inv.status === "exception") && (
        <Button variant="ghost" onClick={() => run(() => store.run(matchInvoice, inv.id))}>Match again</Button>
      )}
    </div>
  );

  return (
    <SidePanel open onClose={onClose} eyebrow="Supplier invoice" chips={<InvoiceChip inv={inv} />} title={inv.ref + ", " + (sup?.name || "Unknown supplier")} footer={footer}>
      {err && <Notice tone="bad">{err}</Notice>}
      {inv.status === "approved" && <Notice tone="ok">{"Approved for payment " + d(inv.approvedAt) + ". Not paid: payment is recorded only when " + (fr.label || "the accounting source") + " reports it."}</Notice>}
      {inv.status === "paid" && <Notice tone="ok">{"Paid on " + d(inv.paidAt) + ", as reported by " + fr.label + "."}</Notice>}
      {inv.status === "rejected" && <Notice tone="bad">Rejected. It is no longer counted as invoiced.</Notice>}
      {inv.status === "in_review" && req && (
        <Notice tone="warn">{"In review through " + req.ref + (waiting ? ", waiting on " + q.name(waiting.assigneeId) + " (" + waiting.label.toLowerCase() + ")" : "")
          + ". Approving it marks the invoice approved for payment; it does not pay it."}</Notice>
      )}
      {inv.status === "exception" && !reviewOpen && <Notice tone="warn">This invoice does not match. Open a review to decide it; a review is one request in Work, decided through the usual approval routing.</Notice>}
      {inv.status === "matched" && <Notice tone="ok">Matches its order and receipt within the tolerance.</Notice>}

      <Section label="Invoice">
        <KV items={[
          ["Amount", <Money n={inv.amount} cur={inv.currency} />],
          ["Issued", d(inv.issuedAt)],
          ["Due", d(inv.dueAt)],
          ["Order", o ? <Link onClick={() => open({ kind: "order", id: o.id })}>{o.ref}</Link> : "None linked"],
          ["Source", core.config.sources.find((x) => x.id === inv.sourceId)?.label || inv.sourceId],
          ["Updated in source", inv.sourceUpdatedAt ? fmtDate(inv.sourceUpdatedAt, f.tz, true) : "Not reported"],
          ["Read into Pulse", inv.ingestedAt ? fmtDate(inv.ingestedAt, f.tz, true) : "Entered in Pulse"],
          ["Source last synced", fr.lastSuccessAt ? fmtDate(fr.lastSuccessAt, f.tz, true) : "Never"]
        ]} />
      </Section>

      <Section label="Order, receipt and invoice">
        {!o ? <div className="fx-dim fx-small">No purchase order is linked, so there is nothing to compare with.</div> : (
          <div className="fx-table-wrap">
            <table className="fx-table fx-table--narrow fx-mini">
              <tbody>
                <tr><td>Order total ({o.ref})</td><td className="r"><Money n={o.total} cur={o.currency} /></td></tr>
                {m.otherInvoiced !== null && <tr><td>Other invoices counted on this order</td><td className="r"><Money n={m.otherInvoiced} cur={o.currency} /></td></tr>}
                <tr><td>This invoice</td><td className="r"><Money n={inv.amount} cur={inv.currency} /></td></tr>
                {m.limit !== null && <tr><td>{"Allowed with the " + tol + "% tolerance"}</td><td className="r"><Money n={m.limit} cur={o.currency} /></td></tr>}
                {m.difference !== null && <tr><td>Invoiced minus order, if accepted</td><td className="r"><Money n={m.difference} cur={o.currency} signed /></td></tr>}
                <tr><td>Received</td><td className="r">{rcpt.length
                  ? rcpt.map((r) => (o.status === "part_received" ? "Part, " : "") + fmtDate(r.at, f.tz)).join("; ")
                  : <span className="fx-neg">Nothing recorded</span>}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section label="Differences">
        {m.flags.length ? <ul className="fx-why">{m.flags.map((fl) => <li key={fl}><Chip tone={fl === "duplicate" || fl === "over_order" ? "bad" : "warn"}>{FLAG_LABEL[fl]}</Chip> {m.explain[fl]}</li>)}</ul>
          : <div className="fx-dim fx-small">None. The amount is within tolerance and the receipt rule is met.</div>}
        {m.duplicateOf && <div style={{ marginTop: 8 }}><Link onClick={() => open({ kind: "invoice", id: m.duplicateOf! })}>Open the earlier invoice</Link></div>}
      </Section>

      {pos && budget && (
        <Section label={"Budget: " + budget.label} right={<Link onClick={() => open({ kind: "budget", id: budget.id })}>Open budget</Link>}>
          <StageGrid pos={pos} compact />
        </Section>
      )}

      <Section label="Evidence">
        {file ? <div className="fx-row"><Link onClick={() => openObject("file", file.id)}>{file.title}</Link><span className="fx-faint fx-small">{"version " + file.versions[file.versions.length - 1].n + " of " + file.versions.length}</span></div>
          : <div className="fx-dim fx-small">{inv.fileId ? "The invoice document is restricted for your role." : "No invoice document is attached."}</div>}
        {rcpt.filter((r) => r.fileId).map((r) => { const rf = q.file(r.fileId!); return rf ? <div key={r.id} className="fx-row" style={{ marginTop: 6 }}><Link onClick={() => openObject("file", rf.id)}>{rf.title}</Link></div> : null; })}
      </Section>

      <Section label="History"><EventList storyKey={"invoice:" + inv.id} /></Section>
    </SidePanel>
  );
}

/* ── Budget stages ─────────────────────────────────────────────────────── */

export function StageGrid({ pos, compact }: { pos: NonNullable<ReturnType<typeof budgetPosition>>; compact?: boolean }) {
  const items: [keyof typeof STAGE_DEFINITIONS, string, number][] = [
    ["approved", "Approved", pos.approved], ["committed", "Committed", pos.committed], ["invoiced", "Invoiced", pos.invoiced], ["paid", "Paid", pos.paid], ["remaining", "Remaining", pos.remaining]
  ];
  return (
    <>
      <dl className="fx-stage">
        {items.map(([k, label, v]) => (
          <div key={k} title={STAGE_DEFINITIONS[k]}>
            <dt>{label}</dt>
            <dd className={k === "remaining" && v < 0 ? "fx-neg" : undefined}>{fmtMoney(v, pos.currency)}</dd>
            {!compact && <p>{STAGE_DEFINITIONS[k]}</p>}
          </div>
        ))}
      </dl>
      {pos.notes.length > 0 && <ul className="fx-why" style={{ marginTop: 10 }}>{pos.notes.map((n) => <li key={n} className="fx-small fx-dim">{n}</li>)}</ul>}
    </>
  );
}

export function StageBar({ pos }: { pos: NonNullable<ReturnType<typeof budgetPosition>> }) {
  const max = Math.max(pos.approved, pos.committed + pos.invoiced, 1);
  const w = (n: number) => Math.max(0, Math.min(100, (100 * n) / max)) + "%";
  const over = pos.committed + pos.invoiced > pos.approved;
  return (
    <span className="fx-bar" role="img" aria-label={"Invoiced " + fmtMoney(pos.invoiced, pos.currency) + ", committed " + fmtMoney(pos.committed, pos.currency) + " of " + fmtMoney(pos.approved, pos.currency) + " approved"}>
      <span className="fx-b-inv" style={{ left: 0, width: w(pos.invoiced) }} />
      <span className="fx-b-com" style={{ left: w(pos.invoiced), width: w(pos.committed) }} />
      <span className="fx-b-paid" style={{ left: 0, width: w(pos.paid) }} />
      {over && <span className="fx-b-over" style={{ left: w(pos.approved), width: "2px" }} />}
    </span>
  );
}

function BudgetPanel({ id, onClose, open }: { id: Id; onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q, d } = f;
  const b = budgetsFor(q, { ignoreScope: true }).find((x) => x.id === id);
  if (!f.access.view) return <SidePanel open onClose={onClose} title="Budget" width={520}><Empty title="Not available to you" body={f.access.reason || ""} /></SidePanel>;
  if (!b) return <Missing what="Budget" onClose={onClose} />;
  const pos = budgetPosition(core, b.id)!;
  const months = planVsActual(core, b.id);
  const orders = budgetOrders(core, b.id);
  const invs = core.data.invoices.filter((i) => orders.some((o) => o.id === i.orderId));
  const txs = core.data.transactions.filter((t) => pos.transactionIds.includes(t.id));
  const project = b.projectId ? core.data.projects.find((p) => p.id === b.projectId) : undefined;
  const sumPlan = months.reduce((n, m) => n + (m.planned ?? 0), 0);
  const unplanned = months.filter((m) => m.planned === null).length;
  return (
    <SidePanel open onClose={onClose} eyebrow="Budget" title={b.label} width={720}>
      <KV items={[
        ["Owner", q.name(b.ownerId)], ["Period", d(b.periodFrom) + " to " + d(b.periodTo)], ["Currency", b.currency],
        ["For", project ? (moduleEnabled(core.config, "projects") ? <Link onClick={() => openObject("project", project.id)}>{project.title}</Link> : project.title) : b.unitId ? q.unitLabel(b.unitId) : b.teamId ? q.teamLabel(b.teamId) : "Organisation"]
      ]} />
      <Section label="Where it stands"><StageGrid pos={pos} /></Section>
      <Section label="Planned and actual by month" right={<span className="fx-faint fx-small">{"Planned in total " + fmtMoney(sumPlan, b.currency) + (unplanned ? "; " + unplanned + " month" + (unplanned === 1 ? "" : "s") + " without a plan" : "")}</span>}>
        <div className="fx-table-wrap">
          <table className="fx-table fx-mini">
            <thead><tr><th>Month</th><th className="r">Planned</th><th className="r">Invoiced</th><th className="r">Paid</th><th className="r">Invoiced minus planned</th></tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="ink">{new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(m.month + "-01T00:00:00Z"))}</td>
                  <td className="r">{m.planned === null ? <span className="fx-faint">No plan</span> : <Money n={m.planned} cur={b.currency} />}</td>
                  <td className="r"><Money n={m.invoiced} cur={b.currency} /></td>
                  <td className="r"><Money n={m.paid} cur={b.currency} /></td>
                  <td className="r">{m.variance === null ? <span className="fx-faint">No plan</span> : <Money n={m.variance} cur={b.currency} signed />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fx-note">Actual is shown two ways, never added: invoiced by invoice date, paid by payment date.</div>
      </Section>
      <Section label={"Orders (" + orders.length + ")"}>
        {orders.length ? <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th className="r">Total</th><th className="r">Committed</th></tr></thead>
          <tbody>{orders.map((o) => (
            <ClickRow key={o.id} onOpen={() => open({ kind: "order", id: o.id })}>
              <td className="ink">{o.ref}</td><td>{core.data.suppliers.find((x) => x.id === o.supplierId)?.name}</td><td><OrderChip o={o} /></td>
              <td className="r"><Money n={o.total} cur={o.currency} /></td>
              <td className="r">{o.currency === b.currency ? <Money n={openCommitment(core, o)} cur={o.currency} /> : <span className="fx-faint">Other currency</span>}</td>
            </ClickRow>
          ))}</tbody></table></div> : <div className="fx-dim fx-small">No orders on this budget yet.</div>}
      </Section>
      <Section label={"Supplier invoices (" + invs.length + ")"}>
        {invs.length ? <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Invoice</th><th>Status</th><th className="r">Amount</th><th>Counted as invoiced</th></tr></thead>
          <tbody>{invs.map((i) => (
            <ClickRow key={i.id} onOpen={() => open({ kind: "invoice", id: i.id })}>
              <td className="ink">{i.ref}</td><td><InvoiceChip inv={i} /></td><td className="r"><Money n={i.amount} cur={i.currency} /></td>
              <td>{pos.invoiceIds.includes(i.id) ? "Yes" : <span className="fx-faint">{i.status === "rejected" ? "No, rejected" : !countsAsInvoiced(i) ? "No, possible duplicate" : "No, other currency"}</span>}</td>
            </ClickRow>
          ))}</tbody></table></div> : <div className="fx-dim fx-small">No supplier invoices on this budget yet.</div>}
      </Section>
      <Section label={"Payments counted (" + txs.length + ")"}>
        {txs.length ? <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Date</th><th>Description</th><th className="r">Amount</th></tr></thead>
          <tbody>{txs.map((t) => (
            <ClickRow key={t.id} onOpen={() => open({ kind: "transaction", id: t.id })}>
              <td>{d(t.date)}</td><td className="ink">{t.description}</td><td className="r"><Money n={t.amount} cur={t.currency} signed /></td>
            </ClickRow>
          ))}</tbody></table></div> : <div className="fx-dim fx-small">No payments reported by the accounting source yet.</div>}
      </Section>
      <Section label="History"><EventList storyKey={"budget:" + b.id} /></Section>
    </SidePanel>
  );
}

/* ── Purchase order ────────────────────────────────────────────────────── */

function OrderPanel({ id, onClose, open }: { id: Id; onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q, d } = f;
  const { err, setErr, run } = useRun();
  const [mode, setMode] = useState<"" | "sent" | "receipt">("");
  const [how, setHow] = useState("");
  const [full, setFull] = useState(true);
  const [note, setNote] = useState("");
  const o = core.data.orders.find((x) => x.id === id);
  if (!o || !canSeeOrder(q, o)) return <Missing what="Order" onClose={onClose} />;
  const sup = core.data.suppliers.find((x) => x.id === o.supplierId);
  const req = o.requestId ? q.request(o.requestId) : undefined;
  const budget = f.showBudget && o.budgetId ? core.data.budgets.find((b) => b.id === o.budgetId) : undefined;
  const project = o.projectId ? core.data.projects.find((p) => p.id === o.projectId) : undefined;
  const receipts = core.data.receipts.filter((r) => r.orderId === o.id);
  const invs = core.data.invoices.filter((i) => i.orderId === o.id);
  const me = q.viewer.person.id;
  const mayReceive = f.canBuy || o.ownerId === me || req?.requesterId === me;
  const receivable = o.status === "approved" || o.status === "sent" || o.status === "part_received";
  const srcId = core.config.purchasing.orderingSourceId;
  const orderingSrc = srcId ? core.config.sources.find((x) => x.id === srcId) : undefined;

  const footer = mode === "sent" ? (
    <div className="fx-form" style={{ width: "100%" }}>
      <Field label="How was it sent?" help="For example: emailed to the supplier's orders address. Pulse does not contact the supplier.">
        <TextInput value={how} onChange={setHow} ariaLabel="How the order was sent" />
      </Field>
      <div className="fx-row">
        <Button variant="primary" onClick={() => { if (run(() => store.run(markOrderSent, o.id, how)).ok) { setMode(""); setHow(""); } }}>Record as sent</Button>
        <Button variant="ghost" onClick={() => setMode("")}>Cancel</Button>
      </div>
    </div>
  ) : mode === "receipt" ? (
    <div className="fx-form" style={{ width: "100%" }}>
      <div className="fx-row" role="radiogroup" aria-label="What arrived">
        <label className="fx-row fx-small"><input type="radio" checked={full} onChange={() => setFull(true)} /> Everything on the order</label>
        <label className="fx-row fx-small"><input type="radio" checked={!full} onChange={() => setFull(false)} /> Part of it</label>
      </div>
      <Field label={full ? "Note (optional)" : "What arrived"}><TextInput value={note} onChange={setNote} ariaLabel="Receipt note" /></Field>
      <div className="fx-row">
        <Button variant="primary" onClick={() => { if (run(() => store.run(recordReceipt, o.id, { full, note })).ok) { setMode(""); setNote(""); } }}>Record receipt</Button>
        <Button variant="ghost" onClick={() => setMode("")}>Cancel</Button>
      </div>
    </div>
  ) : (
    <div className="fx-row" style={{ width: "100%" }}>
      {o.status === "approved" && (
        <Button variant="primary" disabled={!f.canBuy} title={f.canBuy ? undefined : "Needs purchasing.manage"} onClick={() => run(() => store.run(sendOrder, o.id))}>Send to supplier</Button>
      )}
      {o.status === "approved" && f.canBuy && <Button onClick={() => { setErr(null); setMode("sent"); }}>Record as sent outside Pulse</Button>}
      {receivable && <Button disabled={!mayReceive} title={mayReceive ? undefined : "Only the order owner, its requester or purchasing can record a receipt"} onClick={() => { setErr(null); setMode("receipt"); }}>Record receipt</Button>}
    </div>
  );

  return (
    <SidePanel open onClose={onClose} eyebrow="Purchase order" chips={<OrderChip o={o} />} title={o.ref + ", " + (sup?.name || "Unknown supplier")} footer={footer} width={640}>
      {err && <Notice tone="bad">{err}{err.startsWith("No ordering connection") ? " If you sent it yourself, record it as sent outside Pulse." : ""}</Notice>}
      {o.status === "approved" && !err && <Notice>{orderingSrc?.connected ? "Approved. It can be sent through " + orderingSrc.label + "." : "Approved in Pulse. No ordering connection is configured, so Pulse cannot send it to the supplier."}</Notice>}
      <KV items={[
        ["Supplier", sup ? <Link onClick={() => open({ kind: "supplier", id: sup.id })}>{sup.name}</Link> : "Unknown"],
        ["Total", <Money n={o.total} cur={o.currency} />],
        ["Open commitment", <span title="Order total minus counted invoices, for open orders"><Money n={openCommitment(core, o)} cur={o.currency} /></span>],
        ...(budget ? [["Budget", <Link onClick={() => open({ kind: "budget", id: budget.id })}>{budget.label}</Link>] as [string, ReactNode]] : []),
        ...(project ? [["Project", moduleEnabled(core.config, "projects") ? <Link onClick={() => openObject("project", project.id)}>{project.title}</Link> : project.title] as [string, ReactNode]] : []),
        ["Owner", q.name(o.ownerId)], ["Created", d(o.createdAt)], ["Expected", d(o.expectedAt)], ["Sending", sendState(o)]
      ]} />
      {o.requestId && (
        <Section label="Purchase request">
          {req ? <div className="fx-row"><Link onClick={() => open({ kind: "request", id: req.id })}>{req.ref + ": " + req.title}</Link><Chip tone={toneOf.approval(req.status === "approved" ? "approved" : "pending")}>{LABEL.request[req.status]}</Chip></div>
            : <div className="fx-dim fx-small">Raised from a request your role cannot see.</div>}
        </Section>
      )}
      <Section label="Lines">
        <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Item or service</th><th className="r">Quantity</th><th className="r">Unit price</th><th className="r">Amount</th></tr></thead>
          <tbody>{o.lines.map((l) => (
            <tr key={l.id}><td className="ink">{l.description}</td><td className="r">{l.quantity !== undefined ? l.quantity + (l.unit ? " " + l.unit : "") : <span className="fx-faint">Not given</span>}</td>
              <td className="r">{l.unitPrice !== undefined ? <Money n={l.unitPrice} cur={o.currency} /> : <span className="fx-faint">Not given</span>}</td><td className="r"><Money n={l.amount} cur={o.currency} /></td></tr>
          ))}</tbody></table></div>
      </Section>
      <Section label={"Receipts (" + receipts.length + ")"}>
        {receipts.length ? <ul className="fx-hist">{receipts.map((r) => (
          <li key={r.id}><time>{fmtDate(r.at, f.tz)}</time><span>{q.name(r.by) + ": " + (r.lines.length === o.lines.length && r.lines.every((x) => !x.note || x.quantity !== undefined) ? "everything on the order" : "part")
            + (r.lines.find((x) => x.note)?.note ? ", " + r.lines.find((x) => x.note)!.note : "")}</span></li>
        ))}</ul> : <div className="fx-dim fx-small">Nothing recorded as received yet.</div>}
      </Section>
      <Section label={"Supplier invoices (" + invs.length + ")"}>
        {invs.length ? <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Invoice</th><th>Status</th><th>Differences</th><th className="r">Amount</th></tr></thead>
          <tbody>{invs.map((i) => (
            <ClickRow key={i.id} onOpen={() => open({ kind: "invoice", id: i.id })}>
              <td className="ink">{i.ref}</td><td><InvoiceChip inv={i} /></td><td><FlagChips flags={i.flags} /></td><td className="r"><Money n={i.amount} cur={i.currency} /></td>
            </ClickRow>
          ))}</tbody></table></div> : <div className="fx-dim fx-small">No invoice received yet.</div>}
      </Section>
      <Section label="History"><EventList storyKey={"order:" + o.id} /></Section>
    </SidePanel>
  );
}

/* ── Supplier profile ──────────────────────────────────────────────────── */

const OBL_TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "accent"> = { approved: "ok", received: "accent", under_review: "accent", missing: "bad", rejected: "bad", expired: "bad" };
const OBL_LABEL: Record<string, string> = { missing: "Missing", received: "Received, not reviewed", under_review: "Under review", approved: "Approved", rejected: "Rejected", expired: "Expired" };

function SupplierPanel({ id, onClose, open }: { id: Id; onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q } = f;
  const { err, run } = useRun();
  const sup = core.data.suppliers.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: sup?.name || "", category: sup?.category || "", terms: String(sup?.paymentTermsDays ?? 30), ownerId: sup?.ownerId || "", notes: sup?.notes || "", status: sup?.status === "onboarding" ? "onboarding" : "active" });
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  if (!sup || q.viewer.person.kind !== "staff") return <Missing what="Supplier" onClose={onClose} />;
  const orders = ordersFor(q, { ignoreScope: true }).filter((o) => o.supplierId === sup.id);
  const invs = core.data.invoices.filter((i) => i.supplierId === sup.id && canSeeInvoice(q, i));
  const obligations = f.standardsOn ? core.data.obligations.filter((o) => o.subject.kind === "supplier" && o.subject.id === sup.id) : [];
  const reqLabel = (rid: string) => core.config.standards.requirements.find((r) => r.id === rid)?.label || rid;
  const staff = q.people({ kind: "staff" });

  const footer = !f.canBuy ? undefined : edit ? (
    <div className="fx-row">
      <Button variant="primary" onClick={() => {
        const r = run(() => store.run(updateSupplier, sup.id, { name: form.name, category: form.category, paymentTermsDays: Number(form.terms), ownerId: form.ownerId || undefined, notes: form.notes,
          status: sup.status === "blocked" ? undefined : (form.status as "active" | "onboarding") }));
        if (r.ok) setEdit(false);
      }}>Save</Button>
      <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
    </div>
  ) : blocking ? (
    <div className="fx-form" style={{ width: "100%" }}>
      <Field label={sup.status === "blocked" ? "Why unblock?" : "Why block?"}><TextInput value={reason} onChange={setReason} ariaLabel="Reason" /></Field>
      <div className="fx-row">
        <Button variant={sup.status === "blocked" ? "primary" : "danger"} onClick={() => { if (run(() => store.run(setSupplierBlocked, sup.id, sup.status !== "blocked", reason)).ok) { setBlocking(false); setReason(""); } }}>
          {sup.status === "blocked" ? "Unblock" : "Block supplier"}</Button>
        <Button variant="ghost" onClick={() => setBlocking(false)}>Cancel</Button>
      </div>
    </div>
  ) : (
    <div className="fx-row">
      <Button onClick={() => setEdit(true)}>Edit details</Button>
      <Button variant={sup.status === "blocked" ? "secondary" : "ghost"} onClick={() => setBlocking(true)}>{sup.status === "blocked" ? "Unblock" : "Block"}</Button>
    </div>
  );

  return (
    <SidePanel open onClose={onClose} eyebrow="Supplier" title={sup.name} width={620} footer={footer}
      chips={<Chip tone={sup.status === "active" ? "ok" : sup.status === "blocked" ? "bad" : "warn"}>{sup.status === "active" ? "Active" : sup.status === "blocked" ? "Blocked" : "Onboarding"}</Chip>}>
      {err && <Notice tone="bad">{err}</Notice>}
      {sup.status === "blocked" && <Notice tone="bad">Blocked: new orders to this supplier cannot be created. Open orders stay as they are.</Notice>}
      {edit ? (
        <div className="fx-form">
          <div className="fx-form-2">
            <Field label="Name"><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} ariaLabel="Supplier name" /></Field>
            <Field label="Category"><TextInput value={form.category} onChange={(v) => setForm({ ...form, category: v })} ariaLabel="Category" /></Field>
            <Field label="Payment terms, days"><TextInput type="number" value={form.terms} onChange={(v) => setForm({ ...form, terms: v })} ariaLabel="Payment terms in days" /></Field>
            <Field label="Owner"><Select value={form.ownerId} onChange={(v) => setForm({ ...form, ownerId: v })} ariaLabel="Owner" options={staff.map((p) => ({ value: p.id, label: p.name }))} /></Field>
            {sup.status !== "blocked" && <Field label="Status"><Select value={form.status} onChange={(v) => setForm({ ...form, status: v })} ariaLabel="Status"
              options={[{ value: "active", label: "Active" }, { value: "onboarding", label: "Onboarding" }]} /></Field>}
          </div>
          <Field label="Notes"><TextArea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /></Field>
        </div>
      ) : (
        <KV items={[["Category", sup.category], ["Payment terms", sup.paymentTermsDays + " days"], ["Owner", q.name(sup.ownerId)],
          ["Open orders", String(orders.filter((o) => openCommitment(core, o) > 0).length)], ...(sup.notes ? [["Notes", sup.notes] as [string, ReactNode]] : [])]} />
      )}
      {f.standardsOn && (
        <Section label="Requirements">
          {obligations.length ? <ul className="fx-hist">{obligations.map((ob) => (
            <li key={ob.id}><span className="pk-grow">{reqLabel(ob.requirementId)}</span><Chip tone={OBL_TONE[ob.state] || "neutral"}>{OBL_LABEL[ob.state] || ob.state}</Chip>
              <Link onClick={() => openObject("obligation", ob.id)}>Open</Link></li>
          ))}</ul> : <div className="fx-dim fx-small">No requirements apply to this supplier.</div>}
        </Section>
      )}
      <Section label={"Orders (" + orders.length + ")"}>
        {orders.length ? <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Order</th><th>Status</th><th className="r">Total</th></tr></thead>
          <tbody>{orders.map((o) => (
            <ClickRow key={o.id} onOpen={() => open({ kind: "order", id: o.id })}><td className="ink">{o.ref}<span className="fx-sub">{o.lines[0]?.description}</span></td><td><OrderChip o={o} /></td><td className="r"><Money n={o.total} cur={o.currency} /></td></ClickRow>
          ))}</tbody></table></div> : <div className="fx-dim fx-small">No orders you can see.</div>}
      </Section>
      <Section label={"Invoices (" + invs.length + ")"}>
        {invs.length ? <div className="fx-table-wrap"><table className="fx-table fx-mini">
          <thead><tr><th>Invoice</th><th>Status</th><th>Due</th><th className="r">Amount</th></tr></thead>
          <tbody>{invs.map((i) => (
            <ClickRow key={i.id} onOpen={() => open({ kind: "invoice", id: i.id })}><td className="ink">{i.ref}</td><td><InvoiceChip inv={i} /></td><td>{f.d(i.dueAt)}</td><td className="r"><Money n={i.amount} cur={i.currency} /></td></ClickRow>
          ))}</tbody></table></div> : <div className="fx-dim fx-small">No invoices you can see.</div>}
      </Section>
      <Section label="History"><EventList storyKey={"supplier:" + sup.id} /></Section>
    </SidePanel>
  );
}

/* ── Receivable and transaction (read-only, from the accounting source) ── */

function ReceivablePanel({ id, onClose }: { id: Id; onClose: () => void }) {
  const f = useFin();
  const { core, q, d, now } = f;
  const r = receivablesFor(q, { ignoreScope: true }).find((x) => x.id === id);
  if (!r) return <Missing what="Receivable" onClose={onClose} />;
  const rec = r.recordId ? q.record(r.recordId) : undefined;
  const pays = core.data.transactions.filter((t) => t.receivableId === r.id);
  const od = receivableDaysOverdue(r, now);
  return (
    <SidePanel open onClose={onClose} eyebrow="Receivable" title={r.ref + ", " + r.counterparty} chips={<ReceivableChip r={r} overdueDays={od} />} width={560}>
      <KV items={[
        ["Amount", <Money n={r.amount} cur={r.currency} />], ["Paid", <Money n={r.paidAmount} cur={r.currency} />], ["Outstanding", <Money n={receivableOutstanding(r)} cur={r.currency} />],
        ["Issued", d(r.issuedAt)], ["Due", d(r.dueAt)], ["Unit", r.unitId ? q.unitLabel(r.unitId) : "Organisation"],
        ["Counterparty record", rec ? <Link onClick={() => openObject("record", rec.id)}>{rec.ref + " " + rec.title}</Link> : "Not linked"],
        ["Source", core.config.sources.find((x) => x.id === r.sourceId)?.label || r.sourceId],
        ["Updated in source", r.sourceUpdatedAt ? fmtDate(r.sourceUpdatedAt, f.tz, true) : "Not reported"], ["Read into Pulse", r.ingestedAt ? fmtDate(r.ingestedAt, f.tz, true) : "Entered in Pulse"]
      ]} />
      <Section label={"Payments received (" + pays.length + ")"}>
        {pays.length ? <ul className="fx-hist">{pays.map((t) => <li key={t.id}><time>{d(t.date)}</time><span className="pk-grow">{t.description}</span><Money n={t.amount} cur={t.currency} signed /></li>)}</ul>
          : <div className="fx-dim fx-small">No payment reported by the accounting source yet.</div>}
      </Section>
      <Section label="History"><EventList storyKey={"receivable:" + r.id} /></Section>
    </SidePanel>
  );
}

function TransactionPanel({ id, onClose, open }: { id: Id; onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q, d } = f;
  const t = transactionsFor(q, { ignoreScope: true }).find((x) => x.id === id);
  if (!t) return <Missing what="Transaction" onClose={onClose} />;
  const inv = t.invoiceId ? core.data.invoices.find((i) => i.id === t.invoiceId) : undefined;
  const rec = t.receivableId ? core.data.receivables.find((r) => r.id === t.receivableId) : undefined;
  const budget = t.budgetId ? core.data.budgets.find((b) => b.id === t.budgetId) : undefined;
  const src = core.config.sources.find((x) => x.id === t.sourceId);
  return (
    <SidePanel open onClose={onClose} eyebrow="Transaction" title={t.description} width={540}>
      <Notice>{"Read-only. It comes from " + (src?.label || "the accounting source") + "; Pulse never posts, changes or pays transactions."}</Notice>
      <KV items={[
        ["Amount", <Money n={t.amount} cur={t.currency} signed />], ["Date", d(t.date)], ["Counterparty", t.counterparty],
        ["Kind", t.kind === "payment_in" ? "Money in" : t.kind === "payment_out" ? "Money out" : "Other"],
        ["Invoice", inv ? <Link onClick={() => open({ kind: "invoice", id: inv.id })}>{inv.ref}</Link> : "None"],
        ["Receivable", rec ? <Link onClick={() => open({ kind: "receivable", id: rec.id })}>{rec.ref}</Link> : "None"],
        ["Budget", budget ? <Link onClick={() => open({ kind: "budget", id: budget.id })}>{budget.label}</Link> : "None"],
        ["Source row", t.externalId || "Not given"],
        ["Updated in source", t.sourceUpdatedAt ? fmtDate(t.sourceUpdatedAt, f.tz, true) : "Not reported"], ["Read into Pulse", t.ingestedAt ? fmtDate(t.ingestedAt, f.tz, true) : "Unknown"]
      ]} />
    </SidePanel>
  );
}

/* ── Purchase request (the canonical request) ──────────────────────────── */

function PurchaseRequestPanel({ id, onClose, open }: { id: Id; onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q, d } = f;
  const { err, run } = useRun();
  const r = q.request(id);
  if (!r) return <Missing what="Request" onClose={onClose} />;
  const ap = r.approvalId ? q.approval(r.approvalId) : undefined;
  const order = core.data.orders.find((o) => o.requestId === r.id);
  const sup = core.data.suppliers.find((x) => x.id === r.fields.supplierId);
  const budget = f.showBudget && typeof r.fields.budgetId === "string" ? core.data.budgets.find((b) => b.id === r.fields.budgetId) : undefined;
  const project = typeof r.fields.projectId === "string" ? core.data.projects.find((p) => p.id === r.fields.projectId) : undefined;
  const me = q.viewer.person.id;
  const approvers = ap ? ap.decisions.filter((x) => x.cycle === ap.cycle && x.kind === "approve").map((x) => x.actorId) : [];
  const mayRun = r.requesterId === me || approvers.includes(me) || can(q.viewer, "workflows.operate");
  const ready = r.status === "approved" && ap?.status === "approved" && r.execution.status !== "succeeded";
  const cur = String(r.fields.currency || f.cur);
  const amount = typeof r.fields.amount === "number" ? r.fields.amount : Number(r.fields.amount);

  const footer = (
    <div className="fx-row" style={{ width: "100%" }}>
      {ready && <Button variant="primary" disabled={!mayRun} title={mayRun ? undefined : "Only the requester, an approver or a workflow operator can run this"}
        onClick={() => run(() => store.run(ops.executeRequest, r.id))}>{r.execution.status === "failed" ? "Try again" : "Create order"}</Button>}
      {order && <Button onClick={() => open({ kind: "order", id: order.id })}>{"Open " + order.ref}</Button>}
      <Button onClick={() => openObject("request", r.id)}>Open in Work</Button>
    </div>
  );

  return (
    <SidePanel open onClose={onClose} eyebrow={"Purchase request · " + r.ref} title={r.title} width={600} footer={footer}
      chips={<Chip tone={r.status === "approved" ? "ok" : r.status === "declined" || r.status === "withdrawn" ? "bad" : r.status === "changes_requested" ? "warn" : "accent"}>{LABEL.request[r.status]}</Chip>}>
      {err && <Notice tone="bad">{err}</Notice>}
      {r.status === "approved" && r.execution.status === "not_started" && <Notice tone="warn">Approved, but the order has not been created yet. The decision and the action are separate: create the order when ready.</Notice>}
      {r.execution.status === "failed" && <Notice tone="bad">{"Creating the order failed: " + (r.execution.lastError || "unknown reason") + "."}</Notice>}
      {order && <Notice tone="ok">{order.ref + " was created from this request. " + sendState(order) + "."}</Notice>}
      <KV items={[
        ["Supplier", sup ? <Link onClick={() => open({ kind: "supplier", id: sup.id })}>{sup.name}</Link> : String(r.fields.supplierId || "None")],
        ["Amount", isFinite(amount) ? <Money n={amount} cur={cur} /> : "None"], ["Needed by", typeof r.fields.neededBy === "string" ? d(r.fields.neededBy + "T12:00:00Z") : "None"],
        ["Requester", q.name(r.requesterId)], ["Team", q.teamLabel(r.teamId)],
        ...(budget ? [["Budget", <Link onClick={() => open({ kind: "budget", id: budget.id })}>{budget.label}</Link>] as [string, ReactNode]] : []),
        ...(project ? [["Project", project.title] as [string, ReactNode]] : []),
        ["Action", LABEL.exec[r.execution.status]]
      ]} />
      <Section label="What is needed"><div className="fx-small" style={{ color: "var(--body)", lineHeight: 1.5 }}>{String(r.fields.description || "")}</div></Section>
      {ap && (
        <Section label="Decisions">
          <ul className="fx-hist">{ap.stages.map((st) => (
            <li key={st.stageId}><span className="pk-grow">{st.label + (st.assigneeId ? ": " + q.name(st.assigneeId) : "")}</span>
              <Chip tone={st.status === "approved" ? "ok" : st.status === "declined" ? "bad" : st.status === "pending" ? "warn" : "neutral"}>
                {st.status === "skipped" ? "Not needed" : st.status === "pending" ? "Waiting" : st.status === "waiting" ? "Later" : st.status.charAt(0).toUpperCase() + st.status.slice(1)}</Chip></li>
          ))}</ul>
          {ap.policyException && <div className="fx-note">{ap.policyException}</div>}
        </Section>
      )}
    </SidePanel>
  );
}

/* ── New purchase request ──────────────────────────────────────────────── */

function NewPurchaseRequest({ onClose, open }: { onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q } = f;
  const { err, setErr, run } = useRun();
  const fid = purchaseFormId(core);
  const form = core.config.requestForms.find((x) => x.id === fid && x.enabled);
  const teams = q.viewer.memberTeamIds;
  const [v, setV] = useState({ title: "", supplierId: "", description: "", amount: "", currency: f.cur, projectId: "", budgetId: "", neededBy: "", teamId: teams[0] || "" });
  const [tried, setTried] = useState(false);
  if (!form) {
    const admin = can(q.viewer, "settings.edit");
    return (
      <SidePanel open onClose={onClose} title="New purchase request" eyebrow="Purchasing" width={520}>
        {err && <Notice tone="bad">{err}</Notice>}
        <Empty title="Purchase requests are not set up" body={admin ? "Add the purchase request and invoice review forms with default approval routing. You can change the routing afterwards in Settings, Control."
          : "There is no purchase request form yet. Ask an administrator to set up purchase requests."}
          action={admin ? <Button variant="primary" onClick={() => run(() => store.run(setUpPurchasing))}>Set up purchase requests</Button> : undefined} />
      </SidePanel>
    );
  }
  const suppliers = core.data.suppliers.filter((x) => x.status !== "blocked");
  const blocked = core.data.suppliers.length - suppliers.length;
  const projects = moduleEnabled(core.config, "projects") ? core.data.projects.filter((p) => q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })) : [];
  const budgets: Budget[] = f.showBudget ? budgetsFor(q, { ignoreScope: true }) : [];
  const amt = Number(v.amount);
  const errors: Record<string, string> = {};
  if (!v.title.trim()) errors.title = "Give the request a title.";
  if (!v.supplierId) errors.supplierId = suppliers.length ? "Choose a supplier." : "Add a supplier first.";
  if (!v.description.trim()) errors.description = "Say what is needed.";
  if (!(amt > 0)) errors.amount = "Enter an amount above 0.";
  if (!v.neededBy) errors.neededBy = "Give a date.";
  if (!v.teamId) errors.teamId = "You are not in a team, so the request has nobody to route to.";
  const budget = budgets.find((b) => b.id === v.budgetId);
  const E = (k: string) => (tried ? errors[k] : undefined);
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });

  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length) { setErr("Fix the highlighted fields first. Nothing has been saved yet."); return; }
    const fields: Record<string, FieldValue> = { supplierId: v.supplierId, description: v.description.trim(), amount: amt, currency: v.currency,
      projectId: v.projectId || null, budgetId: v.budgetId || null, neededBy: v.neededBy };
    const r = run(() => store.run(ops.createRequest, { formId: form.id, title: v.title, fields, evidenceFileIds: [], linkedRecordIds: [], teamId: v.teamId, submit: true }));
    if (r.ok && r.id) open({ kind: "request", id: r.id });
  };

  return (
    <SidePanel open onClose={onClose} eyebrow="Purchasing" title="New purchase request" width={560}
      footer={<div className="fx-row"><Button variant="primary" onClick={submit}>Submit for approval</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>}>
      <div className="fx-form">
        {err && <Notice tone="bad">{err}</Notice>}
        <Notice>It becomes a request in Work and follows the configured approval routing. Above 5,000 needs a second decision. Once approved, the order is created when the approved action runs; nothing is sent to the supplier.</Notice>
        <Field label="Title" error={E("title")}><TextInput value={v.title} onChange={set("title")} ariaLabel="Title" invalid={!!E("title")} /></Field>
        <Field label="Supplier" error={E("supplierId")} help={blocked ? blocked + " blocked supplier" + (blocked === 1 ? " is" : "s are") + " not listed." : undefined}>
          <Select value={v.supplierId} onChange={set("supplierId")} ariaLabel="Supplier" invalid={!!E("supplierId")}
            options={[{ value: "", label: suppliers.length ? "Choose a supplier" : "No suppliers yet" }, ...suppliers.map((x) => ({ value: x.id, label: x.name + ", " + x.category + (x.status === "onboarding" ? " (onboarding)" : "") }))]} />
        </Field>
        <Field label="What is needed" error={E("description")}><TextArea value={v.description} onChange={set("description")} invalid={!!E("description")} /></Field>
        <div className="fx-form-2">
          <Field label="Amount" error={E("amount")}><TextInput type="number" value={v.amount} onChange={set("amount")} ariaLabel="Amount" invalid={!!E("amount")} /></Field>
          <Field label="Currency"><Select value={v.currency} onChange={set("currency")} ariaLabel="Currency" options={PURCHASE_CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="Needed by" error={E("neededBy")}><TextInput type="date" value={v.neededBy} onChange={set("neededBy")} ariaLabel="Needed by" invalid={!!E("neededBy")} /></Field>
          {teams.length > 1 && <Field label="Team" error={E("teamId")}><Select value={v.teamId} onChange={set("teamId")} ariaLabel="Team" options={teams.map((t) => ({ value: t, label: q.teamLabel(t) }))} /></Field>}
          {projects.length > 0 && <Field label="Project (optional)"><Select value={v.projectId} onChange={set("projectId")} ariaLabel="Project"
            options={[{ value: "", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} /></Field>}
          {budgets.length > 0 && <Field label="Budget (optional)" help={budget && budget.currency !== v.currency ? "This budget is in " + budget.currency + "; an order in " + v.currency + " will not count against it." : undefined}>
            <Select value={v.budgetId} onChange={set("budgetId")} ariaLabel="Budget" options={[{ value: "", label: "No budget" }, ...budgets.map((b) => ({ value: b.id, label: b.label }))]} /></Field>}
        </div>
        {!teams.length && E("teamId") && <Notice tone="bad">{E("teamId")}</Notice>}
      </div>
    </SidePanel>
  );
}

/* ── New supplier, budget, receipt ─────────────────────────────────────── */

function NewSupplier({ onClose, open }: { onClose: () => void; open: Open }) {
  const f = useFin();
  const { err, run } = useRun();
  const [v, setV] = useState({ name: "", category: "", terms: "30", notes: "" });
  const save = () => { const r = run(() => store.run(createSupplier, { name: v.name, category: v.category, paymentTermsDays: Number(v.terms), notes: v.notes })); if (r.ok && r.id) open({ kind: "supplier", id: r.id }); };
  return (
    <SidePanel open onClose={onClose} eyebrow="Purchasing" title="Add supplier" width={520}
      footer={<div className="fx-row"><Button variant="primary" disabled={!f.canBuy} title={f.canBuy ? undefined : "Needs purchasing.manage"} onClick={save}>Add supplier</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>}>
      <div className="fx-form">
        {!f.canBuy && <Notice tone="warn">Adding suppliers needs the purchasing.manage permission. Your role does not have it.</Notice>}
        {err && <Notice tone="bad">{err}</Notice>}
        <Field label="Name"><TextInput value={v.name} onChange={(x) => setV({ ...v, name: x })} ariaLabel="Supplier name" /></Field>
        <div className="fx-form-2">
          <Field label="Category" help="For example Equipment, Software or Professional services."><TextInput value={v.category} onChange={(x) => setV({ ...v, category: x })} ariaLabel="Category" /></Field>
          <Field label="Payment terms, days"><TextInput type="number" value={v.terms} onChange={(x) => setV({ ...v, terms: x })} ariaLabel="Payment terms in days" /></Field>
        </div>
        <Field label="Notes (optional)"><TextArea value={v.notes} onChange={(x) => setV({ ...v, notes: x })} /></Field>
      </div>
    </SidePanel>
  );
}

function NewBudget({ onClose, open }: { onClose: () => void; open: Open }) {
  const f = useFin();
  const { core, q } = f;
  const { err, run } = useRun();
  const year = f.now.slice(0, 4);
  const [v, setV] = useState({ label: "", ownerId: q.viewer.person.id, approved: "", currency: f.cur, from: year + "-01-01", to: year + "-12-31", projectId: "", unitId: "" });
  const projects = moduleEnabled(core.config, "projects") ? core.data.projects : [];
  const save = () => {
    const p = projects.find((x) => x.id === v.projectId);
    const r = run(() => store.run(createBudget, { label: v.label, ownerId: v.ownerId, approved: Number(v.approved), currency: v.currency.trim().toUpperCase(), periodFrom: v.from, periodTo: v.to,
      projectId: v.projectId || undefined, unitId: v.unitId || p?.unitId || undefined, teamId: p?.teamId }));
    if (r.ok && r.id) open({ kind: "budget", id: r.id });
  };
  return (
    <SidePanel open onClose={onClose} eyebrow="Finance" title="New budget" width={540}
      footer={<div className="fx-row"><Button variant="primary" disabled={!f.access.manage} title={f.access.manage ? undefined : "Needs finance.manage"} onClick={save}>Create budget</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>}>
      <div className="fx-form">
        {!f.access.manage && <Notice tone="warn">Creating budgets needs the finance.manage permission. Your role does not have it.</Notice>}
        {err && <Notice tone="bad">{err}</Notice>}
        <Field label="Name"><TextInput value={v.label} onChange={(x) => setV({ ...v, label: x })} ariaLabel="Budget name" /></Field>
        <div className="fx-form-2">
          <Field label="Approved amount"><TextInput type="number" value={v.approved} onChange={(x) => setV({ ...v, approved: x })} ariaLabel="Approved amount" /></Field>
          <Field label="Currency"><Select value={v.currency} onChange={(x) => setV({ ...v, currency: x })} ariaLabel="Currency" options={PURCHASE_CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="From"><TextInput type="date" value={v.from} onChange={(x) => setV({ ...v, from: x })} ariaLabel="Period start" /></Field>
          <Field label="To"><TextInput type="date" value={v.to} onChange={(x) => setV({ ...v, to: x })} ariaLabel="Period end" /></Field>
          <Field label="Owner"><Select value={v.ownerId} onChange={(x) => setV({ ...v, ownerId: x })} ariaLabel="Owner" options={q.people({ kind: "staff" }).map((p) => ({ value: p.id, label: p.name }))} /></Field>
          {projects.length > 0 && <Field label="Project (optional)"><Select value={v.projectId} onChange={(x) => setV({ ...v, projectId: x })} ariaLabel="Project" options={[{ value: "", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} /></Field>}
          {core.config.capabilities.units && core.config.units.length > 0 && !v.projectId && <Field label={core.config.terminology.unit + " (optional)"}>
            <Select value={v.unitId} onChange={(x) => setV({ ...v, unitId: x })} ariaLabel="Unit" options={[{ value: "", label: "Whole organisation" }, ...core.config.units.map((u) => ({ value: u.id, label: u.label }))]} /></Field>}
        </div>
      </div>
    </SidePanel>
  );
}

function NewReceipt({ onClose, open, presetOrderId }: { onClose: () => void; open: Open; presetOrderId?: Id }) {
  const f = useFin();
  const { core, q } = f;
  const { err, run } = useRun();
  const me = q.viewer.person.id;
  const openOrders = ordersFor(q, { ignoreScope: true }).filter((o) => (o.status === "approved" || o.status === "sent" || o.status === "part_received")
    && (f.canBuy || o.ownerId === me || core.data.requests.find((r) => r.id === o.requestId)?.requesterId === me));
  const [orderId, setOrderId] = useState(presetOrderId || "");
  const [full, setFull] = useState(true);
  const [note, setNote] = useState("");
  const label = (o: PurchaseOrder) => o.ref + ", " + (core.data.suppliers.find((x) => x.id === o.supplierId)?.name || "") + " (" + ORDER_STATUS[o.status].toLowerCase() + ")";
  return (
    <SidePanel open onClose={onClose} eyebrow="Purchasing" title="Record receipt" width={520}
      footer={<div className="fx-row"><Button variant="primary" disabled={!orderId} onClick={() => { const r = run(() => store.run(recordReceipt, orderId, { full, note })); if (r.ok) open({ kind: "order", id: orderId }); }}>Record receipt</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button></div>}>
      <div className="fx-form">
        {err && <Notice tone="bad">{err}</Notice>}
        {!openOrders.length ? <Empty title="Nothing to receive" body="There are no open orders you can record a receipt for." /> : (
          <>
            <Field label="Order"><Select value={orderId} onChange={setOrderId} ariaLabel="Order" options={[{ value: "", label: "Choose an order" }, ...openOrders.map((o) => ({ value: o.id, label: label(o) }))]} /></Field>
            <div className="fx-row" role="radiogroup" aria-label="What arrived">
              <label className="fx-row fx-small"><input type="radio" checked={full} onChange={() => setFull(true)} /> Everything on the order</label>
              <label className="fx-row fx-small"><input type="radio" checked={!full} onChange={() => setFull(false)} /> Part of it</label>
            </div>
            <Field label={full ? "Note (optional)" : "What arrived"}><TextInput value={note} onChange={setNote} ariaLabel="Receipt note" /></Field>
            <div className="fx-note">Invoices on the order are matched again once the receipt is recorded.</div>
          </>
        )}
      </div>
    </SidePanel>
  );
}

/** Small helper for pages: label of a request's current waiting stage. */
export function waitingOn(q: ReturnType<typeof useFin>["q"], r: RequestItem): string {
  const ap = r.approvalId ? q.approval(r.approvalId) : undefined;
  const st = ap?.stages.find((x) => x.status === "pending");
  return st ? q.name(st.assigneeId) : "";
}

