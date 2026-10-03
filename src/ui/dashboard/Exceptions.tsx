/* Exceptions: the unresolved items that need a person, from the same
   attention selector as Activity and the top bar. Each row opens the
   existing object. */

import type { ReactNode } from "react";
import { useCore, openObject, relative, type Tone } from "../../core";
import { attention, type AttentionItem } from "../selectors";
import { Pill } from "../frame";
import { CardHead, EmptyNote, Glass } from "./parts";
import { dashStore } from "./state";

const KIND: Record<AttentionItem["kind"], string> = { run: "Run failed", execution: "Action failed", task: "Overdue", approval: "Decision late", issue: "Data issue", blocked: "Blocked" };

export interface ExceptionRow { key: string; tone: Tone; tag: string; title: string; reason: string; since?: string; onOpen: () => void }

export function ExceptionList({ title, rows, total, empty }: { title: string; rows: ExceptionRow[]; total: number; empty: { title: string; body: string } }) {
  const { core, ctx } = useCore();
  return (
    <Glass style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 12px" }}>
        <CardHead title={title} unit={total ? (rows.length < total ? rows.length + " OF " + total : String(total)) : "NONE"} />
      </div>
      {rows.length === 0 ? <EmptyNote title={empty.title} body={empty.body} /> : (
        <ul className="db-exc">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className="ix11 db-exc-row" onClick={r.onOpen} aria-label={r.tag + ": " + r.title + ". " + r.reason}>
                <Pill tone={r.tone}>{r.tag}</Pill>
                <span className="db-exc-main">
                  <span className="db-exc-t">{r.title}</span>
                  <span className="db-exc-r">{r.reason}</span>
                </span>
                {r.since && <span className="db-exc-when">{relative(r.since, ctx.now, core.config.timezone)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  );
}

/** Attention items in scope, optionally limited to some kinds. */
export function ExceptionsCard({ limit = 6, kinds, title = "Exceptions" }: { limit?: number; kinds?: AttentionItem["kind"][]; title?: string }): ReactNode {
  const { q } = useCore();
  const items = attention(q).filter((i) => !kinds || kinds.includes(i.kind));
  const rows: ExceptionRow[] = items.slice(0, limit).map((it) => ({
    key: it.key, tone: it.tone, tag: KIND[it.kind], title: it.title, reason: it.reason + ", " + q.name(it.ownerId) + ". " + it.next + ".", since: it.since,
    onOpen: () => { dashStore.set({ metricId: null }); openObject(it.objectKind, it.id); }
  }));
  return (
    <ExceptionList title={title} rows={rows} total={items.length}
      empty={{ title: "Nothing needs attention", body: kinds && kinds.length === 1 && kinds[0] === "issue"
        ? "High-severity data issues in this scope appear here."
        : "Failed runs, failed actions, late decisions, overdue or blocked tasks and high-severity data issues in this scope appear here." }} />
  );
}
