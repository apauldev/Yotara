# Docker

This repo ships a two-container Docker setup:

- `api`: Fastify + SQLite + Better Auth
- `frontend`: Angular served by Nginx, proxying API traffic to the API container

## What It Runs

The compose stack exposes:

- `http://localhost:8080` for the frontend
- `http://localhost:8080/api` for API requests
- `http://localhost:8080/docs` for Swagger UI
- `http://localhost:8080/docs/openapi.json` for the raw OpenAPI document

The API container stores SQLite data in a named volume so data survives restarts.

## Requirements

- Docker
- Docker Compose

I tested the stack locally with `docker-compose` plus Colima on macOS.

## Start

From the repository root:

```bash
pnpm docker:up
```

That command builds both images and starts the stack in detached mode.

To verify the live stack after it starts:

```bash
pnpm smoke:docker
```

If you prefer the raw Compose command:

```bash
docker-compose up --build -d
```

## Stop

```bash
pnpm docker:down
```

Or:

```bash
docker-compose down
```

## What I Verified

Expected responses:

- `/` returns `200`
- `/api/health` returns `200`
- `/docs` returns the Swagger UI HTML
- `/docs/openapi.json` returns the API spec JSON
- `/api/tasks` returns `401 Unauthorized` when you are not signed in

`pnpm smoke:docker` checks all of the above automatically.

## Notes

- The API container needs `BETTER_AUTH_SECRET`; the compose file sets a local development value.
- The API build must include the repo root `tsconfig.base.json`, otherwise the TypeScript build inside Docker will fail.
- The API entry point is the compiled file at `apps/api/dist/apps/api/src/server.js`.
