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

- [x] Create a generic `SectionHeader` component:
  - [x] Inputs: `title`, `count`, `accent/tone`
  - [x] Replace repeated `section-heading` markup

- [x] Create a generic `EmptyState` component:
  - [x] Inputs: `title`, `description`, optional icon/illustration
  - [x] Optional CTA slot/button
  - [x] Replace repeated `empty-state` blocks in inbox/today/upcoming/project pages

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

- [ ] Add personal-mode product design polish tasks:
  - [ ] Make Inbox quick capture the primary hero interaction
  - [ ] Use progressive disclosure in the task modal so simple tasks stay lightweight
  - [ ] Clarify the mental model for done vs archived vs simple mode vs bucket
  - [ ] Strengthen empty states for Inbox, Today, Upcoming, Projects, Labels, Search, and Archive
  - [ ] Reduce visual weight of secondary shell controls so capture and navigation stay dominant
  - [ ] Make the personal/team mode switch communicate intent more clearly
  - [ ] Improve search-result confidence with better surfaced match context
  - [ ] Tighten spacing, elevation, and visual hierarchy so the shell feels calmer and less dashboard-like
  - [x] Keep preferences minimal and useful: theme, density, and quick-add behavior
  - [ ] Treat keyboard support, focus states, contrast, and touch targets as part of the final product finish

- [ ] Keep the frontend team-mode assumptions aligned with the future Postgres-backed tenant model:
  - [ ] Prefer workspace-scoped routes, state, and labels over user-only thinking once team mode expands
  - [ ] Make sure workspace switching, invites, assignment, comments, and board views can all survive concurrent multi-user usage
  - [ ] Avoid baking in any UI copy or flow that assumes team mode is just a visual toggle

## Natural Language Processing (NLP) Task Entry

- [ ] Add `chrono-node` to frontend dependencies for date parsing
- [ ] Refactor `parseTaskCommand` utility:
  - [ ] Integrate `chrono-node` for natural language date extraction
  - [ ] Align syntax with Todoist standards: `#` for projects, `@` for labels, `!` for priorities
  - [ ] Support project lookup by name during parsing
- [ ] Enhance `TaskDetailModal` with NLP features:
  - [ ] Real-time parsing feedback (inline highlighting or preview chips)
  - [ ] Auto-switch "Simple Mode" off when a date is detected
  - [ ] Pre-populate project and labels from parsed title
- [ ] Add unit tests for complex mixed NLP commands

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

- [x] Improve frontend error handling strategy:
  - [x] Replace scattered `console.error` with a shared logging/error service
  - [x] Map known API errors to consistent user-facing messages
  - [x] Add global status/loading bar and toast notifications

- [ ] Replace remaining `@HostBinding` usage in `apps/frontend/src/app/shared/directives/empty-state.directive.ts` with host metadata bindings to match the Angular guidance.

- [x] Improve task list scalability:
  - [x] Avoid fixed `pageSize=100` fetch strategy
  - [x] Move to paged/cursor loading and server-driven sorting

- [ ] Add an archive flow for completed tasks:
  - [ ] Keep `done` as completion state and add `archived` as the final inactive state
  - [ ] Move completed tasks out of active views once archived
  - [ ] Add UI actions for archiving and viewing archived tasks later

- [ ] Add shell and navigation polish:
  - [ ] Rebalance sidebar and topbar hierarchy so core actions stay primary
  - [ ] Keep utility actions visually quieter than Inbox, Today, Upcoming, and Quick Add
  - [ ] Standardize empty/loading/error states across all personal-mode pages
  - [ ] Make modal, menu, and confirmation patterns feel visually and behaviorally consistent
  - [ ] Review mobile drawer, search, and preferences behavior for the personal-mode finish pass

## OSS and Delivery Hardening

- [ ] Add GitHub Actions workflows in `.github/workflows`:
  - [ ] PR checks: install, lint, typecheck, test
  - [ ] Optional docs check (`docs:check`)
  - [ ] Optional matrix by package where useful

- [ ] Add coverage reporting and minimum threshold gates
- [ ] Add Dependabot for automated dependency updates
- [ ] Add security scanning (CodeQL + Snyk) to CI

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
- [ ] Phase 7: Postgres-ready workspace/team UX assumptions
- [ ] Phase 8: CI, coverage gates, production hardening
