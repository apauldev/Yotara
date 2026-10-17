# Plan: A Native Calendar for Personal Mode

> **Status:** Proposed — not started
> **Owner:** @apauldev
> **Date:** 2026-10-17
>
> Add a calendar to the personal shell built **entirely from Yotara's own
> primitives** — no third-party calendar library. Tasks appear on their due
> dates and can be opened, completed, and rescheduled. It is another *view* over
> the existing task model, not a separate scheduling system: tasks stay the
> source of truth, and the existing task editor, date parser, and visual
> language are reused wherever practical.
>
> This supersedes an earlier draft that proposed adopting FullCalendar. The
> decision is now to own the implementation: the app already has the needed
> building blocks (`@angular/cdk` drag-drop, Luxon, the theme tokens, the task
> modal and card), and a stock calendar would fight the 7-theme visual system
> while adding a runtime dependency for a small feature.

---

## 1. Product vision

Answer three questions, nothing more:

1. What tasks are due on a particular date?
2. How overloaded is my upcoming schedule?
3. How do I move a task to a better date with minimal effort?

**Core principle:** the calendar is another way to view and manage *existing*
tasks. Creating, editing, completing, and rescheduling through the calendar must
use the same task data and behavior as the rest of Yotara.

---

## 2. Scope and assumptions

- Tasks may have a due date or be undated; dated tasks may also carry a
  `dueTime` (`HH:mm`).
- Tasks can be completed, belong to a project, and have labels.
- Some tasks recur (`recurrenceRule` + `baseTaskId`).
- The existing task editor and creation flow are reused.
- **Date-based, not time-based.** No start/end times or durations are needed to
  place a task on the calendar; a `dueTime`, when present, is shown as a label.
- First release: a **month grid with a selected-day task panel** on desktop, and
  a **date strip + agenda** on phones (no shrunken seven-column grid) — see §10.
- **Mobile is a first-class target, not a fallback.** Every calendar task —
  browse a month, see what's due, open a task, complete it, reschedule it, and
  create one — must be doable on a phone.
- Time-blocking and a full week time-grid are out of scope until the product
  supports that workflow.

---

## 3. Architecture decision

### 3.1 Native, no calendar dependency

We build the month grid and agenda ourselves. What we reuse:

| Need | Reuse |
|:---|:---|
| Drag-to-reschedule | `@angular/cdk/drag-drop` (`DragDropModule` — already a dependency, not yet used) |
| Date math / month layout | Luxon (already used throughout) |
| Task data + mutations | `TaskService` (`allActiveTasks()`, `updateTask()`, `version()`) |
| Task editing | `PersonalTaskWorkspaceComponent` → the existing task modal |
| Natural-language dates | `parseTaskDueDate`, `DatePickerComponent` |
| Presentation | Theme tokens (`--surface-card`, `--primary-gradient`, `--status-overdue`, …) and the `personal-task-card` visual language |

### 3.2 Why not Spartan's `BrnCalendar`

`BrnCalendar` (used by the date picker) renders each day as a **`<button>`
carrying the `brnCalendarCellButton` directive** — the cells *are* the selection
control. A calendar day cell must instead contain a **list of interactive task
rows** (each with an "open" affordance and a completion control). Nesting
interactive elements inside those button cells is invalid HTML and breaks
keyboard/screen-reader semantics.

So the month grid is a **plain CSS grid of non-button day cells**, reusing the
date-picker's *visual* treatments (the `data-today` / `data-selected` token
styles in `date-picker.component.ts`) without its button-cell structure. This
also lets us own per-cell keyboard navigation and the "+N more" overflow.

---

## 4. Information architecture

Add **Calendar** as a first-class personal-mode destination (`/calendar`)
alongside Inbox / Today / Upcoming / Projects / Labels / Archive.

Four primary areas:

1. **Calendar header** — navigation, current month/year, and *New task*.
2. **Month grid** — a visual overview of tasks by due date.
3. **Selected-day panel** — the tasks due on the selected date, with actions.
4. **No date surface** — the undated tasks, reached through an explicitly named
   **No date** control, each with a **quick date** action so it can be scheduled
   onto the calendar in one step (§8.1).

