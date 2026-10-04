/* Templates: reusable capabilities (not job titles) with what they take, what
   they produce and the tools they use. Tools that need a connection or a
   switched-off module are shown as unavailable until configured. */

import { TRIGGER_LABEL, can, moduleEnabled, toolStatus, useCore, type AgentTemplateDef } from "../../core";
import { Btn, Pill, eyebrowOf } from "../frame";
import { Empty } from "../kit";
import type { AgentNav } from "./shared";

export function TemplatesView({ nav }: { nav: AgentNav }) {
  const { core, q } = useCore();
  const manage = can(q.viewer, "agents.manage");
  const tpls = core.config.agentTemplates;
  const used = (t: AgentTemplateDef) => core.config.agents.filter((a) => a.templateId === t.id && !a.archived).length;

  return (
    <>
      <div className="ag-head">
        <div className="pk-grow">
          <div className="pf-eyebrow">{eyebrowOf("Agents", "Templates")}</div>
          <h1 className="ag-title">Templates</h1>
          <div className="ag-sub">Reusable capabilities. Creating an agent from one copies it into a draft you can change; the template stays as it is.</div>
        </div>
        <Btn primary onClick={() => nav.addAgent(null)} disabled={!manage} title={manage ? undefined : "Needs the Manage agents permission."}>Add agent from blank</Btn>
      </div>
      {tpls.length === 0 ? <Empty title="No templates" body="Templates are part of the organisation's configuration." /> : (
        <div className="pf-panel ag-tpls">
          {tpls.map((t) => {
            const modOff = !!t.module && !moduleEnabled(core.config, t.module);
            return (
              <div key={t.id} className="ag-tpl">
                <div className="ag-tpl-main">
                  <div className="ag-tpl-h">
                    <b>{t.label}</b>
                    {t.workerOk && <Pill tone="neutral" dot={false}>Can be a temporary worker</Pill>}
                    {modOff && <Pill tone="warn">Needs the {core.config.modules[t.module!]?.label || t.module} module</Pill>}
                    <span className="ag-muted">{used(t) ? used(t) + " agent" + (used(t) === 1 ? "" : "s") + " use it" : "Not used yet"}</span>
                  </div>
                  <p>{t.description}</p>
                  <div className="ag-tpl-io"><span><span className="ag-muted">Takes</span> {t.inputs.join(", ")}</span><span><span className="ag-muted">Produces</span> {t.outputs.join(", ")}</span>
                    <span><span className="ag-muted">Starts</span> {t.defaultTrigger ? TRIGGER_LABEL[t.defaultTrigger.kind].toLowerCase() : "by a person"}</span></div>
                  <div className="ag-tools">
                    {t.tools.map((id) => {
                      const st = toolStatus(core, id);
                      const def = core.config.agentTools.find((x) => x.id === id);
                      return (
                        <span key={id} className={"ag-tool" + (st.usable ? "" : " ag-tool--off")} title={st.usable ? def?.description : st.reason}>
                          {def?.label || id}{def?.restricted ? " (needs approval)" : ""}{!st.usable && <em>{st.connection ? "needs " + st.connection.label : "unavailable"}</em>}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <Btn small onClick={() => nav.addAgent(null, t.id)} disabled={!manage || modOff}
                  title={!manage ? "Needs the Manage agents permission." : modOff ? "Switch the module on first." : undefined}>Create agent from template</Btn>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
