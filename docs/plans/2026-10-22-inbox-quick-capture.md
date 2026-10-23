# Plan: Inbox Quick Capture and Unfiled Tasks

> **Owner:** @apauldev
> **Date:** 2026-10-22
>
> Make Inbox the personal workspace's capture surface rather than a project.
> Inbox becomes the place for incomplete, undated, unfiled work. Projects become
> intentional collections that a task joins later.

---

## 1. Product Decision

**Inbox is a view, not a project.**

- Inbox is the personal landing surface and quick-capture view.
- There is no separate Home or dashboard.
- Inbox contains tasks that are:
  - incomplete;
  - undated;
  - unfiled (`projectId = null`).
- A task leaves Inbox when it is **filed into a project**, **scheduled**, or
  **completed**. Filing is an exit, not just a metadata change.
- Projects are optional containers with a finish line.
- Team mode remains separate; there is no shared Inbox.
- Manual ordering in "My space" is unchanged.

### Why remove the default Inbox project

The current model has two different things called Inbox:

1. The **Inbox view** in navigation.
2. The seeded **Inbox project**, which every uncategorized task is assigned to.

That creates avoidable confusion:

- Every quick capture is technically organized before the user triages it.
- The Projects page shows a pseudo-project that duplicates the Inbox view.
- Project counts and Inbox counts can appear to describe the same tasks.
- The capture bar implies a project is required.
- The API cannot represent an unfiled task cleanly on create.
- An unrelated edit can silently refile an unfiled task into the default
  project.
- Renaming the seeded Inbox project still makes the seeder recreate it on the
  next project fetch; the Inbox branch removes Inbox and the default-project
  fallback.
- Notifications contain special cases to hide the default project.

### Starter defaults

The target personal-account starter projects are `Work`, `Personal`, `Home`,
`Health`, `Finance`, `Learning`, and `Side Projects`; `Inbox` is not a project.
The default labels remain `Urgent`, `Waiting`, `Errands`, `Review`, `Someday`,
and `Focus`.

## 2. Scope

**In scope**

- Remove the seeded Inbox project and default-project fallback.
- Define Inbox as incomplete + undated + unfiled.
- Make project selection optional everywhere.
- Add an explicit “No project” state to capture and task editing.
- Migrate existing seeded Inbox projects safely.
- Stop seeding projects on read.
- Reset the capture project picker after each capture.
- Update task-card labels and creation notifications so no filed task is called
  “Inbox.”
- Show a 3-second Inbox movement toast with a View action when a task leaves
  the Inbox.
- Update tests, copy, and docs.

**Out of scope**

- Redesigning the Inbox layout beyond the behavior above.
- Changing Today/Upcoming behavior.
- Reworking team mode or shared projects.
- Adding a project delete route. This is a separate project-management feature.
- Adding a dedicated `filed` task status. The stored status stays `inbox` for
  unscheduled tasks; this branch fixes how the UI derives and presents Inbox.
- A full redesign of task statuses.
- Undo or rollback actions from movement toasts.
- Toast history, notification center changes, or persistent move logs.

## 3. Behavior

### Quick capture

- Capture starts with no project selected.
- The project picker includes an explicit **No project** option.
- Selecting a project is optional and never blocks capture.
- A captured task has `status = 'inbox'`, no due date unless chosen, and
  `projectId = null` unless a project was chosen.
- After a successful capture, reset the project picker to **No project**.
  Capture must not remember the last-used project.
- If a project was chosen, the task is filed immediately and does not appear in
  Inbox.

### Inbox view

- Inbox query becomes:

  ```text
  status = 'inbox'
  AND completed = false
  AND due_date is empty
  AND project_id IS NULL
  ```

- Filing a task into a project removes it from Inbox.
- Scheduling a task removes it from Inbox.
- Completing a task removes it from Inbox.
- Clearing the project from an undated Inbox-status task returns it to Inbox.
- Inbox remains the place to review, schedule, file, or complete captured work.

### Projects

- The Projects page lists only active, user-meaningful projects.
- There is no seeded Inbox row.
- A filed but undated task lives in its project detail page.
- Existing tasks keep working when detached from the removed project.

### Status presentation

- Do not add a new task status in this branch.
- `status` remains a coarse stored fallback; Inbox membership is derived from
  the query, not raw status alone.
- A project-assigned undated task may still store `status = 'inbox'`; the UI
  must present it as filed, not as Inbox.
- A project-assigned task must not display an “Inbox” pill when its stored
  status is `inbox`.
- Where project context is available, show the project name instead; otherwise
  omit the status pill.
