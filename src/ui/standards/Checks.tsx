/* Standards > Checks: repeatable checks by period. Due, overdue and completed
   runs; recording a result; a failure creates one follow-up task in Work. */

import { useState } from "react";
import {
  useCore, can, openObject, navigate, visibleCheckRuns, periodOfKey, completeCheck, canHandleSubject, subjectKindLabel, CHECK_EVERY_LABEL,
  type CheckRunState
} from "../../core";
import { Panel, SegTabs } from "../frame";
import { Button, Empty, Field, KV, Notice, Section, SidePanel, TextArea, Chip } from "../kit";
import { InlineError, useRunner } from "../work/shared";
import { CHECK_LABEL, CHECK_TONE, Status, StdTable, Two, useDates, type OpenStd } from "./shared";

type Lane = "open" | "overdue" | "done";

export function Checks({ open }: { open: OpenStd }) {
  const { core, q } = useCore();
  const { d } = useDates();
  const runs = visibleCheckRuns(q);
  const overdue = runs.filter((x) => x.state === "overdue");
  const due = runs.filter((x) => x.state === "due");
  const done = runs.filter((x) => x.state === "passed" || x.state === "failed");
  const [lane, setLane] = useState<Lane>(overdue.length ? "overdue" : "open");
  const rows = (lane === "overdue" ? overdue : lane === "open" ? due : done)
    .sort((a, b) => lane === "done" ? (b.run.completedAt || "").localeCompare(a.run.completedAt || "") : a.run.dueAt.localeCompare(b.run.dueAt));

  if (!core.config.standards.checks.length) {
    return <Panel><Empty title="No repeatable checks yet" body="Checks are things someone confirms every week, month or quarter, such as a safety walk or an access review. Add them in Settings, Standards and requirements."
      action={<Button variant="primary" disabled={!can(q.viewer, "settings.edit")} title={can(q.viewer, "settings.edit") ? undefined : "Only an administrator can add checks."}
        onClick={() => navigate({ page: "Settings", section: "standardsSetup" })}>Add a check</Button>} /></Panel>;
  }

  return (
    <>
      <div className="std-toolbar">
        <SegTabs label="Check status" value={lane} onChange={setLane} options={[
          { value: "overdue", label: "Overdue", count: overdue.length },
          { value: "open", label: "Due this period", count: due.length },
          { value: "done", label: "Completed", count: done.length }
        ]} />
      </div>
      <Panel pad={false}>
        <StdTable label="Checks" rows={rows} rowKey={(x) => x.run.id} onOpen={(x) => open({ kind: "check", id: x.run.id })}
          empty={<Empty title={lane === "overdue" ? "Nothing overdue" : lane === "open" ? "Nothing due in this scope" : "No completed checks in this scope"}
            body={lane === "open" ? "Use Create due checks to produce this period's checks. Each check, subject and period is created once." : undefined} />}
          cols={[
            { key: "check", label: "Check", width: "28%", render: (x) => <Two a={x.check?.label || "Removed check"} b={x.check ? CHECK_EVERY_LABEL[x.check.every] : undefined} /> },
            { key: "subject", label: "Where", render: (x) => <Two a={x.subject.label} b={subjectKindLabel(core.config, x.subject.kind, false)} /> },
            { key: "period", label: "Period", hideNarrow: true, render: (x) => periodOfKey(x.run.periodKey) },
            { key: "due", label: lane === "done" ? "Recorded" : "Due by", render: (x) => lane === "done" ? d(x.run.completedAt) : d(x.run.dueAt) },
            { key: "state", label: "Status", render: (x) => <Status tone={CHECK_TONE[x.state]}>{CHECK_LABEL[x.state]}</Status> },
            { key: "who", label: lane === "done" ? "By" : "Owner", hideNarrow: true, render: (x) => q.name(lane === "done" ? x.run.by : x.subject.ownerId || x.check?.ownerId) }
          ]} />
      </Panel>
    </>
  );
}

