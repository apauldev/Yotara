# Plan: Safely decompose the task services

**Date:** 2026-11-19  
**Status:** Proposed  
**Priority:** Public-beta safety; no product behavior changes  
**Related:**
- `apps/api/src/services/task-service.ts`
- `apps/api/src/services/task-service.test.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/frontend/src/app/core/services/task.service.ts`
- `apps/frontend/src/app/core/services/task.service.spec.ts`

## 1. Goal

Reduce the size and mixed responsibilities of the frontend and backend task services through six narrow, reviewable extractions: three backend changes and three frontend changes.

This is an internal refactor. Keep API routes, request and response shapes, database schema, task rules, and user-visible behavior unchanged. Preserve existing service imports and the frontend `TaskService` public surface during the work so the UI and routes do not need a coordinated migration.

The current backend service is about 1,000 lines and combines queries, writes, recurrence, and archive/trash lifecycle. The frontend service is about 975 lines and combines HTTP calls, reactive task views, calendar state, mutations, and view helpers. Their existing specs are larger than the services, which makes preserving their current coverage important.

## 2. Safety rules

- Keep one extraction per commit, and include the six ordered commits in one PR. Do not merge or deploy a partial sequence; the base branch should move from the monolith to the complete decomposition in one merge.
- Keep the commits small and independently reviewable. The single PR is the release and rollback unit; the commit boundaries make the review easier without exposing an intermediate architecture to the rest of the codebase.
- Move code without changing its behavior. Do not include unrelated bug fixes, query changes, schema changes, or endpoint changes.
- Keep current import paths and public signatures working throughout the sequence. `task-service.ts` remains a backend compatibility façade; frontend consumers continue using `TaskService`.
- Preserve transaction boundaries and transaction-scoped database handles. Recurrence materialization and batch updates must remain atomic.
- Preserve the frontend's root-scoped singleton behavior, auth transitions, refresh semantics, loading/error states, and label/project invalidation.
- Keep the existing monolithic backend and frontend service specs intact and running through their compatibility façades throughout these six PRs. Add focused module specs for the new seams; do not delete, rewrite, or trim the legacy specs as part of this refactor.
- Do not deploy a slice that fails its focused checks. If a slice causes a behavior or contract change, revert that slice and revise the extraction before continuing.

## 3. Proposed structure

### Backend

- `task-query-service.ts`: filters, list/read operations, and transaction-aware owner lookup.
- `task-mapper.ts`: database-row-to-`Task` conversion.
- `task-write-service.ts`: create, update, batch update, and recurrence materialization.
- `task-retention-service.ts`: completed-task cleanup, deletion, restore, and retention-window behavior.
- `task-policy.ts`: shared completion/archive policy helpers used by writes and retention, including the archive-auto-delete preference lookup.
- `task-recurrence.ts`: pure recurrence-date calculation used by the write workflow.
- Existing `task-service.ts`: re-export the current public functions and types from these modules. Existing imports in routes, projects, and tests remain valid.

Keep the synchronous owner lookup usable by write operations with the caller's transaction. Keep the module dependency direction one-way: mapper and policy helpers are lower-level; query operations can be used by write and retention operations; write and retention must not import from each other; the façade only re-exports. Avoid introducing a generic repository layer unless extraction proves one is necessary.

### Frontend

- `task-api.service.ts`: HTTP requests and endpoint serialization only; no signals or refresh policy.
- `task-list.store.ts`: auth-aware task lists, list filters, and list-specific loading/truncation state.
- `task-calendar.store.ts`: calendar-range and undated-task state, including their loading/truncation behavior.
- Existing `TaskService`: compatibility façade and mutation coordinator. It keeps the public API used by components, delegates requests and reads, and coordinates task refresh plus label/project invalidation.
- `TaskRefreshState`: a small shared refresh/version signal used by the façade and both stores. Introduce it before extracting list state so stores never depend on `TaskService` and create a circular dependency.

Keep `allActiveTasks` in the list store and `undatedTasks` in the calendar store. The calendar header may use `allActiveTasks` for its approximate no-date count while the drawer's lazy `undatedTasks` request is pending. The calendar store must not trigger a second all-active request; both values remain available through the `TaskService` façade.

## 4. Backend sequence: three changes

### BE-1 — Extract task queries and mapping

Move `TaskFilters`, `listTasksForOwner`, `getTaskForOwner`, `listSubtasks`, the transaction-aware synchronous owner lookup, and `toTask` into query/mapping modules. Re-export the existing names from `task-service.ts`.

**Safety focus:** Keep all filters, ownership conditions, ordering, pagination metadata, label loading, and deleted-project-name enrichment identical. Keep the owner lookup available to write logic with the same transaction handle.

**Gate:** Keep `task-service.test.ts` intact and passing through the old `task-service.ts` import path. Existing API query coverage and tests that depend on the project route's `toTask` import pass; API typecheck passes; route imports remain unchanged.

### BE-2 — Extract task write workflows

Move create, update, and batch update workflows into `task-write-service.ts`. Keep create and update's internal synchronous implementations together so recurring-task materialization can call task creation inside the same transaction. Move the pure recurrence-date calculation to a helper only if it does not change when or how recurring tasks are created.

