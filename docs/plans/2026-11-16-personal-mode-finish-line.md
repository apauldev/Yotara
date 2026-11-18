# Plan: Complete Yotara's personal project experience

**Date:** 2026-11-16  
**Status:** Product and UX decisions recorded; implementation not started  
**Goal:** Finish the personal-mode project workflow, close the migration gap, and polish the daily task loop. Then treat personal mode as feature-complete for its intended audience unless user evidence identifies a concrete gap.

## 1. Product scope

Yotara remains a calm, self-hosted personal task manager. This plan completes project lifecycle and navigation, adds lightweight organization for larger projects, supports migration into Yotara, and removes avoidable friction from capture and completion.

The work is deliberately not a team product expansion. Do not add assignments, custom task statuses, cycles, initiatives, portfolio views, or required boards.

## 2. Decisions to use during implementation

These are product decisions, not open design questions for the implementing agent.

### Project kinds and starter spaces

- A **Project** is a finite outcome. It can have a target date and completion progress, and can be marked complete.
- An **Ongoing area** is a continuing part of life or work, such as Work, Home, Health, or Finance. It has an open-task count, but no completion percentage, target date, or Complete action.
- Store this as a project kind on the existing project record. Do not build a separate Areas hierarchy or parent/child projects in this work.
- The seven onboarding defaults (`Work`, `Personal`, `Home`, `Health`, `Finance`, `Learning`, `Side Projects`) are Ongoing areas. Users can change their kind later.
- New projects default to **Project**. The create/edit form has a two-choice control labelled **Project** and **Ongoing area**, with one sentence of helper copy explaining the difference.

### Project lifecycle

- Active finite projects can be **Completed** only when they have no open tasks. If tasks remain, disable the action and show the open count with a link/action to return to those tasks; do not silently complete, delete, or move them.
- Completing a project is an explicit action. With no open tasks, it records a completion timestamp and moves the project from Active to Completed. It does not alter its tasks. Show a brief **Project completed · Undo** toast; do not interrupt completion with a modal.
- Completed projects can be **Reopened**. Reopening returns them to Active and clears the project completion timestamp.
- Active or Completed projects can be **Archived**. Archive is for putting a project away, whether it was finished or abandoned; it is separate from completion.
- Archiving a project does not change its tasks. Dated open tasks remain visible in Today, Upcoming, and Calendar. Undated tasks remain attached to the project and are accessible from its archived detail page. Do not make tasks disappear because their container was archived.
- Archived projects can be restored to their prior Active or Completed state.
- Deleting a project requires a confirmation dialog with two explicit choices:
  1. **Delete project, keep tasks** (primary/safe choice): detach tasks; preserve due dates, labels, descriptions, and completion state. Undated open tasks become Inbox items under the existing Inbox rules.
  2. **Delete project and tasks** (danger choice): soft-delete its tasks through the existing task recovery path.
- Project archive/delete actions revoke any active public share immediately.
- Keep `retiredAt` behavior for the legacy Inbox migration. Do not repurpose it as project archival; add distinct lifecycle fields and document the legacy field's role.

### Projects directory and navigation

- The Projects directory has three tabs: **Active**, **Completed**, and **Archived**. Active is the default. Show a count on each tab when nonzero.
- Replace the computed `active` / `inactive` badge with the real lifecycle state. Ongoing areas show an **Ongoing** type label; they never show a progress percentage.
- Active finite project rows show name, optional target date, open task count, completed/total count, and a quiet progress bar. Completed and archived rows show their state and open-task count where relevant.
- Project order is persistent and manual. Provide a visible drag handle in the directory; new projects go at the end. Also provide **Move up** / **Move down** actions for keyboard and touch users. Do not sort by last-updated time.
- Pinning is independent of project kind and lifecycle. A pinned project appears in the sidebar; pinning does not turn a project into an Ongoing area.
- Add a collapsible **Pinned projects** sidebar group with each pinned project's color dot, name, and open-task count. Include a small `+` action to create a project and a **All projects** link. Hide the group when nothing is pinned. Do not pin onboarding defaults automatically.
- Pin/unpin from the project row's overflow menu and the edit form. Keep one source of truth for the pinned state and order.

### Project detail and sections

