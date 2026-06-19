# Architecture Guide — Yotara

> **Status:** Living document. Last updated 2026-06-17.
> **Owner:** @apauldev
> **Supersedes:** [ROADMAP.md](../ROADMAP.md) and the planning sections of [apps/frontend/TODO.md](../apps/frontend/TODO.md) and [apps/api/TODO.md](../apps/api/TODO.md). The older docs are kept as historical snapshots and are no longer maintained. Cross-references from the older docs now point here.
>
> **Doc map:** State → Root Cause → Runtime Anti-patterns → File-by-file → Patterns → Planning Artifacts → Recommended Roadmap (Sprint 0–6) → **Backlog** → For New Contributors → Principles.
>
> **Admin & Notifications plan:** See [docs/admin-notifications.md](./admin-notifications.md) for the full implementation plan covering per-IP account limits, admin API, email verification + 7-day grace period, self-hosted bypass mode, and Web Push notifications. The checkpoints below reference that document's phases.

## State of the Project

Short, honest read of where the project stands right now. No numerical scorecard on purpose — without a rubric, scores are mood, and the prose below is more useful.

- **Structural:** Backend is clean (route → service → DB). Frontend has a god service (`TaskService.ts`, ~220 lines, 15 computed signals, an expand loop). The biggest single issue: the frontend does the backend's filtering work. Fix in flight.
- **Component architecture:** Modern Angular (standalone, signals, lazy routes). Shared primitives are genuinely reusable. Good.
- **Test coverage:** Frontend has 393 tests, generally well-structured. Backend has tests for `task-service`, `auth-origins`, `cors`, `openapi`, and timestamp-migration. Routes and the full request-response cycle are not well-tested.
- **Reusability:** Shared UI is solid. Search scoring (250+ lines of JS) belongs on the server. Test specs reach into component internals with `as any` casts — see the runtime anti-patterns below.
- **Consistency:** Naming is inconsistent (`revision` vs `refreshProjects()`). Auth-gate boilerplate repeated 3×. `localStorage` is read in 6+ sites with magic-string keys. `console.error` is called in 26+ sites despite `LogService` existing.
- **Documentation:** This document exists. ROADMAP.md, project-plan.md, and the two TODO.md files overlap and drift from each other — see the "Planning artifacts" section below.
- **Scalability:** Expand loops + in-memory filtering break past ~1,000 tasks. Search doesn't scale. The fix is in flight (per-view API filters in Sprint 1).
- **Developer experience:** CI has lint + test but no type-check gate, no `pnpm audit`, no coverage threshold, no prebuilt images. `.reasonix/` is not gitignored.
- **Security & robustness:** Auth guards, error interceptor, cookie security all solid. Rate limiting added (global IP-based + per-email password lockout). Services throw `new Error('string')` which the routes can't map to HTTP status codes — opaque 500s instead of meaningful 4xx responses. No Docker image scanning, no secret leak detection in CI, no Dependabot configuration, no bundle size monitoring.
- **Bus factor:** 1. 296/323 commits (92%) are from a single author. shivansh090 has 2 commits (docs only); github-actions bot has 25.

---

## Root Cause: The frontend does the backend's filtering work

