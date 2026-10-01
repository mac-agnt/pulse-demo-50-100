# Pulse template: rules for customising

This repo is a template. It gets copied and re-skinned for each client (new name, data, labels, colours).
When customising, follow these rules. They override anything a client brief implies.

## Locked layout (never change)

1. **Side rail order starts Home, Agents.** Agents always sits directly under Home.
   `PulseLogic.js` enforces this (`NAV` guard near the top). Don't remove the guard.
2. **Records: Ontology is the first tab and is never removed.**
   Order is Ontology, Files, Contacts, then any client tabs. Records opens on Ontology.
   Keep `src/views/pages/RecordsOntology.tsx` and its layout exactly as it is: the graph, the panels, the interactions.
   You may re-theme it (colours come from the theme tokens) and re-label entities and edges in `ONTO_NODES` / `ONTO_EDGES` in `data.js` to fit the client.
   Don't delete, simplify or replace it. `PulseLogic.js` puts it back if `REC_SECTIONS` drops it.
3. **Home centre column stays clean.** In `src/views/pages/Home.tsx` the centre holds only:
   the status pill, the greeting, one subline, the ask box and the chat thread.
   Do NOT add KPI tiles, stat grids, briefing cards, charts or lists there.
   - Numbers and KPIs go on the **Dashboard** (`DashboardKpiBand.tsx`, `KPI_DEFS` in `data.js`).
   - Briefings, inbox items and to-dos go in the **right widget rail** (`HomeWidgetRail.tsx`).

## Top bar tabs

Tabs come from `contextNav` in `PulseLogic.js`. Add as many as you like with any label length.
The sliding highlight (`src/components/NavThumb.tsx`) measures the active tab, so it always sits on it.
Don't go back to a fixed-width or index-based highlight.

## Backgrounds

Change them in `src/App.tsx`, one colour each:

- `dashboardBackdrop`: the abstract background behind the Dashboard KPIs.
- `recordsBackdrop`: the wash behind the Records hero and the New record dialog. `""` uses the theme's gradient.

Theme colours (accent, surfaces, text) live in `src/styles/pulse.css` per `[data-theme]`. The default theme is `harbour`.

## Re-importing from Claude Design

`npm run import-design` overwrites `src/views/`, `src/styles/pulse.css`, `src/styles/interactions.css` and `src/logic/`.
That wipes the guards above. Don't run it on a customised copy.

## Before saying done

- `npm run typecheck` passes.
- Check Home, Dashboard and every Records tab in the browser: highlight on the right tab, Ontology first, Agents under Home, nothing extra in the Home centre.