- Keep the current list view as the default and only project task view in this plan. No Kanban board.
- The project header shows name, kind, lifecycle state, and target date when set. Its overflow/actions menu contains Edit, Pin/Unpin, Complete/Reopen when applicable, Archive/Restore, and Delete.
- Keep task counts secondary. Do not use a progress bar for Ongoing areas.
- Add optional, manually ordered **Sections** as visual headings inside a project. A section is not a status and does not change task scheduling.
- Existing tasks with no section remain as a flat task group at the top, without an extra “Unsectioned” heading. Sections follow in manual order. Users can collapse a section; collapsed state is a local display preference and does not affect tasks.
- Each section has an inline **Add task** action that creates a task in that project and section. The project-level **Add task** action creates an unsectioned task.
- Tasks can be moved between sections or back to Unsectioned from the task's project/section picker. Do not add nested sections or sections to global Today/Upcoming views.
- Completed tasks remain in the existing Completed group, visually grouped under their project section when possible. Section completion does not mark the project complete.
- Add sections only after lifecycle and ordering are shipped. An empty project starts as the current flat task list; do not pre-create example sections.

### Project description and target date

- Reuse the existing Markdown editor for project descriptions. In project detail, render the description as sanitized Markdown below the title; edit it from the project form.
- Add one optional **Target date** (date only) for finite Projects. It is a project-level goal, not a task due date or calendar event. Show it in the project header and directory row, and allow sorting/filtering by it only if the existing directory interaction needs it.
- Ongoing areas do not have target dates. Switching a project with a target date to Ongoing asks the user to clear the target date before saving.
- Do not add project start dates, milestones, health scores, or status update reports.

### Capture and completion polish

- Task completion is immediate by default, with an **Undo** toast. Set the existing preference default to no confirmation; retain the setting for users who explicitly want a prompt.
- Quick capture preserves its source context: Inbox creates unfiled tasks; Today creates tasks due today; a selected Calendar date creates tasks due that date; Project detail creates tasks assigned to that project (and to a section when started from that section).
- On Upcoming, quick capture opens a compact date chooser with **Tomorrow** selected, plus natural-language date entry. A task created there must not silently land in Inbox.
- Do not force project assignment or a detailed task form during quick capture.

### Data import

- Use `docs/plans/2026-11-15-data-import-engine-and-presets.md` as the import contract. This plan adopts its latest scope: browser-side parsing, generic CSV mapper, then a verified Todoist project CSV preset, one file per session, explicit preview, and transactional API writes.
- Do not implement speculative TickTick or Google Tasks presets, JSON import, multi-file queues, or a claim of complete account migration without real format fixtures and verified mappings.
- Import is an additive operation. Show warnings for unsupported fields and require confirmation before writing.
- Import entry point is Settings → **Import data**, beside existing Export controls.

### Read-only project sharing

- Keep `docs/plans/2026-10-25-read-only-project-sharing.md` as a later, separate feature after the core project and import work.
- UX: project menu → **Share read-only link**; owner can copy, regenerate, or revoke the link. Shared page shows project name, description, target date, task list, and progress for finite Projects. Ongoing areas show open tasks without a percentage.
- The link grants read-only access. Recipients cannot edit or complete tasks and do not need an account.
- Do not describe `robots.txt`, no-index headers, or secret URL fragments as a guarantee against scraping. Treat the URL as a bearer credential; define rate limits, secret handling, revocation, and the public endpoint threat model before implementation.
- Exclude PIN protection and link expiration from the first version unless a security review and user need justify them.

## 3. Delivery phases

### Phase 1 — Project lifecycle and recovery

- Add explicit project kind, `completedAt`, `archivedAt`, and deletion support without changing the legacy `retiredAt` migration behavior.
- Add service and authenticated API operations for completing/reopening, archiving/restoring, and deleting projects with the selected task-handling choice.
- Make multi-record project deletion transactional. Revoke sharing credentials in the same lifecycle transition if sharing already exists.
- Add the Active / Completed / Archived directory tabs, real state labels, lifecycle actions, and empty states.
- Ensure archived project tasks retain their existing Today / Upcoming / Calendar behavior.

**Done when:** a user can finish, reopen, archive, restore, or delete a project; each action preserves or changes tasks exactly as stated above; no action silently removes a dated task from a planning view.

