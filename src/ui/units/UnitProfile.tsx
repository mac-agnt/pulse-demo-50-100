/* Reusable profile for a configured unit, team or location, opened as a side
   panel from comparison rows and record links:

     <UnitProfilePanel target={{ kind: "unit", id: "u-north" }} onClose={...} />

   Sections (shown when they apply): Overview / Performance / Work / Projects /
   People / Files / Activity. Every figure comes from the shared query layer
   with the scope set to this unit or team, so it matches the Dashboard.
   Performance is like-for-like only: the same measure and the same period for
   this unit and its comparable siblings, side by side, with no ranking. */

import { useState, type ReactNode } from "react";
import {
  computeMetric, moduleEnabled, ms, openObject, personRows, projectHealth, projectsFor, projectTerms, query, useCore,
  type Ctx, type Id, type MetricResult, type ScopeSel
} from "../../core";
import { Chip, Empty, KV, NoAccess, PersonName, SidePanel, Tabs, LABEL, toneOf } from "../kit";
import { HealthChip } from "../projects/shared";
import "../../styles/projects.css";

export interface UnitTarget { kind: "unit" | "team" | "location"; id: Id }

type Section = "overview" | "performance" | "work" | "projects" | "people" | "files" | "activity";

export function UnitProfilePanel({ target, onClose }: { target: UnitTarget; onClose: () => void }) {
  const { core, ctx } = useCore();
  const c = core.config;
  const T = c.terminology;
  const unit = target.kind === "unit" ? c.units.find((u) => u.id === target.id) : undefined;
  const team = target.kind === "team" ? c.teams.find((t) => t.id === target.id) : undefined;
  const loc = target.kind === "location" ? c.locations.find((l) => l.id === target.id) : undefined;
  const label = unit?.label || team?.label || loc?.label;
  const kindLabel = target.kind === "unit" ? T.unit : target.kind === "team" ? T.team : "Location";
  const [tab, setTab] = useState<Section>("overview");

  if (!label) return <SidePanel open onClose={onClose} title={kindLabel}><Empty title="Not found" body={"This " + kindLabel.toLowerCase() + " is no longer configured."} /></SidePanel>;

  /* The scope this profile measures. Locations are measured through their unit only where noted. */
  const scope: ScopeSel | null = target.kind === "unit" ? { kind: "unit", id: target.id } : target.kind === "team" ? { kind: "team", id: target.id } : null;
  const v = query(core, ctx).viewer;
  const unitOfTarget = unit?.id || team?.unitId || loc?.unitId;
  const allowed = v.isOrgWide
    || (target.kind === "team" && (v.overseenTeamIds.includes(target.id) || v.memberTeamIds.includes(target.id)))
    || (!!unitOfTarget && (v.overseenUnitIds.includes(unitOfTarget) || v.memberTeamIds.some((t) => c.teams.find((x) => x.id === t)?.unitId === unitOfTarget)));
  if (!allowed) return <SidePanel open onClose={onClose} title={label} eyebrow={kindLabel.toUpperCase()}><NoAccess what={"this " + kindLabel.toLowerCase() + ". You are not a member and do not manage it"} /></SidePanel>;

  const sctx: Ctx | null = scope ? { ...ctx, scope } : null;
  const q = sctx ? query(core, sctx) : query(core, { ...ctx, scope: { kind: "organisation" } });
  const projectsOn = moduleEnabled(c, "projects");
  const peopleOn = moduleEnabled(c, "people");
  /* Projects that belong here, plus shared (organisation-wide) ones only where this unit or team has work on them. */
  const teamIdsHere = target.kind === "team" ? [target.id] : target.kind === "unit" ? c.teams.filter((t) => t.unitId === target.id).map((t) => t.id) : [];
  const belongsHere = (p: { teamId?: Id; unitId?: Id }) => target.kind === "team" ? p.teamId === target.id
    : target.kind === "unit" ? (p.unitId || c.teams.find((t) => t.id === p.teamId)?.unitId) === target.id : false;
  const projects = !projectsOn ? [] : target.kind === "location" ? projectsFor(q, { ignoreScope: true }).filter((p) => p.locationId === target.id)
    : projectsFor(q).filter((p) => belongsHere(p) || core.data.tasks.some((t) => t.projectId === p.id && !!t.teamId && teamIdsHere.includes(t.teamId)));
  const tabs: { value: Section; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    ...(sctx ? [{ value: "performance" as const, label: "Performance" }, { value: "work" as const, label: "Work" }] : []),
    ...(projectsOn && (projects.length || target.kind !== "location") ? [{ value: "projects" as const, label: projectTerms(c).many, count: projects.length }] : []),
    ...(sctx && peopleOn ? [{ value: "people" as const, label: "People" }] : []),
    ...(sctx && c.capabilities.files ? [{ value: "files" as const, label: "Files" }] : []),
    ...(sctx ? [{ value: "activity" as const, label: "Activity" }] : [])
  ];
  const cur = tabs.some((t) => t.value === tab) ? tab : "overview";
  const owner = unit?.ownerId || team?.ownerId || (loc?.unitId ? c.units.find((u) => u.id === loc.unitId)?.ownerId : undefined);

  return (
    <SidePanel open onClose={onClose} title={label} eyebrow={kindLabel.toUpperCase() + (unit?.status === "planned" ? " · PLANNED" : "")} width={760}
      chips={unit?.group ? <Chip tone="neutral">{unit.group}</Chip> : undefined}>
      <Tabs tabs={tabs} value={cur} onChange={setTab} />
      <div style={{ paddingTop: 14 }}>
        {cur === "overview" && <Overview target={target} q={q} owner={owner} projects={projects.length} hasScope={!!sctx} />}
        {cur === "performance" && sctx && <Performance target={target} sctx={sctx} />}
        {cur === "work" && sctx && <Work q={q} />}
        {cur === "projects" && <Projects list={projects} own={(p) => target.kind === "location" || belongsHere(p)} />}
        {cur === "people" && sctx && <People q={q} />}
        {cur === "files" && sctx && <Files q={q} />}
        {cur === "activity" && sctx && <Activity q={q} />}
      </div>
    </SidePanel>
  );
}

