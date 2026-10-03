/* Work · People. Employee management for an organisation of roughly 50 to 250
   staff across several units, in the original Pulse page language.

   What it is for: a manager opens it on a Monday and sees, for the people they
   look after, who is joining, on probation or leaving, who is away, which
   required certificates have lapsed or fall due, which documents are still
   unsigned, whose probation review is coming, how open work is spread against
   contracted hours, and whose access needs a second look. Each of those is a
   row they can act on, and every action goes through a core op that checks
   permission and leaves an audit event. A contributor sees their own record
   and can request leave, which goes through the normal approvals.

   Every figure comes from src/core/people.ts over the shared core. */

import { useMemo, useState } from "react";
import { useCore, ops, store, navigate, can, scopeLabel, fmtDate, toCsv, tenureLabel } from "../../core";
import type { Id } from "../../core";
import { personRows, type PersonRow } from "../../core/people";
import { PageFrame, Hero, StatStrip, SegTabs, FilterChip, Btn, Callout, eyebrowOf } from "../frame";
import { downloadText } from "../kit";
import { I } from "./bits";
import { PersonCardRow } from "./PeopleList";
import { AwayPanel, CertsPanel, ProbationPanel, JoinersPanel, DocsPanel, WorkloadPanel, AccessPanel } from "./SupportPanels";
import { PersonPanel } from "./PersonPanel";
import { LeavePanel, LEAVE_FORM } from "./LeavePanel";
import { OnboardPanel } from "./OnboardPanel";
import { CONTRACT_LABEL, ICONS, STAGE_LABEL, canManage, certSummary, isManagerViewer, renewalBooked } from "./util";
import "../../styles/people.css";

type Stage = "all" | "onboarding" | "probation" | "active" | "leaving";
type Quick = "early" | "certs" | "away" | "docs" | null;
type PanelState = { kind: "person"; id: Id } | { kind: "leave" } | { kind: "onboard" } | null;

const QUICK_LABEL: Record<Exclude<Quick, null>, string> = {
  early: "Onboarding or probation", certs: "Certificate needs action", away: "Away today", docs: "Documents to sign"
};

/** People needing action sort first; the order is a to-do order, never a ranking. */
const needsAction = (r: PersonRow) =>
  (r.certIssue === "lapsed" ? 4 : 0) + (r.probationDueDays !== null && r.probationDueDays <= 30 ? 2 : 0) + (r.certIssue === "due" ? 1 : 0) + (r.docsOutstanding ? 1 : 0)
  + (r.e.stage === "onboarding" || r.e.stage === "leaving" ? 1 : 0);

