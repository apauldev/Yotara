# Yotara Documentation

Index of every document in the repository, with what each one owns. If you are
not sure where something belongs, this table is the answer.

## Start here

| If you want to... | Read |
|:---|:---|
| Understand what Yotara is | [README.md](../README.md) |
| Install and run it locally | [docs/INSTALL.md](./INSTALL.md) |
| Self-host it in production | [DOCKER.md](../DOCKER.md) |
| Contribute a change | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Configure environment variables | [docs/CONFIGURATION.md](./CONFIGURATION.md) |
| Understand how the system is built | [docs/ARCHITECTURE.md](./ARCHITECTURE.md) |
| Write or run tests | [testing.md](../testing.md) |
| Cut a release | [docs/RELEASING.md](./RELEASING.md) |
| Report a vulnerability | [SECURITY.md](../SECURITY.md) |
| See the API reference | Swagger UI at `/docs`, or [`/docs/openapi.json`](http://localhost:3000/docs/openapi.json) from a running instance |

## In `docs/`

| Document | Owns | Audience | Status |
|:---|:---|:---|:---|
| [INSTALL.md](./INSTALL.md) | Canonical local setup, workspace commands, troubleshooting | Contributors, self-hosters | Current |
| [CONFIGURATION.md](./CONFIGURATION.md) | Every environment variable, its default, and its purpose | Operators | Current |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Durable architectural decisions, constraints, known risks, engineering principles | Contributors, architects | Current |
| [code-quality-review-2026-11-23.md](./code-quality-review-2026-11-23.md) | Repository-wide quality review findings, severity, and checklist | Contributors, maintainers | Review record |
| [RELEASING.md](./RELEASING.md) | Release pipeline, versioning rules, Docker Hub publishing | Maintainers | Current |
| [archive/](./archive/README.md) | Superseded plans and historical snapshots, kept for context | Anyone asking "why?" | **Historical — never current** |
| [assets/](./assets) | Logo, banner, and documentation images | — | Assets |

## Plans in `docs/plans/`

Each plan owns its own status header. The index lists what each plan covers; it
does not restate status, which belongs on the roadmap board and in Issues.

| Plan | Owns | Audience |
|:---|:---|:---|
| [2026-10-15-sqlite-scaling-and-concurrency.md](./plans/2026-10-15-sqlite-scaling-and-concurrency.md) | SQLite concurrency pragmas, capacity estimates, and PostgreSQL graduation criteria | Contributors, operators |
| [2026-10-16-refresh-yotara-marketing-site.md](./plans/2026-10-16-refresh-yotara-marketing-site.md) | Marketing-site copy and the release version-stamping repair | Maintainers, writers |
| [2026-10-20-label-system-ux-redesign.md](./plans/2026-10-20-label-system-ux-redesign.md) | Icon-first label identity, one Labels surface, and server-side label filtering | Contributors, designers |
| [2026-10-22-inbox-quick-capture.md](./plans/2026-10-22-inbox-quick-capture.md) | Source of truth for Inbox as the capture surface for unfiled work | Contributors, designers |
| [2026-10-22-project-inline-shortcut.md](./plans/2026-10-22-project-inline-shortcut.md) | Inline project shortcut and capture-token date handling | Contributors |
| [2026-10-23-inbox-quick-capture-phases.md](./plans/2026-10-23-inbox-quick-capture-phases.md) | Delivery phases and completion gates for the Inbox capture plan | Contributors |
| [2026-11-02-project-shortcut-hint.md](./plans/2026-11-02-project-shortcut-hint.md) | `@project` capture with typing guidance | Contributors, designers |
| [2026-11-09-startup-wizard.md](./plans/2026-11-09-startup-wizard.md) | Six-step startup wizard for new accounts | Contributors, designers |
| [2026-11-12-inbound-calendar-read-only.md](./plans/2026-11-12-inbound-calendar-read-only.md) | Inbound read-only calendar events: ICS sources, fetch/parse, and the Calendar layer | Contributors, designers |
| [2026-11-15-task-quick-actions-menu.md](./plans/2026-11-15-task-quick-actions-menu.md) | Task-card quick-actions menu and optimistic background updates | Contributors, designers |
| [2026-11-16-personal-mode-finish-line.md](./plans/2026-11-16-personal-mode-finish-line.md) | Personal-mode project lifecycle, organization, import, and scope decisions | Contributors, product |
| [2026-11-16-project-detail-ux-and-implementation.md](./plans/2026-11-16-project-detail-ux-and-implementation.md) | UX authority for `/projects/:id` and its edit form | Contributors, designers |
| [2026-11-19-task-service-decomposition.md](./plans/2026-11-19-task-service-decomposition.md) | Safe extraction of task-service modules behind a compatibility façade | Contributors |
| [2026-11-24-sqlite-schema-single-source.md](./plans/2026-11-24-sqlite-schema-single-source.md) | One runtime authority for the SQLite schema (finding BE-1) | Contributors |

## Other plan trees and snapshots

These live outside `docs/plans/` and are not surfaced by the main plan table.
`docs/superpowers/plans/` is retained from an earlier workflow; new plans belong
in `docs/plans/`.

| Document | Owns | Audience |
|:---|:---|:---|
| [superpowers/plans/2026-10-11-deploy-automation.md](./superpowers/plans/2026-10-11-deploy-automation.md) | Task-by-task implementation plan for `pnpm deploy` | Maintainers |
| [superpowers/plans/2026-10-15-sqlite-scaling-and-concurrency.md](./superpowers/plans/2026-10-15-sqlite-scaling-and-concurrency.md) | Task-by-task companion to the SQLite scaling spec | Contributors |
| [deploy-automation-plan.md](./deploy-automation-plan.md) | Maintainer spec for semi-automated beta release and deploy | Maintainers |
| [precheck-beta-2026-10-14.md](./precheck-beta-2026-10-14.md) | Point-in-time snapshot of the 2026-10-14 beta release precheck | Maintainers, historians |

## At the repository root

| Document | Owns | Audience |
|:---|:---|:---|
| [README.md](../README.md) | Product overview, screenshots, feature tour, quick start | Evaluators, users |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Workflow, conventions, engineering principles, CI, contributor agreement | Contributors |
| [ROADMAP.md](../ROADMAP.md) | Pointer to the GitHub roadmap board (planning is not tracked in-repo) | Everyone |
| [testing.md](../testing.md) | Test strategy, runners, Playwright E2E, CI job breakdown | Contributors |
| [DOCKER.md](../DOCKER.md) | Self-hosting: Compose, hardening, env vars, TLS, troubleshooting | Operators |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting and supported versions | Everyone |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community standards and reporting | Everyone |
| [CLA.md](../CLA.md) | Contributor License Agreement | Contributors |
| [CHANGELOG.md](../CHANGELOG.md) | Release-by-release history (generated — do not hand-edit) | Everyone |

## Rules for this documentation set

These rules exist because the docs drifted badly once already. Following them
keeps that from recurring.

**One owner per fact.** If a fact is needed in two places, one place owns it and
the other links to it. Setup lives in `INSTALL.md`; environment variables live in
`CONFIGURATION.md`; architecture lives in `ARCHITECTURE.md`.

**Do not restate generated sources.** The API reference is generated from route
schemas. Route tables are hand-maintained and rot fastest — prefer linking to
`apps/frontend/src/app/app.routes.ts` and the OpenAPI spec over copying them.

**Status never lives in a document.** Priority and status belong to the
[roadmap board](https://github.com/users/apauldev/projects/1) and Issues.
`CHANGELOG.md` owns completed work. Do not add sprint plans, backlog tables, or
"recently completed" checklists to `ARCHITECTURE.md` or anywhere else.

**No test counts or version numbers in prose.** They go stale within days. Link
to CI or the relevant manifest instead.

**Archive, don't leave.** When a plan ships or is abandoned, move it to
[`docs/archive/`](./archive/README.md), add the banner, and add a row to the
archive index. A superseded plan left in `docs/` reads as current.

**Update the doc in the same change as the code.** If a pull request changes
behaviour a document describes, that document is part of the pull request.

## Adding a document

1. Decide whether it is durable reference, an active plan, or a historical record.
2. Put it in `docs/` (durable), `docs/plans/` (active work, created on demand), or `docs/archive/` (historical).
3. Add a row to the matching table above.
4. Link it from wherever a reader would look for it — not just from this index.

CI ignores changes limited to `**.md` and `docs/**`, so a docs-only pull request
skips the main pipeline. `docs-consistency.yml` still runs and checks two things:
every variable in `apps/api/.env.example` is documented in
[CONFIGURATION.md](./CONFIGURATION.md), and every tracked document listed above
has a row in this index. Run them locally with `pnpm docs:check:env` and
`pnpm docs:check:index`.
