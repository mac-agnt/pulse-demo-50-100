/* Records > Data quality, the resolution queue, in the original Pulse design:
   the Records hero with its search, the stat strip, a callout for the most
   serious open issue, segments by kind and the issue card rows. Each row's
   action opens the issue panel at its kind-specific resolver. Resolutions go
   through ops, so the queue, the record, the metrics and the audit trail all
   change together. */

import { useEffect, useRef, useState } from "react";
import { useCore, store, ops, can, openObject, navigate, fmtDateTime, computeMetric, scopeLabel, relative, ms, DAY, ISSUE_LABEL, ISSUE_PATH } from "../../core";
import type { DataIssue, FieldValue, Id, IssueKind, RecordItem } from "../../core";
import {
  Button, Chip, Empty, Field, KV, Notice, PersonName, Section, Segmented, Select, SidePanel, TextArea, TextInput, toneOf
} from "../kit";
import { Btn, Callout, FilterChip, Pill, SegTabs, StatStrip, eyebrowOf } from "../frame";
import {
  FieldEditor, ISSUE_STATE_LABEL, ISSUE_STATE_TONE, SEVERITY_LABEL, When, authorityText, fmtDay, fmtField, resolveBlock,
  sourceLabel, statusOf, typeOf, useFocus, List, ListButton, Ref, Grow
} from "./common";
import { RecCard, RecEmpty, RecPage, RecordsHero, matchesAll, plural, termsOf } from "./hero";

type KindSel = "all" | IssueKind;
type StateSel = "active" | "open" | "in_progress" | "resolved" | "dismissed" | "all";
type SevSel = "" | DataIssue["severity"];

const KINDS: IssueKind[] = ["missing_field", "duplicate", "unmapped_value", "conflict", "unmatched"];
const SEV_RANK: Record<DataIssue["severity"], number> = { high: 0, medium: 1, low: 2 };

/** The primary action for each kind: it opens the issue at its resolver. */
const ACTION: Record<IssueKind, string> = {
  missing_field: "Fill field", duplicate: "Review merge", unmapped_value: "Map code", conflict: "Compare", unmatched: "Link row"
};
const KIND_ICON: Record<IssueKind, string> = {
  missing_field: "M4 7h16v10H4z M8 12h4",
  duplicate: "M8 8h11v11H8z M5 16V5h11",
  unmapped_value: "M4 7h11 M12 4l3 3-3 3 M20 17H9 M12 14l-3 3 3 3",
  conflict: "M12 4 2.5 20h19L12 4Z M12 10v4 M12 17h.01",
  unmatched: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
};
const KIND_SHORT: Record<IssueKind, string> = {
  missing_field: "Missing field", duplicate: "Duplicates", unmapped_value: "Unmapped", conflict: "Conflicts", unmatched: "Unmatched"
};
const SEV_TINT: Record<DataIssue["severity"], [string, string]> = {
  high: ["var(--bad)", "var(--bad-soft)"], medium: ["var(--warn)", "var(--warn-soft)"], low: ["var(--dim)", "var(--track)"]
};

