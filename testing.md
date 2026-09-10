# Testing Guide

This document covers the testing strategies, patterns, and commands used across the Yotara monorepo.

## Quick Reference

| Command | Description |
|:---|:---|
| `pnpm test` | Run all test suites |
| `pnpm --filter @yotara/api test` | API tests only |
| `pnpm --filter @yotara/frontend test` | Frontend unit tests only |
| `pnpm --filter @yotara/frontend e2e` | Playwright E2E tests (servers must be running) |

## 1. Backend Testing (`apps/api`)

The backend uses the **Node.js native test runner** with `tsx` for TypeScript execution.

### Location

```
apps/api/src/**/*.test.ts
```

### Test Isolation

Every test file creates a fresh SQLite database in the system temp directory. This ensures complete isolation between tests.

```typescript
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dbFile = join(tmpdir(), `yotara-test-${randomUUID()}.db`);
process.env['DATABASE_URL'] = dbFile;
```

### Authentication Setup

Tests create authenticated sessions by calling Better Auth directly:

```typescript
async function signUpAndGetCookie(email: string) {
  const { auth } = await import('../lib/auth.js');
  const response = await auth.api.signUpEmail({
    body: {
      email,
      password: 'Password123!',
      name: email.split('@')[0],
    },
    asResponse: true,
  });

  const cookie = response.headers.get('set-cookie');
  return cookie;
}
```

### Making HTTP Requests

Use `app.inject()` for HTTP testing without starting a real server:

```typescript
const response = await ctx.app.inject({
  method: 'POST',
  url: '/tasks',
  headers: { cookie: userCookie },
  payload: { title: 'Test task', status: 'inbox' },
});

assert.equal(response.statusCode, 201);
```

### Cleanup

Always clean up in a `finally` block:

```typescript
test('example', async () => {
  const ctx = await createAuthedApp();
  try {
    // test logic
  } finally {
    await ctx.cleanup();
  }
});
```

The cleanup function:
1. Closes the Fastify server
2. Deletes the temporary SQLite file
3. Removes environment variables

### Running Backend Tests

```bash
pnpm --filter @yotara/api test
```

## 2. Frontend Testing (`apps/frontend`)

The frontend uses **Karma + Jasmine** via Angular CLI.

### Location

```
apps/frontend/src/app/**/*.spec.ts
```

### Test Setup

Angular tests use `TestBed.configureTestingModule()`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { PersonalShellComponent } from './personal-shell.component';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';

// Define stub components for routed child routes
@Component({ template: '', standalone: true })
class InboxStubComponent {}

describe('PersonalShellComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PersonalShellComponent],
      providers: [
        provideRouter([{ path: 'tasks', component: InboxStubComponent }]),
        {
          provide: AuthStateService,
          useValue: {
            user: () => ({
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test User',
              onboardingCompleted: true,
              workspaceMode: 'personal',
            }),
          },
        },
        PreferencesStore,
      ],
    }).compileComponents();
  });
});
```

### Mocking Services

Always mock external services. Common patterns:

**AuthStateService mock:**

```typescript
{
  provide: AuthStateService,
  useValue: {
    user: () => ({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      onboardingCompleted: true,
      workspaceMode: 'personal',
    }),
  },
}
```

**HttpClient mock:**

```typescript
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

providers: [
  provideHttpClient(),
  provideHttpClientTesting(),
]
```

### Testing Signals

Angular signals require triggering change detection:

```typescript
it('shows tip popup after login', fakeAsync(() => {
  const fixture = TestBed.createComponent(PersonalShellComponent);
  fixture.detectChanges();

  tick(100);
  fixture.detectChanges();

  expect(fixture.componentInstance.showTip()).toBeTrue();
}));
```

### Querying Elements

Use `By.css()` and `DebugElement`:

```typescript
import { By } from '@angular/platform-browser';

// Query single element
const title = fixture.debugElement.query(By.css('.page-title')).nativeElement;
expect(title.textContent.trim()).toBe('Tasks');

// Query multiple elements
const navItems = fixture.debugElement
  .queryAll(By.css('.nav-item'))
  .map(el => el.nativeElement.textContent.trim());

