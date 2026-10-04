/* Shared pieces for the Finance and Purchasing pages: who can see what, money
   and dates, status chips, the accounting source freshness line, the compact
   working-page header and the panel state both pages use. */

import { useEffect, type ReactNode } from "react";
import {
  accountingFreshness, can, financeAccess, fmtDate, fmtMoney, INVOICE_STATUS, ORDER_STATUS, FLAG_LABEL, moduleEnabled, relative, scopeLabel, store, useCore,
  type MatchFlag, type PurchaseOrder, type Receivable, type SupplierInvoice, type Tone
} from "../../core";
import { Chip } from "../kit";
import "../../styles/finance.css";

export function useFin() {
  const { core, ctx, q, session } = useCore();
  const access = financeAccess(q);
  const finOn = moduleEnabled(core.config, "finance");
  const purOn = moduleEnabled(core.config, "purchasing");
  const tz = core.config.timezone;
  return {
    core, ctx, q, session, tz, now: ctx.now, access, finOn, purOn,
    /** Budget columns, links and figures only show when Finance is on and the viewer may read it. */
    showBudget: finOn && access.view,
    standardsOn: moduleEnabled(core.config, "standards"),
    cur: core.config.finance.reportingCurrency,
    canBuy: can(q.viewer, "purchasing.manage"),
    scope: scopeLabel(core, ctx.scope),
    d: (at?: string) => (at ? fmtDate(at, tz) : "None"),
    rel: (at?: string | null) => (at ? relative(at, ctx.now, tz) : "never")
  };
}

export type Fin = ReturnType<typeof useFin>;

export function Money({ n, cur, signed }: { n: number | null | undefined; cur: string; signed?: boolean }) {
  const cls = "fx-num" + (signed && typeof n === "number" ? (n < 0 ? " fx-neg" : n > 0 ? " fx-pos" : "") : "");
  return <span className={cls}>{signed && typeof n === "number" && n > 0 ? "+" : ""}{fmtMoney(n, cur)}</span>;
}

/** Compact working-page header: eyebrow, title, one line of context, one primary action. */
export function ModHead({ eyebrow, title, meta, action }: { eyebrow: string; title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className="fx-head">
      <div className="pk-grow">
        <div className="pf-eyebrow">{eyebrow}</div>
        <h1 className="fx-title">{title}</h1>
        {meta && <div className="fx-meta">{meta}</div>}
      </div>
      {action}
    </div>
  );
}

/** The accounting source and its last successful sync. Row times are shown separately on each row. */
export function SourceLine() {
  const { core, rel } = useFin();
  const f = accountingFreshness(core);
  if (!f.sourceId) return <span>No accounting source configured, so payments and transactions are not read.</span>;
  return (
    <span title={f.message || f.prerequisite}>
      {f.label}{f.kind === "sample" ? " (simulated, read-only)" : f.connected ? " (read-only)" : " (not connected)"}: last successful sync {rel(f.lastSuccessAt)}
    </span>
  );
}

export const INVOICE_TONE: Record<SupplierInvoice["status"], Tone> = {
  received: "neutral", matched: "ok", exception: "warn", in_review: "accent", approved: "ok", rejected: "bad", paid: "ok"
};

export function InvoiceChip({ inv }: { inv: SupplierInvoice }) {
  return <Chip tone={INVOICE_TONE[inv.status]}>{INVOICE_STATUS[inv.status]}</Chip>;
}

const ORDER_TONE: Record<PurchaseOrder["status"], Tone> = {
  draft: "neutral", approved: "accent", sent: "accent", part_received: "warn", received: "ok", closed: "neutral", cancelled: "neutral"
};

export function OrderChip({ o }: { o: PurchaseOrder }) {
  return <Chip tone={ORDER_TONE[o.status]}>{ORDER_STATUS[o.status]}</Chip>;
}

export function FlagChips({ flags }: { flags: MatchFlag[] }) {
  if (!flags.length) return <span className="fx-faint">None</span>;
  return <span className="fx-flags">{flags.map((f) => <Chip key={f} tone={f === "duplicate" || f === "over_order" ? "bad" : "warn"}>{FLAG_LABEL[f]}</Chip>)}</span>;
}

export function ReceivableChip({ r, overdueDays }: { r: Receivable; overdueDays: number }) {
  if (r.status === "paid") return <Chip tone="ok">Paid</Chip>;
  if (r.status === "written_off") return <Chip tone="neutral">Written off</Chip>;
  if (overdueDays > 0) return <Chip tone="bad">{"Overdue " + overdueDays + (overdueDays === 1 ? " day" : " days")}</Chip>;
  return <Chip tone={r.status === "part_paid" ? "accent" : "neutral"}>{r.status === "part_paid" ? "Part paid" : "Open"}</Chip>;
}

/** Whether an order reached the supplier, and how. Pulse only sends through a connection. */
export const sendState = (o: PurchaseOrder) =>
  o.sentExternally ? "Sent through a connection"
    : o.status === "sent" || o.status === "part_received" || o.status === "received" || o.status === "closed" ? "Sent outside Pulse"
    : o.status === "approved" ? "Not sent" : ORDER_STATUS[o.status];

/* ── Panels both pages open ────────────────────────────────────────────── */

export type FinPanelKind = "invoice" | "order" | "supplier" | "budget" | "receivable" | "transaction" | "request"
  | "newRequest" | "newSupplier" | "newBudget" | "newReceipt";
export interface FinPanel { kind: FinPanelKind; id?: string }

/** Open the panel a cross-page link asked for, then clear the focus. */
export function useFinFocus(setPanel: (p: FinPanel) => void) {
  const { session } = useCore();
  const f = session.focus;
  useEffect(() => {
    if (!f || !f.id) return;
    if (f.kind === "invoice" || f.kind === "order" || f.kind === "supplier" || f.kind === "budget") {
      setPanel({ kind: f.kind, id: f.id });
      store.setSession({ focus: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);
}

/** A table row that opens something, usable by keyboard. */
export function ClickRow({ onOpen, children, selected }: { onOpen: () => void; children: ReactNode; selected?: boolean }) {
  return (
    <tr className="fx-click" tabIndex={0} aria-selected={selected} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>{children}</tr>
  );
}

export function EventList({ storyKey }: { storyKey: string }) {
  const { q, core } = useCore();
  const tz = core.config.timezone;
  const ev = q.events({ ignoreScope: true }).filter((e) => e.storyKey === storyKey).sort((a, b) => b.at.localeCompare(a.at));
  if (!ev.length) return <div className="fx-faint fx-small">No history recorded yet.</div>;
  return (
    <ul className="fx-hist">
      {ev.slice(0, 12).map((e) => (
        <li key={e.id}><time dateTime={e.at}>{fmtDate(e.at, tz, true)}</time><span>{e.summary}{e.simulated ? " (simulated)" : ""}<span className="fx-faint"> · {q.name(e.actorId)}</span></span></li>
      ))}
    </ul>
  );
}
