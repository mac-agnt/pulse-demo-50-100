/* Agent details in a side panel: Overview, Responsibilities, Access and tools,
   Runs, Conversation and History. Every action here calls the same operation
   the chart menu calls. Policy (tools, limits, spawning) is edited in
   Settings, Agent controls: one policy store, opened from here in context. */

import { useEffect, useState } from "react";
import AgentFace from "../../components/AgentFace";
import {
  AVAILABILITY_LABEL, RUN_STATE_LABEL, TRIGGER_LABEL, agentLimits, agentReadiness, agentState, archiveAgent, archiveImpact, availabilityOf, can,
  childrenOf, descendantsOf, fmtDateTime, moveAgent, moveImpact, relative, scopeText, setAvailability, store, toolStatus, updateAgent, useCore,
  versionOf, visibleRuns, type AgentDef, type Id
} from "../../core";
import { Button, Chip, Empty, Field, KV, Notice, Section, Select, SidePanel, Tabs, TextArea, TextInput } from "../kit";
import { Conversation } from "./Conversation";
import { StartRunForm } from "./StartRunForm";
import { AvailabilityPill, RunPill, WorkSummary, faceState, openPolicy, workText, type AgentNav, type PanelMode, type PanelTab } from "./shared";

const TABS: { value: PanelTab; label: string }[] = [
  { value: "overview", label: "Overview" }, { value: "responsibilities", label: "Responsibilities" }, { value: "access", label: "Access and tools" },
  { value: "runs", label: "Runs" }, { value: "conversation", label: "Conversation" }, { value: "history", label: "History" }
];

export function AgentPanel({ agentId, tab: tab0, mode: mode0, onClose, nav }: { agentId: Id; tab: PanelTab; mode: PanelMode; onClose: () => void; nav: AgentNav }) {
  const { core, q } = useCore();
  const [tab, setTab] = useState<PanelTab>(tab0);
  const [mode, setMode] = useState<PanelMode>(mode0);
  useEffect(() => { setTab(tab0); setMode(mode0); }, [agentId, tab0, mode0]);
  const a = core.config.agents.find((x) => x.id === agentId);
  if (!a) return null;
  const w = agentState(q, a.id);
  const manage = can(q.viewer, "agents.manage");
  const runOk = can(q.viewer, "agents.run");
  const av = availabilityOf(a);
  const go = (t: PanelTab, m: PanelMode = null) => { setTab(t); setMode(m); };

  return (
    <SidePanel open onClose={onClose} width={660} eyebrow={"Agent · version " + versionOf(a)} title={a.name}
      chips={<><AvailabilityPill agent={a} />{a.templateId && <Chip plain>{core.config.agentTemplates.find((t) => t.id === a.templateId)?.label || "Custom"}</Chip>}</>}
      footer={
        <>
          <Button variant="ghost" onClick={() => openPolicy(a.id)}>Policy in Settings</Button>
          <span className="pk-grow" />
          {!a.archived && av === "ready" && <Button variant="primary" disabled={!runOk} title={runOk ? undefined : "Needs the Start agent runs permission."} onClick={() => go("overview", "start")}>Start a run</Button>}
          {!a.archived && av !== "ready" && <Button variant="primary" disabled={!manage && !runOk} onClick={() => go("overview", "test")}>Test run</Button>}
        </>
      }>
      <Tabs tabs={TABS} value={tab} onChange={(t) => go(t)} />
      <div className="ag-panel-body">
        {tab === "overview" && <Overview a={a} mode={mode} setMode={setMode} nav={nav} manage={manage} runOk={runOk} w={workText(w)} />}
        {tab === "responsibilities" && <Responsibilities a={a} editing={mode === "edit"} setEditing={(e) => setMode(e ? "edit" : null)} manage={manage} nav={nav} />}
        {tab === "access" && <Access a={a} />}
        {tab === "runs" && <Runs a={a} nav={nav} onStart={() => go("overview", "start")} />}
        {tab === "conversation" && <Conversation agent={a} />}
        {tab === "history" && <History a={a} />}
      </div>
    </SidePanel>
  );
}

