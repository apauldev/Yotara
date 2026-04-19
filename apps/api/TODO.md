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

## Suggested Rollout Order

- [ ] Phase 1: shared auth helper + route cleanup
- [ ] Phase 2: extract route persistence helpers
- [ ] Phase 3: schema and contract alignment
- [ ] Phase 4: CORS/auth bridge hardening
- [ ] Phase 5: observability and error normalization
- [ ] Phase 6: pagination and write-path consistency
- [ ] Phase 7: expanded API tests and production hardening