export default function PeoplePage(_props: { v?: unknown }) {
  const { core, q, session } = useCore();
  const tz = core.config.timezone;
  const [stage, setStage] = useState<Stage>("all");
  const [team, setTeam] = useState("");
  const [cert, setCert] = useState("");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<Quick>(null);
  const [panel, setPanel] = useState<PanelState>(null);

  const rows = useMemo(() => personRows(q), [q]);
  const manager = isManagerViewer(q);
  const scope = scopeLabel(core, session.scope);
  const hasAny = core.data.employment.length > 0;
  const leaveForm = core.config.requestForms.some((f) => f.id === LEAVE_FORM && f.enabled);
  const mayExport = !core.config.governance.exportRequiresPermission || can(q.viewer, "export");

  /* ── Figures ── */
  const early = rows.filter((r) => r.e.stage === "onboarding" || r.e.stage === "probation");
  const counted = rows.filter((r) => r.e.stage !== "onboarding").flatMap((r) => r.certs);
  const inDate = counted.filter((c) => c.state === "ok" || c.state === "due").length;
  const certPct = counted.length ? Math.round((100 * inDate) / counted.length) + "%" : "None";
  const away = rows.filter((r) => r.awayNow);
  const docs = rows.reduce((n, r) => n + r.docsOutstanding, 0);
  const lapsed = rows.flatMap((r) => r.certs.filter((c) => c.state === "lapsed").map((c) => ({ r, c })));

  /* ── Filtering ── */
  const stageCount = (s: Stage) => (s === "all" ? rows.length : rows.filter((r) => r.e.stage === s).length);
  const teams = [...new Map(rows.filter((r) => r.e.teamId).map((r) => [r.e.teamId as string, r.team])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const needle = search.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (stage !== "all" && r.e.stage !== stage) return false;
    if (team && r.e.teamId !== team) return false;
    if (cert === "lapsed" && !r.certs.some((c) => c.state === "lapsed")) return false;
    if (cert === "due" && !r.certs.some((c) => c.state === "due")) return false;
    if (cert === "missing" && !r.certs.some((c) => c.state === "missing")) return false;
    if (cert === "ok" && !(r.certs.length && r.certs.every((c) => c.state === "ok"))) return false;
    if (quick === "early" && !(r.e.stage === "onboarding" || r.e.stage === "probation")) return false;
    if (quick === "certs" && !(r.certIssue === "lapsed" || r.certIssue === "due" || r.certIssue === "missing")) return false;
    if (quick === "away" && !r.awayNow) return false;
    if (quick === "docs" && !r.docsOutstanding) return false;
    if (needle && ![r.person.name, r.person.title, r.team, r.unit, r.manager].join(" ").toLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => needsAction(b) - needsAction(a) || a.person.name.localeCompare(b.person.name));
  const filtered = stage !== "all" || !!team || !!cert || !!quick || !!needle;
  const clearAll = () => { setStage("all"); setTeam(""); setCert(""); setSearch(""); setQuick(null); };
  const pick = (k: Exclude<Quick, null>) => { setStage("all"); setQuick(quick === k ? null : k); };

  /* ── Export ── */
  const exportCsv = () => {
    const res = store.run(ops.logExport, "People (" + scope + ")", shown.length);
    if (!res.ok) return;
    const cols = [
      { key: "name", label: "Name" }, { key: "title", label: "Title" }, { key: "team", label: "Team" }, { key: "unit", label: "Unit" },
      { key: "stage", label: "Stage" }, { key: "contract", label: "Contract" }, { key: "hours", label: "Hours per week" }, { key: "manager", label: "Manager" },
      { key: "start", label: "Start date" }, { key: "tenure", label: "Tenure" }, { key: "certs", label: "Certificates" }, { key: "docs", label: "Documents to sign" },
      { key: "open", label: "Open tasks" }, { key: "away", label: "Away now" }
    ];
    const data = shown.map((r) => ({
      name: r.person.name, title: r.person.title, team: r.team, unit: r.unit, stage: STAGE_LABEL[r.e.stage], contract: CONTRACT_LABEL[r.e.contract],
      hours: r.e.hoursPerWeek, manager: r.e.managerId ? r.manager : "", start: r.e.startDate.slice(0, 10), tenure: r.tenureDays >= 0 ? tenureLabel(r.tenureDays) : "Not started",
      certs: certSummary(r, tz).text, docs: r.docsOutstanding, open: r.openTasks, away: r.awayNow ? "Yes" : "No"
    }));
    downloadText("people.csv", toCsv(cols, data));
  };

  /* ── Header ── */
  const actions = (
    <>
      <Btn primary onClick={() => setPanel({ kind: "leave" })} disabled={!leaveForm}
        title={leaveForm ? "Ask for time off. It goes through the normal approvals." : "No leave request form is set up. An administrator can add one in Settings, Request forms."}>
        <I d={ICONS.leave} size={14} sw={1.9} />Request leave
      </Btn>
      {manager && (
        <>
          <Btn onClick={() => setPanel({ kind: "onboard" })}><I d={ICONS.seed} size={14} />Start onboarding</Btn>
          <Btn onClick={exportCsv} disabled={!mayExport || !shown.length}
            title={!mayExport ? "Your role cannot export data." : !shown.length ? "Nothing in this view to export." : "Downloads the " + shown.length + " people in this view as CSV"}>
            <I d={ICONS.download} size={14} />Export
          </Btn>
        </>
      )}
    </>
  );

  const stats = [
    { label: "People", value: String(rows.length), icon: ICONS.people, onClick: clearAll, title: "Show everyone" },
    { label: "Onboarding / probation", value: early.filter((r) => r.e.stage === "onboarding").length + " / " + early.filter((r) => r.e.stage === "probation").length,
      icon: ICONS.seed, onClick: () => pick("early"), title: "Show people in onboarding or probation" },
    { label: "Certificates in date", value: certPct, icon: ICONS.badge, color: lapsed.length ? "var(--bad)" : undefined, onClick: () => pick("certs"),
      title: counted.length ? inDate + " of " + counted.length + " certificates in date (due within 30 days still counts). Joiners in onboarding are not counted." : "No certificates recorded" },
    { label: "Away today", value: String(away.length), icon: ICONS.away, color: away.length ? "var(--warn)" : undefined, onClick: () => pick("away"), title: "Show who is away today" },
    { label: "Documents to sign", value: String(docs), icon: ICONS.pen, color: docs ? "var(--warn)" : undefined, onClick: () => pick("docs"), title: "Show who has documents to sign" }
  ];

  const count = rows.length;
  const openPerson = (id: Id) => setPanel({ kind: "person", id });
  const supporting = [
    <AwayPanel onOpen={openPerson} />,
    <CertsPanel rows={rows} onOpen={openPerson} />,
    manager && <ProbationPanel rows={rows} onOpen={openPerson} />,
    manager && <JoinersPanel rows={rows} onOpen={openPerson} />,
    <DocsPanel rows={rows} onOpen={openPerson} />,
    <WorkloadPanel rows={rows} onOpen={openPerson} />,
    manager && <AccessPanel rows={rows} onOpen={openPerson} />
  ].filter(Boolean);
  return (
    <PageFrame>
      <Hero eyebrow={eyebrowOf("Work", "People", count + (count === 1 ? " person" : " people"), scope)} title="People"
        blurb="Who works here, where each person is in their employment, and what needs doing: certificates, signatures, probation reviews, leave and access."
        actions={actions}>
        <StatStrip stats={stats} />
      </Hero>

      {!manager && hasAny && (
        <div className="pp-note" role="note"><I d={ICONS.person} size={13} />You can see your own employment record only. Your manager and administrators see the wider team.</div>
      )}

      {lapsed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="bad" eyebrow="CERTIFICATES LAPSED"
            title={lapsed.length === 1 ? "A required certificate has lapsed" : lapsed.length + " required certificates have lapsed"}
            actions={<>
              {lapsed.slice(0, 3).map(({ r, c }) => {
                const booked = renewalBooked(core, r.person.id, c.cert.id, c.cert.expires);
                const may = canManage(q, r.e);
                return (
                  <Btn key={r.person.id + c.cert.id} small primary={!booked && may} disabled={booked || !may}
                    title={booked ? "A renewal task already exists for this certificate." : may ? "Creates a renewal task for their manager" : "Only their manager or an administrator can book this."}
                    onClick={() => store.run(ops.bookRenewal, r.person.id, c.cert.id)}>
                    {booked ? r.person.name.split(" ")[0] + ": already booked" : "Book renewal for " + r.person.name.split(" ")[0]}
                  </Btn>
                );
              })}
              <Btn small onClick={() => pick("certs")}>Show everyone affected</Btn>
            </>}>
            {lapsed.map(({ r, c }) => r.person.name + ": " + c.cert.name + ", lapsed " + fmtDate(c.cert.expires || undefined, tz) + ".").join(" ")}
          </Callout>
        </div>
      )}

      {rows.length > 1 && (
        <div className="pp-toolbar">
          <SegTabs label="Employment stage" value={stage} onChange={(s) => { setStage(s); setQuick(null); }}
            options={(["all", "onboarding", "probation", "active", "leaving"] as Stage[]).map((s) => ({ value: s, label: s === "all" ? "All" : STAGE_LABEL[s], count: stageCount(s) }))} />
          <div className="pp-sep" aria-hidden="true" />
          {teams.length > 1 && (
            <FilterChip label="Team" value={team} onChange={setTeam} options={[{ value: "", label: "Any team" }, ...teams.map(([id, label]) => ({ value: id, label }))]} />
          )}
          <FilterChip label="Certificates" value={cert} onChange={setCert} options={[
            { value: "", label: "Any certificates" }, { value: "lapsed", label: "Lapsed" }, { value: "due", label: "Due in 30 days" },
            { value: "missing", label: "Not recorded" }, { value: "ok", label: "All in date" }
          ]} />
          <label className="pp-search">
            <I d={ICONS.search} size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search people" />
          </label>
          {quick && (
            <button type="button" className="pp-clear" onClick={() => setQuick(null)} aria-label={"Remove filter: " + QUICK_LABEL[quick]}>
              {QUICK_LABEL[quick]}<I d={ICONS.close} size={11} sw={2.2} />
            </button>
          )}
        </div>
      )}

      <section className="pp-card" aria-label="People">
        {!hasAny ? (
          <div className="pf-empty" style={{ borderTop: 0 }}>
            <b>No employment records yet</b>
            <span>Add people in Settings, People and access. Their stage, contract, certificates and documents then show here.</span>
            <div style={{ marginTop: 14 }}><Btn small onClick={() => navigate({ page: "Settings", section: "people" })}>Open People and access</Btn></div>
          </div>
        ) : !rows.length ? (
          <div className="pf-empty" style={{ borderTop: 0 }}>
            <b>Nobody in {scope}</b>
            <span>No employment records you can see belong to this scope. Change the scope in the top bar to see more people.</span>
          </div>
        ) : (
          <>
            <div className="pp-card-h">
              <span style={{ flex: 1 }}>{shown.length} of {rows.length} {rows.length === 1 ? "person" : "people"}{shown.length > 1 ? ", needing action first" : ""}</span>
              {filtered && <Btn small onClick={clearAll}>Clear filters</Btn>}
            </div>
            {shown.map((r, i) => (
              <PersonCardRow key={r.person.id} r={r} index={i} selected={panel?.kind === "person" && panel.id === r.person.id}
                onOpen={() => setPanel({ kind: "person", id: r.person.id })} />
            ))}
            {!shown.length && (
              <div className="pf-empty">
                <b>Nobody matches these filters</b>
                <span>Clear a filter or search for someone else.</span>
              </div>
            )}
          </>
        )}
      </section>

      {rows.length > 0 && (
        <div className="pp-grid">
          {supporting.map((el, i) => (
            <div key={i} style={supporting.length % 2 && i === supporting.length - 1 ? { gridColumn: "1 / -1" } : undefined}>{el}</div>
          ))}
        </div>
      )}

      {panel?.kind === "person" && <PersonPanel key={panel.id} personId={panel.id} onClose={() => setPanel(null)} />}
      {panel?.kind === "leave" && <LeavePanel onClose={() => setPanel(null)} />}
      {panel?.kind === "onboard" && <OnboardPanel rows={rows} onClose={() => setPanel(null)} />}
    </PageFrame>
  );
}
