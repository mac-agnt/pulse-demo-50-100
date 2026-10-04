/* Dashboard > Reports. Build a report from a dashboard view's measures for
   the selected scope and period, preview it, export it as a local CSV of the
   rows you are allowed to see, and save it as a report definition. Report
   schedules are labelled simulated: there is no scheduler or email
   connection, so nothing is ever sent. */

import { useState } from "react";
import { useCore, store, ops, can, scopeKey, scopeLabel, scopeOptions, toCsv, fmtDateTime, dashboardVisible, type SavedView } from "../../core";
import { Button, Field, Notice, Segmented, SidePanel, TextInput, downloadText } from "../kit";
import { Btn, FilterChip } from "../frame";
import { CardHead, EmptyNote, Flag, Glass, GridTable } from "./parts";
import { comparisonRows } from "./Comparison";
import { metricView, useDashCore, viewMetrics, withPeriod } from "./state";

const PERIODS = [{ value: "", label: "Configured period" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }];

export function ReportsView() {
  const { core: base, ctx, q } = useCore();
  const views = base.config.dashboards.filter((d) => dashboardVisible(base.config, d));
  const [viewId, setViewId] = useState(views[0]?.id || "");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const core = withPeriod(base, period ? Number(period) : null);
  const view = views.find((d) => d.id === viewId) || views[0];
  const defs = view ? viewMetrics(core, view.metricIds) : [];
  const data = defs[0] ? comparisonRows(core, ctx, defs[0]) : null;
  const noun = data?.by === "unit" ? core.config.terminology.unit : core.config.terminology.team;
  const me = q.viewer.person.id;
  const canExport = !core.config.governance.exportRequiresPermission || can(q.viewer, "export");
  const scheduleOn = core.config.capabilities.reportSchedules;
  const defsSaved = core.data.views.filter((x) => x.page === "dashboard" && x.state.filters?.report === "1"
    && (x.ownerId === me || (x.shared && (!x.teamId || q.viewer.isOrgWide || q.viewer.memberTeamIds.includes(x.teamId) || q.viewer.overseenTeamIds.includes(x.teamId)))));

  /* Every cell is the metric engine's figure for that row's own scope. */
  const table = (data?.rows || []).map((r) => ({ label: r.label, cells: defs.map((d) => metricView(core, { ...ctx, scope: r.scope }, d.id)) }));
  const totals = defs.map((d) => metricView(core, ctx, d.id));

  const exportCsv = () => {
    if (!view) return;
    const cols = [{ key: "row", label: noun }, ...defs.flatMap((d) => [{ key: d.id, label: d.label }, { key: d.id + ":flag", label: d.label + " (partial or stale)" }])];
    const rows = [...table, { label: "Total, " + scopeLabel(core, ctx.scope), cells: totals }].map((r) => {
      const out: Record<string, unknown> = { row: r.label };
      defs.forEach((d, i) => { const v = r.cells[i]; out[d.id] = v ? v.display : ""; out[d.id + ":flag"] = v?.result.partial ? "partial" : v?.result.stale ? "stale" : ""; });
      return out;
    });
    const res = store.run(ops.logExport, "Report: " + view.label + ", " + scopeLabel(core, ctx.scope) + (period ? ", last " + period + " days" : ""), rows.length);
    if (res.ok) downloadText("report-" + view.id + "-" + scopeKey(ctx.scope).replace(/[^a-z0-9]+/gi, "-") + ".csv", toCsv(cols, rows));
  };
  const applyDef = (v: SavedView) => {
    if (v.state.dashboardId && views.some((d) => d.id === v.state.dashboardId)) setViewId(v.state.dashboardId);
    setPeriod(v.state.range || "");
    const want = v.state.filters?.scope;
    if (want && want !== scopeKey(ctx.scope)) {
      const opt = scopeOptions(base, q.viewer).find((o) => o.key === want);
      if (opt) { store.setScope(opt.sel); setNotice(null); }
      else setNotice("This definition was saved for a scope you cannot use, so it runs on your current scope. Shared definitions never widen access.");
    } else setNotice(null);
  };

  return (
    <>
      <div className="db-toolbar">
        <FilterChip label="View" value={view?.id || ""} onChange={setViewId} options={views.map((d) => ({ value: d.id, label: d.label }))} />
        <FilterChip label="Reporting period" value={period} onChange={setPeriod} options={PERIODS} />
        <Btn primary onClick={exportCsv} disabled={!canExport || !view || !defs.length} title={!canExport ? "Your role cannot export data." : "Download these rows as CSV. Only rows you can see are included."}>Export CSV</Btn>
        <Btn onClick={() => setSaving(true)} disabled={!view}>Save report definition</Btn>
        <Btn onClick={() => setScheduling(true)} disabled={!scheduleOn || !can(q.viewer, "export")}
          title={!scheduleOn ? "Report schedules are turned off in Settings." : !can(q.viewer, "export") ? "Your role cannot schedule reports." : "Saved as a simulated schedule. Nothing is sent."}>Schedule (simulated)</Btn>
        <span className="db-toolbar-meta">{(scopeLabel(core, ctx.scope) + " · as of " + fmtDateTime(ctx.now, core.config.timezone)).toUpperCase()}</span>
      </div>
      {notice && <div style={{ marginBottom: 12 }}><Notice tone="warn">{notice}</Notice></div>}

      <Glass style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 12px" }}><CardHead title={view ? view.label + " report" : "Report"} unit={noun.toUpperCase() + " · " + scopeLabel(core, ctx.scope).toUpperCase()} /></div>
        {!view || !defs.length ? <EmptyNote title="Nothing to report" body="Choose a view with measures. Views are configured in Settings, under role dashboards." />
          : !table.length ? <EmptyNote title={"No " + noun.toLowerCase() + " rows in this scope"} body="Pick a wider scope in the top bar to compare. The totals below still apply." /> : null}
        {view && defs.length > 0 && (
          <GridTable caption={view.label + " report"} template={"minmax(150px,1.4fr) " + defs.map(() => "minmax(110px,.9fr)").join(" ")} minWidth={150 + defs.length * 120}
            cols={[noun, ...defs.map((d) => d.label)]}
            rows={[
              ...table.map((r) => ({ key: r.label, cells: [<span style={{ color: "var(--ink)" }}>{r.label}</span>, ...r.cells.map((v, i) => <Cell key={i} v={v} />)] })),
              { key: "total", total: true, cells: [<span style={{ color: "var(--ink)", fontWeight: 500 }}>Total, {scopeLabel(core, ctx.scope)}</span>, ...totals.map((v, i) => <Cell key={i} v={v} />)] }
            ]} />
        )}
        <div className="db-foot-note">Every figure comes from the metric engine for that row's own scope; totals come from the scope's own totals. The export holds exactly these rows, and only rows you are allowed to see.</div>
      </Glass>

      <div className="db-main" style={{ marginTop: 12 }}>
        <Glass>
          <CardHead title="Saved report definitions" unit={String(defsSaved.length)} />
          {defsSaved.length === 0 ? <EmptyNote title="None saved yet" body="Save the view, period and scope above as a definition to run it again later." /> : (
            <div className="pk-list" style={{ marginTop: 10 }}>
              {defsSaved.map((v) => (
                <div key={v.id} className="pk-li">
                  <span className="pk-grow" style={{ minWidth: 0 }}>
                    <span style={{ display: "block", color: "var(--ink)" }}>{v.name}</span>
                    <span className="pk-faint" style={{ fontSize: 11.5 }}>{core.config.dashboards.find((d) => d.id === v.state.dashboardId)?.label || "Unknown view"}{v.state.range ? ", last " + v.state.range + " days" : ""}, {v.shared ? "shared by " + q.name(v.ownerId) : "only you"}</span>
                  </span>
                  <Button size="sm" onClick={() => applyDef(v)}>Load</Button>
                  {(v.ownerId === me || q.viewer.isOrgWide) && <Button size="sm" variant="ghost" onClick={() => store.run(ops.deleteView, v.id)}>Delete</Button>}
                </div>
              ))}
            </div>
          )}
        </Glass>
        <Glass>
          <CardHead title="Report schedules" unit="SIMULATED" />
          <p className="pk-muted" style={{ fontSize: 12.5, margin: "10px 0" }}>No scheduler or email connection is configured. Schedules are kept as sample definitions so they can be reviewed; nothing is generated or sent.</p>
          {core.data.reportSchedules.length === 0 ? <p className="pk-faint" style={{ fontSize: 12.5, margin: 0 }}>None yet.</p> : (
            <div className="pk-list">
              {core.data.reportSchedules.map((r) => (
                <div key={r.id} className="pk-li" style={{ alignItems: "flex-start" }}>
                  <span className="pk-grow" style={{ minWidth: 0 }}>
                    <span style={{ display: "block", color: "var(--ink)" }}>{r.label}</span>
                    <span className="pk-muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>{r.cadence}. To {r.recipientIds.map((id) => q.name(id)).join(", ") || "nobody"}. Simulated, not sent.</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Glass>
      </div>

      {saving && view && <SaveDefinition viewId={view.id} period={period} onClose={() => setSaving(false)} />}
      {scheduling && view && <SchedulePanel dashboardId={view.id} onClose={() => setScheduling(false)} />}
    </>
  );
}

function Cell({ v }: { v: ReturnType<typeof metricView> }) {
  if (!v) return <span style={{ color: "var(--faint)" }}>None</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={v.explanation || undefined}>
      <span style={{ color: v.noData ? "var(--faint)" : "var(--ink)" }}>{v.display}</span>
      {v.result.partial && <Flag title="Some contributors could not be counted">Partial</Flag>}
      {v.result.stale && !v.result.partial && <Flag title="Some source data is older than 24 hours">Stale</Flag>}
    </span>
  );
}

function SaveDefinition({ viewId, period, onClose }: { viewId: string; period: string; onClose: () => void }) {
  const { core, ctx, q } = useDashCore();
  const [name, setName] = useState("");
  const [shared, setShared] = useState<"private" | "shared">("private");
  const [err, setErr] = useState<string | null>(null);
  const canShare = can(q.viewer, "views.share");
  const teamId = ctx.scope.kind === "team" ? ctx.scope.id : undefined;
  const save = () => {
    if (!name.trim()) { setErr("Name the report."); return; }
    const res = store.run(ops.saveView, { page: "dashboard", name, shared: shared === "shared", teamId: shared === "shared" ? teamId : undefined,
      state: { dashboardId: viewId, range: period || undefined, filters: { report: "1", scope: scopeKey(ctx.scope) } } });
    if (res.ok) onClose(); else setErr(res.error);
  };
  return (
    <SidePanel open onClose={onClose} eyebrow="Reports" title="Save report definition" width={480}
      footer={<><Button variant="primary" onClick={save}>Save</Button><span className="pk-grow" /><Button onClick={onClose}>Cancel</Button></>}>
      <p className="pk-muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>Saves the view, the reporting period and the scope ({scopeLabel(core, ctx.scope)}). Running a shared definition shows each person only the rows they are allowed to see.</p>
      <Field label="Name" htmlFor="rp-name" error={err}><TextInput id="rp-name" value={name} onChange={(v) => { setName(v); setErr(null); }} placeholder="For example, monthly review" invalid={!!err} /></Field>
      <div style={{ marginTop: 14 }}>
        <Field label="Who can use it" help={canShare ? undefined : "Your role cannot share, so it is saved for you only."}>
          {canShare
            ? <Segmented label="Who can use it" value={shared} onChange={setShared} options={[{ value: "private", label: "Only me" }, { value: "shared", label: "Shared" }]} />
            : <Segmented label="Who can use it" value="private" onChange={() => undefined} options={[{ value: "private", label: "Only me" }]} />}
        </Field>
      </div>
    </SidePanel>
  );
}

function SchedulePanel({ dashboardId, onClose }: { dashboardId: string; onClose: () => void }) {
  const { core, session } = useCore();
  const [cadence, setCadence] = useState("Every Monday at 08:00");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const eligible = ops.eligibleRecipients(core, scopeKey(session.scope));
  const label = core.config.dashboards.find((d) => d.id === dashboardId)?.label || "Unknown view";
  const save = () => {
    if (!cadence.trim()) { setErr("Describe when it should go out."); return; }
    const res = store.run(ops.createReportSchedule, dashboardId, cadence.trim(), picked);
    if (res.ok) onClose(); else setErr(res.error);
  };
  return (
    <SidePanel open onClose={onClose} eyebrow="Reports" title={"Schedule (simulated): " + label}
      footer={<><Button variant="primary" onClick={save} disabled={!picked.length} title={picked.length ? undefined : "Pick at least one recipient"}>Save simulated schedule</Button><span className="pk-grow" /><Button onClick={onClose}>Cancel</Button></>}>
      <Notice tone="warn">No scheduler or email connection is configured. The schedule is saved as a sample so you can review it. Nothing will be generated or sent.</Notice>
      <div style={{ marginTop: 14 }}>
        <Field label="When" htmlFor="rp-cadence" help={"Plain description, for example Every Monday at 08:00 (" + core.config.timezone + ")."} error={err}>
          <TextInput id="rp-cadence" value={cadence} onChange={(v) => { setCadence(v); setErr(null); }} invalid={!!err} />
        </Field>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
        <legend className="pk-label" style={{ padding: 0, marginBottom: 6 }}>Recipients ({picked.length} selected)</legend>
        <p className="pk-help" style={{ margin: "0 0 8px" }}>Only active staff who can see {scopeLabel(core, session.scope)} are listed.</p>
        {eligible.length === 0 ? <p className="pk-muted" style={{ fontSize: 12.5 }}>Nobody else can see this scope.</p> : (
          <div className="pk-list">
            {eligible.map((p) => (
              <label key={p.id} className="pk-li" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])} />
                <span className="pk-grow">{p.name}</span>
                <span className="pk-faint" style={{ fontSize: 11.5 }}>{p.title}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </SidePanel>
  );
}
