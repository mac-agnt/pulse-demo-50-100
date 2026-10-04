/* Records > Browse, the default Records tab: a compact header with the
   search, one bar of quick segments and filter chips, then the table of
   permitted, in-scope records (dense rows, so 8 to 10 show at 1440x900).
   Rows open the record panel. New record, saved views and export work
   through ops. No illustrative graph sits above the list. */

import { useMemo, useState } from "react";
import { useCore, store, ops, can, scopeLabel, toCsv, relative, ms, missingFields, STALE_AFTER_HOURS, HOUR, DAY } from "../../core";
import type { FieldValue, Id, RecordItem, SavedView } from "../../core";
import { Button, Field, Notice, Select, SidePanel, TextInput, downloadText } from "../kit";
import { FilterChip, Pill, eyebrowOf } from "../frame";
import { RecordPanel } from "./RecordPanel";
import { FieldInput, coerce, exportBlock, fmtField, isOpenIssue, sourceLabel, statusOf, typeOf, useFocus } from "./common";
import { HeroAdd, Initials, RecCard, RecEmpty, RecPage, RecordsHero, matchesAll, plural, termsOf } from "./hero";

type Quick = "all" | "review" | "missing" | "work" | "recent" | "stale";
type Filters = { status: string; team: string; owner: string };
const NO_FILTERS: Filters = { status: "", team: "", owner: "" };
type SortKey = "record" | "team" | "status" | "owner" | "required" | "source" | "issues" | "updated";
type Sort = { key: SortKey; dir: "asc" | "desc" };
const DEFAULT_SORT: Sort = { key: "updated", dir: "desc" };
const PAGE = 40;

const COLS = "minmax(230px,1.7fr) minmax(140px,1fr) minmax(112px,.8fr) minmax(150px,1fr) minmax(170px,1.1fr) minmax(150px,1fr) minmax(108px,.6fr)";
const OPEN_REQUEST = new Set(["draft", "submitted", "changes_requested"]);

