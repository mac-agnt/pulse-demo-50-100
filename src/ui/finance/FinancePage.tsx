/* Finance module page. Renders the section chosen in the top bar (v.section):
   Overview, Budgets, Receivables, Payables, Transactions. Figures come from
   src/core/finance.ts, read through the query layer with the viewer's
   permissions and scope. Stages of spend are shown side by side and never
   added; currencies are never combined; source times are kept apart. */

import { useState } from "react";
import {
  AGE_BUCKETS, ageBucket, budgetPosition, navigate, budgetsFor, cashOutlook, fmtMoney, invoicesFor, isPayable, ms, obligationsAhead, openCommitment, ordersFor,
  receivableDaysOverdue, receivableOutstanding, receivablesAgeing, receivablesFor, STAGE_DEFINITIONS, store, sumByCurrency, syncAccounting, transactionsFor,
  type AgeBucket, type Budget, type Receivable, type SupplierInvoice, type Transaction
} from "../../core";
import { Button, Chip, DataTable, Empty, NoAccess, Notice, type Column } from "../kit";
import { KpiTile, PageFrame, Panel, SegTabs, eyebrowOf } from "../frame";
import type { ModulePageProps } from "../modules/registry";
import { ClickRow, FlagChips, InvoiceChip, ModHead, Money, ReceivableChip, SourceLine, useFin, useFinFocus, type Fin, type FinPanel } from "./common";
import { FinPanels, StageBar } from "./panels";

const SECTION_LABEL: Record<string, string> = { overview: "Overview", budgets: "Budgets", receivables: "Receivables", payables: "Payables", transactions: "Transactions" };

export default function FinancePage({ section, setSection }: ModulePageProps) {
  const f = useFin();
  const [panel, setPanel] = useState<FinPanel | null>(null);
  useFinFocus(setPanel);
  const sec = SECTION_LABEL[section] ? section : "overview";
  const eyebrow = eyebrowOf("Finance", SECTION_LABEL[sec], f.scope);
  let body;
  if (!f.finOn) body = <><ModHead eyebrow={eyebrow} title="Finance" /><Empty title="Finance is turned off" body="An administrator can turn it on in Settings, Experience, Modules. Its data is kept while it is off." /></>;
  else if (!f.access.view) body = <><ModHead eyebrow={eyebrow} title="Finance" /><NoAccess what="finance figures (they need the finance.view permission)" /></>;
  else if (sec === "budgets") body = <Budgets f={f} eyebrow={eyebrow} open={setPanel} />;
  else if (sec === "receivables") body = <Receivables f={f} eyebrow={eyebrow} open={setPanel} />;
  else if (sec === "payables") body = <Payables f={f} eyebrow={eyebrow} open={setPanel} />;
  else if (sec === "transactions") body = <Transactions f={f} eyebrow={eyebrow} open={setPanel} />;
  else body = <Overview f={f} eyebrow={eyebrow} open={setPanel} go={setSection} />;
  return (
    <div className="pk fx">
      <PageFrame>{body}</PageFrame>
      <FinPanels panel={panel} setPanel={setPanel} />
    </div>
  );
}

type Open = (p: FinPanel) => void;
const others = (list: { currency: string; amount: number }[], cur: string, what: string) =>
  list.filter((x) => x.currency !== cur && x.amount).map((x) => what + " " + fmtMoney(x.amount, x.currency));

/* ── Overview ──────────────────────────────────────────────────────────── */

