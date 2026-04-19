# Fastify API TODO

## Route Structure and Reuse

- [ ] Centralize authenticated user lookup into a reusable Fastify helper or hook:
  - [ ] Replace duplicated `requireUserId` logic in `tasks.ts`, `projects.ts`, and `server.ts`
  - [ ] Prefer a shared `preHandler`/decorator so protected routes do not reimplement session fetches

- [ ] Split `server.ts` into smaller bootstrap modules:
  - [ ] Move auth proxying for `/auth/*` into a dedicated plugin or route module
  - [ ] Move `/me` handling into an auth/profile route file
  - [ ] Keep `buildApp()` focused on registration and startup wiring

- [ ] Extract task and project persistence logic out of route files:
  - [ ] Move query/build/normalize helpers into service or repository modules
  - [ ] Keep handlers thin and route-specific

- [ ] Add a shared request-context or response helper for the repeated `Unauthorized` / `Not found` / `Failed to ...` responses.

## Schema and Contract Hygiene

- [ ] Reconcile OpenAPI schemas with actual runtime payloads:
  - [ ] Align the `User` schema with `toPublicUser()` output
  - [ ] Remove stale or unused fields from schemas when the API does not return them
  - [ ] Keep route response examples in sync with live objects

- [ ] Tighten task and project DTO validation:
  - [ ] Ensure route schemas and normalization logic agree on required vs optional fields
  - [ ] Prefer schema-driven validation over manual `if (!payload.title)` style checks where possible

- [ ] Revisit timestamp storage consistency in SQLite:
  - [ ] Standardize whether each table stores timestamps as ISO strings or epoch values
  - [ ] Make schema and serialization choices consistent across `users`, `sessions`, `projects`, and `tasks`

## Query and Data Access

- [ ] Review task list pagination and retrieval strategy:
  - [ ] Add cursor-based or incremental loading if task counts continue to grow
  - [ ] Avoid repeating broad `SELECT *` queries when only partial task data is needed

- [ ] Reduce repeated task/project ownership checks:
  - [ ] Reuse a common ownership lookup for `GET`, `PATCH`, `DELETE`, and nested project task routes
  - [ ] Consider fetching the row once and reusing it for update/delete paths

- [ ] Add a dedicated transactional layer for write flows that touch multiple tables or require stronger consistency.

## Auth and CORS Hardening

- [ ] Simplify the auth bridge in `server.ts`:
  - [ ] Hide the manual Request/Response translation behind a tested adapter
  - [ ] Make cookie forwarding and response header copying explicit and reusable

- [ ] Review CORS handling for duplication and drift:
  - [ ] Confirm the custom `applyCorsHeaders` hook and the `@fastify/cors` plugin stay aligned
  - [ ] Keep the allowed-origin source of truth in one place

- [ ] Add production hardening for the public API:
  - [ ] Rate limiting
  - [ ] Security headers
  - [ ] Request size limits where appropriate
  - [ ] Better request/response logging for auth and write endpoints

## Error Handling and Observability

- [ ] Replace scattered ad hoc error handling with a centralized Fastify error strategy:
  - [ ] Normalize known API errors into a consistent JSON shape
  - [ ] Map unexpected errors to a safe generic response
  - [ ] Avoid leaking implementation details in route handlers

- [ ] Add structured logging context for request id, user id, route, and status.

## Testing

- [ ] Add tests for the auth bridge and CORS behavior at the plugin boundary, not only end-to-end route tests.

- [ ] Add contract tests for `GET /me` and the OpenAPI examples so schema drift is caught earlier.

- [ ] Add regression tests for the manual auth proxy path and cookie forwarding behavior.

## Product Features

### Recurring Tasks
- [ ] Extend task schema in Drizzle:
  - [ ] Add `recurrence` field: `null | 'daily' | 'weekly' | 'monthly'`
  - [ ] Add `nextOccurrenceDate` field for tracking when next recurrence should be created
  - [ ] Run migration to add columns to existing tasks table
- [ ] Implement recurrence logic:
  - [ ] Create helper to generate next occurrence when task is marked done
  - [ ] Ensure recurrence respects timezone and calendar boundaries
  - [ ] Handle edge case: monthly recurrence on day 31 → Feb mapping
- [ ] Update task API endpoints:
  - [ ] Accept `recurrence` in POST/PATCH payloads
  - [ ] Return `recurrence` and `nextOccurrenceDate` in task responses
- [ ] Optional: Add background job / cron for auto-creating occurrences (if not on-demand)

### Search and Filtering
- [ ] Add full-text search capability:
  - [ ] Add search endpoint: `GET /tasks/search?q=query`
  - [ ] Search across task titles, descriptions
  - [ ] Filter results by project, status, priority, label
  - [ ] Return paginated results with relevance/sort options
- [ ] Add filtering to task list endpoints:
  - [ ] Support query params: `?priority=high&label=work&project=123&status=today`
  - [ ] Compose multiple filters
  - [ ] Validate filter values against allowed enums
- [ ] Update OpenAPI schema to document search and filter params

### Gamification: Lumi Stats Tracking (Backend)
- [ ] Extend user schema to store Lumi preferences:
  - [ ] Add `showLumi` or equivalent boolean field (default: true)
  - [ ] Keep settings lightweight so Lumi can remain optional everywhere
- [ ] Extend user schema to store appearance preferences:
  - [ ] Add a persisted `colorTheme` or equivalent field for theme selection
  - [ ] Keep the theme value compatible with mascot palette matching
- [ ] Create stats/metrics endpoints as needed:
  - [ ] `GET /me/stats` to return completion count, streaks, and momentum values
  - [ ] Compute stats from task completion dates instead of storing separate derived counters
- [ ] Add preference/settings route:
  - [ ] `PATCH /me` to toggle Lumi visibility
  - [ ] `PATCH /me` to update color theme
  - [ ] Return updated preference values in the user/me payload
- [ ] Support frontend state triggers:
  - [ ] Emit or expose task completion events that can drive happy / dance / daily momentum states
  - [ ] Expose enough context for hidden milestone visuals at 30, 90, and 365 days

## Suggested Rollout Order

- [ ] Phase 1: shared auth helper + route cleanup
- [ ] Phase 2: extract route persistence helpers
- [ ] Phase 3: schema and contract alignment
- [ ] Phase 4: CORS/auth bridge hardening
- [ ] Phase 5: observability and error normalization
- [ ] Phase 6: pagination and write-path consistency
- [ ] Phase 7: expanded API tests and production hardening
