# Plan: Inline `@project` capture with typing guidance

**Date:** 2026-11-02  
**Status:** Implemented  
**Related:** `docs/plans/2026-10-22-project-inline-shortcut.md` contains an earlier, more detailed proposal for inline project parsing. This plan restates the feature against the current capture implementation and adds the requested typing-time guidance.

## Goal

Allow assigning a project directly from the task capture bar using `@project`, while explaining the shortcut as the person types. Preserve the existing project dropdown as an alternative.

Example:

```text
Prepare slides tomorrow @Work !high #planning
```

This should create a high-priority task titled `Prepare slides`, due tomorrow, filed into the `Work` project, with the `planning` label.

## Current behavior confirmed in source

- `CaptureBarComponent` currently has a project dropdown, label suggestions on `#`, due-date previews, and keyboard navigation for label suggestions: `apps/frontend/src/app/features/personal/components/capture-bar.component.ts`.
- `parseTaskCommand` currently parses `!priority` and `#label`, but has no project field or `@` parsing: `apps/frontend/src/app/features/personal/utils/task-command-parser.ts`.
- The date parser masks supported priority and label tokens, but not `@` project tokens: `apps/frontend/src/app/features/personal/utils/task-due-date-parser.ts`.
- `TaskListPageComponent.handleCapture()` resolves labels and uses the selected dropdown project for quick creation and the details modal: `apps/frontend/src/app/features/personal/pages/task-list-page/task-list-page.component.ts`.
- `docs/plans/2026-10-22-project-inline-shortcut.md` already documents project-token precedence, token preservation, date-parser masking, and related tests. Reuse those decisions where they still fit; don’t copy stale code assumptions without checking the current implementation.

## Product and interaction decisions

1. `@` means project, `#` continues to mean label, and `!` continues to mean priority.
2. Typing a task title displays a quiet helper: **“Tip: type @ followed by a project name to file this task.”** The helper is visible while typing and is hidden when the capture field is empty.
3. As soon as the caret is in an `@` token, replace the generic helper with **“Choose a project for this task”** and show matching project suggestions. This message updates with the typed query; it is exposed as a polite live status for assistive technology.
4. Filter suggestions from the current project list, case-insensitively, with keyboard navigation matching the existing label-completion interaction. `ArrowUp`/`ArrowDown` changes the active suggestion; `Enter`/`Tab` selects; `Escape` closes suggestions without changing the title. `Enter` on the “No project named” row closes the list without submitting — a second `Enter` submits the capture.
5. Selecting a project inserts its canonical `@ProjectName` token in place of the partial token and returns focus to the capture input. Keep the existing project dropdown available.
6. A resolved inline project token takes precedence over the dropdown selection. No matching `@token` is preserved in the title and receives a clear message that it did not assign a project; it must not silently discard typed text.
7. For this iteration, project token names use the existing simple single-token grammar (`[\w-]+`), matching the current label shortcut. Project names with spaces or unsupported characters remain selectable through the dropdown. Treat support for multiword/Unicode project mentions as a follow-up rather than guessing token boundaries.
8. Parse inline tokens for new captures only. Never rewrite titles or reassign projects when editing an existing task.
9. Keep capture destination/status semantics unchanged; this change only adds project assignment from the title.

## Implementation outline

1. **Parser and tests** — extend `ParsedTaskCommand` to return a resolved project name and unresolved project names. Resolve `@name` case-insensitively against the live project list; strip only resolved tokens, preserve unresolved tokens, and use the first resolved project if multiple are present. Leave priority and label behavior unchanged.
2. **Date parsing and tests** — mask `@` command tokens with the existing `#` and `!` tokens before due-date interpretation, preserving offsets. Ensure ordinary email addresses such as `name@example.com` are not treated as project tokens.
3. **Capture-bar completion and guidance** — add project-query state and suggestions using the project input. Reuse the current completion keyboard behavior and safe token replacement approach. Add generic/helper, active-suggestion, and no-match copy as described above. Update highlighting so project tokens are distinguishable from labels and unresolved tokens are visibly preserved.
4. **Task creation flow** — pass current project names into parsing in `handleCapture()`. Resolve the returned project name to its ID; use it for both quick creation and create-with-details modal initialization. Keep inline-token-over-dropdown precedence. Existing-task edit flows remain untouched.
5. **Accessibility and responsive checks** — retain listbox semantics and active-option state; associate guidance with the input and announce changes politely. Check that the suggestion panel and helper do not obscure the due-date preview or project dropdown at narrow widths.
6. **Help copy** — update the capture hint/help text to document the three separate sigils: `!high`, `#label`, and `@project`.

## Tests and acceptance criteria

- Parser tests cover case-insensitive project resolution, unresolved-token preservation, duplicate/multiple tokens, mixed `@` + `#` + `!`, token boundary behavior, and unchanged legacy behavior when project names are not supplied.
- Due-date tests prove `tomorrow at 9am @Work` still produces the due date/time; combinations with labels and priorities also continue to work. Verify email addresses are not consumed as project tokens.
- Capture-bar tests cover the typing hint, transition to project-specific guidance, filtered suggestions, no-match guidance without title loss, arrow/Enter/Tab/Escape behavior, insertion at the caret, and non-interference with `#label` suggestions.
- Task-list page tests prove a resolved `@project` wins over the dropdown in quick capture and details-modal creation; unresolved tokens do not assign projects or disappear.
- E2E coverage creates a task with a seeded project and verifies its project, title, due date, priority, and label when combined in one capture string.
- Existing parser, capture-bar, task-list, task-modal, date-parser, typecheck, and frontend test suites pass.
- Visual verification confirms the inline hint and suggestion panel are legible and usable on desktop and mobile/narrow layouts.

## Out of scope

- Creating a new project from the `@` menu.
- Multiword or Unicode project names in inline tokens; project dropdown continues to support these names.
- Changing label syntax, priority syntax, task status, Inbox semantics, project model, or due-date grammar beyond masking command tokens.
- Global keyboard-shortcut help or unrelated capture-bar redesign.

## Suggested implementation order

1. Parser behavior and unit tests.
2. Date-token masking and regression tests.
3. Capture-bar project search, inline helper copy, keyboard behavior, and styles.
4. Task creation and modal project precedence.
5. Component/page/e2e regression tests and desktop/mobile visual checks.
6. Update user-facing shortcut help and verify affected frontend checks.

## Follow-up notes (Nov 3 fixes)

- Only inline-safe names (`isInlineTokenName`: `[\w-]` runs ending in a word character) are suggested for `@` and `#`; multiword and non-ASCII names stay dropdown/pick-list territory. When every `@` match is inline-unsafe, the muted row names the project and points at the project dropdown instead of claiming it does not exist.
- Submitting with unapplied or unresolved `@` tokens shows a warning toast (first match wins; unresolved tokens are kept in the title).
- Token boundaries never fall inside a letter, digit, combining mark, or hyphen, so `@Café`, `!high` + combining acute, and `@Q1-` are inert text and can never strip a shorter sibling out of the title.
