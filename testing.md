# Testing Guide for Yotara

This document outlines the testing strategies and patterns used across the Yotara monorepo.

## 1. Backend Testing (`apps/api`)

The backend uses the **Node.js native test runner** and `tsx` for execution.

### Integration Tests
Integration tests spin up a Fastify instance and use `app.inject()` to simulate HTTP requests against a temporary SQLite database.

- **Location**: `apps/api/src/**/*.test.ts`
- **Execution**: `pnpm run test` (from root or `apps/api`)

#### Patterns & Best Practices.
1. **Dynamic DB Path**: Always use a unique temporary database file for each test run to ensure isolation.
   ```typescript
   const dbFile = join(tmpdir(), `yotara-test-${randomUUID()}.db`);
   process.env['DATABASE_URL'] = dbFile;
   ```
2. **Schema Injection**: Since integration tests use a fresh DB, you must manually inject the schema using `sqlite.exec()` or run migrations before the tests start.
3. **Auth Mocking**: For protected routes, you can set `BETTER_AUTH_SECRET` to a constant value in tests and use the `AuthService` to generate test sessions or bypass auth via a test-only middleware if needed.

---

## 2. Frontend Testing (`apps/frontend`)

The frontend uses **Karma and Jasmine** provided by the Angular CLI.

### Component & Service Tests
- **Location**: `apps/frontend/src/app/**/*.spec.ts`
- **Execution**: `pnpm run test`

#### Patterns & Best Practices
1. **Mocking External Services**: Always mock the `AuthService` (from `@yotara/shared`) and `HttpClient` using `provideHttpClientTesting()`.
2. **Signal Testing**: Since we use Angular Signals, use the `effect()` or `computed()` utilities carefully in tests, ensuring you trigger change detection.

---

## 3. Shared Package Testing (`packages/shared`)

Testing in the shared package should focus on pure logic, data transformations, and type validation.

- **Recommendation**: Add `vitest` or `node:test` to `packages/shared` if complex logic is added to the domain types.

---

## 4. E2E Testing (Recommended)

While not yet implemented, **Playwright** is recommended for cross-service verification.

- **Focus**: User flows (Sign up -> Add Task -> Mark Complete -> Sign Out).
- **Setup**: Should run against a dev-like environment with a known seed database.

---

## 5. CI/CD Integration

Every Pull Request should trigger:
1. `pnpm typecheck` (Ensures cross-package type safety).
2. `pnpm lint` (Ensures code style consistency).
3. `pnpm -r test` (Runs all test suites).