function Svg({ d, size = 12, sw = 1.7 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function RecordsQuality(_props: { v: unknown }) {
  const { core, ctx, q } = useCore();
  const [kind, setKind] = useState<KindSel>("all");
  const [state, setState] = useState<StateSel>("active");
  const [sev, setSev] = useState<SevSel>("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<Id | null>(null);
  const [toResolver, setToResolver] = useState(false);
  const openIssue = (id: Id, resolver: boolean) => { setToResolver(resolver); setOpenId(id); };
  // A list of issues handed over from the dashboard shows only those, until cleared.
  const [only, setOnly] = useState<{ ids: Id[]; label: string } | null>(null);
  useFocus(["issue", "ids"], (f) => {
    if (f.kind === "issue" && f.id) openIssue(f.id, false);
    if (f.kind === "ids" && f.ids) { setOnly({ ids: f.ids, label: f.label || "the dashboard" }); setKind("all"); setState("all"); }
  });

  if (!can(q.viewer, "records.view")) {
    return (
      <RecPage>
        <RecordsHero eyebrow={eyebrowOf("Records", "Data quality")} title="Data quality" blurb="The queue of data issues to resolve."
          query="" onQuery={() => undefined} placeholder="Search issues" kind="KEYWORD" suggestions={[]} answer="" searchLabel="Search issues" disabled />
        <RecCard title="Issues"><RecEmpty title="Not available to you" body="Your role cannot see records, so it cannot see their data issues. Ask an administrator if you need it." /></RecCard>
      </RecPage>
    );
  }

  const tz = core.config.timezone;
  const now = ms(ctx.now);
  const all = q.issues();
  const active = (i: DataIssue) => i.state === "open" || i.state === "in_progress";
  const openAll = all.filter(active);
  const refs = (i: DataIssue) => i.recordIds.map((id) => q.record(id)?.ref || "Not visible").join(", ");
  const hay = (i: DataIssue) => [i.title, ISSUE_LABEL[i.kind], SEVERITY_LABEL[i.severity], ISSUE_STATE_LABEL[i.state], refs(i),
    ...i.recordIds.map((id) => q.record(id)?.title || ""), q.name(i.ownerId), ...i.sourceIds.map((s) => sourceLabel(core, s)), i.sourceValue || "", i.externalId || ""].join(" ");
  const terms = termsOf(query);

  const inState = (i: DataIssue) => state === "all" ? true : state === "active" ? active(i) : i.state === state;
  const base = all.filter((i) => (!only || only.ids.includes(i.id)) && inState(i) && (!sev || i.severity === sev) && matchesAll(hay(i), terms));
  const rows = (kind === "all" ? base : base.filter((i) => i.kind === kind))
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.detectedAt.localeCompare(b.detectedAt));
  const searched = all.filter((i) => matchesAll(hay(i), terms)).length;

  const high = openAll.filter((i) => i.severity === "high").length;
  const resolvedWeek = all.filter((i) => i.state === "resolved" && i.resolution && now - ms(i.resolution.at) <= 7 * DAY).length;
  const completeness = computeMetric(core, ctx, "completeness");
  const hasDataDash = core.config.dashboards.some((d) => d.id === "data");
  const toDash = () => navigate({ page: "Dashboard", section: "data" });

  const worst = [...openAll].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.detectedAt.localeCompare(b.detectedAt))[0];

  const suggestions = [
    ...(high ? ["high"] : []),
    ...KINDS.filter((k) => openAll.some((i) => i.kind === k)).slice(0, 2).map((k) => ISSUE_LABEL[k].toLowerCase()),
    ...(openAll[0] ? [q.name(openAll[0].ownerId).split(" ")[0].toLowerCase()] : [])
  ].filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 4);

  const stateLabel: Record<StateSel, string> = { active: "Open and in progress", open: "Open", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed", all: "All states" };
  const noRecords = core.data.records.length === 0;
  const empty = noRecords ? (
    <RecEmpty title="Nothing to check yet" body="There are no records yet. Issues appear here once records exist: empty required fields, source values that do not map, possible duplicates, values that disagree with a source and source rows with no matching record." />
  ) : all.length === 0 ? (
    <RecEmpty title={"No data issues in " + scopeLabel(core, ctx.scope)} body="Required fields are filled and sources agree with Pulse for the records you can see here. New issues appear automatically when that changes." />
  ) : (
    <RecEmpty title={"No " + (state === "all" ? "" : stateLabel[state].toLowerCase() + " ") + (kind === "all" ? "issues" : ISSUE_LABEL[kind].toLowerCase() + " issues") + " match"}
      body="Try another kind, state or severity, or clear the search."
      action={<button type="button" className="pf-btn" onClick={() => { setKind("all"); setState("all"); setSev(""); setQuery(""); }}>Show all issues</button>} />
  );

  return (
    <RecPage>
      <RecordsHero
        eyebrow={eyebrowOf("Records", "Data quality", openAll.length + " open", scopeLabel(core, ctx.scope))}
        title="Data quality"
        blurb="The resolution queue. Each issue says what is wrong and opens at the step that fixes it, so the record, the queue and the dashboard change together."
        query={query} onQuery={setQuery} placeholder="Try a reference, a kind, an owner or a source value" kind="KEYWORD" searchLabel="Search issues"
        suggestions={suggestions}
        answer={searched
          ? <>{searched} of {plural(all.length, "issue", "issues")} match on title, kind, records, owner and source</>
          : <>Nothing matched. It searches title, kind, records, owner and source values.<button type="button" onClick={() => setQuery("")}>Clear search</button></>}
      />

      <div className="rq-stats">
      <StatStrip stats={[
        { label: "Open", value: String(openAll.length), color: openAll.length ? "var(--ink)" : "var(--ok)", onClick: () => { setState("active"); setSev(""); setKind("all"); }, title: "Open and in progress" },
        { label: "High severity", value: String(high), color: high ? "var(--bad)" : "var(--ink)", onClick: () => { setState("active"); setSev("high"); }, title: "Open issues marked high severity" },
        { label: "Resolved this week", value: String(resolvedWeek), color: resolvedWeek ? "var(--ok)" : "var(--ink)", onClick: () => { setState("resolved"); setSev(""); }, title: "Issues resolved in the last 7 days. Filled fields close their issue on their own and show in completeness." },
        { label: "Completeness", value: completeness ? completeness.display : "No data",
          color: completeness?.stale ? "var(--warn)" : "var(--ink)",
          onClick: hasDataDash ? toDash : undefined,
          title: completeness && completeness.numerator !== undefined && completeness.denominator ? completeness.numerator + " of " + completeness.denominator + " required fields filled" + (completeness.stale ? ". Some sources are stale." : "") : "Required fields filled across the records you can see" }
      ]} />
      </div>

      {worst && (
        <div style={{ marginTop: 22 }}>
          <Callout tone={worst.severity === "high" ? "bad" : "warn"} eyebrow={"Most serious open issue · " + ISSUE_LABEL[worst.kind]} title={worst.title}
            actions={<>
              <Btn primary onClick={() => openIssue(worst.id, true)}>{ACTION[worst.kind]}</Btn>
              {worst.recordIds[0] && q.record(worst.recordIds[0]) && <Btn onClick={() => openObject("record", worst.recordIds[0])}>Open {q.record(worst.recordIds[0])!.ref}</Btn>}
            </>}>
            {worst.recordIds.length ? refs(worst) + ". " : ""}{ISSUE_PATH[worst.kind]} Detected {relative(worst.detectedAt, ctx.now, tz)}, owned by {q.name(worst.ownerId)}.
          </Callout>
        </div>
      )}

      {only && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
          <Pill tone="accent">{"Showing " + rows.length + " of " + only.ids.length + " issues from " + only.label}</Pill>
          <button type="button" className="pf-btn pf-btn--sm" onClick={() => setOnly(null)}>Show all issues</button>
        </div>
      )}
      <div className="rq-bar">
        <SegTabs<KindSel> label="Issue kind" value={kind} onChange={setKind}
          options={[{ value: "all", label: "All", count: base.length }, ...KINDS.map((k) => ({ value: k as KindSel, label: KIND_SHORT[k], count: base.filter((i) => i.kind === k).length }))]} />
        <span style={{ flex: 1 }} />
        <FilterChip label="Issue state" value={state} onChange={(s) => setState(s as StateSel)}
          options={(["active", "open", "in_progress", "resolved", "dismissed", "all"] as StateSel[]).map((s) => ({ value: s, label: stateLabel[s] }))} />
        <FilterChip label="Severity" value={sev} onChange={(s) => setSev(s as SevSel)}
          options={[{ value: "", label: "Any severity" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
      </div>

      {rows.length === 0 ? <RecCard title="Issues" badge={"0 / " + all.length}>{empty}</RecCard> : (
        <div className="rq-card" role="list" aria-label="Data issues">
          {rows.map((i, n) => {
            const [ink, soft] = SEV_TINT[i.severity];
            const act = active(i);
            return (
              <div key={i.id} className="rq-row" role="listitem" style={{ animationDelay: Math.min(n, 12) * 18 + "ms" }}>
                <span className="rq-tile" style={{ background: soft, color: ink }} title={ISSUE_LABEL[i.kind]}><Svg d={KIND_ICON[i.kind]} size={16} sw={1.8} /></span>
                <div className="rq-main">
                  <button type="button" className="rq-title" onClick={() => openIssue(i.id, false)}>{i.title}</button>
                  <div className="rq-meta">
                    <span><Svg d="M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5" />{i.recordIds.length ? <span className="pk-mono rh-ell" style={{ fontSize: 11.5 }}>{refs(i)}</span> : "No record yet"}</span>
                    <span title={fmtDateTime(i.detectedAt, tz)}><Svg d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2" />Detected {relative(i.detectedAt, ctx.now, tz)}</span>
                    <span><Svg d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />{i.sourceIds.map((s) => sourceLabel(core, s)).join(", ") || "Pulse"}</span>
                    {!act && <span style={{ color: ISSUE_STATE_TONE[i.state] === "ok" ? "var(--ok)" : "var(--faint)" }}>{ISSUE_STATE_LABEL[i.state]}</span>}
                    {i.state === "in_progress" && <span style={{ color: "var(--accent)" }}>In progress</span>}
                  </div>
                </div>
                <div className="rq-side">
                  <Pill tone={toneOf.severity(i.severity)}>{SEVERITY_LABEL[i.severity]}</Pill>
                  <span className="rq-who" title={"Owner: " + q.name(i.ownerId)}>{q.initials(i.ownerId)}<span className="rc-sr">Owner {q.name(i.ownerId)}</span></span>
                  <button type="button" className="rq-act ixw" onClick={() => openIssue(i.id, act)}>
                    {act ? ACTION[i.kind] : "View"}
                    <Svg d="M5 12h14 M13 6l6 6-6 6" size={11} sw={1.9} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasDataDash && (
        <div style={{ marginTop: 18 }}>
          <button type="button" className="rh-link" onClick={toDash}>See trends on the Data quality dashboard<Svg d="M5 12h14 M13 6l6 6-6 6" size={12} sw={1.9} /></button>
        </div>
      )}

      {openId && <IssuePanel id={openId} toResolver={toResolver} onClose={() => setOpenId(null)} />}
    </RecPage>
  );
}

/* ── Issue panel ───────────────────────────────────────────────────────── */

export function IssuePanel({ id, onClose, toResolver }: { id: Id; onClose: () => void; toResolver?: boolean }) {
  const { core, q } = useCore();
  const issue = q.issues({ ignoreScope: true }).find((i) => i.id === id);
  // Derived missing-field issues disappear once the field is filled; remember what was shown.
  const last = useRef<DataIssue | undefined>(issue);
  // The row actions (Fill field, Compare, Map code...) open the panel at the resolver.
  const resolverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toResolver) return;
    const t = window.setTimeout(() => resolverRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 120);
    return () => window.clearTimeout(t);
  }, [id, toResolver]);
  if (issue) last.current = issue;
  const shown = issue || last.current;

  if (!shown) {
    return (
      <SidePanel open onClose={onClose} title="Issue not available" width={560}>
        <Empty title="Not available to you" body="This issue no longer exists, or it concerns records you cannot see." />
      </SidePanel>
    );
  }
  if (!issue) {
    return (
      <SidePanel open onClose={onClose} eyebrow={ISSUE_LABEL[shown.kind]} chips={<Chip tone="ok">Resolved</Chip>} title={shown.title} width={560}
        footer={<Button onClick={onClose}>Close</Button>}>
        <Notice tone="ok">The field now has a value, so this issue closed itself. The change is in the record's history.</Notice>
        {shown.recordIds[0] && <div className="pk-section"><Button onClick={() => openObject("record", shown.recordIds[0])}>Open the record</Button></div>}
      </SidePanel>
    );
  }

  const block = resolveBlock(core, q.viewer, issue);
  const active = issue.state === "open" || issue.state === "in_progress";
  const events = q.events({ ignoreScope: true }).filter((e) => e.objectType === "issue" && e.objectId === issue.id).sort((a, b) => b.at.localeCompare(a.at));
  const staff = q.people({ kind: "staff" }).filter((p) => p.status === "active");

  return (
    <SidePanel open onClose={onClose} width={680} eyebrow={ISSUE_LABEL[issue.kind]}
      chips={<><Chip tone={toneOf.severity(issue.severity)}>{SEVERITY_LABEL[issue.severity]}</Chip><Chip tone={ISSUE_STATE_TONE[issue.state]}>{ISSUE_STATE_LABEL[issue.state]}</Chip></>}
      title={issue.title}>
      <div className="pk-section" style={{ marginTop: 4 }}>
        <KV items={[
          ["Severity", SEVERITY_LABEL[issue.severity]],
          ["State", ISSUE_STATE_LABEL[issue.state]],
          ["Detected", <When at={issue.detectedAt} />],
          ["Source", issue.sourceIds.map((s) => sourceLabel(core, s)).join(", ")]
        ]} />
      </div>

      <Section label="Owner">
        <div className="rc-row">
          {block ? <PersonName id={issue.ownerId} /> : <div style={{ minWidth: 200, flex: "1 1 200px", maxWidth: 320 }}>
            <Select ariaLabel="Issue owner" value={issue.ownerId} onChange={(pid) => { if (pid !== issue.ownerId) store.run(ops.assignIssue, issue.id, pid); }}
              options={[...(staff.some((p) => p.id === issue.ownerId) ? [] : [{ value: issue.ownerId, label: q.name(issue.ownerId) }]), ...staff.map((p) => ({ value: p.id, label: p.name }))]} />
          </div>}
          {block && <span className="rc-small">{block}</span>}
        </div>
      </Section>

      {issue.recordIds.length > 0 && (
        <Section label={"Records · " + issue.recordIds.length}>
          <List>
            {issue.recordIds.map((rid) => {
              const r = q.record(rid);
              return r ? (
                <ListButton key={rid} onClick={() => openObject("record", rid)}>
                  <Ref>{r.ref}</Ref><Grow>{r.title}</Grow><Chip tone={statusOf(core, r).tone}>{statusOf(core, r).label}</Chip>
                </ListButton>
              ) : <div key={rid} className="pk-li rc-small">A record you cannot see</div>;
            })}
          </List>
        </Section>
      )}

      {active ? (
        <>
          <div ref={resolverRef} style={{ scrollMarginTop: 12 }}>
            <Section label="How to resolve">
              <Notice>{ISSUE_PATH[issue.kind]}</Notice>
            </Section>
          </div>
          {issue.kind === "missing_field" && <MissingField issue={issue} />}
          {issue.kind === "duplicate" && <Duplicate issue={issue} block={block} />}
          {issue.kind === "unmapped_value" && <Unmapped issue={issue} block={block} />}
          {issue.kind === "conflict" && <Conflict issue={issue} block={block} />}
          {issue.kind === "unmatched" && <Unmatched issue={issue} block={block} />}
          <StateActions issue={issue} block={block} />
        </>
      ) : (
        <Section label="Resolution">
          {issue.resolution ? (
            <KV items={[
              ["Action", issue.resolution.action],
              ["By", <PersonName id={issue.resolution.by} />],
              ["When", <span title={fmtDateTime(issue.resolution.at, core.config.timezone)}><When at={issue.resolution.at} /></span>],
              ["Reason", issue.resolution.reason || "None given"]
            ]} />
          ) : <div className="rc-small">No resolution details were recorded.</div>}
          {issue.state === "dismissed" && (
            <div className="rc-row" style={{ marginTop: 10 }}>
              <Button size="sm" disabled={!!block} title={block || undefined} onClick={() => store.run(ops.setIssueState, issue.id, "open", "")}>Reopen</Button>
            </div>
          )}
        </Section>
      )}

      {events.length > 0 && (
        <Section label="Issue history">
          <List>
            {events.map((e) => (
              <div key={e.id} className="pk-li" style={{ alignItems: "flex-start" }}>
                <span className="pk-grow" style={{ fontSize: 12.5 }}>{e.summary}<div className="rc-small">{q.name(e.actorId)}</div></span>
                <span className="rc-small" style={{ flex: "none" }}><When at={e.at} /></span>
              </div>
            ))}
          </List>
        </Section>
      )}
    </SidePanel>
  );
}

/* ── State actions: start, dismiss ─────────────────────────────────────── */

function StateActions({ issue, block }: { issue: DataIssue; block: string | null }) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const dismissLabel = issue.kind === "duplicate" ? "Not a duplicate" : "Dismiss";
  const dismiss = () => {
    setTried(true);
    if (!reason.trim()) return;
    const r = store.run(ops.setIssueState, issue.id, "dismissed", reason.trim());
    if (r.ok) setDismissing(false);
  };
  return (
    <Section label="Issue state">
      {dismissing ? (
        <div className="rc-fields"><div className="rc-edit">
          <Field label={issue.kind === "duplicate" ? "Why these are different records" : "Why this is not a problem"} htmlFor="rc-dismiss" error={tried && !reason.trim() ? "Say why, so others can see the reasoning." : null}>
            <TextArea id="rc-dismiss" value={reason} onChange={setReason} rows={2} invalid={tried && !reason.trim()} />
          </Field>
          <div className="rc-row">
            <Button variant="primary" size="sm" onClick={dismiss}>{dismissLabel}</Button>
            <Button variant="ghost" size="sm" onClick={() => setDismissing(false)}>Cancel</Button>
          </div>
        </div></div>
      ) : (
        <div className="rc-row">
          {issue.state === "open" && <Button size="sm" disabled={!!block} title={block || "Mark that you are working on it"} onClick={() => store.run(ops.setIssueState, issue.id, "in_progress", "")}>Start</Button>}
          {issue.state === "in_progress" && <Button size="sm" disabled={!!block} title={block || undefined} onClick={() => store.run(ops.setIssueState, issue.id, "open", "")}>Move back to open</Button>}
          <Button size="sm" variant="ghost" disabled={!!block} title={block || undefined} onClick={() => setDismissing(true)}>{dismissLabel}</Button>
        </div>
      )}
    </Section>
  );
}

/* ── Missing field ─────────────────────────────────────────────────────── */

function MissingField({ issue }: { issue: DataIssue }) {
  const { core, q } = useCore();
  const r = q.record(issue.recordIds[0]);
  const def = r ? typeOf(core, r.typeId)?.fields.find((f) => f.key === issue.field) : undefined;
  const [editing, setEditing] = useState(true);
  if (!r || !def) return <Section label="Fill the field"><div className="rc-small">The record or field is no longer available.</div></Section>;
  if (!can(q.viewer, "records.edit")) return <Section label="Fill the field"><Notice>Your role cannot edit records. The record owner, {q.name(r.ownerId)}, can fill it.</Notice></Section>;
  return (
    <Section label={"Fill " + def.label.toLowerCase() + " on " + r.ref}>
      {editing ? <div className="rc-fields"><FieldEditor record={r} def={def} saveLabel="Save to record" onDone={() => setEditing(false)} /></div>
        : <Button size="sm" onClick={() => setEditing(true)}>Edit {def.label.toLowerCase()}</Button>}
    </Section>
  );
}

/* ── Duplicate ─────────────────────────────────────────────────────────── */

function Duplicate({ issue, block }: { issue: DataIssue; block: string | null }) {
  const { core, q } = useCore();
  const [a, b] = issue.recordIds.map((id) => q.record(id));
  const [survivorId, setSurvivorId] = useState<Id>(issue.recordIds[0]);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [tried, setTried] = useState(false);
  if (!a || !b) return <Section label="Compare"><div className="rc-small">One of the records is not visible to you, so they cannot be compared here.</div></Section>;
  const canMerge = can(q.viewer, "records.merge");
  const mergeReason = !canMerge ? "Merging records needs the merge permission (administrators by default)." : block;
  const otherId = survivorId === a.id ? b.id : a.id;
  const preview = ops.mergePreview(core, survivorId, otherId);
  const survivor = survivorId === a.id ? a : b;
  const other = survivorId === a.id ? b : a;
  const tz = core.config.timezone;
  const type = typeOf(core, a.typeId);
  const keys = [...new Set([...(type?.fields.map((f) => f.key) || []), ...Object.keys(a.fields), ...Object.keys(b.fields)])];
  const val = (r: RecordItem, k: string) => fmtField(core, q, type?.fields.find((f) => f.key === k), r.fields[k]) ?? "Missing";
  const srcs = (r: RecordItem) => r.sourceRefs.length ? r.sourceRefs.map((s) => sourceLabel(core, s.sourceId) + " " + s.externalId).join(", ") : "Pulse only";
  const rows: [string, string, string][] = [
    ["Title", a.title, b.title],
    ["Status", statusOf(core, a).label, statusOf(core, b).label],
    ["Owner", q.name(a.ownerId), q.name(b.ownerId)],
    ...keys.map((k): [string, string, string] => [type?.fields.find((f) => f.key === k)?.label || k, val(a, k), val(b, k)]),
    ["Sources", srcs(a), srcs(b)],
    ["Created", fmtDay(a.createdAt, tz), fmtDay(b.createdAt, tz)],
    ["Updated", fmtDay(a.updatedAt, tz), fmtDay(b.updatedAt, tz)]
  ];
  const fieldLabel = (k: string) => type?.fields.find((f) => f.key === k)?.label || k;
  const fmtV = (k: string, v: FieldValue) => fmtField(core, q, type?.fields.find((f) => f.key === k), v) ?? "empty";
  const merge = () => {
    const r = store.run(ops.mergeRecords, issue.id, survivorId, reason.trim());
    if (r.ok) setConfirming(false);
  };

  return (
    <>
      <Section label="Compare">
        <div className="rc-compare" role="table" aria-label="Record comparison">
          <div className="rc-h" role="columnheader" />
          <div className="rc-h" role="columnheader">{a.ref}</div>
          <div className="rc-h" role="columnheader">{b.ref}</div>
          {rows.map(([label, x, y]) => {
            const diff = x !== y;
            return [
              <div key={label + "k"} className="rc-k" role="rowheader">{label}</div>,
              <div key={label + "a"} className={diff ? "rc-diff" : undefined} role="cell">{x}</div>,
              <div key={label + "b"} className={diff ? "rc-diff" : undefined} role="cell">{y}</div>
            ];
          })}
        </div>
        <div className="rc-small" style={{ marginTop: 6 }}>Highlighted rows differ.</div>
      </Section>

      <Section label="Keep which record">
        <div className="rc-stack">
          {[a, b].map((r) => (
            <button key={r.id} type="button" className="rc-choice" aria-pressed={survivorId === r.id} onClick={() => { setSurvivorId(r.id); setConfirming(false); }}>
              <span className="pk-mono" style={{ fontSize: 12 }}>{r.ref}</span>
              <span className="pk-grow">{r.title}<div className="rc-small">{srcs(r)}</div></span>
              {survivorId === r.id && <Chip tone="accent" plain>Kept</Chip>}
            </button>
          ))}
        </div>
      </Section>

      {preview && (
        <Section label="What the merge does">
          <div className="rc-stack" style={{ fontSize: 12.5, color: "var(--body)" }}>
            <div>{other.ref} is marked as merged into {survivor.ref}. It is not deleted, and the merge can be undone from either record.</div>
            {preview.fieldDiffs.length === 0 ? <div>The field values are the same.</div> : (
              <div className="rc-mini-wrap">
                <table className="rc-mini">
                  <thead><tr><th>Field</th><th>{survivor.ref} (kept)</th><th>{other.ref}</th><th>Result</th></tr></thead>
                  <tbody>
                    {preview.fieldDiffs.map((d) => (
                      <tr key={d.key}>
                        <td>{fieldLabel(d.key)}</td><td>{fmtV(d.key, d.survivor)}</td><td>{fmtV(d.key, d.other)}</td>
                        <td>{d.survivor === null || d.survivor === "" ? "Filled from " + other.ref : "Kept value stands"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div>Moves to {survivor.ref}: {preview.relationships} relationships, {preview.tasks} tasks, {preview.files} files, {preview.requests} requests.</div>
            <div>Source references kept on {survivor.ref}: {preview.sourceRefs.length ? preview.sourceRefs.map((s) => sourceLabel(core, s.sourceId) + " " + s.externalId).join(", ") : "none to carry over"}.</div>
          </div>
        </Section>
      )}

      <Section label="Merge">
        <div className="rc-stack">
          <Field label="Why these are the same" htmlFor="rc-merge-reason" error={tried && !reason.trim() ? "Record why these are the same." : null}>
            <TextArea id="rc-merge-reason" value={reason} onChange={setReason} rows={2} invalid={tried && !reason.trim()} />
          </Field>
          {confirming ? (
            <Notice tone="warn">
              <div>Merge {other.ref} into {survivor.ref}? Links and source references move to {survivor.ref}.</div>
              <div className="rc-row" style={{ marginTop: 8 }}>
                <Button variant="primary" size="sm" onClick={merge}>Confirm merge</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Back</Button>
              </div>
            </Notice>
          ) : (
            <div className="rc-row">
              <Button variant="primary" size="sm" disabled={!!mergeReason} title={mergeReason || undefined}
                onClick={() => { setTried(true); if (reason.trim()) setConfirming(true); }}>Review merge</Button>
              {mergeReason && <span className="rc-small">{mergeReason}</span>}
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

/* ── Unmapped value ────────────────────────────────────────────────────── */

function Unmapped({ issue, block }: { issue: DataIssue; block: string | null }) {
  const { core, q } = useCore();
  const r = q.record(issue.recordIds[0]);
  const def = r ? typeOf(core, r.typeId)?.fields.find((f) => f.key === issue.field) : undefined;
  const [to, setTo] = useState("");
  const savesMapping = can(q.viewer, "settings.edit");
  const existing = core.config.codeMappings.filter((m) => m.sourceId === issue.sourceIds[0] && m.field === issue.field);
  if (!r || !def) return <Section label="Map the value"><div className="rc-small">The record or field is no longer available.</div></Section>;
  return (
    <Section label="Map the value">
      <div className="rc-stack">
        <KV items={[
          ["Raw source code", <span className="pk-mono">{issue.sourceValue || "None"}</span>],
          ["Field", def.label + " on " + r.ref],
          ["From", sourceLabel(core, issue.sourceIds[0])]
        ]} />
        {existing.length > 0 && <div className="rc-small">Codes already mapped for this field: {existing.map((m) => m.from + " to " + (def.options?.find((o) => o.value === m.to)?.label || m.to)).join(", ")}.</div>}
        <Field label={"Map " + (issue.sourceValue || "the code") + " to"} htmlFor="rc-map">
          <Select id="rc-map" value={to} onChange={setTo} options={[{ value: "", label: def.options?.length ? "Choose a configured value" : "No values configured" }, ...(def.options || [])]} />
        </Field>
        <Notice tone={savesMapping ? "neutral" : "warn"}>
          {savesMapping ? "The mapping is saved for future syncs, so this code maps automatically next time." : "This sets the value on this record only. Saving the mapping for future syncs needs an administrator."}
        </Notice>
        <div className="rc-row">
          <Button variant="primary" size="sm" disabled={!to || !!block} title={block || (!to ? "Choose a value first" : undefined)}
            onClick={() => store.run(ops.mapCode, issue.id, to)}>Map value</Button>
          {block && <span className="rc-small">{block}</span>}
        </div>
      </div>
    </Section>
  );
}

/* ── Conflict ──────────────────────────────────────────────────────────── */

function Conflict({ issue, block }: { issue: DataIssue; block: string | null }) {
  const { core, q } = useCore();
  const r = q.record(issue.recordIds[0]);
  const def = r ? typeOf(core, r.typeId)?.fields.find((f) => f.key === issue.field) : undefined;
  const [chosen, setChosen] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  if (!r || !issue.values?.length) return <Section label="Compare values"><div className="rc-small">The record or the compared values are no longer available.</div></Section>;
  const tz = core.config.timezone;
  const current = r.fields[issue.field || ""] ?? null;
  const outcome = !chosen ? null : chosen === "pulse"
    ? authorityText(core, r, issue.field || "")
    : { tone: "neutral" as const, text: "The record takes the value from " + sourceLabel(core, chosen) + " and marks it as a source value. The Pulse value is kept in the history." };
  const resolve = () => {
    setTried(true);
    if (!chosen || !reason.trim()) return;
    store.run(ops.resolveConflict, issue.id, chosen, reason.trim());
  };
  return (
    <Section label={"Compare " + (def?.label.toLowerCase() || "values") + " on " + r.ref}>
      <div className="rc-stack">
        {issue.values.map((x) => (
          <button key={x.sourceId} type="button" className="rc-choice" aria-pressed={chosen === x.sourceId} onClick={() => setChosen(x.sourceId)}>
            <span className="pk-grow">
              <span style={{ color: "var(--ink)" }}>{fmtField(core, q, def, x.value) ?? "Empty"}</span>
              <div className="rc-small">{sourceLabel(core, x.sourceId)}, {fmtDateTime(x.at, tz)}</div>
            </span>
            {x.value === current && <Chip tone="neutral" plain>On the record now</Chip>}
            {chosen === x.sourceId && <Chip tone="accent" plain>Chosen</Chip>}
          </button>
        ))}
        <Field label="Why this value is right" htmlFor="rc-conflict-reason" error={tried && !reason.trim() ? "Record why this value is right." : null}>
          <TextInput id="rc-conflict-reason" value={reason} onChange={setReason} invalid={tried && !reason.trim()} />
        </Field>
        {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}
        {tried && !chosen && <div className="pk-error">Choose one of the values.</div>}
        <div className="rc-row">
          <Button variant="primary" size="sm" disabled={!!block} title={block || undefined} onClick={resolve}>Keep chosen value</Button>
          {block && <span className="rc-small">{block}</span>}
        </div>
      </div>
    </Section>
  );
}

/* ── Unmatched source row ──────────────────────────────────────────────── */

function Unmatched({ issue, block }: { issue: DataIssue; block: string | null }) {
  const { core, q } = useCore();
  const [mode, setMode] = useState<"link" | "create">("link");
  const [recordId, setRecordId] = useState("");
  const [title, setTitle] = useState(issue.sourceValue || "");
  const candidates = q.records({ ignoreScope: true });
  const firstType = core.config.recordTypes[0];
  const go = () => {
    if (mode === "link") { if (recordId) store.run(ops.linkUnmatched, issue.id, recordId); }
    else {
      const r = store.run(ops.linkUnmatched, issue.id, null, title.trim() || undefined);
      if (r.ok && r.id) openObject("record", r.id);
    }
  };
  return (
    <Section label="Source row">
      <div className="rc-stack">
        <KV items={[
          ["Source", sourceLabel(core, issue.sourceIds[0])],
          ["External id", <span className="pk-mono">{issue.externalId || "None"}</span>],
          ["Row says", issue.sourceValue || "Nothing readable"],
          ["Arrived", <When at={issue.detectedAt} />]
        ]} />
        <Segmented<"link" | "create"> label="Resolution" value={mode} onChange={setMode}
          options={[{ value: "link", label: "Link to an existing record" }, { value: "create", label: "Create a new record" }]} />
        {mode === "link" ? (
          <Field label="Record" htmlFor="rc-unmatched-rec" help="The source reference is added to this record, so future syncs update it.">
            <Select id="rc-unmatched-rec" value={recordId} onChange={setRecordId}
              options={[{ value: "", label: candidates.length ? "Choose a record" : "No records you can see" }, ...candidates.map((r) => ({ value: r.id, label: r.ref + " " + r.title }))]} />
          </Field>
        ) : (
          <Field label="Title" htmlFor="rc-unmatched-title" help={"Creates a " + (firstType?.label.toLowerCase() || "record") + " in your " + core.config.terminology.team.toLowerCase() + ", linked to this source row. Fill its required fields afterwards."}>
            <TextInput id="rc-unmatched-title" value={title} onChange={setTitle} />
          </Field>
        )}
        <div className="rc-row">
          <Button variant="primary" size="sm" disabled={!!block || (mode === "link" && !recordId)} title={block || (mode === "link" && !recordId ? "Choose a record first" : undefined)} onClick={go}>
            {mode === "link" ? "Link source row" : "Create record"}
          </Button>
          {block && <span className="rc-small">{block}</span>}
        </div>
      </div>
    </Section>
  );
}
