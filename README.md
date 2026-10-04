# Pulse: base for 50-100k implementations

An industry-agnostic version of Pulse. It keeps the Pulse shell: rail, top bar, themes, chat, agent faces and Ontology graph. Every working page reads from one shared core: Home, Dashboard, Work, Records, Activity, Agents and Settings.

It is a **frontend demo**. Data lives in the browser through a demo adapter. Nothing connects to an external system.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # behavioural tests for the core (vitest)
npm run typecheck
npm run build
```

Two modes, switched from the card at the bottom of the rail:

- **Sample data**: "Example Organisation", with Unit North (Team A, Team B) and Unit South (Team C). It has generic people, records, documents, requests, tasks, runs and data issues. "Role preview" switches the viewer between an administrator, a unit lead, a team manager, a contributor and a second team manager. This is a preview, not sign-in.
- **Clean template**: no records, no client names, no figures. Every page shows an empty state that explains how to populate it.

State persists in `localStorage` (`pulse.core.v1`). "Reset sample" restores the fixtures.

## Where things live

| Area | Location |
| --- | --- |
| Entity and configuration types | `src/core/types.ts` |
| Configuration registry and defaults | `src/core/config.ts` |
| Permissions and scope | `src/core/access.ts` |
| Query layer | `src/core/query.ts` |
| Operations | `src/core/ops.ts` |
| Metric engine | `src/core/metrics.ts` |
| Data-quality detection | `src/core/quality.ts` |
| Sample agent answers | `src/core/agent.ts` |
| Demo adapter | `src/core/store.ts` |
| Fixtures | `src/core/fixtures/sample.ts` (removable), `src/core/fixtures/clean.ts` |
| Tests | `src/core/__tests__/core.test.ts` |
| Page frame (original Pulse look: hero, stat strip, segmented tabs, chips, callouts, KPI tiles) | `src/ui/frame.tsx`, `src/styles/frame.css` |
| Top bar switchers (unit scope, module, page) | `src/ui/topnav.tsx` |
| Panels and form controls | `src/ui/kit.tsx`, `src/styles/kit.css` |
| People and employment | `src/core/people.ts`, `src/ui/people` |
| Shell parts | `src/ui/shell.tsx` |
| Shared counts | `src/ui/selectors.ts` |
| Pages | `src/ui/work`, `src/ui/people`, `src/ui/records`, `src/ui/dashboard`, `src/ui/home`, `src/ui/activity`, `src/ui/agents`, `src/ui/settings` |
| Shell state, navigation, palette, chat | `src/logic/PulseLogic.js` |
| Implementation map | `docs/IMPLEMENTATION_MAP.md` |

What each core module does:

- **Permissions and scope:** a viewer's roles, the scopes they may select, and visibility rules for records, files, tasks, requests, approvals, runs, issues and events.
- **Query layer:** dashboards, tables, panels, search, the palette, exports and agent answers all read through it, so permission and the selected scope apply the same way everywhere.
- **Operations:** every state change. Requests and approvals: stages, return, resubmit, delegation, escalation, material-edit re-review. Execution keyed so it applies once. Tasks: claim, assign, dependencies with loop check, checklist, evidence. Recurring instances keyed by date. Run recovery with an effect ledger. Data-quality resolution: conflict, code mapping, merge with preview and undo, unmatched rows. Also saved views, report schedules, and organisation and configuration changes. Each one writes an audit event.
- **Metric engine:** formula, period, previous period, target, partial and stale flags, missing contributors and drill-down ids. Ratios are calculated from their underlying totals.
- **Data-quality detection:** missing-field issues are derived from record types live; other issues are stored.
- **Demo adapter:** persistence, mode switch, role preview, scope and toasts.

## What is operational and what is simulated

**Operational in this demo (runs locally, end to end):**

- **Roles and scope:** role and scope rules. The scope control appears when there is more than one useful scope, stays the same across pages, and switches with a notice when a role change makes a choice invalid.
- **Requests and approvals:** configurable forms, multi-stage routing, routing away from the requester, return, resubmit, delegation within limits, escalation of overdue decisions, and renewed review after a material edit. Every decision records the request version it reviewed.
- **Execution:** an approved local action (correct a record, approve a document version, create a fulfilment task) runs once per request version. A repeat does nothing.
- **Tasks:** queues, claiming with no double claim, assignment, dependencies with loop prevention, checklists, notes, evidence notes, saved views (sharing never widens access) and a personal focus timer.
- **Top bar:** a unit scope switcher (regions, operating units with open and attention counts, planned units shown but not selectable, teams, My work), a module switcher listing every section, and a page switcher. "Show pages as tabs instead" swaps the page menu for the tab row.
- **People (Work, People):** one row per person with employment stage, manager, tenure, certificates against the required list, documents to sign, open and overdue tasks, leave and access reviews. Actions: start onboarding or offboarding checklists, book a certificate renewal, record a certificate or signature, change stage with a reason, record an access review. Each creates keyed tasks (no duplicates) and an audit event. Leave is requested through the normal approvals and recorded once approved. Managers see their teams; contributors see their own record.
- **Data quality dashboard:** a Dashboard area with completeness, open issues by kind and severity, stale records, resolution trend and the oldest issues, each opening the exact issues in Records, Data quality.
- **Workflow runs:** step timelines, failure with business impact, assign, retry and skip-with-reason recovery, and an effect ledger so a retry never repeats a completed effect.
- **Schedules:** a manual "run due instance" tick that never duplicates. Pausing future runs is separate from pausing a case.
- **Records:** browse, a detail panel (Overview, Related, History, Sources), source-of-truth handling on edit, relationships in both directions, and versioned files that keep their source permissions.
- **Data quality:** missing fields, duplicates (merge preview, merge, undo), unmapped codes, conflicts (comparison panel) and unmatched rows. Each resolution updates the record, the queue, the metrics and the audit trail together.
- **Dashboard and activity:** metrics with drill-down to exactly the counted objects, a unit or team comparison computed from totals, a trend, exceptions, CSV export of permitted rows, and Activity Attention plus a searchable audit trail with record timelines.
- **Settings:** editors for Organisation, Control, Systems, Governance and Experience, with drafts, validation and previews.

**Simulated or not connected (labelled as such in the UI):**

- **Sign-in:** role preview only. There is no authentication.
- **Security:** all permission checks run in the browser. **This is not security.** A production backend must enforce the same rules on every query and action and keep tenants isolated.
- **AI:** there is no model. Chat and agent answers are sample responses built from the records you can see, with citations, and labelled as samples. The agent builder's "Prepare" step writes a template instruction and says so.
- **Source systems:** "Sample source system" and "Sample spreadsheet import" are fixtures. No sync runs; sync state is stored data.
- **Email:** not connected. Email routes, the external-confirmation effect and invitations send nothing. The external-confirmation request (REQ-207) shows the honest failure.
- **Scheduler:** none. Schedule ticks are manual and marked "simulated". Report schedules are saved but never sent.
- **File upload:** none. Evidence is recorded as named notes.

## Production dependencies still required

1. **Backend API and database:** the same entities, with tenant isolation, and permission and scope enforcement server-side on every query, export and agent tool call.
2. **Identity:** company sign-in (SSO/OIDC) mapped to people, roles and memberships.
3. **Background workers:**
   - a scheduler for recurring instances, automations and report delivery, using the same instance keys;
   - escalation timers;
   - durable workflow execution with the effect ledger.
4. **Connectors:**
   - source-system connectors with field mappings and write-back;
   - an email provider with a verified sender.
5. **AI:** a model behind `src/core/agent.ts`, limited to the query layer's permitted evidence.
6. **File storage:** storage that keeps source document permissions.

## Configuring a client

Labels, modules, records, views and workflows are set in the client's configuration, not in code:

- **Configuration:** an `OrgConfig` (see `src/core/types.ts`), edited in Settings or seeded as a fixture. It sets the workspace name, terminology, enabled capabilities, units and teams, roles and permissions, record types and fields, metrics and dashboards, request forms, approval rules, deadline policies, workflow templates, notification routes, sources, field and code mappings, agents and role layouts.
- **Client data:** replace `src/core/fixtures/sample.ts` with the client's fixture, or with an API-backed adapter in `src/core/store.ts`. Keep `ops`, `query` and `metrics` as the shared rules.
- **Locked layout:** read `CLAUDE.md` first. Agents sits under Home, Ontology is the first Records tab, and the Home centre column stays clean.

## Known limits

- The Ontology graph is an illustrative procedural layout (labelled so), kept because `CLAUDE.md` locks it. Browse is the way to find a record.
- New requests do not create a workflow run. Runs exist for the seeded cases and for scheduled automations.
- **Do not run `npm run import-design` on this copy.** It overwrites `src/views` and `src/logic` and would undo this work.

## V2 (October 2026): modules, operations and the agent organisation

Navigation and modules come from `src/core/modules.ts`. Projects and People are on in the shared build;
Finance, Purchasing and Standards are optional and switched on only in the sample. Turning one off
(Settings > Experience > Modules & labels) removes its navigation, tabs, dashboard views, shortcuts and
agent tools, explains the impact first, and keeps its data. Every page and tab has a direct link (`#/Page/tab`).

