# Contributing

## One-command setup

```bash
git clone https://github.com/apauldev/Yotara.git
cd Yotara
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm build
pnpm dev
```

This boots the API (`:3000`), the frontend (`:4200`), and Drizzle Studio for the local SQLite DB.

## Where to find things

```
apps/
  api/                     Fastify + Drizzle backend
    src/routes/            HTTP handlers (thin — delegate to services)
    src/services/          Business logic, DB access
    src/plugins/           Fastify plugins (auth-bridge, auth-required, cors)
    src/db/                Drizzle schema and migrations
    src/docs/openapi.ts    Shared OpenAPI schema helpers
  frontend/                Angular 21 frontend
    src/app/core/          Cross-cutting services, guards, interceptors
    src/app/features/      Feature modules (auth, personal, team, onboarding)
    src/app/shared/        Reusable UI primitives, utils, pipes
packages/
  shared/                  Domain types, DTOs, shared client code
docs/
  ARCHITECTURE.md          Architecture decisions, constraints, known risks
  CONTRIBUTING.md          ← you are here
```

## How to run tests

- Frontend: `pnpm --filter @yotara/frontend test` (or `pnpm test` at the root)
- Backend: `pnpm --filter @yotara/api test`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`

## How to add a new API endpoint

1. Add a JSON Schema via the `withJsonResponse()` helper in `apps/api/src/routes/<resource>.ts` and pass it to the route's `{ schema: ... }` config
2. Add the handler — keep it thin, delegate to a service
3. Add or extend the service in `apps/api/src/services/<resource>-service.ts`
4. Add a route-level test in `apps/api/test/routes/<resource>.test.ts`
5. Run `pnpm --filter @yotara/api test` and verify Swagger at `/docs`

## How to add a new frontend feature

1. Decide if it's a page, a feature component, or a shared primitive — put it in the right folder
2. Use signals for state, `computed()` for derived state, `effect()` for side effects
3. If the feature calls the API, add a service method that uses `HttpClient` (not raw `fetch`)
4. Log errors via `LogService`, not `console.error`
5. Use the shared `Modal`, `ConfirmDialog`, `EmptyStateComponent`, and `PageHeader` primitives
6. **The golden rule:** if you find yourself filtering in a `computed()` signal, check if the server can do it first. If yes, add a query param and remove the signal.

## Principles

### Structural

- **The server should do the filtering.** Every computed signal that filters on a field the server could query (`status`, `completed`, `dueDate`) is a sign the API is missing an endpoint. Add the endpoint, remove the signal.
- **Services fetch. Components compose.** A component reading `taskService.todayTasks()` is fine. A component doing its own filtering is a sign the service is missing a view.
- **Shared patterns should be shared.** If you see the same 25 lines in 3 files, extract once.
- **One source of truth for types and plans.** The `shared` package owns domain types. Architecture decisions live in `docs/ARCHITECTURE.md`. If a finding doesn't live in either place, it gets lost.

### Runtime

- **Errors at the boundary they occur.** If a service can produce a validation error, return a typed error (or a result type) — never `throw new Error('string')` and hope the route catches it. A Fastify `setErrorHandler` is the right place to map domain errors to HTTP status codes.
- **Async without timers.** If you find yourself writing `setTimeout(() => doSomething(), N)` to make a UI feel responsive, you have a state-modeling problem. Use an Angular `effect()` or a `Signal` and let the change-detection cycle do the work.
- **Bugs are bugs, not refactors.** A refactor commit should not change behavior. If it does, split the commit. The split is also the paper trail.

### Testing

- **Tests at the boundary you want to keep stable.** Service tests are fast and catch regressions. Component tests verify rendering. Integration tests catch request/response cycle bugs. All three matter.
- **Don't reach into component internals in tests.** Use DOM assertions, public API, or signal inspection. White-box tests (`as any` casts on `componentInstance`) couple the test suite to the implementation and punish future refactors.
- **A "verify" item is a missing test.** If you can't write a test for the filter, you don't know if the filter works. Replace the checklist with a test and delete the checkbox.

### Process

- **Architecture decisions live in `docs/ARCHITECTURE.md`**, and the "Important
  architectural decisions" section there is the tripwire: if a change would
  reverse one of those decisions (e.g. server-side filtering, SQLite first,
  explicit timezone handling, security at the deployment boundary), it needs an
  explicit re-evaluation — a discussion, a written decision, and an update to
  the document — rather than "let me just add it."
- **New work goes in GitHub Issues** and is tracked on the [Yotara Roadmap](https://github.com/users/apauldev/projects/1) Project board.
- **Refactors don't change behavior.** A reviewer should be able to skip a refactor PR without reading it and not break anything. If a refactor is fixing a bug, split the commit.

### Before submitting a PR

- Read the [CLA](https://github.com/apauldev/Yotara/blob/main/CLA.md). By submitting a PR you agree to it.
- Sign-off your commits with `git commit -s` to certify the [Developer Certificate of Origin](https://developercertificate.org/).
