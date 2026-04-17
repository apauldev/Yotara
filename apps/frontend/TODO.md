# Frontend Refactor TODO

## Shared UI and Generic Components

- [ ] Build a generic modal primitive in `shared/ui/modal` with:
  - [ ] Inputs: `open`, `title`, `size`, `closeOnBackdrop`, `closeOnEsc`
  - [ ] Outputs: `close`, `afterOpen`
  - [ ] Content projection support for custom form/content sections
  - [ ] Accessibility baseline: `role="dialog"`, `aria-modal`, labelled title
  - [ ] Focus management and return focus to trigger
  - [ ] Body scroll lock while modal is open
  - [ ] Keyboard support (Esc + tab cycle)

- [ ] Build a reusable `ConfirmDialog` on top of the generic modal:
  - [ ] Inputs: `title`, `description`, `confirmLabel`, `cancelLabel`, `loading`, `danger`
  - [ ] Outputs: `confirm`, `cancel`, `close`
  - [ ] Migrate `logout-confirm-modal` to use the shared primitive

- [ ] Upgrade and standardize `PageHeader`:
  - [ ] Support subtitle and optional action slot/button area
  - [ ] Replace repeated `page-header` markup in personal pages

- [ ] Create a generic `SectionHeader` component:
  - [ ] Inputs: `title`, `count`, `accent/tone`
  - [ ] Replace repeated `section-heading` markup

- [ ] Create a generic `EmptyState` component:
  - [ ] Inputs: `title`, `description`, optional icon/illustration
  - [ ] Optional CTA slot/button
  - [ ] Replace repeated `empty-state` blocks in inbox/today/upcoming/project pages

- [ ] Create a generic async state helper (`StatusMessage` or `AsyncState`):
  - [ ] Handle loading / error / empty / content states
  - [ ] Reduce repeated conditional templates and `status-copy` blocks

- [ ] Standardize button variants using shared UI button layer:
  - [ ] Primary / secondary / danger / ghost variants
  - [ ] Loading + disabled behavior consistency
  - [ ] Replace ad-hoc button classes in feature components

- [ ] Create card primitives/tokens:
  - [ ] Shared card shell for modal/list/promo use cases
  - [ ] Consistent border radius, shadows, spacing, and background tokens

## Service and Component Refactors

- [ ] Split `TaskService` responsibilities into smaller units:
  - [ ] API client layer (`task-api.client.ts`)
  - [ ] View-model selectors/computed logic (`task-selectors.ts`)
  - [ ] Date utilities (`task-date.utils.ts`)

- [ ] Split `ProjectService` similarly where useful:
  - [ ] API-only calls separated from view state

- [ ] Reduce large inline templates/styles:
  - [ ] Move large inline template/CSS from page components to separate `.html` + `.css` files
  - [ ] Start with `inbox-page.component.ts` and similar high-size components

## Backend and Cross-Cutting Improvements

- [ ] Centralize backend auth user extraction:
  - [ ] Move duplicated `requireUserId` into shared request utility/plugin
  - [ ] Reuse in `tasks` and `projects` routes

- [ ] Improve frontend error handling strategy:
  - [ ] Replace scattered `console.error` with a shared logging/error service
  - [ ] Map known API errors to consistent user-facing messages

- [ ] Improve task list scalability:
  - [ ] Avoid fixed `pageSize=100` fetch strategy
  - [ ] Move to paged/cursor loading and server-driven sorting

- [ ] Add an archive flow for completed tasks:
  - [ ] Keep `done` as completion state and add `archived` as the final inactive state
  - [ ] Move completed tasks out of active views once archived
  - [ ] Add UI actions for archiving and viewing archived tasks later

## OSS and Delivery Hardening

- [ ] Add GitHub Actions workflows in `.github/workflows`:
  - [ ] PR checks: install, lint, typecheck, test
  - [ ] Optional docs check (`docs:check`)
  - [ ] Optional matrix by package where useful

- [ ] Add coverage reporting and minimum threshold gates

- [ ] Add production hardening for API deployment:
  - [ ] Rate limiting
  - [ ] Security headers
  - [ ] Review and tighten CORS defaults for auth routes

## Suggested Rollout Order

- [ ] Phase 1: `Modal` + `ConfirmDialog`
- [ ] Phase 2: shared `Button` variants
- [ ] Phase 3: `PageHeader` + `SectionHeader`
- [ ] Phase 4: `EmptyState` + `AsyncState`
- [ ] Phase 5: Card primitives
- [ ] Phase 6: service/component decomposition and backend/auth cleanup
- [ ] Phase 7: CI, coverage gates, production hardening
