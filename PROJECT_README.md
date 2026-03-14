# Yotara Project Guide

This document is the technical companion to the main repository page.

For the product overview and project positioning, start with [`README.md`](./README.md).

## Overview

Yotara is a TypeScript monorepo with:

- `apps/frontend`: Angular 21 application
- `apps/api`: Fastify API with Better Auth and SQLite
- `packages/shared`: shared domain types for auth and tasks
- `scripts/dev.mjs`: local dev runner for the frontend, API, and Drizzle Studio

## What Exists Today

### Frontend

The Angular app currently contains:

- login and sign-up flow
- auth guard for protected routes
- onboarding mode picker with personal and team options
- dashboard route
- task list UI backed by the task service

Current route map:

- `/login`
- `/onboarding`
- `/preview/picker`
- `/dashboard`

### Backend

The Fastify API currently exposes:

- `/` basic API metadata
- `/health` health endpoint
- `/auth/*` Better Auth endpoints
- `/me` current authenticated user
- `/tasks` CRUD endpoints for user-owned tasks

Task records currently support:

- title
- description
- status: `inbox | today | upcoming | done | archived`
- priority: `low | medium | high`
- completion state
- due date
- sort order

### Storage

The API uses SQLite through Drizzle and bootstraps the required tables automatically on startup:

- Better Auth tables: `user`, `session`, `account`, `verification`
- app table: `tasks`

Default local database path:

```text
./data/yotara.db
```

## Requirements

- Node.js 18 or newer
- pnpm 9 or newer

## Installation

```bash
git clone <repository-url>
cd Yotra
pnpm install
```

## Running Locally

### Start everything

```bash
pnpm dev
```

This starts:

- frontend on `http://localhost:4200`
- API on `http://localhost:3000`
- Drizzle Studio, announced locally as `https://local.drizzle.studio`

The root `dev` script uses [`scripts/dev.mjs`](./scripts/dev.mjs) to run all three processes together and shut them down cleanly.

### Start services individually

```bash
pnpm dev:frontend
pnpm dev:api
pnpm db:studio
```

## Workspace Commands

### From the repo root

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm dev:frontend
pnpm dev:api
pnpm db:studio
```

### API commands

From `apps/api` or via `pnpm --filter @yotara/api <command>`:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:push
pnpm db:studio
```

### Frontend commands

From `apps/frontend` or via `pnpm --filter @yotara/frontend <command>`:

```bash
pnpm dev
pnpm start
pnpm build
pnpm watch
pnpm test
pnpm lint
pnpm typecheck
```

## Environment Variables

### API environment

The API reads these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `./data/yotara.db` | SQLite file path |
| `APP_BASE_URL` | `http://localhost:3000` | Base URL used by Better Auth |
| `TRUSTED_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` | Allowed auth origins |
| `CORS_ORIGIN` | inherits trusted origins | Extra CORS origins |
| `PORT` | `3000` | API port |
| `HOST` | `0.0.0.0` | API bind host |
| `NODE_ENV` | unset | Enables secure cookies in production |

Notes:

- Better Auth secure cookies are enabled automatically when `NODE_ENV=production` or `APP_BASE_URL` starts with `https://`.
- The API bootstraps the SQLite schema on startup, so a fresh local setup does not require a separate migration step just to run.
- If you deploy frontend and API on different origins, update `APP_BASE_URL`, `TRUSTED_ORIGINS`, and `CORS_ORIGIN` together.

Example:

```bash
APP_BASE_URL=http://localhost:3001 \
TRUSTED_ORIGINS=http://localhost:4200 \
CORS_ORIGIN=http://localhost:4200 \
PORT=3001 \
pnpm dev:api
```

### Frontend environment

Frontend environment files live in:

- [`apps/frontend/src/environments/environment.ts`](./apps/frontend/src/environments/environment.ts)
- [`apps/frontend/src/environments/environment.prod.ts`](./apps/frontend/src/environments/environment.prod.ts)

Current values:

- development API base URL: `http://localhost:3000`
- production API base URL: `/api`

That production setting assumes the frontend and API are served behind the same origin with `/api` routed to the backend.

## Project Structure

```text
.
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── db
│   │   │   ├── lib
│   │   │   ├── plugins
│   │   │   ├── routes
│   │   │   └── server.ts
│   │   ├── drizzle
│   │   └── drizzle.config.ts
│   └── frontend
│       ├── src/app
│       │   ├── core
│       │   ├── features
│       │   └── shared
│       └── src/environments
├── packages
│   └── shared
└── scripts
```

## API Surface

### Public endpoints

- `GET /`
- `GET /health`

### Auth endpoints

Mounted under:

```text
/auth/*
```

These are handled by Better Auth. Common flows include sign-up, sign-in, session retrieval, and sign-out.

### Session endpoint

- `GET /me`

Returns the authenticated user session or `401`.

### Task endpoints

- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`

All task routes require authentication and are scoped to the current user.

## Database And Drizzle

The database client lives in [`apps/api/src/db/client.ts`](./apps/api/src/db/client.ts).

Important behavior:

- creates the SQLite directory if it does not exist
- bootstraps required tables if the database is new
- enables SQLite WAL mode

Drizzle artifacts live under:

- [`apps/api/drizzle`](./apps/api/drizzle)
- [`apps/api/drizzle.config.ts`](./apps/api/drizzle.config.ts)

Useful commands:

```bash
pnpm --filter @yotara/api db:generate
pnpm --filter @yotara/api db:push
pnpm --filter @yotara/api db:studio
```

## Testing

There is already a repo-level testing guide in [`testing.md`](./testing.md). The practical summary is:

- API tests use the Node test runner with `tsx`
- frontend tests use Karma + Jasmine
- root validation should include type-checking, linting, and tests

Common verification commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

API tests live in:

- [`apps/api/src/routes/tasks.test.ts`](./apps/api/src/routes/tasks.test.ts)
- [`apps/api/src/routes/auth.test.ts`](./apps/api/src/routes/auth.test.ts)
- [`apps/api/src/lib/auth-origins.test.ts`](./apps/api/src/lib/auth-origins.test.ts)
- [`apps/api/src/plugins/cors.test.ts`](./apps/api/src/plugins/cors.test.ts)

Frontend tests include:

- [`apps/frontend/src/app/app.component.spec.ts`](./apps/frontend/src/app/app.component.spec.ts)
- [`apps/frontend/src/app/core/services/auth-state.service.spec.ts`](./apps/frontend/src/app/core/services/auth-state.service.spec.ts)

## Local Development Notes

- The frontend dev server binds to `0.0.0.0` on port `4200`.
- The API binds to `0.0.0.0` on port `3000` by default.
- Auth and task routes assume cookies and browser-based session flows.
- Onboarding currently stores the selected workspace type in `localStorage` before navigating to the dashboard.

## Suggested First Checks

After `pnpm install`, a quick sanity pass is:

```bash
pnpm dev
pnpm typecheck
pnpm test
```

If the app boots, auth pages load, and the checks pass, your local setup is in good shape.
