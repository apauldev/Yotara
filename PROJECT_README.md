# Yotara Project Guide

This document is the technical companion to the main repository page.

For the product overview and project positioning, start with [`README.md`](./README.md).
For the current personal-mode implementation details, see [`docs/personal-mode-mvp.md`](./docs/personal-mode-mvp.md).

**For a detailed technical roadmap of all planned screens, components, build phases, and effort estimates, see the [MVP Roadmap](./ROADMAP.md).**

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
- team dashboard shell
- personal shell with Inbox, Today, Upcoming, Projects, and Labels
- task list UI backed by the task service
- task detail modal for personal-mode create and edit flows

Current route map:

- `/login`
- `/onboarding`
- `/preview/picker`
- `/inbox`
- `/today`
- `/upcoming`
- `/projects`
- `/labels`
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
- simple mode
- bucket: `personal-sanctuary | deep-work | home | health`
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

The root `prepare` script installs the Husky Git hooks automatically during install.
If you ever need to restore them manually, run:

```bash
pnpm prepare
```

## Running Locally

### Recommended flow

For normal day-to-day development, use the root workspace scripts from the repository root.

Typical startup:

```bash
pnpm install
pnpm dev
```

Use individual package commands only when you want to isolate one service.

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
pnpm lint:fix
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm prepare
pnpm dev:frontend
pnpm dev:api
pnpm db:studio
```

Recommended pre-PR verification:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

If you want the repo to auto-correct style issues first:

```bash
pnpm format
pnpm lint:fix
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
pnpm docs:check
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

Frontend test behavior:

- `pnpm test` runs once in `ChromeHeadless`
- it does not stay in watch mode, which makes it safe for root-level verification and CI

## Code Quality

The repository now has a root-level code quality workflow that should be used before merges.

### Tooling

- ESLint flat config: [`eslint.config.mjs`](./eslint.config.mjs)
- Prettier config: [`.prettierrc.json`](./.prettierrc.json)
- Prettier ignore rules: [`.prettierignore`](./.prettierignore)
- Husky hook: [`.husky/pre-commit`](./.husky/pre-commit)
- lint-staged config: [`.lintstagedrc.json`](./.lintstagedrc.json)

### What runs on commit

The pre-commit hook runs `lint-staged`, which currently does the following:

- staged `*.ts` files: `eslint --fix`, then `prettier --write`
- staged `*.js`, `*.json`, and `*.md` files: `prettier --write`

That means some files may be rewritten automatically during commit if they are staged.

### Root command behavior

- `pnpm lint`: runs root ESLint, then package-level lint scripts
- `pnpm lint:fix`: runs root ESLint auto-fixes, then attempts package-level lint fixes where available
- `pnpm format`: rewrites supported files with Prettier
- `pnpm format:check`: validates formatting without changing files
- `pnpm typecheck`: runs workspace TypeScript validation
- `pnpm test`: runs all workspace test suites

### Current expectations

- a healthy branch should pass `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test`
- root lint currently allows a small warning budget with `--max-warnings 10`
- frontend `lint` is a TypeScript compile check for the app project rather than a separate ESLint pass inside `apps/frontend`

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

Interactive API documentation is now served by the API itself:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/openapi.json`

The generated spec includes app-owned routes plus the configured Better Auth endpoints:

- `GET /`
- `GET /health`
- `GET /me`
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `POST /auth/sign-up/email`
- `POST /auth/sign-in/email`
- `POST /auth/sign-out`
- `GET /auth/session`

Use the generated docs as the source of truth for request/response shapes and examples. Keep this README limited to high-level notes that are not duplicated in OpenAPI.

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
- root validation should include formatting, linting, type-checking, and tests

Common verification commands:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
```

Recommended full cleanup-and-verify flow:

```bash
pnpm format
pnpm lint:fix
pnpm format:check
pnpm typecheck
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

Practical notes:

- API tests cover auth flows, auth-origin handling, CORS handling, and task scoping behavior
- frontend tests now validate the router-shell app structure and auth state services
- frontend tests require `ChromeHeadless` to be available on the machine

## Local Development Notes

- The frontend dev server binds to `0.0.0.0` on port `4200`.
- The API binds to `0.0.0.0` on port `3000` by default.
- Auth and task routes assume cookies and browser-based session flows.
- Onboarding currently stores the selected workspace type in `localStorage` before navigating to the dashboard.
- Drizzle Studio is started from the root dev runner and is intended for local inspection, not production use.
- If frontend and API run on different origins, keep frontend environment values and API trusted origin settings aligned.

## Suggested First Checks

After `pnpm install`, a quick sanity pass is:

```bash
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

If the app boots, auth pages load, and the checks pass, your local setup is in good shape.