### Phase 2 — Stable project organization

- Add `sortOrder` and `pinned` to project data and migrate existing projects to a deterministic order.
- Remove `updatedAt` ordering in the API and frontend. Use `sortOrder`, with name and ID as stable fallbacks.
- Add manual reorder controls in the directory and the collapsible pinned group in the sidebar.
- Add target date and Markdown project description to the project form and detail page.
- Add the Project / Ongoing area choice and update onboarding starter copy/defaults.

**Done when:** projects do not move after edits, users can deliberately reorder and pin them, and ongoing areas never display finite-project progress or completion controls.

### Phase 3 — Lightweight project sections

- Add sections and task-to-section assignment within a project only.
- Add section create, rename, delete, collapse, reorder, and task movement interactions.
- On section deletion, move its tasks to the unsectioned group; do not delete tasks. Confirm the section removal and state that its tasks will remain in the project.
- Keep quick capture from a section assigned to that section.

**Done when:** sections are optional headings that organize a long list without changing task status, dates, labels, or global views.

### Phase 4 — Import and daily-loop finish

- Implement the browser-side CSV import plan and expose it in Settings.
- Ship generic mapping and Todoist project CSV support only after fixtures verify the mapping and omissions.
- Apply context-preserving capture defaults across Inbox, Today, Upcoming, Calendar, and Project detail.
- Make completion one-step by default and provide reliable Undo feedback.

**Done when:** a new user can bring supported task data into Yotara with a clear preview, and creating/completing tasks from core views never makes the task unexpectedly disappear or lose its intended date/project.

### Phase 5 — Read-only sharing (separate release)

- Revisit and update the existing sharing plan's security assumptions before implementation.
- Build owner controls and public read-only view only after endpoint security review.

**Done when:** owners can revoke access immediately; public routes expose no task data without a valid secret; the UI makes the read-only nature and link sensitivity clear.

## 4. Out of scope

- Team workspaces, assignees, comments, activity feeds, custom task statuses, cycles, initiatives, workload dashboards, and required board views.
- Nested projects, project folders/Areas hierarchy, nested sections, project templates, and duplicate-project tooling.
- Project start dates, milestones, project health reporting, and team stakeholder updates.
- Import formats beyond the verified generic CSV and Todoist project CSV scope in the current import plan.
- Treating archive as task archive: project archive does not alter task state.

## 5. Code areas

- Domain/API: `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/src/services/project-service.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/project-utils.ts`, `packages/shared/src/domain.ts`, and shared project DTO/schema definitions.
- Project UI: `apps/frontend/src/app/features/personal/pages/projects-page.component.*`, `project-detail-page.component.*`, `personal-project-modal.component.ts`, `core/services/project.service.ts`, and `personal-shell.component.*`.
- Capture/completion: `task-list-page`, `calendar-page`, `personal-task-workspace`, `personal-task-card`, `TaskService`, and `PreferencesStore`.
- Import: use the existing settings entry point and the current import plan. Update the 2026-11-12 draft if it conflicts with the later 2026-11-15 import contract.
- Documentation: update `README.md`, `PROJECT_README.md`, and `docs/ARCHITECTURE.md` after the behavior ships. Correct any claim that project restoration already exists before implementation.

## 6. Verification requirements

- Add migration tests for existing databases, including the retired legacy Inbox project.
- Add service and route tests for all lifecycle transitions, ownership, task handling, rollback, and share revocation.
- Add frontend tests for tabs, disabled completion with open tasks, archive/delete dialogs, undo/restore actions, ordering, pinning, sections, and context-preserving capture.
- Add import fixtures and tests for valid, malformed, ambiguous-date, unsupported-field, repeated-import, and failed-transaction cases.
- Verify keyboard and touch use, especially drag-order alternatives, menus, section controls, and dialogs.
- Update OpenAPI schemas and product documentation with each shipped phase.

## 7. Personal-mode completion bar

After Phases 1–4, personal mode is considered feature-complete for the intended scope: capture, organize, plan, focus, finish, and migrate data. Phase 5 sharing is a differentiator and can ship independently; it is not a prerequisite for that declaration. Further personal-mode feature work should require a concrete user problem rather than feature parity with team project-management suites.
