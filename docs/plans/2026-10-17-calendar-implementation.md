# Plan: Calendar Implementation (3 Parts)

> **Status:** Proposed — not started
> **Owner:** @apauldev
> **Date:** 2026-10-17
> **Design source:** [`2026-10-17-calendar-view.md`](./2026-10-17-calendar-view.md)
> (the native calendar design/UX brief — §-references below point there).
>
> This document turns the design into a delivery plan split into **three
> logical, independently shippable parts**, each with its own verification. Part
> 1 is a useful product on its own (you can see your schedule); Part 2 adds
> actions; Part 3 adds rescheduling, mobile, and accessibility polish.

---

## Sequencing and branch strategy

| Part | Deliverable | Depends on | Design tasks | API change |
|:---|:---|:---|:---|:---|
| **1 — See it** | Read-only calendar: navigate months, see tasks by day, open a task | — | 1, 2, 3, 4, 5 (view), 10 (states/theming) | None |
| **2 — Act on it** | Create with a pre-filled date, complete, and quick-schedule undated tasks | Part 1 | 6, 8, 3 (undated data) | Yes (read-only filters) |
| **3 — Move it & use it anywhere** | Drag-to-reschedule (+ non-drag path), recurring guard, mobile agenda, a11y | Part 1 (2 for drag persistence) | 7, 9, 10 (a11y) | None |

- **One PR per part**, conventional-commit titled (`feat(calendar): …`), keep
  unrelated changes out of each PR.
- Parts 1 and 2 are desktop-first; Part 3 is where mobile and accessibility land.
- Nothing here changes the database schema. Only Part 2 touches the API, and only
  by adding read-only query filters.

Shared conventions (apply to every part):

- Standalone components, `ChangeDetectionStrategy.Eager`, `inject()`, signals.
- Use theme tokens only — no hard-coded colours (`scripts/eslint-no-hardcoded-color.mjs`).
- `TaskService.version()` drives refresh; do not hand-roll state sync.
- Colocate unit specs (`*.spec.ts`); keep the route handler thin.

---

## Part 1 — See it (read-only calendar)

**Goal:** a user can open **Calendar**, move between months, see tasks on their
due dates, open a task, and find undated tasks — with nothing yet interactive
beyond opening.

**Exit criteria:** `/calendar` renders correctly for 4-, 5-, and 6-row months in
all seven themes; clicking a task opens the existing modal; the **No date** list
is populated; empty/loading states are present.

### Work items

1. **Route + navigation** (design Task 1)
   - `app.routes.ts`: add lazy `{ path: 'calendar', loadComponent: … }` in the
     personal `children`, before `**`.
   - `personal-shell.component.{ts,html}`: add `'calendar'` to `PersonalIcon`, a
     `Calendar` nav entry, and the `@case ('calendar')` icon (reuse
     `faCalendarDays`).
2. **Page skeleton + state** (design Task 2)
   - `features/personal/pages/calendar-page/calendar-page.component.{ts,html,css}`.
   - Wrap in `<app-personal-task-workspace>`; keep
     `viewChild(PersonalTaskWorkspaceComponent)`.
   - Signals: `viewMonth` (Luxon), `selectedDate`, `showCompleted`.
3. **Derived data** (design Task 3)
   - `computed()` over `TaskService.allActiveTasks()`:
     `tasksByDay: Map<'yyyy-MM-dd', Task[]>` (key = `dueDate.slice(0, 10)`),
     `monthCells` (Luxon, with leading/trailing days), `undated`
     (`!task.dueDate`).
4. **Header + month grid** (design Task 4)
   - `calendar-header/`: title, prev/next, Today, month label, New task (button
     present but wired in Part 2), **No date** toggle with count.
   - `calendar-month-grid/` + day-cell + `calendar-task-chip/`: 7-column CSS grid;
     day number, today/selected tokens (lift styles from
     `date-picker.component.ts`), task rows, **+N more**.
5. **Selected-day panel (view)** + **No date list (view)** (design Task 5, read side)
   - `calendar-day-panel/`: weekday + date, count, task rows; open-editor on select.
   - `calendar-no-date-list/`: list undated active tasks (the quick-date action
     itself lands in Part 2).
6. **States + theming** (design Tasks 5/11)
   - Empty month / empty selected date / empty No date; restrained loading that
     preserves the grid.
   - Verify all 7 themes + dark mode use tokens.

### Verification

