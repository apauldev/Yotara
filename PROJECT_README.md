# Yotara Technical Reference

The technical companion to the main repository page. For the product overview, start with [`README.md`](./README.md).

This document covers the shape of the codebase and how to work in it. Setup lives in [docs/INSTALL.md](./docs/INSTALL.md), configuration in [docs/CONFIGURATION.md](./docs/CONFIGURATION.md), and architectural decisions in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Overview

Yotara is a TypeScript pnpm monorepo with four workspaces:

- `apps/frontend` — Angular 22 application (standalone components, signals, lazy routes)
- `apps/api` — Fastify API with Better Auth and SQLite
- `apps/yotara-website` — static marketing site, deployed to yotara.website
- `packages/shared` — shared domain types, DTOs, and the auth client

## Where to look

| Question | Document |
|:---|:---|
| How do I run this locally? | [docs/INSTALL.md](./docs/INSTALL.md) |
| What does this environment variable do? | [docs/CONFIGURATION.md](./docs/CONFIGURATION.md) |
| Why is it built this way? | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| How do I test it? | [testing.md](./testing.md) |
| How do I deploy it? | [DOCKER.md](./DOCKER.md) |
| How do releases work? | [docs/RELEASING.md](./docs/RELEASING.md) |

## Frontend

The Angular application contains:

- Login, sign-up, email verification, and password reset flows
- Auth and onboarding guards, with workspace-mode routing
- Personal shell with task list, projects, labels, archive, search, notifications, and settings
- Team shell with a dashboard
- Task detail modal for create and edit, including subtasks and recurrence
- Recurring tasks (daily, weekly, monthly, yearly) with month-end and leap-year handling
- Multi-label assignment per task
- 7 color themes with dark mode
- Markdown descriptions with a format toolbar and sanitized preview
- Full-text search across tasks, projects, and labels
- Keyboard shortcuts for navigation
- Data export (JSON and CSV) from settings

### Routes

`apps/frontend/src/app/app.routes.ts` is authoritative. Broadly, the shape is:

| Area | Routes | Notes |
|:---|:---|:---|
| Auth | `/login`, `/verify-email`, `/forgot-password`, `/reset-password` | `/verify-email` has no auth guard, because the emailed link is opened before a session exists |
| Onboarding | `/onboarding`, `/preview/picker` | Guarded by `authGuard` and `onboardingGuard` |
| Personal shell | `/tasks`, `/projects`, `/projects/:id`, `/labels`, `/archive`, `/settings`, `/notifications`, `/search` | Selected by `personalModeMatchGuard` |
| Team shell | `/dashboard` | Selected by `teamModeMatchGuard`; team mode is not yet a complete feature |
| Fallback | `**` | Animated 404 page |

`/inbox`, `/today`, and `/upcoming` are legacy paths that redirect into `/tasks` with a `view` query parameter.

## Backend

The Fastify API has a route → service → database shape. Route handlers validate input and delegate; services own queries, transactions, recurrence, and notifications.

### API reference

The endpoint reference is **generated from the route schemas** — read it from a running instance rather than from a hand-maintained list:

- Swagger UI: `http://localhost:3000/docs`
- Raw spec: `http://localhost:3000/docs/openapi.json`

```bash
pnpm docs:check    # Validate the spec against the routes
pnpm docs:export   # Export the spec to a file
```

Authentication is session-cookie based via Better Auth. Every application route except `/`, `/health`, and `/config` requires a session.

### Development conventions

- Add JSON Schemas with the `withJsonResponse()` helper so the OpenAPI spec stays accurate
- Keep handlers thin; put logic in `apps/api/src/services/`
- Add route tests **colocated** with the route (`src/routes/<resource>.test.ts`)
- Use typed `AppError` subclasses; never `throw new Error('...')`

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full feature recipe and engineering principles.

## Data model

The schema is defined in [`apps/api/src/db/schema.ts`](./apps/api/src/db/schema.ts), which is authoritative for field names, types, and nullability.

| Group | Tables |
|:---|:---|
| Better Auth | `user`, `session`, `account`, `verification` |
| Application | `projects`, `tasks`, `labels`, `task_labels` |
| Operational | `email_sends`, `blocked_ips`, `notifications`, `login_attempts` |

Tasks support soft delete (`deletedAt`) and an `archived` status distinct from `done`. Projects are soft-deleted and restorable.

The API bootstraps the SQLite schema on startup and enables WAL mode, so a fresh clone needs no migration step. The database defaults to `./data/yotara.db` locally.

Drizzle artifacts:

- [`apps/api/drizzle`](./apps/api/drizzle) — generated migrations
- [`apps/api/drizzle.config.ts`](./apps/api/drizzle.config.ts) — Drizzle config

```bash
pnpm --filter @yotara/api db:generate   # Generate a migration
pnpm --filter @yotara/api db:push       # Push the schema
pnpm --filter @yotara/api db:studio     # Inspect the data
```

## API examples

All task endpoints require a session cookie. The cookie name depends on your Better Auth setup; the examples below use the default.

### Create a task

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -b "better-auth.session_token=YOUR_TOKEN" \
  -d '{
    "title": "Write docs",
    "status": "today",
    "priority": "high",
    "bucket": "deep-work"
  }'
```

### List tasks with filters

```bash
curl "http://localhost:3000/tasks?page=1&pageSize=10&status=today&priority=high" \
  -b "better-auth.session_token=YOUR_TOKEN"
```

### Update a task

```bash
curl -X PATCH http://localhost:3000/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -b "better-auth.session_token=YOUR_TOKEN" \
  -d '{ "completed": true, "priority": "low" }'
```

### Create a project

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -b "better-auth.session_token=YOUR_TOKEN" \
  -d '{ "name": "Documentation", "color": "teal" }'
```

### Create a label

```bash
curl -X POST http://localhost:3000/labels \
  -H "Content-Type: application/json" \
  -b "better-auth.session_token=YOUR_TOKEN" \
  -d '{ "name": "urgent", "color": "#e74c3c" }'
```

## Code quality

- ESLint flat config: [`eslint.config.mjs`](./eslint.config.mjs)
- Prettier: [`.prettierrc.json`](./.prettierrc.json)
- Husky pre-commit runs lint-staged (eslint --fix + prettier --write)
- Husky commit-msg runs commitlint
- Frontend lint additionally runs stylelint over CSS and SCSS

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Local development notes

- The frontend binds to `0.0.0.0:4200` and the API to `0.0.0.0:3000`
- Auth uses session cookies and browser-based flows
- Onboarding stores the workspace mode in `localStorage` through `PreferencesStore`
- Drizzle Studio is for local inspection only
- If the frontend and API run on different origins, update `APP_BASE_URL`, `TRUSTED_ORIGINS`, and `CORS_ORIGIN` together — see [docs/CONFIGURATION.md](./docs/CONFIGURATION.md)
