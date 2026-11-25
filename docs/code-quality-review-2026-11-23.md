# Code Quality Review — 2026-11-23

**Status:** In progress — closed findings are recorded in §4
**Scope:** repository-wide static review
**Method:** source inspection of `apps/api`, `apps/frontend`, `packages/shared`,
`scripts/`, CI workflows, and docs. No runtime profiling; grades are judgement calls.

---

## 1. Verdict

**Overall: B+ / A−.** Well above average for a project this size, and clearly
maintained. Security, testing, CI, and type safety are the strongest parts. The
debt is concentrated in a handful of large files, the database migration story,
and documentation/config drift — not systemic rot.

| Area | Grade | Summary |
|---|---|---|
| Backend / API | **B+** | Excellent security, validation, transactions; migration story is a real liability |
| Frontend | **B** | Strong typing, state stores, accessibility; god-components and zoneful change detection |
| Testing & CI | **A−** | Deep, real test suites and impressive CI; no coverage gate and specs are not linted |
| Docs & config | **B−** | Good docs system, but visible drift between docs and code |
| Maintainability | **B** | Very clean hygiene; several 1k+ line files and duplicated shells |

### What is strong

- Security is unusually serious: ownership checks in SQL, secret-entropy fail-fast,
  CORS wildcard rejection, SSRF-hardened ICS fetching, scoped rate limits, CSP,
  gitleaks, CodeQL.
- Test depth: ~2,280 cases overall; real SQLite integration tests, a macOS soak
  for timing-sensitive locks, and native amd64/arm64 Docker smoke tests.
- Strict TypeScript across the workspace; effectively no `any` or `@ts-ignore`
  in production code, and no `TODO`/`FIXME` in source.
- Accessibility is better than most production apps: focus traps, focus restore,
  `aria-live`, keyboard handling.
- Tooling and release hygiene: commitlint, lint-staged, auto release, docs
  consistency checks, `.env.example`/docs drift check.

---

## 2. Findings

Severity key:

- **P0** — fix soon; user- or ops-visible
- **P1** — material maintainability / correctness risk
- **P2** — should fix when touching the area
- **P3** — cleanup

### Backend / API

**BE-1 — P0 — Three sources of truth for the database schema.**
`apps/api/src/db/client.ts` contains hand-written bootstrap DDL plus an
`ensureSqliteSchema` `ALTER TABLE` chain (~465 lines); `db/schema.ts` is a Drizzle
schema; `drizzle/0000…0008` migrations exist but are never applied at runtime.
Adding a column means editing three places, and drift is undetected by CI.
_Direction:_ pick one path — run Drizzle migrations at boot, or keep one
idempotent DDL source — and delete the others.

**BE-2 — P1 — Read endpoints write.**
`GET /tasks` runs `cleanupExpiredArchivedTasks` on every request
(`routes/tasks.ts:79-85`, `task-retention-service.ts`). `GET /notifications` and
`/notifications/unread-count` run `scanDueNotifications`, which inserts rows and
is N+1 (`notification-service.ts:258-300`); the scan also runs inside every
task-create write transaction.
_Direction:_ move retention/scan to a scheduled job or explicit mutation; make
GETs read-only.

**BE-3 — P1 — Duplicated project helpers and a layering inversion.**
`services/project-service.ts:11-12` imports normalizers from
`routes/project-utils.js`. `routes/project-utils.ts:103-171` duplicates
`getProjectById` / `getProjectsForOwner` / `ensureOwnedProject` and several are
dead exports.
_Direction:_ move normalizers to `services/` or `lib/`; delete dead helpers.

**BE-4 — P1 — DTO and OpenAPI schema duplication.**
TS DTOs live in `packages/shared/src/domain.ts`; OpenAPI JSON Schemas are
hand-written in `apps/api/src/docs/openapi.ts` (1,834 lines). Tests assert that
paths/examples exist, not that schemas match the DTOs.
_Direction:_ derive schemas from types (typebox/zod) or add contract tests.

**BE-5 — P2 — Unbounded project task query.**
`project-service.ts:450-478` fetches every task for a project with no pagination
and sorts in JS; the route returns the whole array.
_Direction:_ paginate/bound the query and sort in SQL.

**BE-6 — P2 — Raw SQL search path duplicates mappers.**
`routes/search.ts:250-380` uses `db.all` with snake_case row interfaces and its
own `toTask` / `toProject` / `toLabel`, duplicating `task-mapper.ts` and
`project-utils.ts`. `t.*` / `p.*` couple responses to table shape.
_Direction:_ reuse Drizzle + existing mappers; select explicit columns.

