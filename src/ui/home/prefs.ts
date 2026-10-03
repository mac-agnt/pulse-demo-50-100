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
