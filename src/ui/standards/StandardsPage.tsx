/* Standards module page. Renders the section chosen in the top bar (v.section):
   overview | requirements | checks | policies | evidence. The top bar draws the
   tabs; this page draws the compact header, one primary action, the content
   and the detail panels. Panels keep the page's filters and position. */

import { useEffect, useState } from "react";
import {
  useCore, store, can, navigate, moduleEnabled, scopeLabel, pageLabel, sectionsFor, visibleViews, visibleCheckRuns, runStandardsDue, policyFiles, policyProgress
} from "../../core";
import type { ModulePageProps } from "../modules/registry";
import { PageFrame, Hero, StatStrip, Btn, eyebrowOf } from "../frame";
import { Empty } from "../kit";
import { Overview } from "./Overview";
import { Requirements, RequirementPanel } from "./Requirements";
import { Checks, CheckPanel } from "./Checks";
import { Policies, PolicyPanel } from "./Policies";
import { Evidence, type EvidenceLane } from "./Evidence";
import { ObligationPanel, ReceivePanel } from "./ObligationPanel";
import type { StdPanel } from "./shared";

const TITLE: Record<string, string> = { overview: "Readiness", requirements: "Requirements", checks: "Checks", policies: "Policies", evidence: "Evidence" };
const BLURB: Record<string, string> = {
  overview: "Which requirements each subject meets, and the exact evidence holding things back.",
  requirements: "What evidence is expected, from whom, how often it renews and who reviews it.",
  checks: "Repeatable checks by period. A failed check creates one follow-up task in Work.",
  policies: "Versioned policies and who has acknowledged the current version.",
  evidence: "Evidence received, under review or still needed. Receiving a file is not accepting it."
};

export default function StandardsPage({ section, setSection }: ModulePageProps) {
  const { core, q, ctx, session } = useCore();
  const [panel, setPanel] = useState<StdPanel>(null);
  const [lane, setLane] = useState<EvidenceLane>("received");
  const sec = TITLE[section] ? section : "overview";

  // A link from elsewhere (openObject("obligation", id)) opens its panel here, whatever the tab.
  useEffect(() => {
    const f = session.focus;
    if (f?.kind === "obligation" && f.id) { setPanel({ kind: "obligation", key: f.id }); store.setSession({ focus: null }); }
  }, [session.focus]);

  if (!moduleEnabled(core.config, "standards")) {
    return <PageFrame><Empty title="Standards is switched off" body="An administrator can switch it on in Settings, Modules and labels. Its records are kept while it is off." /></PageFrame>;
  }

  const views = visibleViews(q).filter((v) => v.applies);
  const approved = views.filter((v) => v.state === "approved").length;
  const awaiting = views.filter((v) => v.state === "received" || v.state === "under_review").length;
  const gaps = views.filter((v) => v.state === "missing" || v.state === "rejected" || v.state === "expired").length;
  const overdue = visibleCheckRuns(q).filter((x) => x.state === "overdue").length;
  const myOutstanding = policyFiles(core).filter((f) => q.file(f.id)).filter((f) => policyProgress(core, f, ctx.now).outstanding.includes(ctx.viewerId));
  const myPolicies = myOutstanding.length;
  const mayTick = can(q.viewer, "standards.review") || can(q.viewer, "workflows.operate") || can(q.viewer, "settings.edit");

  const go = (s: string, l?: EvidenceLane) => { if (l) setLane(l); setSection(s); };
  const stats = [
    { label: "Evidence approved", value: views.length ? approved + " of " + views.length : "None", color: undefined, onClick: () => go("overview"),
      title: "Requirements with evidence reviewed and accepted, out of those that apply in this scope. Not a statement of legal compliance." },
    { label: "Awaiting review", value: String(awaiting), color: awaiting ? "var(--warn)" : undefined, onClick: () => go("evidence", "received"), title: "Received or under review, not yet accepted" },
    { label: "Missing or lapsed", value: String(gaps), color: gaps ? "var(--bad)" : undefined, onClick: () => go("evidence", "needs"), title: "Missing, rejected or expired" },
    { label: "Checks overdue", value: String(overdue), color: overdue ? "var(--bad)" : undefined, onClick: () => go("checks"), title: "Pending checks past the end of their period" },
    { label: "Policies for you", value: String(myPolicies), color: myPolicies ? "var(--warn)" : undefined, onClick: () => go("policies"), title: "Policies whose current version you have not acknowledged" }
  ];

  const primary = (() => {
    switch (sec) {
      case "overview": return <Btn primary onClick={() => go("evidence", "received")} disabled={!awaiting} title={awaiting ? undefined : "Nothing is waiting for review"}>Review queue{awaiting ? " (" + awaiting + ")" : ""}</Btn>;
      case "evidence": return <Btn primary onClick={() => setPanel({ kind: "receive" })}>Receive evidence</Btn>;
      case "requirements": return <Btn primary disabled={!can(q.viewer, "settings.edit")} title={can(q.viewer, "settings.edit") ? undefined : "Only an administrator can change requirements."}
        onClick={() => navigate({ page: "Settings", section: "standardsSetup" })}>Edit requirements</Btn>;
      case "checks": return <Btn primary disabled={!mayTick} title={mayTick ? "No scheduler is connected in the demo, so a person runs this. It creates this period's checks and any renewal tasks, once each." : "Only a reviewer, workflow operator or administrator can run this."}
        onClick={() => store.run(runStandardsDue)}>Create due checks and renewals</Btn>;
      case "policies": return myOutstanding.length
        ? <Btn primary onClick={() => setPanel({ kind: "policy", id: myOutstanding[0].id })}>Read and acknowledge{myOutstanding.length > 1 ? " (" + myOutstanding.length + ")" : ""}</Btn>
        : null;
    }
    return null;
  })();

  const secLabel = sectionsFor(core, "Standards").find((x) => x.id === sec)?.label || TITLE[sec];
  const close = () => setPanel(null);

  return (
    <PageFrame>
      <Hero eyebrow={eyebrowOf(pageLabel(core.config, "Standards"), secLabel, scopeLabel(core, ctx.scope))} title={TITLE[sec]} blurb={BLURB[sec]} infoOnly actions={primary}>
        <StatStrip stats={stats} />
      </Hero>

      {sec === "overview" && <Overview open={setPanel} />}
      {sec === "requirements" && <Requirements open={setPanel} />}
      {sec === "checks" && <Checks open={setPanel} />}
      {sec === "policies" && <Policies open={setPanel} />}
      {sec === "evidence" && <Evidence open={setPanel} lane={lane} setLane={setLane} />}

      {panel?.kind === "obligation" && <ObligationPanel key={panel.key} k={panel.key} onClose={close} open={setPanel} />}
      {panel?.kind === "requirement" && <RequirementPanel id={panel.id} onClose={close} open={setPanel} />}
      {panel?.kind === "check" && <CheckPanel id={panel.id} onClose={close} />}
      {panel?.kind === "policy" && <PolicyPanel id={panel.id} onClose={close} />}
      {panel?.kind === "receive" && <ReceivePanel onClose={close} open={setPanel} />}
    </PageFrame>
  );
}
