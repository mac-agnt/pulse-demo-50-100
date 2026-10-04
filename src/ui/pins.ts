/* Which business modules sit in the side rail. A per-browser presentation
   preference only: unpinned modules stay reachable from the module switcher,
   and pins never change access. Storage can be blocked, so every access is
   guarded; an in-memory copy keeps pins working for this tab regardless. */

import { useSyncExternalStore } from "react";
import { visiblePages, type CoreState, type PageId } from "../core";

const KEY = "pulse.rail.pins";
const listeners = new Set<() => void>();
let version = 0;
/* Pins set in this tab, so they apply even when storage is blocked. */
let memo: Record<string, PageId[]> = {};

function readAll(): Record<string, PageId[]> {
  let stored: Record<string, PageId[]> = {};
  try {
    const raw = localStorage.getItem(KEY);
    const p: unknown = raw ? JSON.parse(raw) : null;
    if (p && typeof p === "object") stored = p as Record<string, PageId[]>;
  } catch { /* blocked or corrupt: defaults */ }
  return { ...stored, ...memo };
}

/** Business modules this viewer can open, in registry order. */
export function businessPages(s: CoreState, viewerId: string): PageId[] {
  return visiblePages(s, viewerId).filter((p) => p.group === "business").map((p) => p.id);
}

/** Default: every enabled business module when there are five or fewer, else Projects and People. */
export function defaultPins(all: PageId[]): PageId[] {
  if (all.length <= 5) return all;
  const pick = all.filter((id) => id === "Projects" || id === "People");
  return pick.length ? pick : all.slice(0, 2);
}

/** Pinned business pages, filtered to what is enabled and permitted now. Kept per workspace. */
export function pinnedPages(s: CoreState, viewerId: string): PageId[] {
  const all = businessPages(s, viewerId);
  const saved = readAll()[s.config.workspace.id];
  const list = Array.isArray(saved) ? saved.filter((id) => all.includes(id)) : defaultPins(all);
  return all.filter((id) => list.includes(id));
}

export function setPinned(s: CoreState, viewerId: string, page: PageId, pinned: boolean) {
  const cur = pinnedPages(s, viewerId);
  const next = pinned ? [...new Set([...cur, page])] : cur.filter((id) => id !== page);
  memo = { ...memo, [s.config.workspace.id]: next };
  try {
    const raw = localStorage.getItem(KEY);
    const all: Record<string, PageId[]> = raw ? JSON.parse(raw) : {};
    all[s.config.workspace.id] = next;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* private mode: applies to this tab only */ }
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribePins(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Re-render when pins change. */
export function usePinsVersion(): number {
  return useSyncExternalStore(subscribePins, () => version, () => version);
}
