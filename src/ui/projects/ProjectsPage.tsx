/* Projects module page. Renders the section chosen in the top bar (v.section):
   portfolio | timeline | templates. A project opens as a full page inside this
   page (from a row, a timeline marker, or openObject("project", id) from
   anywhere); its back link returns to the list with filters, view and scroll
   position kept. All labels come from configuration (Project, Engagement...). */

import { useEffect, useRef, useState } from "react";
import { pageLabel, sectionsFor, store, useCore } from "../../core";
import { PageFrame } from "../frame";
import { useTableState } from "../kit";
import type { ModulePageProps } from "../modules/registry";
import { EMPTY_FILTERS, Portfolio, type PortfolioFilters } from "./Portfolio";
import { Timeline } from "./Timeline";
import { Templates } from "./Templates";
import { ProjectDetail } from "./ProjectDetail";
import { NewProjectPanel } from "./NewProjectPanel";
import { mainScroller, type DetailTab } from "./shared";

export default function ProjectsPage({ section }: ModulePageProps) {
  const { core, session } = useCore();
  const [open, setOpen] = useState<{ id: string; tab: DetailTab; milestoneId?: string | null } | null>(null);
  const [filters, setFilters] = useState<PortfolioFilters>(EMPTY_FILTERS);
  const [mode, setMode] = useState<"table" | "board">("table");
  const [table, setTable] = useTableState({ sort: { key: "next", dir: "asc" } });
  const [creating, setCreating] = useState<{ templateId?: string } | null>(null);
  const scrollAt = useRef(0);
  const lastSection = useRef(section);

  // Choosing another tab in the top bar leaves the detail page.
  useEffect(() => {
    if (lastSection.current !== section) { lastSection.current = section; setOpen(null); }
  }, [section]);

  // Links from elsewhere: open the project (or the plan, for a milestone), then clear the focus.
  useEffect(() => {
    const f = session.focus;
    if (!f || !f.id) return;
    if (f.kind === "project") openProject(f.id, "overview");
    else if (f.kind === "milestone") {
      const m = core.data.milestones.find((x) => x.id === f.id);
      if (m) openProject(m.projectId, "plan", m.id);
    } else return;
    store.setSession({ focus: null });
  }, [session.focus]);

  function openProject(id: string, tab: DetailTab = "overview", milestoneId?: string) {
    if (!open) scrollAt.current = mainScroller()?.scrollTop || 0;
    setOpen({ id, tab, milestoneId });
    requestAnimationFrame(() => mainScroller()?.scrollTo({ top: 0 }));
  }
  function back() {
    setOpen(null);
    requestAnimationFrame(() => mainScroller()?.scrollTo({ top: scrollAt.current }));
  }

  const backLabel = sectionsFor(core, "Projects").find((s) => s.id === section)?.label || pageLabel(core.config, "Projects");

  return (
    <div className="pk pj">
      <PageFrame wide>
        {open ? (
          <ProjectDetail key={open.id} id={open.id} tab={open.tab} setTab={(t) => setOpen({ ...open, tab: t, milestoneId: null })}
            onBack={back} backLabel={backLabel} focusMilestone={open.milestoneId} />
        ) : section === "timeline" ? (
          <Timeline onOpen={openProject} />
        ) : section === "templates" ? (
          <Templates onCreate={(templateId) => setCreating({ templateId })} />
        ) : (
          <Portfolio onOpen={(id) => openProject(id)} onNew={() => setCreating({})} filters={filters} setFilters={(f) => { setFilters(f); setTable({ ...table, page: 0 }); }}
            mode={mode} setMode={setMode} table={table} setTable={setTable} />
        )}
      </PageFrame>
      {creating && (
        <NewProjectPanel templateId={creating.templateId} onClose={() => setCreating(null)}
          onCreated={(id) => { setCreating(null); openProject(id, "plan"); }} />
      )}
    </div>
  );
}