| Area | Where | What it does |
| --- | --- | --- |
| Home | `src/ui/home/Today.tsx` | Chat mode as before; Today mode: briefing linked to sources, decisions mine / others, priorities, agenda, exceptions |
| Dashboard | `src/ui/dashboard/` | One KPI strip, trend, comparison table (rows open unit profiles), exceptions, Reports |
| Work | `src/ui/work/` | My work, Team work (same tasks), Requests, Approvals, Workflows, Calendar (`src/core/calendar.ts`) |
| Projects | `src/core/projects.ts`, `src/ui/projects/` | Portfolio, timeline, templates, project detail, gates, milestone impact preview |
| Unit profiles | `src/ui/units/UnitProfile.tsx` | Unit, team or location: performance, work, projects, people, files, activity |
| People | `src/ui/peoplemod/`, `src/ui/people/` | Directory, teams, weekly allocation (unestimated work kept separate), onboarding, documents and training |
| Finance | `src/core/finance.ts`, `src/ui/finance/` | Budgets (approved, committed, invoiced, paid side by side), receivables, payables, transactions, cash outlook only with an opening balance |
| Purchasing | `src/core/purchasing.ts`, `src/ui/purchasing/` | Purchase requests (canonical requests), orders, suppliers, receipts, invoice matching and review |
| Standards | `src/core/standards.ts`, `src/ui/standards/` | Requirements, readiness matrix, evidence review, checks, policy acknowledgements |
| Agents | `src/core/orchestration.ts`, `src/ui/agents/` | Organisation chart (default), list view, runs, templates, guided add-agent flow |
| Activity | `src/ui/activity/`, `src/core/updates.ts` | Overview streams grouped into stories, company updates (draft, then publish), needs attention, history |

