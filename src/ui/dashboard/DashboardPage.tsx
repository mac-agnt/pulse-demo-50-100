/* Dashboard page below the core KPI band, in the original Pulse design: a
   toolbar, the area header with its owner, metric cards with sparklines, a
   weekly column chart beside "where it came from", the comparison table and
   exceptions. The area is chosen in the top bar page switcher (v.dashArea);
   this page never draws a second area switcher. Every figure comes from the
   metric engine or from counting real objects. */

import { useEffect, useMemo, useState } from "react";
import { useCore, store, ops, can, navigate, scopeKey, scopeLabel, toCsv, fmtDateTime, type DashboardDef, type MetricDef } from "../../core";
import { Button, Field, Notice, Segmented, SidePanel, TextInput, downloadText } from "../kit";
import { Btn } from "../frame";
import { CompareTable, UnitPanel, comparisonRows, type CompRow } from "./Comparison";
import { ExceptionsCard } from "./Exceptions";
import { AreaHeader, EmptyNote, Glass } from "./parts";
import { MetricCards, WeekChartCard, WhereFrom, toPeople } from "./blocks";
import { areaOf, areaOwner, dashStore, periodLabel, viewMetrics, type MetricView } from "./state";
import { DataQualityArea } from "./DataQuality";
import { PeopleArea } from "./PeopleArea";
import "../../styles/dashboard.css";

/* ── The standard area (Overview, Delivery and any added area) ─────────── */

