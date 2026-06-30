# Architecture Guide — Yotara

> **Status:** Living document. Last updated 2026-07-07.
> **Owner:** @apauldev
> **Supersedes:** [ROADMAP.md](../ROADMAP.md) and the planning sections of [apps/frontend/TODO.md](../apps/frontend/TODO.md) and [apps/api/TODO.md](../apps/api/TODO.md). The older docs are kept as historical snapshots and are no longer maintained. Cross-references from the older docs now point here.
>
> **Planning migration (2026-06-30):** All surviving backlog items have been migrated to GitHub Issues and are tracked on the **[Yotara Roadmap](https://github.com/users/apauldev/projects/1)** Project board. The stale doc headers now direct readers there. The backlog section below is kept as an inline reference for context but the Project board is the source of truth for status.
>
> **Doc map:** State → Root Cause → Runtime Anti-patterns → File-by-file → Patterns → Planning Artifacts → Recommended Roadmap (Sprint 0–6) → **Backlog** (historical) → For New Contributors → Principles.
>
> **Admin & Notifications plan:** See [docs/admin-notifications.md](./admin-notifications.md) for the full implementation plan covering per-IP account limits, admin API, email verification + 7-day grace period, self-hosted bypass mode, and Web Push notifications. The checkpoints below reference that document's phases.

## State of the Project

Short, honest read of where the project stands right now. No numerical scorecard on purpose — without a rubric, scores are mood, and the prose below is more useful.

- **Structural:** Backend is clean (route → service → DB). Frontend has a moderately large service (`TaskService.ts`, ~426 lines). The **biggest single issue is now fixed**: per-view API filters replace the old expand-loop + `computed()` signal pattern. Each view fetches only the tasks it needs via `GET /tasks?view=…` / `?overdue=true` / `?completedSince=…` .
- **Component architecture:** Modern Angular (standalone, signals, lazy routes). Shared primitives are genuinely reusable. Good.
- **Test coverage:** Frontend has ~393 unit tests + 55 Playwright e2e tests (13 spec files covering auth, task CRUD, labels, projects, search, settings, archive, sidebar, onboarding, error states). Backend has tests for `task-service`, `auth-origins`, `cors`, `openapi`, `login-lockout`, `rate-limit`, and timestamp-migration. Routes and the full request-response cycle remain under-tested.
- **Reusability:** Shared UI is solid. Search scoring (250+ lines of JS) belongs on the server. Test specs reach into component internals with `as any` casts — see the runtime anti-patterns below.
- **Consistency:** Naming is inconsistent (`revision` vs `refreshProjects()`). Auth-gate boilerplate repeated 3×. `localStorage` magic-string keys have been **consolidated into `PreferencesStore`** (a centralized signal-based store). `console.error` has been reduced to 2 remaining call sites (`LogService` itself and `main.ts`) — anti-pattern A1 is now **largely closed**.
- **Documentation:** This document exists. ROADMAP.md, project-plan.md, and the two TODO.md files overlap and drift from each other — see the "Planning artifacts" section below.
- **Scalability:** The expand loop and in-memory computed-signal filtering have been **removed** — each view now calls its own server endpoint. Search still runs client-side (250+ lines of scoring JS) and remains unscaled. Server-side search is Sprint 3.
- **Developer experience:** CI has lint, type-check, test, e2e, `pnpm audit`, Dependabot, CodeQL, and secret leak detection (gitleaks). No coverage threshold, no prebuilt images, no bundle-size monitoring. `.reasonix/` is gitignored.
- **Security & robustness:** Auth guards, error interceptor, cookie security all solid. Rate limiting added (global IP-based + per-email password lockout). `AppError` class hierarchy (`BadRequestError`, `NotFoundError`, `UnauthorizedError`) now exists in the API — services throw typed errors instead of bare `new Error('string')`, and the Fastify `setErrorHandler` maps them to correct HTTP status codes. One remaining bare `AppError(500, …)` call in `task-service.ts:333`. Secret leak detection (gitleaks), Dependabot, and CodeQL are active in CI. No Docker image scanning or bundle size monitoring.
- **Bus factor:** 1. 624/704 commits (89%) are from a single author. `github-actions[bot]` has 54 commits; `dependabot[bot]` has 22; shivansh090 has 4 (docs only).

---

## ✅ Root Cause Fixed: The frontend no longer does the backend's filtering work

**Accomplished in Sprint 1 (PR #197, v0.59.6).** The root cause that drove this architecture document is now resolved.

### What changed

Every view previously fetched ALL active tasks and filtered with `computed()` signals. Now each view calls its own server endpoint:

| View | Before | After |
|---|---|---|
| Today's tasks | Fetched ALL, filtered in JS | `GET /tasks?view=today&tz=...` |
| Overdue tasks | Fetched ALL, filtered in JS | `GET /tasks?overdue=true&tz=...` |
| Inbox tasks | Fetched ALL, filtered in JS | `GET /tasks?view=inbox&tz=...` |
| Upcoming tasks | Fetched ALL, grouped by week in JS | `GET /tasks?view=upcoming&tz=...` |
| Today's completions | Filtered ALL completed tasks | `GET /tasks?completedSince=...&tz=...` |
| Search | 250 lines of scoring math in JS | Still client-side — Sprint 3 |

### What was removed

- `fetchActiveTasks()` expand loop (sequential pages of 100 all at once)
- `tasks` signal (full in-memory dataset)
- `activeTasks`, `pendingTasks`, `completedTasks`, `archivedTasks` computed signals
- `isTaskOverdue`, `isTaskToday`, `isTaskUpcoming`, `hasScheduledDate` client-side helpers

### What remains

- **Search is still client-side** — 250 lines of scoring JS with no server-side endpoint. Sprint 3 candidate.
- **`allActiveTasks` signal still exists** — fetches one page of 1000 tasks for the subtask map, label assignments, and the local search index. This is a bounded data set (~1k tasks), not the old expand-all pattern.
- **Upcoming task bucketing** (`This Week` / `Next Week` / `Later`) is still done client-side via `upcomingBucketForTask()`. This is lightweight grouping, not filtering.

---

## Runtime and Operational Anti-patterns

The structural section above caught the data-flow and service-shape issues. The runtime problems below are the ones that bite users under load or in incident review but don't show up in a structural audit. All file:line references are current as of 2026-07-03. ❗ Items marked ✅ have been fixed since the original audit.

### 🟡 A1. `LogService` exists; 26 `console.error` sites bypassed it (mostly fixed)

**Largely fixed.** The original audit found 26 `console.error` call sites bypassing `LogService`. The main migration has been completed — log-heavy services (`TaskService`, `ProjectService`, `LabelService`, `AuthStateService`) now use `LogService.error()` with context strings and error sanitization.

**Remaining call sites (2):**
- `apps/frontend/src/app/core/services/log.service.ts:32` — the service itself bridges to `console.error` (legitimate)
- `apps/frontend/src/main.ts:6` — the bootstrap catch handler (legitimate)

**History:** The original `console.error` sites were in `task.service.ts`, `project.service.ts`, `label.service.ts`, `auth-state.service.ts`, `search-page.component.ts`, `archive-page.component.ts`, `start-screen.component.ts`, `auth.guard.ts`, `onboarding.guard.ts`, `login-redirect.guard.ts`, `workspace-mode.guard.ts`, and `main.ts`. The error-handling refactor in PR #197 (v0.59.6) migrated the service-layer sites to use `LogService` via `handleLoadError()`. The route/guard sites were migrated separately.

**Remaining risk:** The ESLint `no-console` rule suggested in the original fix is not yet added to the ESLint config, so new `console.error` calls could still slip in during development. Add the rule to prevent regression.

### ✅ A2. Services threw `new Error('string')` → opaque 500s (fixed)

**Fixed in v0.60.0.** The `AppError` class hierarchy (`BadRequestError`, `NotFoundError`, `UnauthorizedError`) was added to `apps/api/src/lib/app-error.ts`, and services now throw typed errors:

- `BadRequestError('A task cannot be its own parent')` → 400
- `NotFoundError('Parent task not found')` → 404
- `UnauthorizedError()` → 401

Route-level `throw new Error('Authentication required')` in `tasks.ts` is now `throw new UnauthorizedError()`. The Fastify `setErrorHandler` in `server.ts` maps `AppError` instances to the correct HTTP status.

**One remaining outlier:** `task-service.ts:333` — `throw new AppError(500, 'Failed to format date')` should use a more specific error type. Otherwise this anti-pattern is closed.

### ✅ A3. `as any` on a query parameter at a trust boundary (fixed)

**Fixed.** The `as any` cast on `request.query.status` was removed. The current `tasks.ts` passes `status: request.query.status` directly to the filters object without an unsafe cast. A runtime guard that rejects unknown enum values would still be a defensive improvement, but the `as any` bypass is gone.

### ✅ A4. `localStorage` was sprinkled across components with magic-string keys (fixed)

**Fixed in v0.59.4–v0.59.5 (PR #196).** All magic-string localStorage keys have been consolidated into a single `PreferencesStore` (
`apps/frontend/src/app/core/services/preferences-store.service.ts`):

| Key | Managed by |
|---|---|
| `yotara_skipCompleteConfirm` | `PreferencesStore.skipCompleteConfirm` / `setSkipCompleteConfirm()` |
| `yotara_insightDismissed` | `PreferencesStore.insightDismissed` / `setInsightDismissed()` |
| `yotara_loginTipDismissed` | `PreferencesStore.loginTipDismissed` / `setLoginTipDismissed()` (supports session-only + permanent) |
| `onboardingCompleted` | `PreferencesStore.onboardingCompleted` / `setOnboardingCompleted()` |
| `workspaceType` | `PreferencesStore.workspaceType` / `setWorkspaceType()` |

Preferences are exposed as Angular signals for fine-grained reactivity. The fix recommended in the original audit (a `PreferencesStore` with a single source of truth for keys) is precisely what was implemented.

### A5. `setTimeout` as a UI sync mechanism (5 sites)

- `apps/frontend/src/app/features/personal/components/change-password-modal.component.ts:395` — `setTimeout(() => this.onClose(), 2000)` to "let the success message show before closing the modal"
- `apps/frontend/src/app/core/interceptors/loading.interceptor.ts:22` — `setTimeout(() => statusService.stopLoading(), 250)` to "ensure the loading bar shows briefly"
- `apps/frontend/src/app/features/personal/components/capture-bar.component.ts:483` — uninvestigated; likely a focus/animation workaround
- `apps/frontend/src/app/features/personal/pages/labels-page.component.ts:75` — uninvestigated
- `apps/frontend/src/app/core/services/status.service.ts:42` — `setTimeout(() => this.remove(id), duration)` for toast auto-dismiss; this one is legitimate

The first two are classic "make it feel responsive" hacks. They break under load (2000ms is too short on slow devices) and break under fast connections (the success message flashes for 1.8s while the user wonders if the click registered). The fourth is a real bug waiting to surface.

**Fix:** Replace the modal close with an Angular effect that watches a `success: boolean` signal and closes when the user dismisses or the success message has been visible for at least N seconds and the user has seen it. Replace the loading-bar minimum with `requestAnimationFrame` or a small minimum-duration in CSS. Audit the other two `setTimeout` sites for what they're actually papering over.

### 🟡 A6. Timezone bug: backend `date('now')` (UTC) vs frontend Luxon `startOfToday()` (local) (partially addressed)

**Partially addressed in v0.59.7 (PR #198).** The `?tz=` query param was added to per-view API calls (`view=today`, `overdue=true`, `view=inbox`, `view=upcoming`, `completedSince`) and to the `PATCH /tasks/:id` endpoint for timezone-aware bucket restoration. The backend now uses the timezone parameter in date comparisons for filtering queries.

**What's still open:** The underlying mismatch between SQLite `date('now')` (UTC) and Luxon `startOfToday()` (local time) in the few places that still use raw SQLite date functions without a `tz` override. The test suite covers the timezone helper (`todayInTimezone`, `startOfDayInUtc`) with 8 cases, but a comprehensive audit of all SQLite date('now') calls has not been done.

### A7. Test architecture: white-box reach-ins

TestBed spec files reach into component internals with `as any` casts. Representative sites:

- `task-list-page.component.spec.ts` — 14 `as any` reaches into `componentInstance`
- `archive-page.component.spec.ts` — 6
- `settings-page.component.spec.ts` — 3
- `personal-task-card.component.spec.ts` — 1
- `project-detail-page.component.spec.ts` — 1

When `6829caf refactor(task-list): decompose page into components, fix error swallowing and pagination` shipped, the test rewrites were probably the hardest part — because the tests were coupled to internals, not behavior. This is why refactors feel scary even when they're safe.

**Fix:** Standardize on three test patterns:
- Render tests assert on DOM (`expect(fixture.nativeElement.textContent).toContain(...)`)
- Service tests assert on returned values
- Interaction tests drive a `Signal` or method and assert on observable side effects (toast, navigation, network call)

Add a lint rule or review checklist: no `as any`, no `componentInstance.privateField`. Reach-in tests are a code smell to flag in review, not a pattern to use.

### A8. "Refactor" commits that include "fix error swallowing" — bug-as-refactor pattern

Recent commit `6829caf refactor(task-list): decompose page into components, fix error swallowing and pagination`. The title admits the previous version was *swallowing errors* — a production bug, not a refactor. Grep the log for "fix" inside `refactor:` commit messages and the same pattern shows up elsewhere in small ways. If you ever do a public incident review, every "refactor" that includes "fix X" is a bug that shipped.

**Fix:** A simple review rule: a refactor commit should not change behavior. If it does, split it. The split is also a paper trail — separate commits, separate PR descriptions, separate changelog entries.

### A9. Router subscription duplication between shells

`apps/frontend/src/app/features/personal/shell/personal-shell.component.ts:112` and `apps/frontend/src/app/features/shell/auth-shell.component.ts:739` both subscribe to `router.events` to update shell state. The personal one uses `takeUntilDestroyed()`. The auth-shell one needs verification but the duplication itself is the smell — your own TODO calls for extracting shared shell chrome.

**Fix:** A small `ShellChromeService` (or `RouterEvents.forNavigationEnd()` helper) that both shells consume. Removes the per-shell subscription, makes the lifecycle discipline consistent, and is the natural place to add more shell events later.

### A10. Bus factor

296/323 commits (92%) are from a single author. shivansh090 has 2 commits (docs only); github-actions bot has 25. The discipline (semver, conventional commits, clean PRs, self-review) means a co-maintainer could realistically pick this up, but there isn't one. If the maintainer disappears for two weeks, the project stalls.

**Fix:** Out of scope for code, but: write a "How to release" doc (the release script is automated, the checklist for what to verify before cutting a release is not), invite a co-maintainer with a specific small scope (CI, docs, or one feature area), and consider labeling 1-2 `good-first-issue` items in GitHub Issues for outside contributors.

---

## File-by-file assessment

### Frontend

#### apps/frontend/src/app/core/services/task.service.ts — **Needs most attention**

**What's wrong:**
- God service: HTTP calls + reactive signals + date utilities + CRUD + presentation helpers all in one file (~220 lines)
- 15 computed signals that filter in memory
- `fetchActiveTasks$()` uses an expand loop (sequential pagination of all active tasks)
- `formatTaskDate()`, `isTaskOverdue()`, `isTaskToday()`, `isTaskUpcoming()`, `hasScheduledDate()`, `upcomingBucketForTask()` are pure functions that don't need to be in a service

**What to do:**
1. Extract date helpers to `shared/utils/timestamps.ts` where `parseCalendarDate()` and `startOfToday()` already live
2. Move each filtered view to its own API call (e.g., `getTodayTasks()` calls `GET /tasks?status=today`)
3. Remove computed signals one by one after migrating each view
4. Remove the expand loop for active tasks once all views use their own endpoint
5. Remove stale alias signals (`archivedTasks`, `completedTasks`)

#### apps/frontend/src/app/core/services/search.service.ts — **Needs second-most attention**

**What's wrong:**
- 250+ lines of scoring logic (12 helper functions) that should be on the server
- Archive search paginates through 10 pages as a band-aid — the real fix is a search endpoint
- Pure functions at module level have no tests of their own

**What to do:**
1. Build `GET /tasks/search?q=...` on the backend
2. Replace the client-side scoring with a single API call
3. Delete the scoring functions

#### apps/frontend/src/app/core/services/auth-state.service.ts — **Good, minor improvements**

~200 lines, handles session + user state + CRUD. Could split `auth` (sign in/out) from `session` (state holder), but it's not pressing.

#### apps/frontend/src/app/core/services/project.service.ts — **Good pattern, repeated boilerplate**

Same auth-gate + refresh pattern as TaskService. Extracting the auth-gate into a shared helper would clean up 3 files at once.

#### apps/frontend/src/app/core/services/label.service.ts — **Same as ProjectService**

#### apps/frontend/src/app/core/interceptors/error.interceptor.ts — **Good**

Clean global error handling with user-facing notifications. Skips 401 (handled by auth guard). This is the right pattern.

#### apps/frontend/src/app/core/guards/ — **Good**

Auth guard, onboarding guard, login redirect, workspace-mode guards. Solid.

#### apps/frontend/src/app/app.routes.ts — **Good**

Lazy-loaded routes, guards in the right places, personal vs team shells. No issues.

#### apps/frontend/src/app/features/ — **Good component architecture**

Standalone components, computed signals for derived state, effects for side effects. `PersonalTaskWorkspaceComponent` is a well-designed shell pattern.

#### apps/frontend/src/app/shared/ — **Good**

Reusable components (EmptyState, ConfirmDialog, Modal, Pagination), pipes, date utilities. The `parseCalendarDate` + `startOfToday` utilities are a well-designed abstraction.

---

### Backend

#### apps/api/src/routes/tasks.ts — **Good, but thin**

Clean route handler with Fastify schema validation. Delegates to service layer. The `status: request.query.status as any` on line 90 is a minor type escape that could be `status: request.query.status as TaskStatus`.

#### apps/api/src/services/task-service.ts — **Good**

Clean service layer with Drizzle. `listTasksForOwner` accepts filters. `cleanupExpiredArchivedTasks` runs as a preHandler hook. Good separation.

#### apps/api/src/routes/projects.ts, labels.ts — **Same pattern**

Consistent with tasks. Good.

#### apps/api/src/lib/api-errors.ts — **Good**

`sendNotFound` and error helpers. Clean.

#### apps/api/src/plugins/ — **Good**

auth-bridge, auth-required, cors. Well-structured.

#### apps/api/src/docs/openapi.ts — **Good initiative**

Auto-generated OpenAPI spec. Would benefit from being kept in sync with route changes.

#### apps/api/db/ — **Good**

Drizzle schema with proper relations. Timestamp migration handling.

#### tests — **Sparse for the backend**

Frontend has 393 tests. Backend has tests for task-service, auth-origins, cors, openapi, and timestamp-migration. But routes and the full request-response cycle are not well-tested.

---

### Shared package

#### packages/shared/src/index.ts — **Good**

Domain types (`Task`, `Project`, `Label`, DTOs) are clean and well-documented. One source of truth.

#### packages/shared/src/auth.ts — **Good**

`AuthService` wraps Better Auth client. `configureAuthClient` pattern for setting the base URL is clean. One minor concern: `fetch` is used directly instead of Angular's `HttpClient`, but that's fine for the auth SDK wrapper.

---

## Patterns to standardize

### The auth-gate boilerplate (appears 3 times)

```typescript
readonly data = toSignal(
  combineLatest([
    toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
    toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
    toObservable(this.refreshState),
  ]).pipe(
    switchMap(([initialized, currentUserId]) => {
      if (!initialized || !currentUserId) {
        this.errorState.set(null);
        return of([]);
      }
      this.loadingState.set(true);
      this.errorState.set(null);
      return this.http.get(...).pipe(
        catchError(...),
        finalize(() => this.loadingState.set(false)),
      );
    }),
  ),
  { initialValue: [] },
);
```

**Fix:** Extract into a shared `createAuthGuardedFetch` helper:

```typescript
function createAuthGuardedFetch<T>(
  http: HttpClient,
  authState: AuthStateService,
  config: {
    url: string | (() => string);
    refreshTrigger: Signal<number>;
    initialValue: T;
    transform?: (data: unknown) => T;
  },
): Signal<T>
```

This eliminates ~20 lines per service.

### Naming conventions

| Current | Problem | Standard |
|---|---|---|
| `TaskService.revision` | Different from every other service | `refreshTrigger` or use a shared signal name |
| `ProjectService.refreshProjects()` | Verb-based, inconsistent | `refresh()` unless there are multiple refresh targets |
| `LabelService.refreshLabels()` | Same inconsistency | `refresh()` |
| `TaskService.completedTasks` | Alias for `recentlyCompleted` | Remove — consume `recentlyCompleted` directly |
| `TaskService.archivedTasks` | Only used in tests | Remove |
| `pageSize` signals (archive vs search) | Consistent ✓ | No change needed |

### Planning artifacts (currently 4)

**Current state:**
- `ROADMAP.md` — high-level roadmap, priority lanes, questions (763 lines)
- `docs/project-plan.md` — PM action plan, sprints, status legend (151 lines)
- `apps/frontend/TODO.md` — frontend-specific tasks, pre-launch items, noted issues (252 lines)
- `apps/api/TODO.md` — API-specific tasks, pre-launch items (155 lines)

**Problem:** Four sources of truth, all overlapping, none synced. `ROADMAP.md` duplicates task numbers (P1 #12 is "Export data" and P2a #12 is "DB strategy"; same for #13). The TODOs have "Recently Completed" sections that duplicate `CHANGELOG.md`. None of the four reference this architecture doc as the live source.

**Recommendation:**
1. This document (`docs/ARCHITECTURE.md`) is the live source of architectural decisions and priority ordering.
2. `ROADMAP.md` and `docs/project-plan.md` are kept as historical snapshots. Their priority lanes (P0/P1/P2/P3/P4) are superseded by the "Recommended roadmap" section below. Add a top-of-file "Superseded" notice to each so future readers know where to look.
3. Delete `apps/frontend/TODO.md` and `apps/api/TODO.md`. The actionable work moves to GitHub Issues; completed work moves to `CHANGELOG.md`. The "Noted from review (not addressed here)" section in `apps/frontend/TODO.md` belongs in an issue, not a doc.

---

## Recommended roadmap (8 sprints, ordered by impact)

This sprint order supersedes the P0/P1/P2/P3 priority lanes in `ROADMAP.md`. Track progress in GitHub Issues; close a sprint by closing its issue.

### Sprint 0: Doc and runtime hygiene (do first; 2-3 days)

**Why:** Closes the highest-leverage runtime anti-patterns (A1–A3, A7) and stops the docs from drifting again. Cheap, high-confidence work that compounds.

- [x] Migrate 26 `console.error` sites to `LogService`; add ESLint `no-console` rule
- [x] Replace `throw new Error('string')` in services with typed errors; add Fastify `setErrorHandler`
- [x] Fix `as any` on `request.query.status` at the trust boundary
- [x] Add `PreferencesStore` (or extend `ThemeService`'s pattern) and migrate the three `localStorage` magic-string keys
- [x] Replace the 4 problematic `setTimeout` UI hacks with signal-driven state
- [x] Fix the UTC vs local timezone bug; add `?tz=` to per-view queries
- [x] Add a `no-restricted-syntax` ESLint rule against `as any` (warn-only, applied to all `.ts` files)
- [x] Add "Superseded" notices to `ROADMAP.md`, `docs/project-plan.md`, `apps/frontend/TODO.md`, and `apps/api/TODO.md`
- [ ] Delete `apps/frontend/TODO.md` and `apps/api/TODO.md`; create initial GitHub Issues from the surviving priorities
- [ ] Write `docs/RELEASING.md` (checklist for what to verify before cutting a release, since the release script is automated but the verification is not)

### Sprint 1: Push filtering to the API (completed)

**Why:** Eliminates the expand loop, removes most computed signals, makes the app scale.

**Frontend tasks:**
- [x] `getTodayTasks()` → `GET /tasks?view=today`
- [x] `getOverdueTasks()` → `GET /tasks?overdue=true`
- [x] `getInboxTasks()` → `GET /tasks?view=inbox`
- [x] `getUpcomingTasks()` → `GET /tasks?view=upcoming`
- [x] `getTodayCompletedTasks()` → `GET /tasks?completedSince=<date>`
- [x] Remove each `computed()` signal after migrating its view

**Backend tasks:**
- [x] Add `view=today|inbox|upcoming` query param with compound predicates:
  - `view=today` → `status = 'today' OR dueDate = today`
  - `view=inbox` → `status = 'inbox' AND (dueDate IS NULL OR dueDate = '')`
  - `view=upcoming` → `status = 'upcoming' OR dueDate > today`
- [x] Add `completedSince` query param
- [x] Verify all status filters work correctly with integration tests (replace the "verify" checkboxes in the API TODO with real tests)
- [ ] Tighten input validation on the new query params (closes A3)

### Sprint 1a: Remove setTimeout UI hacks (completed)

**Why:** 4 `setTimeout` calls were used as workarounds for change-detection timing, async close delays, and scrolling. These are fragile and untestable.

**Changes:**
- [x] **Change password modal** — replaced `setTimeout(() => onClose(), 2000)` with `effect()` + `onCleanup()` for auto-closing after success
- [x] **Loading interceptor** — removed `setTimeout(250)` minimum-display hack; replaced with CSS leave animation (250ms fade-out) on `app-status` component
- [x] **Capture bar** — replaced `setTimeout(0)` cursor positioning with `requestAnimationFrame`
- [x] **Labels page** — replaced `setTimeout(50)` + `document.querySelector('.task-pane')` with `viewChild('taskPane')` + `requestAnimationFrame` for smooth scroll

### Sprint 1b: Forgot password / password reset flow (completed)

**Why:** The "Forgot password?" link on the login screen is now a working button. Users who forget their password can request a reset link (logged to console; email sending infrastructure is a future addition). The flow uses Better Auth's built-in `requestPasswordReset` + `resetPassword` endpoints via the existing auth-bridge proxy.

**Changes:**
- [x] Backend: Added `sendResetPassword` callback to `emailAndPassword` config in `apps/api/src/lib/auth.ts` — logs reset URL to console (placeholder for real email sending)
- [x] Shared: Added `forgotPassword(email)` and `resetPassword(newPassword, token)` methods to `AuthService`
- [x] Frontend: Added matching methods to `AuthStateService`
- [x] Frontend: Created `ForgotPasswordComponent` — email input → "Check your email" confirmation screen (hides email existence for privacy)
- [x] Frontend: Created `ResetPasswordComponent` — reads `?token=` from URL query param, new password + confirm form, validates match, success/invalid states
- [x] Frontend: Added `/forgot-password` and `/reset-password` routes with `loginRedirectGuard` (redirects authenticated users away)
- [x] Frontend: Wired up the "Forgot password?" button on the login page
- [x] Env: The redirect URL is hardcoded in the frontend (`packages/shared/src/auth.ts`) via `window.location.origin/reset-password` — no env var needed

**What's left:** Replace the `console.log` in `sendResetPassword` with real email sending (Resend / Mailgun / SMTP) — the `admin-notifications.md` Phase 3 plan covers this.

**Post-review hardening (2026-07-07):**
- [x] Removed dead `FORGET_PASSWORD_CALLBACK_URL` from `.env.example` — the redirect URL is hardcoded in the frontend shared auth client, an env var was never read
- [x] Removed redundant startup `DELETE FROM email_sends` in `db/client.ts` — the lazy per-email cleanup in `checkEmailRateLimit()` already handles stale rows
- [x] Added comment above dormant `emailVerification` block in `auth.ts` — callback is wired but inert until `requireEmailVerification` is flipped to `true`
- [x] Renamed `forgetPassword` → `forgotPassword` across `packages/shared/src/auth.ts`, `AuthStateService`, `ForgotPasswordComponent`, and its spec — consistent with the component name (`ForgotPasswordComponent`) and route (`/forgot-password`)

### Sprint 2: Clean up TaskService (partial)

**Why:** Makes the file maintainable and testable.

- [x] Extract date helpers to `shared/utils/timestamps.ts`
- [ ] Extract auth-gate pattern into shared helper
- [x] Remove stale aliases (`archivedTasks`, `completedTasks`) — done in Sprint 1 cleanup
- [x] Remove active-task expand loop (no longer needed after Sprint 1) — done in Sprint 1 cleanup

### Sprint 3: Server-side search

**Why:** Eliminates 250 lines of client-side scoring, scales to any number of tasks.

- [ ] `GET /tasks/search?q=...` on the backend
- [ ] Replace `searchArchive()` and `search()` with API calls
- [ ] Delete scoring functions from `search.service.ts`

### Sprint 4: Standardize naming and consolidate docs

**Why:** Low effort, high impact on contributor experience.

- [ ] Rename `revision` → consistent name across all services
- [ ] Standardize `refresh()` method name
- [ ] Write `docs/CONTRIBUTING.md` with setup guide and architecture overview
- [x] Add `.reasonix/` to `.gitignore`

### Sprint 5: Backend test coverage

**Why:** Backend routes are not well-tested.

- [ ] Add route-level tests for tasks, projects, labels
- [ ] Add integration test for the full request-response cycle
- [ ] Add tests for edge cases (empty results, pagination boundaries)

### Sprint 6: Developer experience and polish

**Why:** Makes the project easy to pick up.

- [ ] Docker Compose for local development
- [ ] One-command dev setup script
- [x] Rate limiting on API
- [ ] Consistent input validation across all routes
- [ ] Stricter TypeScript config (no `any` casts like `request.query.status as any`)

---

## Backlog

> **⚠️ Historical reference.** All items from this section have been migrated to GitHub Issues with the `harvested-from-docs` label. Tracked live on the **[Yotara Roadmap](https://github.com/users/apauldev/projects/1)** Project board. New work should be filed as GitHub Issues, not added here.

---

## For new contributors

Start here. Everything else in this doc assumes you've read this section.

### One-command setup

```bash
git clone https://github.com/apauldev/Yotara.git
cd Yotara
cp .env.example .env
pnpm install
pnpm dev
```

This boots the API (`:3000`), the frontend (`:4200`), and Drizzle Studio for the local SQLite DB.

### Where to find things

```
apps/
  api/                     Fastify + Drizzle backend
    src/routes/            HTTP handlers (thin — delegate to services)
    src/services/          Business logic, DB access
    src/plugins/           Fastify plugins (auth-bridge, auth-required, cors)
    src/db/                Drizzle schema and migrations
    src/docs/openapi.ts    Auto-generated OpenAPI spec
  frontend/                Angular 21 frontend
    src/app/core/          Cross-cutting services, guards, interceptors
    src/app/features/      Feature modules (auth, personal, team, onboarding)
    src/app/shared/        Reusable UI primitives, utils, pipes
packages/
  shared/                  Domain types, DTOs, shared client code
docs/
  ARCHITECTURE.md          ← you are here
  ROADMAP.md               OUT OF USE — planning on GitHub Project board
  project-plan.md          OUT OF USE — planning on GitHub Project board
  personal-mode-mvp.md     historical snapshot of personal-mode scope
  admin-notifications.md   proposed draft — per-IP limits, admin API, email, notifications
  RELEASING.md             (Sprint 0) — not yet written
```

### How to run tests

- Frontend: `pnpm --filter frontend test` (or `pnpm test` at the root)
- Backend: `pnpm --filter api test`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck` (currently not gated in CI — Sprint 0 fix)

### How to add a new API endpoint

1. Add a Zod schema in `apps/api/src/routes/<resource>.ts` and pass it to the route's `{ schema: { ... } }` config
2. Add the handler — keep it thin, delegate to a service
3. Add or extend the service in `apps/api/src/services/<resource>-service.ts`
4. Add a route-level test in `apps/api/test/routes/<resource>.test.ts`
5. Run `pnpm --filter api test` and verify Swagger at `/docs`

### How to add a new frontend feature

1. Decide if it's a page, a feature component, or a shared primitive — put it in the right folder
2. Use signals for state, `computed()` for derived state, `effect()` for side effects
3. If the feature calls the API, add a service method that uses `HttpClient` (not raw `fetch`)
4. Log errors via `LogService`, not `console.error` (closes A1)
5. Use the shared `Modal`, `ConfirmDialog`, `EmptyStateComponent`, and `PageHeader` primitives
6. **The golden rule:** if you find yourself filtering in a `computed()` signal, check if the server can do it first. If yes, add a query param and remove the signal (closes the root-cause issue).

---

## Principles

Structural:

- **The server should do the filtering.** Every computed signal that filters on a field the server could query (`status`, `completed`, `dueDate`) is a sign the API is missing an endpoint. Add the endpoint, remove the signal.
- **Services fetch. Components compose.** A component reading `taskService.todayTasks()` is fine. A component doing its own filtering is a sign the service is missing a view.
- **Shared patterns should be shared.** If you see the same 25 lines in 3 files, extract once.
- **One source of truth for types and plans.** The `shared` package owns domain types. This architecture document owns architectural decisions and priority ordering. If a finding doesn't live in either place, it gets lost.

Runtime:

- **Errors at the boundary they occur.** If a service can produce a validation error, return a typed error (or a result type) — never `throw new Error('string')` and hope the route catches it. A Fastify `setErrorHandler` is the right place to map domain errors to HTTP status codes. (Closes A2.)
- **Async without timers.** If you find yourself writing `setTimeout(() => doSomething(), N)` to make a UI feel responsive, you have a state-modeling problem. Use an Angular `effect()` or a `Signal` and let the change-detection cycle do the work. (Closes A5.)
- **Bugs are bugs, not refactors.** A refactor commit should not change behavior. If it does, split the commit. The split is also the paper trail. (Closes A8.)

Testing:

- **Tests at the boundary you want to keep stable.** Service tests are fast and catch regressions. Component tests verify rendering. Integration tests catch request/response cycle bugs. All three matter.
- **Don't reach into component internals in tests.** Use DOM assertions, public API, or signal inspection. White-box tests (`as any` casts on `componentInstance`) couple the test suite to the implementation and punish future refactors. (Closes A7.)
- **A "verify" item is a missing test.** If you can't write a test for the filter, you don't know if the filter works. Replace the checklist with a test and delete the checkbox.

Process:

- **This document is the live source of architectural truth.** The "Recently Completed" sections in the old TODOs are CHANGELOG work. The priority lanes in `ROADMAP.md` are historical. New work goes in GitHub Issues; the "Noted from review (not addressed here)" section in `apps/frontend/TODO.md` becomes an issue with a label, not a paragraph in a doc.
- **Refactors don't change behavior.** A reviewer should be able to skip a refactor PR without reading it and not break anything. If a refactor is fixing a bug, split the commit.
- **Planning lives on the [Yotara Roadmap](https://github.com/users/apauldev/projects/1) Project board.** New work, feature requests, and bugs go directly to GitHub Issues. The Project board is the source of truth for prioritization and status. This document owns architectural decisions and anti-patterns; the board owns what's being worked on and when.
- **The "Recommended roadmap" sprint sections above are historical.** The active sprint plan lives on the Project board. Completed sprints are kept as a record of what was done and why.
- **The "Explicit non-goals" subsection is a tripwire.** If you find yourself wanting to add a feature that's listed there, the answer is "not without an explicit re-evaluation," not "let me just add it." Re-evaluation means a discussion, a written decision, and an update to this section removing the non-goal.