**Agents.** A saved definition (`config.agents`) has an accountable owner, a coordinator (chart parent only:
it grants no data or tool authority), scope, tools, limits and an optional spawn policy. A run
(`data.agentRuns`) records each step. Temporary workers live inside a run and are never saved agents unless
someone explicitly saves one as a draft. Restricted tools raise a canonical request in Work; the decision and
the execution are separate steps and the effect is keyed so it never applies twice. Runs execute in the
local sample engine (deterministic, labelled Simulated, usage Unknown). To run agents for real, implement
the `OrchestrationAdapter` interface in `src/core/orchestration.ts` against a server-side runtime; provider
keys stay server-side.

**Operational locally (sample engine and demo store):** module navigation and configuration, project
templates, gates and milestone moves, budgets and invoice matching, evidence review and gates, checks and
acknowledgements, weekly allocation, calendar and appointments, company update drafting and publishing,
agent definitions, coordinator delegation, temporary workers within limits, approval waits, stop, retry
without repeated effects.

**Simulated or not connected:** sign-in (role preview only), backend security and tenant isolation (all
checks run in the browser), any AI model or agent runtime, the accounting feed (sample, read-only), order
sending and payments (always refused honestly), email, scheduling (schedules run from a button, report
schedules are labelled simulated).

**Client configuration:** module labels and tab labels, project label/types/phases/templates/progress basis,
record types and fields, metrics (modules register calculations with `registerMetric`), dashboards (with
an optional owning module), approval rules and forms (modules plug in with `registerEffect` and
`registerDecisionHook`), purchasing tolerance and receipt rules, standards requirements and checks, agent
tools, templates and orchestration limits, role defaults (Home Chat or Today). Sample rows live in
`src/core/fixtures/sample-*.ts` and can be removed with the rest of the fixture layer.
