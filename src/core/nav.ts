/* Cross-page navigation from core-driven components. PulseLogic owns which
   page and tab are showing; it registers a handler here on mount. The focus
   travels in the store session so the destination opens the right panel. */

import { store, type Focus } from "./store";

export type Page = "Home" | "Agents" | "Dashboard" | "Work" | "Records" | "Activity" | "Settings";

export interface NavTarget {
  page: Page;
  /** Work: tasks | approvals | workflows | schedules. Records: ontology | files | contacts | browse | quality.
      Activity: all | people | ai | attention. Settings: a card id. */
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
    case "task": return navigate({ page: "Work", section: "tasks", focus: { kind, id } });
    case "approval": case "request": return navigate({ page: "Work", section: "approvals", focus: { kind, id } });
    case "run": return navigate({ page: "Work", section: "schedules", focus: { kind, id } });
    case "schedule": return navigate({ page: "Work", section: "schedules", focus: { kind, id } });
    case "event": return navigate({ page: "Activity", section: "all", focus: { kind, id } });
    default: return;
  }
}
