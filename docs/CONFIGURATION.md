# Configuration Reference

Every environment variable the Yotara API reads, with its default and purpose.

This is the single source of truth for configuration. If you add a variable to
`apps/api/.env.example`, add it here in the same change.

Copy the example file to get started:

```bash
cp apps/api/.env.example apps/api/.env
```

Values you set in the shell take precedence over `.env` for the Docker path.

## Core

| Variable | Default | Purpose |
|:---|:---|:---|
| `DATABASE_URL` | `./data/yotara.db` | SQLite file path. The Docker Compose stack sets `./apps/api/data/yotara.db` (and `/app/apps/api/data/yotara.db` for the Hub image). The directory is created if missing. |
| `PORT` | `3000` | API listen port. |
| `HOST` | `0.0.0.0` | API bind address. |
| `NODE_ENV` | unset | `production` enables secure cookies, secret validation, and the production email-verification default. Compose sets it to `production`. |
| `APP_BASE_URL` | `http://localhost:3000` | Public API URL used for Better Auth callbacks. Docker Compose sets `http://localhost:8080`. Do **not** append `/api` — nginx strips that prefix before proxying. |
| `FRONTEND_BASE_URL` | `http://localhost:4200` in dev; derived from `APP_BASE_URL` with a trailing `/api` removed in production | Public frontend URL used in verification and password-reset email links. Set this for split-origin deployments. |
| `TRUST_PROXY` | unset (no proxy trust) | Comma-separated reverse-proxy addresses or CIDRs whose `X-Forwarded-For` is trusted. The Compose stack sets `172.16.0.0/12`. |

### Why `TRUST_PROXY` matters

The API derives `request.ip` from `X-Forwarded-For`, and the global rate limiter
and per-IP login lockout depend on that IP being the real client. Only enable
`TRUST_PROXY` when a proxy you control overwrites the header — the bundled
`docker/nginx.conf` does, using `$remote_addr`. Leaving it unset is the safe
default for direct access. See the security note in
[docs/ARCHITECTURE.md](./ARCHITECTURE.md#security-at-deployment-boundaries).

## Authentication

| Variable | Default | Purpose |
|:---|:---|:---|
| `BETTER_AUTH_SECRET` | **required in production** | Session signing key. Must be canonical hex or Base64 representing at least 32 decoded bytes. The API refuses to boot on missing, placeholder, plain-text passphrase, malformed, or undersized values. Development and test intentionally allow it to be absent. |
| `TRUSTED_ORIGINS` | `http://localhost:4200` and `http://127.0.0.1:4200` in dev; **empty** in production | Comma-separated origins allowed for auth/CSRF checks. Must be set explicitly in production. |
| `CORS_ORIGIN` | inherits `TRUSTED_ORIGINS` | Extra CORS origins. |
| `REQUIRE_EMAIL_VERIFICATION` | `true` when `NODE_ENV=production`, otherwise `false` | Force email verification on or off regardless of environment. `DEV_MODE` overrides it off. |

Wildcard origins (`*`) are rejected at boot, because a wildcard would match every
site and disable origin checking.

Generate a secret with:

```bash
openssl rand -hex 32     # canonical hex
openssl rand -base64 32  # canonical Base64
```

## Rate limiting and lockout

| Variable | Default | Purpose |
|:---|:---|:---|
| `RATE_LIMIT_MAX` | `200` | Global requests allowed per IP per window. |
| `RATE_LIMIT_WINDOW_MINUTES` | `1` | Length of the global rate-limit window, in minutes. |
| `PASSWORD_LOCKOUT_ATTEMPTS` | `3` | Failed password attempts before lockout. Lockout is keyed by (IP, email). |
| `PASSWORD_LOCKOUT_MINUTES` | `5` | Lockout duration, in minutes. |
| `DELETE_ACCOUNT_RATE_LIMIT_MAX` | `5` | Account-deletion attempts allowed per window. |
| `DELETE_ACCOUNT_RATE_LIMIT_WINDOW_MINUTES` | `15` | Account-deletion rate-limit window, in minutes. |
| `EMAIL_RATE_IP_CAP` | `5` | Verification/reset emails allowed per IP. |
| `SIGNUP_IP_BAN_MS` | `86400000` (24 hours) | How long an IP is banned after tripping the signup honeypot, in milliseconds. |

## Email

| Variable | Default | Purpose |
|:---|:---|:---|
| `RESEND_API_KEY` | unset | [Resend](https://resend.com) API key. When unset, emails are logged to the console instead of sent. Required to boot in production, since the verification flow depends on delivery. |
| `EMAIL_FROM` | `noreply@email.yotara.website` | From address for outgoing email. Must be a sender you have verified with Resend. |

## Development mode

| Variable | Default | Purpose |
|:---|:---|:---|
| `DEV_MODE` | `true` when started via `pnpm dev`, otherwise unset | The single switch for frictionless local work. Forces email verification off, logs emails to the console even when `RESEND_API_KEY` is set, and bypasses email rate limits, login lockout, and honeypot IP bans. |
| `ALLOW_DEV_MODE_IN_PRODUCTION` | unset | Required double opt-in before `DEV_MODE` is honoured when `NODE_ENV=production`. Never enable either on a public instance. |

`pnpm dev:email` runs the full email-first flow with real Resend delivery and
email verification enabled.

## Security headers

| Variable | Default | Purpose |
|:---|:---|:---|
| `CONTENT_SECURITY_POLICY` | the Compose default policy | Overrides the CSP on every response, with a single value propagating to both the API's `onSend` hook and nginx's `envsubst`-rendered config. |

## Frontend

The frontend does not read environment variables at runtime. Its API base URL is
compiled in per configuration:

| Environment | API Base URL | File |
|:---|:---|:---|
| Development | `http://localhost:3000` | `apps/frontend/src/environments/environment.ts` |
| Production | `/api` | `apps/frontend/src/environments/environment.prod.ts` |

`angular.json` swaps these via `fileReplacements`. The production value assumes
the frontend and API are served from the same origin with `/api` routed to the
backend.

The E2E suite does read a few variables — see
[testing.md](../testing.md#4-end-to-end-testing-appsfrontende2e):

| Variable | Default | Purpose |
|:---|:---|:---|
| `E2E_BASE_URL` | `http://localhost:4200` | Frontend under test. |
| `E2E_API_URL` | `http://localhost:3000` | API under test. |
| `E2E_API_LOG` | unset | Path to the API log file. Required when email verification is enabled, because setup reads the verification link from it. |

## Docker deployment

For the Compose path, `BETTER_AUTH_SECRET` is mandatory and `docker compose
config` fails fast when it is unset. See [DOCKER.md](../DOCKER.md) for the full
deployment guide, including volumes, ports, and TLS termination.
