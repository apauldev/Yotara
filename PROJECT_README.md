# Yotara Project Guide

This document is the technical companion to the main repository page.

For the product overview and project positioning, start with [`README.md`](./README.md). For the technical roadmap and anti-pattern registry, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Overview

Yotara is a TypeScript monorepo with:

- `apps/frontend`: Angular 21 application (standalone components, signals, lazy routes)
- `apps/api`: Fastify API with Better Auth and SQLite, with Postgres planned for team-mode SaaS
- `packages/shared`: shared domain types, DTOs, and auth client
- `scripts/dev.mjs`: local dev runner for the frontend, API, and Drizzle Studio

## What Exists Today

### Frontend

The Angular app contains:

- Login and sign-up flow with email verification
- Auth guard for protected routes
- Onboarding mode picker (personal and team)
- Personal shell with task list, projects, labels, archive, search, and settings
- Team shell with dashboard
- Task detail modal for create and edit flows
- Subtask management with one-level nesting
- Recurring task configuration (daily, weekly, monthly, yearly)
- Multi-label assignment per task
- 7 color themes with dark mode
- Login tip popup with 30 productivity tips
- Real-time loading indicators and notification toasts
- Full-text search across tasks, projects, and labels
- Keyboard shortcuts for navigation

### Current Route Map

| Route | Component | Description |
|:---|:---|:---|
| `/login` | LoginComponent | Email/password sign-in |
| `/onboarding` | StartScreenComponent | Workspace mode selection |
| `/preview/picker` | StartScreenComponent | Mode preview |
| `/tasks` | TaskListPageComponent | Unified task list with sidebar filters |
| `/tasks?filter=today` | TaskListPageComponent | Tasks due today |
| `/tasks?filter=upcoming` | TaskListPageComponent | Upcoming tasks by date |
| `/projects` | ProjectsPageComponent | Project grid |
| `/projects/:id` | ProjectDetailPageComponent | Single project with task list |
| `/labels` | LabelsPageComponent | Label management |
| `/archive` | ArchivePageComponent | Completed and archived tasks |
| `/settings` | SettingsPageComponent | Account and behavior settings |
| `/search` | SearchPageComponent | Full-text search |
| `/dashboard` | TasksPageComponent | Team dashboard (team mode) |

Legacy routes (`/inbox`, `/today`, `/upcoming`) redirect to `/tasks`.

### Backend

The Fastify API exposes:

- `GET /` — API metadata
- `GET /health` — Health check
- `POST /auth/sign-up/email` — Create account
- `POST /auth/sign-in/email` — Sign in
- `POST /auth/sign-out` — Sign out
- `GET /auth/session` — Current session
- `GET /me` — Authenticated user profile
- `PATCH /me` — Update user (display_name, timezone)
- `PATCH /me/password` — Change password
- `GET /tasks` — List tasks (paginated, filterable by status, project, priority, bucket, label, completion, overdue)
- `GET /tasks/:id` — Get task
- `POST /tasks` — Create task
- `PATCH /tasks/:id` — Update task
- `DELETE /tasks/:id` — Permanent delete
- `POST /tasks/:id/labels/:labelId` — Assign label
- `DELETE /tasks/:id/labels/:labelId` — Unassign label
- `GET /projects` — List projects
- `GET /projects/:id` — Get project
- `POST /projects` — Create project
- `PATCH /projects/:id` — Update project
- `DELETE /projects/:id` — Soft delete project
- `POST /projects/:id/restore` — Restore soft-deleted project
- `GET /labels` — List labels
- `GET /labels/:id` — Get label
- `POST /labels` — Create label
- `PATCH /labels/:id` — Update label
- `DELETE /labels/:id` — Delete label
- `GET /docs` — Swagger UI
- `GET /docs/openapi.json` — Raw OpenAPI spec

### Task Fields