- In the task modal, never show “Inbox” for a filed task. If it is undated,
  present the stored `inbox` state as “Unscheduled”; if it has a date, present
  Today/Upcoming/Overdue based on the date. The navigation destination keeps the
  name Inbox.

### Notifications

- Remove the default-project special case.
- If a project was explicitly chosen and the task is undated, announce the
  project as the destination: `"Task" added to Project Name`.
- Do not produce messages such as `"Task" added to Inbox (Project)`.
- If no project was chosen, announce the Inbox destination from the task state.

### Inbox movement notifications

When an action removes a task from the visible Inbox, show a toast that says
where it went:

| Action | Toast copy | Destination |
|:---|:---|:---|
| File into a project | `"Task" moved to Work` | Project detail |
| Schedule | `"Task" moved to Today` / `"Task" moved to Upcoming` / `"Task" moved to Overdue` | Today/Upcoming; Overdue opens Today |
| Complete | `"Task" completed and moved to Archive` | Archive |

Use one action: **View**. It navigates to the destination and is available for
the same 3 seconds as the toast. It never changes the task or reverses the move.

- Filing: open the project detail.
- Scheduling: open Today or Upcoming, matching the destination named in the
  copy. Overdue opens Today, where the overdue section lives.
- Completion: open Archive.
- If a save files the task **and** schedules it, name both destinations in one
  message: `"Task" moved to Upcoming (Work)` (or Today/Overdue). Do not choose
  one destination and hide the other.
- No Undo or rollback action. The toast confirms the move and helps the user
  follow it; reversing the move is not offered from the toast.
- Respect the existing `actionNotifications` preference. If it is off, do not
  show movement toasts.
- Do not show two toasts for the same action. If completion already raises
  `Task completed`, extend that toast with the destination and View action
  instead of stacking another message.
- Do not show movement toasts for background refreshes, initial loads, or
  changes made outside the visible Inbox. Compare the task's state before and
  after a user-initiated save to decide.
- Gate the toast on an explicit `fromInbox` context (current view or caller),
  not just the task's shape, so completing the same task from Search does not
  announce a move from Inbox.
- Deleting a task is not a move; keep the existing delete confirmation and do
  not show a movement toast for it.
- If navigation is unavailable, omit the View button rather than showing a dead
  control.

#### Timing and animation

- The toast starts with a **3-second** timer.
- The action button is available for that full window and disappears with the
  toast.
- Pause the timer while the toast is hovered or keyboard-focused so the action
  does not vanish mid-interaction.
- Reuse the existing toast enter/leave animation in
  `apps/frontend/src/app/shared/ui/app-status/app-status.component.ts`
  (`toastAnimation`). Clicking View should dismiss immediately and play the
  existing leave animation before navigating.
- Respect `prefers-reduced-motion`; keep the state change and timer, but reduce
  or remove transform motion.

## 4. Data and API Changes

### Remove default-project behavior

- Remove `Inbox` from `DEFAULT_PROJECTS`.
- Remove `getDefaultProjectForOwner` once no callers remain.
- `createTaskForOwner`: use `payload.projectId ?? null`; do not look up a
  default project.
- `updateTaskForOwner`: preserve the current project or keep it `null`; do not
  fall back to a default project.
- Keep parent-project inheritance for subtasks.
- Allow `projectId: null` on `CreateTaskDto` for API symmetry. Omission and
  `null` both mean unfiled. Update the create request schema as well.

### Project seeding

- Seed starter projects only on the onboarding transition.
- Remove seeding from `listProjectsForOwner` and any other read path.
- Repeating `PATCH /me` with the onboarding fields must not reseed removed or
  renamed projects; gate on the transition to completed onboarding.
- Renaming a seeded project must not recreate it on the next fetch.
- Removing the other starter projects is not part of this branch.

### Migration for existing accounts

Add a nullable `retired_at` timestamp column to `projects` (Drizzle schema plus
the `ensureSqliteSchema` column check) and retire the legacy seeded Inbox
project rather than hard-deleting it immediately.

One-time migration, run from `ensureSqliteSchema`:

1. Find active projects matching the exact original seed signature:
   - `name = 'Inbox'`
   - `description = 'Default capture space for incoming tasks.'`
2. Treat that exact pair as the legacy seed identity. The legacy schema has no
   seed-ownership marker, so an account-created project with the exact same name
   and description cannot be distinguished; document this collision as an
   accepted migration limitation. Do not broaden matching to name alone.
3. In one transaction, detach tasks by setting `project_id = NULL`, then mark
   the matched project `retired_at`.
4. Leave renamed projects and projects with any other description untouched.
5. Make the migration idempotent: only process active matches, and ensure a
   failure cannot leave tasks detached without retiring the project (or vice
   versa).

