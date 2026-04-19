# Frontend Refactor TODO

## Shared UI and Generic Components

- [x] Build a generic modal primitive in `shared/ui/modal` with:
  - [x] Inputs: `open`, `title`, `size`, `closeOnBackdrop`, `closeOnEsc`
  - [x] Outputs: `close`, `afterOpen`
  - [x] Content projection support for custom form/content sections
  - [x] Accessibility baseline: `role="dialog"`, `aria-modal`, labelled title
  - [x] Focus management and return focus to trigger
  - [x] Body scroll lock while modal is open
  - [x] Keyboard support (Esc + tab cycle)

- [x] Build a reusable `ConfirmDialog` on top of the generic modal:
  - [x] Inputs: `title`, `description`, `confirmLabel`, `cancelLabel`, `loading`, `danger`
  - [x] Outputs: `confirm`, `cancel`, `close`
  - [x] Migrate `logout-confirm-modal` to use the shared primitive

- [x] Upgrade and standardize `PageHeader`:
  - [x] Support subtitle and optional action slot/button area
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

- [ ] Modernize Angular component APIs to match the project guidance:
  - [ ] Replace decorator-based `@Input()` / `@Output()` usage with `input()` / `output()` where practical
  - [ ] Add `ChangeDetectionStrategy.OnPush` to components that still use default change detection
  - [ ] Remove redundant explicit `standalone: true` declarations as components are updated
  - [ ] Prioritize leaf UI components like `page-header`, `task-list`, `modal`, `confirm-dialog`, `logout-confirm-modal`, and `personal-task-card`

- [ ] Split `TaskService` responsibilities into smaller units:
  - [ ] API client layer (`task-api.client.ts`)
  - [ ] View-model selectors/computed logic (`task-selectors.ts`)
  - [ ] Date utilities (`task-date.utils.ts`)

- [ ] Split `ProjectService` similarly where useful:
  - [ ] API-only calls separated from view state

- [ ] Extract shared shell chrome between `auth-shell` and `personal-shell`:
  - [ ] Reuse the mobile menu, profile menu, and logout/logout-confirm flows
  - [ ] Move shared account actions into a focused component

- [ ] Migrate `personal-project-modal` to the shared modal primitive so modal behavior stays consistent across the app.

- [ ] Replace browser-only `localStorage` and `window.open` usage in onboarding with an injected, platform-safe helper.

- [ ] Centralize task date parsing and formatting in shared utilities and reuse them from cards and pages instead of ad hoc `new Date(...)` calls.

- [ ] Remove remaining `any` escapes from auth/login error handling by switching to `unknown` plus type guards.

- [x] Reduce large inline templates/styles:
  - [x] Move large inline template/CSS from page components to separate `.html` + `.css` files
  - [x] Start with `inbox-page.component.ts` and similar high-size components
  - [x] Inline template/style components to split:
    - [x] `apps/frontend/src/app/features/auth/login.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/components/personal-project-modal.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts`
    - [x] `apps/frontend/src/app/features/personal/components/personal-task-modal.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/components/personal-task-workspace.component.ts`
    - [x] `apps/frontend/src/app/features/personal/pages/inbox-page.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/pages/labels-page.component.ts`
    - [x] `apps/frontend/src/app/features/personal/pages/project-detail-page.component.ts`
    - [x] `apps/frontend/src/app/features/personal/pages/projects-page.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/pages/today-page.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/pages/upcoming-page.component.ts`
    - [ ] `apps/frontend/src/app/features/personal/shell/personal-shell.component.ts`
    - [ ] `apps/frontend/src/app/features/shell/auth-shell.component.ts`
    - [x] `apps/frontend/src/app/shared/components/page-header/page-header.component.ts`
    - [ ] `apps/frontend/src/app/shared/ui/logout-confirm-modal/logout-confirm-modal.component.ts`

## Backend and Cross-Cutting Improvements

- [ ] Centralize backend auth user extraction:
  - [ ] Move duplicated `requireUserId` into shared request utility/plugin
  - [ ] Reuse in `tasks` and `projects` routes

- [ ] Improve frontend error handling strategy:
  - [ ] Replace scattered `console.error` with a shared logging/error service
  - [ ] Map known API errors to consistent user-facing messages

- [ ] Replace remaining `@HostBinding` usage in `apps/frontend/src/app/shared/directives/empty-state.directive.ts` with host metadata bindings to match the Angular guidance.

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
