/* Dashboard below the one headline KPI band. The top bar picks the view
   (v.dashArea): a configured business view or Reports. A view shows, in
   order of use: one trend, the actionable exceptions, and one like-for-like
   comparison table whose rows open the unit profile. There is no second strip
   of headline tiles: the band above is the only one. Every number opens the
   metric panel with its formula, period, coverage, freshness and exactly the
   records behind it. Saved views keep the period, compared measure, columns,
   sort and scope; sharing never widens access. */

import { useEffect, useState } from "react";
import { useCore, store, ops, can, navigate, scopeKey, scopeLabel, scopeOptions, toCsv, fmtDateTime, type DashboardDef, type MetricDef, type SavedView } from "../../core";
import { Button, Field, Notice, Segmented, SidePanel, TextInput, downloadText } from "../kit";
import { Btn, FilterChip } from "../frame";
import { CompareTable, comparisonRows, type CompRow } from "./Comparison";
import { ExceptionsCard, PeopleExceptions } from "./Exceptions";
import { AreaHeader, EmptyNote, Glass } from "./parts";
import { WeekChartCard } from "./blocks";
import { UnitProfileHost } from "./UnitProfileHost";
import { ReportsView } from "./Reports";
import { COMPARE_COLS, areaOf, areaOwner, dashStore, periodLabel, useDashCore, useDashState, viewMetrics, type CompareCol } from "./state";
import "../../styles/dashboard.css";

const PERIODS = [{ value: "", label: "Configured period" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }];

/* ── One business view ─────────────────────────────────────────────────── */

function View({ defs }: { defs: MetricDef[] }) {
  const [row, setRow] = useState<CompRow | null>(null);
  const st = useDashState();
  const trendId = st.compareMetric && defs.some((d) => d.id === st.compareMetric) ? st.compareMetric : null;
  const peopleView = defs.length > 0 && defs.every((d) => d.entity === "person" || d.id === "overdue") && defs.some((d) => d.entity === "person");
  const dataView = defs.length > 0 && defs.every((d) => d.entity === "record" || d.entity === "issue");
  return (
    <>
      <div className="db-main" style={{ marginTop: 0 }}>
        <WeekChartCard defs={defs} metricId={trendId} />
        {peopleView ? <PeopleExceptions limit={5} /> : <ExceptionsCard limit={5} kinds={dataView ? ["issue"] : undefined} title={dataView ? "Data issues to resolve" : "Exceptions"} />}
      </div>
      <div style={{ marginTop: 12 }}><CompareTable defs={defs} onRow={setRow} /></div>
      <UnitProfileHost row={row} defs={defs} onClose={() => setRow(null)} />
    </>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export function DashboardPage({ areaId, setArea }: { areaId?: string; setArea?: (id: string) => void }) {
  const { core, ctx, q, session } = useDashCore();
  const st = useDashState();
  const reports = areaId === "reports";
  const area = reports ? null : areaOf(core, areaId);
  const defs = area ? viewMetrics(core, area.metricIds) : [];
  const [panel, setPanel] = useState<"save" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* Focus hand-off: a "metric" focus opens that metric's panel. */
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "metric" && f.id) {
      dashStore.set({ metricId: f.id, metricScope: null });
      store.setSession({ focus: null });
    }
  }, [session.focus]);
  /* Leaving the page closes the metric panel, so it does not reappear on return. */
  useEffect(() => () => dashStore.set({ metricId: null, metricScope: null }), []);

  if (reports) return <div className="db-page"><ReportsView /></div>;

  if (!area) {
    return (
      <div className="db-page">
        <Glass><EmptyNote title="No dashboard views" body="An administrator can add a view and choose its measures in Settings, under role dashboards. Views whose measures all belong to a switched-off module are hidden."
          action={<Btn onClick={() => navigate({ page: "Settings", section: "layouts" })} disabled={!can(q.viewer, "settings.edit")}
            title={can(q.viewer, "settings.edit") ? undefined : "Only people who can change settings can add views"}>Open Settings</Btn>} /></Glass>
      </div>
    );
  }

  const canExport = !core.config.governance.exportRequiresPermission || can(q.viewer, "export");
  const def = defs.find((d) => d.id === st.compareMetric) || defs[0];
  const exportCsv = () => {
    if (!def) return;
    // Exactly the comparison shown: rows the viewer may see, same measure and period.
    {
      const data = comparisonRows(core, ctx, def);
      const noun = data.by === "unit" ? core.config.terminology.unit : core.config.terminology.team;
      const cols = [{ key: "row", label: noun }, { key: "actual", label: def.label }, { key: "partial", label: "Partial" }, { key: "stale", label: "Stale" }, { key: "target", label: "Target" }, { key: "freshness", label: "Last update" }];
      const rows = [...data.rows, { label: "Total, " + scopeLabel(core, ctx.scope), view: data.total }].map((r) => ({
        row: r.label, actual: r.view ? r.view.display : "", partial: r.view?.result.partial ? "yes" : "no", stale: r.view?.result.stale ? "yes" : "no",
        target: def.target ?? "", freshness: r.view?.result.freshness.at || r.view?.result.freshness.label || ""
      }));
      const res = store.run(ops.logExport, def.label + " by " + noun.toLowerCase() + ", " + scopeLabel(core, ctx.scope), rows.length);
      if (res.ok) downloadText(area.id + "-" + def.id + "-" + scopeKey(ctx.scope).replace(/[^a-z0-9]+/gi, "-") + ".csv", toCsv(cols, rows));
    }
  };
  const exportWhy = !canExport ? "Your role cannot export data." : !def ? "Nothing to export in this view." : undefined;

  return (
    <div className="db-page">
      <div className="db-toolbar">
        <FilterChip label="Reporting period" value={st.period ? String(st.period) : ""} onChange={(v) => dashStore.set({ period: v ? Number(v) : null })} options={PERIODS} />
        <SavedViewsChip setArea={setArea} onNotice={setNotice} />
        <Btn onClick={() => setPanel("save")}>Save view</Btn>
        <Btn onClick={exportCsv} disabled={!!exportWhy} title={exportWhy || "Download the comparison table as CSV"}>Export CSV</Btn>
        <span className="db-toolbar-meta">{(periodLabel(defs) + " · as of " + fmtDateTime(ctx.now, core.config.timezone)).toUpperCase()}</span>
      </div>
      {notice && <div style={{ marginBottom: 12 }}><Notice tone="warn">{notice}</Notice></div>}

      <div className="db-area" key={area.id}>
        <AreaHeader label={area.label} description={area.description} owner={areaOwner(core)} />
        {defs.length === 0
          ? <Glass><EmptyNote title="No measures in this view" body="Its measures are switched off, or belong to a module that is off. An administrator can choose measures in Settings." /></Glass>
          : <View key={area.id} defs={defs} />}
      </div>

      <SaveViewPanel open={panel === "save"} onClose={() => setPanel(null)} area={area} />
    </div>
  );
}