function StandardArea({ defs, data }: { defs: MetricDef[]; data: ReturnType<typeof comparisonRows> }) {
  const [row, setRow] = useState<CompRow | null>(null);
  const lead = defs[0];
  return (
    <>
      <MetricCards defs={defs} />
      <div className="db-main">
        <WeekChartCard defs={defs} />
        <WhereFrom def={lead} by={data.by} onRow={(r) => setRow(data.rows.find((x) => x.key === r.key) || null)} />
      </div>
      <div style={{ marginTop: 12 }}><CompareTable defs={defs} data={data} /></div>
      <div style={{ marginTop: 12 }}><ExceptionsCard /></div>
      <UnitPanel row={row} defs={defs} onClose={() => setRow(null)} />
    </>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export function DashboardPage({ areaId, setArea }: { areaId?: string; setArea?: (id: string) => void }) {
  const { core, ctx, q, session } = useCore();
  const area = areaOf(core, areaId);
  const defs = area ? viewMetrics(core, area.metricIds) : [];
  const data = useMemo(() => comparisonRows(core, ctx, defs), [core, ctx, area?.id, defs.length]);
  const [panel, setPanel] = useState<"save" | "schedule" | null>(null);

  /* Focus hand-off: a "metric" focus opens that metric's panel. */
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "metric" && f.id) {
      dashStore.set({ metricId: f.id });
      store.setSession({ focus: null });
    }
  }, [session.focus]);
  /* Leaving the page closes the metric panel, so it does not reappear on return. */
  useEffect(() => () => dashStore.set({ metricId: null }), []);

  if (!area) {
    return (
      <div className="db-page">
        <Glass><EmptyNote title="No dashboard areas" body="An administrator can add an area and choose its measures in Settings, under role dashboards."
          action={<Btn onClick={() => navigate({ page: "Settings", section: "layouts" })} disabled={!can(q.viewer, "settings.edit")}
            title={can(q.viewer, "settings.edit") ? undefined : "Only people who can change settings can add areas"}>Open Settings</Btn>} /></Glass>
      </div>
    );
  }

  const canExport = !core.config.governance.exportRequiresPermission || can(q.viewer, "export");
  const scheduleOn = core.config.capabilities.reportSchedules;
  const canSchedule = can(q.viewer, "export");
  const canSettings = can(q.viewer, "settings.edit");
  const noun = data.by === "unit" ? core.config.terminology.unit : core.config.terminology.team;

  const exportCsv = () => {
    const cols = [{ key: "row", label: noun }, ...defs.flatMap((d) => [{ key: d.id, label: d.label }, { key: d.id + ":p", label: d.label + " partial" }])];
    const toRow = (label: string, cells: Record<string, MetricView | null>) => {
      const out: Record<string, unknown> = { row: label };
      for (const d of defs) {
        const v = cells[d.id];
        out[d.id] = v ? v.display : "";
        out[d.id + ":p"] = v?.result.partial ? "yes" : "no";
      }
      return out;
    };
    const rows = [...data.rows.map((r) => toRow(r.label, r.cells)), toRow("Total, " + scopeLabel(core, ctx.scope) + " (from underlying totals)", data.totals)];
    const res = store.run(ops.logExport, area.label + " by " + noun.toLowerCase() + ", " + scopeLabel(core, ctx.scope), rows.length);
    if (res.ok) downloadText(area.id + "-" + scopeKey(ctx.scope).replace(/[^a-z0-9]+/gi, "-") + ".csv", toCsv(cols, rows));
  };
  const exportWhy = !canExport ? "Your role cannot export data." : data.rows.length === 0 ? "Nothing to export in this scope." : undefined;
  const scheduleWhy = !scheduleOn ? "Report schedules are turned off in Settings." : !canSchedule ? "Your role cannot schedule reports." : undefined;

  return (
    <div className="db-page">
      <div className="db-toolbar">
        <Btn onClick={() => setPanel("save")}>Save view</Btn>
        <Btn onClick={exportCsv} disabled={!!exportWhy} title={exportWhy || "Download the comparison table as CSV"}>Export CSV</Btn>
        <Btn onClick={() => setPanel("schedule")} disabled={!!scheduleWhy} title={scheduleWhy}>Schedule report</Btn>
        {area.id === "people" && <Btn onClick={toPeople}>Open Work, People</Btn>}
        <button type="button" className="ixe db-add" onClick={() => navigate({ page: "Settings", section: "layouts" })} disabled={!canSettings}
          title={canSettings ? "Add an area and choose its measures in Settings" : "Only people who can change settings can add areas"}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14 M5 12h14" /></svg>
          Add area
        </button>
        <span className="db-toolbar-meta">{(periodLabel(defs) + " · as of " + fmtDateTime(ctx.now, core.config.timezone)).toUpperCase()}</span>
      </div>

      <div className="db-area" key={area.id}>
        <AreaHeader label={area.label} description={area.description} owner={areaOwner(core)} />
        {area.id === "data" ? <DataQualityArea defs={defs} data={data} />
          : area.id === "people" ? <PeopleArea defs={defs} data={data} />
          : <StandardArea defs={defs} data={data} />}
      </div>

      <SaveViewPanel open={panel === "save"} onClose={() => setPanel(null)} area={area} setArea={setArea} />
      <SchedulePanel open={panel === "schedule"} onClose={() => setPanel(null)} dashboardId={area.id} />
    </div>
  );
}

/* ── Save view and schedule panels (functional, unchanged behaviour) ───── */

