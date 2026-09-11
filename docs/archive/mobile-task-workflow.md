# Mobile task workflow — complete (Tasks 1–4 implemented and gated)

> **Archived 2026-09-10 — historical snapshot.** Not maintained. Kept for context
> only; current status lives on the
> [Yotara Roadmap](https://github.com/users/apauldev/projects/1) board and in
> GitHub Issues. See [docs/archive/README.md](./README.md) for the policy.


> All exit criteria met: unit 738 + API 258 green; desktop E2E 53/53, mobile E2E 13/13, login/onboarding 26/26; format/lint/typecheck/build green.

## Task 1: Extend shared modal shell — done

Make `app-modal` support a composable full-height layout with a projected footer, while preserving all existing consumers.

Files:

- `apps/frontend/src/app/shared/ui/modal/modal.component.ts`
- `apps/frontend/src/app/shared/ui/modal/modal.component.html`
- `apps/frontend/src/app/shared/ui/modal/modal.component.scss`
- `apps/frontend/src/app/shared/ui/modal/modal.component.spec.ts`

Scope:

- Add a full-height/composable layout option that makes the card a constrained flex column with one explicit body scroll region and a non-scrolling footer.
- Add a projected `[modal-footer]` region.
- Prefer an element marked `autofocus` before falling back to the first focusable element.
- Restore focus only when the original trigger is still connected.
- Preserve and restore the previous body overflow value, including on destruction.
- Keep Escape and Tab handling local to the dialog.
- Add safe-area-aware mobile padding and `overscroll-behavior: contain` without changing the default modal layout unexpectedly.

Exit criteria:

- Existing modal consumers still render and behave unchanged.
- New unit tests pass for autofocus preference, Tab/Shift+Tab trapping, Escape, focus restoration, detached-trigger safety, body-style restoration, and projected footer.

## Task 2: Migrate task modal shell and responsive layout — done

Replace the task modal's custom overlay with `app-modal` and establish explicit desktop/mobile scroll ownership.

Files:

- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.ts`
- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.html`
- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.scss`
- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.spec.ts`

Scope:

- Replace the custom shell/backdrop/dialog with `app-modal` using the full-height layout.
- Remove `HostListener('document:keydown')`, manual body/html overflow locking, manual `touchAction` mutation, and native subtask `autofocus`.
- Desktop above ~960px: preserve the two-pane main/details composition with explicit scroll ownership per pane.
- Tablet ~720-960px: single content column.
- Mobile <=720px: one vertical scroll container for form content and a fixed, safe-area-aware footer outside it.
- Keep current signals, hydration, save payloads, and task service calls unchanged.

Exit criteria:

- Desktop CRUD behavior unchanged.
- Mobile has exactly one effective scroll container and a visible fixed footer.
- Existing task-modal unit tests still pass.

## Task 3: Mobile disclosure, form semantics, and touch targets — done

Make mobile task creation shorter and accessible.

Files:

- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.ts`
- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.html`
- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.scss`
- `apps/frontend/src/app/features/personal/components/personal-task-modal.component.spec.ts`
- `apps/frontend/src/app/shared/ui/date-picker/date-picker.component.ts` (only if trigger attribute API is needed)
- `apps/frontend/src/app/shared/ui/markdown-editor/markdown-editor.component.css` (only if mobile overflow requires it)
- `apps/frontend/src/app/shared/ui/markdown-editor/format-toolbar.component.ts` (only if mobile overflow requires it)

Scope:

- Keep Title, Description, Subtasks immediately available; add a native **More details** disclosure with `aria-expanded`/`aria-controls`.
- Collapse advanced metadata by default for new tasks on mobile; auto-expand when editing a task with meaningful metadata.
- Preserve draft values when collapsed; expand before focusing an invalid advanced field.
- Add stable `id`, `aria-invalid`, and `aria-describedby` for title and due-date errors.
- Add `aria-pressed` to labels, priority, and weekday choices; group priority and weekday controls with accessible labels.
- Announce save failures as blocking errors; keep routine status updates polite.
- On failed submit, focus and scroll to the first invalid field.
- Focus title on open; restore focus to the invoking control on close.
- Keep draft-subtask removal visible on touch and keyboard layouts with task-specific accessible names.
- Programmatically focus inserted subtask input; return focus to Add subtask after cancellation.
- Use at least 44px hit areas for close, priority, palette, calendar nav/clear, checkboxes, weekday controls, subtask actions, and draft removal where targets do not collide.
- Keep mobile `input`/`select`/`textarea` font sizes at 1rem or larger.
- Add consistent `:focus-visible` states.

Exit criteria:

- New task-modal unit tests pass for disclosure state, edit-mode expansion, selected-state ARIA, field error associations, first-invalid focus/expansion, visible draft removal, save error announcement, and controlled subtask focus.
- No horizontal overflow at 320px.

## Task 4: Mobile shell, FAB, task card, and mobile E2E — done

Tighten the surrounding mobile workflow and add mobile regression coverage.

Files:

- `apps/frontend/src/app/features/personal/shell/personal-shell.component.html`
- `apps/frontend/src/app/features/personal/shell/personal-shell.component.css`
- `apps/frontend/src/app/features/personal/pages/task-list-page/task-list-page.component.scss`
- `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts`
- `apps/frontend/src/app/features/personal/components/personal-task-card.component.spec.ts`
- `apps/frontend/playwright.config.ts`
- `apps/frontend/e2e/specs/authenticated/task-modal.mobile.spec.ts`

Scope:

- Recompose the mobile topbar into a compact first row plus a second-row search; reduce unintended wrapping below 720px.
- Add safe-area top padding; keep dropdowns within the viewport.
- Reset collapsed-sidebar label/icon styles while the mobile drawer is open.
- Add safe-area-aware bottom/right FAB offsets and increase page bottom clearance so the FAB cannot cover the last task or pagination.
- Reduce low-value metadata pressure on narrow cards; allow titles/metadata to wrap safely instead of forcing horizontal overflow.
- Preserve keyboard activation and nested-control event isolation.
- Add a dedicated authenticated mobile Playwright project using a stable device profile.
- Add mobile task-modal coverage for sheet geometry, focus entry/restore, focus trapping, one-scroll-container/footer visibility, disclosure behavior, advanced-field usability, validation semantics/focus, touch-independent draft removal, FAB clearance, and horizontal overflow.
- Preserve all existing desktop CRUD tests.

Exit criteria:

- Mobile E2E project runs green.
- No horizontal overflow at 320px.
- Full validation gate passes: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, desktop E2E, mobile E2E.