The calendar never invents a due date to make a task appear; undated tasks stay
undated until the user schedules them from the No date surface.

---

## 5. Desktop layout

Target ~1440 × 900, adapting down to 1024 and narrower.

### 5.1 Navigation

Reuse the existing shell sidebar; add one Calendar item (FontAwesome
`faCalendarDays`) with the same active-state treatment as the other views.
Global navigation is not redesigned.

### 5.2 Header

- Page title **Calendar**
- Previous-period / Next-period buttons (one month at a time)
- **Today** — returns to the current month **and** selects today
- Current month and year, e.g. **October 2026**
- **New task** button

Month view is the only view in v1 — do **not** add disabled week/day toggles to
imply otherwise.

### 5.3 Month grid

A conventional seven-column grid. **Week start follows the existing product
convention (Sunday-first)**, matching `DatePickerComponent`'s `Su…Sa`; a
locale-driven week start is a later follow-up.

Each day cell:

- day number; subdued styling for days outside the month
- a subtle **today** indicator
- a **selected** treatment
- a compact list of tasks due that day
- a **“+N more”** affordance when tasks overflow

The grid must handle 4-, 5-, and 6-row months without layout shift. Cell sizing
errs toward clickable; **task titles stay readable** rather than collapsing to
coloured dots wherever space allows.

**Task row/chip contents:** title; a small project/label accent when useful; a
completion control that can be operated **without opening the task**; a subdued
completed appearance (reduced emphasis + strikethrough). Colour is used
sparingly — neutral surfaces with restrained accents — and **status is never
conveyed by colour alone**.

### 5.4 Selected-day panel

Clicking a date opens a side panel **without leaving the grid**. It shows the
selected date (with weekday), a task count, the tasks due that day with their
completion state, a prominent **Add task for this date** action, and access to
the existing editor when a task is chosen. Closing it returns to the same grid
state (same month, same selection). It is a quick review surface, not a second
task manager.

---

## 6. Task creation and editing

- **Create from the calendar:** clicking empty space in a day cell, or the
  panel's *Add task for this date*, opens the existing create flow with the
  **due date pre-filled** (the user must not have to pick the date again). After
  save the task appears on that date with no manual refresh (the
  `TaskService.version()` signal drives it).
- **Open a task:** clicking a task title opens the existing editor/detail view
  with the same supported fields and actions as elsewhere. **No simplified
  calendar-only task model.**
- **Complete a task:** a dedicated control that does not trigger opening. Update
  the row immediately; on a failed save, restore the previous state and show a
  clear error (`updateTask` already surfaces failures via `LogService` /
  `errorState`).

---

## 7. Rescheduling interactions

### 7.1 Drag and drop (desktop, non-recurring tasks)

Use `@angular/cdk/drag-drop`: one drop-list per day cell, one draggable per task
chip.

- Highlight the destination date during the drag; show the dragged task clearly;
  don't make unrelated cells look interactive.
- On drop, call `TaskService.updateTask(id, { dueDate })`. **Send only `dueDate`**
  — never `dueTime: null` — so a timed task keeps its time. On failure, restore
  the original date and explain what happened; never leave an unsaved change on
  screen.
- Dragging moves the existing task; it never creates a duplicate.

### 7.2 Non-drag alternative (required)

Rescheduling must also be possible through the task editor (change the due date)
and a task action menu. Drag is never the only path — required for keyboard,
touch, and assistive-technology users.

### 7.3 Recurring tasks — drag is deferred (not shipped in v1)

**This is a hard finding, not a preference.** The recurrence model has no
per-occurrence concept: no series anchor, no exception/skip, and no "scope" on
the update. `PATCH /tasks/:id { dueDate }` cannot express "this occurrence" vs
"this series", and the *same gesture means different things* depending on the
rule:

| Frequency | Next-instance anchor | Effect of dragging one occurrence's `dueDate` |
|:---|:---|:---|
| `daily` / `weekdays` / `weekly` + `daysOfWeek` | completion time (`now()`) | none on the future series (an accidental one-off) |
| `weekly` (no days) / `monthly` / `yearly` | this row's `dueDate` | **silently re-anchors the entire future series** |