function Overview({ f, eyebrow, open, go }: { f: Fin; eyebrow: string; open: Open; go: (id: string) => void }) {
  const { core, q, now, cur, rel } = f;
  const budgets = budgetsFor(q);
  const rows = budgets.map((b) => ({ b, pos: budgetPosition(core, b.id)! }));
  const orders = ordersFor(q);
  const invoices = invoicesFor(q);
  const recs = receivablesFor(q);
  const committed = sumByCurrency(orders.filter((o) => openCommitment(core, o) > 0), (o) => openCommitment(core, o), (o) => o.currency);
  const payable = invoices.filter(isPayable);
  const toPay = sumByCurrency(payable, (i) => i.amount, (i) => i.currency);
  const open_ = recs.filter((r) => receivableOutstanding(r) > 0);
  const dueUs = sumByCurrency(open_, receivableOutstanding, (r) => r.currency);
  const overdue = open_.filter((r) => receivableDaysOverdue(r, now) > 0);
  const overdueSum = sumByCurrency(overdue, receivableOutstanding, (r) => r.currency);
  const exceptions = invoices.filter((i) => i.status === "exception" || i.status === "in_review");
  const at = (list: { currency: string; amount: number }[]) => list.find((x) => x.currency === cur)?.amount ?? 0;
  const synced = "from the accounting source, synced " + rel(core.data.sync.find((x) => x.sourceId === core.config.finance.accountingSourceId)?.lastSuccessAt);
  const nothing = !budgets.length && !orders.length && !invoices.length && !recs.length;
  const extra = [...others(committed, cur, "Committed"), ...others(toPay, cur, "To pay"), ...others(dueUs, cur, "Due to us")];
  const oldest = overdue.reduce((n, r) => Math.max(n, receivableDaysOverdue(r, now)), 0);
  const ahead = obligationsAhead(q, invoices, 30);

  return (
    <>
      <ModHead eyebrow={eyebrow} title="Finance" meta={<SourceLine />} />
      {nothing ? (
        <Panel><Empty title="No finance figures yet" body={"Budgets, orders, invoices and receivables appear here once they exist. Create a budget, or connect a read-only accounting source in Settings, Systems."}
          action={f.access.manage ? <Button variant="primary" onClick={() => open({ kind: "newBudget" })}>Create a budget</Button> : undefined} /></Panel>
      ) : (
        <>
          <div className="fx-kpis">
            <KpiTile label="Committed" value={fmtMoney(at(committed), cur)} sub="Open orders not yet invoiced. Live in Pulse." onClick={() => go("budgets")} />
            <KpiTile label="To pay" value={fmtMoney(at(toPay), cur)} sub={payable.length + " supplier invoice" + (payable.length === 1 ? "" : "s") + ", " + synced + "."} onClick={() => go("payables")} />
            <KpiTile label="Due to us" value={fmtMoney(at(dueUs), cur)} sub={open_.length + " open receivable" + (open_.length === 1 ? "" : "s") + ", " + synced + "."} onClick={() => go("receivables")} />
            <KpiTile label="Overdue to us" value={fmtMoney(at(overdueSum), cur)} tone={overdue.length ? "bad" : undefined}
              sub={overdue.length ? overdue.length + " overdue, the oldest by " + oldest + " days." : "Nothing overdue."} onClick={() => go("receivables")} />
            <KpiTile label="Invoice exceptions" value={String(exceptions.length)} tone={exceptions.length ? "warn" : undefined}
              sub="Invoices that do not match their order or receipt. Live in Pulse." onClick={() => (f.purOn ? navigate({ page: "Purchasing", section: "matching" }) : go("payables"))} />
          </div>
          {extra.length > 0 && <div className="fx-note">{"Other currencies, shown separately and not converted: " + extra.join("; ") + "."}</div>}

          <Panel style={{ marginTop: 14 }} pad={false} title="Budgets" meta="Approved, committed, invoiced and paid side by side. They are stages of the same spend and are never added together.">
            {rows.length ? (
              <>
                <div className="fx-table-wrap">
                  <table className="fx-table">
                    <thead><tr><th>Budget</th><th className="r">Approved</th><th className="r">Committed</th><th className="r">Invoiced</th><th className="r">Paid</th><th className="r">Remaining</th><th style={{ width: 160 }}>Use</th></tr></thead>
                    <tbody>{rows.map(({ b, pos }) => (
                      <ClickRow key={b.id} onOpen={() => open({ kind: "budget", id: b.id })}>
                        <td className="ink">{b.label}<span className="fx-sub">{q.name(b.ownerId)}{pos.notes.length ? ", " + pos.notes.length + " note" + (pos.notes.length === 1 ? "" : "s") : ""}</span></td>
                        <td className="r"><Money n={pos.approved} cur={pos.currency} /></td>
                        <td className="r"><Money n={pos.committed} cur={pos.currency} /></td>
                        <td className="r"><Money n={pos.invoiced} cur={pos.currency} /></td>
                        <td className="r"><Money n={pos.paid} cur={pos.currency} /></td>
                        <td className={"r" + (pos.remaining < 0 ? " fx-neg" : "")}><Money n={pos.remaining} cur={pos.currency} /></td>
                        <td><StageBar pos={pos} /></td>
                      </ClickRow>
                    ))}</tbody>
                  </table>
                </div>
                <div className="fx-legend" style={{ paddingTop: 12 }}>
                  <span><i style={{ background: "var(--accent)" }} />Invoiced</span><span><i style={{ background: "var(--accent-soft)" }} />Committed</span>
                  <span><i style={{ background: "var(--ok)", height: 3 }} />Paid, inside invoiced</span><span><i style={{ background: "var(--track)" }} />Remaining</span>
                </div>
                <div className="fx-defs">
                  {(["committed", "invoiced", "paid", "remaining"] as const).map((k) => <div key={k}><b>{k.charAt(0).toUpperCase() + k.slice(1)}.</b> {STAGE_DEFINITIONS[k]}</div>)}
                </div>
              </>
            ) : <Empty title="No budgets in this scope" body="Budgets for other units or projects are not shown here." />}
          </Panel>

          <div className="fx-grid2">
            <Panel pad={false} title="Coming up, next 30 days" meta="Money in from receivables and out to suppliers, by due date. Overdue items first.">
              {ahead.length ? (
                <div>{[...ahead.filter((x) => x.overdue), ...ahead.filter((x) => !x.overdue)].slice(0, 10).map((x) => (
                  <button key={x.key} type="button" className="fx-li" onClick={() => open({ kind: x.kind, id: x.id })}>
                    <span className="fx-date">{f.d(x.date)}</span>
                    <Chip tone={x.overdue ? "bad" : x.direction === "in" ? "ok" : "neutral"}>{x.overdue ? "Overdue" : x.direction === "in" ? "In" : "Out"}</Chip>
                    <span className="fx-li-main">{x.counterparty}<span className="fx-faint">{", " + x.label + ", " + x.state.toLowerCase()}</span></span>
                    <Money n={x.direction === "in" ? x.amount : -x.amount} cur={x.currency} signed />
                  </button>
                ))}</div>
              ) : <Empty title="Nothing due in the next 30 days" />}
            </Panel>
            <CashPanel f={f} open={open} />
          </div>
        </>
      )}
    </>
  );
}

