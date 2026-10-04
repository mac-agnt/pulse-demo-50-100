/* Page and module registry. One place that says which pages exist, which
   sections (tabs) each page has, which capability module owns it and what it
   is called. Navigation, the module switcher, page tabs, the palette and the
   Dashboard read this, so disabling a module removes it everywhere at once
   while its data stays put.

   Extension point: a client-specific module registers a PageDef here (plus
   its page component in src/ui/modules/registry.tsx) through the same
   contract: id, sections, permission, module id. Shared code never checks a
   client name. */

import type { CoreState, DashboardDef, MetricDef, ModuleId, OrgConfig, Permission } from "./types";
import { can, viewerOf } from "./access";

export type PageId =
  | "Home" | "Agents" | "Dashboard" | "Work"
  | "Projects" | "People" | "Finance" | "Purchasing" | "Standards"
  | "Records" | "Activity" | "Settings";

export type NavGroup = "daily" | "business" | "shared";

export interface SectionDef { id: string; label: string }

export interface PageDef {
  id: PageId;
  label: string;
  icon: string;
  group: NavGroup;
  /** Owning capability module. Built-in pages have none and are always present. */
  module?: ModuleId;
  /** Viewer needs this permission to see the page at all. */
  permission?: Permission;
  sections: SectionDef[];
  defaultSection: string;
}

export const GROUP_LABEL: Record<NavGroup, string> = { daily: "Daily work", business: "Business", shared: "Intelligence" };

export const PAGES: PageDef[] = [
  { id: "Home", label: "Home", icon: "helios", group: "daily",
    sections: [{ id: "chat", label: "Chat" }, { id: "today", label: "Today" }], defaultSection: "chat" },
  /* Locked: Agents sits directly under Home in the rail. */
  { id: "Agents", label: "Agents", icon: "navAgents", group: "daily",
    sections: [{ id: "organisation", label: "Organisation" }, { id: "runs", label: "Runs" }, { id: "templates", label: "Templates" }], defaultSection: "organisation" },
  { id: "Dashboard", label: "Dashboard", icon: "navDash", group: "daily",
    /* Dashboard sections are the configured dashboard views plus Reports; see dashboardSections(). */
    sections: [{ id: "reports", label: "Reports" }], defaultSection: "overview" },
  { id: "Work", label: "Work", icon: "navWork", group: "daily",
    sections: [{ id: "mine", label: "My work" }, { id: "team", label: "Team work" }, { id: "requests", label: "Requests" },
      { id: "approvals", label: "Approvals" }, { id: "workflows", label: "Workflows" }, { id: "calendar", label: "Calendar" }], defaultSection: "mine" },
  { id: "Projects", label: "Projects", icon: "projects", group: "business", module: "projects",
    sections: [{ id: "portfolio", label: "Portfolio" }, { id: "timeline", label: "Timeline" }, { id: "templates", label: "Templates" }], defaultSection: "portfolio" },
  { id: "People", label: "People", icon: "people", group: "business", module: "people",
    sections: [{ id: "directory", label: "Directory" }, { id: "teams", label: "Teams" }, { id: "availability", label: "Availability" },
      { id: "onboarding", label: "Onboarding" }, { id: "documents", label: "Documents and training" }], defaultSection: "directory" },
  { id: "Finance", label: "Finance", icon: "finance", group: "business", module: "finance", permission: "finance.view",
    sections: [{ id: "overview", label: "Overview" }, { id: "budgets", label: "Budgets" }, { id: "receivables", label: "Receivables" },
      { id: "payables", label: "Payables" }, { id: "transactions", label: "Transactions" }], defaultSection: "overview" },
  { id: "Purchasing", label: "Purchasing", icon: "purchasing", group: "business", module: "purchasing",
    sections: [{ id: "requests", label: "Requests" }, { id: "orders", label: "Orders" }, { id: "suppliers", label: "Suppliers" },
      { id: "receipts", label: "Receipts" }, { id: "matching", label: "Matching" }], defaultSection: "requests" },
  { id: "Standards", label: "Standards", icon: "standards", group: "business", module: "standards",
    sections: [{ id: "overview", label: "Overview" }, { id: "requirements", label: "Requirements" }, { id: "checks", label: "Checks" },
      { id: "policies", label: "Policies" }, { id: "evidence", label: "Evidence" }], defaultSection: "overview" },
  { id: "Records", label: "Records", icon: "navRecords", group: "shared",
    sections: [{ id: "browse", label: "Browse" }, { id: "contacts", label: "Contacts" }, { id: "files", label: "Files" },
      { id: "quality", label: "Data quality" }, { id: "relationships", label: "Relationships" }], defaultSection: "browse" },
  { id: "Activity", label: "Activity", icon: "pulseLine", group: "shared",
    sections: [{ id: "overview", label: "Overview" }, { id: "attention", label: "Needs attention" }, { id: "history", label: "History" }], defaultSection: "overview" },
  { id: "Settings", label: "Settings", icon: "navAdmin", group: "shared", sections: [], defaultSection: "" }
];

export const pageDef = (id: string) => PAGES.find((p) => p.id === id);

