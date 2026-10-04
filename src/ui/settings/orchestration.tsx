/* Settings: Agent orchestration. Which runtime executes runs (and exactly
   what a real one needs), default limits for new agents, the organisation
   ceiling no agent may exceed, and an overview of spawn policies. Per-agent
   policy is edited in Agent controls. Edits go through ops.updateConfig. */

import { useCore, type AgentLimits, type OrchestrationSettings } from "../../core";
import { Button, Chip, Field, Notice, Select } from "../kit";
import { Lock, NumberInput, ReadOnlyLine, SaveBar, SubHead, errCount, saveConfig, useCanEdit, useDraft } from "./common";
import type { SectionProps } from "./SettingsPage";

const KEYS: [keyof Omit<AgentLimits, "maxCost">, string, string][] = [
  ["maxDepth", "Delegation depth", "How many levels of delegation below a run."],
  ["maxChildren", "Child runs or workers per run", "Delegations plus temporary workers in one run."],
  ["maxConcurrentRuns", "Runs at once per agent", "Further starts are refused until one finishes."],
  ["maxMinutes", "Minutes per run", "Longest a run may work before it is stopped."]
];

export function OrchestrationSection({ v }: SectionProps) {
  const { core } = useCore();
  const canEdit = useCanEdit();
  const d = useDraft<OrchestrationSettings>(core.config.orchestration);
  const o = d.draft;
  const errors: Record<string, string | undefined> = {};
  for (const [k, label] of KEYS) {
    const c = o.ceiling[k], df = o.defaultLimits[k];
    const min = k === "maxDepth" ? 0 : 1;
    if (!Number.isInteger(c) || c < min) errors["c:" + k] = label + " ceiling must be a whole number of " + min + " or more.";
    if (!Number.isInteger(df) || df < min) errors["d:" + k] = "Whole number of " + min + " or more.";
    else if (Number.isInteger(c) && df > c) errors["d:" + k] = "Cannot be above the ceiling of " + c + ".";
  }
  // Agents whose own limits are above a lowered ceiling are capped at run time; list them so nothing is silent.
  const capped = core.config.agents.filter((a) => !a.archived && a.limits && KEYS.some(([k]) => (a.limits as AgentLimits)[k] > o.ceiling[k]));
  const save = () => { if (!errCount(errors)) saveConfig((c) => { c.orchestration = structuredClone(o); }, "Updated agent orchestration limits"); };
  const external = o.adapter === "external";
  const spawners = core.config.agents.filter((a) => !a.archived);

  return (
    <>
      <div className="st-detail-b">
        {!canEdit && <ReadOnlyLine />}
        <SubHead>Runtime</SubHead>
        <Lock on={!canEdit}>
          <Field label="Runs execute on" help="The adapter every run goes through. Definitions always live in Pulse.">
            <Select ariaLabel="Runtime adapter" value={o.adapter} onChange={(x) => d.update((y) => { y.adapter = x as OrchestrationSettings["adapter"]; })}
              options={[{ value: "sample", label: "Local sample engine (simulated)" }, { value: "external", label: "External runtime" }]} />
          </Field>
        </Lock>
        <div className="st-row">
          <Chip tone={external ? "warn" : "neutral"}>{external ? "Not connected" : "Simulated"}</Chip>
          <span className="pk-help">{external
            ? "No external runtime is connected, so starting, testing and retrying runs is refused with this message. Nothing is started."
            : "The local engine is deterministic. Every run and step it produces is labelled Simulated; it sends nothing and calls no AI model."}</span>
        </div>
        <Notice tone={external ? "warn" : "neutral"}><b>What a real runtime needs:</b> {o.connectionRequirement}</Notice>

        <SubHead>Limits</SubHead>
        <Lock on={!canEdit}>
          <div className="pk-table-wrap">
            <table className="pk-table" aria-label="Execution limits">
              <thead><tr><th>Limit</th><th>Default for new agents</th><th>Organisation ceiling</th></tr></thead>
              <tbody>
                {KEYS.map(([k, label, help]) => (
                  <tr key={k}>
                    <td><div className="pk-strong">{label}</div><div className="pk-help">{help}</div></td>
                    <td><NumberInput ariaLabel={label + " default"} value={o.defaultLimits[k]} invalid={!!errors["d:" + k]} min={k === "maxDepth" ? 0 : 1}
                      onChange={(n) => d.update((y) => { y.defaultLimits[k] = n === null ? NaN : n; })} />{errors["d:" + k] && <div className="pk-error">{errors["d:" + k]}</div>}</td>
                    <td><NumberInput ariaLabel={label + " ceiling"} value={o.ceiling[k]} invalid={!!errors["c:" + k]} min={k === "maxDepth" ? 0 : 1}
                      onChange={(n) => d.update((y) => { y.ceiling[k] = n === null ? NaN : n; })} />{errors["c:" + k] && <div className="pk-error">{errors["c:" + k]}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Lock>
        <div className="pk-help">Cost limits apply only when a runtime reports usage. The sample engine reports none, so cost shows as Unknown and is not enforced.</div>
        {capped.length > 0 && <Notice tone="warn">Above this ceiling, and capped to it when they run: {capped.map((a) => a.name).join(", ")}.</Notice>}

        <SubHead right={<Button size="sm" onClick={() => v.setAdminOpen?.("agents")}>Open Agent controls</Button>}>Spawn policies</SubHead>
        <div className="pk-table-wrap">
          <table className="pk-table" aria-label="Spawn policies">
            <thead><tr><th>Agent</th><th>Temporary workers</th><th>Allowed templates</th><th>Per run</th></tr></thead>
            <tbody>
              {spawners.length === 0 && <tr><td colSpan={4} className="pk-help">No agents yet.</td></tr>}
              {spawners.map((a) => (
                <tr key={a.id}>
                  <td className="pk-strong">{a.name}</td>
                  <td>{a.spawn?.enabled ? <Chip tone="accent">Allowed</Chip> : <Chip plain>Off</Chip>}</td>
                  <td>{a.spawn?.enabled ? a.spawn.templateIds.map((id) => core.config.agentTemplates.find((t) => t.id === id)?.label || id).join(", ") : "None"}</td>
                  <td>{a.spawn?.enabled ? Math.min(a.spawn.maxWorkers, o.ceiling.maxChildren) : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pk-help">A worker gets only the tools its template and the run hold in common, never restricted ones, works within the run's scope, ends with its task and stays in the run's history. Saving one as a permanent agent creates a draft for review.</div>
      </div>
      <SaveBar dirty={d.dirty} errors={errCount(errors)} onSave={save} onDiscard={d.reset} />
    </>
  );
}
