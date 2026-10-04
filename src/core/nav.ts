/* Cross-page navigation from core-driven components. PulseLogic owns which
   page and tab are showing; it registers a handler here on mount. The focus
   travels in the store session so the destination opens the right panel. */

import { store, type Focus } from "./store";
import type { PageId } from "./modules";

export type Page = PageId;

export interface NavTarget {
  page: Page;
  /** A section id from src/core/modules.ts (e.g. Work: mine | team | requests | approvals | workflows | calendar).
      Older ids (Work tasks/schedules/people, Records ontology, Activity all) are mapped. Settings: a card id. */
  section?: string;
  focus?: Focus | null;
}

let handler: ((t: NavTarget) => void) | null = null;

export function registerNavigator(fn: (t: NavTarget) => void) {
  handler = fn;
}

export function navigate(t: NavTarget) {
  store.setSession({ focus: t.focus ?? null });
  handler?.(t);
}

/** Where an object lives, for "open" links from anywhere. */
export function openObject(kind: Focus["kind"], id: string): void {
  switch (kind) {
    case "record": return navigate({ page: "Records", section: "browse", focus: { kind, id } });
    case "file": return navigate({ page: "Records", section: "files", focus: { kind, id } });
    case "issue": return navigate({ page: "Records", section: "quality", focus: { kind, id } });
    case "task": return navigate({ page: "Work", section: "team", focus: { kind, id } });
    case "approval": case "request": return navigate({ page: "Work", section: "approvals", focus: { kind, id } });
    case "run": return navigate({ page: "Work", section: "workflows", focus: { kind, id } });
    case "schedule": return navigate({ page: "Work", section: "calendar", focus: { kind, id } });
    case "event": return navigate({ page: "Activity", section: "history", focus: { kind, id } });
    case "project": return navigate({ page: "Projects", section: "portfolio", focus: { kind, id } });
    case "milestone": return navigate({ page: "Projects", section: "portfolio", focus: { kind, id } });
    case "agent": return navigate({ page: "Agents", section: "organisation", focus: { kind, id } });
    case "agentRun": return navigate({ page: "Agents", section: "runs", focus: { kind, id } });
    case "invoice": return navigate({ page: "Purchasing", section: "matching", focus: { kind, id } });
    case "order": return navigate({ page: "Purchasing", section: "orders", focus: { kind, id } });
    case "obligation": return navigate({ page: "Standards", section: "requirements", focus: { kind, id } });
    case "budget": return navigate({ page: "Finance", section: "budgets", focus: { kind, id } });
    case "appointment": return navigate({ page: "Work", section: "calendar", focus: { kind, id } });
    case "supplier": return navigate({ page: "Purchasing", section: "suppliers", focus: { kind, id } });
    case "person": return navigate({ page: "People", section: "directory", focus: { kind, id } });
    default: return;
  }
}
