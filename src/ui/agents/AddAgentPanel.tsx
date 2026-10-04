/* Add an agent, in short plain-language steps: start from a template or
   blank; name, responsibility, outputs and owner; place and scope; tools and
   approvals from authorised choices; how work starts; limits and a preview.
   Save as Draft persists it and places it in the chart at once. Then test it
   in isolation, activate it when the checklist passes, and optionally start a
   first task. No provider keys or secrets are ever asked for. */

import { useMemo, useState } from "react";
import {
  TRIGGER_LABEL, agentReadiness, can, createAgent, lastTest, moduleEnabled, setAvailability, store, toolStatus, useCore,
  RUN_STATE_LABEL, failureOf, type AgentDef, type AgentLimits, type Id, type SpawnPolicy
} from "../../core";
import { Button, Field, Notice, Select, SidePanel, TextArea, TextInput } from "../kit";
import { StartRunForm } from "./StartRunForm";
import type { AgentNav } from "./shared";

type TriggerKind = NonNullable<AgentDef["trigger"]>["kind"];
interface Draft {
  templateId: string | null; name: string; purpose: string; outputs: string; owner: Id; coordinatorId: string; scopeAll: boolean; teams: Id[];
  tools: string[]; knowledge: string[]; trigger: TriggerKind; detail: string; limits: AgentLimits; spawn: SpawnPolicy; instructions: string;
}

const STEPS = ["Start from", "Basics", "Place and scope", "Tools and approvals", "How work starts", "Limits and preview"];

