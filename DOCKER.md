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

The compose file sets these by default:

| Variable | Value | Purpose |
|:---|:---|:---|
| `BETTER_AUTH_SECRET` | Development secret | Session signing |
| `DATABASE_URL` | `/data/yotara.db` | SQLite path inside container |
| `APP_BASE_URL` | `http://localhost:8080` | Base URL for Better Auth |
| `TRUSTED_ORIGINS` | `http://localhost:8080` | Allowed auth origins |
| `PORT` | `3000` | API port |

For production, override any variable by creating a `.env` file in the project root:

```bash
BETTER_AUTH_SECRET=your-secure-random-secret
DATABASE_URL=/data/yotara.db
APP_BASE_URL=https://your-domain.com/api
TRUSTED_ORIGINS=https://your-domain.com
```

Docker Compose reads the root `.env` file automatically to supply
`${VAR:-default}` interpolation values in the compose file.

Alternatively, create a `docker-compose.override.yml` to add or replace
environment variables, ports, or volumes without modifying the base file:

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

- Change `BETTER_AUTH_SECRET` to a secure random value
- Use HTTPS with a reverse proxy (Traefik, Caddy, nginx)
- Set `NODE_ENV=production` for secure cookies
- Use a managed SQLite solution or migrate to Postgres for multi-user deployments
- Configure backup for the Docker volume

## API Entry Point

The API entry point is at:

```
apps/api/dist/server.js
```

This is the compiled output. The Dockerfile builds TypeScript before starting the server.