type QQ = ReturnType<typeof query>;

function Overview({ target, q, owner, projects, hasScope }: { target: UnitTarget; q: QQ; owner?: Id; projects: number; hasScope: boolean }) {
  const { core } = useCore();
  const c = core.config;
  const T = c.terminology;
  const unit = target.kind === "unit" ? c.units.find((u) => u.id === target.id) : undefined;
  const team = target.kind === "team" ? c.teams.find((t) => t.id === target.id) : undefined;
  const loc = target.kind === "location" ? c.locations.find((l) => l.id === target.id) : undefined;
  const tasks = hasScope ? q.tasks().filter((t) => q.isOpenTask(t)) : [];
  const overdue = tasks.filter((t) => q.isOverdue(t));
  const issues = hasScope ? q.issues().filter((i) => i.state === "open" || i.state === "in_progress") : [];
  const pending = hasScope ? q.approvals().filter((a) => a.status === "pending") : [];
  const people = hasScope && moduleEnabled(c, "people") ? personRows(q) : [];
  const items: [string, ReactNode][] = [["Accountable owner", owner ? <PersonName id={owner} /> : "Not set"]];
  if (unit) {
    items.push([T.teams, c.teams.filter((t) => t.unitId === unit.id).map((t) => t.label).join(", ") || "None"]);
    if (unit.location) items.push(["Location", unit.location]);
    items.push(["Status", unit.status === "planned" ? "Planned, no work yet" : "Operating"]);
  }
  if (team) items.push([T.unit, q.unitLabel(team.unitId) || "None"]);
  if (loc) { items.push([T.unit, q.unitLabel(loc.unitId) || "None"]); if (loc.address) items.push(["Address", loc.address]); }
  if (hasScope) {
    items.push(["Open " + T.tasks.toLowerCase(), String(tasks.length)], ["Overdue", String(overdue.length)], ["Decisions waiting", String(pending.length)], ["Open data issues", String(issues.length)]);
    if (people.length) items.push(["People", String(people.length)]);
  }
  if (moduleEnabled(c, "projects")) items.push([projectTerms(c).many, String(projects)]);
  return (
    <>
      <KV items={items} />
      {hasScope && overdue.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="pk-eyebrow">Needs attention</div>
          <div className="pk-list" style={{ marginTop: 8 }}>
            {overdue.slice(0, 5).map((t) => (
              <button key={t.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("task", t.id)}>
                <span className="pk-grow">{t.title}</span><span className="pj-faint">{q.name(t.assigneeId)}</span><Chip tone="bad">Overdue</Chip>
              </button>
            ))}
          </div>
        </div>
      )}
      {target.kind === "location" && <p className="pj-faint" style={{ marginTop: 12 }}>Work, people and measures are kept per {T.unit.toLowerCase()} and {T.team.toLowerCase()}, not per location, so this profile shows what is linked to the location directly.</p>}
    </>
  );
}