export default function RecordsBrowse(_props: { v: unknown }) {
  const { core, ctx, q } = useCore();
  const viewer = q.viewer;
  const types = core.config.recordTypes;
  const T = core.config.terminology;
  const tz = core.config.timezone;

  const [typeId, setTypeId] = useState(types[0]?.id || "");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [quick, setQuick] = useState<Quick>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<Id | null>(null);
  const [idsFilter, setIdsFilter] = useState<{ ids: Id[]; label: string } | null>(null);
  const [viewId, setViewId] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocus(["record", "ids"], (f) => {
    if (f.kind === "record" && f.id) setOpenId(f.id);
    if (f.kind === "ids" && f.ids) {
      setIdsFilter({ ids: f.ids, label: f.label || "another page" });
      setFilters(NO_FILTERS); setQuick("all"); setQuery(""); setViewId("");
    }
  });

  /* Facts per record, computed once per snapshot. */
  const facts = useMemo(() => {
    const issues = new Map<Id, number>();
    const reviewIssue = new Set<Id>();
    for (const i of q.issues({ ignoreScope: true })) {
      if (!isOpenIssue(i)) continue;
      for (const id of i.recordIds) {
        issues.set(id, (issues.get(id) || 0) + 1);
        if (i.kind !== "missing_field") reviewIssue.add(id);
      }
    }
    const work = new Set<Id>();
    for (const t of q.tasks({ ignoreScope: true })) if (q.isOpenTask(t)) t.linkedRecordIds.forEach((id) => work.add(id));
    for (const r of q.requests({ ignoreScope: true })) if (OPEN_REQUEST.has(r.status)) {
      r.linkedRecordIds.forEach((id) => work.add(id));
      if (typeof r.fields.recordId === "string") work.add(r.fields.recordId);
    }
    return { issues, reviewIssue, work };
  }, [q]);

  if (!can(viewer, "records.view")) {
    return (
      <RecPage>
        <RecordsHero eyebrow={eyebrowOf("Records", "Browse")} title={T.records} blurb={"Every " + T.record.toLowerCase() + " you are allowed to see, in one list."}
          query="" onQuery={() => undefined} placeholder="Search records" kind="KEYWORD" suggestions={[]} answer="" searchLabel="Search records" disabled />
        <RecCard title={T.records}><RecEmpty title="Not available to you" body={"Your role cannot see " + T.records.toLowerCase() + ". Ask an administrator if you need it."} /></RecCard>
      </RecPage>
    );
  }

  const now = ms(ctx.now);
  const type = typeOf(core, typeId);
  const pluralLabel = idsFilter ? T.records : type?.plural || T.records;

  /* Base rows: the ids handed over from another page, or the chosen type in scope. */
  const idSet = idsFilter ? new Set(idsFilter.ids) : null;
  const base: RecordItem[] = idSet ? q.records({ ignoreScope: true }).filter((r) => idSet.has(r.id)) : q.records(typeId ? { typeId } : {});

  const typeOfRec = (r: RecordItem) => typeOf(core, r.typeId);
  const required = (r: RecordItem) => (typeOfRec(r)?.fields || []).filter((f) => f.required);
  const missing = (r: RecordItem) => { const keys = missingFields(core, r); return required(r).filter((f) => keys.includes(f.key)); };
  const unitOf = (r: RecordItem) => q.unitLabel(r.unitId || core.config.teams.find((t) => t.id === r.teamId)?.unitId);
  const teamText = (r: RecordItem) => r.teamId ? q.teamLabel(r.teamId) : "No " + T.team.toLowerCase();
  const lastSync = (r: RecordItem) => r.sourceRefs.map((s) => s.syncedAt).filter(Boolean).sort()[0] as string | undefined;
  const isStale = (r: RecordItem) => r.sourceRefs.some((s) => s.syncedAt && (now - ms(s.syncedAt)) / HOUR > STALE_AFTER_HOURS);
  const sourceText = (r: RecordItem) => r.sourceRefs.length ? [...new Set(r.sourceRefs.map((s) => sourceLabel(core, s.sourceId)))].join(", ") : "Pulse";

  const isQuick: Record<Quick, (r: RecordItem) => boolean> = {
    all: () => true,
    review: (r) => statusOf(core, r).tone === "warn" || facts.reviewIssue.has(r.id) || Object.values(r.fieldMeta).some((m) => m.pendingSourceReview),
    missing: (r) => missing(r).length > 0,
    work: (r) => facts.work.has(r.id),
    recent: (r) => now - ms(r.updatedAt) <= 7 * DAY,
    stale: isStale
  };

  const hay = (r: RecordItem) => [r.ref, r.title, typeOfRec(r)?.label || "", statusOf(core, r).label, q.name(r.ownerId), teamText(r), unitOf(r), sourceText(r),
    ...Object.entries(r.fields).map(([k, v]) => fmtField(core, q, typeOfRec(r)?.fields.find((f) => f.key === k), v) || ""),
    missing(r).length ? "missing " + missing(r).map((f) => f.label).join(" ") : ""].join(" ");
  const terms = termsOf(query);

  const filtered = base.filter((r) => (!filters.status || r.status === filters.status) && (!filters.team || (r.teamId || "none") === filters.team)
    && (!filters.owner || r.ownerId === filters.owner) && matchesAll(hay(r), terms));
  const searchedCount = base.filter((r) => matchesAll(hay(r), terms)).length;
  const rows = filtered.filter(isQuick[quick]);

  const sortVal: Record<SortKey, (r: RecordItem) => string | number> = {
    record: (r) => r.ref, team: (r) => teamText(r), status: (r) => statusOf(core, r).label, owner: (r) => q.name(r.ownerId),
    required: (r) => missing(r).length, source: (r) => lastSync(r) || "", issues: (r) => facts.issues.get(r.id) || 0, updated: (r) => r.updatedAt
  };
  const sorted = [...rows].sort((a, b) => {
    const x = sortVal[sort.key](a), y = sortVal[sort.key](b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return sort.dir === "asc" ? c : -c;
  });
  const shown = sorted.slice(0, limit);

  /* Filter options from the rows in view. */
  const statusDefs = idSet || !type ? [...new Map(base.map((r) => [r.status, statusOf(core, r).label])).entries()].map(([value, label]) => ({ value, label }))
    : type.statuses.map((s) => ({ value: s.id, label: s.label }));
  const teamIds = [...new Set(base.map((r) => r.teamId || "none"))];
  const ownerIds = [...new Set(base.map((r) => r.ownerId))].sort((a, b) => q.name(a).localeCompare(q.name(b)));

  /* Saved views: mine, plus views shared with teams I belong to or oversee. */
  const views = core.data.views.filter((v) => v.page === "records" && (v.ownerId === viewer.person.id
    || (v.shared && (!v.teamId || viewer.isOrgWide || viewer.memberTeamIds.includes(v.teamId) || viewer.overseenTeamIds.includes(v.teamId)))));
  const activeView = views.find((v) => v.id === viewId);
  const ownedView = activeView && (activeView.ownerId === viewer.person.id || viewer.isOrgWide);
  const applyView = (id: string) => {
    setViewId(id); setIdsFilter(null); setLimit(PAGE);
    const v = views.find((x) => x.id === id);
    if (!v) { setFilters(NO_FILTERS); setQuick("all"); setQuery(""); setSort(DEFAULT_SORT); return; }
    if (v.state.recordTypeId !== undefined && (v.state.recordTypeId === "" || types.some((t) => t.id === v.state.recordTypeId))) setTypeId(v.state.recordTypeId);
    const f = v.state.filters || {};
    setFilters({ status: f.status || "", team: f.team || "", owner: f.owner || "" });
    setQuick((["all", "review", "missing", "work", "recent", "stale"] as Quick[]).includes(f.quick as Quick) ? f.quick as Quick : "all");
    setQuery(v.state.query || "");
    const sk = v.state.sort?.key as SortKey | undefined;
    setSort(sk && sk in sortVal ? { key: sk, dir: v.state.sort!.dir } : DEFAULT_SORT);
  };

  /* Export exactly the rows shown by the search, filters and segment. */
  const exportReason = exportBlock(core, viewer);
  const doExport = () => {
    const res = store.run(ops.logExport, pluralLabel + " in " + scopeLabel(core, ctx.scope), sorted.length);
    if (!res.ok) return;
    const reqKeys = [...new Map(sorted.flatMap((r) => required(r).map((f) => [f.key, f.label] as [string, string]))).entries()];
    const cols = [{ key: "ref", label: "Ref" }, { key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "status", label: "Status" },
      { key: "owner", label: "Owner" }, { key: "team", label: T.team }, { key: "unit", label: T.unit },
      ...reqKeys.map(([key, label]) => ({ key: "f:" + key, label })), { key: "source", label: "Source" }, { key: "synced", label: "Last synced" },
      { key: "issues", label: "Open issues" }, { key: "updated", label: "Updated" }];
    const data = sorted.map((r) => ({
      ref: r.ref, title: r.title, type: typeOfRec(r)?.label || r.typeId, status: statusOf(core, r).label, owner: q.name(r.ownerId), team: teamText(r), unit: unitOf(r),
      ...Object.fromEntries(reqKeys.map(([key]) => ["f:" + key, fmtField(core, q, typeOfRec(r)?.fields.find((f) => f.key === key), r.fields[key]) ?? "Missing"])),
      source: sourceText(r), synced: lastSync(r) || "", issues: facts.issues.get(r.id) || 0, updated: r.updatedAt
    }));
    downloadText(pluralLabel.toLowerCase().replace(/\s+/g, "-") + ".csv", toCsv(cols, data));
  };

  const canCreate = can(viewer, "records.edit") && types.length > 0;
  const quickDefs: { id: Quick; label: string; title: string }[] = [
    { id: "all", label: "All", title: "Everything that matches the search and filters" },
    { id: "review", label: "Needs review", title: "In a review status, a correction waiting for its source, or an open data issue other than a missing field" },
    { id: "missing", label: "Missing data", title: "At least one required field is empty" },
    { id: "work", label: "Open work", title: "An open task or an open request refers to it" },
    { id: "recent", label: "Changed in 7 days", title: "Updated in the last 7 days" },
    { id: "stale", label: "Stale source", title: "A source last synced more than " + STALE_AFTER_HOURS + " hours ago" }
  ];

  const firstStatus = base[0] ? statusOf(core, base[0]).label.toLowerCase() : "";
  const firstOwner = base[0] ? q.name(base[0].ownerId).split(" ")[0].toLowerCase() : "";
  /* A select field value in use, such as a category. */
  const firstOption = (() => {
    for (const r of base) for (const f of required(r)) {
      const v = r.fields[f.key];
      if (f.kind === "select" && v !== null && v !== undefined && v !== "") return (f.options?.find((o) => o.value === v)?.label || String(v)).toLowerCase();
    }
    return "";
  })();
  const suggestions = [firstStatus, firstOption, firstOwner, base.some((r) => missing(r).length) ? "missing" : ""]
    .filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 4);

  const sortHead = (key: SortKey, label: string) => {
    const on = sort.key === key;
    return (
      <span role="columnheader" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => setSort(on ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "issues" || key === "required" ? "desc" : "asc" })}>
          {label}
          {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d={sort.dir === "asc" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>}
        </button>
      </span>
    );
  };
  const sortText: Record<SortKey, string> = { record: "reference", team: T.team.toLowerCase(), status: "status", owner: "owner", required: "missing fields", source: "last sync", issues: "open issues", updated: "last updated" };

  const actions = (
    <>
      <button type="button" className="pf-btn" onClick={() => setSaving(true)} title="Save the search, filters and segment as a view">Save view</button>
      <button type="button" className="pf-btn" onClick={doExport} disabled={!!exportReason} title={exportReason || "Download the rows shown as CSV"}>Export</button>
      <HeroAdd onClick={() => setCreating(true)} label={"New " + (type ? type.label.toLowerCase() : T.record.toLowerCase())} disabled={!canCreate} title={canCreate ? undefined : types.length ? "Your role cannot create records." : "No record types are configured yet. An administrator can add one in Settings."} />
    </>
  );

  const anyRecords = core.data.records.length > 0;
  const clearAll = () => { setFilters(NO_FILTERS); setQuick("all"); setQuery(""); };
  const empty = !anyRecords ? (
    <RecEmpty title={"No " + T.records.toLowerCase() + " yet"}
      body="Records come from the record types configured in Settings and from connected sources. Once a source is connected its rows appear here. Until then you can add records by hand."
      action={canCreate ? <button type="button" className="pf-btn pf-btn--primary" onClick={() => setCreating(true)}>New {type ? type.label.toLowerCase() : T.record.toLowerCase()}</button> : undefined} />
  ) : base.length === 0 ? (
    <RecEmpty title={"No " + pluralLabel.toLowerCase() + " in " + scopeLabel(core, ctx.scope)}
      body="Records you can see appear here. Change the scope at the top to look wider, or add one by hand." />
  ) : (
    <RecEmpty title="No records match" body="Nothing matches the search, filters and segment."
      action={<button type="button" className="pf-btn" onClick={clearAll}>Clear search and filters</button>} />
  );

  return (
    <RecPage>
      <RecordsHero compact
        eyebrow={eyebrowOf("Records", "Browse", plural(base.length, (type?.label || T.record), pluralLabel), idSet ? "from " + idsFilter!.label : scopeLabel(core, ctx.scope))}
        title={pluralLabel}
        blurb={"Every " + (type?.label || T.record).toLowerCase() + " you are allowed to see. Ask in your own words: it matches on reference, title, owner, " + T.team.toLowerCase() + " and fields."}
        query={query} onQuery={(s) => { setQuery(s); setLimit(PAGE); }} placeholder="Try a reference, a name, a status or a field value" kind="KEYWORD" searchLabel={"Search " + pluralLabel.toLowerCase()}
        suggestions={suggestions}
        answer={searchedCount
          ? <>{searchedCount} of {base.length} match on title, reference, owner and fields</>
          : <>Nothing matched. It searches reference, title, status, owner, {T.team.toLowerCase()} and field values.<button type="button" onClick={() => setQuery("")}>Clear search</button></>}
        actions={actions}
      />

      {idsFilter && (
        <div className="rh-toolbar">
          <Pill tone="accent">Showing {plural(idsFilter.ids.length, T.record.toLowerCase(), T.records.toLowerCase())} from {idsFilter.label}</Pill>
          <button type="button" className="pf-btn pf-btn--sm" onClick={() => setIdsFilter(null)}>Show all {T.records.toLowerCase()}</button>
          {base.length < idsFilter.ids.length && <span className="rc-small">{idsFilter.ids.length - base.length} of them are not visible to you.</span>}
        </div>
      )}

      <div className="rh-bar">
        <span role="group" aria-label="Quick segments" style={{ display: "contents" }}>
          {quickDefs.map((d) => (
            <button key={d.id} type="button" className="rh-qchip" aria-pressed={quick === d.id} title={d.title} onClick={() => { setQuick(d.id); setLimit(PAGE); }}>
              {d.label}<span className="rh-qcount">{filtered.filter(isQuick[d.id]).length}</span>
            </button>
          ))}
        </span>
        <span className="wk-vsep" aria-hidden="true" style={{ width: 1, height: 22, background: "var(--border)" }} />
        {views.length > 0 && (
          <FilterChip label="Saved view" value={viewId} onChange={applyView}
            options={[{ value: "", label: "No saved view" }, ...views.map((v) => ({ value: v.id, label: v.name + (v.ownerId !== viewer.person.id ? " (" + q.name(v.ownerId) + ")" : v.shared ? " (shared)" : "") }))]} />
        )}
        {!idSet && types.length > 0 && (
          <FilterChip label="Record type" value={typeId} onChange={(id) => { setTypeId(id); setFilters({ ...filters, status: "" }); setViewId(""); setLimit(PAGE); }}
            options={[...types.map((t) => ({ value: t.id, label: t.plural })), ...(types.length > 1 ? [{ value: "", label: "All types" }] : [])]} />
        )}
        <FilterChip label={"Filter by " + T.team.toLowerCase()} value={filters.team} onChange={(t) => setFilters({ ...filters, team: t })}
          options={[{ value: "", label: "Any " + T.team.toLowerCase() }, ...teamIds.map((id) => ({ value: id, label: id === "none" ? "No " + T.team.toLowerCase() : q.teamLabel(id) }))]} />
        <FilterChip label="Filter by status" value={filters.status} onChange={(s) => setFilters({ ...filters, status: s })}
          options={[{ value: "", label: "Any status" }, ...statusDefs]} />
        <FilterChip label="Filter by owner" value={filters.owner} onChange={(o) => setFilters({ ...filters, owner: o })}
          options={[{ value: "", label: "Any owner" }, ...ownerIds.map((id) => ({ value: id, label: q.name(id) }))]} />
        {(filters.status || filters.team || filters.owner) && <button type="button" className="rh-more" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>}
        <span style={{ flex: 1 }} />
        {ownedView && <button type="button" className="pf-btn pf-btn--sm" onClick={() => { const r = store.run(ops.deleteView, activeView!.id); if (r.ok) setViewId(""); }}>Delete view</button>}
      </div>
      {exportReason && <div className="rc-small" style={{ margin: "-6px 0 12px" }}>Export is off: {exportReason}</div>}

      <RecCard compact
        title={idsFilter ? T.records + " from " + idsFilter.label : (type ? type.plural : "All " + T.records.toLowerCase())}
        caption={terms.length ? "Filtered by " + terms.map((t) => "“" + t + "”").join(" and ") + (quick !== "all" ? ", " + quickDefs.find((d) => d.id === quick)!.label.toLowerCase() : "")
          : quick !== "all" ? quickDefs.find((d) => d.id === quick)!.title + "." : "Open a row for its overview, related work, files, history and sources."}
        badge={rows.length + " / " + base.length}
        footer={<><span style={{ flex: 1 }}>Showing {shown.length} of {plural(rows.length, T.record.toLowerCase(), T.records.toLowerCase())}{activeView ? ". View: " + activeView.name : ""}</span>
          {sorted.length > shown.length && <button type="button" className="rh-more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, sorted.length - shown.length)} more</button>}
          <span>Sorted by {sortText[sort.key]}</span></>}
      >
        {rows.length > 0 && (
          <div className="rh-scroll">
            <div style={{ minWidth: 1080 }} role="table" aria-label={pluralLabel}>
              <div className="rh-th rh-th--dense" role="row" style={{ gridTemplateColumns: COLS }}>
                {sortHead("record", T.record)}{sortHead("team", T.team)}{sortHead("status", "Status")}{sortHead("owner", "Owner")}
                {sortHead("required", "Required fields")}{sortHead("source", "Source")}{sortHead("issues", "Issues")}
              </div>
              {shown.map((r, i) => {
                const st = statusOf(core, r);
                const req = required(r);
                const miss = missing(r);
                const sync = lastSync(r);
                const stale = isStale(r);
                const n = facts.issues.get(r.id) || 0;
                const unit = unitOf(r);
                return (
                  <button key={r.id} type="button" role="row" className="rh-tr rh-tr--dense" aria-current={openId === r.id ? "true" : undefined}
                    style={{ gridTemplateColumns: COLS, animationDelay: Math.min(i, 12) * 18 + "ms" }} onClick={() => setOpenId(r.id)}>
                    <span className="rh-td" role="cell"><span className="rh-two"><span>{r.title}</span><span className="pk-mono">{r.ref}{!type ? ", " + (typeOfRec(r)?.label || r.typeId) : ""}</span></span></span>
                    <span className="rh-td" role="cell"><span className="rh-two"><span>{teamText(r)}</span><span>{unit || "No " + T.unit.toLowerCase()}</span></span></span>
                    <span className="rh-td" role="cell"><Pill tone={st.tone}>{st.label}</Pill></span>
                    <span className="rh-td" role="cell"><Initials name={q.name(r.ownerId)} initials={q.initials(r.ownerId)} size={22} /><span className="rh-ell" style={{ color: "var(--body)" }}>{q.name(r.ownerId)}</span></span>
                    <span className="rh-td" role="cell">
                      <span className="rh-two">
                        {req.length === 0 ? <span style={{ color: "var(--dim)" }}>None required</span>
                          : miss.length ? <span style={{ color: "var(--warn)" }}>Missing {miss.map((f) => f.label.toLowerCase()).join(", ")}</span>
                            : <span style={{ color: "var(--ok)" }}>All filled</span>}
                        <span>{req.length - miss.length} of {req.length} required</span>
                      </span>
                    </span>
                    <span className="rh-td" role="cell">
                      <span className="rh-two">
                        <span>{sourceText(r)}</span>
                        <span style={stale ? { color: "var(--warn)" } : undefined} title={sync || undefined}>
                          {r.sourceRefs.length === 0 ? "Created in Pulse" : sync ? "Synced " + relative(sync, ctx.now, tz) + (stale ? ", stale" : "") : "Not synced yet"}
                        </span>
                      </span>
                    </span>
                    <span className="rh-td" role="cell">{n ? <Pill tone="warn">{n} open</Pill> : <span style={{ color: "var(--faint)" }}>None</span>}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {rows.length === 0 && empty}
      </RecCard>

      <RecordPanel recordId={openId} onClose={() => setOpenId(null)} />

      {saving && (
        <SaveViewPanel onClose={() => setSaving(false)} onSaved={(id) => { setSaving(false); setViewId(id); }}
          state={{ query: query.trim() || undefined, filters: { ...(filters.status ? { status: filters.status } : {}), ...(filters.team ? { team: filters.team } : {}),
            ...(filters.owner ? { owner: filters.owner } : {}), ...(quick !== "all" ? { quick } : {}) }, sort, recordTypeId: typeId }} />
      )}

      {creating && (
        <NewRecordPanel initialType={typeId || types[0]?.id || ""} onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setIdsFilter(null); setOpenId(id); }} />
      )}
    </RecPage>
  );
}

/* ── Save view ─────────────────────────────────────────────────────────── */

function SaveViewPanel({ state, onClose, onSaved }: { state: SavedView["state"]; onClose: () => void; onSaved: (id: string) => void }) {
  const { core, q } = useCore();
  const viewer = q.viewer;
  const canShare = can(viewer, "views.share");
  const teams = core.config.teams.filter((t) => viewer.isOrgWide || viewer.memberTeamIds.includes(t.id) || viewer.overseenTeamIds.includes(t.id));
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [teamId, setTeamId] = useState(teams[0]?.id || "");
  const [tried, setTried] = useState(false);
  const save = () => {
    setTried(true);
    if (!name.trim()) return;
    const res = store.run(ops.saveView, { page: "records", name, shared, teamId: shared ? teamId || undefined : undefined, state });
    if (res.ok && res.id) onSaved(res.id);
  };
  return (
    <SidePanel open onClose={onClose} title="Save view" width={460}
      footer={<><Button variant="primary" onClick={save}>Save view</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></>}>
      <div className="rc-stack" style={{ gap: 14 }}>
        <Field label="Name" htmlFor="rc-view-name" error={tried && !name.trim() ? "Name the view." : null}>
          <TextInput id="rc-view-name" value={name} onChange={setName} placeholder="For example: In review, Team A" invalid={tried && !name.trim()} />
        </Field>
        <label className="rc-row" style={{ fontSize: 13, color: canShare ? "var(--body)" : "var(--faint)" }} title={canShare ? undefined : "Your role cannot share views."}>
          <input type="checkbox" checked={shared} disabled={!canShare || teams.length === 0} onChange={(e) => setShared(e.target.checked)} />
          Share with a {core.config.terminology.team.toLowerCase()}
        </label>
        {!canShare && <div className="rc-small">Your role cannot share views, so this one stays private.</div>}
        {canShare && teams.length === 0 && <div className="rc-small">You are not in a {core.config.terminology.team.toLowerCase()} yet, so this view stays private.</div>}
        {shared && (
          <Field label={core.config.terminology.team} htmlFor="rc-view-team">
            <Select id="rc-view-team" value={teamId} onChange={setTeamId} options={teams.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>
        )}
        <Notice>A view saves the type, search, filters, sort, grouping and columns. Sharing it does not grant access: each person still sees only the records they are allowed to see.</Notice>
      </div>
    </SidePanel>
  );
}

/* ── New record ────────────────────────────────────────────────────────── */

function NewRecordPanel({ initialType, onClose, onCreated }: { initialType: string; onClose: () => void; onCreated: (id: Id) => void }) {
  const { core, q } = useCore();
  const viewer = q.viewer;
  const types = core.config.recordTypes;
  const [typeId, setTypeId] = useState(initialType);
  const type = typeOf(core, typeId) || types[0];
  const teams = core.config.teams.filter((t) => viewer.isOrgWide || viewer.memberTeamIds.includes(t.id) || viewer.overseenTeamIds.includes(t.id));
  const [title, setTitle] = useState("");
  const [teamId, setTeamId] = useState(teams.find((t) => viewer.memberTeamIds.includes(t.id))?.id || teams[0]?.id || "");
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const values: Record<string, FieldValue> = Object.fromEntries(type.fields.map((f) => [f.key, coerce(f, raw[f.key] || "")]));
  const errs = ops.validateFields(type.fields, values);
  const T = core.config.terminology;
  const save = () => {
    setTried(true);
    if (!title.trim() || Object.keys(errs).length) return;
    const fields = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null));
    const res = store.run(ops.createRecord, type.id, title, fields, teamId || undefined);
    if (res.ok && res.id) onCreated(res.id);
  };
  const blockedSelect = type.fields.find((f) => f.required && f.kind === "select" && !f.options?.length);
  return (
    <SidePanel open onClose={onClose} title={"New " + type.label.toLowerCase()} width={520}
      footer={<><Button variant="primary" onClick={save}>Create</Button><Button variant="ghost" onClick={onClose}>Cancel</Button><span className="rc-small">Created in Pulse. No source system is changed.</span></>}>
      <div className="rc-stack" style={{ gap: 14 }}>
        {types.length > 1 && (
          <Field label="Type" htmlFor="rc-new-type">
            <Select id="rc-new-type" value={type.id} onChange={(id) => { setTypeId(id); setRaw({}); }} options={types.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>
        )}
        <Field label="Title" htmlFor="rc-new-title" error={tried && !title.trim() ? "Give it a title." : null}>
          <TextInput id="rc-new-title" value={title} onChange={setTitle} invalid={tried && !title.trim()} />
        </Field>
        {teams.length > 0 ? (
          <Field label={T.team} htmlFor="rc-new-team" help={"Visibility follows the " + type.label.toLowerCase() + " type's default."}>
            <Select id="rc-new-team" value={teamId} onChange={setTeamId} options={teams.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>
        ) : <div className="rc-small">No {T.teams.toLowerCase()} are set up yet, so the record has no {T.team.toLowerCase()}.</div>}
        {type.fields.map((def) => {
          const id = "rc-new-" + def.key;
          const showErr = tried || !!raw[def.key];
          return (
            <Field key={def.key} label={def.label + (def.required ? "" : " (optional)")} htmlFor={id} help={def.help} error={showErr ? errs[def.key] : null}>
              <FieldInput def={def} id={id} value={raw[def.key] || ""} onChange={(v) => setRaw({ ...raw, [def.key]: v })} invalid={showErr && !!errs[def.key]} />
            </Field>
          );
        })}
        {blockedSelect && <Notice tone="warn">{blockedSelect.label} is required but has no options configured, so a record cannot be saved yet. An administrator can add options in Settings.</Notice>}
      </div>
    </SidePanel>
  );
}