function CashPanel({ f, open }: { f: Fin; open: Open }) {
  const out = cashOutlook(f.q);
  if (!out.available) {
    return (
      <Panel title="Cash outlook">
        <Notice>{out.reason}</Notice>
        {out.missing.length > 0 && <div className="fx-note">{"Needed: " + out.missing.join("; ") + "."}</div>}
      </Panel>
    );
  }
  return (
    <Panel pad={false} title="Cash outlook" meta={"Opening balance " + fmtMoney(out.opening.amount, out.currency) + " on " + f.d(out.opening.asOf) + " from " + out.opening.sourceLabel
      + "; transactions since " + fmtMoney(out.sinceOpening.amount, out.currency) + "; balance now " + fmtMoney(out.startBalance, out.currency) + "."}>
      <div className="fx-table-wrap">
        <table className="fx-table fx-table--narrow fx-mini">
          <thead><tr><th>Week from</th><th className="r">In</th><th className="r">Out</th><th className="r">Balance at end</th></tr></thead>
          <tbody>{out.weeks.map((w) => (
            <tr key={w.from}><td>{f.d(w.from)}</td><td className="r"><Money n={w.incoming} cur={out.currency} /></td><td className="r"><Money n={-w.outgoing} cur={out.currency} /></td>
              <td className={"r" + (w.balance < 0 ? " fx-neg" : "")}><Money n={w.balance} cur={out.currency} /></td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="fx-defs" style={{ gridTemplateColumns: "1fr" }}>
        <div><b>Assumptions.</b> {out.assumptions.join(" ")}</div>
        <div><b>Not included.</b> {out.missing.join(" ")}</div>
        {out.sinceOpening.transactionIds.length > 0 && <div>
          <button type="button" className="fx-link" onClick={() => open({ kind: "transaction", id: out.sinceOpening.transactionIds[0] })}>See the transactions since the opening balance</button>
        </div>}
      </div>
    </Panel>
  );
}

/* ── Budgets ───────────────────────────────────────────────────────────── */

function Budgets({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const rows = budgetsFor(q).map((b) => ({ b, pos: budgetPosition(core, b.id)! }));
  type Row = { b: Budget; pos: NonNullable<ReturnType<typeof budgetPosition>> };
  const forLabel = (b: Budget) => {
    const p = core.data.projects.find((x) => x.id === b.projectId);
    return p ? p.title : b.unitId ? q.unitLabel(b.unitId) : b.teamId ? q.teamLabel(b.teamId) : "Organisation";
  };
  const cols: Column<Row>[] = [
    { key: "label", label: "Budget", strong: true, priority: 1, value: (r) => r.b.label, render: (r) => <span>{r.b.label}<span className="fx-sub">{forLabel(r.b)}</span></span> },
    { key: "owner", label: "Owner", priority: 3, value: (r) => q.name(r.b.ownerId) },
    { key: "period", label: "Period", priority: 3, value: (r) => r.b.periodFrom, render: (r) => f.d(r.b.periodFrom) + " to " + f.d(r.b.periodTo) },
    { key: "approved", label: "Approved", align: "right", priority: 2, value: (r) => r.pos.approved, render: (r) => <Money n={r.pos.approved} cur={r.pos.currency} /> },
    { key: "committed", label: "Committed", align: "right", priority: 2, value: (r) => r.pos.committed, render: (r) => <Money n={r.pos.committed} cur={r.pos.currency} /> },
    { key: "invoiced", label: "Invoiced", align: "right", priority: 2, value: (r) => r.pos.invoiced, render: (r) => <Money n={r.pos.invoiced} cur={r.pos.currency} /> },
    { key: "paid", label: "Paid", align: "right", priority: 3, value: (r) => r.pos.paid, render: (r) => <Money n={r.pos.paid} cur={r.pos.currency} /> },
    { key: "remaining", label: "Remaining", align: "right", priority: 1, value: (r) => r.pos.remaining,
      render: (r) => <span className={r.pos.remaining < 0 ? "fx-neg" : undefined}><Money n={r.pos.remaining} cur={r.pos.currency} /></span> }
  ];
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Budgets" meta="Committed is only the uninvoiced part of open orders, so committed and invoiced never overlap. Paid is part of invoiced."
        action={<Button variant="primary" disabled={!f.access.manage} title={f.access.manage ? undefined : "Needs finance.manage"} onClick={() => open({ kind: "newBudget" })}>New budget</Button>} />
      <DataTable<Row> rows={rows} columns={cols} rowKey={(r) => r.b.id} onOpen={(r) => open({ kind: "budget", id: r.b.id })} caption="Budgets"
        searchText={(r) => r.b.label + " " + forLabel(r.b) + " " + q.name(r.b.ownerId)} searchPlaceholder="Search budgets"
        empty={<Empty title="No budgets in this scope" body={f.access.manage ? "Create a budget to compare planned and actual spend." : "Budgets for other units or projects are not shown."}
          action={f.access.manage ? <Button variant="primary" onClick={() => open({ kind: "newBudget" })}>Create a budget</Button> : undefined} />}
        footerNote="each budget in its own currency" />
    </>
  );
}

/* ── Receivables ───────────────────────────────────────────────────────── */

function Receivables({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { q, now } = f;
  const [show, setShow] = useState<"open" | "paid" | "all">("open");
  const [bucket, setBucket] = useState<{ cur: string; id: AgeBucket } | null>(null);
  const all = receivablesFor(q);
  const ageing = receivablesAgeing(all, now);
  const base = all.filter((r) => show === "all" || (show === "open" ? receivableOutstanding(r) > 0 : receivableOutstanding(r) === 0));
  const rows = base.filter((r) => !bucket || (r.currency === bucket.cur && ageBucket(r, now) === bucket.id))
    .sort((a, b) => receivableDaysOverdue(b, now) - receivableDaysOverdue(a, now) || a.dueAt.localeCompare(b.dueAt));
  const cols: Column<Receivable>[] = [
    { key: "ref", label: "Ref", priority: 2, value: (r) => r.ref, render: (r) => <span className="pk-mono">{r.ref}</span> },
    { key: "who", label: "Counterparty", strong: true, priority: 1, value: (r) => r.counterparty },
    { key: "issued", label: "Issued", priority: 3, value: (r) => r.issuedAt, render: (r) => f.d(r.issuedAt) },
    { key: "due", label: "Due", priority: 2, value: (r) => r.dueAt, render: (r) => f.d(r.dueAt) },
    { key: "amount", label: "Amount", align: "right", priority: 3, value: (r) => r.amount, render: (r) => <Money n={r.amount} cur={r.currency} /> },
    { key: "out", label: "Outstanding", align: "right", priority: 1, value: (r) => receivableOutstanding(r), render: (r) => <Money n={receivableOutstanding(r)} cur={r.currency} /> },
    { key: "status", label: "Status", priority: 1, value: (r) => receivableDaysOverdue(r, now), render: (r) => <ReceivableChip r={r} overdueDays={receivableDaysOverdue(r, now)} /> },
    { key: "src", label: "Updated in source", priority: 3, value: (r) => r.sourceUpdatedAt || "", render: (r) => f.rel(r.sourceUpdatedAt) }
  ];
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Receivables" meta={<><SourceLine /><span>Overdue first.</span></>} />
      {ageing.length > 0 && ageing.map((a) => (
        <div key={a.currency} style={{ marginBottom: 12 }}>
          <div className="pf-eyebrow" style={{ margin: "0 2px 8px" }}>{"Outstanding in " + a.currency + ": " + fmtMoney(a.total, a.currency)}</div>
          <div className="fx-age" role="group" aria-label={"Ageing in " + a.currency}>
            {AGE_BUCKETS.map((b) => {
              const on = bucket?.cur === a.currency && bucket.id === b.id;
              const v = a.buckets[b.id];
              return (
                <button key={b.id} type="button" aria-pressed={on} onClick={() => { setBucket(on ? null : { cur: a.currency, id: b.id }); setShow("open"); }}>
                  <span className="fx-age-l">{b.label}</span>
                  <span className={"fx-age-v" + (b.id !== "current" && v.amount > 0 ? " fx-neg" : "")}>{fmtMoney(v.amount, a.currency)}</span>
                  <span className="fx-age-n">{v.ids.length + " receivable" + (v.ids.length === 1 ? "" : "s")}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <DataTable<Receivable> rows={rows} columns={cols} rowKey={(r) => r.id} onOpen={(r) => open({ kind: "receivable", id: r.id })} caption="Receivables"
        searchText={(r) => r.ref + " " + r.counterparty} searchPlaceholder="Search receivables"
        toolbarLeft={<SegTabs label="Show" value={show} onChange={(x) => { setShow(x); setBucket(null); }} options={[{ value: "open", label: "Outstanding" }, { value: "paid", label: "Paid" }, { value: "all", label: "All" }]} />}
        empty={<Empty title={all.length ? "Nothing matches" : "No receivables in this scope"} body={all.length ? undefined : "Receivables are read from the accounting source."} />}
        footerNote={bucket ? <button type="button" className="fx-link" onClick={() => setBucket(null)}>{"Showing " + AGE_BUCKETS.find((b) => b.id === bucket.id)!.label.toLowerCase() + " in " + bucket.cur + ". Clear"}</button> : undefined} />
    </>
  );
}

/* ── Payables ──────────────────────────────────────────────────────────── */

function Payables({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q, now } = f;
  const [show, setShow] = useState<"pay" | "approved" | "paid" | "all">("pay");
  const all = invoicesFor(q);
  const rows = all.filter((i) => show === "all" || (show === "pay" ? isPayable(i) : show === "approved" ? i.status === "approved" : i.status === "paid"))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const sup = (i: SupplierInvoice) => core.data.suppliers.find((x) => x.id === i.supplierId)?.name || "Unknown supplier";
  const ord = (i: SupplierInvoice) => core.data.orders.find((o) => o.id === i.orderId)?.ref || "";
  const totals = sumByCurrency(rows.filter(isPayable), (i) => i.amount, (i) => i.currency).map((x) => fmtMoney(x.amount, x.currency)).join("; ");
  const cols: Column<SupplierInvoice>[] = [
    { key: "due", label: "Due", priority: 1, value: (i) => i.dueAt, render: (i) => <span className={isPayable(i) && ms(i.dueAt) < ms(now) ? "fx-neg" : undefined}>{f.d(i.dueAt)}</span> },
    { key: "sup", label: "Supplier", strong: true, priority: 1, value: sup, render: (i) => <span>{sup(i)}<span className="fx-sub">{i.ref}</span></span> },
    { key: "order", label: "Order", priority: 3, value: ord, render: (i) => ord(i) || <span className="fx-faint">None</span> },
    { key: "amount", label: "Amount", align: "right", priority: 1, value: (i) => i.amount, render: (i) => <Money n={i.amount} cur={i.currency} /> },
    { key: "status", label: "Status", priority: 2, value: (i) => i.status, render: (i) => <InvoiceChip inv={i} /> },
    { key: "flags", label: "Differences", priority: 3, value: (i) => i.flags.join(" "), render: (i) => <FlagChips flags={i.flags} /> },
    { key: "src", label: "Read into Pulse", priority: 3, defaultHidden: true, value: (i) => i.ingestedAt || "", render: (i) => f.rel(i.ingestedAt) }
  ];
  const syncing = () => store.run(syncAccounting);
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Payables" meta={<><SourceLine /><span>Approving an invoice never pays it. Payment shows once the source reports it.</span></>}
        action={<Button variant="primary" disabled={!f.access.manage} title={f.access.manage ? "Read new invoices and payments. Rows already in Pulse are not added again." : "Needs finance.manage"} onClick={syncing}>Read from accounting source</Button>} />
      <DataTable<SupplierInvoice> rows={rows} columns={cols} rowKey={(i) => i.id} onOpen={(i) => open({ kind: "invoice", id: i.id })} caption="Supplier invoices"
        searchText={(i) => sup(i) + " " + i.ref + " " + ord(i)} searchPlaceholder="Search invoices"
        toolbarLeft={<SegTabs label="Show" value={show} onChange={setShow} options={[{ value: "pay", label: "To pay" }, { value: "approved", label: "Approved for payment" }, { value: "paid", label: "Paid" }, { value: "all", label: "All" }]} />}
        empty={<Empty title={all.length ? "Nothing in this view" : "No supplier invoices in this scope"} body={all.length ? undefined : "Supplier invoices are read from the accounting source."} />}
        footerNote={totals ? "to pay: " + totals : undefined} />
    </>
  );
}

/* ── Transactions ──────────────────────────────────────────────────────── */

function Transactions({ f, eyebrow, open }: { f: Fin; eyebrow: string; open: Open }) {
  const { core, q } = f;
  const rows = [...transactionsFor(q)].sort((a, b) => b.date.localeCompare(a.date));
  const link = (t: Transaction) => {
    const inv = core.data.invoices.find((i) => i.id === t.invoiceId);
    if (inv) return "Invoice " + inv.ref;
    const r = core.data.receivables.find((x) => x.id === t.receivableId);
    if (r) return "Receivable " + r.ref;
    const b = core.data.budgets.find((x) => x.id === t.budgetId);
    if (b) return "Budget " + b.label;
    return "";
  };
  const ins = sumByCurrency(rows.filter((t) => t.amount > 0), (t) => t.amount, (t) => t.currency);
  const outs = sumByCurrency(rows.filter((t) => t.amount < 0), (t) => t.amount, (t) => t.currency);
  const cols: Column<Transaction>[] = [
    { key: "date", label: "Date", priority: 1, value: (t) => t.date, render: (t) => f.d(t.date) },
    { key: "desc", label: "Description", strong: true, priority: 1, value: (t) => t.description, render: (t) => <span>{t.description}<span className="fx-sub">{t.counterparty}</span></span> },
    { key: "amount", label: "Amount", align: "right", priority: 1, value: (t) => t.amount, render: (t) => <Money n={t.amount} cur={t.currency} signed /> },
    { key: "link", label: "Linked to", priority: 2, value: link, render: (t) => link(t) || <span className="fx-faint">Nothing in Pulse</span> },
    { key: "src", label: "Updated in source", priority: 3, value: (t) => t.sourceUpdatedAt || "", render: (t) => f.rel(t.sourceUpdatedAt) },
    { key: "ing", label: "Read into Pulse", priority: 3, value: (t) => t.ingestedAt || "", render: (t) => f.rel(t.ingestedAt) }
  ];
  return (
    <>
      <ModHead eyebrow={eyebrow} title="Transactions" meta={<><SourceLine /><span>Read-only. Pulse never posts, changes or pays transactions.</span></>} />
      <DataTable<Transaction> rows={rows} columns={cols} rowKey={(t) => t.id} onOpen={(t) => open({ kind: "transaction", id: t.id })} caption="Transactions"
        searchText={(t) => t.description + " " + t.counterparty + " " + link(t)} searchPlaceholder="Search transactions"
        empty={<Empty title="No transactions in this scope" body="Transactions are read from the accounting source. Organisation-level movements are shown in the whole organisation scope." />}
        footerNote={[...ins.map((x) => "in " + fmtMoney(x.amount, x.currency)), ...outs.map((x) => "out " + fmtMoney(-x.amount, x.currency))].join("; ") || undefined} />
    </>
  );
}