Per the design brief's own instruction — *"If Yotara's recurrence model cannot
reliably represent the distinction, defer drag-and-drop rescheduling for
recurring tasks rather than introducing ambiguous behavior"* — **v1 disables
drag for any task with a `recurrenceRule`.** Recurring tasks can still be
rescheduled through the editor (which edits the series explicitly), and the chip
carries the existing recurring pill so it is visibly different.

Making drag safe for recurrence later requires a model change (tracked as the
unstarted roadmap items **P4-10** skip/snooze one occurrence and **P4-13**
separate the recurring template from normal task lists). The smallest change is
an explicit `recurrence_anchor_date` column plus a `rescheduleScope:
'occurrence' | 'series'` field on the update DTO — **out of scope here**; do the
model work first.

---

## 8. Navigation and filtering

**Required controls:** previous/next month, Today, select a date, create a task
for a date, view/edit tasks due on a date, access undated tasks.

**Optional:** a compact **active ⇄ completed** filter, defaulting to **active**
so the month stays readable, with the choice preserved across month navigation.

### 8.1 The No date surface

Undated tasks are reachable through a **No date** control in the header (with a
count). It opens a list of active tasks that have no due date. Each row carries a
**quick date** action that schedules the task in one step: a compact date control
reusing `DatePickerComponent`, plus quick **Today** / **Tomorrow** options for
the common cases.

Picking a date calls `updateTask(id, { dueDate })` — the task leaves the No date
list and appears on the calendar for that date, with no manual refresh. This is
the fast path the brief's "access undated tasks" requirement needs, and the only
way an undated task acquires a date from the calendar. Undated tasks are never
implied to be overdue.

Two small data gaps must be closed to honor this (see §13, Task 8):

- **Undated tasks** — the service already supports a `hasDueDate` filter, but it
  is not exposed on `GET /tasks`. Wire it (`hasDueDate=false`) for the **No
  date** list.
- **Completed tasks in a month** — the existing completed filters key off
  completion time (`completedSince` → `archivedAt`), not `dueDate`, so they
  can't populate a past month. Add a `dueFrom`/`dueTo` range (with the completed
  flag) — or ship v1 active-only and label the completed filter as coming later.

If project/label filters exist elsewhere in Yotara, reuse those patterns; do not
introduce a new filter system.

---

## 9. Overdue tasks and date semantics

- Overdue tasks stay on their **actual** due date; they are never auto-moved to
  today.
- Use a restrained overdue indicator and keep past-due tasks identifiable in
  place.
- Undated tasks stay undated unless the user assigns a date.
- **No new "scheduled date" concept** distinct from due date.
- **Date consistency:** `dueDate` is a date-only `YYYY-MM-DD` string. Always read
  the calendar day from the string itself (Luxon `parseCalendarDate` /
  `slice(0, 10)`); never derive a display date from a UTC timestamp, or a task
  can shift to an adjacent day. Placement uses the same local-date convention as
  the rest of the app.

---

## 10. Mobile and narrow-screen behavior

Mobile is a **first-class target, not a degraded desktop**. The seven-column grid
is never shrunk onto a phone; below the breakpoint the calendar becomes a
**date strip + agenda**, and every action remains reachable.

### 10.1 Mobile layout

Two stacked regions replace the grid:

1. **Month navigator** — `‹  October 2026  ›` with the same previous/next/Today
   behavior as desktop (one month per tap). Tapping the month label jumps to
   today's month (or opens the existing `DatePickerComponent` popover for a
   month/year jump).
2. **Date strip** — a horizontally scrollable row of days (day-of-week + day
   number). Today carries the same subtle marker as the desktop cell; the
   selected day carries the selected treatment. The strip auto-scrolls so the
   selected day is visible, and scrolling the strip across a month boundary
   updates the navigator label.
3. **Agenda list** — the vertical list of tasks due on the **selected** date,
   using the same task row as the desktop chip (title, project/label accent,
   completion control, recurrence pill), plus the §11 empty state when the day is
   clear.
4. **Sticky action bar** — a persistent, thumb-reachable **Add task** action
   (bottom bar/FAB) that creates a task on the selected date.
