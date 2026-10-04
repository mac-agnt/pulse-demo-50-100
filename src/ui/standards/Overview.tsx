/* Standards > Overview: the readiness matrix (subjects by kind against the
   requirements that apply to them) and the exact requirement holding each
   thing back. */

import { useState } from "react";
import { useCore, readiness, blockers, can, navigate, openObject, subjectKindLabel, OBLIGATION_TONE, type ReadinessGroup } from "../../core";
import { Panel } from "../frame";
import { Button, Empty, Notice } from "../kit";
import { SHORT, Status, StatePill, type OpenStd } from "./shared";

export function Overview({ open }: { open: OpenStd }) {
  const { core, q } = useCore();
  const groups = readiness(q);
  const bl = blockers(q);
  const reqs = core.config.standards.requirements;
  const mayConfigure = can(q.viewer, "settings.edit");

  if (!reqs.length) {
    return (
      <Panel>
        <Empty title="No requirements yet" body="Requirements say what evidence a person, project, location, unit, record or supplier needs, who reviews it and how often it renews."
          action={<Button variant="primary" disabled={!mayConfigure} title={mayConfigure ? undefined : "Only an administrator can add requirements."}
            onClick={() => navigate({ page: "Settings", section: "standardsSetup" })}>Add your first requirement</Button>} />
      </Panel>
    );
  }

  return (
    <div className="std-ov">
      <Panel title="Readiness" meta="Approved means the evidence was reviewed and accepted in Pulse. It is not a statement of legal compliance." pad={false}>
        {groups.length === 0
          ? <Empty title="Nothing in this scope" body="No subject in the selected scope has a requirement you can see. Try a wider scope from the top bar." />
          : groups.map((g) => <Matrix key={g.kind} g={g} open={open} />)}
      </Panel>
      <Panel title="What is blocking progress" meta={bl.length ? bl.length + " item" + (bl.length === 1 ? "" : "s") + " held back by a requirement" : "Nothing held back in this scope"} pad={false}>
        {bl.length === 0 ? <div className="std-pad pk-help">No gate or configured hold is waiting on evidence you can see.</div> : (
          <div className="std-blockers">
            {bl.map((b) => (
              <button key={b.key} type="button" className="std-blocker"
                onClick={() => b.view ? open({ kind: "obligation", key: b.view.key }) : b.projectId && openObject("project", b.projectId)}>
                <span className="std-blocker-what">{b.what}</span>
                <span className="std-blocker-why">waits on {b.view ? b.view.requirement.label + " evidence" : "a requirement record that no longer exists"}</span>
                {b.view && <span><StatePill v={b.view} long /></span>}
              </button>
            ))}
          </div>
        )}
        <div className="std-pad"><Notice>Gates are read from project milestones. A gate opens only when every requirement it lists is approved.</Notice></div>
      </Panel>
    </div>
  );
}

function Matrix({ g, open }: { g: ReadinessGroup; open: OpenStd }) {
  const { core } = useCore();
  const [shut, setShut] = useState(false);
  const gaps = g.rows.reduce((n, r) => n + r.gaps, 0);
  const cells = g.rows.reduce((n, r) => n + r.cells.filter(Boolean).length, 0);
  return (
    <div className="std-group">
      <button type="button" className="std-group-h" aria-expanded={!shut} onClick={() => setShut(!shut)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
          style={{ transform: shut ? "rotate(-90deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
        <span className="std-group-t">{g.label}</span>
        <span className="std-group-n">{g.rows.length}</span>
        <span className="pk-grow" />
        <span className="std-group-s">{cells - gaps} of {cells} approved</span>
      </button>
      {!shut && (
        <div className="std-wrap">
          <table className="std-matrix" aria-label={g.label + " readiness"}>
            <thead>
              <tr>
                <th scope="col">{subjectKindLabel(core.config, g.kind, false)}</th>
                {g.requirements.map((r) => <th key={r.id} scope="col" title={r.description}>{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((row) => (
                <tr key={row.subject.id}>
                  <th scope="row">
                    <span className="std-two"><span>{row.subject.label}</span>{row.subject.detail && <span>{row.subject.detail}</span>}</span>
                  </th>
                  {row.cells.map((c, i) => (
                    <td key={g.requirements[i].id}>
                      {c ? (
                        <button type="button" className="std-cellbtn" onClick={() => open({ kind: "obligation", key: c.key })}
                          aria-label={g.requirements[i].label + " for " + row.subject.label + ": " + SHORT[c.state]}>
                          <Status tone={c.expiring ? "warn" : OBLIGATION_TONE[c.state]}>{c.state === "under_review" && c.review?.status === "approved" ? "Approved, not applied" : SHORT[c.state]}{c.expiring ? ", renewal due" : ""}</Status>
                        </button>
                      ) : <span className="std-na">Not required</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
