/* Activity: Overview | Needs attention | History (v.actLens, drawn as tabs by
   the top bar). Overview restores the Base Pulse layout (hero, four tiles,
   Data / People / Agents streams) built from recorded events grouped into
   stories, plus a business-change summary and company updates. Needs
   attention is one deduplicated action queue. History is the audit table with
   a detail panel. Counts describe recorded events, not performance. */

import { useEffect, useMemo, useState } from "react";
import { useCore, store, navigate, scopeLabel } from "../../core";
import { PageFrame, Hero, Btn, eyebrowOf } from "../frame";
import { Icon } from "../kit";
import { attentionQueue } from "./queue";
import EventPanel from "./EventPanel";
import Overview from "./Overview";
import Attention from "./Attention";
import History from "./History";
import "../../styles/activity.css";

export type ActLens = "overview" | "attention" | "history";

export default function ActivityPage({ v }: { v: { actLens?: string } }) {
  const lens: ActLens = v.actLens === "attention" || v.actLens === "history" ? v.actLens : "overview";
  const { q, core, session } = useCore();
  const scope = scopeLabel(core, session.scope);
  const [openId, setOpenId] = useState<string | null>(null);
  const items = useMemo(() => attentionQueue(q), [q]);

  // Focus hand-off: another page asked to open an event here.
  useEffect(() => {
    const f = session.focus;
    if (f && f.kind === "event" && f.id) {
      setOpenId(f.id);
      store.setSession({ focus: null });
    }
  }, [session.focus]);

  return (
    <PageFrame>
      {lens === "overview" ? (
        <Hero eyebrow={eyebrowOf("Activity", scope)} title="Everything happening now"
          blurb="Data arriving, people deciding and agents working, grouped into one story per request, run or change."
          actions={<Btn onClick={() => navigate({ page: "Activity", section: "history" })}><Icon d="M12 7v5l3.4 2 M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9" size={14} sw={1.8} />Full history</Btn>} />
      ) : (
        <div className="act-head">
          <div className="pf-eyebrow">{eyebrowOf("Activity", lens === "attention" ? "Needs attention" : "History", scope)}</div>
          <h1 className="act-head-t">{lens === "attention" ? "What needs attention" : "Everything recorded"}</h1>
          <div className="act-head-b">{lens === "attention"
            ? "Failures, decisions, overdue and blocked work, project risks, agent runs and data problems in " + scope + ", most severe first."
            : "Every change in " + scope + " by people, agents, Pulse and source syncs. Open a row for before and after values, evidence and connected events."}</div>
        </div>
      )}

      {lens === "overview" && <Overview attentionCount={items.length} onOpenEvent={setOpenId} />}
      {lens === "attention" && <Attention items={items} />}
      {lens === "history" && <History openId={openId} onOpen={setOpenId} />}

      <EventPanel eventId={openId} onClose={() => setOpenId(null)} onSelect={setOpenId} />
    </PageFrame>
  );
}
