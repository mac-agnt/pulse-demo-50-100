/* Start a run (or an isolated test) with a goal and permitted inputs. The
   idempotency key is fixed when the form opens, so submitting twice returns
   the same run instead of starting another. */

import { useMemo, useRef, useState } from "react";
import { adapterFor, describeRef, intersectScope, scopeTeams, store, useCore, type Id } from "../../core";
import { Button, Field, Icon, ICON, Notice, Select, TextArea } from "../kit";
import { inputOptions } from "./shared";

export function StartRunForm({ agentId, test, onDone, onCancel }: { agentId: Id; test?: boolean; onDone: (runId: Id) => void; onCancel?: () => void }) {
  const { core, ctx, q } = useCore();
  const agent = core.config.agents.find((a) => a.id === agentId);
  const [goal, setGoal] = useState("");
  const [inputs, setInputs] = useState<{ kind: string; id: Id }[]>([]);
  const [kind, setKind] = useState("");
  const [pick, setPick] = useState("");
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = useRef("ui:" + agentId + ":" + Date.now().toString(36));
  const groups = useMemo(() => inputOptions(q), [q]);
  if (!agent) return null;

  const v = q.viewer;
  const reach = v.isOrgWide ? "all" as const : [...new Set([...v.memberTeamIds, ...v.overseenTeamIds])];
  const sel = scopeTeams(core, ctx.scope);
  const allowed = intersectScope(intersectScope(agent.scope.teamIds, reach), sel || "all");
  const teamOpts = allowed === "all" ? core.config.teams : core.config.teams.filter((t) => allowed.includes(t.id));
  const group = groups.find((g) => g.kind === kind);
  const add = () => {
    if (!kind || !pick || inputs.some((i) => i.kind === kind && i.id === pick)) return;
    setInputs([...inputs, { kind, id: pick }]);
    setPick("");
  };
  const submit = () => {
    setError(null);
    const adapter = adapterFor(core);
    const input = { goal, inputs, scopeTeamIds: team ? [team] : undefined, idempotencyKey: test ? undefined : key.current };
    const res = test ? store.run(adapter.testRun, agentId, input) : store.run(adapter.startRun, agentId, input);
    if (res.ok && res.id) onDone(res.id);
    else if (!res.ok) setError(res.error);
  };

  return (
    <div className="ag-form" role="group" aria-label={test ? "Test run" : "Start a run"}>
      {test
        ? <Notice>A test reads real data in scope but changes nothing: no tasks are created, no approval is raised and no other agent is asked. It is labelled Test in the run history.</Notice>
        : <Notice>Runs use the local sample engine and are marked Simulated. Restricted actions wait for a person to approve them in Work.</Notice>}
      <Field label="Goal" htmlFor="ag-goal" help={test ? "Optional. Without one, the test uses the agent's responsibility." : "What should the run achieve, in one sentence?"}>
        <TextArea id="ag-goal" rows={2} value={goal} onChange={setGoal} placeholder={test ? agent.purpose : "For example: weekly status for Unit North"} />
      </Field>
      <Field label="Inputs" help="Optional. Only things you can see are offered.">
        <div className="ag-inputs">
          {inputs.map((i) => (
            <span key={i.kind + i.id} className="ag-input-chip">
              {describeRef(core, i)}
              <button type="button" aria-label={"Remove " + describeRef(core, i)} onClick={() => setInputs(inputs.filter((x) => x !== i))}><Icon d={ICON.close} size={10} sw={2.4} /></button>
            </span>
          ))}
          <div className="ag-input-add">
            <Select ariaLabel="Kind of input" value={kind} onChange={(k) => { setKind(k); setPick(""); }} options={[{ value: "", label: "Add an input" }, ...groups.map((g) => ({ value: g.kind, label: g.label }))]} />
            {group && <Select ariaLabel={"Choose a " + group.label.toLowerCase()} value={pick} onChange={setPick} options={[{ value: "", label: "Choose" }, ...group.items.map((i) => ({ value: i.id, label: i.label }))]} />}
            {group && <Button size="sm" onClick={add} disabled={!pick}>Add</Button>}
          </div>
        </div>
      </Field>
      <Field label="Scope" help={"Never wider than the agent's scope or yours. The agent reads only what you could read."}>
        <Select ariaLabel="Scope" value={team} onChange={setTeam}
          options={[{ value: "", label: allowed === "all" ? "Everything the agent and you can both reach" : "All of: " + teamOpts.map((t) => t.label).join(", ") }, ...teamOpts.map((t) => ({ value: t.id, label: "Only " + t.label }))]} />
      </Field>
      {error && <div className="pk-error" role="alert">{error}</div>}
      <div className="ag-form-actions">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" onClick={submit} disabled={!test && !goal.trim()}>{test ? "Run the test" : "Start the run"}</Button>
      </div>
    </div>
  );
}