/* ── Saved views ───────────────────────────────────────────────────────── */

/** Views the viewer may apply: their own, and shared ones for their teams. */
function useDashViews() {
  const { core, q } = useCore();
  const me = q.viewer.person.id;
  const v = q.viewer;
  return core.data.views.filter((x) => x.page === "dashboard" && x.state.filters?.report !== "1"
    && (x.ownerId === me || (x.shared && (!x.teamId || v.isOrgWide || v.memberTeamIds.includes(x.teamId) || v.overseenTeamIds.includes(x.teamId)))));
}

/** Apply a saved view: view, period, compared measure, columns, sort, and its scope when the viewer may use it. */
export function applyDashView(view: SavedView, ctxScopeKey: string, setArea?: (id: string) => void): string | null {
  const s = view.state;
  const { core, q } = store.get();
  if (s.dashboardId && setArea) setArea(s.dashboardId);
  const cols = (s.columns || []).filter((c): c is CompareCol => (COMPARE_COLS as string[]).includes(c));
  dashStore.set({
    period: s.range ? Number(s.range) || null : null,
    compareMetric: s.filters?.metric || null,
    columns: cols.length ? cols : [...COMPARE_COLS],
    sort: s.sort && ((COMPARE_COLS as string[]).includes(s.sort.key) || s.sort.key === "row") ? { key: s.sort.key as CompareCol | "row", dir: s.sort.dir } : null
  });
  const want = s.filters?.scope;
  if (want && want !== ctxScopeKey) {
    const opt = scopeOptions(core, q.viewer).find((o) => o.key === want);
    if (opt) store.setScope(opt.sel);
    else return "This view was saved for a scope you cannot use, so it shows your current scope instead. Shared views never widen access.";
  }
  return null;
}

