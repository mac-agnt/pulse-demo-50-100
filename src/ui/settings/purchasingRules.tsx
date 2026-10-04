/* Settings: Purchasing and finance rules. Matching tolerance and the receipt
   rule, the reporting currency, the opening balance used for the cash
   outlook, and which sources Finance reads from and Purchasing sends
   through. Edits go through ops.updateConfig. */

import {
  accountingFreshness, fmtDateTime, moduleEnabled, PURCHASE_CURRENCIES, PURCHASE_FORM_ID, rematchInvoices, setUpPurchasing, store, useCore
} from "../../core";
import { Button, Chip, Field, Notice, Select, TextInput, KV } from "../kit";
import { Lock, NumberInput, ReadOnlyLine, SaveBar, SubHead, Toggle, errCount, saveConfig, useCanEdit, useDraft } from "./common";
import type { SectionProps } from "./SettingsPage";

interface Draft {
  tolerancePercent: number | null;
  requireReceipt: boolean;
  reportingCurrency: string;
  accountingSourceId: string;
  orderingSourceId: string;
  obOn: boolean;
  obAmount: number | null;
  obAsOf: string;
  obSourceId: string;
}

export function PurchasingRulesSection(_p: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const c = core.config;
  const ob = c.finance.openingBalance;
  const d = useDraft<Draft>({
    tolerancePercent: c.purchasing.tolerancePercent, requireReceipt: c.purchasing.requireReceipt, reportingCurrency: c.finance.reportingCurrency,
    accountingSourceId: c.finance.accountingSourceId || "", orderingSourceId: c.purchasing.orderingSourceId || "",
    obOn: !!ob, obAmount: ob ? ob.amount : null, obAsOf: ob ? ob.asOf.slice(0, 10) : "", obSourceId: ob ? ob.sourceId : (c.finance.accountingSourceId || "")
  });
  const x = d.draft;
  const sources = c.sources.filter((s) => s.kind !== "pulse");
  const external = c.sources.filter((s) => s.kind === "external");
  const errors: Record<string, string | undefined> = {};
  if (x.tolerancePercent === null || !(x.tolerancePercent >= 0 && x.tolerancePercent <= 50)) errors.tol = "Enter a percentage from 0 to 50.";
  if (!/^[A-Z]{3}$/.test(x.reportingCurrency)) errors.cur = "Use a three-letter currency code.";
  if (x.obOn) {
    if (x.obAmount === null || !isFinite(x.obAmount)) errors.obAmount = "Enter the balance.";
    if (!x.obAsOf || isNaN(Date.parse(x.obAsOf))) errors.obAsOf = "Give the date the balance applies from.";
    if (!x.obSourceId) errors.obSource = "Say where the balance comes from.";
  }
  const fr = accountingFreshness(core);
  const formsMissing = !c.requestForms.some((f) => f.id === (c.purchasing.requestFormId || PURCHASE_FORM_ID));
  const set = (fn: (y: Draft) => void) => d.update(fn);

  const save = () => {
    if (errCount(errors)) return;
    const rulesChanged = x.tolerancePercent !== c.purchasing.tolerancePercent || x.requireReceipt !== c.purchasing.requireReceipt;
    const ok = saveConfig((cfg) => {
      cfg.purchasing.tolerancePercent = x.tolerancePercent as number;
      cfg.purchasing.requireReceipt = x.requireReceipt;
      cfg.purchasing.orderingSourceId = x.orderingSourceId || undefined;
      cfg.finance.reportingCurrency = x.reportingCurrency;
      cfg.finance.accountingSourceId = x.accountingSourceId || undefined;
      cfg.finance.openingBalance = x.obOn ? { amount: x.obAmount as number, asOf: new Date(x.obAsOf + "T00:00:00Z").toISOString(), sourceId: x.obSourceId } : undefined;
    }, "Updated purchasing and finance rules");
    if (ok && rulesChanged) store.run(rematchInvoices);
  };

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        {(!moduleEnabled(c, "finance") || !moduleEnabled(c, "purchasing")) && (
          <Notice>{[!moduleEnabled(c, "finance") && "Finance", !moduleEnabled(c, "purchasing") && "Purchasing"].filter(Boolean).join(" and ")
            + " is turned off. These rules are kept and apply when it is turned on again in Experience, Modules."}</Notice>
        )}
        <Lock on={!canEdit}>
          <SubHead>Invoice matching</SubHead>
          <div className="st-grid">
            <Field label="Tolerance above the order, %" error={errors.tol} help="An invoice may exceed its order by this much before it is flagged. Undecided invoices are matched again when you save.">
              <NumberInput ariaLabel="Tolerance percent" min={0} step={0.5} value={x.tolerancePercent} invalid={!!errors.tol} onChange={(v) => set((y) => { y.tolerancePercent = v; })} />
            </Field>
            <Field label="Receipt rule">
              <Toggle checked={x.requireReceipt} onChange={(v) => set((y) => { y.requireReceipt = v; })} label="Require a recorded receipt before an invoice matches" />
            </Field>
          </div>

          <SubHead>Money</SubHead>
          <div className="st-grid">
            <Field label="Reporting currency" error={errors.cur} help="Figures are reported in this currency. Amounts in other currencies are shown separately and never converted.">
              <Select ariaLabel="Reporting currency" value={x.reportingCurrency} onChange={(v) => set((y) => { y.reportingCurrency = v; })}
                options={[...new Set([...PURCHASE_CURRENCIES, x.reportingCurrency])].map((v) => ({ value: v, label: v }))} />
            </Field>
            <Field label="Accounting source" help="Read-only. Invoices, receivables and payments come from here; Pulse never posts or pays through it.">
              <Select ariaLabel="Accounting source" value={x.accountingSourceId} onChange={(v) => set((y) => { y.accountingSourceId = v; })}
                options={[{ value: "", label: "None" }, ...sources.map((s) => ({ value: s.id, label: s.label + (s.kind === "sample" ? " (simulated)" : s.connected ? "" : " (not connected)") }))]} />
            </Field>
          </div>

          <SubHead>Opening balance for the cash outlook</SubHead>
          <Toggle checked={x.obOn} onChange={(v) => set((y) => { y.obOn = v; })} label="Use an opening balance" />
          {!x.obOn && <div className="pk-help" style={{ marginTop: 6 }}>Without an opening balance Finance draws no cash outlook and says why.</div>}
          {x.obOn && (
            <div className="st-grid">
              <Field label={"Balance, " + x.reportingCurrency} error={errors.obAmount}>
                <NumberInput ariaLabel="Opening balance" step={100} value={x.obAmount} invalid={!!errors.obAmount} onChange={(v) => set((y) => { y.obAmount = v; })} />
              </Field>
              <Field label="Applies from" error={errors.obAsOf} help="Transactions after this date are added to it.">
                <TextInput type="date" ariaLabel="Opening balance date" value={x.obAsOf} invalid={!!errors.obAsOf} onChange={(v) => set((y) => { y.obAsOf = v; })} />
              </Field>
              <Field label="Reported by" error={errors.obSource}>
                <Select ariaLabel="Opening balance source" value={x.obSourceId} invalid={!!errors.obSource} onChange={(v) => set((y) => { y.obSourceId = v; })}
                  options={[{ value: "", label: "Choose a source" }, ...sources.map((s) => ({ value: s.id, label: s.label }))]} />
              </Field>
            </div>
          )}

          <SubHead>Sending orders</SubHead>
          <Field label="Ordering connection" help="Orders are sent only through a connected source. Without one, Send fails honestly and nothing leaves Pulse; people can record an order as sent outside Pulse.">
            <div style={{ maxWidth: 360 }}>
              <Select ariaLabel="Ordering connection" value={x.orderingSourceId} onChange={(v) => set((y) => { y.orderingSourceId = v; })}
                options={[{ value: "", label: external.length ? "None" : "None (no external connections exist)" }, ...external.map((s) => ({ value: s.id, label: s.label + (s.connected ? "" : " (not connected)") }))]} />
            </div>
          </Field>
        </Lock>

        <SubHead right={<Chip tone={fr.kind === "none" ? "bad" : fr.kind === "sample" ? "accent" : fr.connected ? "ok" : "warn"}>
          {fr.kind === "none" ? "Not configured" : fr.kind === "sample" ? "Simulated" : fr.connected ? "Connected" : "Not connected"}</Chip>}>Accounting source status</SubHead>
        <KV items={[
          ["Source", fr.label], ["Last successful sync", fr.lastSuccessAt ? fmtDateTime(fr.lastSuccessAt, c.timezone) : "Never"],
          ["Last attempt", fr.lastAttemptAt ? fmtDateTime(fr.lastAttemptAt, c.timezone) : "Never"], ["Status", fr.status.replace("_", " ")]
        ]} />
        {(fr.message || fr.prerequisite) && <div className="pk-help" style={{ marginTop: 8 }}>{[fr.message, fr.prerequisite].filter(Boolean).join(" ")}</div>}

        {formsMissing && (
          <>
            <SubHead>Purchase request forms</SubHead>
            <Notice tone="warn">No purchase request form is set up, so Purchasing cannot raise requests or open invoice reviews.</Notice>
            <div style={{ marginTop: 8 }}><Button disabled={!canEdit} onClick={() => store.run(setUpPurchasing)}>Set up purchase requests</Button></div>
          </>
        )}
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}
