/* Start onboarding: pick a new joiner and create their checklist tasks from
   the configured onboarding checklist. Starting twice never duplicates tasks. */

import { useCore, ops, store, navigate, fmtDate } from "../../core";
import type { PersonRow } from "../../core/people";
import { SidePanel, Button, Section } from "../kit";
import { Pill } from "../frame";
import { STAGE_LABEL, STAGE_TONE, canManage, checklistTasks } from "./util";

export function OnboardPanel({ rows, onClose }: { rows: PersonRow[]; onClose: () => void }) {
  const { core, q } = useCore();
  const tz = core.config.timezone;
  const items = core.config.people.onboardingChecklist;
  const joiners = rows.filter((r) => (r.e.stage === "onboarding" || r.e.stage === "probation") && canManage(q, r.e));

  return (
    <SidePanel open onClose={onClose} title="Start onboarding" eyebrow="PEOPLE · ONBOARDING" width={520}>
      <Section label={"Checklist · " + items.length + " steps"}>
        {!items.length ? (
          <p className="pp-li-s">No onboarding checklist is configured. An administrator can add one in Settings.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--body)", lineHeight: 1.8 }}>{items.map((x) => <li key={x}>{x}</li>)}</ol>
        )}
        <div className="pp-foot">Each step becomes a task for the person's manager, due one day apart from their start date.</div>
      </Section>
      <Section label={"New joiners · " + joiners.length}>
        {!joiners.length ? (
          <div>
            <p className="pp-li-s" style={{ whiteSpace: "normal", lineHeight: 1.5 }}>
              Nobody you manage is in onboarding or probation. New people are added in Settings, People and access, then given an employment record.
            </p>
            <div style={{ marginTop: 10 }}><Button size="sm" onClick={() => { onClose(); navigate({ page: "Settings", section: "people" }); }}>Open People and access</Button></div>
          </div>
        ) : (
          <div className="pp-plist">
            {joiners.map((r) => {
              const tasks = checklistTasks(core, r.person.id, "onboarding");
              const done = tasks.filter((t) => t.status === "done").length;
              return (
                <div key={r.person.id} className="pp-pi">
                  <div className="pp-li-main">
                    <div className="pp-li-t">{r.person.name}</div>
                    <div className="pp-li-s">{r.team}, {r.tenureDays < 0 ? "starts " : "started "}{fmtDate(r.e.startDate, tz)}</div>
                  </div>
                  <Pill tone={STAGE_TONE[r.e.stage]}>{STAGE_LABEL[r.e.stage]}</Pill>
                  {tasks.length ? <span className="pp-done">{done} of {tasks.length} done</span>
                    : <Button size="sm" variant="primary" disabled={!items.length} onClick={() => store.run(ops.startChecklist, r.person.id, "onboarding")}>Start checklist</Button>}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </SidePanel>
  );
}
