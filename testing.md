# Testing Guide

This document covers the testing strategies, patterns, and commands used across the Yotara monorepo.

## Quick Reference

| Command | Description |
|:---|:---|
| `pnpm test` | Run all test suites |
| `pnpm --filter @yotara/api test` | API tests only |
| `pnpm --filter @yotara/frontend test` | Frontend tests only |

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

## 4. E2E Testing (Recommended)

Not yet implemented. **Playwright** is recommended for cross-service verification.

**Focus areas:**
- User flows: Sign up → Add Task → Mark Complete → Sign Out
- Cross-browser testing
- Visual regression

**Setup:** Should run against a dev-like environment with a known seed database.

## 5. CI/CD Integration

Every Pull Request triggers:

1. `pnpm lint` — ESLint across workspace
2. `pnpm format:check` — Prettier validation
3. `pnpm typecheck` — TypeScript validation
4. `pnpm test` — All test suites

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
