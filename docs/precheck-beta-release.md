# Precheck: beta release

This document is the checklist to work through **before** building and pushing the Docker images that will run on the beta EC2 instance. It is derived from `docs/anti-patterns-audit.md` (findings were verified against the current source on 2026-08-12), plus deployment-specific items for a small single-node EC2 deployment.

The bar for the beta is lower than for a public launch, but the items below are cheap to fix now and expensive to discover on a running instance. Items are grouped by **must fix before upload**, **strongly recommended before upload**, and **decide now** (product/ops policy choices that should not be made implicitly).

## 0. Current baseline (what already holds)

- CI installs with `pnpm install --frozen-lockfile`.
- Production startup rejects missing, malformed, undersized, placeholder, and obvious structured `BETTER_AUTH_SECRET` values.
- Protected routes use auth middleware and owner-scoped queries.
- Search uses parameterized SQL and escapes wildcard characters.
- API and nginx set security headers on every response.
- Containers: read-only rootfs, `tmpfs /tmp`, all capabilities dropped, `no-new-privileges`, non-root user.
- Smoke test (`pnpm smoke:docker`) covers `/`, `/api/health`, `/docs`, `/docs/openapi.json`, and unauthenticated `/api/tasks` → 401.

These stay as the baseline; the list below only adds what is missing.

## 1. Must fix before uploading images

### 1.1 Production email fallback (implemented)

`apps/api/src/lib/email.ts` fails closed outside development/test when `RESEND_API_KEY` is
missing, and the email tests cover the production guard. Console fallback is not available
for production deployments; configure Resend and a verified `EMAIL_FROM` before upload.

### 1.2 HTML email templates (implemented)

`apps/api/src/lib/email.ts` HTML-escapes display names and attribute-escapes URLs; the email
tests cover special characters. No further code change is required before upload.

### 1.3 Proxy trust assumes exactly one reverse proxy

- `apps/api/src/server.ts:56` sets `trustProxy: 1`; rate limiting keys off `request.ip` (`server.ts:69`).
- The API binds `0.0.0.0` (`Dockerfile`), and nginx sets `X-Forwarded-For` from the real client IP (`docker/nginx.conf:30`).

**For the beta EC2 instance:** only the bundled nginx container must be exposed; port 3000 must not be reachable from outside. If anything else terminates TLS/proxies in front (Caddy, Traefik, an ALB), the hop count changes and `request.ip` may become client-spoofable or the proxy IP.

**Fix before upload**

- On EC2, publish only port 8080; keep the API container port private.
- Document the exact topology in the deployment notes (one nginx hop, or N hops).
- If the topology is not exactly "one trusted proxy", replace the blanket `trustProxy: 1` with a trusted-proxy IP range before upload.
- Add a test with spoofed `X-Forwarded-For` headers to lock in the behavior.

## 2. Strongly recommended before upload

### 2.1 Task updates can self-parent

- Creation rejects `parentId === taskId` (`apps/api/src/services/task-service.ts`); updates do not (`482-493`).

**Fix:** reject `nextParentId === taskId` in the service layer (so every caller gets the invariant) and add a 400 regression test. Cheap to fix now, confusing to debug later.

### 2.2 CI is not a reliable gate for the release

- `.github/workflows/ci.yml`: `continue-on-error: true` on the audit step (46-48) and the whole coverage job (68-70); `fail_ci_if_error: false` on Codecov (86-90).

**Fix before relying on CI to bless the release:** make the audit blocking, remove `continue-on-error` from coverage, and make Codecov fail the job if it is a required check. If coverage is advisory, move it to a separate non-gating workflow instead of silently passing.

### 2.3 Docker smoke CI cleanup (implemented)

The Docker smoke job now tears down its Compose stack with `if: always()` after collecting
failure logs. The host-path smoke script was also exercised locally against built images.

### 2.4 E2E diagnostics are thin

- Playwright uses `retries: 0`, `trace: 'on-first-retry'`; CI uploads only the HTML report; background API/frontend processes are not cleaned up in an `always()` step.

**Fix:** `retries: process.env['CI'] ? 1 : 0`, `trace: 'retain-on-failure'`, upload `test-results/`, preserve process logs as artifacts, and terminate both background processes in an `always()` step.

## 3. Decide now (product/ops policy — do not leave implicit)

### 3.1 Email verification policy (implemented)

Verification is required in production and can be enabled in dev/test with
`REQUIRE_EMAIL_VERIFICATION=true`; default dev/test mode remains frictionless. The runtime
`/config` flag and API tests pin this behavior. Beta deployment still requires the operator
to verify the intended production environment variables.

### 3.2 Image tags for the beta deploy

- The Hub compose file deploys `latest` tags.

**Decision needed:** for the beta, pull a specific version tag (e.g. `0.72.3`) or the commit SHA, not `latest`, so the running instance is reproducible and rollback is unambiguous. Record which tag is deployed on the EC2 box.

### 3.3 Backups before first deploy

The SQLite DB lives in the `yotara_api_data` volume. **Decide before users exist** how the volume is backed up on a single EC2 instance (e.g. nightly `docker compose exec` sqlite backup or EBS snapshot), and confirm a restore actually works.

## 4. Deferred (fix after beta, not blocking)

These are real findings from the audit but are not needed for a small beta with a handful of users:

- Schema evolution via startup `ALTER TABLE`s instead of Drizzle migrations (`apps/api/src/db/client.ts`) — affects future upgrades; fine for a fresh DB.
- Cleanup writes on every task request — acceptable at beta scale.
- Leading-wildcard search — acceptable until data grows; benchmark before switching to FTS5.
- Missing `CHECK` constraints on domain fields — add with migrations later.
- Unbounded `JSON.parse` of stored recurrence — legacy-data risk; add read-boundary validation with the migration work.
- Fixed `sleep 5` before the Docker smoke script — small CI latency, not correctness.
- `lint:fix` masking failures with `|| true` — developer ergonomics.
- Broad `^` dependency ranges — keep `frozen-lockfile`; tighten only for high-risk/native deps.
- Base images pinned to tags, not digests — move to digests with automation after beta.
- Loading-state timer imbalance risk — concurrency test, not a release blocker.

## 5. Pre-upload checklist (run on the release branch)

- [x] 1.1 production email fallback gated to dev/test
- [x] 1.2 email templates escape name and URL
- [ ] 1.3 EC2 topology: only 8080 exposed; `trustProxy` matches reality
- [ ] 2.1 self-parent update rejected + regression test
- [ ] 2.2 CI audit/coverage blocking
- [x] 2.3 Docker smoke CI teardown step
- [x] 2.4 Playwright logs/artifacts/cleanup configured; run CI verification before upload
- [x] 3.1 verification policy decided and documented
- [ ] 3.2 beta image tag chosen (not `latest`)
- [ ] 3.3 backup plan tested
- [x] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` green
- [x] `pnpm smoke:docker` green locally
- [ ] Version tag bumped for the beta release (release workflow) before push

## 6. Post-upload verification on the EC2 instance

- [ ] `BETTER_AUTH_SECRET` set to a fresh random value on the instance (never committed)
- [ ] Sign up → verification/confirmation email arrives (or is deliberately disabled per 3.1)
- [ ] Password reset flow works and the reset link is **not** present in `docker compose logs`
- [ ] Sign in, create a task, complete it, archive it
- [ ] `/api/health` returns ok; `/docs` reachable only from the LAN/SSH tunnel
- [ ] DB file exists inside the volume after writes; backup script runs
- [ ] Restart the stack (`docker compose down && up`) and confirm data persists
