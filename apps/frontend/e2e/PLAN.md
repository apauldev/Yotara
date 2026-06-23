# E2E Test Plan

## Status

### Setup (done)
- `playwright.config.ts` — baseURL `localhost:4200`, three projects (`login` + `e2e` + `onboarding`), `fullyParallel: false`, single worker
- `e2e/global-setup.ts` — browser-driven sign-up → onboarding (Personal workspace) → saves auth storageState
- `e2e/fixtures/auth.ts` — re-exports base `test`, `expect`, and `dismissTip` helper
- `e2e/.gitignore` — ignores `.auth/`, `playwright-report/`, `test-results/`
- CI job in `.github/workflows/ci.yml` — starts API + frontend, runs tests, uploads report on failure

### Tests

All **55 tests pass** consistently (5 login + 47 authenticated + 3 onboarding):

#### Login page (`e2e/specs/login/auth.spec.ts`) — 5/5 pass
- loads and shows the login form ✓
- toggles between login and sign-up mode ✓
- shows validation errors on empty submit ✓
- shows error for invalid email format ✓
- shows error for wrong credentials ✓

#### Authenticated (`e2e/specs/authenticated/`) — 47 tests across 12 files
**Auth spec** (`auth.spec.ts`, serial mode, 3 tests):
- redirects to tasks when already logged in ✓
- can access protected routes ✓
- shows logout confirmation modal ✓

**Tasks spec** (`tasks.spec.ts`, serial mode, 5 tests):
- creates a task from the capture bar ✓
- marks a task complete ✓
- switches between Inbox, Today, and Upcoming views ✓
- uses inline priority command (`!high`) in capture bar ✓
- uses project selector in capture bar ✓

**Projects spec** (`projects.spec.ts`, serial mode, 4 tests):
- shows the projects page ✓
- creates a project and navigates to detail page ✓
- edits a project from the projects list ✓
- navigates to project detail page from list ✓

**Task Modal spec** (`task-modal.spec.ts`, serial mode, 6 tests):
- opens the task modal from the capture bar ✓
- creates a task with title and description via the modal ✓
- creates a task with a project assignment ✓
- edits a task via the modal ✓
- validates required fields in the modal ✓
- adds and completes subtasks ✓

**Labels spec** (`labels.spec.ts`, serial mode, 4 tests):
- shows labels page ✓
- creates a label ✓
- edits a label ✓
- deletes a label ✓

**Search spec** (`search.spec.ts`, serial mode, 5 tests):
- search page renders the search form ✓
- finds a task by title ✓
- shows empty result state for gibberish query ✓
- search result tabs (All/Tasks/Projects/Labels) are visible ✓
- clicking tabs filters search results ✓

**Settings spec** (`settings.spec.ts`, serial mode, 5 tests):
- settings page renders with sections ✓
- applies a theme selection ✓
- toggles a preference setting ✓
- opens and closes change password modal ✓
- shows logout confirmation modal without logging out (non-destructive) ✓

**Archive spec** (`archive.spec.ts`, serial mode, 4 tests):
- shows completed tasks in archive ✓
- deletes a task forever from archive ✓
- restores a task from archive back to inbox ✓
- marks a task as permanent archive ✓

**Error states spec** (`error-states.spec.ts`, serial mode, 2 tests):
- shows 404 page for unknown routes ✓
- shows 404 for wildcard route in personal mode ✓

**Sidebar spec** (`sidebar.spec.ts`, serial mode, 5 tests):
- sidebar navigation works for all links ✓
- profile menu opens and shows actions ✓
- sidebar search navigates to search page ✓
- preferences menu opens and shows settings link ✓
- simple mode toggle is visible in topbar ✓

**Logout** (`zzz-logout.spec.ts`, serial mode, 1 test, runs last alphabetically):
- performs full logout from settings (destroying session) ✓

#### Onboarding (`e2e/specs/authenticated/onboarding.spec.ts`) — 3 tests
Separate Playwright project with empty `storageState` so it creates a fresh user.
- redirects to tasks if onboarding already completed ✓
- shows workspace selection options after sign-up ✓
- selects personal workspace and continues to tasks ✓

### Root causes found & fixed

1. **Cascading auth failure (fixed)**: The original `auth.spec.ts` ran login and authenticated tests in one file. The login tests used `chromium.launch()` which corrupted Playwright's internal browser context management, causing every subsequent spec to fail at the fixture level.
   - **Fix**: Split into separate projects (`login`/`e2e`) in `playwright.config.ts`, each with its own `storageState`. Each authenticated spec uses `test.describe.configure({ mode: 'serial' })` to keep tests within a single context. No more cascading.

2. **API rate limiting (fixed)**: The quick-capture API failure was caused by `@fastify/rate-limit` defaulting to **100 requests per minute**.
   - **Fix**: Changed `RATE_LIMIT_MAX` from `?? 100` to `?? 1000` in `apps/api/src/server.ts:28`. Override via `RATE_LIMIT_MAX=10000` for CI.
   - Cookie identity misdiagnosis: The 429s blocked `/auth/get-session`, making the auth guard redirect to `/login` — this looked like a corrupted cookie but was actually rate limiting.