```bash
pnpm --filter @yotara/frontend typecheck
pnpm --filter @yotara/frontend lint          # tsc + stylelint
pnpm --filter @yotara/frontend test
pnpm --filter @yotara/frontend build         # budgets: initial 500kB/1MB, component style 15kB/30kB
pnpm --filter @yotara/frontend e2e
pnpm format:check
```

**Unit tests**

- `tasksByDay` groups by `dueDate`; a task with `dueTime` still lands on its day;
  tasks with no `dueDate` are **excluded** from the grid and appear only in
  `undated`.
- Month-cell generation: a 4-row month (e.g. Feb starting Sunday), a 5-row month,
  and a 6-row month all produce the right first/last cell and no overflow.
- `selectedDate` → day-panel row list matches `tasksByDay` for that day.

**E2E (Playwright)**

- Open `/calendar`; assert the current month label and that a seeded task with a
  due date renders in its cell.
- Prev/Next change the month; **Today** returns and selects today.
- Click a task → the existing modal opens; close returns to the same month.

**Manual**

- [ ] All 7 themes + dark mode; no hard-coded colours.
- [ ] 4-, 5-, and 6-row months have no layout shift.
- [ ] Empty month, empty day, and empty No date states read correctly.
- [ ] Guards still work (auth / onboarding / personal-mode).
- [ ] No initial-bundle growth beyond the lazy route chunk.

---

## Part 2 — Act on it (create, complete, schedule) + the API filters

**Goal:** from the calendar a user can create a task on a chosen date, complete a
task, and give an undated task a date — all persisting through the same task
model as the rest of the app.

**Exit criteria:** the New task button, the day panel's *Add task for this date*,
inline completion, and the No date list's quick-date action all work and survive
a reload; the new API filters are covered by tests and the OpenAPI spec.

### Work items

1. **Create with a pre-filled date** (design Task 6)
   - Wire the New task button and day-cell/panel *Add task for this date* to
     `workspace()?.openCreateTaskModal(projectId?, dueDateDraft)` using the
     cell's date, so the user never re-picks the date.
2. **Complete** (design Task 6)
   - Chip completion control → `updateTask(id, { completed: true })`; must **not**
     open the modal; optimistic update with rollback + error on failure.
3. **Quick-schedule undated tasks** (design §8.1, Task 6)
   - In `calendar-no-date-list/`: a compact `DatePickerComponent` plus quick
     **Today** / **Tomorrow**; on pick, `scheduleTask(task, date)` →
     `updateTask(id, { dueDate })` (preserve `dueTime`). The row leaves the list
     and the task appears on the calendar — no manual refresh.
4. **API: read-only filters** (design Task 8)
   - `apps/api/src/services/task-service.ts`: expose the existing `hasDueDate`
     predicate through `TaskFilters`, and add `dueFrom` / `dueTo` (date range)
     predicates in `listTasksForOwner`.
   - `apps/api/src/routes/tasks.ts`: add `hasDueDate`, `dueFrom`, `dueTo` to the
     query schema (keep `withJsonResponse()` accurate).
   - `apps/frontend/.../task.service.ts`: add client helper(s) that carry `tz`
     (used by the No date list and any dated range query).
   - Keep v1’s grid reads on `allActiveTasks()`; the range filter backs the
     No date / completed-aware queries (design §8).

### Verification

```bash
pnpm --filter @yotara/frontend typecheck && pnpm --filter @yotara/frontend lint
pnpm --filter @yotara/api test               # route + service tests for the new filters
pnpm --filter @yotara/api docs:check         # spec still matches the routes
pnpm --filter @yotara/frontend test
pnpm --filter @yotara/frontend e2e
pnpm test                                    # whole-repo gate
```

**API tests** (colocated, `apps/api/src/routes/tasks.test.ts` +
`task-service.test.ts`)

- `hasDueDate=false` returns only tasks with no `dueDate`; `true` returns dated
  ones; omitted leaves behaviour unchanged.
- `dueFrom`/`dueTo` are inclusive and respect the supplied `tz` for the day
  boundary; an inverted range (`from > to`) returns empty rather than erroring.
- Existing list behaviour is unchanged when the new params are absent.

**Unit tests (frontend)**

- Complete: calls `updateTask({ completed: true })`, does **not** open the modal,
  and rolls back on rejection.
- Quick schedule: picking a date calls `updateTask(id, { dueDate })`, the task
  leaves `undated` and appears under that day; rollback on failure.
- Create: `openCreateTaskModal` receives the cell's date as `dueDateDraft`.

**E2E (Playwright)**

- Create a task from a day cell → it appears on that day after reload.
- Complete a task from the calendar → it reads as completed (per the filter).
- Schedule an undated task from the **No date** list → it lands on the chosen day.