export function CheckPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { core, q, ctx } = useCore();
  const { d } = useDates();
  const { err, run } = useRunner();
  const [notes, setNotes] = useState("");
  const x = visibleCheckRuns(q, { ignoreScope: true }).find((r) => r.run.id === id);
  const state: CheckRunState | undefined = x?.state;
  const mayRecord = !!x && (x.check?.ownerId === ctx.viewerId || canHandleSubject(core, ctx.viewerId, x.subject));
  const history = x ? q.events({ ignoreScope: true }).filter((e) => e.storyKey === "check:" + x.run.id || e.objectId === x.run.id).sort((a, b) => b.at.localeCompare(a.at)) : [];
  const record = (result: "passed" | "failed") => { if (run(completeCheck, id, result, notes).ok) setNotes(""); };
  return (
    <SidePanel open onClose={onClose} width={560} eyebrow="Check" title={x ? (x.check?.label || "Check") + ": " + x.subject.label : "Check"}
      chips={state ? <Status tone={CHECK_TONE[state]}>{CHECK_LABEL[state]}</Status> : undefined}>
      {!x ? <Empty title="Not available" body="This check does not exist or is outside what you can see." /> : (
        <>
          <KV items={[
            ["Period", periodOfKey(x.run.periodKey)],
            ["Due by", d(x.run.dueAt)],
            ["Check owner", q.name(x.check?.ownerId)],
            ["Subject owner", q.name(x.subject.ownerId)],
            ["Recorded", x.run.completedAt ? q.name(x.run.by) + ", " + d(x.run.completedAt) : "Not yet"],
            ["Repeats", x.check ? CHECK_EVERY_LABEL[x.check.every] : "Check removed from configuration"]
          ]} />
          {x.check && x.check.checklist.length > 0 && (
            <Section label="What to confirm">
              <ul className="std-checklist">{x.check.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
            </Section>
          )}
          {x.run.notes && <Section label="Notes"><div className="std-wraptext">{x.run.notes}</div></Section>}
          {x.run.followUpTaskId && (
            <Section label="Follow-up">
              <div className="pk-list">
                <button type="button" className="pk-li pk-li--btn" onClick={() => openObject("task", x.run.followUpTaskId!)}>
                  <span className="pk-grow">{core.data.tasks.find((t) => t.id === x.run.followUpTaskId)?.title || "Follow-up task"}</span>
                  <Chip tone={core.data.tasks.find((t) => t.id === x.run.followUpTaskId)?.status === "done" ? "ok" : "warn"}>{core.data.tasks.find((t) => t.id === x.run.followUpTaskId)?.status === "done" ? "Done" : "Open in Work"}</Chip>
                </button>
              </div>
            </Section>
          )}
          {x.run.result === "pending" && (
            <Section label="Record the result">
              {mayRecord ? (
                <>
                  <Field label="Notes" htmlFor="chk-notes" help="Needed when it fails, so the follow-up says what to fix."><TextArea id="chk-notes" value={notes} onChange={setNotes} rows={3} /></Field>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <Button variant="primary" onClick={() => record("passed")}>Passed</Button>
                    <Button variant="danger" disabled={!notes.trim()} title={notes.trim() ? undefined : "Say what failed first"} onClick={() => record("failed")}>Failed</Button>
                  </div>
                  <div className="pk-help" style={{ marginTop: 6 }}>A failure creates one follow-up task in Work for {q.name(x.subject.ownerId || x.check?.ownerId)}.</div>
                  <InlineError text={err} />
                </>
              ) : <Notice>Only the check owner, the owner of {x.subject.label} or a reviewer in scope can record this check.</Notice>}
            </Section>
          )}
          <Section label="History">
            {!history.length ? <div className="pk-help">No history yet.</div> : (
              <div className="pk-list">{history.map((e) => <div key={e.id} className="pk-li"><span className="pk-grow" style={{ whiteSpace: "normal" }}>{e.summary}</span><span className="pk-mono" style={{ fontSize: 11, color: "var(--faint)" }}>{d(e.at)}</span></div>)}</div>
            )}
          </Section>
        </>
      )}
    </SidePanel>
  );
}
