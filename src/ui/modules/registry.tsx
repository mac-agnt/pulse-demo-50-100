/* Page components for capability modules. The shell renders the one for the
   current page; navigation, tabs and enablement come from src/core/modules.ts.
   A client-specific module adds its component here and its PageDef there. */

import type { ComponentType } from "react";
import type { PageId } from "../../core/modules";
import ProjectsPage from "../projects/ProjectsPage";
import PeopleModulePage from "../peoplemod/PeopleModulePage";
import FinancePage from "../finance/FinancePage";
import PurchasingPage from "../purchasing/PurchasingPage";
import StandardsPage from "../standards/StandardsPage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ModulePageProps { section: string; setSection: (id: string) => void; v: any }

export const MODULE_PAGES: Partial<Record<PageId, ComponentType<ModulePageProps>>> = {
  Projects: ProjectsPage,
  People: PeopleModulePage,
  Finance: FinancePage,
  Purchasing: PurchasingPage,
  Standards: StandardsPage
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ModuleHost({ v }: { v: any }) {
  const Page = MODULE_PAGES[v.page as PageId];
  return Page ? <Page section={v.section} setSection={v.setSection} v={v} /> : null;
}
