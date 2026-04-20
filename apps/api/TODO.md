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

- [ ] Revisit timestamp storage consistency in SQLite:
  - [ ] Standardize whether each table stores timestamps as ISO strings or epoch values
  - [ ] Make schema and serialization choices consistent across `users`, `sessions`, `projects`, and `tasks`

## Query and Data Access

- [ ] Review task list pagination and retrieval strategy:
  - [ ] Add cursor-based or incremental loading if task counts continue to grow
  - [ ] Avoid repeating broad `SELECT *` queries when only partial task data is needed

- [x] Reduce repeated task/project ownership checks:
  - [x] Reuse a common ownership lookup for `GET`, `PATCH`, `DELETE`, and nested project task routes
  - [x] Consider fetching the row once and reusing it for update/delete paths

- [ ] Add a dedicated transactional layer for write flows that touch multiple tables or require stronger consistency.

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
- [ ] Phase 4: CORS/auth bridge hardening
- [ ] Phase 5: observability and error normalization
- [ ] Phase 6: pagination and write-path consistency
- [ ] Phase 7: expanded API tests and production hardening