function SavedViewsChip({ setArea, onNotice }: { setArea?: (id: string) => void; onNotice: (n: string | null) => void }) {
  const { ctx, q } = useCore();
  const views = useDashViews();
  const [cur, setCur] = useState("");
  if (!views.length) return null;
  return (
    <FilterChip label="Saved views" value={cur} onChange={(id) => {
      setCur(id);
      const v = views.find((x) => x.id === id);
      if (v) onNotice(applyDashView(v, scopeKey(ctx.scope), setArea));
    }} options={[{ value: "", label: "Saved views" }, ...views.map((v) => ({ value: v.id, label: v.name + (v.ownerId !== q.viewer.person.id ? " (" + q.name(v.ownerId) + ")" : v.shared ? " (shared)" : "") }))]} />
  );
}

function SaveViewPanel({ open, onClose, area }: { open: boolean; onClose: () => void; area: DashboardDef }) {
  const { core, ctx, q } = useCore();
  const st = useDashState();
  const [name, setName] = useState("");
  const [shared, setShared] = useState<"private" | "shared">("private");
  const [err, setErr] = useState<string | null>(null);
  const canShare = can(q.viewer, "views.share");
  const me = q.viewer.person.id;
  const teamId = ctx.scope.kind === "team" ? ctx.scope.id : undefined;
  const views = useDashViews();
  const save = () => {
    if (!name.trim()) { setErr("Name the view."); return; }
    const res = store.run(ops.saveView, { page: "dashboard", name, shared: shared === "shared", teamId: shared === "shared" ? teamId : undefined,
      state: { dashboardId: area.id, range: st.period ? String(st.period) : undefined, columns: st.columns, sort: st.sort || undefined,
        filters: { scope: scopeKey(ctx.scope), ...(st.compareMetric ? { metric: st.compareMetric } : {}) } } });
    if (res.ok) { setName(""); setErr(null); onClose(); } else setErr(res.error);
  };
  const dLabel = (id?: string) => core.config.dashboards.find((d) => d.id === id)?.label || "Unknown view";
  return (
    <SidePanel open={open} onClose={onClose} eyebrow="Dashboard" title="Save view"
      footer={<><Button variant="primary" onClick={save}>Save view</Button><span className="pk-grow" /><Button onClick={onClose}>Cancel</Button></>}>
      <p className="pk-muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>Saves the view ({area.label}), the reporting period, the measure compared, its columns and sort, and the scope ({scopeLabel(core, ctx.scope)}). Anyone opening a shared view still sees only the rows they are allowed to see.</p>
      <Field label="Name" htmlFor="db-view-name" error={err}>
        <TextInput id="db-view-name" value={name} onChange={(v) => { setName(v); setErr(null); }} placeholder="For example, weekly review" invalid={!!err} />
      </Field>
      <div style={{ marginTop: 14 }}>
        <Field label="Who can use it" help={canShare ? (shared === "shared" ? (teamId ? "Shared with " + scopeLabel(core, ctx.scope) + "." : "Shared with people who can open dashboards.") : "Only you.") : "Your role cannot share views, so it is saved for you only."}>
          {canShare
            ? <Segmented label="Who can use it" value={shared} onChange={setShared} options={[{ value: "private", label: "Only me" }, { value: "shared", label: "Shared" }]} />
            : <Segmented label="Who can use it" value="private" onChange={() => undefined} options={[{ value: "private", label: "Only me" }]} />}
        </Field>
      </div>
      <div className="pk-section">
        <span className="pk-eyebrow" style={{ display: "block", marginBottom: 9 }}>Saved dashboard views</span>
        {views.length === 0 ? <p className="pk-muted" style={{ fontSize: 12.5, margin: 0 }}>None yet.</p> : (
          <div className="pk-list">
            {views.map((v) => (
              <div key={v.id} className="pk-li">
                <span className="pk-grow" style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: "var(--ink)" }}>{v.name}</span>
                  <span className="pk-faint" style={{ fontSize: 11.5 }}>{dLabel(v.state.dashboardId)}{v.state.range ? ", last " + v.state.range + " days" : ""}, {v.shared ? "shared by " + q.name(v.ownerId) : "only you"}</span>
                </span>
                {(v.ownerId === me || q.viewer.isOrgWide) && <Button size="sm" variant="ghost" onClick={() => store.run(ops.deleteView, v.id)}>Delete</Button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