**BE-7 — P2 — Inconsistent auth guards and error conventions.**
Dead `if (!request.userId)` branches return 404 instead of 401 in several
`routes/tasks.ts` handlers even though the `preHandler` already answered 401.
Two error conventions coexist: `AppError` + central handler and
`sendNotFound`/`sendBadRequest` helpers.
_Direction:_ standardize on `AppError`; remove unreachable branches.

**BE-8 — P2 — Complexity hotspots.**
`docs/openapi.ts` 1,834 lines, `lib/calendar-parse.ts` 1,027,
`db/client.ts` 889, `lib/calendar-fetch.ts` 706, `routes/tasks.ts` 584.
_Direction:_ split by concern; the calendar parser and client deserve their own
module boundaries.

**BE-9 — P2 — Test isolation and monolith specs.**
`routes/tasks.test.ts` is 2,404 lines. `createAuthedApp()` / `signUpAndGetCookie()`
are copied across 6–8 files. `db/test-db.ts` sets `DATABASE_URL` as an import
side effect, so isolation depends on one file per process.
_Direction:_ extract test factories; make DB setup explicit.

### Frontend

**FE-1 — P0/P1 — God components.**
Verified line counts:
`settings-page` 1,523; `capture-bar` 1,330; `personal-task-card` 1,182;
`personal-task-modal` 1,088 (+1,092 SCSS); `task-quick-actions-menu` 1,065;
`startup-wizard` 1,021 (+768 HTML, +1,233 CSS); `auth-shell` 767.
_Direction:_ extract presentational subcomponents and move shared CSS to tokens;
start with the task card/modal and settings.

**FE-2 — P1 — App-wide eager change detection.**
~70 components use `ChangeDetectionStrategy.Eager`; only two use `OnPush`;
zone.js is still enabled. ~159 method calls are bound directly in templates and
re-run every cycle.
_Direction:_ add `OnPush` to high-instance leaves first; convert template methods
to `computed`; plan zoneless separately.

**FE-3 — P1 — Duplicated shells and a dead second workspace.**
`personal-shell` (312 TS + 413 HTML + 1,201 CSS) and `auth-shell` (767 TS inline)
implement the same sidebar/avatar/logout/toast scaffolding. Team mode is a
~36-line stub but ships a second route tree and guard path.
_Direction:_ share shell primitives; remove or finish team mode.

**FE-4 — P2 — Decorator inputs still dominate.**
~261 `@Input`/`@Output` decorators versus 6 signal `input()`/`output()`/`model()`
calls.
_Direction:_ migrate incrementally where templates already use signals.

**FE-5 — P2 — Dead code and lifecycle hygiene.**
`shared/pipes/task-count.pipe.ts` is unused. `router.events.subscribe(...)` in
both shells lacks `takeUntilDestroyed`. Task mutations report errors both via
the global interceptor toast and inline error state.
_Direction:_ remove unused code; add teardown; opt out with `X-Skip-Error` or
handle mutations inline only.

**FE-6 — P2 — Frontend lint gap.**
The package `lint` script is `tsc + stylelint`; root ESLint runs in CI but
explicitly ignores `**/*.spec.ts`. The suites contain ~280 `as any` casts,
including white-box `componentInstance` access that CONTRIBUTING discourages.
_Direction:_ lint specs; add a rule/test banning `as any` on component instances.

### Testing and CI

**TC-1 — P1 — No coverage gate.**
`codecov.yml` targets 80%, but the CI `coverage` job is `continue-on-error: true`
with `fail_ci_if_error: false`; neither `c8` nor Karma defines a threshold.
_Direction:_ fail under a baseline/threshold once the current number is recorded.

**TC-2 — P1 — `packages/shared` has no tests.**
Its `test:coverage` script only echoes a message, and there is no `test` script.
It owns non-trivial logic: `nameKey()` Unicode folding and the email regex used
by both apps.
_Direction:_ add focused unit tests and wire the package into `pnpm -r test`.

**TC-3 — P2 — E2E flakiness and production gap.**
`playwright.config.ts` uses `retries: 0`, `workers: 1`, fixed 30s timeouts, and a
hardcoded `waitForTimeout(300)`. Global setup scrapes the verification URL from
the API log. E2E runs against `ng serve` + `tsx watch`, not the production
bundle.
_Direction:_ run against the built static output, add one retry in CI, and stop
log scraping.

