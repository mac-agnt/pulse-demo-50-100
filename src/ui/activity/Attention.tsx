/* Activity > Needs attention: one compact action queue (severity, impact,
   owner, deadline, age, next action). Rows come from the shared queue in
   ./queue.ts, so each underlying object appears once and the same item shows
   on Home, Today. Resolve inline where an operation exists; otherwise open the
   object where it is handled. */

import { useState } from "react";
import { useCore, openObject, relative, fmtDateTime, fmtHours, hoursBetween, ms } from "../../core";
import { FilterChip, Pill } from "../frame";
import { SEVERITY_LABEL, runInline, type QueueItem, type Severity } from "./queue";

export default function Attention({ items }: { items: QueueItem[] }) {
  const { q, ctx, core } = useCore();
  const tz = core.config.timezone;
  const me = q.viewer.person.id;
  const [sev, setSev] = useState("");
  const [area, setArea] = useState("");
  const [owner, setOwner] = useState("");
  const areas = [...new Set(items.map((i) => i.area))];
  const rows = items.filter((i) => (!sev || i.severity === sev) && (!area || i.area === area)
    && (!owner || (owner === "me" ? i.ownerId === me : owner === "none" ? !i.ownerId : true)));
  const count = (s: Severity) => items.filter((i) => i.severity === s).length;

  return (
    <section className="pf-panel" aria-label="Needs attention">
      <div className="act-tools act-tools--top">
        <span className="act-sum">
          <b style={{ color: "var(--bad)" }}>{count("high")}</b> high · <b style={{ color: "var(--warn)" }}>{count("medium")}</b> medium · <b>{count("low")}</b> low
        </span>
        <span className="act-grow" />
        <FilterChip label="Severity" value={sev} onChange={setSev} options={[{ value: "", label: "Any severity" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
        {areas.length > 1 && <FilterChip label="Area" value={area} onChange={setArea} options={[{ value: "", label: "Every area" }, ...areas.map((a) => ({ value: a, label: a }))]} />}
        <FilterChip label="Owner" value={owner} onChange={setOwner} options={[{ value: "", label: "Any owner" }, { value: "me", label: "Mine" }, { value: "none", label: "Nobody assigned" }]} />
      </div>
      <div className="pf-table-wrap">
        <div className="act-q" role="table" aria-label="Needs attention">
          <div className="act-q-th" role="row">
            {["Severity", "Item and impact", "Owner", "Deadline", "Age", "Next action"].map((c) => <div key={c} role="columnheader">{c}</div>)}
          </div>
          {rows.map((it) => {
            const late = !!it.deadline && ms(it.deadline) < ms(ctx.now);
            return (
              <div key={it.key} role="row" className="act-q-tr">
                <span role="cell"><Pill tone={it.tone}>{SEVERITY_LABEL[it.severity]}</Pill></span>
                <span role="cell" className="act-q-main">
                  <button type="button" className="act-q-t" onClick={() => openObject(it.open.kind, it.open.id)}>{it.title}</button>
                  <span className="act-q-r">{it.source}. {it.reason}{it.also.length ? " Also flagged as: " + it.also.join(", ").toLowerCase() + "." : ""}</span>
                </span>
                <span role="cell" className="act-q-c">{it.ownerId ? q.name(it.ownerId) : <span className="act-kind">Nobody assigned</span>}</span>
                <span role="cell" className={"act-q-c pk-mono" + (late ? " act-late" : "")} title={it.deadline ? fmtDateTime(it.deadline, tz) : undefined}>{it.deadline ? relative(it.deadline, ctx.now, tz) : "None set"}</span>
                <span role="cell" className="act-q-c pk-mono" title={"Since " + fmtDateTime(it.since, tz)}>{fmtHours(Math.max(0, hoursBetween(it.since, ctx.now)))}</span>
                <span role="cell" className="act-q-act">
                  {it.inline && <button type="button" className="pk-btn pk-btn--sm" onClick={() => runInline(it)} title="Runs the operation now; your permission is checked">{it.inline.label}</button>}
                  <button type="button" className="pk-btn pk-btn--sm pk-btn--primary" onClick={() => openObject(it.open.kind, it.open.id)}>{it.next}</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && (
        <div className="pf-empty">
          <b>{items.length === 0 ? "Nothing needs attention in this scope" : "Nothing matches these filters"}</b>
          <span>{items.length === 0 ? "No failures, overdue decisions or tasks, blocked work or open issues. History still has every recorded event." : "Clear a filter to see the rest of the queue."}</span>
        </div>
      )}
      <div className="act-foot"><span className="act-grow">Most severe first, then by deadline. One row per underlying object.</span><span>{rows.length} of {items.length}</span></div>
    </section>
  );
}
