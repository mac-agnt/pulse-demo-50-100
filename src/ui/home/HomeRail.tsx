/* Home right rail content: a Personal / Management switch over one shell,
   then core-driven widgets. The frame (clock board, header buttons) is the
   view file's; this renders below it. */

import type { ReactElement } from "react";
import { useCore, store } from "../../core";
import { Segmented } from "../kit";
import { highestRoleId } from "../dashboard/state";
import { WIDGETS, useHiddenWidgets, type HomeView } from "./prefs";
import { Briefing, MyWork, Priorities, TeamDecisions, TeamExceptions, Upcoming, WaitingOnMe } from "./widgets";
import "../../styles/home.css";

export function useHomeView(): HomeView {
  const { core, session, q } = useCore();
  if (session.homeView) return session.homeView;
  return core.config.roleLayouts[highestRoleId(core, q)]?.homeView || "personal";
}

const RENDER: Record<string, (p: { onRemove?: () => void }) => ReactElement> = {
  mywork: MyWork, waiting: WaitingOnMe, briefing: Briefing,
  priorities: Priorities, decisions: TeamDecisions, teams: TeamExceptions, upcoming: Upcoming
};

export function useVisibleWidgetCount(view: HomeView, hidden: Record<HomeView, string[]>) {
  return WIDGETS[view].filter((w) => !hidden[view].includes(w.id)).length;
}

export function HomeRailBody({ editing, hidden, toggle }: { editing: boolean; hidden: Record<HomeView, string[]>; toggle: (view: HomeView, id: string) => void }) {
  const view = useHomeView();
  const list = WIDGETS[view];
  const shown = list.filter((w) => !hidden[view].includes(w.id));
  return (
    <div className="pk hm-rail">
      <Segmented<HomeView> label="Home view" value={view} onChange={(v) => store.setSession({ homeView: v })}
        options={[{ value: "personal", label: "Personal" }, { value: "management", label: "Management" }]} />
      {editing && (
        <fieldset className="hm-card hm-edit">
          <legend className="hm-card-t">Widgets in {view === "personal" ? "Personal" : "Management"}</legend>
          <p className="hm-sub" style={{ margin: "2px 0 8px" }}>Hidden widgets stay hidden in this browser. Your access is unchanged.</p>
          {list.map((w) => (
            <label key={w.id} className="hm-toggle">
              <input type="checkbox" checked={!hidden[view].includes(w.id)} onChange={() => toggle(view, w.id)} />
              <span>{w.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      {shown.length === 0 && !editing && (
        <div className="hm-card"><div className="hm-empty">Every widget is hidden. Use Edit to show them again.</div></div>
      )}
      {shown.map((w) => {
        const C = RENDER[w.id];
        return <C key={w.id} onRemove={editing ? () => toggle(view, w.id) : undefined} />;
      })}
    </div>
  );
}

export { useHiddenWidgets };
