# Plan: Task quick actions menu

**Date:** 2026-11-15  
**Status:** Proposed  
**Related code:**
- `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts` — shared task card, metadata, selection, and existing actions
- `apps/frontend/src/app/features/personal/pages/task-list-page/task-list-page.component.html` — task card placement on the main task surface
- `apps/frontend/src/app/core/services/task.service.ts` — task updates
- `apps/frontend/src/app/core/services/status.service.ts` — toast notifications for updates and errors
- `apps/frontend/src/app/core/services/project.service.ts` — project options
- `apps/frontend/src/app/core/services/label.service.ts` — label options

---

## 1. Goal

Let users make common task edits directly from the task row, without opening the full task editor. Add an overflow (three-dot) action button on the right side of the task card. Its menu provides quick changes for:

- **Schedule presets** (Today, Tomorrow, Next week, No date)
- **Priority** (High, Medium, Low)
- **Labels** (called “Tags” in the UI if that matches the product's existing language)
- **Project** (with “No project” option)
- **Direct actions:** “Open details” and “Delete task” (with confirmation)

The action menu remains open while users make selections, so they can change more than one property in one visit. Selections update a local draft only. When changes have been made, a “Reset changes” action becomes available at the top of the menu to restore original values.

When the menu is dismissed by clicking outside:
- The popover closes immediately.
- The task card updates optimistically with the draft values.
- If changed fields exist, send a single task update containing only the diff.
- On success, display a brief “Task updated” toast notification.
- On failure, show an error toast and revert the card to its previous state.
- If nothing changed, close immediately with no API call.

Pressing **Escape** discards draft changes and closes the menu immediately without saving.

## 2. Existing UI context

`PersonalTaskCardComponent` is shared across multiple personal task surfaces and already renders priority, label chips, project metadata, completion, and other task actions. Implementing the menu in this component makes the affordance available consistently wherever the card is rendered. Check mode variants and completed/compact card states so the new control does not crowd or conflict with existing actions.

Use the existing `TaskService`, `ProjectService`, and `LabelService` for updates and options. Do not duplicate task mutation rules in the component.

## 3. Interaction model

### Trigger and placement

- Add an icon-only three-dot button in a dedicated trailing column in `PersonalTaskCardComponent` (`grid-template-columns: auto minmax(0, 1fr) auto;`).
- This guarantees the trigger stays pinned at the top-right corner of the card across all viewport sizes, without wrapping when `.task-title-row` flexes to column on narrow screens (<720px).
- Give it a task-specific accessible name, such as “Quick actions for [task title]”.
- On touch layouts (`pointer: coarse`), maintain at least a `min-width: 2.75rem` / `min-height: 2.75rem` (44px) touch target consistent with the card's existing touch accessibility standards.
- The popover overlays surrounding content without changing task-row height or reflowing the list. Render using `@spartan-ng/brain/popover` (built on Angular CDK Overlay) into the body container so it is never clipped by scrollable parent containers (`overflow: hidden` / `overflow-y: auto`).
- Clicking the trigger must not activate the card's normal select/open behavior.
- Only one task quick-action menu may be open across the application at a time, coordinated via a shared active menu identifier (e.g., `activeQuickActionTaskId`).

### Menu sections and selection behavior

- **Header / Actions Bar:** When the local draft differs from the initial task values, show a “Reset changes” button at the top of the menu to discard pending draft selections and restore original values without closing the menu.
- **Scroll & Max-Height:** The menu uses a constrained maximum height (e.g. `max-h-80` / `20rem`) with `overflow-y: auto` to prevent overflowing smaller screens.
- Use clear, labeled groups for **Schedule**, **Priority**, **Labels**, and **Project**, followed by a divider with direct task actions.

| Group | Selection behavior | Check mark / Visual Indicator |
|---|---|---|
| Schedule | Single-select presets: Today, Tomorrow, Next week, No date | Active preset is checked. Displays formatted date if current task date is not one of the presets. |
| Priority | Single-select: high, medium, low | Exactly one current value is checked, using priority colors. |
| Labels | Multi-select with inline search filter | Each currently attached label is checked; toggling a label updates the local draft immediately and preserves other attached labels. Uses `<app-label-icon>` with color. |
| Project | Single-select with inline search filter, including “No project” | Exactly one current choice is checked; uses project accent dot. |

Show the task's current values when the menu opens. Keep check marks and selections in sync with the local draft while the menu is open.

### Direct task actions (footer / bottom row)

Separated by a divider at the bottom of the popover:
- **Open details:** Emits `select` to open the full `PersonalTaskModalComponent` and closes the popover.
- **Delete task:** Styled in danger tone. Clicking closes the popover and opens `ConfirmDialogComponent` ("Delete task? This will permanently remove this task and cannot be undone."). On confirmation, calls `taskService.deleteTask(taskId)` and displays a `"Task deleted"` toast notification via `StatusService`.

### Large option lists

- Include an inline search/filter within the **Labels** and **Project** groups (similar to `PersonalTaskModalComponent`) so long lists can be quickly filtered. Do not add nested hover-only submenus.
- Show an empty state when the user has no labels or projects, with a link/action to the existing creation flow only if that can be opened without losing the task context.
- Keep list ordering stable and predictable; use the established project and label ordering.

### Dismissal and navigation

- **Click anywhere outside the trigger and menu (including elsewhere in the task card) or clicking the same trigger:**
  - Close the popover immediately.
  - If the draft has changed: optimistically update the task card metadata, dispatch a single task update with only the changed fields, and display a brief “Task updated” toast notification via `StatusService` upon successful save.
  - If the save fails in the background: display an error toast via `StatusService` and revert the task card to its prior state.
  - If the draft is unchanged: close immediately with no API call.
- **Escape:**
  - Discard all draft changes immediately, revert selections, close the popover without saving or making API calls, and return focus to the trigger.
- **Opening another task menu:**
  - Coordinated via the shared active menu state. Opening a new menu triggers the previous menu to immediately commit its draft optimistically, close, and notify, while opening the new menu cleanly.
- **Component teardown during save:**
  - If the user navigates away or the task card is unmounted (`ngOnDestroy`) while a background save is in flight, the update promise is executed safely through `TaskService` so the save completes and is not dropped.
- Clicking an option updates only the local draft and keeps the menu open.
- Clicking or interacting inside the menu must not trigger the task card's normal select/open behavior.
- On touch devices, use the same explicit trigger and outside-tap dismissal; do not rely on hover.

## 4. Update behavior and errors

- Reuse existing task-update APIs and service methods so labels, project ownership, schedule, priority, and other invariants remain enforced.
- Stage selections locally; on dismissal, diff dueDate, priority, labels, and project against the task values from when the menu opened and send only changed fields in one `updateTask` call. Skip the call if the diff is empty.
- Close the menu immediately on dismiss and apply changes optimistically to the card.
- On success, confirm the save and show a brief “Task updated” toast notification using `StatusService`.
- On failure, revert the card's optimistic state to its previous snapshot and show a concise error toast using `StatusService`.
- Task deletion triggers the standard delete flow via `taskService.deleteTask`, removing the task from state and notifying via `StatusService`.
- Handle rapid changes safely by saving one snapshot of the draft at a time; do not let an older response overwrite a newer draft.
- Do not add a separate Save button in v1; dismissing the menu commits its draft.
- Completed tasks can still be reclassified or deleted unless existing product rules prohibit it. Respect current task-service behavior and confirm visually that completed task controls remain usable.

## 5. Accessibility and responsive behavior

- Use a real button trigger and an accessible popover/menu pattern with labels and relationships (`aria-haspopup`, `aria-expanded`, and appropriate menu/group semantics).
- Support keyboard opening, arrow/tab navigation appropriate to the chosen menu pattern, selection, and Escape dismissal.
- Preserve visible focus indicators and ensure the menu is usable without a pointer.
- Ensure option rows have adequate touch target size; the menu should fit the viewport and reposition above/left when it would otherwise overflow.
- Prevent task-card click and keyboard shortcuts from firing when the trigger or menu receives interaction.
- Avoid announcing the entire option list on every task-card render; provide useful labels for the trigger and current selection.

## 6. Visual design

- Match current task-card spacing, typography, icon style, and surface tokens.
- Keep the trigger visually quiet at rest and provide clear hover, focus, and pressed states. On touch layouts, keep it visible rather than hover-only.
- Use check marks plus text to communicate selected states; do not rely on color alone.
- Give the menu a clear separation from the task content and a high enough stacking order to overlay adjacent cards and scroll containers.
- Preserve the existing task-card layout on compact and calendar-derived surfaces. If the card mode has insufficient space, retain the action but use a compact trigger/hit area consistent with the surface.

## 7. Out of scope for v1

- Full custom calendar grid picker and time-of-day selection (handled in full task modal; menu supports presets).
- Bulk actions across multiple tasks.
- Creating or editing projects or labels inside the menu.
- Undo, multi-action drafting, or explicit Save/Cancel buttons.
- Assignees or team-specific fields.
- Keyboard shortcut customization.

## 8. Implementation outline

1. Update `PersonalTaskCardComponent` layout to a 3-column grid (`grid-template-columns: auto minmax(0, 1fr) auto;`) so the 3-dot button stays pinned top-right across default, compact, and mobile (<720px) views, with 44px touch targets on coarse pointers.
2. Implement the popover using `@spartan-ng/brain/popover` (CDK Overlay) to ensure it renders in the top-level portal without container clipping.
3. Coordinate open menu state (e.g. via a shared service or signal) so only one task menu is open at a time across the screen.
4. Support the local draft, “Reset changes” header action, and Escape cancellation.
5. Add schedule presets (Today, Tomorrow, Next week, No date), priority options, and searchable label/project lists with icons/dots.
6. Add the footer action row with “Open details” and “Delete task” (integrating `ConfirmDialogComponent`, `TaskService.deleteTask`, and `StatusService`).
7. Wire up optimistic updates and background diff save on dismiss with `TaskService.updateTask(...)`, showing a “Task updated” success toast or an error toast with rollback via `StatusService`.
8. Ensure teardown resilience so unmounting or navigating away while a save is in flight does not abort the update.
9. Add component specs for open/close, draft staging, reset changes, schedule presets, Escape discarding, optimistic save on dismiss, revert on failure, deletion confirmation, toast triggers, and outside-click handling.
10. Verify the menu on default and compact cards, desktop and touch-sized viewports, and completed tasks.

## 9. Acceptance criteria

- [ ] A three-dot action button appears pinned at the top-right of supported task cards and does not trigger task selection.
- [ ] The popover overlays content using CDK Overlay without changing card height, list layout, or getting clipped by scrollable containers.
- [ ] Schedule offers quick presets (Today, Tomorrow, Next week, No date) and checks the matching value.
- [ ] Priority offers high/medium/low and shows exactly one checked choice.
- [ ] Labels support multiple checked choices with inline search and toggling preserves all other labels.
- [ ] Project offers existing projects plus “No project” with inline search and shows exactly one checked choice.
- [ ] After changing any option, the popover remains open and reflects the local draft.
- [ ] When the draft differs from the original values, a “Reset changes” button appears at the top of the menu to revert selections back to original values without closing.
- [ ] Clicking “Open details” closes the popover and opens `PersonalTaskModalComponent`.
- [ ] Clicking “Delete task” closes the popover, opens a confirmation dialog, deletes the task via `TaskService.deleteTask`, and shows a `"Task deleted"` toast.
- [ ] Clicking outside the menu, clicking the trigger, or opening another task's menu closes the popover immediately and optimistically updates the task card.
- [ ] On dismiss with changes, a single background diff update is dispatched; on success, a “Task updated” toast notification is shown via `StatusService`.
- [ ] If the background save fails, the task card reverts to its previous state and an error toast is displayed.
- [ ] If no changes were made, dismissing the menu closes immediately without an API call or toast.
- [ ] Pressing `Escape` discards all pending draft changes, reverts selections, and closes the popover immediately without saving.
- [ ] Only one task quick-action menu can be open at a time; opening a new menu commits any active menu's draft and closes it.
- [ ] Component unmounting or navigation during an in-flight save completes safely.
- [ ] Keyboard and touch users can open, navigate, select, and dismiss the menu with appropriate touch target sizing (44px).
- [ ] Existing task-card click, completion, archive, restore, and other actions continue to work.
