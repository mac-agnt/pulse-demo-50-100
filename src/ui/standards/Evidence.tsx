/* Standards > Evidence: the review queue. Received evidence waiting for its
   review to start, evidence under review, requirements that need evidence,
   and recent decisions. Each row opens the obligation panel. */

import { useState } from "react";
import { useCore, visibleViews, subjectKindLabel, ms, DAY, stateText, type ObligationView } from "../../core";
import { Panel, SegTabs } from "../frame";
import { Empty } from "../kit";
import { StatePill, StdTable, Two, useDates, type OpenStd } from "./shared";

type Lane = "received" | "review" | "needs" | "decided";

export function Evidence({ open, lane, setLane }: { open: OpenStd; lane: Lane; setLane: (l: Lane) => void }) {
  const { core, q, ctx } = useCore();
  const { d } = useDates();
  const views = visibleViews(q).filter((v) => v.applies || v.obligation);
  const lanes: Record<Lane, ObligationView[]> = {
    received: views.filter((v) => v.state === "received"),
    review: views.filter((v) => v.state === "under_review"),
    needs: views.filter((v) => v.applies && (v.state === "missing" || v.state === "rejected" || v.state === "expired" || v.expiring)),
    decided: views.filter((v) => (v.state === "approved" || v.state === "rejected") && v.obligation?.decidedAt && ms(ctx.now) - ms(v.obligation.decidedAt) <= 30 * DAY)
  };
  const rows = [...lanes[lane]].sort((a, b) => (when(a) || "").localeCompare(when(b) || "") * (lane === "decided" ? -1 : 1));
  const file = (v: ObligationView) => {
    const ev = v.obligation?.evidence;
    if (!ev) return v.source === "certificate" ? "Certificate in People" : "Nothing received";
    return (q.file(ev.fileId)?.title || "A document you cannot see") + ", version " + ev.version;
  };
  const EMPTY: Record<Lane, [string, string]> = {
    received: ["Nothing waiting to be reviewed", "Received evidence appears here until someone starts its review. Receiving a file never accepts it."],
    review: ["Nothing under review", "Reviews in progress appear here with who decides. The same request is in Work, Approvals."],
    needs: ["Nothing needs evidence in this scope", "Missing, rejected, expired and soon-to-expire requirements appear here."],
    decided: ["No decisions in the last 30 days", "Accepted and rejected evidence from the last 30 days appears here."]
  };
  return (
    <>
      <div className="std-toolbar">
        <SegTabs label="Evidence queue" value={lane} onChange={setLane} options={[
          { value: "received", label: "To review", count: lanes.received.length },
          { value: "review", label: "Under review", count: lanes.review.length },
          { value: "needs", label: "Needs evidence", count: lanes.needs.length },
          { value: "decided", label: "Decided", count: lanes.decided.length }
        ]} />
      </div>
      <Panel pad={false}>
        <StdTable label="Evidence" rows={rows} rowKey={(v) => v.key} onOpen={(v) => open({ kind: "obligation", key: v.key })}
          empty={<Empty title={EMPTY[lane][0]} body={EMPTY[lane][1]} />}
          cols={[
            { key: "req", label: "Requirement", width: "22%", render: (v) => <Two a={v.requirement.label} b={v.requirement.evidence} /> },
            { key: "subject", label: "For", render: (v) => <Two a={v.subject.label} b={subjectKindLabel(core.config, v.subject.kind, false)} /> },
            { key: "file", label: "Evidence", hideNarrow: true, render: (v) => <span className="std-wraptext">{file(v)}</span> },
            { key: "state", label: "State", render: (v) => <StatePill v={v} long /> },
            { key: "detail", label: lane === "decided" ? "Decided" : lane === "needs" ? "Detail" : "Received", hideNarrow: true, render: (v) =>
              lane === "decided" ? q.name(v.obligation?.decidedBy) + ", " + d(v.obligation?.decidedAt)
              : lane === "needs" ? <span className="std-wraptext">{stateText(core, v)}</span>
              : v.obligation?.evidence ? q.name(v.obligation.evidence.receivedBy) + ", " + d(v.obligation.evidence.receivedAt) : "None" }
          ]} />
      </Panel>
    </>
  );
}

function when(v: ObligationView) {
  return v.obligation?.decidedAt || v.obligation?.evidence?.receivedAt || v.obligation?.dueAt || v.expiresAt;
}

export type { Lane as EvidenceLane };