5. **Sticky top bar** — the month navigator stays pinned while the agenda
   scrolls, so navigation is never scrolled out of reach.

### 10.2 Mobile interaction

- Tap a day in the strip → the agenda updates for that day.
- Tap a task → the existing editor opens (same as desktop).
- Tap the completion control → completes without opening the task.
- **No drag on touch.** Rescheduling is done through the editor or a task action
  menu (**Move to…** → `DatePickerComponent`), so the brief's requirement that
  drag is never the only path holds on phones. Drag via CDK is desktop-only
  (§7.1).
- Creating a task pre-fills the **selected date**, exactly as on desktop (§6).

### 10.3 Sizing, accessibility, and robustness

- Touch targets ≥ 2.75rem under `(pointer: coarse)`, with enough gap that
  adjacent strip days and task controls can't be mis-tapped.
- **Text scaling:** no fixed heights that clip; strip days and agenda rows grow,
  and long titles truncate/wrap cleanly rather than overflowing.
- Respect safe-area insets (`env(safe-area-inset-*)`) on the sticky bars for
  notched devices.
- Keyboard and assistive tech still work with a hardware keyboard on
  phones/tablets (§12), including date-strip navigation.

### 10.4 Reuse and implementation

Only the container differs from desktop: the same task chip, completion control,
and editor modal (already responsive — PR #372). The page holds one set of
signals (`viewMonth`, `selectedDate`, filters); the template branches on a
breakpoint — a CDK `BreakpointObserver` signal (`@angular/cdk/layout`, already
available) or a plain CSS media query.

**Breakpoint:** follow the app convention (`@media (width <= 720px)`).

---

## 11. Empty, loading, and error states

Design these explicitly:

- **Empty month:** "No active tasks due in <Month>" + a create action.
- **Empty selected date:** "Nothing due on this day" + **Add task**.
- **No-date tasks:** discoverable via the **No date** control; never implied to
  be overdue.
- **Loading:** restrained; preserve the grid structure instead of replacing the
  screen with a spinner.
- **Failed save:** state clearly that it didn't save, restore the last confirmed
  state, and offer retry.
- **Long titles / crowded days:** truncate cleanly, expose the full title on
  open, and use **"+N more"** rather than letting a cell grow unbounded.
- **Completed tasks:** follow the active/completed filter consistently, including
  after navigation and after completing a task.

---

## 12. Accessibility and interaction quality

The calendar must not depend on mouse-only interaction or colour alone.

- Keyboard navigation **between dates and within a day's tasks** (roving focus
  across the grid; a sensible tab order into the selected-day panel).
- Visible focus using the app's `:focus-visible` treatment.
- Accessible names for the previous/next/Today controls.
- Screen-reader announcements when the selected date changes and when tasks are
  completed (a polite live region), plus meaningful aria labels on day cells
  (full date + task count) and task rows.
- Completion controls operable independently of the "open task" action.

> **Note:** the design brief supplied for this plan appears truncated at the end
> of this section ("…tasks are completed,"). The items above assume the intended
> remainder; confirm the last few a11y requirements.

---

## 13. Implementation tasks

### Task 1 — Route and navigation

**Files:** `apps/frontend/src/app/app.routes.ts`,
`features/personal/shell/personal-shell.component.{ts,html}`

Add a lazy `{ path: 'calendar', loadComponent: … calendar-page.component }` in
the personal `children` (before `**`). Extend the `PersonalIcon` union, add a
`Calendar` entry to `navItems`, and a `@case ('calendar')` in the sidebar
`@switch` (reuse the imported `faCalendarDays`).

### Task 2 — Calendar page + state

**Files:** new `features/personal/pages/calendar-page/calendar-page.component.{ts,html,css}`

Standalone, `ChangeDetectionStrategy.Eager`. Wrap content in
`<app-personal-task-workspace>` and keep a
`viewChild(PersonalTaskWorkspaceComponent)` so the modal is reused. Hold UI state
in signals: `viewMonth` (Luxon `DateTime`), `selectedDate`, `showCompleted`.
Derive the month's day cells with Luxon (including leading/trailing days), not
with `BrnCalendar`.