**TC-4 — P2 — Supply-chain hardening gaps.**
No container scanning or SBOM. Dependabot covers npm and GitHub Actions but not
Docker. Actions are pinned by mutable tag, not SHA. `ci.yml` and
`secret-scan.yml` lack a `permissions:` block.
_Direction:_ add Docker to Dependabot, least-privilege permissions, SHA pins;
optionally add an image scanner.

**TC-5 — P3 — Markdown is never format-checked.**
`.prettierignore` contains `*.md`, so CI skips docs, while lint-staged still
rewrites staged Markdown.
_Direction:_ remove `*.md` from the ignore list or add a docs format check.

**TC-6 — P3 — Toolchain pins are duplicated.**
Node/pnpm versions appear in `package.json`, seven workflow files, and both
Dockerfiles; there is no `.nvmrc`/`.node-version`.
_Direction:_ introduce one version file and reference it everywhere.

### Documentation and config

**DC-1 — P0 — `docker-compose.hub.yml` is stale.**
It pins `v0.77.0` while the repo is `0.94.0`. The release sync script updates
`docker-compose.selfhost.yml`, `index.html`, and `install.html`, but not this
file.
_Direction:_ update the compose file and include it in release syncing.

**DC-2 — P1 — `docs/ARCHITECTURE.md` describes code that no longer exists.**
It calls `apps/api/src/services/task-service.ts` a ~685-line monolith; the file is
now 27 lines and the logic lives in `task-write-service` / `task-query-service` /
`task-policy` / `task-mapper`.
_Direction:_ update or remove the "Known risks" entry.

**DC-3 — P1 — `docs/README.md` is stale.**
The index references one plan while `docs/plans/` contains 22; there is a second
unindexed plan tree under `docs/superpowers/plans/`, plus unindexed precheck and
presentation docs.
_Direction:_ archive completed plans and update the index.

**DC-4 — P1 — CSP is copied in ~9 places.**
Despite being called a single source of truth, the policy literal appears in
three compose files (multiple services), `apps/api/src/server.ts`, and
`apps/yotara-website/install.html`.
_Direction:_ generate/inject it from one value at build or deploy time.

**DC-5 — P2 — Vestigial and stale files.**
`apps/frontend/llms-full.txt` is 16,477 unreferenced lines (and the only remaining
TODO comments). `apps/frontend/e2e/PLAN.md` claims 73 tests and a rate-limit
default that no longer match the code.
_Direction:_ delete or move the llms file; update or remove the e2e plan.

**DC-6 — P2 — tsconfig drift.**
Eight tsconfigs and four different `@yotara/shared` resolutions; neither app
extends `tsconfig.base.json`.
_Direction:_ consolidate resolution and extend the base.

**DC-7 — P2 — Marketing site is outside the guardrails.**
~4,000 lines of hand-written HTML with duplicated nav/footer/head, excluded from
ESLint, and no build/templating step. It also embeds a compose snippet that the
release script string-matches.
_Direction:_ at minimum lint it; longer term, add a small build step or shared
partials.

### Cross-cutting

**CC-1 — P1 — Duplicated logic across the API/frontend boundary.**
Avatar MIME/magic-byte/cap logic exists twice (`apps/api/src/lib/avatar.ts` and
`apps/frontend/src/app/shared/utils/avatar.ts`). `fetchRecentlyCompletedTasks$()`
and `getArchivedTasks()` are byte-identical. Two hardcoded-color guard scripts
use the same regex.
_Direction:_ move shared rules into `packages/shared` and dedupe.

**CC-2 — P2 — Likely unused dependencies.**
`katex` and `marked-katex-extension` appear unused (no math rendering in
templates); `@tailwindcss/upgrade` is a one-off tool. Verify the ngx-markdown
dynamic import path before removing.
_Direction:_ remove after a usage check.

**CC-3 — P2 — `withCredentials: true` is repeated ~98 times.**
Across six core services, even though an interceptor layer already exists.
_Direction:_ add a credentials/base-URL interceptor or a base HTTP client.

**CC-4 — P3 — Unused service surface.**
`LogService.getLogs()` / `clearLogs()` are referenced only by the spec; `info()`
logs through `console.warn` while `error()` uses `console.error`.
_Direction:_ remove the buffer/persistence or surface it deliberately.

---

## 3. Suggested sequence

Do not mix structural work with the performance PRs.