`ensureSqliteSchema` is the only migration mechanism. `apps/api/drizzle/` is a
schema snapshot chain and is not applied at startup; use the
`label-migration.test.ts` pattern and boot a legacy database in tests. Cover
multiple accounts, an account with no matching Inbox, renamed Inbox projects,
a same-name project with a different description, exact-signature collisions
per the policy above, and repeated startup after both successful and interrupted
migration attempts.

Starter-project seeding must be gated on the transition from onboarding
incomplete to complete for a personal workspace, not merely on a PATCH payload
that still contains `onboardingCompleted: true`. The transition seeds the seven
non-Inbox starter projects. Repeated profile saves must neither recreate a
removed or renamed starter project nor duplicate existing starter projects.
Add API tests for the transition, repeat-save behavior, and the seven-project
starter set.

Retired projects:

- are hidden from `GET /projects`;
- are hidden from capture and task-editing pickers;
- return 404 from project detail routes;
- resolve to `null` when a stale client sends their ID during task creation or
  update, instead of returning 404 and breaking capture.

Use a separate retired-aware lookup for task writes: distinguish “owned but
retired” (rewrite to `null`) from “not found or not owned” (keep the 404). Do not
make the normal project-detail lookup return retired rows just to support this.

Hard-delete retired rows in a later release after clients have rolled over.

### Required API and migration tests

- Creating a task without a project, or with `projectId: null`, leaves the
  project null.
- Updating an unfiled task does not assign a default project.
- Assigning a project removes an undated task from the Inbox view.
- Clearing the project from an undated Inbox-status task returns it to Inbox.
- A retired project ID is accepted as unfiled by both task create and update.
- Retired projects do not appear in project listings or project detail routes.
- The legacy migration detaches tasks, retires only active projects matching
  the exact seed signature, is idempotent, and leaves renamed or differently
  described Inbox projects intact. The exact-signature collision is an accepted
  limitation because legacy rows have no ownership marker.
- Migration tests cover multiple accounts, no-match accounts, exact-signature
  collisions, renamed rows, same-name/different-description rows, and repeated
  startup after successful and interrupted runs.
- Renaming a seeded project does not recreate it on the next project fetch.
- Seeding runs only on the transition from onboarding incomplete to complete
  for a personal workspace. It creates the seven non-Inbox defaults once;
  repeated profile saves neither recreate removed/renamed projects nor duplicate
  existing ones.
- Seeding tests verify the transition, all seven defaults, and repeated-save
  behavior.

## 5. Frontend Changes

- Remove `defaultCaptureProjectId` from the task list, including its
  `[defaultProjectId]` binding.
- Capture bar:
  - add a “No project” option and default the picker to it;
  - remove the `defaultProjectId` input and the `projectId() || defaultProjectId`
    fallback;
  - reset `projectId` in `resetCapture()`.
- Task workspace:
  - remove the `projectService.projects()[0]` fallbacks in
    `openCreateTaskModal` and the modal `[initialProjectId]` binding;
  - resolve the contextual `initialProjectId` once in `openCreateTaskModal` and
    pass the resolved `draftProjectId` directly to the modal;
  - keep the contextual `initialProjectId` used by project detail, but let an
    explicit “No project” (`null`) win instead of being replaced by that
    context;
  - preserve an explicit `projectId: null` from the modal on create instead of
    coercing it back to `initialProjectId`;
  - distinguish “no contextual project was supplied” from an explicit “No
    project” choice in the state/event contract; do not use nullish coalescing
    that turns an explicit null back into context.
- Task modal:
  - add a “No project” option;
  - when editing, initialize the project from `task.projectId` only — never
    fall back to `initialProjectId` or `projects[0]`;
  - on create, use the contextual `initialProjectId` only when explicitly
    provided; otherwise start with no project;
  - send `projectId: null` when the project is cleared on update;
  - never show “Inbox” for a filed task; use “Unscheduled” when it is undated
    and Today/Upcoming/Overdue when it has a date.
- Task card:
  - do not show an “Inbox” status pill for a project-assigned task whose stored
    status is `inbox`;
  - accept a `fromInbox` context from the task-list page so completion can raise
    the movement notice only when the task was actually in Inbox.
- Notifications:
  - remove `defaultProjectId`;
  - use the project as the destination for undated project captures.