### Task 3 — Derived data

**Files:** `calendar-page.component.ts` (or a small `calendar-view` helper)

`computed()` selectors over `TaskService.allActiveTasks()`:

- `tasksByDay: Map<'yyyy-MM-dd', Task[]>` keyed on `dueDate.slice(0, 10)`.
- `monthCells` for the visible grid.
- `undated` list for the **No date** control (via `hasDueDate=false`, Task 8).
- Keep completed separate and include them only when `showCompleted`.

Views auto-refresh because the underlying signals re-emit on `version()`.

### Task 4 — Header + month grid components

**Files:** `features/personal/components/calendar-header/`,
`features/personal/components/calendar-month-grid/` (+ day-cell / task-chip)

Header: title, prev/next, Today, month label, New task. Grid: 7-column CSS grid;
each cell renders the day number, today/selected treatments (token styles lifted
from `date-picker.component.ts`), a `<app-calendar-task-chip>` per task, and
"+N more". Truncate titles with a `title` attribute/tooltip for the full text.

### Task 5 — Selected-day panel and No date list

**Files:** `features/personal/components/calendar-day-panel/`,
`features/personal/components/calendar-no-date-list/`

**Selected-day panel:** side panel for the selected date — weekday + date, count,
task rows (completion state), **Add task for this date**, and open-editor on task
select. Empty state per §11. Must not reset month/scroll state on close.

**No date list** (§8.1): toggled from the header's **No date** control, listing
active tasks with no due date. Each row has a **quick date** action — a compact
`DatePickerComponent` plus quick **Today** / **Tomorrow** options — that schedules
the task via `updateTask(id, { dueDate })`; the row leaves the list and the task
appears on the calendar. Empty state per §11.

### Task 6 — Create / open / complete / schedule

**Files:** `calendar-page.component.ts`, `calendar-task-chip.component.ts`

- `openTask(task)` → `workspace()?.editTask(task)`.
- Create: `workspace()?.openCreateTaskModal(projectId?, dueDateDraft)` with the
  cell's date pre-filled (reuse the workspace's existing `dueDateDraft` input).
- Complete: a chip control that calls `updateTask(id, { completed: true })` and
  does **not** open the modal; optimistic update with rollback on failure.
- Schedule (quick add date): `scheduleTask(task, date)` → `updateTask(id, { dueDate })`,
  used by the No date list (§8.1) and any inline date affordance. Preserves
  `dueTime`; optimistic update with rollback on failure.

### Task 7 — Drag-to-reschedule (CDK)

**Files:** `calendar-month-grid` / `calendar-day-cell`

`DragDropModule` with a `cdkDropList` per day cell and `cdkDrag` per non-recurring
chip. On `cdkDropListDropped`, compute the target day and call
`updateTask(id, { dueDate })` (preserving `dueTime`); revert on failure. Disable
dragging for tasks with a `recurrenceRule` (§7.3) and on coarse pointers.

### Task 8 — Filtering + the small API additions

**Files:** `apps/api/src/routes/tasks.ts`, `apps/api/src/services/task-service.ts`
(schema via `withJsonResponse()`), and
`apps/frontend/src/app/core/services/task.service.ts`

- Expose `hasDueDate` (already implemented in `listTasksForOwner`, not wired) on
  `GET /tasks` for the **No date** list.
- Add `dueFrom`/`dueTo` (date range) filters for a completed-aware month query
  (§8), or defer and ship active-only.
- Add matching client fetch helper(s) guarded by `tz`.

### Task 9 — Mobile: date strip + agenda

**Files:** `features/personal/components/calendar-agenda/` +
`calendar-month-navigator/` + the responsive switch in `calendar-page`

Build the mobile view per §10: a sticky month navigator, a horizontally
scrollable date strip (today/selected markers, auto-scroll to the selected day),
a vertical agenda for the selected date reusing the desktop task chip, a sticky
**Add task** action that pre-fills the selected date, and a **Move to…** action
menu for touch rescheduling (no drag). Branch on a breakpoint signal (CDK
`BreakpointObserver`) or a CSS media query; verify at ~375px and with browser
text scaling raised, plus safe-area insets.

