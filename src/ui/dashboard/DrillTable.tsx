/* Drill-down: exactly the objects a metric was computed from (result.ids),
   read from the canonical objects. Rows open the object where it lives. */

import { useCore, openObject, navigate, personRows, fmtDate, fmtHours, hoursBetween, ISSUE_LABEL, type Approval, type DataIssue, type MetricResult, type PersonRow, type RecordItem, type RequestItem, type Task } from "../../core";
import { Chip, DataTable, Empty, LABEL, toneOf, PersonName, type Column } from "../kit";
import { dashStore } from "./state";

type Row = { id: string; kind: "task" | "approval" | "record" | "issue" | "request" | "person" | "module"; t?: Task; a?: Approval; r?: RecordItem; i?: DataIssue; q?: RequestItem; p?: PersonRow;
  /** Module entities (projects, invoices, requirements, agent runs): a plain reference, title and state. */
  m?: { ref: string; title: string; state: string; owner?: string | null; open: () => void } };

const STAGE: Record<string, string> = { onboarding: "Onboarding", probation: "Probation", active: "Active", leaving: "Leaving", left: "Left" };
const CERT: Record<string, string> = { missing: "Certificate missing", lapsed: "Certificate lapsed", due: "Renewal due" };

export function DrillTable({ result, pageSize = 8 }: { result: MetricResult; pageSize?: number }) {
  const { core, q, ctx } = useCore();
  const tz = core.config.timezone;
  const issues = result.entity === "issue" ? q.issues({ ignoreScope: true }) : [];
  const people = result.entity === "person" ? personRows(q, { ignoreScope: true }) : [];
  const rows: Row[] = result.ids.map((id): Row | null => {
    switch (result.entity) {
      case "task": { const t = q.task(id); return t ? { id, kind: "task", t } : null; }
      case "approval": { const a = q.approval(id); return a ? { id, kind: "approval", a } : null; }
      case "record": { const r = q.record(id); return r ? { id, kind: "record", r } : null; }
      case "issue": { const i = issues.find((x) => x.id === id); return i ? { id, kind: "issue", i } : null; }
      case "request": { const rq = q.request(id); return rq ? { id, kind: "request", q: rq } : null; }
      case "person": { const p = people.find((x) => x.person.id === id); return p ? { id, kind: "person", p } : null; }
      case "project": {
        const p = core.data.projects.find((x) => x.id === id);
        return p && q.canSee({ ownerIds: [p.ownerId], teamId: p.teamId, unitId: p.unitId, visibility: p.visibility })
          ? { id, kind: "module", m: { ref: p.ref, title: p.title, state: p.status.replace("_", " "), owner: p.ownerId, open: () => openObject("project", id) } } : null;
      }
      case "invoice": {
        const x = core.data.invoices.find((v) => v.id === id);
        return x ? { id, kind: "module", m: { ref: x.ref, title: (core.data.suppliers.find((s) => s.id === x.supplierId)?.name || "Supplier") + ", " + x.amount.toLocaleString("en-IE") + " " + x.currency, state: x.status.replace("_", " "), open: () => openObject("invoice", id) } } : null;
      }
      case "requirement": {
        const o = core.data.obligations.find((v) => v.id === id);
        const req = o ? core.config.standards.requirements.find((r) => r.id === o.requirementId) : core.config.standards.requirements.find((r) => r.id === id);
        if (o) return { id, kind: "module", m: { ref: o.id, title: (req?.label || o.requirementId) + " (" + o.subject.kind + ")", state: o.state.replace("_", " "), open: () => openObject("obligation", id) } };
        return req ? { id, kind: "module", m: { ref: req.id, title: req.label, state: "requirement", open: () => openObject("obligation", id) } } : null;
      }
      case "agentRun": {
        const r = core.data.agentRuns.find((v) => v.id === id);
        return r ? { id, kind: "module", m: { ref: r.ref, title: r.goal, state: r.state.replace("_", " "), owner: r.agentId, open: () => openObject("agentRun", id) } } : null;
      }
      default: return null;
    }
  }).filter((x): x is Row => !!x);

  const reqOf = (a?: Approval) => (a ? q.request(a.requestId) : undefined);
  let columns: Column<Row>[] = [];
  let search: (r: Row) => string = () => "";
  switch (result.entity) {
    case "task":
      columns = [
        { key: "title", label: "Task", strong: true, priority: 1, value: (r) => r.t!.title, width: "38%" },
        { key: "status", label: "Status", priority: 1, value: (r) => (q.isOverdue(r.t!) ? "Overdue" : LABEL.task[r.t!.status]),
          render: (r) => <Chip tone={toneOf.task(r.t!.status, q.isOverdue(r.t!))}>{q.isOverdue(r.t!) ? "Overdue" : LABEL.task[r.t!.status]}</Chip> },
        { key: "assignee", label: "Assignee", priority: 2, value: (r) => q.name(r.t!.assigneeId), render: (r) => <PersonName id={r.t!.assigneeId} /> },
        { key: "team", label: "Team", priority: 3, value: (r) => q.teamLabel(r.t!.teamId) },
        { key: "due", label: "Due", priority: 2, value: (r) => r.t!.dueAt || "", render: (r) => fmtDate(r.t!.dueAt, tz, true) },
        { key: "done", label: "Completed", priority: 3, value: (r) => r.t!.completedAt || "", render: (r) => (r.t!.completedAt ? fmtDate(r.t!.completedAt, tz, true) : "Not yet") }
      ];
      search = (r) => r.t!.title + " " + q.name(r.t!.assigneeId);
      break;
    case "approval":
      columns = [
        { key: "req", label: "Request", strong: true, priority: 1, value: (r) => (reqOf(r.a)?.ref || "") + " " + (reqOf(r.a)?.title || ""), width: "38%" },
        { key: "status", label: "Decision", priority: 1, value: (r) => LABEL.approval[r.a!.status], render: (r) => <Chip tone={toneOf.approval(r.a!.status)}>{LABEL.approval[r.a!.status]}</Chip> },
        { key: "sub", label: "Submitted", priority: 3, value: (r) => r.a!.submittedAt, render: (r) => fmtDate(r.a!.submittedAt, tz, true) },
        { key: "dec", label: "Decided", priority: 2, value: (r) => r.a!.decidedAt || "", render: (r) => (r.a!.decidedAt ? fmtDate(r.a!.decidedAt, tz, true) : "Not yet") },
        { key: "hours", label: "Turnaround", priority: 2, align: "right", value: (r) => (r.a!.decidedAt ? hoursBetween(r.a!.submittedAt, r.a!.decidedAt) : null),
          render: (r) => (r.a!.decidedAt ? fmtHours(hoursBetween(r.a!.submittedAt, r.a!.decidedAt)) : "None") }
      ];
      search = (r) => (reqOf(r.a)?.ref || "") + " " + (reqOf(r.a)?.title || "");
      break;
    case "record":
      columns = [
        { key: "ref", label: "Ref", priority: 2, value: (r) => r.r!.ref, render: (r) => <span className="pk-mono" style={{ fontSize: 12 }}>{r.r!.ref}</span> },
        { key: "title", label: "Record", strong: true, priority: 1, value: (r) => r.r!.title, width: "34%" },
        { key: "type", label: "Type", priority: 3, value: (r) => core.config.recordTypes.find((t) => t.id === r.r!.typeId)?.label || r.r!.typeId },
        { key: "status", label: "Status", priority: 2, value: (r) => r.r!.status, render: (r) => {
          const st = core.config.recordTypes.find((t) => t.id === r.r!.typeId)?.statuses.find((s) => s.id === r.r!.status);
          return <Chip tone={st?.tone || "neutral"}>{st?.label || r.r!.status}</Chip>;
        } },
        { key: "team", label: "Team", priority: 3, value: (r) => q.teamLabel(r.r!.teamId) },
        { key: "owner", label: "Owner", priority: 3, value: (r) => q.name(r.r!.ownerId) }
      ];
      search = (r) => r.r!.ref + " " + r.r!.title;
      break;
    case "issue":
      columns = [
        { key: "title", label: "Issue", strong: true, priority: 1, value: (r) => r.i!.title, width: "40%" },
        { key: "kind", label: "Kind", priority: 2, value: (r) => ISSUE_LABEL[r.i!.kind] },
        { key: "sev", label: "Severity", priority: 1, value: (r) => r.i!.severity, render: (r) => <Chip tone={toneOf.severity(r.i!.severity)}>{r.i!.severity[0].toUpperCase() + r.i!.severity.slice(1)}</Chip> },
        { key: "state", label: "State", priority: 3, value: (r) => (r.i!.state === "in_progress" ? "In progress" : "Open") },
        { key: "owner", label: "Owner", priority: 3, value: (r) => q.name(r.i!.ownerId) }
      ];
      search = (r) => r.i!.title;
      break;
    case "request":
      columns = [
        { key: "ref", label: "Ref", priority: 2, value: (r) => r.q!.ref, render: (r) => <span className="pk-mono" style={{ fontSize: 12 }}>{r.q!.ref}</span> },
        { key: "title", label: "Request", strong: true, priority: 1, value: (r) => r.q!.title, width: "36%" },
        { key: "value", label: "Value", priority: 1, align: "right", value: (r) => (typeof r.q!.fields.value === "number" ? r.q!.fields.value : null),
          render: (r) => (typeof r.q!.fields.value === "number" ? r.q!.fields.value.toLocaleString("en-IE") : "None") },
        { key: "who", label: "Requester", priority: 3, value: (r) => q.name(r.q!.requesterId) },
        { key: "status", label: "Status", priority: 2, value: (r) => LABEL.request[r.q!.status] }
      ];
      search = (r) => r.q!.ref + " " + r.q!.title;
      break;
    case "person":
      columns = [
        { key: "name", label: "Person", strong: true, priority: 1, value: (r) => r.p!.person.name, width: "30%" },
        { key: "title", label: "Role", priority: 3, value: (r) => r.p!.person.title },
        { key: "team", label: "Team", priority: 2, value: (r) => r.p!.team },
        { key: "stage", label: "Stage", priority: 2, value: (r) => STAGE[r.p!.e.stage] || r.p!.e.stage },
        { key: "certs", label: "Certificates", priority: 1, value: (r) => (r.p!.certIssue ? CERT[r.p!.certIssue] : "In date"),
          render: (r) => <Chip tone={r.p!.certIssue === "lapsed" || r.p!.certIssue === "missing" ? "bad" : r.p!.certIssue === "due" ? "warn" : "ok"}>{r.p!.certIssue ? CERT[r.p!.certIssue] : "In date"}</Chip> },
        { key: "away", label: "Away", priority: 3, value: (r) => (r.p!.awayNow ? "Until " + fmtDate(r.p!.awayNow.to, tz) : "No") }
      ];
      search = (r) => r.p!.person.name + " " + r.p!.team;
      break;
  }

  if (columns.length === 0) {
    columns = [
      { key: "ref", label: "Ref", priority: 2, value: (r) => r.m?.ref || "", render: (r) => <span className="pk-mono" style={{ fontSize: 12 }}>{r.m?.ref}</span> },
      { key: "title", label: "Item", strong: true, priority: 1, value: (r) => r.m?.title || "", width: "46%" },
      { key: "state", label: "State", priority: 1, value: (r) => r.m?.state || "" },
      { key: "owner", label: "Owner", priority: 3, value: (r) => (r.m?.owner ? q.name(r.m.owner) : "") }
    ];
    search = (r) => (r.m?.ref || "") + " " + (r.m?.title || "");
  }

  const hidden = result.ids.length - rows.length;
  return (
    <DataTable<Row>
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      caption={"Objects counted in " + result.def.label}
      searchText={search}
      searchPlaceholder="Search these rows"
      pageSize={pageSize}
      onOpen={(r) => {
        dashStore.set({ metricId: null });
        if (r.kind === "module") r.m?.open();
        else openObject(r.kind, r.id);
      }}
      empty={<Empty title="Nothing counted" body={"This figure is computed from no objects in " + (ctx.scope.kind === "personal" ? "your work" : "this scope") + "."} />}
      footerNote={hidden > 0 ? hidden + " counted objects are not visible to you" : "Exactly the objects behind the figure"}
    />
  );
}
