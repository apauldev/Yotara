# Security Audit

Generated: 2026-05-18

## CRITICAL / HIGH

### 1. No rate limiting — all endpoints vulnerable to brute-force
- **Location:** `apps/api/src/server.ts` and all route files
- **Description:** No `@fastify/rate-limit` or custom throttling. Auth endpoints (`/auth/sign-in/email`, `/auth/sign-up/email`) have zero brute-force protection. CRUD endpoints can be abused for DoS.
- **Fix:** Add `@fastify/rate-limit`, 5 req/min on auth, 100 req/min on CRUD.

### 2. BETTER_AUTH_SECRET committed to source control
- **Location:** `docker-compose.yml:10`
- **Description:** `local-dev-secret-change-me` is a plaintext secret in git history. This secret signs all sessions and cookies. `.env.example` doesn't document this variable, so production deploys may auto-generate one on every restart, invalidating all sessions.
- **Fix:** Move to `.env` file excluded from git. Document in `.env.example`.

### 3. API container runs as root
- **Location:** `apps/api/Dockerfile`
- **Description:** Single-stage build, no `USER` directive. The Fastify process runs as root. Combine with any RCE or path traversal and the attacker gets root.
- **Fix:** Add `USER node` and convert to multi-stage build.

### 4. No Content-Security-Policy headers
- **Location:** `apps/frontend/src/index.html`, `docker/nginx.conf`
- **Description:** No CSP anywhere. If XSS is introduced, zero defense-in-depth. nginx also lacks `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- **Fix:** Add CSP meta tag and nginx security headers.

### 5. Blind header forwarding enables IP spoofing
- **Location:** `apps/api/src/plugins/auth-bridge.ts:77`
- **Description:** `toHeaders(request.headers)` forwards **all** incoming headers including attacker-controlled `x-forwarded-for`, `x-forwarded-host`. Better Auth persists `ipAddress` in sessions.
- **Fix:** Whitelist only headers needed for auth; strip proxy headers.

### 6. Command injection in docker-smoke.sh
- **Location:** `scripts/docker-smoke.sh:7`
- **Description:** `awk "BEGIN { printf ... ${delay_ms} ... }"` interpolates an env var directly into a double-quoted awk script.
- **Fix:** Validate `delay_ms` as positive integer. Use `awk -v d="$delay_ms"`.

---

## MEDIUM

### 7. requireEmailVerification: false
- **Location:** `apps/api/src/lib/auth.ts:27`
- **Description:** Accounts can be created without email verification, enabling spam, impersonation, and account squatting.

### 8. Debug logs in localStorage with no PII redaction
- **Location:** `apps/frontend/src/app/core/services/log.service.ts:83-89`
- **Description:** Up to 100 log entries including error objects persisted to localStorage. Should be disabled in production.

### 9. Unguarded /preview/picker route
- **Location:** `apps/frontend/src/app/app.routes.ts:22-27`
- **Description:** No guards — unauthenticated users can load the onboarding UI.

### 10. .env.example incomplete
- **Location:** `.env.example`
- **Description:** Missing `BETTER_AUTH_SECRET`, `CORS_ORIGIN`, `TRUSTED_ORIGINS`, `APP_BASE_URL`.

### 11. Husky PATH manipulation supply chain risk
- **Location:** `.husky/_/h:16`
- **Description:** `PATH="node_modules/.bin:$PATH"` — any npm dependency can shadow system commands during git hooks.

### 12. window.open() without noopener
- **Location:** `apps/frontend/src/app/features/onboarding/pages/start-screen/start-screen.component.ts:74`
- **Description:** Missing `noopener,noreferrer`. Opened page can access `window.opener`.

---

## LOW

| # | Finding | Location |
|---|---------|----------|
| 13 | `[innerHTML]` for highlighted search text — fragile, currently safe | `task-list-page.component.html:65` |
| 14 | Label color field has no length/format validation | `apps/api/src/services/label-service.ts:88` |
| 15 | `throw new Error()` bypasses `sendUnauthorized()` contract | `apps/api/src/routes/tasks.ts:62-63`, `labels.ts:37` |
| 16 | Swagger UI at `/docs` served with no authentication | `apps/api/src/docs/openapi.ts` |
| 17 | `execSync` calls without timeout | `scripts/generate-version.mjs:27-28` |
| 18 | `skipLibCheck: true` masks potential type errors | `tsconfig.base.json:6` |
| 19 | `pnpm audit` in CI, no Dependabot/Renovate | GitHub workflows |
| 20 | `.gitignore` doesn't exclude `*.env*` (except `.env.example`), `*.pem`, `*.key` | `.gitignore` |
| 21 | `.dockerignore` doesn't exclude `.env*` files | `.dockerignore` |
| 22 | `server_name _` (catch-all) in nginx | `docker/nginx.conf:3` |
| 23 | No healthchecks in Dockerfiles | Both Dockerfiles |
| 24 | Single-stage API Dockerfile | `apps/api/Dockerfile` |
| 25 | No resource limits on docker-compose services | `docker-compose.yml` |
| 26 | Missing `restart: unless-stopped` in docker-compose | `docker-compose.yml` |