| Field | Type | Description |
|:---|:---|:---|
| `id` | UUID | Primary key |
| `title` | string | Task title |
| `description` | string | Markdown description |
| `status` | enum | `inbox \| today \| upcoming \| done \| archived` |
| `priority` | enum | `low \| medium \| high` |
| `bucket` | enum | `personal-sanctuary \| deep-work \| home \| health` |
| `completed` | boolean | Completion state |
| `simpleMode` | boolean | Simplified task view |
| `dueDate` | date | Due date with recurrence generation |
| `sortOrder` | integer | Position within filter |
| `recurrence` | enum | `none \| daily \| weekly \| monthly \| yearly` |
| `nextDueDate` | date | Next occurrence for recurring tasks |
| `projectId` | UUID | Parent project (optional) |
| `labels` | relation | Many-to-many with labels table |
| `deletedAt` | timestamp | Soft delete |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last modification time |

### Project Fields

| Field | Type | Description |
|:---|:---|:---|
| `id` | UUID | Primary key |
| `name` | string | Project name |
| `description` | string | Project description |
| `color` | enum | `sage \| teal \| olive \| clay \| forest \| deep-ocean` |
| `ownerId` | UUID | Owning user |
| `taskCount` | integer | Derived: total tasks |
| `completedCount` | integer | Derived: completed tasks |
| `openCount` | integer | Derived: open tasks |
| `deletedAt` | timestamp | Soft delete |

### Label Fields

| Field | Type | Description |
|:---|:---|:---|
| `id` | UUID | Primary key |
| `name` | string | Label name (unique per user) |
| `color` | string | Hex color |
| `ownerId` | UUID | Owning user |

### Storage

The API uses SQLite through Drizzle and bootstraps the required tables automatically on startup.

**Tables:**
- Better Auth: `user`, `session`, `account`, `verification`
- App: `projects`, `tasks`, `labels`, `task_labels`

Default local database path:

```text
./data/yotara.db
```

## Requirements

- Node.js 18 or newer
- pnpm 9 or newer

## Installation

```bash
git clone https://github.com/apauldev/Yotara.git
cd Yotara
cp .env.example .env
pnpm install
```

The root `prepare` script installs Husky Git hooks automatically during install.

## Running Locally

### Recommended flow

```bash
pnpm dev
```

This starts:
- Frontend: `http://localhost:4200`
- API: `http://localhost:3000`
- Drizzle Studio: `https://local.drizzle.studio`

### Individual services

```bash
pnpm dev:frontend
pnpm dev:api
pnpm db:studio
```

### Docker Compose deployment

```bash
pnpm docker:up    # Build and start
pnpm docker:down  # Stop
```

See [DOCKER.md](./DOCKER.md) for details.

## Workspace Commands

### From the repo root

| Command | Description |
|:---|:---|
| `pnpm dev` | Start all services |
| `pnpm build` | Build all packages |
| `pnpm start` | Start production builds |
| `pnpm lint` | Run ESLint across workspace |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format with Prettier |
| `pnpm format:check` | Check formatting without changes |
| `pnpm typecheck` | TypeScript validation |
| `pnpm test` | Run all test suites |
| `pnpm prepare` | Install Husky Git hooks |

### Pre-PR verification

```bash
pnpm format
pnpm lint:fix
pnpm format:check
pnpm typecheck
pnpm test
```

### API commands (from `apps/api`)

```bash
pnpm dev              # Start API server
pnpm build            # Compile TypeScript
pnpm test             # Run API tests
pnpm docs:check       # Validate OpenAPI spec
pnpm db:generate      # Generate Drizzle migration
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
```

### Frontend commands (from `apps/frontend`)

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run Karma tests (ChromeHeadless)
pnpm lint             # TypeScript compile check
```

## Environment Variables

### API environment

| Variable | Default | Purpose |
|:---|:---|:---|
| `DATABASE_URL` | `./data/yotara.db` | SQLite file path |
| `APP_BASE_URL` | `http://localhost:3000` | Base URL for Better Auth |
| `TRUSTED_ORIGINS` | `http://localhost:4200,...` | Allowed auth origins |
| `CORS_ORIGIN` | inherits trusted origins | Extra CORS origins |
| `PORT` | `3000` | API port |
| `HOST` | `0.0.0.0` | API bind host |
| `NODE_ENV` | unset | Enables secure cookies in production |
| `BETTER_AUTH_SECRET` | required | Session signing secret |