- Toast infrastructure:
  - extend `StatusMessage` with an optional action (`label` + callback);
  - render the action in `AppStatusComponent` as a real button;
  - let `StatusService.show(...)` accept the action and a 3000ms duration;
  - add pause/resume support for the timer, or keep timer ownership in the
    component so hover/focus can pause it;
  - ensure each toast timer is cancellable and is cleared on expiry, replacement,
    manual dismissal, action dismissal, and component teardown;
  - pause while the toast or its action is hovered or keyboard-focused, and
    resume only after neither is hovered/focused;
  - when View is clicked, start dismissal and navigate only after the leave
    animation completes; if the status component is destroyed during navigation,
    ensure the transition completes before changing routes;
  - coordinate Inbox completion with the existing completion notice so one
    action produces exactly one toast containing destination and View;
  - when a later move for the same task replaces a toast, cancel the old timer
    and replace it without stacking or invoking stale actions;
  - keep the existing enter/leave animation and add reduced-motion handling.
- Projects page:
  - rely on the API filtering retired projects out.

### Required frontend tests

- Quick capture with no project creates an unfiled task and resets the picker to
  “No project.”
- Editing an unfiled task keeps the project empty; opening and saving it must
  not assign the first project.
- Choosing “No project” in a contextual create (for example, from project
  detail) is preserved and is not replaced by the initial project.
- A movement toast is shown for filing, scheduling, and completing from Inbox.
- Filing and scheduling in one save names both destinations.
- Deleting a task from Inbox does not show a movement toast.
- The toast and its action use a 3000ms lifetime.
- Hovering or keyboard-focusing the toast, including its action, pauses the timer;
  the timer resumes only after both hover and focus have left.
- Clicking View starts toast dismissal, completes the leave animation, and then
  navigates to the matching destination; it does not update the task or reverse
  the move.
- Toast timers are cancelled on expiry, replacement, manual dismissal, action
  dismissal, and component teardown; replaced toasts cannot invoke stale actions.
- Inbox completion produces exactly one toast containing the destination and
  View action, not a separate generic completion toast.
- Movement toasts never offer an Undo action.
- Movement toasts respect the `actionNotifications` preference.
- Completing or filing the same task from Search does not raise a movement
  toast, because the user was not in the Inbox view.
- A second move for the same task within the window replaces the first toast
  instead of stacking duplicates.
- The existing enter/leave animation is applied and reduced-motion mode is
  honored.

## 6. Implementation Order

Implement in three gated phases, detailed in
[`2026-10-23-inbox-quick-capture-phases.md`](./2026-10-23-inbox-quick-capture-phases.md):

1. **Data and API foundation:** nullable project creation, no default-project
   fallback, precise Inbox filtering, retired-project migration/lookup, and
   onboarding-transition seeding with API and migration coverage.
2. **Capture and task presentation:** optional project selection, explicit
   “No project” semantics through modal/save flows, Inbox/status/notification
   presentation, and frontend coverage.
3. **Inbox movement feedback:** actionable movement toasts, cancellation and
   pause/resume lifecycle, route-after-animation behavior, completion-toast
   coordination, and end-to-end/regression coverage.

Complete each phase’s tests and acceptance gate before starting the next.
Run the full API, frontend, e2e, and migration suites after phase 3.

Suggested branch: `feat/inbox-quick-capture`.

## 7. Acceptance Criteria

- A new account has no Inbox project.
- Quick capture succeeds without choosing a project.
- The captured task appears in Inbox with `projectId = null`.
- The capture picker defaults to “No project” and resets after capture.
- Editing an unfiled task does not assign it to the first project.
- Choosing “No project” in a contextual create is preserved.
- Choosing a project during capture files the task immediately; it does not
  appear in Inbox and the confirmation names the project.
- Assigning a project to an Inbox task removes it from Inbox.
- A filed task is visible on its project detail page.
- No project-assigned task with stored status `inbox` is labeled “Inbox” in the
  task list or modal.
- Filing, scheduling, or completing a task from Inbox shows a 3-second toast
  naming the destination.
- The View action is usable for the full 3 seconds, dismisses the toast, and
  opens the destination without changing the task.
- The existing toast animation is reused for enter/leave, with reduced-motion
  behavior.
- Movement toasts are suppressed when action notifications are disabled.
- The Projects page does not show a seeded Inbox project.
- Existing seeded Inbox projects are retired without deleting tasks.
- Stale clients sending a retired project ID do not break task capture.
- Renaming a seeded project, or repeating the onboarding profile save, does not
  resurrect it.
- `createTaskForOwner` and `updateTaskForOwner` never choose an arbitrary
  fallback project.
- All existing tests and new migration tests pass.

## 8. Follow-ups

- Add `DELETE /projects/:id` and decide what happens to its tasks and ordering.
- Decide whether to keep, reduce, or remove the other seven starter projects.
- Hard-delete retired project rows after one release.
- Revisit whether a dedicated `filed` status is worth adding if the derived
  presentation becomes awkward.