**Safety focus:** Preserve validation, status normalization, labels, sections, notifications, parent/subtask rules, recurrence limits, and transaction behavior. Keep `normalizeStatusOnCompletion` and archive-auto-delete policy in the shared policy module so write and retention code do not depend on each other. Batch updates must remain atomic, and a recurring task instance must still be created in the completion transaction.

**Gate:** Keep `task-service.test.ts` intact and passing through the old `task-service.ts` import path. Existing API tests for create/update, recurrence, labels/notifications, and batch updates pass; API typecheck passes; no route or DTO changes.

### BE-3 — Extract archive and deletion lifecycle

Move archive cleanup, clear-completed, delete, and restore behavior into `task-retention-service.ts`. Re-export all existing functions from `task-service.ts`.

**Safety focus:** Preserve the 30-day recovery/retention window, permanent-archive behavior, owner scoping, project deletion-batch restore semantics, and transactional delete/restore behavior.

**Gate:** Keep `task-service.test.ts` intact and passing through the old `task-service.ts` import path. Existing API tests for completed-task cleanup, deleted-task retention, delete cascades, and restore behavior pass; API typecheck passes.

## 5. Frontend sequence: three changes

### FE-1 — Extract HTTP transport

Move direct `HttpClient` calls and URL/query construction into `TaskApiService`. Include read and write endpoints, export, subtasks, archive, trash, restore, and batch calls. Keep `TaskService` methods and return types stable as delegating wrappers.

**Safety focus:** Preserve query parameters, credentials, timezone handling, pagination sizes, response mapping, and error propagation. Do not move refresh or UI error policy into the API service.

**Gate:** Keep `task.service.spec.ts` intact and passing against the `TaskService` façade. Add focused `TaskApiService` specs for transport behavior where the existing suite does not cover it; frontend typecheck/build passes; no component imports change.

### FE-2 — Extract list-view state

First introduce `TaskRefreshState`, then move auth-aware list streams and list-specific state into `TaskListStore`: recently completed, today, overdue, inbox, upcoming, completed-today, `allActiveTasks`, and filter-driven results. Keep `TaskService` exposing the same signals, methods, and types through delegation.

**Safety focus:** Preserve behavior on sign-in, sign-out, user changes, refreshes, filter changes, truncation, and loading/error states. Keep list sorting and parent/subtask filtering identical.

**Gate:** Keep `task.service.spec.ts` intact and passing against the `TaskService` façade. Add focused list-store specs only where the old service spec did not protect auth/refresh transitions; frontend typecheck/build passes. The façade, list store, and calendar store consume the shared refresh state without depending on one another cyclically.

### FE-3 — Extract calendar and undated state

Move calendar-range requests, range normalization/readiness, merged grid/focus results, and lazy undated-task loading into `TaskCalendarStore`. Preserve the current `TaskService` façade members used by calendar and other components. Keep the approximate no-date header count sourced from `allActiveTasks` while the lazy drawer request is pending; do not duplicate the all-active fetch in `TaskCalendarStore`.

**Safety focus:** Preserve bounded range requests, focus-window deduplication, refresh behavior, per-user reset behavior, retry after failure, and truncation/loading flags.

**Gate:** Keep `task.service.spec.ts` intact and passing against the `TaskService` façade. Add focused calendar-store specs for range deduplication, auth reset, failed-load retry, and truncation; frontend typecheck/build passes.

## 6. Delivery and rollback

Deliver in this order: BE-1, BE-2, BE-3, then FE-1, FE-2, FE-3. Keep each extraction in its own commit on one feature branch, then review and merge all six together in one PR. Do not merge or deploy intermediate commits. Run focused checks for each slice as it is added, then run the full repository CI suite on the completed PR before merging.

For the PR:

1. Confirm the diff is primarily code movement and delegation; review for accidental logic changes.
2. Run the focused existing tests for the extracted behavior and the relevant package typecheck/build.
3. Run the repository's full CI checks on the complete six-commit PR before merging.
4. Smoke-check task create, edit, complete/uncomplete, delete/restore, list filters, and calendar loading in the beta environment after the merge and before release.

If a regression appears before merge, fix or revert the affected commit on the feature branch. If a regression appears after merge, revert the PR as one unit. Because the refactor preserves public contracts and requires no database migration or API rollout, the previous monolith remains a straightforward rollback point.

## 7. Completion criteria

- [ ] All six ordered extraction commits are included in one reviewed PR and merged together.
- [ ] Existing backend route/service imports and frontend `TaskService` consumers remain compatible.
- [ ] Existing monolithic behavioral specs remain intact and pass through the façades; focused specs cover the extracted modules where needed.
- [ ] API and frontend typecheck/build checks pass, and full CI passes before beta release.
- [ ] Smoke checks confirm core task flows, list filters, calendar loading, archive, and trash still behave as before.
- [ ] No endpoint, DTO, database, or user-visible behavior changed as part of the refactor.
- [ ] Remaining `TaskService` classes are small compatibility/coordinator surfaces, not containers for query or view-state implementations.