### Task 10 — States, a11y, polish

Empty/loading/error states (§11); roving keyboard focus and live-region
announcements (§12); verify all 7 themes + dark mode and that no hard-coded
colours are introduced (repo guard: `scripts/eslint-no-hardcoded-color.mjs`).

---

## 14. Verification

```bash
pnpm --filter @yotara/frontend typecheck
pnpm --filter @yotara/frontend lint          # tsc + stylelint
pnpm --filter @yotara/frontend test
pnpm --filter @yotara/frontend build         # budgets: initial 500kB/1MB, component style 15kB/30kB
pnpm --filter @yotara/frontend e2e
pnpm test                                    # includes API tests for any route change
```

Unit tests (Karma/Jasmine, colocated `*.spec.ts`):

- `tasksByDay` grouping: date-only vs timed tasks; tasks without `dueDate`
  excluded from the grid and present only under **No date**; completed handling
  honors the filter.
- Drag: `updateTask` called with the new `dueDate` and **`dueTime` preserved**;
  revert on rejection; **drag disabled for recurring tasks**.
- Complete: calls `updateTask({ completed: true })` and does **not** open the
  modal; rollback on failure.
- Quick schedule: choosing a date from the No date list calls
  `updateTask(id, { dueDate })`, the task leaves the list and appears under that
  day; rollback on failure.
- Create: the create flow receives the cell's date pre-filled.
- Grid layout: 4-, 5-, and 6-row months render without overflow.

E2E (Playwright): create a task with a due date, open `/calendar`, click to open
the editor, drag a non-recurring task to another day and reload to confirm
persistence, schedule an undated task from the **No date** list and confirm it
lands on that day, switch to a narrow viewport to confirm the agenda, and cycle
themes.

Manual checklist:

- [ ] All 7 themes + dark mode; no hard-coded colours.
- [ ] Drag a timed task — the due time is preserved; a drag failure reverts.
- [ ] A recurring task cannot be dragged; the editor still reschedules it.
- [ ] Overdue tasks stay on their real dates with a restrained indicator.
- [ ] No-date tasks are reachable only via the **No date** control.
- [ ] Scheduling an undated task from the **No date** list places it on the
      chosen day and removes it from the list.
- [ ] Keyboard-only: navigate dates, open a task, complete it, create one.
- [ ] Narrow viewport + text scaling remains usable (agenda).
- [ ] No initial-bundle growth beyond the lazy route chunk.

---

## 15. Risks & mitigations

| Risk | Mitigation |
|:---|:---|
| Recurrence semantics make drag ambiguous | Defer drag for recurring tasks; require the editor; do the model work (P4-10/P4-13) before enabling it |
| Building a grid is more work than adopting a library | Scope strictly to month + agenda; reuse tokens, cards, and the modal; iterate |
| CDK drop-lists inside a grid fight the layout | Keep cells as drop-lists with non-draggable-during-drop chips; fall back to pointer-based drop if CDK misbehaves; drag is never the only path (§7.2) |
| Completed tasks can't be listed by date | Add `dueFrom`/`dueTo` (+completed) or ship v1 active-only and label the filter |
| Undated tasks not exposed by the API | Wire the existing `hasDueDate` filter (§8/Task 8) |
| A day cell with many tasks breaks layout | "+N more" + truncation; verify 4/5/6-row months |
| Timezone shifting tasks onto adjacent days | Use date-only strings for placement; never round-trip through UTC (§9) |
| A11y regressions in a custom grid | Roving focus, live-region announcements, keyboard tests (§12) |
| Feature creep toward a full scheduler | Non-goals are explicit; month + agenda only (§2/§16) |

---

## 16. Out of scope

- Drag-to-*create*, drag-*resize*, durations, time-blocking, multi-day spans.
- Week/day time-grid and agenda variants beyond the mobile agenda.
- Per-occurrence recurrence moves (needs the P4-10/P4-13 model work).
- ICS / external calendar sync; reminder changes; team-mode calendars.
- Locale-driven week start (Sunday-first matches the current product convention).
- Any new database column — v1 is a pure view over `dueDate`/`dueTime`; the only
  API changes are read-only filters.