function Performance({ target, sctx }: { target: UnitTarget; sctx: Ctx }) {
  const { core, ctx } = useCore();
  const c = core.config;
  const v = query(core, ctx).viewer;
  const defs = c.metrics.filter((m) => m.enabled && (m.entity !== "project" || moduleEnabled(c, "projects")) && (m.entity !== "invoice" || moduleEnabled(c, "purchasing"))
    && (m.entity !== "requirement" || moduleEnabled(c, "standards")) && (m.entity !== "person" || moduleEnabled(c, "people")));
  /* Comparable siblings: the same kind, same parent, operating, and visible to the viewer. */
  const siblings: { id: Id; label: string; scope: ScopeSel }[] = target.kind === "unit"
    ? c.units.filter((u) => u.id !== target.id && u.status !== "planned" && (v.isOrgWide || v.overseenUnitIds.includes(u.id))).map((u) => ({ id: u.id, label: u.label, scope: { kind: "unit", id: u.id } as ScopeSel }))
    : c.teams.filter((t) => t.id !== target.id && t.unitId === c.teams.find((x) => x.id === target.id)?.unitId && (v.isOrgWide || v.overseenTeamIds.includes(t.id) || v.memberTeamIds.includes(t.id)))
      .map((t) => ({ id: t.id, label: t.label, scope: { kind: "team", id: t.id } as ScopeSel }));
  const planned = target.kind === "unit" && c.units.find((u) => u.id === target.id)?.status === "planned";
  const cell = (r: MetricResult | null) => {
    if (!r) return <span className="pj-faint">None</span>;
    const noBasis = r.value === null;
    return (
      <span title={r.notes.join(" ") || undefined}>
        {noBasis ? <span className="pj-faint">No data</span> : r.display}
        {r.partial && <> <Chip tone="warn" title={r.missing.map((m) => m.label + ": " + m.reason).join(" ")}>Partial</Chip></>}
        {r.stale && !r.partial && <> <Chip tone="warn">Stale</Chip></>}
      </span>
    );
  };
  if (!defs.length) return <Empty title="No measures configured" body="Measures are set up in Settings, Systems, Metric definitions." />;
  const self = c.units.find((u) => u.id === target.id)?.label || c.teams.find((t) => t.id === target.id)?.label;
  return (
    <>
      {planned && <p className="pj-faint">This {c.terminology.unit.toLowerCase()} is planned and holds no work yet, so its measures have no data.</p>}
      <div className="up-wrap">
        <table className="up-metrics">
          <thead>
            <tr><th>Measure</th><th>Period</th><th>{self}</th>{siblings.map((s) => <th key={s.id}>{s.label}</th>)}<th>Target</th></tr>
          </thead>
          <tbody>
            {defs.map((d) => {
              const r = computeMetric(core, sctx, d.id);
              return (
                <tr key={d.id}>
                  <td title={d.formula}>{d.label}</td>
                  <td className="pj-faint">{d.periodDays ? "Last " + d.periodDays + " days" : "Now"}</td>
                  <td className="up-this">{cell(r)}{r && r.delta !== null && r.previous && <div className="pj-faint">was {r.previous.display}</div>}</td>
                  {siblings.map((s) => <td key={s.id} className="up-other">{cell(computeMetric(core, { ...ctx, scope: s.scope }, d.id))}</td>)}
                  <td className="pj-faint">{d.target !== undefined ? (d.unit === "percent" ? d.target + "%" : String(d.target)) : "None"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pj-faint" style={{ marginTop: 10 }}>
        Each column is computed from that {target.kind === "unit" ? c.terminology.unit.toLowerCase() : c.terminology.team.toLowerCase()}'s own records over the same period. Columns are not ranked; ratios come from totals, and missing data shows as No data, never zero.
        {siblings.length === 0 ? " There is no comparable " + (target.kind === "unit" ? c.terminology.unit.toLowerCase() : c.terminology.team.toLowerCase()) + " you can see." : ""}
      </p>
    </>
  );
}

function Work({ q }: { q: QQ }) {
  const { core } = useCore();
  const tz = core.config.timezone;
  const day = (at?: string) => (at ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(at)) : "No date");
  const tasks = q.tasks().filter((t) => q.isOpenTask(t)).sort((a, b) => (q.isOverdue(b) ? 1 : 0) - (q.isOverdue(a) ? 1 : 0) || (a.dueAt ? ms(a.dueAt) : Infinity) - (b.dueAt ? ms(b.dueAt) : Infinity));
  const reqs = q.requests().filter((r) => r.status === "submitted" || r.status === "changes_requested");
  const issues = q.issues().filter((i) => i.state === "open" || i.state === "in_progress");
  const list = (title: string, n: number, rows: ReactNode, empty: string) => (
    <div style={{ marginBottom: 16 }}>
      <div className="pk-eyebrow">{title} · {n}</div>
      {n === 0 ? <div className="pj-faint" style={{ marginTop: 6 }}>{empty}</div> : <div className="pk-list" style={{ marginTop: 8 }}>{rows}</div>}
    </div>
  );
  return (
    <>
      {list("Open tasks", tasks.length, tasks.slice(0, 8).map((t) => (
        <button key={t.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("task", t.id)}>
          <span className="pk-grow">{t.title}</span><span className="pj-faint">{q.name(t.assigneeId)}</span>
          <span className="pj-faint pj-mono" style={{ color: q.isOverdue(t) ? "var(--bad)" : undefined }}>{day(t.dueAt)}</span>
          <Chip tone={toneOf.task(t.status, q.isOverdue(t))}>{q.isOverdue(t) ? "Overdue" : LABEL.task[t.status]}</Chip>
        </button>
      )), "Nothing open.")}
      {tasks.length > 8 && <div className="pj-faint" style={{ marginTop: -8, marginBottom: 14 }}>Showing 8 of {tasks.length}, overdue first.</div>}
      {list("Requests in review", reqs.length, reqs.slice(0, 6).map((r) => (
        <button key={r.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("request", r.id)}>
          <span className="pk-grow">{r.ref} {r.title}</span><Chip tone={r.status === "changes_requested" ? "warn" : "accent"}>{LABEL.request[r.status]}</Chip>
        </button>
      )), "No requests waiting.")}
      {list("Open data issues", issues.length, issues.slice(0, 6).map((i) => (
        <button key={i.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("issue", i.id)}>
          <span className="pk-grow">{i.title}</span><Chip tone={toneOf.severity(i.severity)}>{i.severity}</Chip>
        </button>
      )), "No open data issues.")}
    </>
  );
}

function Projects({ list, own }: { list: ReturnType<typeof projectsFor>; own: (p: ReturnType<typeof projectsFor>[number]) => boolean }) {
  const { core, ctx } = useCore();
  const T = projectTerms(core.config);
  if (!list.length) return <Empty title={"No " + T.manyLower} body={"No " + T.manyLower + " you can see belong here or have work here."} />;
  const mine = list.filter(own), shared = list.filter((p) => !own(p));
  return (
    <>
      {mine.length > 0 && <div className="pk-eyebrow" style={{ marginBottom: 8 }}>Belong here · {mine.length}</div>}
      {mine.length > 0 && projectRows(mine)}
      {shared.length > 0 && <div className="pk-eyebrow" style={{ margin: "14px 0 8px" }}>Shared, with work here · {shared.length}</div>}
      {shared.length > 0 && projectRows(shared)}
    </>
  );
  function projectRows(rows: ReturnType<typeof projectsFor>) {
    return (
    <div className="pk-list">
      {rows.map((p) => {
        const h = projectHealth(core, p, ctx.now);
        return (
          <button key={p.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("project", p.id)}>
            <span className="pk-grow">{p.title} <span className="pj-faint">{p.ref}</span></span>
            <span className="pj-faint">{core.data.people.find((x) => x.id === p.ownerId)?.name}</span>
            <HealthChip health={h.health} />
          </button>
        );
      })}
    </div>
    );
  }
}

function People({ q }: { q: QQ }) {
  const rows = personRows(q);
  if (!rows.length) return <Empty title="No people to show" body="Only people whose employment details you can see are listed." />;
  return (
    <div className="pk-list">
      {rows.map((r) => (
        <button key={r.person.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("person", r.person.id)}>
          <span className="pk-grow"><PersonName id={r.person.id} /></span>
          <span className="pj-faint">{r.person.title}</span>
          <span className="pj-faint">{r.team}</span>
          {r.awayNow ? <Chip tone="warn">Away</Chip> : <Chip tone="ok">Available</Chip>}
          <span className="pj-faint pj-mono">{r.openTasks} open</span>
        </button>
      ))}
    </div>
  );
}

function Files({ q }: { q: QQ }) {
  const files = q.files().slice().sort((a, b) => (b.versions[b.versions.length - 1]?.addedAt || "").localeCompare(a.versions[a.versions.length - 1]?.addedAt || ""));
  if (!files.length) return <Empty title="No files" body="Documents owned by this team or unit appear here." />;
  return (
    <div className="pk-list">
      {files.slice(0, 15).map((f) => (
        <button key={f.id} type="button" className="pk-li pk-li--btn" onClick={() => openObject("file", f.id)}>
          <span className="pk-grow">{f.title}</span><span className="pj-faint">{f.kind}</span><span className="pj-faint pj-mono">v{f.versions[f.versions.length - 1]?.n ?? 1}</span>
        </button>
      ))}
    </div>
  );
}

function Activity({ q }: { q: QQ }) {
  const { core } = useCore();
  const tz = core.config.timezone;
  const ev = q.events().slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
  if (!ev.length) return <Empty title="No recent activity" />;
  return (
    <>
      <div className="pk-list">
        {ev.map((e) => (
          <button key={e.id} type="button" className="pk-li pk-li--btn" style={{ alignItems: "flex-start" }} onClick={() => openObject("event", e.id)}>
            <span style={{ flex: "none", width: 130 }}><PersonName id={e.actorId} /></span>
            <span className="pk-grow" style={{ whiteSpace: "normal" }}>{e.summary}{e.simulated ? " (simulated)" : ""}</span>
            <span className="pj-faint pj-mono" style={{ flex: "none" }}>{new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(e.at))}</span>
          </button>
        ))}
      </div>
    </>
  );
}