function SaveViewPanel({ open, onClose, area, setArea }: { open: boolean; onClose: () => void; area: DashboardDef; setArea?: (id: string) => void }) {
  const { core, ctx, q } = useCore();
  const [name, setName] = useState("");
  const [shared, setShared] = useState<"private" | "shared">("private");
  const [err, setErr] = useState<string | null>(null);
  const canShare = can(q.viewer, "views.share");
  const me = q.viewer.person.id;
  const teamId = ctx.scope.kind === "team" ? ctx.scope.id : undefined;
  const views = core.data.views.filter((v) => v.page === "dashboard" && (v.ownerId === me || v.shared));
  const save = () => {
    if (!name.trim()) { setErr("Name the view."); return; }
    const res = store.run(ops.saveView, { page: "dashboard", name, shared: shared === "shared", teamId: shared === "shared" ? teamId : undefined, state: { dashboardId: area.id } });
    if (res.ok) { setName(""); setErr(null); onClose(); } else setErr(res.error);
  };
  const dLabel = (id?: string) => core.config.dashboards.find((d) => d.id === id)?.label || "Unknown area";
  return (
    <SidePanel open={open} onClose={onClose} eyebrow="Dashboard" title="Save view"
      footer={<><Button variant="primary" onClick={save}>Save view</Button><span className="pk-grow" /><Button onClick={onClose}>Cancel</Button></>}>
      <p className="pk-muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>Saves which area is shown ({area.label}). Anyone opening a shared view still sees only the rows they are allowed to see.</p>
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
            {views.map((v) => {
              const exists = core.config.dashboards.some((d) => d.id === v.state.dashboardId);
              return (
                <div key={v.id} className="pk-li">
                  <span className="pk-grow" style={{ minWidth: 0 }}>
                    <span style={{ display: "block", color: "var(--ink)" }}>{v.name}</span>
                    <span className="pk-faint" style={{ fontSize: 11.5 }}>{dLabel(v.state.dashboardId)}, {v.shared ? "shared by " + q.name(v.ownerId) : "only you"}</span>
                  </span>
                  <Button size="sm" disabled={!exists || !setArea} title={exists ? undefined : "That area no longer exists"}
                    onClick={() => { if (v.state.dashboardId && setArea) setArea(v.state.dashboardId); onClose(); }}>Apply</Button>
                  {(v.ownerId === me || q.viewer.isOrgWide) && <Button size="sm" variant="ghost" onClick={() => store.run(ops.deleteView, v.id)}>Delete</Button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

function SchedulePanel({ open, onClose, dashboardId }: { open: boolean; onClose: () => void; dashboardId: string }) {
  const { core, session, q } = useCore();
  const [cadence, setCadence] = useState("Every Monday at 08:00");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const eligible = ops.eligibleRecipients(core, scopeKey(session.scope));
  const tz = core.config.timezone;
  const dLabel = (id: string) => core.config.dashboards.find((d) => d.id === id)?.label || "Unknown area";
  const save = () => {
    if (!cadence.trim()) { setErr("Describe when it should go out."); return; }
    const res = store.run(ops.createReportSchedule, dashboardId, cadence.trim(), picked);
    if (res.ok) { setPicked([]); setErr(null); onClose(); } else setErr(res.error);
  };
  return (
    <SidePanel open={open} onClose={onClose} eyebrow="Dashboard" title={"Schedule a report: " + dLabel(dashboardId)}
      footer={<><Button variant="primary" onClick={save} disabled={!picked.length} title={picked.length ? undefined : "Pick at least one recipient"}>Save schedule</Button><span className="pk-grow" /><Button onClick={onClose}>Cancel</Button></>}>
      <Notice tone="warn">No scheduler or email connection is configured. The schedule is saved as a sample so you can review it, and nothing will be sent.</Notice>
      <div style={{ marginTop: 14 }}>
        <Field label="When" htmlFor="db-cadence" help={"Plain description, for example Every Monday at 08:00 (" + tz + ")."} error={err}>
          <TextInput id="db-cadence" value={cadence} onChange={(v) => { setCadence(v); setErr(null); }} invalid={!!err} />
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
      <div className="pk-section">
        <span className="pk-eyebrow" style={{ display: "block", marginBottom: 9 }}>Existing schedules ({core.data.reportSchedules.length})</span>
        {core.data.reportSchedules.length === 0 ? <p className="pk-muted" style={{ fontSize: 12.5, margin: 0 }}>None yet.</p> : (
          <div className="pk-list">
            {core.data.reportSchedules.map((r) => (
              <div key={r.id} className="pk-li" style={{ alignItems: "flex-start" }}>
                <span className="pk-grow" style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: "var(--ink)" }}>{r.label}</span>
                  <span className="pk-muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>{r.cadence}. To {r.recipientIds.map((id) => q.name(id)).join(", ")}.</span>
                  <span className="pk-faint" style={{ display: "block", fontSize: 11.5, marginTop: 2 }}>Set up by {q.name(r.createdBy)}, {fmtDateTime(r.createdAt, tz)}. Sample only, not sent.</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
}