Notes:
- Better Auth secure cookies are enabled when `NODE_ENV=production` or `APP_BASE_URL` starts with `https://`.
- The API bootstraps the SQLite schema on startup.
- If frontend and API run on different origins, update `APP_BASE_URL`, `TRUSTED_ORIGINS`, and `CORS_ORIGIN` together.

### Frontend environment

| Environment | API Base URL | File |
|:---|:---|:---|
| Development | `http://localhost:3000` | `apps/frontend/src/environments/environment.ts` |
| Production | `/api` | `apps/frontend/src/environments/environment.prod.ts` |

The production setting assumes the frontend and API are served behind the same origin with `/api` routed to the backend.

## Project Structure

```text
.
├── apps/
│   ├── api/                    Fastify + Drizzle backend
│   │   ├── src/
│   │   │   ├── db/             Database client and schema
│   │   │   ├── docs/           OpenAPI spec and validation
│   │   │   ├── lib/            Auth origins, CORS utilities
│   │   │   ├── plugins/        Fastify plugins (CORS, auth)
│   │   │   ├── routes/         API routes (tasks, labels, user, etc.)
│   │   │   ├── services/       Business logic (tasks, labels, projects)
│   │   │   └── server.ts       Entry point
│   │   ├── drizzle/            Generated migrations
│   │   └── drizzle.config.ts
│   └── frontend/               Angular 21 application
│       └── src/app/
│           ├── core/           Guards, interceptors, services
│           ├── features/       Feature modules (auth, error, onboarding, personal, shell, tasks)
│           └── shared/         Shared components and pipes
├── packages/
│   └── shared/                 Domain types, DTOs, auth client
├── docs/
│   └── ARCHITECTURE.md         Technical roadmap and anti-patterns
├── scripts/                    Release automation
└── testing.md                  Testing guide
```

## API Examples

All task endpoints require authentication via session cookie.

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

### Delete a task

```bash
curl -X DELETE http://localhost:3000/tasks/TASK_ID \
  -b "better-auth.session_token=YOUR_TOKEN"
```

### Assign a label to a task

```bash
curl -X POST http://localhost:3000/tasks/TASK_ID/labels/LABEL_ID \
  -b "better-auth.session_token=YOUR_TOKEN"
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

## Database and Drizzle

The database client lives in [`apps/api/src/db/client.ts`](./apps/api/src/db/client.ts).

Behavior:
- Creates the SQLite directory if it does not exist
- Bootstraps required tables if the database is new
- Enables SQLite WAL mode

Drizzle artifacts:
- [`apps/api/drizzle`](./apps/api/drizzle) — generated migrations
- [`apps/api/drizzle.config.ts`](./apps/api/drizzle.config.ts) — Drizzle config

Useful commands:

```bash
pnpm --filter @yotara/api db:generate
pnpm --filter @yotara/api db:push
pnpm --filter @yotara/api db:studio
```

## Testing

See [`testing.md`](./testing.md) for the full guide.

| Suite | Framework | Location |
|:---|:---|:---|
| API | Node test runner + tsx | `apps/api/src/**/*.test.ts` |
| Frontend | Karma + Jasmine | `apps/frontend/src/app/**/*.spec.ts` |

Quick verification:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

## Code Quality

- ESLint flat config: [`eslint.config.mjs`](./eslint.config.mjs)
- Prettier: [`.prettierrc.json`](./.prettierrc.json)
- Husky pre-commit: runs lint-staged (eslint --fix + prettier --write)
- Root lint budget: `--max-warnings 10`

## Local Development Notes

- Frontend binds to `0.0.0.0:4200`
- API binds to `0.0.0.0:3000`
- Auth uses session cookies and browser-based flows
- Onboarding stores workspace type in localStorage
- Drizzle Studio is for local inspection only
- If frontend and API run on different origins, align environment values and trusted origins
