# Plan: Project detail experience

**Date:** 2026-11-16  
**Status:** UX decisions recorded; implementation not started  
**Scope:** Define and implement the project detail page: project summary, task organization, project actions, and responsive behavior. This is the UX authority for `/projects/:id` and the edit form. It does not replace or delete the broader personal-mode plan.

## 1. Goal

Make a Yotara project page a quiet place to understand the outcome, see remaining work, and add the next task. Keep the existing list-based task experience. Add lifecycle and lightweight structure without turning the page into a team dashboard.

## 2. Page layout

The page uses one column and the existing content width. Keep this order on desktop and mobile:

```text
← Projects

[color dot] Project name                       [•••]
             Project · Target date (optional)
             Short Markdown description

[12 of 18 tasks complete]  ━━━━━━━━━━━ 67%

To do (6)                                      [+ Add task]
  Unsectioned tasks, if any
  ▾ Planning (2)                               [+]
    task row
    task row
  ▾ Bookings (3)                               [+]
    task row

Completed (12)                                 [collapsed by default]
```

### Header

- Retain a **Back to Projects** link.
- Show the project color dot, name, and a compact type/state line.
- Show the optional target date beside the type for finite Projects. Use a quiet date label; overdue target dates use muted warning copy, not an alarming red banner.
- Render the Markdown description beneath the header, with a comfortable text width. Omit the description region when empty.
- Keep one overflow button (`•••`) for secondary project actions. Do not put a large Edit button and multiple lifecycle buttons across the header.
- The primary page action is **Add task**, aligned with the To do heading on wide screens and full-width or fixed to the bottom action area on narrow screens only if the existing mobile layout requires it.

### Finite Project summary

- Show `X of Y tasks complete` with a quiet progress bar. Compute from the project's tasks; no separate status heuristic.
- When open tasks remain, show **Complete project** as disabled in the overflow menu with helper text: `Finish or move the remaining N tasks first.` Link that helper to the open task list.
- When no open tasks remain, enable **Complete project**. Completing moves the page to Completed state and shows an Undo toast; do not show a confirmation dialog.
- A completed project displays a calm **Completed** badge and **Reopen project** action. Reopening restores it to Active.

### Ongoing area summary

- Show the **Ongoing area** type label and open-task count.
- Do not show a completion percentage, target date, or Complete action.
- Keep the same task list, task editor, task due dates, labels, and quick-add behavior as finite projects.

### Task list and sections

- Keep the current list presentation as the only view in this scope. Remove the decorative **List** view pill; there is no view switch until another view is intentionally designed.
- Keep open tasks first, in saved task order. The **Completed** group follows and is collapsed by default when it has tasks.
- Sections are optional, flat headings inside the project. They do not represent status or dates.
- Unsectioned tasks appear first as ordinary rows, without an “Unsectioned” heading. Then show sections in saved order.
- Each section header has its name, open task count, collapse control, and a small **Add task** action. New tasks created there inherit this project and section.
- The main **Add task** action creates an unsectioned task in this project.
- A task can be moved to another section or to **No section** from the task editor. No nested sections, drag-and-drop task board, or section filters in Today/Upcoming.
- Section deletion opens a confirmation: `Delete “Planning”? Its tasks will stay in this project.` Confirming deletes only the heading and returns its tasks to the unsectioned group.
- Completed tasks remain in Completed even if their former section is collapsed. Do not calculate project completion by section.

## 3. Project actions and dialogs

The overflow menu order is:

1. **Edit project**
2. **Pin to sidebar** / **Unpin from sidebar**
3. **Complete project** / **Reopen project** (finite Projects only)
4. **Archive project** / **Restore project**
5. Divider
6. **Delete project…** (danger styling)

Archive is not the same as completion. An archived project detail page remains readable and shows a slim banner: `Archived project · Its tasks still appear in your planned views.` The banner has **Restore project**. Archiving never changes task status, due dates, or project assignment.

Delete always opens a dialog with two clearly separate choices:

- **Delete project, keep tasks** — primary action. Tasks lose this project assignment but keep their dates, labels, descriptions, and completion state. Undated open tasks return to Inbox by existing Inbox rules.
- **Delete project and tasks** — danger action. Tasks use the existing soft-delete/recovery behavior.

The dialog names the project and task count. Cancel is the default focus; Escape cancels. Never hard-delete tasks or silently unlink them.

## 4. Project create/edit form

Use the same form for creation and editing, with these fields in order:

1. **Name** (required)
2. **Type** as two selectable cards: **Project** (`A finite outcome with progress and an optional target date.`) and **Ongoing area** (`A continuing part of life or work, such as Home or Health.`). Project is the default for new records.
3. **Description** using the existing sanitized Markdown editor and preview. Placeholder: `What is this project for? Add useful context or links.`
4. **Target date** (optional, Project type only; date-only picker)
5. **Color** using the existing palette
6. Footer actions: Cancel and **Create project** / **Save changes**

