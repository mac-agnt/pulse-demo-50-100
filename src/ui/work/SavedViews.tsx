/* Saved task views as one compact "Saved views" chip: apply a view that is
   mine or shared with a team I am in, or save the current one. A view stores
   the view tab and filters. Sharing never widens access: each person still
   sees only the rows they are allowed to see. */

import { useState } from "react";
import { useCore, ops } from "../../core";
import type { SavedView } from "../../core";
import { Button, Field, Notice, Select, SidePanel, TextInput } from "../kit";
import { FilterChip } from "../frame";
import { InlineError, useRunner, useViewer } from "./shared";

export type TaskTab = "all" | "due" | "review" | "done" | "team" | "blocked";
export interface TaskFilters { due: string; status: string; who: string; team: string; priority: string }
export const EMPTY_FILTERS: TaskFilters = { due: "", status: "", who: "", team: "", priority: "" };
const TABS: TaskTab[] = ["all", "due", "review", "done", "team", "blocked"];

/** Read a stored view, including views saved by the earlier queue layout. */
function decode(view: SavedView, me: string): { tab: TaskTab; f: TaskFilters } {
  const s = view.state.filters || {};
  const f: TaskFilters = { ...EMPTY_FILTERS, due: s.due || "", status: s.status || "", who: s.who || s.assignee || "", team: s.team || "", priority: s.priority || "" };
  let tab: TaskTab = TABS.includes(s.tab as TaskTab) ? (s.tab as TaskTab) : "all";
  const legacy = s.queue || (["mine", "team", "scope", "overdue", "blocked", "done"].includes(f.status) ? f.status : "");
  if (legacy) {
    if (f.status === legacy) f.status = "";
    if (legacy === "mine") f.who = me;
    else if (legacy === "team") tab = "team";
    else if (legacy === "overdue") { tab = "due"; f.due = "overdue"; }
    else if (legacy === "blocked") tab = "blocked";
    else if (legacy === "done") tab = "done";
  }
  if (f.who === me) f.who = "me";
  return { tab, f };
}

export function SavedViewsChip({ tab, filters, onApply }: { tab: TaskTab; filters: TaskFilters; onApply: (tab: TaskTab, f: TaskFilters) => void }) {
  const { core, q } = useCore();
  const { me, inTeam } = useViewer();
  const [current, setCurrent] = useState("");
  const [saving, setSaving] = useState(false);
  const views = core.data.views.filter((x) => x.page === "tasks" && (x.ownerId === me || (x.shared && (!x.teamId || inTeam(x.teamId)))));
  const label = (x: SavedView) => x.name + (x.shared ? " (shared" + (x.teamId ? " with " + q.teamLabel(x.teamId) : "") + (x.ownerId !== me ? ", by " + q.name(x.ownerId) : "") + ")" : " (private)");

  const pick = (id: string) => {
    if (id === "__save") { setSaving(true); return; }
    setCurrent(id);
    const view = views.find((x) => x.id === id);
    if (!view) return;
    const d = decode(view, me);
    onApply(d.tab, d.f);
  };

  return (
    <>
      <FilterChip label="Saved views" value={current} onChange={pick}
        options={[{ value: "", label: "Saved views" }, ...views.map((x) => ({ value: x.id, label: label(x) })), { value: "__save", label: "Save the current view" }]} />
      {saving && <SaveViewPanel tab={tab} filters={filters} onClose={() => setSaving(false)} onSaved={(id) => { setCurrent(id); setSaving(false); }} />}
    </>
  );
}

function SaveViewPanel({ tab, filters, onClose, onSaved }: { tab: TaskTab; filters: TaskFilters; onClose: () => void; onSaved: (id: string) => void }) {
  const { core, q } = useCore();
  const { v, can: canDo } = useViewer();
  const { err, run } = useRunner();
  const [name, setName] = useState("");
  const [share, setShare] = useState("");
  const teamIds = v.isOrgWide ? core.config.teams.map((t) => t.id) : [...new Set([...v.memberTeamIds, ...v.overseenTeamIds])];
  const mayShare = canDo("views.share");

  const save = () => {
    const shared = !!share;
    const res = run(ops.saveView, {
      page: "tasks", name, shared, teamId: shared ? share : undefined,
      state: { filters: Object.fromEntries(Object.entries({ tab, ...filters }).filter(([, val]) => !!val)), sort: { key: "due", dir: "asc" } }
    });
    if (res.ok && res.id) onSaved(res.id);
  };

  return (
    <SidePanel open onClose={onClose} title="Save this view" eyebrow="Tasks" width={460}
      footer={<><span className="pk-grow" /><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!name.trim()} title={name.trim() ? undefined : "Name the view first"}>Save view</Button></>}>
      <div className="wk-stack">
        <Field label="Name" htmlFor="sv-name"><TextInput id="sv-name" value={name} onChange={setName} placeholder="For example: Team A overdue" /></Field>
        <Field label="Who can use it" htmlFor="sv-share" help={mayShare ? undefined : "Your role cannot share views, so this view is private."}>
          <Select id="sv-share" value={share} onChange={setShare}
            options={[{ value: "", label: "Only me" }, ...(mayShare ? teamIds.map((id) => ({ value: id, label: "Shared with " + q.teamLabel(id) })) : [])]} />
        </Field>
        <Notice>Sharing a view shares its tab and filters. It never changes who can see which rows: each person still sees only the tasks they are allowed to see. "Me" means whoever is using the view.</Notice>
        <InlineError text={err} />
      </div>
    </SidePanel>
  );
}
