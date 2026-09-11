# Frontend (`@yotara/frontend`)

The Angular 22 application. Standalone components, signals, and lazy routes.

For setup, use [docs/INSTALL.md](../../docs/INSTALL.md) from the repository root — this app expects the API to be running alongside it.

## Layout

```text
src/
  app/
    core/         Cross-cutting: guards, interceptors, services, auth state
    features/     Feature areas
      auth/         Login, verification, password reset
      error/        404 page
      onboarding/   Workspace mode picker
      personal/     Personal shell, pages, task components
      shell/        Team-mode shell
      tasks/        Team dashboard
    shared/       Reusable building blocks
      components/   Composed UI (task card, empty state, page header, ...)
      ui/           Primitives (modal, date picker, markdown editor, ...)
      pipes/
      utils/
  environments/   Compile-time API base URL per configuration
  styles.css      Theme tokens and global styles
e2e/              Playwright specs, fixtures, and global setup
```

Routes are defined in [`src/app/app.routes.ts`](src/app/app.routes.ts). It is the authoritative route list; [PROJECT_README.md](../../PROJECT_README.md#routes) only summarises the shape.

## Commands

Run these from this directory, or prefix them with `pnpm --filter @yotara/frontend` from the root.

```bash
pnpm dev        # Dev server on http://localhost:4200
pnpm build      # Production build
pnpm test       # Karma unit tests in ChromeHeadless, single run
pnpm e2e        # Playwright E2E (frontend and API must be running)
pnpm lint       # Typecheck + stylelint
```

Playwright also exposes `e2e:ui`, `e2e:debug`, and `e2e:codegen`.

## Conventions

- Use signals for state, `computed()` for derived state, `effect()` for side effects.
- **Do not filter in a `computed()` signal** if the server could filter instead. Add a query param and delete the signal.
- API calls go through a service using `HttpClient` — not raw `fetch`.
- Log errors through `LogService`, not `console.error`.
- Reuse the existing `shared/` primitives rather than building new ones.
- Component tests assert on rendered behaviour and the public API. Avoid `as any` casts on the component instance.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full engineering principles and [testing.md](../../testing.md) for testing patterns.

## Spartan UI

UI primitives under `src/app/shared/ui` use [spartan-ng](https://www.spartan.ng/). Add new components with the Spartan CLI:

```bash
pnpm exec ng g @spartan-ng/cli:ui accordion
```

Theming uses Tailwind CSS v4 variables defined in `src/styles.css`.