Changing a Project with a target date to Ongoing area asks the user to clear the target date before saving. Do not silently discard it. Changing Ongoing area to Project does not invent a target date.

Do not add start dates, owners, statuses, priorities, project templates, milestone fields, or team settings to this form.

## 5. Loading, empty, error, and responsive states

- **Loading:** retain the page shell and show a compact skeleton for header, summary, and task rows; avoid a full-page spinner.
- **Empty active project:** show `Start with one meaningful step` and a primary **Add first task** action. Do not show a zero-percent progress card before the first task exists.
- **No open tasks, completed tasks exist:** show the completion state and collapsed Completed group, with **Add task** still available for new work.
- **Empty Ongoing area:** show `Add the first task for this area` and the same quick-add action; no completion copy.
- **Load error:** retain the current retry state and **Try again** action.
- **Not found:** retain **Back to Projects**; do not expose whether a project belongs to another user.
- **Mobile:** stack header metadata; keep the overflow and Add task controls at least 44×44 px; prevent horizontal scroll in task rows; dialogs become a bottom sheet if that matches the shared modal behavior. Section actions remain visible without hover.
- **Keyboard:** all menu and section actions are reachable by keyboard. Provide Move up / Move down alternatives wherever ordering controls are introduced; drag must not be the only operation.

## 6. Build phases

### Phase A — Summary and type

- Add Project / Ongoing area kind and optional target date to shared DTOs, API validation, persistence, and migrations.
- Update the edit form with the fields and switching rules above.
- Render type-aware summary, description Markdown, target date, and correct progress visibility.

### Phase B — Lifecycle actions

- Add complete/reopen and archive/restore operations with timestamps and owner checks.
- Wire the header menu, completed state, archive banner, and Undo feedback.
- Keep open task count as the explicit completion gate. Preserve task planning behavior when a project is archived.

### Phase C — Sections

- Add flat project sections and optional task assignment.
- Implement section add, rename, collapse, reorder, delete, and task movement with the behaviors in this plan.
- Keep task ordering stable within unsectioned and section groups.

### Phase D — Delete and recovery

- Add project deletion with the two task-handling choices.
- Perform detachment/soft deletion and project deletion atomically.
- Ensure all routes and queries preserve existing Inbox, Today, Upcoming, Calendar, and task recovery behavior.

## 7. Implementation boundaries

- The broader [personal-mode finish-line plan](./2026-11-16-personal-mode-finish-line.md) covers import, cross-view capture, sidebar pinning, and overall personal-mode scope. Keep those items there; this document owns the detail-page interaction contract.
- The [read-only sharing plan](./2026-10-25-read-only-project-sharing.md) remains a later feature. Do not add a Share action before its endpoint security review.
- Keep `retiredAt` for legacy Inbox migration behavior. Use separate project lifecycle fields.
- The project detail is not a board, activity feed, messaging surface, or status-report dashboard.

## 8. Code areas and verification

Likely code areas:

- `apps/frontend/src/app/features/personal/pages/project-detail-page.component.*`
- `apps/frontend/src/app/features/personal/components/personal-project-modal.component.ts`
- `apps/frontend/src/app/features/personal/components/personal-task-workspace.component.*`
- `apps/frontend/src/app/core/services/project.service.ts`
- `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/src/services/project-service.ts`, and `apps/api/src/routes/projects.ts`
- `packages/shared/src/domain.ts` and the shared project DTO/schema definitions

Add migration, service, route, component, and interaction coverage for project type, lifecycle transitions, task preservation/deletion choices, target date, markdown rendering, section behavior, and keyboard/mobile operation. In particular, verify that archiving a project never hides dated tasks from Today, Upcoming, or Calendar, and that deleting a project cannot partially detach or soft-delete its tasks.

## 9. Acceptance criteria

- [ ] The page clearly distinguishes finite Projects from Ongoing areas.
- [ ] Finite Projects show progress and optional target date; Ongoing areas show neither.
- [ ] Completing is possible only when there are zero open tasks, is reversible with Undo, and does not alter tasks.
- [ ] Archive/restore preserves the project's prior active/completed state and never changes task dates or status.
- [ ] Delete presents both task-handling choices and applies them atomically.
- [ ] Project descriptions render sanitized Markdown and remain editable.
- [ ] Sections are optional flat headings; adding, collapsing, reordering, moving tasks, and deleting a section follow the defined behavior.
- [ ] The current list remains the sole task view; no decorative view switch, board, or team controls remain on this page.
- [ ] Empty/loading/error/not-found states and keyboard/mobile interactions follow this plan.
