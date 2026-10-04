/* Which Home rail widgets a viewer has hidden, per view. Presentation only,
   kept in this browser; storage can be blocked, so every access is guarded. */

import { useState } from "react";

export type HomeView = "personal" | "management";

export const WIDGETS: Record<HomeView, { id: string; label: string }[]> = {
  personal: [
    { id: "mywork", label: "My work" },
    { id: "waiting", label: "Decisions waiting on you" },
    { id: "briefing", label: "Briefing" }
  ],
  management: [
    { id: "priorities", label: "Priorities" },
    { id: "decisions", label: "Decisions" },
    { id: "teams", label: "Team exceptions" },
    { id: "upcoming", label: "Upcoming deadlines" }
  ]
};

type Hidden = Record<HomeView, string[]>;
const KEY = "pulse.home.widgets";

function read(): Hidden {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Hidden>;
      return { personal: Array.isArray(p.personal) ? p.personal : [], management: Array.isArray(p.management) ? p.management : [] };
    }
  } catch { /* blocked or corrupt: show everything */ }
  return { personal: [], management: [] };
}

export function useHiddenWidgets(): [Hidden, (view: HomeView, id: string) => void] {
  const [hidden, setHidden] = useState<Hidden>(read);
  const toggle = (view: HomeView, id: string) => {
    const list = hidden[view];
    const next = { ...hidden, [view]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    setHidden(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: applies to this tab only */ }
  };
  return [hidden, toggle];
}

/* ── Today layout ──────────────────────────────────────────────────────────
   Same widget system, for the Today mode blocks: which are shown and in what
   order. Presentation only, per browser. */

export const TODAY_BLOCKS: { id: string; label: string; wide?: boolean }[] = [
  { id: "briefing", label: "Briefing", wide: true },
  { id: "priorities", label: "Priorities", wide: true },
  { id: "decisions", label: "Decisions" },
  { id: "agenda", label: "Today's agenda" },
  { id: "teams", label: "Team exceptions" }
];

const TODAY_KEY = "pulse.home.today";
interface TodayLayout { order: string[]; hidden: string[] }

function readToday(): TodayLayout {
  const ids = TODAY_BLOCKS.map((b) => b.id);
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TodayLayout>;
      const order = Array.isArray(p.order) ? p.order.filter((x) => ids.includes(x)) : [];
      // Blocks added later go to the end, so a saved order never hides them.
      return { order: [...order, ...ids.filter((x) => !order.includes(x))], hidden: Array.isArray(p.hidden) ? p.hidden.filter((x) => ids.includes(x)) : [] };
    }
  } catch { /* blocked or corrupt: defaults */ }
  return { order: ids, hidden: [] };
}

export function useTodayLayout() {
  const [layout, setLayout] = useState<TodayLayout>(readToday);
  const save = (next: TodayLayout) => {
    setLayout(next);
    try { localStorage.setItem(TODAY_KEY, JSON.stringify(next)); } catch { /* private mode: this tab only */ }
  };
  return {
    order: layout.order,
    hidden: layout.hidden,
    toggle: (id: string) => save({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] }),
    move: (id: string, by: -1 | 1) => {
      const i = layout.order.indexOf(id), j = i + by;
      if (i < 0 || j < 0 || j >= layout.order.length) return;
      const order = layout.order.slice();
      [order[i], order[j]] = [order[j], order[i]];
      save({ ...layout, order });
    },
    reset: () => save({ order: TODAY_BLOCKS.map((b) => b.id), hidden: [] })
  };
}