**Manual**

- [ ] Created tasks keep the chosen date without re-picking.
- [ ] Completion never opens the modal; a failed save reverts visibly.
- [ ] No date list count and contents stay in sync after scheduling.
- [ ] `pnpm docs:check` passes; OpenAPI lists the new params.

---

## Part 3 — Move it & use it anywhere (reschedule, mobile, a11y)

**Goal:** reschedule by drag (non-recurring) with a non-drag alternative, on top
of a fully usable mobile agenda, with accessible interaction throughout.

**Exit criteria:** a non-recurring task can be dragged to another day and
persists (with rollback on failure); recurring tasks cannot be dragged but are
still reschedulable via the editor; the calendar is fully usable at ~375 px; all
controls are keyboard-reachable and announced.

### Work items

1. **Drag-to-reschedule** (design §7.1, Task 7)
   - `DragDropModule` with a `cdkDropList` per day cell, `cdkDrag` per chip.
   - On drop: `updateTask(id, { dueDate })` — **never** `dueTime: null`;
     **revert** on failure. Highlight the destination during the drag.
2. **Non-drag alternative** (design §7.2)
   - A task action menu **Move to…** → `DatePickerComponent`; drag is never the
     only path (required for keyboard/AT, and the touch path in §10).
3. **Recurring-task guard** (design §7.3)
   - Disable dragging for any task with a `recurrenceRule`; keep the recurring
     pill visible. (Per-occurrence moves need the P4-10/P4-13 model work —
     out of scope; see the design plan §7.3.)
4. **Mobile: date strip + agenda** (design §10, Task 9)
   - Sticky month navigator, horizontally scrollable date strip (today/selected,
     auto-scroll), vertical agenda for the selected date reusing the chip, sticky
     **Add task** bar, **Move to…** for touch reschedule (no drag).
   - Branch via CDK `BreakpointObserver` or a CSS media query.
5. **Accessibility + polish** (design §11/§12, Task 10)
   - Roving keyboard focus across the grid and within a day's tasks; visible
     focus; accessible names for prev/next/Today; polite live-region
     announcements on date change and task completion; meaningful aria labels on
     cells (date + count) and rows.
   - Verify text scaling, `env(safe-area-inset-*)`, and reduced-motion.

### Verification

```bash
pnpm --filter @yotara/frontend typecheck && pnpm --filter @yotara/frontend lint
pnpm --filter @yotara/frontend test
pnpm --filter @yotara/frontend e2e
pnpm --filter @yotara/frontend build
```

**Unit tests**

- Drag: `updateTask` called with the new `dueDate` and **`dueTime` preserved**;
  `revert()` on rejection; **drag is disabled** when `recurrenceRule` is set.
- Move to… menu: picking a date calls `updateTask(id, { dueDate })`.
- Agenda: selecting a strip day renders that day's tasks; empty day shows the
  empty state.

**E2E (Playwright)**

- Drag a non-recurring task to another day, reload, assert the new date persisted.
- Force a drag failure (MOCK) and assert the task returns to its original day.
- Narrow viewport → the agenda renders; tapping a day updates it; tapping a task
  opens the editor.
- Keyboard-only pass: tab to the grid, move the date selection, open and complete
  a task.

**Manual checklist**

- [ ] All 7 themes + dark mode; no hard-coded colours.
- [ ] A recurring task cannot be dragged; the editor still reschedules it.
- [ ] Drag failure reverts with a clear message; nothing unsaved is shown.
- [ ] Overdue tasks stay on their real dates with a restrained indicator.
- [ ] No-date tasks are reachable only via the **No date** control, and
      scheduling one places it on the chosen day.
- [ ] ~375 px + text scaling raised stays usable (safe-area insets respected).
- [ ] Screen reader announces selected-date changes and completions.

---

## Cross-cutting

**Risks** — see the design plan §15 (recurrence ambiguity, CDK-in-grid, the
completed-by-date data gap, timezone safety, feature creep). The per-part split
keeps the riskiest item (recurrence) contained to Part 3, where drag is guarded.

**Out of scope** — unchanged from the design plan §16: no drag-to-create/resize,
no week/day time-grid, no per-occurrence recurrence moves, no ICS/sync, no
team-mode calendar, no new database column.

**Traceability** — Part 1 = design Tasks 1–5 (view) + 10 (states/theming);
Part 2 = Tasks 6, 8 + §8.1; Part 3 = Tasks 7, 9 + 10 (a11y) + §7.3. The design
plan stays the source of truth for UX; this document is the build order.
