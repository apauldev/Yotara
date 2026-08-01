# Architecture Guide — Yotara

> **Status:** Living architectural reference. Last reviewed 2026-07-31.
> **Owner:** @apauldev
>
> This document describes architecture, durable engineering decisions, and
> known risks. It is not the product roadmap. Prioritized work belongs in the
> [Yotara Roadmap GitHub Project](https://github.com/users/apauldev/projects/1)
> and its Issues.

## Current state

Yotara is a personal-first, self-hosted task manager built as a TypeScript
pnpm monorepo. The current product is substantially beyond the original MVP:

- Angular 21 frontend using standalone components, signals, lazy routes, and
  shared UI primitives.
- Fastify 5 API with a route → service → database shape.
- SQLite with Drizzle ORM, transactional multi-table writes, startup schema
  bootstrap, timestamp normalization, and database permission hardening.
- Better Auth session-cookie authentication, password reset email flow,
  account deletion, rate limiting, login lockout, and security headers.
- Email verification is wired but dormant: the verification callback exists in
  the API, but `requireEmailVerification` is `false`, so the flow is inactive
  until that flag is flipped (tracked as future work in
  [docs/admin-notifications.md](./admin-notifications.md)).
- Personal task views, projects, labels, archive, search, subtasks, recurring
  tasks, themes, keyboard shortcuts, and in-app notifications.
- Docker deployment behind nginx, published container images, OpenAPI docs,
  CI checks, CodeQL, gitleaks, Dependabot, and release automation.

The repository typechecks cleanly. At the last review, the test suites passed
212 API tests and 636 frontend tests.

## System shape

```text
Angular frontend
  ├─ route guards, shells, pages, shared UI
  ├─ services and signals for client state
  └─ shared domain/auth package
          │ HTTP + session cookies
          ▼
Fastify API
  ├─ auth bridge and request guards
  ├─ route schemas and OpenAPI
  ├─ domain services
  └─ security/rate-limit/error plugins
          │ Drizzle
          ▼
SQLite database
```

### Frontend

`apps/frontend` owns presentation, navigation, client-side interaction state,
and API consumption. Pages compose smaller feature components; shared controls
live under `shared`. Services own API calls and reusable state rather than
leaving filtering or business rules in individual components.

Task views use server-side query parameters (`view`, `overdue`,
`completedSince`, timezone) instead of loading the entire task collection and
filtering it in the browser. Search is also server-side via
`GET /tasks/search`, with SQL relevance scoring and pagination. The remaining
bounded task collection used for subtasks and label assignment is intentional;
it is not the former unbounded expand-loop design.

### API

`apps/api` keeps route handlers thin. Routes authenticate and validate input,
then delegate domain work to services. Services own authorization-aware
queries, transactions, recurrence materialization, notification behavior, and
data mapping.

Domain errors use `AppError` subclasses and are mapped by Fastify's central
error handler. Multi-table writes use SQLite transactions so task/label,
recurrence, account deletion, and related operations fail atomically.

### Shared package

`packages/shared` is the cross-runtime source of truth for domain types, DTOs,
and the Better Auth client wrapper. It must remain free of browser-only or
server-only assumptions.

## Important architectural decisions

### Personal-first product boundary

Personal mode is the supported product center. Team mode is a planned
expansion, not a reason to add enterprise workflow concepts to the personal
domain prematurely. New features should earn their place by improving
capture, focus, planning, completion, or self-hosting.

### Server-side filtering

The server filters by status, completion, due date, archive state, search
query, and timezone. The frontend may group or decorate already-filtered
results, but it should not recreate API filtering in computed signals.

### SQLite first

SQLite is the default because Yotara targets a self-hosted personal workload:
one portable database, low operational overhead, simple backup, and no
required database service. Any future team-mode storage change must be driven
by measured requirements rather than premature abstraction.

### Explicit timezone handling

Calendar dates are user-facing dates, not implicit UTC instants. API calls that
interpret “today”, “upcoming”, or restoration buckets carry the user's
timezone. Shared timestamp/calendar helpers should be used instead of ad-hoc
date parsing or raw UTC assumptions.

### Security at deployment boundaries

The supported deployment is nginx in front of the API. The API's proxy trust
and IP-based rate limiting depend on that proxy overwriting/forwarding the real
client address correctly. The API must not be exposed directly with an
unrestricted `trustProxy` setting.

Security-sensitive behavior belongs at the boundary where it can be enforced:

- authentication and authorization in shared API guards/services;
- schema validation at routes;
- typed errors in services and centralized response mapping;
- session, email, and login rate limits in the API;
- CSP, security headers, secret checks, CodeQL, and secret scanning in the
  deployment/CI layers.

## Current strengths

- The frontend/API data-flow migration is complete: no old full-dataset view
  filtering or client-side search scorer remains.
- Preferences are centralized in `PreferencesStore` rather than scattered
  `localStorage` access.
- Error handling, rate limiting, auth hardening, database hygiene, and Docker
  hardening have received focused follow-up work.
- API route tests now cover auth, tasks, projects, labels, search,
  notifications, profile, health, and OpenAPI behavior.
- The release pipeline publishes pre-built images and gates publishing on CI.
- The project has a credible contributor path through setup documentation,
  issue templates, OpenAPI, and automated checks.

The closed Issue history corroborates several of these migrations: timezone
handling ([#170](https://github.com/apauldev/Yotara/issues/170)), planning
harvest ([#171](https://github.com/apauldev/Yotara/issues/171)), server-side
search ([#176](https://github.com/apauldev/Yotara/issues/176)), keyboard
shortcut reference UX ([#221](https://github.com/apauldev/Yotara/issues/221)),
browser reminders ([#218](https://github.com/apauldev/Yotara/issues/218)), and
route coverage for `/me`, `/health`, and `/`
([#286](https://github.com/apauldev/Yotara/issues/286)). These are completed
capabilities, not active roadmap items.

## Known risks and technical debt

These are architectural observations, not a second roadmap. Create or update
the corresponding GitHub Issue when work is ready to be prioritized.

### 1. The API task service is still large

`apps/api/src/services/task-service.ts` is roughly 685 lines and currently
combines task CRUD, filtering, recurrence, subtasks, labels, notifications,
and date restoration. It is coherent, but it is the first place likely to
become difficult to change. Future extraction should follow domain seams
(recurrence, task queries, or notification side effects) and preserve service
transaction boundaries. This is represented by Issues [#57](https://github.com/apauldev/Yotara/issues/57)
and [#175](https://github.com/apauldev/Yotara/issues/175). Issue #175 is
currently In Progress on the Roadmap Project and captures the remaining
frontend/service decomposition work.

### 2. A few UI timers are deliberate but deserve scrutiny

Timers remain for the loading indicator's minimum display duration, the change
password success close, and toast lifecycle. These are now explicit UX
policies rather than accidental synchronization, but they should stay covered
by behavior tests and must not become substitutes for state modeling. The
original failure modes are the reason this is tracked: a fixed 2000ms modal
close timer was too short on slow devices (the success message vanished before
it was read) and felt laggy on fast connections, which is exactly the kind of
UX regression fixed-duration timers cause.

### 3. Input validation should remain uniform

The API has route schemas and typed domain errors, but every new query/body
field needs runtime validation—not just TypeScript types. In particular,
timezone, enum, pagination, and free-text limits should be reviewed whenever a
route evolves.

### 4. Self-hosting remains the product's largest operational risk

Installation, upgrades, backups, restore, email configuration, and migration
recovery matter as much as feature breadth. Docker images and smoke tests help,
but changes to deployment behavior should include a documented upgrade and
rollback story.

### 5. Ownership and contributor concentration

The project still has a high single-maintainer concentration. This is less a
code smell than a continuity risk. Documentation, small well-scoped Issues,
and reviewable changes are the best current mitigation.

## Issue-backed architecture map

The following are the current architectural themes represented in GitHub
Issues. The numbers are pointers, not a duplicate backlog; GitHub owns their
priority and status.

| Theme | Representative Issues | Architectural implication |
|---|---|---|
| Frontend decomposition | [#57](https://github.com/apauldev/Yotara/issues/57), [#58](https://github.com/apauldev/Yotara/issues/58), [#254](https://github.com/apauldev/Yotara/issues/254), [#255](https://github.com/apauldev/Yotara/issues/255), [#268](https://github.com/apauldev/Yotara/issues/268) | Keep API clients, view state, shell chrome, templates, and date utilities separable without reintroducing duplicated filtering logic. |
| API boundary quality | [#266](https://github.com/apauldev/Yotara/issues/266), [#267](https://github.com/apauldev/Yotara/issues/267), [#269](https://github.com/apauldev/Yotara/issues/269), [#271](https://github.com/apauldev/Yotara/issues/271), [#276](https://github.com/apauldev/Yotara/issues/276) | Keep auth bridging, CORS, validation, and structured errors centralized and tested at the boundary. |
| Query and data scalability | [#61](https://github.com/apauldev/Yotara/issues/61), [#228](https://github.com/apauldev/Yotara/issues/228), [#231](https://github.com/apauldev/Yotara/issues/231), [#232](https://github.com/apauldev/Yotara/issues/232), [#257](https://github.com/apauldev/Yotara/issues/257) | Prefer SQL filtering, sorting, batching, and bounded pagination; protect the request/response contract with per-view integration tests. |
| Deployment and observability | [#64](https://github.com/apauldev/Yotara/issues/64), [#172](https://github.com/apauldev/Yotara/issues/172), [#236](https://github.com/apauldev/Yotara/issues/236), [#237](https://github.com/apauldev/Yotara/issues/237), [#252](https://github.com/apauldev/Yotara/issues/252), [#277](https://github.com/apauldev/Yotara/issues/277) | Keep releases reproducible and make coverage, image risk, bundle growth, and production request context visible. |
| Product model and UX | [#258](https://github.com/apauldev/Yotara/issues/258), [#259](https://github.com/apauldev/Yotara/issues/259), [#260](https://github.com/apauldev/Yotara/issues/260), [#281](https://github.com/apauldev/Yotara/issues/281) | Document the meaning of `done`, `archived`, `simpleMode`, buckets, and search results before adding more workflow concepts. |
| Team-mode boundary | [#238](https://github.com/apauldev/Yotara/issues/238), [#239](https://github.com/apauldev/Yotara/issues/239), [#240](https://github.com/apauldev/Yotara/issues/240), [#241](https://github.com/apauldev/Yotara/issues/241), [#278](https://github.com/apauldev/Yotara/issues/278) | Preserve workspace-scoped seams in new code, while keeping personal mode the supported center of gravity. |

Future features such as calendar, import/export, task duplication, bulk
actions, undo, natural-language capture, and PWA support are product Issues,
not architectural commitments. They should not change the core system shape
without an explicit design decision.

## Roadmap Project snapshot

The [Yotara Roadmap Project](https://github.com/users/apauldev/projects/1) is
the operational source of truth. Snapshot reviewed 2026-08-01:

- 118 items total: 15 Done, 14 In Progress, and 89 Todo.
- Priority distribution: 1 Urgent, 18 High, 90 Medium, and 9 Low.
- Done items include timezone handling (#170), planning harvest (#171),
  server-side search (#176), browser reminders (#218), database transactions
  (#227), N+1 batch label fetching (#228), and API security headers (#251).
- In-progress architecture work includes TaskService cleanup (#175), backend
  test coverage (#178), loadProjectById consolidation (#229), duplicate label
  name checks (#230), SQL-side sorting (#231), shared test helpers (#232),
  structured logging (#252), per-view task-filter tests (#257), search
  debouncing (#261), auth-bridge and CORS consolidation (#266–#267), structured
  validation errors (#271), and tighter auth-route CORS (#276).
- High-priority Todo work currently includes production API hardening (#65).
- Admin & Notifications work (issues #245–#250) follows the implementation
  plan in [docs/admin-notifications.md](./admin-notifications.md).

The statuses above are the board's as of the snapshot date; where work has
since shipped, the board and this section should be updated together. Closed
Issues and shipped commits are evidence of completed work, but the board's
Project status is authoritative for what is currently being worked on.

Several older sprint Issues remain deliberately represented on the board—for
example #173 and #179 are Todo while #174 is Done and #178 is In Progress.
Their titles
describe the original work packages; their Project status is authoritative.

## Testing and verification policy

- Service tests cover domain rules and transaction behavior.
- Route tests cover authentication, validation, status codes, and response
  contracts.
- Frontend component tests assert rendered behavior and public interactions;
  avoid reaching into private fields with `as any`.
- Playwright tests cover user journeys and deployment-facing behavior.
- OpenAPI tests should be updated with route contract changes.
- A checklist item that says “verify” should become an automated test when the
  behavior is important enough to preserve.

The standard local verification command is:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

## Planning and documentation policy

The backlog migration to GitHub Issues is substantially complete. Do not add a
new sprint plan, backlog table, or “recently completed” checklist here.

- GitHub Issues and the [Yotara Roadmap Project](https://github.com/users/apauldev/projects/1)
  own priority, status, and sequencing.
- `docs/ARCHITECTURE.md` owns durable architecture, constraints, and risks.
- `CHANGELOG.md` owns release-level completed work.
- `docs/CONTRIBUTING.md`, `docs/RELEASING.md`, and `DOCKER.md` own operational
  procedures.
- `ROADMAP.md`, `docs/project-plan.md`, and the package TODO files are legacy
  historical material. They should not be treated as current status or a
  second source of truth. The migration/harvest work is recorded as completed
  in [#171](https://github.com/apauldev/Yotara/issues/171); the files remain in
  the repository as historical context.

Some historical sprint Issues remain open because the Roadmap Project still
uses them as work packages. Their board status, not their age or title, is the
status to follow. Issue [#286](https://github.com/apauldev/Yotara/issues/286)
is closed and is listed above as completed evidence, even though it is not a
current Project item. The same applies to other closed Issues whose work is
complete but whose items were not retained on the board.

When a GitHub Issue changes an architectural decision, update this document in
the same change. When an Issue only tracks implementation work, leave this
document alone.

## Engineering principles

- Services fetch; components compose.
- The server owns query semantics; the client owns interaction and display.
- Use shared types and helpers instead of parallel local contracts.
- Keep multi-table writes transactional.
- Treat security assumptions as deployment documentation, not hidden magic.
- Separate behavior fixes from pure refactors when practical.
- Prefer a small, tested boundary over a clever abstraction.
- Keep the personal experience calm by default.