export function AddAgentPanel({ coordinatorId, templateId, onClose, nav }: { coordinatorId?: Id | null; templateId?: string; onClose: () => void; nav: AgentNav }) {
  const { core, q } = useCore();
  const manage = can(q.viewer, "agents.manage");
  const tplOf = (id: string | null) => core.config.agentTemplates.find((t) => t.id === id);
  const fromTemplate = (id: string | null, base: Draft): Draft => {
    const t = tplOf(id);
    if (!t) return { ...base, templateId: null };
    return { ...base, templateId: t.id, name: base.name || t.label, purpose: t.description, outputs: t.outputs.join(", "),
      tools: t.tools.filter((x) => { const d = core.config.agentTools.find((y) => y.id === x); return !!d && (!d.module || moduleEnabled(core.config, d.module)); }),
      trigger: (base.coordinatorId && t.defaultTrigger?.kind !== "schedule" ? "delegated" : t.defaultTrigger?.kind) || "manual",
      detail: base.coordinatorId && t.defaultTrigger?.kind !== "schedule" ? "Delegated by " + (core.config.agents.find((a) => a.id === base.coordinatorId)?.name || "its coordinator") : t.defaultTrigger?.detail || "" };
  };
  const blank: Draft = {
    templateId: null, name: "", purpose: "", outputs: "", owner: q.viewer.person.id, coordinatorId: coordinatorId || "", scopeAll: true, teams: [], tools: [], knowledge: [],
    trigger: coordinatorId ? "delegated" : "manual", detail: coordinatorId ? "Delegated by " + (core.config.agents.find((a) => a.id === coordinatorId)?.name || "its coordinator") : "Started by a person",
    limits: { ...core.config.orchestration.defaultLimits }, spawn: { enabled: false, templateIds: [], maxWorkers: 1 }, instructions: ""
  };
  const [d, setD] = useState<Draft>(() => (templateId ? fromTemplate(templateId, blank) : blank));
  const [step, setStep] = useState(templateId ? 1 : 0);
  const [err, setErr] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<Id | null>(null);
  const [testing, setTesting] = useState(false);
  const [starting, setStarting] = useState(false);
  const up = (p: Partial<Draft>) => setD({ ...d, ...p });
  const T = core.config.terminology;
  const ceil = core.config.orchestration.ceiling;

  const staff = core.data.people.filter((p) => p.kind === "staff" && p.status === "active");
  const coordinators = core.config.agents.filter((a) => !a.archived);
  const tools = core.config.agentTools.filter((t) => !t.module || moduleEnabled(core.config, t.module));
  const workerTpls = core.config.agentTemplates.filter((t) => t.workerOk && (!t.module || moduleEnabled(core.config, t.module)));
  const restricted = d.tools.filter((t) => core.config.agentTools.find((x) => x.id === t)?.restricted);
  const needsConn = d.tools.map((t) => toolStatus(core, t)).filter((s) => !s.usable && s.connection);

  const check = (i: number): string | null => {
    if (i === 1) {
      if (d.name.trim().length < 2) return "Give the agent a name.";
      if (!d.purpose.trim()) return "Say what it is responsible for, in one or two sentences.";
      if (!d.owner) return "Choose the person who answers for it.";
    }
    if (i === 2 && !d.scopeAll && !d.teams.length) return "Choose at least one " + T.team.toLowerCase() + ", or all.";
    if (i === 3 && !d.tools.length) return "Choose at least one tool. Without one it cannot do anything.";
    if (i === 4) {
      if (d.trigger === "delegated" && !d.coordinatorId) return "Work that starts by delegation needs a coordinator. Choose one in Place and scope, or another way to start.";
      if ((d.trigger === "schedule" || d.trigger === "event") && !d.detail.trim()) return "Say when it should start.";
    }
    return null;
  };
  const next = () => { const e = check(step); setErr(e); if (!e) setStep(step + 1); };
  const save = () => {
    for (let i = 1; i < STEPS.length; i++) { const e = check(i); if (e) { setErr(e); setStep(i); return; } }
    const res = store.run(createAgent, {
      name: d.name, purpose: d.purpose, outputs: d.outputs.split(",").map((x) => x.trim()).filter(Boolean), responsibleId: d.owner,
      coordinatorId: d.coordinatorId || null, scope: { teamIds: d.scopeAll ? "all" : d.teams }, tools: d.tools, knowledge: d.knowledge,
      trigger: { kind: d.trigger, detail: d.detail }, limits: d.limits, spawn: d.spawn, templateId: d.templateId || undefined, instructions: d.instructions || undefined
    });
    if (res.ok && res.id) { setSavedId(res.id); setErr(null); } else if (!res.ok) setErr(res.error);
  };

  if (!manage) {
    return (
      <SidePanel open onClose={onClose} title="Add agent" eyebrow="Agents">
        <Notice tone="warn">Adding agents needs the Manage agents permission. Ask an administrator.</Notice>
      </SidePanel>
    );
  }

  const saved = savedId ? core.config.agents.find((a) => a.id === savedId) : undefined;
  if (saved) return <AfterSave a={saved} onClose={onClose} nav={nav} testing={testing} setTesting={setTesting} starting={starting} setStarting={setStarting} />;

  return (
    <SidePanel open onClose={onClose} width={640} eyebrow={"Add agent · step " + (step + 1) + " of " + (STEPS.length + 1)} title={STEPS[step]}
      footer={<>
        {step > 0 && <Button variant="ghost" onClick={() => { setErr(null); setStep(step - 1); }}>Back</Button>}
        <span className="pk-grow" />
        {step < STEPS.length - 1 ? <Button variant="primary" onClick={next}>Next</Button> : <Button variant="primary" onClick={save}>Save as draft</Button>}
      </>}>
      <ol className="ag-steps" aria-label="Steps">
        {[...STEPS, "Test and activate"].map((s, i) => <li key={s} data-on={i === step} data-done={i < step}>{s}</li>)}
      </ol>
      <div className="ag-form">
        {step === 0 && (
          <div className="ag-pick" role="radiogroup" aria-label="Start from">
            <label className="ag-pick-row" data-on={!d.templateId}>
              <input type="radio" name="ag-tpl" checked={!d.templateId} onChange={() => up({ templateId: null })} />
              <span><b>Blank</b><span className="ag-muted">Describe it yourself.</span></span>
            </label>
            {core.config.agentTemplates.map((t) => {
              const off = !!t.module && !moduleEnabled(core.config, t.module);
              return (
                <label key={t.id} className="ag-pick-row" data-on={d.templateId === t.id} aria-disabled={off || undefined}>
                  <input type="radio" name="ag-tpl" disabled={off} checked={d.templateId === t.id} onChange={() => setD(fromTemplate(t.id, { ...d, name: "" }))} />
                  <span><b>{t.label}</b><span className="ag-muted">{t.description}{off ? " Needs the " + (core.config.modules[t.module!]?.label || t.module) + " module." : ""}</span></span>
                </label>
              );
            })}
          </div>
        )}
        {step === 1 && (
          <>
            <Field label="Name" htmlFor="ad-name" help="An editable name people will recognise."><TextInput id="ad-name" value={d.name} onChange={(v) => up({ name: v })} /></Field>
            <Field label="What it is responsible for" htmlFor="ad-purpose"><TextArea id="ad-purpose" rows={3} value={d.purpose} onChange={(v) => up({ purpose: v })} placeholder="For example: checks received evidence against its requirement and lists gaps for the reviewer." /></Field>
            <Field label="What it produces" htmlFor="ad-out" help="Separate with commas."><TextInput id="ad-out" value={d.outputs} onChange={(v) => up({ outputs: v })} placeholder="For example: Gap list" /></Field>
            <Field label="Accountable owner" help="The person who answers for what it does."><Select ariaLabel="Accountable owner" value={d.owner} onChange={(v) => up({ owner: v })} options={staff.map((p) => ({ value: p.id, label: p.name }))} /></Field>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Coordinator (optional)" help="A coordinator can route work to it. It grants no access or tools: delegated work runs with what both hold.">
              <Select ariaLabel="Coordinator" value={d.coordinatorId} onChange={(v) => up({ coordinatorId: v, ...(v === "" && d.trigger === "delegated" ? { trigger: "manual" as TriggerKind, detail: "Started by a person" } : {}) })}
                options={[{ value: "", label: "None, top level" }, ...coordinators.map((a) => ({ value: a.id, label: a.name }))]} />
            </Field>
            <Field label="Scope" help={"It never reads more than the person it works for, and never outside these " + T.teams.toLowerCase() + "."}>
              <div className="ag-checks">
                <label><input type="checkbox" checked={d.scopeAll} onChange={(e) => up({ scopeAll: e.target.checked })} /> All {T.teams.toLowerCase()}</label>
                {!d.scopeAll && core.config.teams.map((t) => (
                  <label key={t.id}><input type="checkbox" checked={d.teams.includes(t.id)} onChange={(e) => up({ teams: e.target.checked ? [...d.teams, t.id] : d.teams.filter((x) => x !== t.id) })} /> {t.label}</label>
                ))}
              </div>
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            <Field label="Tools" help="Only tools the organisation offers, for modules that are switched on.">
              <div className="ag-checks ag-checks--tools">
                {tools.map((t) => {
                  const st = toolStatus(core, t.id);
                  return (
                    <label key={t.id} title={t.description}>
                      <input type="checkbox" checked={d.tools.includes(t.id)} onChange={(e) => up({ tools: e.target.checked ? [...d.tools, t.id] : d.tools.filter((x) => x !== t.id) })} />
                      <span><b>{t.label}</b> <span className="ag-muted">{t.description}</span>
                        {t.restricted && <span className="pk-tone-warn"> Needs approval each time.</span>}
                        {!st.usable && st.connection && <span className="pk-tone-warn"> Needs {st.connection.label}.</span>}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Knowledge it may read">
              <div className="ag-checks">
                {[...core.config.recordTypes.map((r) => ({ id: r.id, label: r.plural })), { id: "files", label: "Documents" }].map((k) => (
                  <label key={k.id}><input type="checkbox" checked={d.knowledge.includes(k.id)} onChange={(e) => up({ knowledge: e.target.checked ? [...d.knowledge, k.id] : d.knowledge.filter((x) => x !== k.id) })} /> {k.label}</label>
                ))}
              </div>
            </Field>
            <Notice tone={restricted.length ? "warn" : "neutral"}>
              {restricted.length
                ? "These always wait for a person: " + restricted.map((t) => core.config.agentTools.find((x) => x.id === t)?.label).join(", ") + ". The request goes to a team manager or administrator in Work; the agent never approves its own action, and approving and running are separate steps."
                : "None of these tools needs approval. Anything restricted you add later will wait for a person in Work."}
              {needsConn.length > 0 && " Until " + needsConn.map((s) => s.connection!.label).join(" and ") + " is connected it shows as Connection required."}
            </Notice>
          </>
        )}
        {step === 4 && (
          <>
            <div className="ag-radios" role="radiogroup" aria-label="How work starts">
              {(Object.keys(TRIGGER_LABEL) as TriggerKind[]).map((k) => (
                <label key={k}><input type="radio" name="ag-trig" checked={d.trigger === k} disabled={k === "delegated" && !d.coordinatorId}
                  onChange={() => up({ trigger: k, detail: k === "manual" ? "Started by a person" : k === "delegated" ? "Delegated by " + (core.config.agents.find((a) => a.id === d.coordinatorId)?.name || "its coordinator") : "" })} />
                  {TRIGGER_LABEL[k]}{k === "delegated" && !d.coordinatorId ? " (needs a coordinator)" : ""}</label>
              ))}
            </div>
            {(d.trigger === "schedule" || d.trigger === "event") && (
              <Field label={d.trigger === "schedule" ? "When" : "Which event"} htmlFor="ad-det"><TextInput id="ad-det" value={d.detail} onChange={(v) => up({ detail: v })} placeholder={d.trigger === "schedule" ? "For example: weekdays 07:30" : "For example: when a request is submitted"} /></Field>
            )}
            <Notice>This demo has no scheduler or event bus. A schedule or event is recorded on the definition; nothing starts on its own, and activating never starts a loop or sends anything.</Notice>
          </>
        )}
        {step === 5 && (
          <>
            <details className="ag-adv">
              <summary>Advanced: limits, temporary workers and instructions</summary>
              <div className="pk-grid2">
                {([["maxDepth", "Delegation depth"], ["maxChildren", "Child runs or workers per run"], ["maxConcurrentRuns", "Runs at once"], ["maxMinutes", "Minutes per run"]] as const).map(([k, label]) => (
                  <Field key={k} label={label} help={"At most " + ceil[k] + ", the organisation ceiling."}>
                    <input className="pk-input" type="number" min={k === "maxDepth" ? 0 : 1} max={ceil[k]} value={d.limits[k]} aria-label={label}
                      onChange={(e) => up({ limits: { ...d.limits, [k]: Math.max(0, Math.min(ceil[k], Number(e.target.value) || 0)) } })} />
                  </Field>
                ))}
              </div>
              <label className="ag-checks"><span><input type="checkbox" checked={d.spawn.enabled} onChange={(e) => up({ spawn: { ...d.spawn, enabled: e.target.checked, templateIds: e.target.checked && !d.spawn.templateIds.length && workerTpls[0] ? [workerTpls[0].id] : d.spawn.templateIds } })} /> May create temporary workers</span></label>
              {d.spawn.enabled && (
                <div className="ag-checks">
                  {workerTpls.map((t) => <label key={t.id}><input type="checkbox" checked={d.spawn.templateIds.includes(t.id)} onChange={(e) => up({ spawn: { ...d.spawn, templateIds: e.target.checked ? [...d.spawn.templateIds, t.id] : d.spawn.templateIds.filter((x) => x !== t.id) } })} /> {t.label}</label>)}
                  <label>Workers per run <input className="pk-input" style={{ width: 80 }} type="number" min={1} max={ceil.maxChildren} value={d.spawn.maxWorkers}
                    onChange={(e) => up({ spawn: { ...d.spawn, maxWorkers: Math.max(1, Math.min(ceil.maxChildren, Number(e.target.value) || 1)) } })} aria-label="Workers per run" /></label>
                </div>
              )}
              <Field label="Instructions" htmlFor="ad-ins" help="Plain guidance for the runtime. Never put keys, passwords or tokens here; provider keys are held server-side.">
                <TextArea id="ad-ins" rows={3} value={d.instructions} onChange={(v) => up({ instructions: v })} />
              </Field>
            </details>
            <div className="ag-preview" aria-live="polite">
              <div className="pf-eyebrow">Preview</div>
              <b>{d.name || "Unnamed agent"}</b>
              <p>{d.purpose || "No responsibility yet."}</p>
              <ul className="ag-ul">
                <li>Owner: {q.name(d.owner)}. Coordinator: {d.coordinatorId ? q.name(d.coordinatorId) : "none, top level"}.</li>
                <li>Scope: {d.scopeAll ? "all " + T.teams.toLowerCase() : d.teams.map((t) => q.teamLabel(t)).join(", ")}.</li>
                <li>Tools: {d.tools.map((t) => core.config.agentTools.find((x) => x.id === t)?.label || t).join(", ") || "none"}.{restricted.length ? " Needs approval: " + restricted.length + "." : ""}</li>
                <li>Starts: {TRIGGER_LABEL[d.trigger].toLowerCase()}{d.detail && d.detail.toLowerCase() !== TRIGGER_LABEL[d.trigger].toLowerCase() ? " (" + d.detail + ")" : ""}.</li>
                <li>Limits: depth {d.limits.maxDepth}, {d.limits.maxChildren} child runs, {d.limits.maxConcurrentRuns} at once, {d.limits.maxMinutes} minutes. Temporary workers: {d.spawn.enabled ? "up to " + d.spawn.maxWorkers : "not allowed"}.</li>
              </ul>
              <div className="ag-muted">It is saved as a Draft and appears in the chart immediately. It does nothing until it passes a test and you activate it.</div>
            </div>
          </>
        )}
        {err && <div className="pk-error" role="alert">{err}</div>}
      </div>
    </SidePanel>
  );
}

function AfterSave({ a, onClose, nav, testing, setTesting, starting, setStarting }: {
  a: AgentDef; onClose: () => void; nav: AgentNav; testing: boolean; setTesting: (b: boolean) => void; starting: boolean; setStarting: (b: boolean) => void;
}) {
  const { core, q } = useCore();
  const ready = useMemo(() => agentReadiness(core, a), [core, a]);
  const t = lastTest(core, a.id);
  const av = a.availability || "draft";
  const canRun = can(q.viewer, "agents.run");
  return (
    <SidePanel open onClose={onClose} width={640} eyebrow={"Add agent · step " + (STEPS.length + 1) + " of " + (STEPS.length + 1)} title={"Test and activate " + a.name}
      footer={<><Button variant="ghost" onClick={() => { onClose(); nav.openAgent(a.id); }}>Open details</Button><span className="pk-grow" /><Button onClick={onClose}>Done</Button></>}>
      <Notice tone="ok">Saved as a draft and placed in the chart{a.coordinatorId ? " under " + q.name(a.coordinatorId) : ""}. It is stored with the rest of the organisation and survives a reload.</Notice>
      <ol className="ag-check" aria-label="Prerequisites">
        {ready.items.map((i) => (
          <li key={i.key} data-ok={i.ok}><span className={"ag-check-mark pk-tone-" + (i.ok ? "ok" : "warn")} aria-hidden="true">{i.ok ? "Done" : "To do"}</span><span><b>{i.label}</b>{i.detail ? <span className="ag-muted"> {i.detail}</span> : null}</span></li>
        ))}
      </ol>
      {t && <div className="ag-muted">Last test: <button type="button" className="ag-link" onClick={() => nav.openRun(t.id)}>{t.ref}</button>, {RUN_STATE_LABEL[t.state].toLowerCase()}{t.state === "failed" ? ": " + (failureOf(t)?.business || "") : ""}.</div>}
      <div className="ag-form-actions" style={{ justifyContent: "flex-start" }}>
        <Button onClick={() => setTesting(!testing)}>{t ? "Test again" : "Run a test"}</Button>
        {av !== "ready" && <Button variant="primary" disabled={!ready.ok && !ready.onlyConnectionsMissing} onClick={() => store.run(setAvailability, a.id, "ready")}
          title={!ready.ok && !ready.onlyConnectionsMissing ? "Complete the checklist first." : undefined}>Activate</Button>}
        {av === "ready" && <Button variant="primary" disabled={!canRun} onClick={() => setStarting(!starting)}>Start a first task</Button>}
      </div>
      {testing && <StartRunForm agentId={a.id} test onDone={() => setTesting(false)} onCancel={() => setTesting(false)} />}
      {starting && <StartRunForm agentId={a.id} onDone={(id) => { onClose(); nav.openRun(id); }} onCancel={() => setStarting(false)} />}
      {av === "connection_required" && <Notice tone="warn">Connection required: {ready.connections.map((c) => c.label + ". " + c.prerequisite).join(" ")}</Notice>}
    </SidePanel>
  );
}
