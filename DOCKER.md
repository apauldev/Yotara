# Docker Deployment

This document covers the Docker setup for Yotara.

## Architecture

Two-container setup:

- **api**: Fastify + SQLite + Better Auth
- **frontend**: Angular served by Nginx, proxying API traffic to the API container

## Endpoints

| URL | Description |
|:---|:---|
| `http://localhost:8080` | Frontend |
| `http://localhost:8080/api` | API requests |
| `http://localhost:8080/docs` | Swagger UI |
| `http://localhost:8080/docs/openapi.json` | OpenAPI spec |

Data persists in a named Docker volume.

## Requirements

- Docker
- Docker Compose

## Pre-built images (Docker Hub)

Yotara publishes multi-platform images (amd64 & arm64) to Docker Hub on every release:

- [`apauldev/yotara-api`](https://hub.docker.com/r/apauldev/yotara-api) — Fastify + SQLite + Better Auth
- [`apauldev/yotara-frontend`](https://hub.docker.com/r/apauldev/yotara-frontend) — Angular served by Nginx

Use the [hub compose file](./docker-compose.hub.yml) for the quickest start:

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/apauldev/yotara/main/docker-compose.hub.yml
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d
```

The rest of this document covers building from source.

## Quick Start

```bash
pnpm docker:up       # Build and start
pnpm smoke:docker    # Verify stack
pnpm docker:down     # Stop
```

Or using Docker Compose directly:

```bash
docker compose up --build -d
docker compose down
```

## Smoke Test

`pnpm smoke:docker` verifies:

- `/` returns `200`
- `/api/health` returns `200`
- `/docs` returns Swagger UI HTML
- `/docs/openapi.json` returns API spec JSON
- `/api/tasks` returns `401 Unauthorized` when not signed in

## Environment Variables

`BETTER_AUTH_SECRET` is **required** — `docker compose config` fails with a clear error if
it is unset, and the API refuses to boot with the old placeholder value. This secret signs
session tokens; without a strong secret, an attacker can forge sessions for any account.

Generate it on every deploy and never commit a real value:

```bash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d
```

| Variable | Default / Req'd | Purpose |
|:---|:---:|:---|
| `BETTER_AUTH_SECRET` | **Required** | Session signing key (min 32 chars, use `openssl rand -base64 32`) |
| `DATABASE_URL` | `./apps/api/data/yotara.db` | SQLite path (inside container or volume) |
| `APP_BASE_URL` | `http://localhost:8080/api` | Public URL for Better Auth callbacks |
| `TRUSTED_ORIGINS` | `http://localhost:8080` | Allowed auth/CORS origins |
| `PORT` | `3000` | API container port |
| `CONTENT_SECURITY_POLICY` | *(see below)* | Override the CSP for both nginx and the API |

### Content-Security-Policy

The CSP is a single source of truth set once in `docker-compose.yml` (both `api` and
`frontend` services). Override it to allow a CDN, external fonts, or custom integrations:

```bash
export CONTENT_SECURITY_POLICY="default-src 'self' https://cdn.example.com"
docker compose up -d
```

This single variable propagates to both the API's Fastify `onSend` hook and nginx's
`envsubst`-rendered config. There is no second copy to update.

## Security Hardening

The Docker stack is hardened out of the box:

| Hardening | Description |
|:---|:---|
| **Session token key required** | `BETTER_AUTH_SECRET` must be set; compose refuses to start without it |
| **Security headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Content-Security-Policy` on every response (mirrored by the API hook) |
| **Swagger UI gated** | `/docs` restricted to localhost + private LAN (10/8, 172.16/12, 192.168/16) at the nginx level |
| **Account lockout scoped by IP** | Lockout keyed by (client IP, email) — an attacker can't lock a victim from a different IP |
| **Per-email rate limiting** | Max 3 signup/reset emails per hour per email address |
| **Global rate limiting** | 1000 requests/min per IP (configurable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MINUTES`) |

### Deployment constraints

The API runs with `trustProxy: 1` and keys rate-limiting + lockout off `request.ip`,
which it derives from `X-Forwarded-For`. **Never expose the API container directly to the
internet** — the bundled nginx proxy (`docker-compose.yml`) must sit in front to overwrite
`X-Forwarded-For` with the real client IP. Running the API bare makes `request.ip`
attacker-controllable, defeating per-IP lockout and rate limiting.

## Override Without Editing the Compose File

Create a `docker-compose.override.yml` in the project root (Docker Compose merges it
automatically with `docker-compose.yml`):

```yaml
services:
  frontend:
    ports:
      - "9091:80"   # Change host port without editing the base file
  api:
    environment:
      RATE_LIMIT_MAX: "100"
```

## Troubleshooting

### Build fails with TypeScript errors

The API build requires the root `tsconfig.base.json`. Ensure you're building from the repository root:

```bash
docker compose up --build
```

### Port 8080 already in use

Change the port mapping in `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "9090:80"  # Change 8080 to 9090
```

### API container crashes on startup

Check logs:

```bash
docker compose logs api
```

Common causes:
- Missing `BETTER_AUTH_SECRET` environment variable
- SQLite directory not writable

### Database not persisting

The API stores data in a named volume. To reset the database:

```bash
docker compose down -v  # -v removes volumes
docker compose up --build
```

### Frontend can't reach API

Verify the Nginx proxy is configured correctly:

```bash
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
```

The proxy pass should point to `http://api:3000`.

### Slow first build

The first build compiles TypeScript and installs dependencies. Subsequent builds use Docker cache. Use `--mount=type=cache` in Dockerfile for faster rebuilds.

### Checking container health

```bash
docker compose ps           # Show container status
docker compose logs -f      # Follow all logs
docker compose exec api sh  # Shell into API container
```

## Production Considerations

- **`BETTER_AUTH_SECRET` is required** — set it on every deploy via `export BETTER_AUTH_SECRET=...` or a `.env` file. Compose fails fast if it is missing, and the API refuses to start with the old placeholder. Never commit a real value.
- Use HTTPS with a reverse proxy (Traefik, Caddy, nginx). The nginx config has an HSTS comment for enabling once TLS is terminated at nginx.
- `NODE_ENV=production` is baked into the Dockerfile — session cookies are `Secure` and the boot guard is active by default in the container.
- Configure backup for the Docker volume (`yotara_api_data` contains the SQLite database).

## API Entry Point

The API entry point is at:

```
apps/api/dist/server.js
```

This is the compiled output. The Dockerfile builds TypeScript before starting the server.