Every time a view needed a filtered set of tasks (today's, overdue, inbox, upcoming), the pattern was:

> Fetch ALL → add a `computed()` signal → filter in JavaScript

Instead of:

> Add a query param → `GET /tasks?status=today` → render the response

The backend already supports `status`, `completed`, and `overdue` query params (added in the archive pagination branch). The frontend just doesn't use them per-view.

| View | What the frontend does | What the backend could do |
|---|---|---|
| Today's tasks | Fetches ALL active tasks, filters by `status: 'today'` or date math | `GET /tasks?view=today` — `status = 'today' OR dueDate = today` |
| Overdue tasks | Filters ALL active tasks for `dueDate < today` | `GET /tasks?overdue=true` — **already exists**, frontend doesn't use it |
| Inbox tasks | Filters ALL active tasks for `status: 'inbox'` + no due date | `GET /tasks?view=inbox` — `status = 'inbox' AND dueDate IS NULL` |
| Upcoming tasks | Filters ALL active tasks + groups by week | `GET /tasks?view=upcoming` — `status = 'upcoming' OR dueDate > today` |
| Search | 250 lines of scoring math in JS | `GET /tasks/search?q=...` — SQL full-text search |
| Today's completions | Filters ALL completed tasks for today's date | `GET /tasks?completedSince=<date>` |

**The cost of the current approach:**

- Every page load runs the expand loop to fetch all active tasks (sequential pages of 100)
- Every view change re-filters arrays in JavaScript
- Every new view adds another `computed()` signal
- The frontend holds all active tasks in memory for the whole session
- The server has indexes, can return the exact 12 tasks for "Today" in one query, and already supports the filters

**The fix is simple in concept:** stop treating the frontend as a database. Push filtering to the API. Each computed signal that filters on `status`, `completed`, or `dueDate` is a candidate for a query parameter.

---

## Runtime and Operational Anti-patterns

The structural section above caught the data-flow and service-shape issues. The runtime problems below are the ones that bite users under load or in incident review but don't show up in a structural audit. All file:line references are current as of 2026-06-01.

### A1. `LogService` exists; 26 `console.error` sites bypass it

`LogService` (`apps/frontend/src/app/core/services/log.service.ts`) sanitizes data, persists to localStorage, and is unit-tested. It was added in #106 as the project's error-handling abstraction. It is not used at the call sites that need it most.

Sites still calling `console.error` directly (representative — full set is 26):

- `apps/frontend/src/app/core/services/task.service.ts:84, 203, 226, 248, 266`
- `apps/frontend/src/app/core/services/project.service.ts:53, 112, 133`
- `apps/frontend/src/app/core/services/label.service.ts:46`
- `apps/frontend/src/app/core/services/auth-state.service.ts:44`
- `apps/frontend/src/app/features/personal/pages/search-page/search-page.component.ts:221`
- `apps/frontend/src/app/features/personal/pages/archive-page.component.ts:229`
- `apps/frontend/src/app/features/onboarding/pages/start-screen/start-screen.component.ts:65`
- `apps/frontend/src/app/core/guards/auth.guard.ts:16`
- `apps/frontend/src/app/core/guards/onboarding.guard.ts:29`
- `apps/frontend/src/app/core/guards/login-redirect.guard.ts:18`
- `apps/frontend/src/app/core/guards/workspace-mode.guard.ts:33, 57`
- `apps/frontend/src/main.ts:5`

**Fix:** Single PR that swaps each `console.error('context', err)` to `logService.error('context', err)`, then add an ESLint `no-console` rule for the `error` family. Half-state (abstraction exists, never adopted) is worse than no abstraction.

### A2. Services throw `new Error('string')` → opaque 500s

The API TODO calls this P0 and the bug is unchanged in code:

- `apps/api/src/services/task-service.ts:269` — `throw new Error('Failed to format date')`
- `apps/api/src/services/task-service.ts:280` — `throw new Error('A task cannot be its own parent')`
- `apps/api/src/services/task-service.ts:284` — `throw new Error('Parent task not found')`
- `apps/api/src/services/task-service.ts:287, 386` — `throw new Error('Subtasks cannot have subtasks — only one level of nesting is supported')`
- `apps/api/src/routes/labels.ts:37, 63, 93, 127` — `throw new Error('User ID not found in request')`
- `apps/api/src/routes/tasks.ts:79` — `throw new Error('Authentication required')`

Route handlers check for `null` returns, not thrown errors. A `throw new Error('Parent task not found')` becomes a generic 500 with no message to the client. The client can only show a toast like "Failed to update task" — the user has no idea why.

**Fix:** Define a small error class hierarchy (`TaskValidationError`, `TaskNotFoundError`, `UnauthorizedError`) and add a Fastify `setErrorHandler` that maps each to the right HTTP status. Validation errors become 400, not-found becomes 404, etc.

### A3. `as any` on a query parameter at a trust boundary

`apps/api/src/routes/tasks.ts:90`:

```ts
status: request.query.status as any,
```

The `as any` defeats type safety on the very filter API the pre-launch work is exposing. A `?status=garbage` is forwarded to the DB layer unchecked. The architecture doc's own "Patterns to standardize" section calls this out — the fix is `status: request.query.status as TaskStatus` plus a runtime guard that rejects unknown values.

### A4. `localStorage` is sprinkled across components with magic-string keys

`ThemeService` (`apps/frontend/src/app/core/services/theme.service.ts`) wraps localStorage properly. The other three settings use raw access, with the keys duplicated across files:

| Key | Read sites | Write sites |
|---|---|---|
| `yotara_skipCompleteConfirm` | `settings-page.component.ts:710`, `personal-task-card.component.ts:656`, spec files | `settings-page.component.ts:937`, `personal-task-card.component.ts:687` |
| `yotara_insightDismissed` | `task-list-page.component.ts:206`, `settings-page.component.ts:715` | `task-list-page.component.ts:282`, `settings-page.component.ts:943` |
| `workspaceType`, `onboardingCompleted` | — | `start-screen.component.ts:61, 62` |

Three different files know the same key, with no type safety on the values. None of this is SSR-safe (you've flagged SSR as a future concern in the TODO).

**Fix:** Add a `PreferencesStore` (or extend `ThemeService`'s pattern into a generic `LocalStore<T>`) and migrate the three keys. Bonus: a single source of truth for preference keys is the right place to add the type contract when SSR or a PWA shell comes online.

### A5. `setTimeout` as a UI sync mechanism (5 sites)

- `apps/frontend/src/app/features/personal/components/change-password-modal.component.ts:395` — `setTimeout(() => this.onClose(), 2000)` to "let the success message show before closing the modal"
- `apps/frontend/src/app/core/interceptors/loading.interceptor.ts:22` — `setTimeout(() => statusService.stopLoading(), 250)` to "ensure the loading bar shows briefly"
- `apps/frontend/src/app/features/personal/components/capture-bar.component.ts:483` — uninvestigated; likely a focus/animation workaround
- `apps/frontend/src/app/features/personal/pages/labels-page.component.ts:75` — uninvestigated
- `apps/frontend/src/app/core/services/status.service.ts:42` — `setTimeout(() => this.remove(id), duration)` for toast auto-dismiss; this one is legitimate

The first two are classic "make it feel responsive" hacks. They break under load (2000ms is too short on slow devices) and break under fast connections (the success message flashes for 1.8s while the user wonders if the click registered). The fourth is a real bug waiting to surface.

**Fix:** Replace the modal close with an Angular effect that watches a `success: boolean` signal and closes when the user dismisses or the success message has been visible for at least N seconds and the user has seen it. Replace the loading-bar minimum with `requestAnimationFrame` or a small minimum-duration in CSS. Audit the other two `setTimeout` sites for what they're actually papering over.

### A6. Timezone bug: backend `date('now')` (UTC) vs frontend Luxon `startOfToday()` (local)

`apps/frontend/TODO.md:38` documents it: *"Backend uses SQLite `date('now')` (UTC), frontend uses Luxon `startOfToday()` (local time). A task due today in the user's timezone can be overdue or not depending on UTC offset."* This is a current production bug filed under "Noted from review (not addressed here)" where it can hide.

**Fix:** Pick UTC midnight as the storage convention (date-only, no time), add a `?tz=` query param for per-view queries, and align the Luxon callsite to construct UTC-midnight dates from the user's local input. Test with a non-UTC deployment and a due-date at 23:30 local.

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

### Sprint 1b: Forgot password / password reset flow

**Why:** The "Forgot password?" link on the login screen is a dead button. Users who forget their password are locked out. The DB schema already has a `verifications` table (required by Better Auth for reset tokens), and the auth-bridge proxies `/auth/*` to Better Auth — so the backend plumbing is half-ready.

**Backend tasks:**
- [ ] Configure Better Auth `forgetPassword` in `apps/api/src/lib/auth.ts` — add `forgetPassword` block with `sendResetPassword` callback
- [ ] Add email sending infrastructure (Resend or SMTP via nodemailer)
- [ ] Add `RESEND_API_KEY` (or SMTP env vars) to `apps/api/.env.example` and wrangler config
- [ ] Add `FORGET_PASSWORD_CALLBACK_URL` env var — the frontend URL where reset links point

**Shared package tasks:**
- [ ] Add `forgetPassword(email)` and `resetPassword(token, newPassword)` methods to `AuthService` in `packages/shared/src/auth.ts`

**Frontend tasks:**
- [ ] Add `forgetPassword()` and `resetPassword()` methods to `AuthStateService`
- [ ] Wire up the "Forgot password?" button on the login page — open a modal or navigate to a `/forgot-password` route with an email input form
- [ ] Create a "Check your email" confirmation screen after submitting the forgot-password form
- [ ] Create a `/reset-password` route with a token-based form (new password + confirm) — reads token from query param
- [ ] Add success/error handling for both flows (toast on success, inline error on failure)
- [ ] Add route guards to redirect authenticated users away from reset-password pages

### Sprint 2: Clean up TaskService (in progress)

**Why:** Makes the file maintainable and testable.

- [ ] Extract date helpers to `shared/utils/timestamps.ts`
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
- [ ] Add `.reasonix/` to `.gitignore`

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

Items that didn't make it into Sprint 0–6 but are tracked here as the durable ingestion point for future work. As Sprint 0–6 completes, items graduate from this backlog into the sprint plan. New work discovered during hardening goes **here**, not to `ROADMAP.md` or the deleted TODO files.

Each item references its source doc with a tag:
- `[ROADMAP]` — from `ROADMAP.md` (historical)
- `[plan]` — from `docs/project-plan.md` (historical)
- `[fe]` — from `apps/frontend/TODO.md` (historical)
- `[api]` — from `apps/api/TODO.md` (historical)
- `[arch]` — newly identified in this architecture document

Items in the "Explicit non-goals" subsection are deliberately not on the roadmap and should not be re-introduced without an explicit re-evaluation.

### Product features (personal mode completion)

- [ ] NLP task entry — `chrono-node` for dates, `#` for projects, `@` for labels, `!` for priorities, real-time parsing feedback in the title bar. [ROADMAP P1 #13 / P4 #38] [fe §NLP]
- [ ] Browser notifications for due reminders — permission flow + page-load or interval scheduler. [ROADMAP P1 #11]
- [ ] Recurring subtasks — subtasks with their own recurrence rule (field currently disabled). [ROADMAP P4 #41]
- [ ] "Repeat on due date" vs "repeat on completion" toggle — currently always materializes on completion. [ROADMAP P4 #40]
- [ ] Skip / snooze single recurrence occurrence. [ROADMAP P4 #42]
- [ ] Activity log for past completions of recurring tasks. [ROADMAP P4 #46]
- [ ] Drag-and-drop reorder for subtasks inline. [ROADMAP P4 #39]
- [ ] Recurring template separated from normal task lists. [ROADMAP P4 #45]
- [ ] Quick-add recurring from title via smart action chip or inline command. [ROADMAP §Recurring]
- [ ] Task duplication — copy an existing task (title, description, labels, project, priority) as a new task. The #1 unplanned feature for people who do similar tasks regularly; recurring tasks only help when you know in advance. [arch]
- [ ] Data import — accept the same JSON/CSV format the export already generates. Migration blocker for users switching from Todoist/TickTick/Things. [arch]
- [ ] Drag-to-reorder tasks in list views — the `order` column exists in the schema but is never written to besides default 0. Users need visual priority ordering ("do this first, then this, then this") beyond sort-by-date/priority. [arch]
- [ ] Bulk actions — multi-select mode on task cards with action bar (Move to Today/Upcoming, Add label, Archive). Critical for inbox triage sessions where user captures 15 items and needs to process them in one pass. [arch]
- [ ] "Add to Today" from capture bar — third button or `^today` inline command to skip the inbox→modal→status change cycle. Cuts a 3-click triage flow to 1 click. [arch]
- [ ] Calendar view — monthly/weekly grid showing tasks by due date. Needs a `GET /tasks?from=...&to=...` endpoint. Recurring task materialization currently happens on-completion, not on-schedule, so recurring tasks won't render correctly in future months without first addressing the "repeat on due date" option above. Keep the view simple — read-only grid, click to open task, no drag-to-reschedule in v1. [arch]

### UX and design polish

- [ ] Make Inbox quick capture the hero interaction — primary CTA in personal shell. [ROADMAP §4] [fe §design polish]
- [ ] Progressive disclosure in task modal — keep simple tasks lightweight. [ROADMAP §4]
- [ ] Smarter capture defaults — suggest project, labels, priority from current context. [ROADMAP §4]
- [ ] "What next?" guidance after capture — triage in one pass. [ROADMAP §4]
- [ ] Reduce visual weight of secondary shell controls so capture and navigation stay dominant. [ROADMAP §4]
- [ ] Make personal/team mode switch communicate intent more clearly. [ROADMAP §4]
- [ ] Improve search-result confidence with better surfaced match context. [ROADMAP §4]
- [ ] Keyboard-first shortcuts — `N` to focus capture bar, `?` for shortcut reference, `J`/`K` to navigate task list, `Enter` to open selected, `1-4` to switch views. Power users expect this; bounce risk without it. [ROADMAP §4] [arch]
- [ ] Mobile density, touch targets, form sizing as first-class design constraints. [ROADMAP §4]
- [ ] Clarify the mental model for done vs archived vs simple mode vs bucket. [ROADMAP §4]
- [ ] Undo toast — 5-second toast with undo button on archive/delete/complete actions. Data model already supports soft-delete; this is purely a UI wrapper. Every modern task app has this. [arch]
- [ ] `AsyncState` component — shared loading/error/empty/content helper. [fe §Shared UI]
- [ ] Standardize button variants — primary/secondary/danger/ghost. [fe §Shared UI]
- [ ] Card primitives — shared card shell for modal/list/promo. [fe §Shared UI]
- [ ] Extend "Don't show again" persistence pattern to other confirmations. [arch]

### Service and component refactors (Angular modernization)

- [ ] Modernize to signal-based APIs — `input()` / `output()` over decorators, `OnPush` everywhere, drop redundant `standalone: true`. Prioritize leaf UI components (`page-header`, `task-list`, `modal`, `confirm-dialog`, `logout-confirm-modal`, `personal-task-card`). [fe §Modernize]
- [ ] Split `TaskService` into `task-api.client.ts`, `task-selectors.ts`, `task-date.utils.ts`. [fe §Refactor]
- [ ] Split `ProjectService` and `AuthStateService` similarly. [fe §Refactor]
- [ ] Extract shared shell chrome between `auth-shell` and `personal-shell` — reuse mobile menu, profile menu, logout flows. [fe §Refactor] [arch §A9]
- [ ] Migrate `personal-project-modal` to the shared modal primitive. [fe §Refactor]
- [ ] Split remaining large inline templates/styles — `personal-project-modal`, `personal-task-card`, `personal-task-workspace`, `personal-shell`, `auth-shell`, `logout-confirm-modal` are still inline. [fe §Inline split]
- [ ] Replace `localStorage` / `window.open` in onboarding with an injected, platform-safe helper. [fe §Refactor]
- [ ] Cross-tab sync for `PreferencesStore` signals — listen for the `storage` event and re-read the affected key so a change in one tab (e.g. dismissing the insight panel) is reflected in another open tab. `PreferencesStore` is the natural place to own this since it's already the single source of truth for preference keys; consumers already bind to its signals, so they'd react automatically. Pre-existing limitation, not a regression of the signals refactor. [arch §A4]
- [ ] Centralize task date parsing and formatting in shared utilities. [fe §Refactor]
- [ ] Remove `any` escapes in auth/login error handling — use `unknown` + type guards. [fe §Refactor]
- [ ] Structured field-level validation errors from backend — surface per-field errors next to inputs. [fe §P2]
- [ ] Remove `fetchSubtasks` redundancy — main `tasks` signal already includes subtasks. [fe §P2]
- [ ] Debounce `SearchService` input — currently synchronous per keystroke. [fe §P2]
- [ ] Consolidate API auth-gate boilerplate into shared `createAuthGuardedFetch` helper (decomposed from Sprint 2). [arch §Patterns]
- [ ] Standardize naming: `revision` → `refreshTrigger`, `refreshProjects` / `refreshLabels` → `refresh`. [arch §Patterns]
- [ ] Remove stale alias signals — `TaskService.archivedTasks` and `completedTasks` are unused or aliased. [arch §Patterns]

### Service and refactor work (API)

- [ ] Database transactions for multi-step writes (task + labels + subtasks). [ROADMAP P0.5 H1] [api §Query]
- [ ] N+1 fix in `listTasksForOwner` — batch label fetching via joined query. [ROADMAP P0.5 H2] [api §Query]
- [ ] Centralize backend auth user extraction — `requireUserId` shared utility (largely done in v0.54.0; verify reuse). [api §Route]
- [ ] Consolidate `loadProjectById` / `getProjectById` — single source of truth. [api §Code quality]
- [ ] Add duplicate name check in `createLabelForOwner`. [api §Code quality]
- [ ] Move `listTasksForProject` sort from JS to SQL. [api §Code quality]
- [ ] Extract shared test helpers — `createAuthedApp` and `signUpAndGetCookie` duplicated. [api §Code quality]
- [ ] Add request body size limits — `export=true` returns up to 10,000 tasks. [api §Code quality]
- [ ] Document `simpleMode` semantics — no current explanation. [api §Code quality]
- [ ] Add structured logging context (request id, user id, route, status). [api §Error handling]
- [ ] Add tests for the auth bridge and CORS behavior at the plugin boundary, not only end-to-end route tests. [api §Testing]
- [ ] Add regression tests for manual auth proxy path and cookie forwarding (done in v0.54.0). [api §Testing]
- [ ] Add contract tests for `GET /me` and OpenAPI examples (done in v0.54.0). [api §Testing]
- [ ] Simplify the auth-bridge plugin — hide the manual Request/Response translation behind a tested adapter. [api §Auth]
- [ ] Review CORS handling for duplication between `applyCorsHeaders` and `@fastify/cors`. [api §Auth]
- [ ] Add per-view integration tests for the new `GET /tasks?status=…` filters (replaces the "verify" checkboxes). [arch §A2] [api §Pre-launch]

### Distribution and deployment

- [ ] Pre-built Docker images on GHCR / Docker Hub on release (Sprint 6). [ROADMAP P3 #25] [plan P3 #22]
- [ ] Docker Compose with pre-built images. [ROADMAP P3 #29] [plan P3 #23]
- [ ] Render.com template (`render.yaml`) — one-click deploy. [ROADMAP P3 #30] [plan P3 #24]
- [ ] Railway.app template (`railway.toml`). [ROADMAP P3 #31] [plan P3 #25]
- [ ] Coolify deployment documentation (optional). [ROADMAP §8.3]
- [ ] Live demo instance and README link. [ROADMAP P3 #32] [plan P3 #26]
- [ ] Selective Docker smoke — only on PRs touching Dockerfiles / compose / source. [ROADMAP §Delivery]
- [x] Release gating — release workflow waits for CI workflow to complete before publishing (via `workflow_run` trigger). [ROADMAP §Delivery]
- [ ] Trim GitHub Release body to latest release notes, not full `CHANGELOG.md`. [ROADMAP §Delivery]
- [ ] `docs/RELEASING.md` — release verification checklist. (Sprint 0.) [arch]
- [x] Add `.reasonix/` to `.gitignore`. (Sprint 4.) [arch]
- [x] API Docker image multi-stage build — python3/build-base stripped from production stage. Build context shrunk from 10.5 GB to 5 MB (`.angular` cache was being sent). API image reduced from 2.73 GB to ~600 MB. Frontend image stays at 78 MB (already lean via nginx multi-stage). [arch §Docker]
- [ ] Use `pnpm deploy --prod` in build stage — copy production `node_modules` directly to prod stage, skipping prod re-install. Estimated ~50-100 MB savings + faster builds. [arch §Docker]
- [ ] Try distroless base (`gcr.io/distroless/nodejs22-debian12`) — ~80 MB vs ~100 MB alpine. Verify `better-sqlite3` compatibility (needs glibc; distroless has it). [arch §Docker]
- [ ] Pin better-sqlite3 binary path dynamically at build time — avoid hardcoded version in COPY path. [arch §Docker]
- [ ] Consider `npm pack` for production deps — pack as tarball, extract in prod stage (avoids pnpm store overhead). [arch §Docker]
- [ ] Docker Compose for local development (Sprint 6). [arch]
- [ ] One-command dev setup script (Sprint 6). [arch]

### CI and security hardening

- [x] Type-check gate in CI — `pnpm typecheck` currently not gated. (Sprint 0.) [arch]
- [x] `pnpm audit` in CI for early CVE detection. (Warn-only, non-blocking.) [ROADMAP §Delivery]
- [ ] Coverage reporting with minimum threshold gates. (Solo-dev: optional — 430 unit tests already catch most regressions; add when accepting community PRs.) [ROADMAP P3 #26] [api §CI]
- [x] Dependabot for automated dependency updates. (Weekly, grouped, non-blocking.) [ROADMAP P3 #27] [api §CI]
- [x] CodeQL security scanning workflow — GitHub-native, free for public & private repos, catches injection, XSS, path traversal. Best single security investment. (Non-blocking, weekly schedule.) [ROADMAP P3 #28] [api §CI] [arch]
- [ ] Docker image scanning (Trivy) in CI — ship CVEs are invisible without it. Runs as a one-step Action. [arch]
- [x] Secret leak detection (gitleaks) in CI — catches committed API keys before they reach GitHub. (Non-blocking via `continue-on-error`.) [arch]
- [ ] Bundle size regression monitoring — add `ng build --stats-json` to CI with a size budget or comment-on-PR action (e.g. `paille/angular-build-size-action`). (Solo-dev: optional — review bundle manually before major releases.) [arch]
- [ ] E2E testing (Playwright or Cypress) for critical flows — auth, task CRUD, archive lifecycle. (Solo-dev: optional — 393 frontend unit tests cover component behavior; add when accepting community PRs or after a regression in a multi-step flow.) [arch]
- [ ] PR preview / staging environment — deploy frontend to ephemeral URL on PR. (Solo-dev: optional — review locally or skip; add when contributors need to preview changes.) [arch]
- [ ] Database query analysis — add `drizzle-kit` studio to dev workflow and review slow queries during development. [arch]
- [ ] Snyk or alternative vulnerability scanning. [api §CI]
- [x] API rate limiting. [fe §OSS] [arch §Sprint 6]
- [ ] API security headers (HSTS, CSP, etc.). [fe §OSS] [arch §Sprint 6]
- [ ] Tighten CORS defaults for auth routes. [fe §OSS]
- [ ] Better request/response logging for auth and write endpoints. [api §Auth]

### Team mode (P2a + P2b) — graduate as a sprint when starting team work

- [ ] Database strategy for team mode — SQLite for self-hosted, Turso or Postgres for cloud SaaS. [ROADMAP P2a #12] [plan P2 #13]
- [ ] Permissions: owner vs member roles. [ROADMAP P2a #13]
- [ ] Workspace data model: workspaces, memberships, owner flag. [ROADMAP P2a #14] [plan P2 #13]
- [ ] Workspace-scoped labels and projects. [ROADMAP P2a #15]
- [ ] Workspace switcher: create/switch workspaces. [ROADMAP P2a #16] [plan P2 #14]
- [ ] Workspace settings: members list + remove member. [ROADMAP P2a #17] [plan P2 #20]
- [ ] Invite link flow: token + `/join/:token`. [ROADMAP P2a #18] [plan P2 #15]
- [ ] Task assignment: `assigneeId` and avatar in lists. [ROADMAP P2a #19] [plan P2 #16]
- [ ] "Assigned to me" smart list. [ROADMAP P2a #20] [plan P2 #17]
- [ ] Activity log for workspace changes. [ROADMAP P2a #21]
- [ ] Comments on tasks (flat, simple) — no threading for MVP. [ROADMAP P2b #22] [plan P2 #18]
- [ ] Team Board: columns per member, drag to reassign. [ROADMAP P2b #23] [plan P2 #19]
- [ ] Real-time updates via polling (10–30s). [ROADMAP P2b #24]
- [ ] WebSocket upgrade path if polling demand warrants. [ROADMAP P2b #24] [plan P2 #21]
- [ ] Cross-mode search across personal and workspace tasks. [ROADMAP P4 #37]

### Mobile and PWA (P4)

- [ ] PWA installability — app manifest, install prompt, homescreen icon. [ROADMAP P4 #34] [plan P4]
- [ ] PWA badge count support where available. [ROADMAP §6]
- [ ] *(Push notifications — covered by [docs/admin-notifications.md](./admin-notifications.md) Phase 5.)*
- [ ] Mobile regression QA pass — modal scroll, keyboard, bottom-sheet, form input across breakpoints. [fe §design polish]
- [ ] Mobile packaging evaluation — keep mobile web strong first; consider lightweight hybrid wrapper if demand proves out. [ROADMAP §8.4]

### Localization (P4)

- [ ] i18n groundwork — separate UI text layer from components. [ROADMAP P4 #35] [plan P4]
- [ ] English first, then Spanish, then Hindi, Chinese, Japanese, Korean, Russian as the next major set. [ROADMAP §4]
- [ ] Easy LTR European additions: German, French, Portuguese, Italian. [ROADMAP §4]
- [ ] Localized date/time/copy formatting in settings, not hardcoded UI text. [ROADMAP §4]
- [ ] Language preference in user settings + workspace member preferences if team mode enables it. [ROADMAP §5]
- [ ] RTL layout support deferred to a later phase. [ROADMAP §4]

### Accessibility and interaction polish

- [ ] Visible focus states on every interactive shell control. [ROADMAP §4]
- [ ] Readable contrast for muted text, chips, metadata in light and dark themes. [ROADMAP §4]
- [ ] Touch targets sized for mobile in top bar and task rows. [ROADMAP §4]
- [ ] Standardized modal, menu, and confirmation behavior across the app. [ROADMAP §4]
- [ ] Mobile drawer, search, and preferences review for the personal-mode finish pass. [fe §Shell polish]
- [ ] Keyboard support, focus states, contrast, touch targets as part of the final product finish (not just compliance). [fe §design polish]

### Notifications, Admin, and Account Limits

See [docs/admin-notifications.md](./admin-notifications.md) for the full implementation plan. Key checkpoints:

| CP | Deliverable | Phase | Effort |
|---|---|---|---|
| CP-1 | Per-IP account cap + admin API (list/verify/delete users) | Phase 1 | 2–3d |
| CP-2 | Self-hosted bypass mode (username + password only) | Phase 2 | 2–3d |
| CP-3 | Email sending via Resend/Mailgun + verification links + resend cooldown | Phase 3 | 3–4d |
| CP-4 | 7-day grace period + session invalidation on expiry | Phase 4 | 2–3d |
| CP-5 | Web Push notifications (offline delivery) + reminder cancellation | Phase 5 | 6–8d |
| CP-6 | Frontend UX: verification page, grace banner, notification bell, permission flow | Phase 6 | 3–4d |

**Supersedes:** These checkpoints replace the individual notification items listed in the historical backlog below and in ROADMAP §6.

The checkpoints below reference the [new document's](docs/admin-notifications.md) phases.

| Checkpoint | Delivery | Phase | Verification |
|---|---|---|---|
| CP-1 | Per-IP account cap + admin API (list/verify/delete users) | Phase 1 | curl > N signups from one IP → 429; admin endpoints work with secret |
| CP-2 | Self-hosted bypass mode (username + password only) | Phase 2 | Register with username only, login with username, emailVerified=true |
| CP-3 | Email sending via Resend/Mailgun + verification links + resend cooldown | Phase 3 | Verification email arrives (or logs to console), verify link works, 60s cooldown enforced |
| CP-4 | 7-day grace period + session invalidation on expiry | Phase 4 | New account logs in, expired (7d+) account gets 403 with sessions revoked |
| CP-5 | Web Push notifications (offline delivery) + reminder cancellation on completion | Phase 5 | Service worker registered, push received while tab is closed, cancels on task completion |
| CP-6 | Frontend UX: all flows polished | Phase 6 | Post-signup page, grace banner, account-expired page, bell icon, settings toggle |

**Effort estimate:** 18–23 engineering days total, split into 6 independent phases of 5–8 days each. Each phase can ship independently.

### Process and documentation

- [ ] Co-maintainer invitation with specific small scope (CI, docs, or one feature area). [arch §A10]
- [ ] Label 1–2 `good-first-issue` items for outside contributors. [arch §A10]
- [ ] Capture every refactor PR that includes "fix" in the title in a separate post-mortem doc — recurring pattern. [arch §A8]
- [ ] Capture the inline-templates/styles follow-up in `fe §Inline split` to a tracking issue before deleting that section. [arch]

### Open questions and decisions

These are decisions the older docs flagged as unresolved. Confirm or update before starting related sprint work.

- **Recurring tasks: simplified (daily/weekly/monthly) or full cron?** — current: simplified. [ROADMAP §Questions]
- **Subtasks: full nesting or one level?** — current: 1 level. [ROADMAP §Questions]
- **Kanban: in MVP or Phase 4?** — current: Phase 4. [ROADMAP §Questions]
- **Team mode: hide completely or show greyed-out tab in MVP?** — current: hide. [ROADMAP §Questions]
- **Archive: manual only, or auto-archive after completion?** — current: manual, with `permanentArchive` flag to opt out of auto-delete. [ROADMAP §Questions]
- **Search: single global search or separate personal/team scopes?** — current: single. [ROADMAP §Questions]
- **Real-time: polling (10–30s) for team MVP, upgrade to WebSockets if demand warrants** — current: polling. [ROADMAP §Questions]
- **Database: SQLite for self-hosted, Turso or Postgres for cloud SaaS** — current: not yet started. [ROADMAP §Questions]
- **Workspace-scoped labels/projects: workspace-scoped in team mode, user-scoped in personal mode** — current: not yet started. [ROADMAP §Questions]
- **Languages priority order** — see Localization section above. [ROADMAP §Questions]

### Explicit non-goals

These are deliberately out of scope and should not be re-introduced as sprint work without an explicit re-evaluation.

- Multi-level subtask nesting beyond 1 level. [ROADMAP P4 #43]
- WebSockets as the first real-time solution (start with polling). [ROADMAP P2b #24]
- RTL layout support in the initial localization pass. [ROADMAP §4]
- Full cron recurrence (simplified cycle only). [ROADMAP §Questions]
- Kanban in the personal MVP. [ROADMAP P4 #33] [ROADMAP §Questions]
- Comments with threading in the team MVP (flat only). [ROADMAP P2b #22]
- A separate native mobile app (mobile web first; hybrid wrapper only if demand warrants). [ROADMAP §8.4]

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
  ROADMAP.md               historical, superseded
  project-plan.md          historical, superseded
  personal-mode-mvp.md     historical snapshot of personal-mode scope
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
- **How to add to this doc:** When you discover a new architectural concern or a piece of work that should be tracked, add it to the **Backlog** section in the appropriate category. Do not add to `ROADMAP.md`, the (eventually deleted) TODO files, or invent a new doc. Each backlog item should have a source reference (existing doc, GitHub issue, or `[arch]` for newly identified). The backlog is intentionally a flat list — it is not a sprint plan. When the time comes to schedule, copy the item into the "Recommended roadmap" section as a new sprint and remove it from the backlog (or leave it referenced in both if it's a long-running theme).
- **The "Explicit non-goals" subsection is a tripwire.** If you find yourself wanting to add a feature that's listed there, the answer is "not without an explicit re-evaluation," not "let me just add it." Re-evaluation means a discussion, a written decision, and an update to this section removing the non-goal.