3. **Task completion flakiness (fixed)**: The confirm dialog's "Mark complete" button took >2s to render after clicking the task checkmark.
   - **Fix**: Changed to `confirmBtn.waitFor({ state: 'visible', timeout: 5_000 })` which blocks until the button appears.

4. **Template error bleed-through (fixed)**: Inbox/Today/Upcoming views used `taskService.error()` as a global display condition. If one view's API call failed, all views showed an error instead of their task list.
   - **Fix**: Moved the `error` check inside the empty-state branch in `task-list-page.component.html` for all three views.

### Root causes found during test expansion

5. **Logout destroys server session for all subsequent tests (fixed)**: Calling `signOut()` via the settings logout modal removes the session from the database. Even though subsequent spec files load fresh `storageState` cookies from disk, the server no longer recognizes those cookies, redirecting all subsequent tests to `/login`.
   - **Fix**: Moved the actual logout to `zzz-logout.spec.ts` which sorts last alphabetically and runs after all other authenticated tests. The `settings.spec.ts` logout test now only opens the modal and clicks "Stay and Focus" (non-destructive).

6. **Capture bar requires title before opening modal**: The "Add task with details" button submits the capture bar form, which validates that the title is non-empty before opening the modal. Any test clicking this button must first fill the capture bar input.
   - **Tests affected**: All `task-modal.spec.ts` tests.

7. **Modal close buttons match role-based selectors (fixed)**: Both the modal backdrop and the × close button get `aria-label="Close {ModalTitle}"` from the parent modal component. When using `getByRole('button', { name: 'Create Label' })`, Playwright matches not only the "Create Label" save button but also the "Close Create Label" backdrop and × button.
   - **Fix**: Use `{ exact: true }` on all button selectors inside modals.

8. **Project creation navigates to detail page**: After creating a project via the modal, `projects-page.component.ts` calls `router.navigate(['/projects', created.id])`, taking the user to the project detail page, not back to the project list.
   - **Tests affected**: `projects.spec.ts` create test — now asserts URL matches `/projects/:id` after creation.

9. **pnpm --filter can't exec binaries directly (fixed)**: The CI job used `pnpm --filter @yotara/frontend exec wait-on` which failed because `pnpm exec` runs in the workspace root, not the filtered package's `node_modules/.bin/`. The `--filter` flag only selects which package runs an npm script, not which `node_modules` to resolve binaries from.
   - **Fix**: Added an `"e2e:wait": "wait-on"` npm script to `apps/frontend/package.json`. CI now calls `pnpm --filter @yotara/frontend e2e:wait` which runs the script, and the script shells out to the binary. The `wait-on` package remains a devDependency.

10. **Playwright files fail typecheck without @types/node (fixed)**: Both `playwright.config.ts` and `e2e/global-setup.ts` use Node.js APIs (`process`, `fs`, `path`) but `@types/node` was not installed in the frontend package. The `typecheck` CI step (which runs `tsc --noEmit`) failed with `TS2307: Cannot find module 'fs'` and `TS2580: Cannot find name 'process'`.
    - **Fix**: Added `@types/node` as a devDependency in `apps/frontend/package.json`.

### Spec file organization

| File | Tests | Area |
|------|-------|------|
| `login/auth.spec.ts` | 5 | Login page (unauthenticated) |
| `auth.spec.ts` | 3 | Authenticated session behavior |
| `tasks.spec.ts` | 5 | Capture bar, completion, view switching, `!priority` command, project selector |
| `projects.spec.ts` | 4 | Project CRUD + detail navigation |
| `task-modal.spec.ts` | 6 | Full task modal CRUD + validation |
| `labels.spec.ts` | 4 | Label CRUD |
| `search.spec.ts` | 5 | Search form, find task, empty state, tab filtering |
| `settings.spec.ts` | 5 | Theme, toggles, password modal, non-destructive logout |
| `archive.spec.ts` | 4 | Archive view, delete forever, restore, permanent archive |
| `error-states.spec.ts` | 2 | 404 page variants |
| `sidebar.spec.ts` | 5 | Nav links, profile menu, sidebar search, preferences menu, simple mode toggle |
| `zzz-logout.spec.ts` | 1 | Full logout (runs last — destroys session) |
| `onboarding.spec.ts` | 3 | Onboarding flow (separate project, fresh user) |

### Remaining concerns

| Area | Status | Notes |
|------|--------|-------|
| `RATE_LIMIT_MAX` dev default | 1000 | 55 tests make ~250-500 API calls — well under limit |
| Login spec `test.use` | Redundant | `storageState` is already set at project level; no impact on correctness |
| CI integration | In progress | Pipeline runs but fails on `wait-on`/`@types/node` — fixes applied, awaiting next run |
| Test run duration | ~2 min | Full suite runs in ~2 minutes locally; CI may be slower |

### Next steps

1. **Re-run CI pipeline**: Latest commit fixes `wait-on` invocation (via npm script) and `@types/node` typecheck errors. Push and verify green.
2. **Monitor flakiness**: The 5s confirm-dialog timeout is generous but may need adjustment on slower CI runners.
3. **Clean up redundant config**: The login spec's `test.use({ storageState: { cookies: [], origins: [] } })` is duplicative of the project-level config.
4. **Add more edge cases**: Data export in settings, pagination (10/25/page nav), search sort (Date/A-Z), #tag label resolution in capture bar.
