# Plan: Security Hardening — Obvious Gaps

Scope: the clearly-real gaps from the second audit pass. Deliberately **excludes** the
nitpicks: `SameSite: lax` is correct for an SPA login flow (switching to `strict` would
break it), the "error messages leak internals" claim is mostly false (the 500 handler
already returns a generic message and logs detail server-side), and account enumeration
is Better Auth's default behavior with an accepted "check your email" trade-off.

## 1. Security headers (High)
The API (`server.ts`) and the nginx front (`docker/nginx.conf`) set **no** security
headers. Add them, with the CSP as a **single source of truth** so it only has to be
changed in one place.

**Single source of truth — `apps/api/src/server.ts`:**
- Export `CONTENT_SECURITY_POLICY`, defaulting to the SPA policy and overridable via the
  `CONTENT_SECURITY_POLICY` env var:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; connect-src 'self' http://localhost:3000;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  (tighten `connect-src` to the real API origin; `'unsafe-inline'` for styles is the
  pragmatic Angular trade-off).
- The `onSend` hook applies `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, and `Content-Security-Policy` (from the constant) on
  every response, so headers are present even when the API is hit directly.

**nginx — `docker/nginx.conf` + `apps/frontend/Dockerfile`:**
- Template the config as `/etc/nginx/templates/default.conf.template` using a
  `$CONTENT_SECURITY_POLICY` placeholder, and set `ENV CONTENT_SECURITY_POLICY` in the
  frontend Dockerfile to the same default. nginx's built-in entrypoint runs `envsubst`
  and renders the real config at start, so the CSP value flows from the API's constant
  → the env → nginx. No second copy of the policy string.
- The other three headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) are stable and set directly in nginx (and mirrored by the API hook).
- **HSTS:** only safe when nginx terminates TLS. The compose setup serves plain HTTP, so
  do **not** add `Strict-Transport-Security` here. Note it for enablement once HTTPS is
  terminated at nginx.

**`docker-compose.yml`:**
- Pass `CONTENT_SECURITY_POLICY: ${CONTENT_SECURITY_POLICY:-<default>}` to BOTH the `api`
  and `frontend` services. The `<default>` is the same SPA policy used by the API
  constant, so it lives in one place (compose). The frontend Dockerfile declares
  `ENV CONTENT_SECURITY_POLICY=` with no value, so compose always supplies it — an empty
  override would blank the CSP, which is why the default is inlined in compose rather
  than left to the image. Overriding `CONTENT_SECURITY_POLICY=...` in one place
  propagates to both the API hook and the nginx-rendered config.

## 2. Align + enforce the password policy on UI and API (Medium — fixes a real bypass)
Today the policy is inconsistent and partly client-only:
- `change-password-modal.component.ts` enforces the **full** policy: 8+ chars,
  capital, lowercase, number, symbol (`isFormValid` requires all five).
- `login.component.ts:131` (signup) and `reset-password.component.ts:161` only check
  `>= 8` chars.
- Better Auth enforces **no** minimum by default, so a direct `POST /auth/sign-up/email`
  or `/auth/reset-password` bypasses everything.

Standardize on one shared policy and enforce it server-side so the API is the source of
truth (the browser checks stay as UX, not security).

### 2a. API: enforce the policy (authoritative)
**File:** `apps/api/src/lib/auth.ts`
```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false,
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
  },
  sendResetPassword: ...,
}
```
- Confirm the exact option keys against the installed `better-auth` version (v1.x
  supports `emailAndPassword.password.{minLength,maxLength,requireUppercase,
  requireLowercase,requireNumber,requireSpecialChar}`). If a key differs, adapt.
- Better Auth returns a structured error (e.g. `PASSWORD_TOO_SHORT` /
  `PASSWORD_COMPROMISED` / complexity codes) on `/sign-up/email` and `/reset-password`;
  the auth-bridge forwards it. No change needed there.

### 2b. UI: make signup + reset match the change-password policy
Add the same five-rule validation to the two screens that currently only check length,
so the client UX matches the API contract:
- `apps/frontend/src/app/features/auth/login.component.ts`
  - In `getFieldError('password')` for signup (`!this.isLogin()`), replace the bare
    `length < 8` check with the full set: 8+ chars, capital, lowercase, number, symbol.
    Return a message like `Password must be at least 8 characters and include uppercase,
    lowercase, a number, and a symbol.`
- `apps/frontend/src/app/features/auth/reset-password.component.ts`
  - In `onSubmit`, replace the `length < 8` check with the same five-rule check (and keep
    the match check). Mirror the validation message.
- `change-password-modal.component.ts` already enforces all five — leave it, but relax
  `isFormValid()` only if we decide to drop symbol/number later (we are not; it is the
  reference policy). Keep `minlength="8"` attributes on the inputs (already present).
- Update the reset-password helper text ("Must be at least 8 characters.") to mention the
  full requirements, matching change-password's visible requirements list.

### 2c. Shared validation helper (optional, low-risk)
To avoid the policy living in three places, extract a tiny `passwordPolicy` util
(e.g. `apps/frontend/src/app/features/auth/password-policy.ts`) with `meetsPolicy(pw)`
and `policyErrors(pw)`, and use it in all three components. Keep it simple — no new
abstraction beyond a single file. The API remains the authoritative enforcer.

### 2d. Tests
- **API (new/extend `apps/api/src/routes/auth.test.ts`):**
  - signup with a 7-char password → 400 with a password-too-short error.
  - signup with 8 chars but no symbol/number/etc. → 400 with a complexity error.
  - signup with a fully-compliant password → 200.
  - reset-password with a non-compliant password → 400.
- **Frontend (extend existing specs):**
  - `login.component.spec.ts` / `reset-password.component.spec.ts`: assert the password
    field error covers the full policy (not just length) when toggled/signed up.
  - `change-password-modal.component.spec.ts`: assert `isFormValid()` is false for a
    8-char password missing a symbol/number (already covered, confirm it stays green).

## 3. Per-environment config: frontend (Angular convention) + backend NODE_ENV (Medium)
`useSecureCookies` in `auth.ts` and our boot guard both depend on `NODE_ENV ===
'production'`. The compose file sets no `NODE_ENV`, so in the container this branch is
false → session cookies aren't `Secure` behind HTTPS and the secret guard never fires.
The frontend already has `environment.ts` / `environment.prod.ts` (consumed via
`app.config.ts`) but `angular.json` has **no `fileReplacements`**, so the build never
actually swaps them per configuration. Wire up Angular's documented environment
convention (dev / test / production) and align the backend `NODE_ENV` to match.

### 3a. Frontend: Angular environment files + file replacement (per Angular docs)
Angular's convention is one `environment.*.ts` per target + `fileReplacements` in
`angular.json` that swaps `environment.ts` for the right file under each build config.

**Files (apps/frontend/src/environments/):**
- `environment.ts` (default / dev):
  ```ts
  export const environment = {
    production: false,
    apiBaseUrl: 'http://localhost:3000',
  };
  ```
- `environment.prod.ts` (production): rename the existing one to match the prod shape;
  already correct:
  ```ts
  export const environment = {
    production: true,
    apiBaseUrl: '/api',
  };
  ```
- `environment.test.ts` (test / CI unit + e2e): same base URL as dev (point at the
  running API in the test harness). Add it so the `test` build config has a deterministic
  target:
  ```ts
  export const environment = {
    production: false,
    apiBaseUrl: 'http://localhost:3000',
  };
  ```

**File: `apps/frontend/angular.json`**
Add `fileReplacements` to the existing `build`/`serve`/`test` configurations (this is the
missing piece — Angular's documented pattern):
```jsonc
"build": {
  "configurations": {
    "production": {
      "fileReplacements": [
        { "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.prod.ts" }
      ],
      "budgets": [ ... ],
      "outputHashing": "all"
    },
    "development": {
      // no replacement → uses default environment.ts (dev)
      "optimization": false, "extractLicenses": false, "sourceMap": true
    }
  },
  "defaultConfiguration": "production"
},
"serve": {
  "configurations": {
    "production": { "buildTarget": "frontend:build:production" },
    "development": { "buildTarget": "frontend:build:development" }
  },
  "defaultConfiguration": "development"
},
"test": {
  "configurations": {
    "ci": { "fileReplacements": [
      { "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.test.ts" }
    ] }
  }
}
```
- The `production` build now picks `environment.prod.ts` automatically (so `apiBaseUrl:
  '/api'`, `production: true`); `ng serve` (development) keeps the dev file. The `test`
  config uses `environment.test.ts`.

**Why not `environment.prod.ts` as the only file:** Angular's build uses `environment.ts`
as the resolved import; `fileReplacements` is how it becomes the per-config file. That is
the documented mechanism — do not instead branch on `production` at runtime if the file
is already swapped.

### 3b. Backend: set NODE_ENV to match, and make the API config environment-aware
- **`docker-compose.yml`** — add to the `api` service `environment:` block (alongside the
  existing trustProxy comment):
  ```yaml
  NODE_ENV: ${NODE_ENV:-production}
  ```
  This makes the container run as production by default → `useSecureCookies` true behind
  HTTPS and the `BETTER_AUTH_SECRET` boot guard active.
- **`apps/api/Dockerfile`** — already sets `ENV NODE_ENV=production` in the production
  stage, so a bare `docker run` of the image is already safe. Note: compose
  `environment:` *overrides* image `ENV`, which is why the compose override below
  matters — do **not** add a second `ENV NODE_ENV` to the Dockerfile (it's already there).
- **Dev (non-Docker) tsx/`pnpm dev`** — `NODE_ENV` is unset, so the API runs in dev mode
  (http cookies, placeholder secret allowed) — correct. `docker-compose` overriding with
  `NODE_ENV=production` is the deployment-safe path.
- **Tests** — the API test suite sets `NODE_ENV` to `'test'` where needed (already done in
  `security-audit.test.ts` etc.) so the boot guard does not trip during `pnpm test`; keep
  that.

### 3c. Tests
- `apps/frontend`: confirm `ng build` (production) emits with `production: true` and
  `apiBaseUrl: '/api'` by checking the built `main.js` / a tiny unit test that imports
  `environment` under the prod build, or a karma test asserting `environment.production`
  for the `ci` config. Simpler: a spec that asserts `environment` shape per config is
  overkill — rely on `fileReplacements` + `pnpm build` smoke.
- `apps/api`: `security-audit.test.ts` already proves production boot refuses the default
  secret; add nothing new beyond confirming `NODE_ENV=production` in compose flows through.

## 4. Gate the public Swagger UI (Medium)
`nginx.conf` proxies `/docs` and `/docs/` to the API's Swagger UI with no auth, exposing
the full API surface to anyone. Restrict it to local/LAN access by default.

**File:** `docker/nginx.conf`
- Wrap the `/docs` and `/docs/` `location` blocks with an IP allowlist:
  `allow 127.0.0.1; allow 10.0.0.0/8; allow 172.16.0.0/12; allow 192.168.0.0/16; deny all;`
- Add a comment: self-hosters who want remote API docs should put it behind a reverse
  proxy with auth, not open it to the internet. (Alternative: drop the `/docs` proxy
  entirely and only serve Swagger when running the API container directly for dev.)

## Non-action (documented trade-offs, do not fix now)
- **Account enumeration on signup** — Better Auth returns `USER_ALREADY_EXISTS` when an
  email is taken. Suppressing it cleanly requires a custom flow; the standard
  self-hosted trade-off is fine. Leave as-is.
- **No exponential backoff on lockout** — fixed 5-min window is acceptable. Escalating
  backoff is a nice future enhancement, not an obvious gap.
- **Auth routes bypass Fastify schema validation** — `/auth/*` is proxied to
  `auth.handler`; field validation is delegated to Better Auth. Acceptable.

## Verification
- `cd apps/api && pnpm lint && pnpm test` — green; the new/extended signup/reset policy
  tests assert 400 for <8-char and complexity-failing passwords, 200 for compliant.
- `cd apps/frontend && pnpm test` — the auth specs assert the password field enforces the
  full five-rule policy (length + upper + lower + number + symbol) on signup and reset,
  matching `change-password-modal`.
- `docker compose up` then `curl -I localhost:8080/` — assert `Content-Security-Policy`,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` are present.
- Frontend env wiring: `pnpm --filter @yotara/frontend build` (production, default config)
  resolves `environment.prod.ts` (`production: true`, `apiBaseUrl: '/api'`); `ng serve`
  (development) resolves `environment.ts` (dev). Confirm `angular.json` has the
  `fileReplacements` for production (and a `ci` test config using `environment.test.ts`).
- `curl -I localhost:8080/docs` from a public IP / non-LAN address → `403`; from
  localhost → `200`.
- `curl -X POST .../auth/sign-up/email -d '{"password":"short"}'` → 400 with a
  password-too-short error; `{"password":"alllower1"}` → 400 complexity error;
  a compliant password → 200.
- Confirm `NODE_ENV=production` makes the api container refuse the default
  `BETTER_AUTH_SECRET` (already covered by `security-audit.test.ts` boot test).
