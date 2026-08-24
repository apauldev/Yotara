# Security assessment — Yotara

Status: **Assessment** (verified against the current source on 2026-08-13, `beta-release` branch).

**Bottom line:** the fundamentals are genuinely solid — unusually so for a self-hosted
app — but the dependency tree is the weak point. `better-auth@1.5.4` carries a
critical-severity advisory and several high-severity ones, including one that touches a
flow this app actively uses (email verification). The single most important action is
upgrading it.

---

## 1. What's solid (verified in code)

### Authentication & authorization

- Better Auth sessions with `httpOnly` + `sameSite=lax` cookies, `secure` in production.
- 8-char minimum password policy.
- `BETTER_AUTH_SECRET` guarded at two layers (`apps/api/src/lib/auth.ts` module load and
  `apps/api/src/server.ts` bootstrap, via the shared `lib/auth-secret.ts`): missing,
  placeholder, short (<32 chars), periodic, and low-entropy values are all rejected in
  production. Dev/test environments are exempt.
- Every data route runs `requireAuthenticatedUser` (`plugins/auth-required.ts`), which
  resolves the session to `request.userId`, and queries are owner-scoped
  (`WHERE t.user_id = ?`, project `owner_id` filters).
- Verified-only sign-in; unverified sign-ins get a distinct `403 EMAIL_NOT_VERIFIED`
  without burning lockout attempts.

### Injection & XSS

