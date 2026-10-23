# Inbox Quick Capture: Three-Phase Delivery Plan

> Companion to [`2026-10-22-inbox-quick-capture.md`](./2026-10-22-inbox-quick-capture.md), which remains the source of truth for product behavior and acceptance criteria.
>
> Suggested branch: `feat/inbox-quick-capture`

## Delivery approach

Deliver in three sequential phases. Each phase should leave the application
buildable and its own tests passing before the next phase begins. Keep product
semantics and edge cases in the source plan; this document assigns implementation
boundaries and completion gates.

## Phase 1 — Data and API foundation

**Goal:** Make unfiled tasks a valid, stable API/data state without breaking
legacy accounts.

**Work**

- Accept omitted and `null` `projectId` on task creation; preserve update-null
  behavior across shared DTOs, request schemas, routes, and services.
- Remove default-project assignment from task create/update while retaining
  parent-project inheritance for subtasks.
- Add `project_id IS NULL` to Inbox filtering, retaining incomplete and undated
  conditions and existing deleted-task/subtask rules.
- Add `retired_at` to schema/bootstrap handling and implement the transactional,
  idempotent legacy Inbox retirement migration.
- Add retired-aware write lookup: an owned retired project ID becomes `null`,
  while a missing or unowned ID remains a 404; keep retired projects hidden
  from listing and detail routes.
- Remove Inbox from starter defaults and gate personal starter seeding on the
  onboarding-incomplete to onboarding-complete transition. Repeated profile
  saves must not recreate removed/renamed defaults.
- Document and test the exact-seed-signature collision policy from the source
  plan.

**Completion gate**

- API tests cover omitted/null project IDs on create, update behavior, Inbox
  query combinations, retired IDs on create/update, 404 ownership behavior,
  retired listing/detail behavior, migration idempotence/transaction safety,
  collision and renamed-project cases, and onboarding transition/repeat-save
  behavior including all seven non-Inbox defaults.
- Relevant API and migration suites pass before phase 2 starts.

## Phase 2 — Capture and task presentation

**Goal:** Make the frontend accurately represent unfiled tasks and preserve
explicit project choices end to end.

**Work**

- Remove default-project assumptions from task lists, capture, workspace, and
  task modal flows.
- Add an explicit “No project” choice and default capture to it; reset capture
  selection after successful creation.
- Distinguish omitted contextual project from explicit “No project” selection
  through picker state, modal output, workspace save, and API payload. Explicit
  `null` must override a contextual project; editing initializes only from the
  task’s current project.
- Ensure project selection remains optional and captured tasks use the intended
  status/date/project combination.
- Update task-card and modal status presentation so filed tasks are never
  labeled “Inbox”; present undated filed tasks as “Unscheduled” and dated tasks
  from their date state.
- Update creation notifications to name the chosen project or Inbox destination
  appropriately; rely on the API to hide retired projects from pickers.

**Completion gate**

- Frontend tests cover unfiled capture and picker reset, editing without
  accidental assignment, explicit No project from project context, project
  capture, and filed-vs-Inbox status/notification presentation.
- Relevant frontend tests and type checks pass before phase 3 starts.

## Phase 3 — Inbox movement feedback and integration

**Goal:** Help people follow tasks as they leave Inbox without duplicating
notifications or introducing stale actions.

**Work**

- Extend the status toast with an optional accessible action and a 3-second
  lifetime; support hover/focus pause and resume.
- Make timer ownership cancellable and clean up on expiry, replacement, manual
  dismissal, action dismissal, and component teardown.
- Show movement toasts only for user-initiated changes from the visible Inbox,
  respecting `actionNotifications` and avoiding notifications for delete,
  background refreshes, and actions initiated elsewhere.
- Coordinate completion with the existing completion notice so one action
  produces one destination-aware toast. Replace an earlier toast for the same
  task without stacking or retaining stale callbacks.
- On View, dismiss and complete the leave animation before navigating to the
  destination. Respect reduced-motion preferences while preserving state and
  timer behavior.
- Run end-to-end and regression coverage across capture, file, schedule,
  complete, navigation, preferences, duplicate suppression, and project
  migration/seeding behavior.

**Completion gate**

- Frontend tests cover exact destination copy and navigation, simultaneous file
  and schedule destinations, 3-second lifetime, hover/focus pause/resume, timer
  cleanup, replacement/stale-action prevention, leave-animation ordering,
  completion-toast deduplication, source-view gating, and reduced motion.
- API, frontend, migration, and e2e suites pass; verify the source plan’s full
  acceptance criteria.

## Cross-phase rule

Do not start a later phase while the prior phase’s completion gate is failing.
If implementation uncovers a product behavior not specified in the source plan,
update that source plan first and keep this document focused on phase boundaries
and gates.
