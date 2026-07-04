# Phase 1: Backend Route Coverage — /me, /health, /

**Issue:** [#286](https://github.com/apauldev/Yotara/issues/286)
**Branch:** `test/backend-route-coverage`

## Files to create

### 1. `apps/api/src/routes/me.test.ts`

Follow `tasks.test.ts` pattern: isolated temp DB per test via `createAuthedApp()` / `signUpAndGetCookie()`.

| # | Test | Key assertions |
|---|---|---|
| 1 | `GET /me returns 401 without auth` | `statusCode === 401` |
| 2 | `GET /me returns user profile` | 200, shape `{ user: { id, email, name, workspaceMode, onboardingCompleted, archiveAutoDelete, captureBehavior, createdAt, updatedAt } }`, timestamps pass `assertIsoTimestamp()` |
| 3 | `PATCH /me sets workspaceMode` | `{ workspaceMode: "personal" }` → 200, `user.workspaceMode === "personal"` |
| 4 | `PATCH /me sets onboardingCompleted` | `{ onboardingCompleted: true }` → 200, `user.onboardingCompleted === true` |
| 5 | `PATCH /me sets archiveAutoDelete` | `{ archiveAutoDelete: false }` → 200, `user.archiveAutoDelete === false` |
| 6 | `PATCH /me toggles captureBehavior` | `{ captureBehavior: "capture" }` → `"capture"`, then `"quick"` → `"quick"` |
| 7 | `PATCH /me seeds defaults when onboarding` | PATCH with `{ workspaceMode: "personal", onboardingCompleted: true }` → GET /projects >= 8 (has Inbox), GET /labels >= 8 (has Urgent). Second PATCH does not duplicate. |
| 8 | `PATCH /me returns 401 without auth` | `statusCode === 401` |
| 9 | `CORS headers present` | `access-control-allow-origin` and `access-control-allow-credentials` on GET and PATCH |

### 2. `apps/api/src/routes/health.test.ts`

| # | Test | Key assertions |
|---|---|---|
| 1 | `GET /health returns ok` | 200, `{ status: "ok", timestamp: "..." }`, timestamp is ISO |
| 2 | `GET /health without auth` | 200 (no auth required) |

### 3. `apps/api/src/routes/root.test.ts`

| # | Test | Key assertions |
|---|---|---|
| 1 | `GET / returns API metadata` | 200, `{ name: "Yotara API", version: "0.1.0" }` |
| 2 | `GET / without auth` | 200 (no auth required) |

## Conventions

- Duplicate `createAuthedApp()`, `signUpAndGetCookie()`, `assertIsoTimestamp()` helpers inline (matches project pattern).
- Use `node:test` and `node:assert/strict`.
- Temp DB in `os.tmpdir()`, cleanup via `finally` block.
- Run: `pnpm --filter api test`

## Verification

```bash
pnpm --filter api test
# Expected: all tests pass, no regressions
```