- All SQL is parameterized (drizzle `sql` templates / `?` placeholders); search escapes
  LIKE wildcards (`%`, `_`, `\`) and binds values (`routes/search.ts`).
- Angular's default escaping + DOMPurify for markdown (`app.config.ts`); the highlight
  pipe HTML-escapes all text before wrapping matches in `<mark>`.
- Email templates HTML/attribute-escape the display name and the URL
  (`lib/email.ts` `escapeHtml` / `escapeAttribute`).
- No `eval` / unescaped `innerHTML` sinks found outside tests.

### Abuse & enumeration

- Email rate limits (per-type 5/30 min, 3/hr total, 5 unique emails/IP/hr), tunable via env.
- (ip, email)-scoped login lockout (3 attempts / 5 min by default).
- Signup honeypot + 24h IP ban; bans are **not enforced in dev mode** (a browser
  autofill can't lock a developer out).
- Generic "check your email" responses — no account enumeration.
- 15-min verification tokens; unverified accounts deleted after 24h (with orphan-row
  cleanup).
- Explicit CORS allowlist with `credentials: true`; trusted-origins checks on auth
  callbacks; **wildcard origins are refused at boot** (`parseOriginList`).

### Ops & transport

- CSP + `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` + `Referrer-Policy`
  on both the API and nginx.
- `/docs` (Swagger UI) restricted to localhost/LAN in nginx.
- Only port 8080 is published; the API port stays private; `trustProxy: 1` matches the
  single-nginx topology.
- Docker hardening: read-only rootfs, `tmpfs /tmp`, `cap_drop: ALL`,
  `no-new-privileges`, non-root user.
- Production email fail-loud: without `RESEND_API_KEY` the API refuses to boot; reset/
  verification links are never logged in production.
- `.env` is gitignored; gitleaks config + secret-scan + CodeQL workflows in CI.
- Dev mode requires the explicit `ALLOW_DEV_MODE_IN_PRODUCTION=true` opt-in under
  `NODE_ENV=production` (double opt-in, fails loudly).

---

## 2. Gaps (prioritized)

### P1 — `better-auth@1.5.4` is outdated (patched: 1.6.22)

`pnpm audit --prod` reports **1 critical + 37 high + 46 moderate + 7 low** (92 findings
total, most in dev tooling). The runtime-relevant advisories:

| Severity | Advisory | Relevance to this app |
|----------|----------|-----------------------|
| **Critical** | GHSA-pw9m-5jxm-xr6h — OAuth refresh-token replay via missing client authentication (<1.6.11) | **Not exploitable**: the app enables email+password only; no OAuth/OIDC plugins |
| **High** | GHSA-qq9h-g4jm-xgf3 — account takeover via pre-account hijacking on magic-link and **email-verification** flows (≥1.1.3 <1.6.22) | **Directly relevant** — this app has an email-first signup/verification flow. The design (verified-only sign-in, 24h unverified deletion) partially mitigates it, but this is the advisory to take seriously |
| High | GHSA-86j7-9j95-vpqj — stored XSS in auth-server origin via `javascript:` redirect_uri (<1.6.13) | Not exploitable (no OAuth) |
| High | GHSA-g38m-r43w-p2q7 — account takeover via OAuth auto-link (<1.6.11) | Not exploitable (no OAuth) |
| High | GHSA-fmh4-wcc4-5jm3 — unauthorized invitation acceptance (<1.6.11) | Not exploitable (no organization plugin) |
| High | GHSA-7w99 / 392p / 9h47 — OAuth/OIDC issues (<1.6.0–1.6.11) | Not exploitable (no OAuth) |
| Low | GHSA-2vg6 — stale sessions after user deletion (<1.6.11) | Minor; the app's own cleanup deletes sessions explicitly |

**Fix**: `pnpm update better-auth` (the `^1.5.4` pin permits 1.6.x) with compatibility
testing — drizzle adapter, `databaseHooks`, client — against the full suite (244 tests)
and the E2E suite. Same for the frontend copy.

### P2 — `@fastify/static@9.0.0` (via `@fastify/swagger-ui`) path traversal

- GHSA-83w8-p2f5-377r (route-guard bypass, high, patched ≥10.1.1)
- GHSA-pr96-94w5-mx2h / GHSA-x428-ghpx-8j92 (directory listing / encoded separators,
  moderate, patched ≥9.1.1)
- GHSA-8pvw-jcv7-9cmj (non-canonical paths, moderate, patched ≥10.1.2)

Impact is limited (only bundled swagger assets are served, and `/docs` is nginx-
restricted), but it's a cheap upgrade: bump `@fastify/swagger-ui`.

### P3 — password reset does not revoke sessions

`revokeSessionsOnPasswordReset` is unset (Better Auth default: false). After a password
reset, pre-existing sessions remain valid until they expire. Fix: enable the option in
`lib/auth.ts` + a test.

### P4 — audit findings are not gated

Most of the 92 audit findings are dev/build tooling (esbuild, drizzle-kit, tsx, karma,
playwright) that never ships in the prod image, but the CI audit step has
`continue-on-error: true`, so nothing blocks on them. Fix: make it blocking or scope it
to `pnpm audit --prod`.

---

## 3. Acceptable tradeoffs (not worth chasing for this app)

- **No 2FA/WebAuthn** — reasonable for a self-hosted personal task manager; revisit if it
  ever becomes multi-tenant/paid.
- **CSP uses `'unsafe-inline'` for styles** — required by Angular, standard tradeoff.
- **Task updates can self-parent** — an integrity bug, not a security hole (precheck 2.1).
- **`/docs` swagger surface** — LAN-restricted already.

---

## 4. Recommended order of work

1. Upgrade `better-auth` to ≥1.6.22 (API + frontend) with full suite + E2E verification.
2. Bump `@fastify/swagger-ui` (pulls patched `@fastify/static`).
3. Enable `revokeSessionsOnPasswordReset: true` + test.
4. Make the CI audit step blocking (or `--prod`-scoped).

## 5. Evidence

- `pnpm audit --prod` output (2026-08-13): 92 findings; runtime-relevant chains:
  `better-auth@1.5.4` (1 critical, 27+ high advisories) and `@fastify/static@9.0.0`.
- Code review of auth, routes, SQL, frontend pipes, docker config, CI workflows.
- Test baseline: 244/244 API tests, 79/79 frontend auth specs.