export function moduleEnabled(c: OrgConfig, m?: ModuleId): boolean {
  return !m || !!c.modules?.[m]?.enabled;
}

/** Module (or capability) a metric's entity belongs to. Core entities belong to none. */
const ENTITY_MODULE: Partial<Record<MetricDef["entity"], ModuleId>> = { project: "projects", invoice: "purchasing", requirement: "standards", person: "people" };

/** A metric is shown only while it is enabled and the module its entity belongs to is on. */
export function metricAvailable(c: OrgConfig, m: MetricDef): boolean {
  if (!m.enabled) return false;
  if (m.entity === "agentRun") return c.capabilities.agents;
  return moduleEnabled(c, ENTITY_MODULE[m.entity]);
}

/** A dashboard view is hidden when every metric it lists belongs to a disabled module. */
export function dashboardVisible(c: OrgConfig, d: DashboardDef): boolean {
  if (d.module && !moduleEnabled(c, d.module)) return false;
  const defs = d.metricIds.map((id) => c.metrics.find((m) => m.id === id)).filter((m): m is MetricDef => !!m);
  return defs.length === 0 || defs.some((m) => metricAvailable(c, { ...m, enabled: true }));
}

/** Page label after client configuration (e.g. Projects -> Engagements). */
export function pageLabel(c: OrgConfig, id: PageId): string {
  const d = pageDef(id);
  if (!d) return id;
  if (d.module === "projects") return c.modules.projects?.label || c.projects.plural || d.label;
  if (d.module) return c.modules[d.module]?.label || d.label;
  return d.label;
}

export function sectionLabel(c: OrgConfig, page: PageId, sec: SectionDef): string {
  const d = pageDef(page);
  return (d?.module && c.modules[d.module]?.sectionLabels?.[sec.id]) || sec.label;
}

/** Sections for a page as they should appear, after module and capability rules. */
export function sectionsFor(s: CoreState, page: PageId): SectionDef[] {
  const c = s.config;
  const d = pageDef(page);
  if (!d) return [];
  if (page === "Dashboard") return [...c.dashboards.filter((x) => dashboardVisible(c, x)).map((x) => ({ id: x.id, label: x.label })), { id: "reports", label: "Reports" }];
  return d.sections.filter((x) => {
    if (page === "Records" && x.id === "files") return c.capabilities.files;
    if (page === "Records" && x.id === "contacts") return c.capabilities.contacts;
    if (page === "Records" && x.id === "quality") return c.capabilities.dataQuality;
    if (page === "Records" && x.id === "relationships") return c.capabilities.ontology;
    if (page === "Work" && x.id === "approvals") return c.capabilities.approvals;
    if (page === "Work" && x.id === "workflows") return c.capabilities.workflows;
    return true;
  }).map((x) => ({ id: x.id, label: sectionLabel(c, page, x) }));
}

export function defaultSectionFor(s: CoreState, page: PageId): string {
  const list = sectionsFor(s, page);
  const d = pageDef(page);
  return list.find((x) => x.id === d?.defaultSection)?.id || list[0]?.id || "";
}

/** Pages the viewer can open: enabled modules and permitted pages only. */
export function visiblePages(s: CoreState, viewerId: string): PageDef[] {
  const v = viewerOf(s, viewerId);
  return PAGES.filter((p) => moduleEnabled(s.config, p.module) && (!p.permission || can(v, p.permission))
    && (p.id !== "Agents" || s.config.capabilities.agents));
}

/** Modules another module depends on; disabling one warns before it goes. */
export const MODULE_DEPENDENCIES: Partial<Record<ModuleId, { needs: ModuleId; why: string }[]>> = {
  purchasing: [{ needs: "finance", why: "Invoice matching and budget commitments read Finance budgets. Purchasing still works without them, but budget columns are hidden." }]
};

/** What disabling a module would affect, so Settings can explain it first. */
export function disableImpact(s: CoreState, m: ModuleId): string[] {
  const d = s.data;
  const out: string[] = [];
  const n = (k: number, what: string) => { if (k) out.push(k + " " + what + " kept but hidden"); };
  if (m === "projects") { n(d.projects.length, "projects"); n(d.tasks.filter((t) => t.projectId).length, "project tasks stay in Work;"); }
  if (m === "finance") { n(d.budgets.length, "budgets"); n(d.receivables.length + d.transactions.length, "finance rows"); }
  if (m === "purchasing") { n(d.orders.length, "orders"); n(d.invoices.length, "supplier invoices"); n(d.suppliers.length, "suppliers"); }
  if (m === "standards") { n(d.obligations.length, "requirement records"); n(d.checkRuns.length, "checks"); }
  if (m === "people") { n(d.employment.length, "employment records"); }
  for (const [other, deps] of Object.entries(MODULE_DEPENDENCIES) as [ModuleId, { needs: ModuleId; why: string }[]][]) {
    for (const dep of deps) if (dep.needs === m && s.config.modules[other]?.enabled) out.push(pageLabel(s.config, ("" + other.charAt(0).toUpperCase() + other.slice(1)) as PageId) + ": " + dep.why);
  }
  return out;
}