1. **Quick, low-risk cleanup:** DC-1, DC-2, CC-2, CC-4, FE-5, TC-5, TC-6.
2. **Close enforcement gaps:** TC-1 (coverage baseline), TC-2 (shared tests),
   FE-6 (lint specs).
3. **Config truth:** DC-4 (CSP generation), DC-6 (tsconfig), CC-3
   (credentials interceptor).
4. **Structural, one at a time:**
   - BE-1 (single migration path) — highest-value backend change.
   - BE-2 (make reads read-only).
   - FE-1 (split the top three components).
   - FE-2 (OnPush leaves, then zoneless).
   - FE-3 (shared shell primitives; decide team mode).
5. **Testing depth:** BE-9 (test factories), TC-3 (E2E against production build).

---

## 4. Resolution notes

These notes record what was actually shipped. They are deliberately concrete so
the checklist below cannot imply more than the code delivers.

- **BE-1 (scoped).** The unused Drizzle snapshot chain and its package scripts
  were retired in PR #465. `apps/api/src/db/client.ts` is the single runtime DDL
  authority and `db/schema.ts` remains the ORM definition; a drift test asserts
  their table and column names match. Two representations remain by design —
  the original "three sources of truth" problem is gone, but this is not a
  one-file schema.
- **DC-1.** PR #466 added `docker-compose.hub.yml` to the release `postbump`
  version sync and a CI drift test. The first automatic stamp was `v0.94.4`.
  Immutable pins and deploy-time bumping are unchanged.
- **DC-2, DC-3, DC-4.** PR #467 removed the stale task-service risk from
  `ARCHITECTURE.md`, indexed every tracked document in `docs/README.md` with a
  CI parity check, and moved the CSP literal into `@yotara/shared` with a test
  that checks every deployment copy. The CSP change is drift detection, not
  build-time generation: checked-in compose defaults must stay usable by
  self-hosters.
- **TC-1, TC-2, FE-6.** Coverage thresholds are now enforced by c8 (API) and
  karma-coverage (frontend) at roughly two points below the recorded baseline;
  the CI coverage job no longer ignores failures, while the Codecov upload stays
  advisory. `packages/shared` now has unit tests wired into `pnpm -r test`.
  Frontend specs are linted again, the five resulting errors were fixed, and a
  baseline guard caps white-box `componentInstance as any` casts at 78 so new
  ones fail lint. Removing the existing casts remains future work.

## 5. Checklist

### P0

- [x] Unify the database schema/migration path (BE-1) — scoped, see resolution notes
- [x] Update `docker-compose.hub.yml` and add it to release syncing (DC-1)

### P1

- [ ] Make `GET /tasks` and `GET /notifications` read-only (BE-2)
- [ ] Remove service→routes import and dead project helpers (BE-3)
- [x] Add a coverage gate (TC-1)
- [x] Add tests for `packages/shared` (TC-2)
- [x] Lint frontend specs and remove white-box `as any` (FE-6) — specs linted; existing casts capped, not removed
- [x] Update `docs/ARCHITECTURE.md` (DC-2)
- [x] Update/prune the docs index (DC-3)
- [x] Generate the CSP from one source (DC-4) — canonical runtime value plus drift guard
- [ ] Deduplicate avatar/email/color-guard logic (CC-1)
- [ ] Split the largest frontend components (FE-1)
- [ ] Add `OnPush` to high-instance leaf components (FE-2)
- [ ] Decide the fate of team mode and share shell primitives (FE-3)

### P2

- [ ] Derive or contract-test OpenAPI schemas against DTOs (BE-4)
- [ ] Bound/sort the project task query (BE-5)
- [ ] Reuse mappers in the search path (BE-6)
- [ ] Standardize API error/auth semantics (BE-7)
- [ ] Extract API test factories (BE-9)
- [ ] Remove unused pipe, add router teardown, fix double error reporting (FE-5)
- [ ] Run E2E against the production build; add one retry (TC-3)
- [ ] Add Docker Dependabot, SHA pins, workflow permissions (TC-4)
- [ ] Delete/move `llms-full.txt`; update e2e plan (DC-5)
- [ ] Consolidate tsconfigs and shared resolution (DC-6)
- [ ] Bring the marketing site under lint/format guardrails (DC-7)
- [ ] Remove likely-unused dependencies (CC-2)
- [ ] Add a credentials interceptor (CC-3)

### P3

- [ ] Format-check Markdown in CI (TC-5)
- [ ] Single source for Node/pnpm versions (TC-6)
- [ ] Remove `LogService` buffer/persistence or surface it (CC-4)
