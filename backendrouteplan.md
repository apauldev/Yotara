# Phase 1: Backend Route Coverage — /me, /health, /

**Issue:** [#286](https://github.com/apauldev/Yotara/issues/286)
**Branch:** `test/backend-route-coverage`

## Files to create

### 1. `apps/api/src/routes/me.test.ts`

Follow `auth.test.ts` pattern: shared `test-db.js` via `createAuthedApp()` / `signUpAndGetCookie()`.

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
| 9 | `PATCH /me with empty body` | 200, no fields changed |
| 10 | `PATCH /me ignores unknown fields` | 200, unknown fields silently dropped |
| 11 | `CORS headers present` | `access-control-allow-origin` and `access-control-allow-credentials` on GET and PATCH |

### 2. `apps/api/src/routes/health.test.ts`

| # | Test | Key assertions |
|---|---|---|
| 1 | `GET /health returns ok` | 200, `{ status: "ok", timestamp: "..." }`, timestamp is ISO |
| 2 | `GET /health without auth` | 200 (no auth required) |
| 3 | `POST /health returns 404` | non-GET methods rejected with 404 |

### 3. `apps/api/src/routes/root.test.ts`

| # | Test | Key assertions |
|---|---|---|
| 1 | `GET / returns API metadata` | 200, `{ name: "Yotara API", version }` where `typeof version === 'string' && version.length > 0` |
| 2 | `GET / without auth` | 200 (no auth required) |
| 3 | `POST / returns 404` | non-GET methods rejected with 404 |

## Conventions

- Duplicate `createAuthedApp()`, `signUpAndGetCookie()`, `assertIsoTimestamp()` helpers inline (matches project pattern). For health & root use `createApp()` (no auth needed).
- Use `node:test` and `node:assert/strict`.
- Temp DB in `os.tmpdir()`. `/me` uses shared session-scoped DB (`test-db.js` side-effect import, no cleanup — matches `auth.test.ts`). Health & root use per-test isolated DB, cleanup via `rmSync(dbFile, { force: true })` in `finally` block.
- Run: `pnpm --filter @yotara/api test`

## Verification

```bash
pnpm --filter @yotara/api test
# Expected: all tests pass, no regressions
```
