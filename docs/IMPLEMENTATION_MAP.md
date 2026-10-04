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

---

# V2 (October 2026): operations template + agent organisation chart

Implements "Pulse 50-100k implementation prompt V2". Three layers stay separate:
shared foundation (`src/core/*`, shell), configurable capability modules
(Projects, People, Finance, Purchasing, Standards: `config.modules`), client
configuration (`OrgConfig`: labels, enabled modules, fields, phases, rules,
templates, metrics) plus a removable sample fixture layer (`src/core/fixtures/sample-*.ts`).

## Map

| Requirement | Existing component | Reuse or change | Data dependency | Acceptance check |
| --- | --- | --- | --- | --- |
| Page/module registry | `NAV`, `WORK_SECTIONS`, `REC_SECTIONS` in `data.js` | New `src/core/modules.ts`: pages, sections, module owner, labels, `visiblePages`, `disableImpact`; PulseLogic reads it | `config.modules`, roles | Disabled module leaves nav, tabs, palette, dashboard views; data kept |
| Grouped rail, pins, overflow | `AppShell` rail, `topnav.tsx` ModuleSwitch | Group labels, pins, ModuleSwitch from registry | registry | Only enabled + permitted pages; Agents under Home |
| Visible page tabs on desktop | `contextNav` + PageSwitch dropdown | Tabs default at >= 900px, dropdown on mobile; one `sectionOf/setSection` for every page | registry | Tabs visible at 1440; selector at 390 |
| Direct links, legacy ids | none | `#/Page/section` hash, legacy section map (tasks, schedules, ontology, all, people) | none | Old links land on the new section |
| Demo menu | `ViewerCard` block in rail | Compact Demo menu + persistent Sample indicator | session | Rail no longer dominated by demo controls |
| Home Today | Chat centre + rail | Chat kept; Today mode uses main width (briefing, decisions mine/others, priorities, agenda, exceptions) | attention, approvals, projects, agent runs, appointments | Role default + user preference |
| Dashboard | KPI band + repeated tiles | One KPI strip, trend, comparison table -> unit profile, exceptions, Reports | metrics engine (+ `registerMetric` for modules) | No duplicate strip; drill-down = exact ids |
| Unit profiles | none | `src/ui/units/UnitProfile.tsx` panel | metrics, tasks, projects, people, files, events | Like-for-like only |
| Work | Tasks / Approvals / People / Schedules | My work / Team work / Requests / Approvals / Workflows / Calendar | tasks, requests, approvals, runs, schedules, appointments | Same task ids in both views; timer only in My work |
| People module | Work > People | Directory / Teams / Availability / Onboarding / Documents and training | employment, leave, tasks (estimates) | Unestimated work never counted as zero |
| Projects | none | `src/core/projects.ts`, `src/ui/projects/**` | projects, milestones, risks, updates, tasks, obligations, budgets | Milestone move: dependants, health, one story |
| Finance (optional) | none | `src/core/finance.ts`, `src/ui/finance/**` | budgets, receivables, transactions, orders, invoices | Stages never summed; one currency per figure |
| Purchasing (optional) | none | `src/core/purchasing.ts`, `src/ui/purchasing/**` | suppliers, orders, receipts, invoices, canonical requests | Over-order invoice opens one review; approval does not pay |
| Standards (optional) | People certificates | `src/core/standards.ts`, `src/ui/standards/**` | requirements, obligations, checks, policy acks, files | Received is not accepted; acceptance releases the gate |
| Shared approval hooks | `executeRequest` switch | `registerEffect`, `registerDecisionHook` in `ops.ts` | requests, approvals | Module reviews use the one approval model |
| Records | Ontology default | Browse default; record detail Overview / Related work / Files / History / Sources; Relationships (ontology) last | records, files, events | 8 to 10 rows visible at 1440x900 |
| Comments and mentions | none | `ops.addComment`, `src/ui/collab/Comments.tsx` | comments | Mentions resolve to people |
| Activity | Audit table | Overview streams + stories by `storyKey`, company updates (draft -> publish), Needs attention, History | events, companyUpdates | Audit event never auto-published |
| Agents | Chat-first page | Organisation chart (default), Runs, Templates; `src/core/orchestration.ts` adapter + sample engine | `config.agents`, `agentRuns`, tools, templates, orchestration limits | Cycles rejected; delegation, spawn, approval wait, retry without repeat |
| Settings | 5 groups | New: Agent orchestration, Project types & phases, Purchasing & finance rules, Standards & requirements, Modules & labels | config | Admin-only; disable explains impact first |

## Extension point for client-specific modules

1. Add a `PageDef` to `PAGES` in `src/core/modules.ts` (id, sections, module id, permission).
2. Add its page component to `MODULE_PAGES` in `src/ui/modules/registry.tsx`.
3. Put its records and rules in a core file; plug approvals in with `registerEffect` / `registerDecisionHook`, measures with `registerMetric`, agent tools by adding `AgentToolDef`s with `module` set.
4. Its sample rows go in a new `src/core/fixtures/sample-<module>.ts`. Shared code never checks a client name.
