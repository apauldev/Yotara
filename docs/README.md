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
| [RELEASING.md](./RELEASING.md) | Release pipeline, versioning rules, Docker Hub publishing | Maintainers | Current |
| [archive/](./archive/README.md) | Superseded plans and historical snapshots, kept for context | Anyone asking "why?" | **Historical — never current** |
| [assets/](./assets) | Logo, banner, and documentation images | — | Assets |

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
skips the main pipeline. The one automated check that still runs is
`docs-consistency.yml`, which verifies that every variable in
`apps/api/.env.example` is documented in [CONFIGURATION.md](./CONFIGURATION.md).
Run it locally with `pnpm docs:check:env`.
