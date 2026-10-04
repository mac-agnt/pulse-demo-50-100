/* Standards > Requirements: each requirement with who it applies to, the
   evidence expected, renewal, reviewers and its records by state. */

import {
  useCore, can, navigate, visibleViews, selectorText, subjectKindLabel, ensureObligations, OBLIGATION_TONE,
  type ObligationState, type ObligationView, type RequirementDef
} from "../../core";
import { Panel } from "../frame";
import { Button, Empty, KV, Notice, Section, SidePanel } from "../kit";
import { InlineError, useRunner } from "../work/shared";
import { SHORT, StatePill, Status, StdTable, Two, useDates, type OpenStd } from "./shared";

const ORDER: ObligationState[] = ["approved", "under_review", "received", "missing", "rejected", "expired"];

function counts(views: ObligationView[]) {
  const by = new Map<ObligationState, number>();
  for (const v of views) by.set(v.state, (by.get(v.state) || 0) + 1);
  return ORDER.filter((s) => by.get(s)).map((s) => ({ state: s, n: by.get(s)! }));
}

export function Requirements({ open }: { open: OpenStd }) {
  const { core, q } = useCore();
  const { err, run } = useRunner();
  const reqs = core.config.standards.requirements;
  const views = visibleViews(q).filter((v) => v.applies);
  const untracked = views.filter((v) => v.source === "untracked").length;
  const mayApply = can(q.viewer, "settings.edit") || can(q.viewer, "standards.review");
  const roleLabel = (id: string) => core.config.roles.find((r) => r.id === id)?.label || id;

  if (!reqs.length) {
    return <Panel><Empty title="No requirements yet" body="Add requirements in Settings, Standards and requirements. Each one says who it applies to, the evidence expected and who reviews it."
      action={<Button variant="primary" disabled={!can(q.viewer, "settings.edit")} title={can(q.viewer, "settings.edit") ? undefined : "Only an administrator can add requirements."}
        onClick={() => navigate({ page: "Settings", section: "standardsSetup" })}>Add a requirement</Button>} /></Panel>;
  }

  return (
    <>
      {untracked > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="warn">
            {untracked} subject{untracked === 1 ? "" : "s"} in this scope {untracked === 1 ? "has" : "have"} a requirement but no record yet, so {untracked === 1 ? "it shows" : "they show"} as missing.
            {mayApply && <> <Button size="sm" onClick={() => run(ensureObligations)}>Create the records</Button></>}
          </Notice>
          <InlineError text={err} />
        </div>
      )}
      <Panel pad={false}>
        <StdTable label="Requirements" rows={reqs} rowKey={(r) => r.id} onOpen={(r) => open({ kind: "requirement", id: r.id })}
          empty={null}
          cols={[
            { key: "label", label: "Requirement", width: "26%", render: (r) => <Two a={r.label} b={r.description} /> },
            { key: "applies", label: "Applies to", render: (r) => <Two a={selectorText(core, r)} b={r.certificateName ? "Certificate read from People" : r.blocks ? "Holds back: " + r.blocks : undefined} /> },
            { key: "evidence", label: "Evidence expected", hideNarrow: true, render: (r) => <span className="std-wraptext">{r.evidence}</span> },
            { key: "renew", label: "Renewal", hideNarrow: true, render: (r) => r.renewEveryMonths ? "Every " + r.renewEveryMonths + " months" : "None" },
            { key: "reviewers", label: "Reviewers", hideNarrow: true, render: (r) => r.reviewerRoleIds.map(roleLabel).join(", ") || "Administrator" },
            { key: "state", label: "In scope", render: (r) => {
              const c = counts(views.filter((v) => v.requirement.id === r.id));
              return c.length ? <span className="std-chips">{c.map((x) => <Status key={x.state} tone={OBLIGATION_TONE[x.state]}>{x.n} {SHORT[x.state].toLowerCase()}</Status>)}</span>
                : <span className="std-na">None in scope</span>;
            } }
          ]} />
      </Panel>
    </>
  );
}

export function RequirementPanel({ id, onClose, open }: { id: string; onClose: () => void; open: OpenStd }) {
  const { core, q } = useCore();
  const { dy } = useDates();
  const req: RequirementDef | undefined = core.config.standards.requirements.find((r) => r.id === id);
  const views = req ? visibleViews(q, { ignoreScope: true }).filter((v) => v.requirement.id === id) : [];
  const roles = req ? req.reviewerRoleIds.map((r) => core.config.roles.find((x) => x.id === r)?.label || r).join(", ") : "";
  return (
    <SidePanel open onClose={onClose} title={req?.label || "Requirement"} eyebrow="Requirement" width={600}
      footer={can(q.viewer, "settings.edit") ? <><span className="pk-grow" /><Button onClick={() => navigate({ page: "Settings", section: "standardsSetup" })}>Edit in Settings</Button></> : undefined}>
      {!req ? <Empty title="Not found" body="This requirement was removed." /> : (
        <>
          <div className="pk-help" style={{ marginBottom: 12 }}>{req.description}</div>
          <KV items={[
            ["Applies to", selectorText(core, req)],
            ["Evidence expected", req.evidence],
            ["Renewal", req.renewEveryMonths ? "Every " + req.renewEveryMonths + " months" : "No renewal"],
            ["Reviewers", roles || "Administrator"],
            ["Owner", req.ownerId ? q.name(req.ownerId) : "Not set"],
            ["Holds back", req.blocks || "Nothing configured"]
          ]} />
          {req.certificateName && <Notice>Met by the {req.certificateName} certificate held in People. Pulse reads it there and keeps no copy.</Notice>}
          <Section label={subjectKindLabel(core.config, req.appliesTo) + " you can see (" + views.length + ")"}>
            {!views.length ? <div className="pk-help">None you can see.</div> : (
              <div className="pk-list">
                {[...views].sort((a, b) => ORDER.indexOf(b.state) - ORDER.indexOf(a.state) || a.subject.label.localeCompare(b.subject.label)).map((v) => (
                  <button key={v.key} type="button" className="pk-li pk-li--btn" onClick={() => open({ kind: "obligation", key: v.key })}>
                    <span className="pk-grow std-two">
                      <span>{v.subject.label}</span>
                      <span>{v.state === "approved" && v.expiresAt ? "Valid to " + dy(v.expiresAt) : v.obligation?.evidence ? "Version " + v.obligation.evidence.version + " received" : v.subject.detail}{!v.applies ? ". No longer applies" : ""}</span>
                    </span>
                    <StatePill v={v} />
                  </button>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </SidePanel>
  );
}