function Overview({ a, mode, setMode, nav, manage, runOk, w }: { a: AgentDef; mode: PanelMode; setMode: (m: PanelMode) => void; nav: AgentNav; manage: boolean; runOk: boolean; w: string }) {
  const { core, q } = useCore();
  const work = agentState(q, a.id);
  const ready = agentReadiness(core, a);
  const av = availabilityOf(a);
  const coord = a.coordinatorId ? core.config.agents.find((x) => x.id === a.coordinatorId) : undefined;
  const kids = childrenOf(core, a.id);
  const waiting = visibleRuns(q, { ignoreScope: true }).filter((r) => r.agentId === a.id && ["waiting_approval", "waiting_input", "failed", "stop_requested"].includes(r.state));
  const noManage = manage ? undefined : "Needs the Manage agents permission.";

  return (
    <>
      <div className="ag-ov-head">
        <AgentFace shape={a.shape} tint={a.tint} state={faceState(a, work)} size={52} />
        <div className="pk-grow">
          <div className="ag-ov-purpose">{a.purpose}</div>
          <div className="ag-ov-work"><WorkSummary w={work} /><span className="ag-muted">{w === "Idle" ? "No runs in progress you can see." : ""}</span></div>
        </div>
      </div>

      {!a.archived && (
        <div className="ag-actions" role="group" aria-label="Actions">
          <Button size="sm" onClick={() => setMode("start")} disabled={!runOk || av !== "ready"} title={!runOk ? "Needs the Start agent runs permission." : av !== "ready" ? a.name + " is " + AVAILABILITY_LABEL[av].toLowerCase() + "." : undefined}>Start a run</Button>
          <Button size="sm" onClick={() => setMode("test")} disabled={!manage && !runOk}>Test run</Button>
          {av === "ready"
            ? <Button size="sm" onClick={() => setMode("pause")} disabled={!manage} title={noManage}>Pause</Button>
            : <Button size="sm" onClick={() => store.run(setAvailability, a.id, "ready")} disabled={!manage || (!ready.ok && !ready.onlyConnectionsMissing)}
                title={noManage || (!ready.ok && !ready.onlyConnectionsMissing ? "Complete the checklist below first." : undefined)}>{av === "paused" ? "Resume" : "Activate"}</Button>}
          <Button size="sm" onClick={() => setMode("move")} disabled={!manage} title={noManage}>Move</Button>
          <Button size="sm" onClick={() => nav.openAgent(a.id, "responsibilities", "edit")} disabled={!manage} title={noManage}>Edit</Button>
          <Button size="sm" onClick={() => nav.addAgent(a.id)} disabled={!manage} title={noManage}>Add under this agent</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("archive")} disabled={!manage} title={noManage}>Archive</Button>
        </div>
      )}
      {a.archived && <Notice>Archived. It takes no new work; its definition, versions and run history are kept.</Notice>}

      {mode === "start" && <Section label="Start a run"><StartRunForm agentId={a.id} onDone={(id) => { setMode(null); nav.openRun(id); }} onCancel={() => setMode(null)} /></Section>}
      {mode === "test" && <Section label="Test run"><StartRunForm agentId={a.id} test onDone={(id) => { setMode(null); nav.openRun(id); }} onCancel={() => setMode(null)} /></Section>}
      {mode === "pause" && <PauseForm a={a} onDone={() => setMode(null)} />}
      {mode === "move" && <MoveForm a={a} onDone={() => setMode(null)} />}
      {mode === "archive" && <ArchiveForm a={a} onDone={() => setMode(null)} />}

      {!a.archived && !ready.ok && (
        <Section label={av === "draft" ? "Before it can be activated" : "Needed before it takes work"}>
          <ul className="ag-check" aria-label="Prerequisites">
            {ready.items.map((i) => (
              <li key={i.key} data-ok={i.ok}>
                <span className={"ag-check-mark pk-tone-" + (i.ok ? "ok" : "warn")} aria-hidden="true">{i.ok ? "Done" : "To do"}</span>
                <span><b>{i.label}</b>{i.detail ? <span className="ag-muted"> {i.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
          {ready.onlyConnectionsMissing && <div className="ag-muted" style={{ marginTop: 8 }}>Only a connection is missing. Connections are set up in Settings, Systems, Connections; nothing is sent from this demo.</div>}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section label="Needs a person">
          <div className="pk-list">
            {waiting.map((r) => (
              <button key={r.id} type="button" className="pk-li pk-li--btn" onClick={() => nav.openRun(r.id)}>
                <span className="pk-mono">{r.ref}</span><span className="pk-grow ag-ellipsis">{r.goal}</span><RunPill run={r} />
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section label="Place in the organisation">
        <KV items={[
          ["Coordinator", coord ? <button type="button" className="ag-link" onClick={() => nav.openAgent(coord.id)}>{coord.name}</button> : "None (top level)"],
          ["Coordinates", kids.length ? <span className="ag-chips">{kids.map((k) => <button key={k.id} type="button" className="ag-link" onClick={() => nav.openAgent(k.id)}>{k.name}</button>)}</span> : "No agents"],
          ["Accountable owner", q.name(a.responsibleId)],
          ["How work starts", a.trigger ? TRIGGER_LABEL[a.trigger.kind] + (a.trigger.detail && a.trigger.detail.toLowerCase() !== TRIGGER_LABEL[a.trigger.kind].toLowerCase() ? ": " + a.trigger.detail : "") : TRIGGER_LABEL.manual],
          ["Scope", scopeText(core, a.scope.teamIds)],
          ["Version", "Version " + versionOf(a) + (a.createdAt ? ", created " + fmtDateTime(a.createdAt, core.config.timezone) : "")]
        ]} />
        <div className="ag-muted" style={{ marginTop: 8 }}>A coordinator only routes work. It grants no {core.config.terminology.team.toLowerCase()} access or tools: delegated work runs with what both agents hold.</div>
      </Section>
    </>
  );
}

function PauseForm({ a, onDone }: { a: AgentDef; onDone: () => void }) {
  const { core } = useCore();
  const [choice, setChoice] = useState<"allow" | "stop">("allow");
  const active = core.data.agentRuns.filter((r) => r.agentId === a.id && !r.test && !["completed", "failed", "cancelled"].includes(r.state));
  return (
    <Section label="Pause">
      <p className="ag-p">Paused agents take no new work and are not delegated to. {active.length ? "It has " + active.length + " run" + (active.length === 1 ? "" : "s") + " in progress: " + active.map((r) => r.ref).join(", ") + "." : "It has no runs in progress."}</p>
      {active.length > 0 && (
        <div className="ag-radios" role="radiogroup" aria-label="Runs in progress">
          <label><input type="radio" name="ag-pause" checked={choice === "allow"} onChange={() => setChoice("allow")} /> Allow them to finish</label>
          <label><input type="radio" name="ag-pause" checked={choice === "stop"} onChange={() => setChoice("stop")} /> Ask them to stop at the next safe checkpoint (shown as Stop requested until the engine confirms)</label>
        </div>
      )}
      <div className="ag-form-actions">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={() => { if (store.run(setAvailability, a.id, "paused", choice).ok) onDone(); }}>Pause {a.name}</Button>
      </div>
    </Section>
  );
}

function MoveForm({ a, onDone }: { a: AgentDef; onDone: () => void }) {
  const { core } = useCore();
  const below = new Set(descendantsOf(core, a.id).map((d) => d.id));
  const options = core.config.agents.filter((x) => !x.archived && x.id !== a.id && !below.has(x.id));
  const [to, setTo] = useState<string>("");
  const choice = to === "" ? undefined : to === "__top" ? null : to;
  const imp = choice === undefined ? null : moveImpact(core, a.id, choice);
  return (
    <Section label="Move">
      <Field label="New coordinator" help="Agents below this one, and itself, cannot be chosen: that would make a loop.">
        <Select ariaLabel="New coordinator" value={to} onChange={setTo}
          options={[{ value: "", label: "Choose" }, ...(a.coordinatorId ? [{ value: "__top", label: "Top level (no coordinator)" }] : []), ...options.map((x) => ({ value: x.id, label: x.name }))]} />
      </Field>
      {imp && !imp.ok && <Notice tone="warn">{imp.reason}</Notice>}
      {imp && imp.ok && (
        <div className="ag-impact" aria-live="polite">
          <b>From {imp.from} to {imp.to}</b>
          <ul>
            {imp.unchanged.map((u) => <li key={u}>Unchanged. {u}</li>)}
            {imp.carried.length > 0 && <li>Moves with it: {imp.carried.join(", ")}.</li>}
            {imp.narrowedTools.length > 0 && <li>When {imp.to} delegates to {a.name}, these are not passed on because {imp.to} does not hold them: {imp.narrowedTools.join(", ")}. Started directly, {a.name} keeps them.</li>}
            <li>{imp.inFlight.length ? "Runs in progress (" + imp.inFlight.map((r) => r.ref).join(", ") + ") carry on as they started; nothing is reconfigured." : "No runs in progress are affected."}</li>
            {imp.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
      <div className="ag-form-actions">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button variant="primary" disabled={!imp || !imp.ok} onClick={() => { if (choice !== undefined && store.run(moveAgent, a.id, choice).ok) onDone(); }}>Move</Button>
      </div>
    </Section>
  );
}

function ArchiveForm({ a, onDone }: { a: AgentDef; onDone: () => void }) {
  const { core } = useCore();
  const imp = archiveImpact(core, a.id);
  return (
    <Section label="Archive">
      {!imp.ok ? <Notice tone="warn">{imp.reason}</Notice> : (
        <div className="ag-impact">
          <ul>
            <li>It takes no new work and leaves the chart (filter by Archived to see it).</li>
            <li>Its definition, versions and {imp.runs} run{imp.runs === 1 ? "" : "s"} stay in history and keep working as evidence links.</li>
            {imp.children.length > 0 && <li>{imp.children.join(", ")} will sit under {imp.childrenMoveTo}.</li>}
          </ul>
        </div>
      )}
      <div className="ag-form-actions">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button variant="danger" disabled={!imp.ok} onClick={() => { if (store.run(archiveAgent, a.id).ok) onDone(); }}>Archive {a.name}</Button>
      </div>
    </Section>
  );
}

function Responsibilities({ a, editing, setEditing, manage, nav }: { a: AgentDef; editing: boolean; setEditing: (e: boolean) => void; manage: boolean; nav: AgentNav }) {
  const { core, q } = useCore();
  const [d, setD] = useState({ name: a.name, purpose: a.purpose, outputs: (a.outputs || []).join(", "), owner: a.responsibleId, instructions: a.instructions || "",
    trigger: a.trigger?.kind || "manual", detail: a.trigger?.detail || "" });
  useEffect(() => { setD({ name: a.name, purpose: a.purpose, outputs: (a.outputs || []).join(", "), owner: a.responsibleId, instructions: a.instructions || "", trigger: a.trigger?.kind || "manual", detail: a.trigger?.detail || "" }); }, [a, editing]);
  const staff = core.data.people.filter((p) => p.kind === "staff" && p.status === "active");
  if (editing && manage && !a.archived) {
    const save = () => {
      const res = store.run(updateAgent, a.id, {
        name: d.name, purpose: d.purpose, outputs: d.outputs.split(",").map((x) => x.trim()).filter(Boolean), responsibleId: d.owner,
        instructions: d.instructions.trim() || undefined, trigger: { kind: d.trigger as NonNullable<AgentDef["trigger"]>["kind"], detail: d.detail }
      });
      if (res.ok) setEditing(false);
    };
    return (
      <div className="ag-form">
        <Notice>Saving creates version {versionOf(a) + 1}. Runs already in progress keep the version they started with.</Notice>
        <Field label="Name" htmlFor="ag-e-name"><TextInput id="ag-e-name" value={d.name} onChange={(v) => setD({ ...d, name: v })} /></Field>
        <Field label="Responsibility" htmlFor="ag-e-purpose"><TextArea id="ag-e-purpose" rows={2} value={d.purpose} onChange={(v) => setD({ ...d, purpose: v })} /></Field>
        <Field label="Outputs" htmlFor="ag-e-out" help="Separate with commas."><TextInput id="ag-e-out" value={d.outputs} onChange={(v) => setD({ ...d, outputs: v })} /></Field>
        <Field label="Accountable owner"><Select ariaLabel="Accountable owner" value={d.owner} onChange={(v) => setD({ ...d, owner: v })} options={staff.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <div className="pk-grid2">
          <Field label="How work starts"><Select ariaLabel="How work starts" value={d.trigger} onChange={(v) => setD({ ...d, trigger: v as typeof d.trigger })}
            options={(Object.keys(TRIGGER_LABEL) as (keyof typeof TRIGGER_LABEL)[]).map((k) => ({ value: k, label: TRIGGER_LABEL[k] }))} /></Field>
          <Field label="When" htmlFor="ag-e-det"><TextInput id="ag-e-det" value={d.detail} onChange={(v) => setD({ ...d, detail: v })} placeholder="For example: weekdays 07:30" /></Field>
        </div>
        <details className="ag-adv"><summary>Instructions (advanced)</summary>
          <Field label="Instructions" htmlFor="ag-e-ins" help="Plain guidance for the runtime. Never put keys, passwords or tokens here."><TextArea id="ag-e-ins" rows={4} value={d.instructions} onChange={(v) => setD({ ...d, instructions: v })} /></Field>
        </details>
        <div className="ag-muted">Tools, limits and spawning are policy: change them in <button type="button" className="ag-link" onClick={() => openPolicy(a.id)}>Settings, Agent controls</button>.</div>
        <div className="ag-form-actions"><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save version {versionOf(a) + 1}</Button></div>
      </div>
    );
  }
  const kids = childrenOf(core, a.id);
  return (
    <>
      <KV items={[
        ["Responsible for", a.purpose],
        ["Outputs", (a.outputs || []).length ? <ul className="ag-ul">{a.outputs!.map((o) => <li key={o}>{o}</li>)}</ul> : "None listed"],
        ["Accountable owner", q.name(a.responsibleId)],
        ["How work starts", a.trigger ? TRIGGER_LABEL[a.trigger.kind] + (a.trigger.detail && a.trigger.detail.toLowerCase() !== TRIGGER_LABEL[a.trigger.kind].toLowerCase() ? ": " + a.trigger.detail : "") : TRIGGER_LABEL.manual],
        ["Reports to", a.coordinatorId ? <button type="button" className="ag-link" onClick={() => nav.openAgent(a.coordinatorId!)}>{q.name(a.coordinatorId)}</button> : "Nobody (top level)"],
        ["Coordinates", kids.length ? kids.map((k) => k.name).join(", ") : "No agents"],
        ["Instructions", a.instructions || "None"]
      ]} />
      <div className="ag-muted" style={{ marginTop: 10 }}>No scheduler or event bus runs in this demo: a schedule or event is recorded on the definition and nothing starts on its own.</div>
      {manage && !a.archived && <div className="ag-form-actions"><Button onClick={() => setEditing(true)}>Edit responsibilities</Button></div>}
    </>
  );
}

function Access({ a }: { a: AgentDef }) {
  const { core } = useCore();
  const lim = agentLimits(core, a);
  const ceil = core.config.orchestration.ceiling;
  const tools = (a.tools || []).map((id) => ({ id, def: core.config.agentTools.find((t) => t.id === id), st: toolStatus(core, id) }));
  const EFFECT = { read: "Reads Pulse data", write: "Changes Pulse data", external: "Acts outside Pulse" };
  const know = (a.knowledge || []).map((k) => k === "files" ? "Documents" : core.config.recordTypes.find((t) => t.id === k)?.plural || core.config.sources.find((x) => x.id === k)?.label || k);
  return (
    <>
      <Notice>An agent never sees more than the person it works for, and never more than its scope. Restricted tools always wait for a person to approve the action in Work; an agent cannot approve its own action.</Notice>
      <Section label="Scope"><div>{scopeText(core, a.scope.teamIds)}</div></Section>
      <Section label="Tools">
        {tools.length === 0 ? <Empty title="No tools" body="Without a tool it cannot do anything. Add tools in Settings, Agent controls." /> : (
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead><tr><th>Tool</th><th>Effect</th><th>Approval</th><th>Available</th></tr></thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.id}>
                    <td className="pk-strong">{t.def?.label || t.id}</td>
                    <td>{t.def ? EFFECT[t.def.effect] : "Unknown"}</td>
                    <td>{t.def?.restricted ? <Chip tone="warn">Needs approval</Chip> : "Not needed"}</td>
                    <td>{t.st.usable ? <Chip tone="ok">Available</Chip> : <span className="pk-tone-warn" title={t.st.reason}>{t.st.connection ? "Needs " + t.st.connection.label : t.st.reason}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section label="Knowledge it may read"><div>{know.length ? know.join(", ") : "Only what its tools read"}</div></Section>
      <Section label="Execution limits">
        <KV items={[
          ["Delegation depth", lim.maxDepth + " (organisation ceiling " + ceil.maxDepth + ")"],
          ["Child runs or workers per run", lim.maxChildren + " (ceiling " + ceil.maxChildren + ")"],
          ["Runs at once", lim.maxConcurrentRuns + " (ceiling " + ceil.maxConcurrentRuns + ")"],
          ["Minutes per run", lim.maxMinutes + " (ceiling " + ceil.maxMinutes + ")"],
          ["Cost", "Unknown: the sample engine reports no usage, so no cost limit can be enforced"]
        ]} />
      </Section>
      <Section label="Temporary workers">
        <div>{a.spawn?.enabled
          ? "Allowed, up to " + a.spawn.maxWorkers + " per run, from: " + a.spawn.templateIds.map((id) => core.config.agentTemplates.find((t) => t.id === id)?.label || id).join(", ") + ". A worker gets only the tools its template and the run hold in common, never restricted ones, and ends with its task."
          : "Not allowed. Its spawn policy is off."}</div>
      </Section>
      <div className="ag-form-actions"><Button onClick={() => openPolicy(a.id)}>Change in Settings, Agent controls</Button></div>
    </>
  );
}

function Runs({ a, nav, onStart }: { a: AgentDef; nav: AgentNav; onStart: () => void }) {
  const { core, ctx, q } = useCore();
  const runs = visibleRuns(q, { includeTests: true, ignoreScope: true }).filter((r) => r.agentId === a.id).sort((x, y) => y.startedAt.localeCompare(x.startedAt));
  return (
    <>
      {runs.length === 0 ? <Empty title="No runs you can see" body={"Runs of " + a.name + " that you started, own, or that touch your teams appear here."}
        action={availabilityOf(a) === "ready" && !a.archived && can(q.viewer, "agents.run") ? <Button variant="primary" onClick={onStart}>Start a run</Button> : undefined} /> : (
        <div className="pk-list">
          {runs.map((r) => (
            <button key={r.id} type="button" className="pk-li pk-li--btn" onClick={() => nav.openRun(r.id)}>
              <span className="pk-mono">{r.ref}</span>
              <span className="pk-grow ag-ellipsis">{r.goal}</span>
              <span className="ag-muted">{relative(r.startedAt, ctx.now, core.config.timezone)}</span>
              <RunPill run={r} />
            </button>
          ))}
        </div>
      )}
      <div className="ag-muted" style={{ marginTop: 10 }}>Every run here is simulated by the local sample engine. {RUN_STATE_LABEL.waiting_approval} means a person decides in Work.</div>
    </>
  );
}

function History({ a }: { a: AgentDef }) {
  const { core, q } = useCore();
  const runIds = new Set(core.data.agentRuns.filter((r) => r.agentId === a.id).map((r) => r.id));
  const defs = core.data.events.filter((e) => e.objectType === "agent" && e.objectId === a.id);
  const runEv = q.events({ ignoreScope: true }).filter((e) => e.objectType === "agentRun" && runIds.has(e.objectId));
  const all = [...defs, ...runEv].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 40);
  if (!all.length) return <Empty title="No history yet" body="Changes to this definition and its runs are recorded here." />;
  return (
    <ol className="ag-hist">
      {all.map((e) => (
        <li key={e.id}>
          <span className="ag-muted">{fmtDateTime(e.at, core.config.timezone)}</span>
          <span><b>{q.name(e.actorId)}</b> {e.summary}{e.simulated ? <Chip plain>Simulated</Chip> : null}</span>
        </li>
      ))}
    </ol>
  );
}
