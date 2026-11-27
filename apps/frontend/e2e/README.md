# E2E suite

Playwright specs live in `specs/`. The suite and its CI job are defined by
`playwright.config.ts` and `.github/workflows/ci.yml`; this file records only
the invariants that are not obvious from those files.

## Running

```bash
# from the repo root, with the API on :3000 and the frontend on :4200
E2E_API_LOG=/path/to/api.log pnpm --filter @yotara/frontend e2e
```

`global-setup.ts` signs up a fresh user, completes onboarding, and writes
`e2e/.auth/user.json`. It needs `E2E_API_LOG` pointing at a live API log: the
email-verification URL is currently read from the console output. `E2E_API_URL`
and `E2E_BASE_URL` override the default local endpoints.

## Projects

`playwright.config.ts` defines five projects, all with `workers: 1`,
`fullyParallel: false`, and no retries:

- `login` — unauthenticated specs in `specs/login/`, empty storage state.
- `e2e` — authenticated specs in `specs/authenticated/`, using the saved
  storage state. Mobile and logout specs are excluded here.
  `onboarding.spec.ts` is not excluded, so it also runs in this project; its
  own `test.use({ storageState: { cookies: [], origins: [] } })` overrides the
  saved state.
- `onboarding` — `onboarding.spec.ts` again, this time as the dedicated
  fresh-user project with empty storage state.
- `mobile` — the three `*.mobile.spec.ts` files under a Pixel 7 device.
- `logout` — `zzz-logout.spec.ts`, the one test that destroys the server
  session. It uses empty storage state and signs in fresh with the seeded
  credentials, so it cannot invalidate the saved cookies used by other specs.
  The project is listed last in `playwright.config.ts`, so it runs after the
  authenticated project.

## Invariants

- Do not add a test that signs out inside the `e2e`, `onboarding`, or `mobile`
  projects. Once the server session is gone, the saved auth state is useless
  for every following spec. Put it in the `logout` project instead.
- Modals expose two role-based matches for the same label (backdrop and close
  button as well as the save button). Use `{ exact: true }` for modal buttons.
- Within a spec file, use `test.describe.configure({ mode: 'serial' })` when
  tests share a single authenticated context.

The current test count and pass/fail state are reported by Playwright and CI;
they are intentionally not duplicated here.
