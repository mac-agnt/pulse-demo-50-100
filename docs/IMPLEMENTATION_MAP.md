# Base Pulse 50-100: implementation map

This copy upgrades the Pulse shell into the industry-agnostic base. The shell, theme, rail,
top bar, chat, agent faces and Ontology graph are kept. Every page's working content now
reads from one shared core instead of hardcoded client data.

## What was there (inspection, before editing)

| Area | Before | Working or presentational |
| --- | --- | --- |
| Shell (rail, top bar, palette, notifications) | `AppShell.tsx` + `PulseLogic.js` | Working navigation; brand, viewer and notifications hardcoded to one client |
| Home | Chat centre + widget rail | Chat works on canned answers (`pickAnswer`); rail widgets list fixed client items |
| Dashboard | KPI band + aspect tabs | Presentational: every figure is a literal string, no drill-down |
| Work | Tasks / Approvals / Workflows / Schedules | Local toggles only; approvals approve with no stages, versions or execution state |
| Records | Ontology / Files / Contacts | Ontology graph works; Files and Contacts are fixed client lists |
| Activity | Live lanes + audit table | Random generated events unrelated to any record |
| Agents | Chat threads + agent studio | Fixed threads; studio works locally |
| Settings | 5 groups, 13 cards | Layout works; most panels are static rows |

## Map

| Requirement | Existing component / page | Extension | Data dependency | Acceptance check |
| --- | --- | --- | --- | --- |
| Shared config registry | none | `src/core/config.ts`, `src/core/types.ts` | Typed `OrgConfig` in store | Labels, record types, roles, metrics, forms, rules come from config |
| Neutral fixtures, clean mode | `src/logic/data.js` (client data) | `src/core/fixtures/sample.ts`, `clean.ts`; client data removed | Demo adapter | Clean mode: no records, no client names, empty states |
| Demo adapter + persistence | `PulseLogic` local state | `src/core/store.ts` (localStorage, reset, mode switch) | `useCore()` hook | Reload keeps changes; reset restores fixtures |
| Permissions and scope | none | `src/core/access.ts` | People, memberships, role assignments, delegations | Manager sees only overseen teams/units; search, export, agent evidence filtered |
| Common query layer | per-page literals | `src/core/query.ts` | All entities | Dashboard, tables, panels, search, export, agent use the same rows |
| Top bar | top bar + tab row | `src/ui/topnav.tsx`: ScopeSwitch (regions, units with counts, planned units, teams), ModuleSwitch (every section), PageSwitch (pages, "Show pages as tabs instead") | session.scope, `contextNav` | Hidden scope on Settings; planned units not selectable; tabs mode keeps the measured NavThumb |
| Demo indicator, role preview | rail "signed in" card | `src/ui/DemoBadge.tsx` | session.viewerId, mode | Persistent, labelled preview, not authentication |
| Home personal / management | `Home.tsx`, `HomeWidgetRail.tsx` | View switch; rail widgets from core (priorities, decisions, briefing, my work) | tasks, approvals, events | Centre column unchanged (status pill, greeting, subline, ask box, thread) |
| Chat answers | `pickAnswer` | `src/core/agent.ts` sample answers with citations from permitted records | query layer | Answers labelled sample; citations open records |
| Dashboard | `Dashboard.tsx`, `DashboardKpiBand.tsx` | Metric engine, dashboard views, comparison, exceptions, detail panel with formula, period, source, freshness, coverage, drill-down; save view, export, report schedule | `src/core/metrics.ts` | Drill-down rows equal the KPI's records; partial/stale flagged |
| Records browse | Records tabs | `Browse` tab (after Ontology, Files, Contacts per CLAUDE.md), compact table, saved views, detail panel Overview / Related / History / Sources | records, relationships, events | Bidirectional relationships, source refs visible |
| Data quality | Settings "Data health" card (static) | Records > Data quality tab, comparison panel, resolution, merge preview | `src/core/quality.ts` | Resolution updates record, queue, metric, audit |
| Files | `RecordsFiles.tsx` (client docs) | Files from core: versions, owner, dates, linked records, restricted docs | files | Restricted docs hidden from unauthorised viewers |
| Contacts | AppShell contacts table | Directory from core people + external contacts | people | Scope-filtered |
| Ontology | `RecordsOntology.tsx` | Kept first; labels made neutral | `ONTO_NODES`, `CLUSTERS` | Still first tab and default |
| Tasks and requests | `Work.tsx` tasks | My work / My team / scope queues, claim/assign, dependencies, checklist, evidence, request forms, focus timer in My work only | tasks, requests | No double claim; circular dependency refused |
| Approvals | `Work.tsx` approvals + `WorkViewer` | Compact queue + reusable approval panel: stages, decisions with version, return, delegate, escalate, execution state | approvals, requests, delegations | Self-approval blocked; material edit forces re-review; execution separate |
| People (replaces the Work, Workflows page) | `Work.tsx` workflows tab | `src/ui/people`: list with stage, certificates, documents, tasks, leave, access review; person panel; onboarding/offboarding; leave via approvals | employment, leave, `config.people` (`src/core/people.ts`) | Manager sees own teams only; no duplicate renewal or checklist tasks; leave recorded only after approval |
| Schedules and runs | `WorkSchedules.tsx` | Week calendar, today agenda, recurring routines with toggles, new recurring work, run recovery with effect ledger | runs, schedules | Retry never repeats a completed effect; recurring instances not duplicated |
| Data quality dashboard | none | Dashboard area "Data quality" (`src/ui/dashboard/DataQuality.tsx`) | issues, records, `staleRecords` metric | Every figure opens the exact issues in Records, Data quality |
| Activity | `Activity.tsx` | Attention, Everything, People, Agents views over shared audit events; record timeline | events | Counts are not productivity scores |
| Agents | `Agents.tsx` | Neutral agent definitions with purpose, responsible human, scope, permitted actions, approval needs | agents in config | Agent work uses the same tasks and approvals |
| Settings | `Settings.tsx` cards | Organisation, Control, Systems, Governance, Experience child sections with editors and previews | config | Only authorised viewers can save; previews before save |

## Phases

1. Core model, config, permissions, fixtures, store, tests.
2. Shared UI primitives: `frame.tsx` (original Pulse page frame), `kit.tsx` (panels, forms), `topnav.tsx` (scope, module and page switchers), demo badge.
3. Work: requests, tasks, approvals, people, schedules.
4. Records: browse, data quality, files, contacts.
5. Home, Dashboard, Activity, Agents, chat on the same records.
6. Settings editors.
7. Verification: typecheck, tests, browser journeys at 1440x900 and narrow width.
