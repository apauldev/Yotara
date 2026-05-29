# Fastify API TODO

## Route Structure and Reuse

- [x] Centralize authenticated user lookup into a reusable Fastify helper or hook:
  - [x] Replace duplicated `requireUserId` logic in `tasks.ts`, `projects.ts`, and `server.ts`
  - [x] Prefer a shared `preHandler`/decorator so protected routes do not reimplement session fetches

- [x] Split `server.ts` into smaller bootstrap modules:
  - [x] Move auth proxying for `/auth/*` into a dedicated plugin or route module
  - [x] Move `/me` handling into an auth/profile route file
  - [x] Keep `buildApp()` focused on registration and startup wiring

- [x] Extract task and project persistence logic out of route files:
  - [x] Move query/build/normalize helpers into service or repository modules
  - [x] Keep handlers thin and route-specific

- [x] Add a shared request-context or response helper for the repeated `Unauthorized` / `Not found` / `Failed to ...` responses.

## Schema and Contract Hygiene

- [x] Reconcile OpenAPI schemas with actual runtime payloads:
  - [x] Align the `User` schema with `toPublicUser()` output
  - [x] Remove stale or unused fields from schemas when the API does not return them
  - [x] Keep route response examples in sync with live objects

- [x] Tighten task and project DTO validation:
  - [x] Ensure route schemas and normalization logic agree on required vs optional fields
  - [x] Prefer schema-driven validation over manual `if (!payload.title)` style checks where possible

- [x] Revisit timestamp storage consistency in SQLite:
  - [x] Standardize whether each table stores timestamps as ISO strings or epoch values
  - [x] Make schema and serialization choices consistent across `users`, `sessions`, `projects`, and `tasks`

## Query and Data Access

- [x] Review task list pagination and retrieval strategy:
  - [x] Add cursor-based or incremental loading if task counts continue to grow
  - [x] Avoid repeating broad `SELECT *` queries when only partial task data is needed

- [x] Reduce repeated task/project ownership checks:
  - [x] Reuse a common ownership lookup for `GET`, `PATCH`, `DELETE`, and nested project task routes
  - [x] Consider fetching the row once and reusing it for update/delete paths

- [ ] Add a dedicated transactional layer for write flows (transactions) to ensure atomicity in multi-table operations (e.g., task + labels + subtasks).

- [ ] Optimize task listing performance to resolve N+1 query issues:
  - [ ] Replace per-row label fetching in `listTasksForOwner` with a joined query or batched lookup.
  - [ ] Ensure paginated results remain performant as task and label counts grow.

- [ ] Plan the Postgres migration for team mode before introducing workspaces/memberships:
  - [ ] Treat SQLite as the personal-mode/self-hosted foundation and Postgres as the SaaS/team-mode target
  - [ ] Define the workspace tenant model before adding team tables, invites, comments, and assignments
  - [ ] Make sure every future shared query is scoped by workspace membership, not just user ownership

## Auth and CORS Hardening

- [ ] Simplify the auth bridge plugin:
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

## CI and Security Hardening

- [ ] Add coverage reporting to CI pipeline with minimum threshold gates.
- [ ] Enable Dependabot for automated dependency updates.
- [ ] Add CodeQL security scanning workflow.
- [ ] Add Snyk or alternative vulnerability scanning.
- [ ] Publish Docker images to GHCR or Docker Hub on release tags.

## Code Quality Issues (from review)

- [ ] **P0 — Fix error handling mismatch between services and routes**
  - Services throw `new Error('Parent task not found')` but routes only check for `null` returns
  - Validation errors become opaque 500s instead of 400s with meaningful messages
  - Either add a Fastify `setErrorHandler` that maps known error patterns to HTTP status codes
  - Or switch services to return discriminated result types (`{ ok: true, data } | { ok: false, error }`)

- [ ] **P1 — Remove `as Label` / `as TaskRow` type assertions in route handlers**
  - `createLabelForOwner` returns `typeof labels.$inferSelect | null` but routes do `as Label` which papers over the `null` case
  - Add proper `toLabel()` mapper (like `toTask()` and `toProject()` already exist)

- [ ] **P1 — Consolidate duplicate `loadProjectById` / `getProjectById`**
  - `project-service.ts` has `loadProjectById()`, `project-utils.ts` has `getProjectById()` — same JOIN + GROUP BY query
  - Make project-service the single source of truth

- [ ] **P2 — Add duplicate name check in `createLabelForOwner`**
  - Projects prevent duplicates via `seedDefaultProjectsForOwner` but labels don't

- [ ] **P2 — Move `listTasksForProject` sort from JS to SQL**
  - Currently fetches ALL tasks and sorts in JavaScript, should use `orderBy()` in Drizzle

- [ ] **P2 — Extract shared test helpers**
  - `createAuthedApp()` and `signUpAndGetCookie()` duplicated across every test file (~40 lines each)

- [ ] **P2 — Add request body size limits and rate limiting**
  - No `bodyLimit` config; `export=true` returns up to 10,000 tasks

- [ ] **P3 — Document `simpleMode` semantics**
  - Field appears in DTOs, DB schema, route tests, and frontend — no explanation of what it means

## Error Handling and Observability

- [ ] Replace scattered ad hoc error handling with a centralized Fastify error strategy:
  - [ ] Normalize known API errors into a consistent JSON shape
  - [ ] Map unexpected errors to a safe generic response
  - [ ] Avoid leaking implementation details in route handlers

- [ ] Add structured logging context for request id, user id, route, and status.

## Testing

- [ ] Add tests for the auth bridge and CORS behavior at the plugin boundary, not only end-to-end route tests.

- [x] Add contract tests for `GET /me` and the OpenAPI examples so schema drift is caught earlier.

- [x] Add regression tests for the manual auth proxy path and cookie forwarding behavior.

## Suggested Rollout Order

- [x] Phase 1: shared auth helper + route cleanup
- [x] Phase 2: extract route persistence helpers
- [x] Phase 3: schema and contract alignment
- [ ] Phase 4: Postgres migration plan and tenant model for team mode
- [ ] Phase 5: CORS/auth bridge hardening
- [ ] Phase 6: observability and error normalization
- [ ] Phase 7: pagination and write-path consistency
- [ ] Phase 8: expanded API tests and production hardening
