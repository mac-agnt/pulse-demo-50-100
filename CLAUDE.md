# Pulse template: rules for customising

This repo is a template. It gets copied and re-skinned for each client (new name, data, labels, colours).
When customising, follow these rules. They override anything a client brief implies.

## Locked layout (never change)

1. **Side rail order starts Home, Agents.** Agents always sits directly under Home.
   `PulseLogic.js` enforces this (`navItems()` near the top of the class). Don't remove the guard.
   Pages, their tabs and which module owns them come from `src/core/modules.ts`; the rail shows only enabled, permitted pages.
2. **Records opens on Browse. The Ontology graph is kept, never deleted.**
   (Changed by the V2 brief, October 2026: the large illustrative graph must not be the default records journey.)
   Order is Browse, Contacts, Files, Data quality, then Relationships (the Ontology view, labelled illustrative).
   Keep `src/views/pages/RecordsOntology.tsx` and its layout exactly as it is: the graph, the panels, the interactions.
   You may re-theme it (colours come from the theme tokens) and re-label entities and edges in `ONTO_NODES` / `ONTO_EDGES` in `data.js` to fit the client.
   Don't delete, simplify or replace it. `PulseLogic.js` puts it back if `REC_SECTIONS` drops it.
3. **Home has two modes: Chat and Today** (top-bar tabs, `v.homeMode`; role default from `config.roleLayouts[role].homeMode`, the person's choice is remembered per browser).
   - **Chat mode: the centre column stays clean.** In `src/views/pages/Home.tsx` the Chat centre holds only:
     the status pill, the greeting, one subline, the ask box and the chat thread.
     Do NOT add KPI tiles, stat grids, briefing cards, charts or lists there.
     Briefings, inbox items and to-dos for Chat go in the **right widget rail** (`HomeWidgetRail.tsx`, widgets in `src/ui/home/`).
   - **Today mode** (`src/ui/home/Today.tsx`) uses the main width: a compact header (demo-clock date, scope, one greeting line), then
     briefing statements that link to source records or filtered queues, decisions waiting on me and on others, an ordered priority
     list (5 to 7 items, each with reason, owner, deadline, state and next action, from `src/ui/activity/queue.ts`), today's agenda
     and team exceptions. Blocks are shown, hidden and reordered through the widget preferences in `src/ui/home/prefs.ts`; do not
     build a second dashboard builder. Numbers and KPIs still belong on the **Dashboard**.

## Shared core (50-100 base)

All organisation data, rules and figures come from `src/core/` (see `docs/IMPLEMENTATION_MAP.md` and README).
- Don't put client data in `src/logic/data.js` or in view files. Client data is a fixture in `src/core/fixtures/`, configuration is an `OrgConfig`.
- Every change goes through an operation in `src/core/ops.ts`; every list reads through `src/core/query.ts`. Don't bypass them.
- No visible copy may claim an external system, scheduler, sign-in or AI model works unless it is actually connected.
- `npm test` must pass.

## Top bar tabs

The top bar shows, from `src/ui/topnav.tsx`: the module switcher (the module title; grouped Daily work / Business / Intelligence,
only enabled and permitted modules, business modules can be pinned to the side rail there), a compact scope control next to it,
then the module's pages. On desktop (900px and wider) the pages are visible tabs by default; the page menu is used on narrow
screens or when someone picks "Show pages as a menu" in the module switcher (kept per browser). Global search stays its own control.
Pages and tabs both come from `contextNav` in `PulseLogic.js` (sections from `src/core/modules.ts`). Add as many as you like with any label length.
The sliding highlight (`src/components/NavThumb.tsx`) measures the active tab, so it always sits on it.
Don't go back to a fixed-width or index-based highlight.

Side rail: group labels are restrained; business modules show only when pinned (`src/ui/pins.ts`, per browser; default all when five
or fewer are enabled, else Projects and People); unpinned ones stay in the module switcher. Settings stays at the bottom. Demo controls
live in the Demo menu behind the one "Sample data" / "Clean template" pill at the bottom of the rail (`DemoIndicator` in `src/ui/shell.tsx`).

## Backgrounds

Change them in `src/App.tsx`, one colour each:

- `dashboardBackdrop`: the abstract background behind the Dashboard KPIs.
- `recordsBackdrop`: the wash behind the Records hero and the New record dialog. `""` uses the theme's gradient.

Theme colours (accent, surfaces, text) live in `src/styles/pulse.css` per `[data-theme]`. The default theme is `harbour`.

## Re-importing from Claude Design

`npm run import-design` overwrites `src/views/`, `src/styles/pulse.css`, `src/styles/interactions.css` and `src/logic/`.
That wipes the guards above. Don't run it on a customised copy.

## Before saying done

- `npm run typecheck` and `npm test` pass.
- Check Home, Dashboard and every Records tab in the browser: highlight on the right tab, Ontology first, Agents under Home, nothing extra in the Home centre.