expect(navItems).toEqual(['Inbox', 'Today', 'Upcoming']);
```

### Running Frontend Tests

```bash
pnpm --filter @yotara/frontend test
```

Tests run once in ChromeHeadless. No watch mode by default.

## 3. Shared Package Testing (`packages/shared`)

The shared package contains domain types and DTOs. Currently minimal testing is needed.

**Recommendation:** Add `vitest` or `node:test` if complex logic is added to the shared package.

## 4. End-to-End Testing (`apps/frontend/e2e`)

Cross-service browser tests use **Playwright**. They exercise a real frontend
against a real API, so they catch the session-cookie, redirect, and
request/response problems that unit tests structurally cannot.

### Running E2E tests

```bash
pnpm --filter @yotara/frontend e2e          # Run the full suite
pnpm --filter @yotara/frontend e2e:ui       # Interactive UI mode
pnpm --filter @yotara/frontend e2e:debug    # Playwright inspector
pnpm --filter @yotara/frontend e2e:codegen  # Record a new spec
```

The frontend (`:4200`) and API (`:3000`) must already be running. Override the
targets with `E2E_BASE_URL` and `E2E_API_URL`.

### Projects

`playwright.config.ts` defines five projects, each with its own storage state so
authenticated and signed-out journeys cannot contaminate each other:

| Project | Specs | Session |
|:---|:---|:---|
| `login` | `e2e/specs/login/**` | signed out |
| `e2e` | `e2e/specs/authenticated/**` except the two matched below | shared signed-in state |
| `onboarding` | `onboarding.spec.ts` | signed out |
| `mobile` | `task-modal.mobile.spec.ts` | signed in, Pixel 7 device profile |
| `logout` | `zzz-logout.spec.ts` | signed out; runs last because it ends the session |

### How setup works

`e2e/global-setup.ts` runs once before the suite. It waits for both servers,
creates a fresh account, walks the sign-up and onboarding flow, saves the
session to `e2e/.auth/user.json`, and verifies that state against `GET /me`.
Credentials are written to `e2e/.auth/credentials.json` for specs that need to
sign in themselves.

When email verification is enabled, setup reads the verification link from the
API log, so `E2E_API_LOG` must point at that file.

`e2e/fixtures/auth.ts` exports the shared `test`/`expect` pair plus helpers:
`dismissTip`, `getE2ECredentials`, `getRuntimeConfig`, and
`assertAuthenticatedPage` (which fails loudly if a spec is unexpectedly
redirected to `/login`).

### Conventions

- Keep specs order-independent. The `logout` project exists precisely because it
  cannot be.
- Assert on user-visible behaviour, not component internals.
- Add narrow-viewport cases to the `mobile` project rather than to the desktop
  project, so responsive regressions stay visible.

## 5. CI/CD Integration

`.github/workflows/ci.yml` fans out into seven jobs:

| Job | What it runs |
|:---|:---|
| `static-analysis` | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm audit --audit-level=high` |
| `test` | `pnpm test` — the API and frontend suites |
| `coverage` | `pnpm test:coverage`, uploaded to Codecov |
| `build` | `pnpm build` across the workspace |
| `e2e` | The Playwright suite against a live API and frontend |
| `docker-and-smoke` | Builds both images, then `pnpm smoke:docker` against the Compose stack |
| `docker-api-native` | Builds the API image natively for amd64 and arm64, then `pnpm smoke:docker:api` |

Two checks are advisory and will not fail a build: the `coverage` job
(`continue-on-error: true`, `fail_ci_if_error: false`) and the `pnpm audit` step
inside `static-analysis` (`continue-on-error: true`).

**Note the `paths-ignore` list.** Changes limited to `**.md`, `docs/**`, or
`screenshots/**` skip `ci.yml` entirely, so a docs-only pull request runs none of
the jobs above. One separate workflow covers that gap: `docs-consistency.yml`
checks that every variable in `apps/api/.env.example` appears in
[docs/CONFIGURATION.md](./docs/CONFIGURATION.md). Run it locally with
`pnpm docs:check:env`.

Other workflows: `release.yml` (see [docs/RELEASING.md](./docs/RELEASING.md)),
`codeql.yml`, `secret-scan.yml`, and `pr-agent.yml`.

## 6. Writing Good Tests

### Principles

- **Isolation:** Each test should be independent. No shared state between tests.
- **Fast:** Tests should complete quickly. Avoid real network calls.
- **Deterministic:** Same input should always produce the same output.
- **Clear:** Test names should describe the expected behavior.

### Naming Convention

```typescript
describe('TaskService', () => {
  describe('createTask', () => {
    it('creates a task with default values', () => { ... });
    it('rejects empty titles', () => { ... });
    it('assigns to the correct user', () => { ... });
  });
});
```

### AAA Pattern

```typescript
it('calculates task counts', () => {
  // Arrange
  const tasks = [
    { completed: true },
    { completed: false },
    { completed: false },
  ];

  // Act
  const counts = calculateCounts(tasks);

  // Assert
  expect(counts.total).toBe(3);
  expect(counts.completed).toBe(1);
  expect(counts.open).toBe(2);
});
```

### Common Anti-Patterns

| Anti-Pattern | Better Approach |
|:---|:---|
| Testing implementation details | Test public API behavior |
| Shared mutable state between tests | Create fresh data per test |
| `setTimeout` in tests | Use `fakeAsync` + `tick` |
| Hardcoded URLs | Use environment variables |
| Catching and ignoring errors | Assert specific error cases |

## 7. Debugging Tests

### Frontend

```bash
# Run with browser visible (not headless)
pnpm --filter @yotara/frontend test -- --watch --browsers=Chrome
```

### Backend

```bash
# Run with more verbose output
node --test --import tsx apps/api/src/routes/tasks.test.ts
```

### Common Issues

| Issue | Solution |
|:---|:---|
| ChromeHeadless not found | Install Chrome or use `CHROME_BIN` env var |
| Test timeout | Increase timeout or check for infinite loops |
| Flaky tests | Ensure proper cleanup and isolation |
| Missing mocks | Mock all external dependencies |
