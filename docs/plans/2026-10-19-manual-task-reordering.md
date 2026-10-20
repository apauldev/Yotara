# Plan: Manual Task Reordering (Container-Scoped Drag & Drop)

> **Status:** Proposed — 2026-10-19 (revised after implementation review against the codebase)
> **Owner:** @apauldev
> **Date:** 2026-10-19
>
> Add manual ordering via drag & drop to the project detail views: position data persisted in the existing `tasks.sort_order` column scoped to each task's container (project / parent), a server-side neighbor-splice reorder endpoint, and an optimistic client update. Cross-project views (Inbox, Today, Upcoming, overdue, calendar's No-date panel) are explicitly excluded from reordering and hardened against `sort_order` leakage. No schema migration.

---

## 1. Context & Motivation

A beta user (recorded 2026-10-19) asked to "drag the tasks up and down." Manual reordering is a headline feature of every mature task manager, and the codebase is already half-prepared for it:

1. **The position column exists but is never written.** `tasks.sort_order` is defined in `apps/api/src/db/schema.ts` (`order: integer('sort_order').notNull().default(0)`), surfaced on the shared `Task` type and `UpdateTaskDto` in `packages/shared/src/index.ts`, and accepted by `PATCH /tasks/:id` (`order: body.order ?? current.order` in `task-service.ts`). Nothing ever sets it: every create path hardcodes `order: 0`, so all lists resolve to creation order via the `created_at` tie-break.
2. **The project detail view already sorts by it** — twice, consistently: server-side in `listTasksForProject` (`project-service.ts`, `(order, createdAt, id)` in-memory sort) and client-side via `compareTasksByOrder` (`project-detail-page.component.ts`). That view is implicitly in "manual order" mode already.
3. **The drag-and-drop toolkit is proven in-house.** Angular CDK DragDrop powers calendar drag-to-reschedule (`calendar-month-grid.component.ts`: `DragDropModule`, `cdkDrag` + `[cdkDragDisabled]="!canDrag(task)"`, drag guards, `suppressClickUntil ≈ 250ms` click suppression, preview/placeholder CSS, desktop-only gating `[allowDrag]="!isMobile()"`), and the optimistic override-map rollback pattern lives in `calendar-page.component.ts` (`dueDateOverrides`).

**Which views are containers? (verified against the code, this is the load-bearing decision)**

A task's container is (`project_id`, `parent_id`): one ordered list per project's top-level tasks, one per parent's subtasks. Crucially:

- **The Inbox view is a cross-project lens, not a container.** `listTasksForOwner` with `filters.view === 'inbox'` selects `status = 'inbox'` (undated, active) tasks across **all** projects. Tasks are created with a project by default (`getDefaultProjectForOwner` even seeds a project literally named "Inbox" as the capture target), so "Inbox tasks" also appear in their project's view. Reordering the Inbox view would be reordering a lens over many projects — deferred to Phase B (Section 6), not approximated here.
- **Project detail views and the auto-seeded "Inbox" project page are true containers.** They are the v1 drag targets; `GET /projects/:projectId/tasks` returns the full unpaginated row set, which keeps client-side anchor computation exact.
- **Today / Upcoming / overdue are lenses too** (date-derived, cross-project). They stay non-draggable.

**Out of scope in v1** (natural follow-ups, each small and additive):

- Per-view ordering for Inbox/Today (a `task_view_orders` join — the Todoist `day_order` pattern; see Section 6).
- Subtask drag UI (subtask ordering data-path works; renumbering stays parent-scoped).
- Touch/mobile drag (matches the calendar's desktop-only precedent).
- Fractional/gapped position encoding (single-user SQLite makes dense renumbering cheap).
- A new sort control pill — no pill is needed because no new sortable view is added to Inbox/Today.

---

## 2. Proposed Changes

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ API Changes (apps/api/src/)                                              │
│  ├─ services/task-service.ts: create paths append to the container's     │
│  │                            bottom (MAX(sort_order)+1 within the       │
│  │                            container); new reorderTasksForOwner()     │
│  │                            splice + renumber in one immediate tx      │
│  ├─ services/task-service.ts: scope ORDER BY sort_order to container     │
│  │                            queries only; lens queries order by        │
│  │                            created_at (Task 3)                        │
│  └─ routes/tasks.ts: POST /tasks/reorder (neighbor-splice contract)      │
├──────────────────────────────────────────────────────────────────────────┤
│ Shared Types (packages/shared/src/)                                      │
│  └─ ReorderTaskDto { taskId, beforeId?, afterId? }                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Frontend Changes (apps/frontend/src/app/)                                │
│  ├─ features/personal/pages/project-detail-page: DragDropModule,         │
│  │    cdkDropList + cdkDrag bindings, drop handler, click suppression,   │
│  │    optimistic splice + rollback                                       │
│  └─ core/services/task.service.ts: reorderTask() (POST + refresh)        │
├──────────────────────────────────────────────────────────────────────────┤
│ Tests & Docs                                                             │
│  ├─ apps/api/src/services/task-reorder.test.ts (new)                     │
│  ├─ Playwright e2e: specs/authenticated/project-reorder.spec.ts (new)    │
│  └─ OpenAPI regeneration (pnpm docs:check CI stays green)                │
└──────────────────────────────────────────────────────────────────────────┘
```

No database migration: the existing column, canonical ordering rule
(`ORDER BY sort_order, created_at, id`), and all current views keep their
rendered behavior.

---

## 3. Detailed Tasks

### Task 1: Create paths append to the container's bottom

**Files to modify:**
- `apps/api/src/services/task-service.ts`

**Implementation details:**
Replace the three hardcoded `order: 0` create sites (top-level create, bulk
subtasks in `createTaskForOwnerSync`, bulk subtasks in `updateTaskForOwnerSync`)
with "next position in the task's container", computed with the transaction's
own `client` (all three sites already run inside a
`db.transaction(run, { behavior: 'immediate' })`):

```sql
SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE container-predicate
```

- Top-level: `project_id = :resolvedProjectId AND parent_id IS NULL`. Note that
  creates resolve a project before insert (`getDefaultProjectForOwner` seeds
  and returns the "Inbox" project when none is given), so the container is
  always a concrete project — not `project_id IS NULL`.
- Subtasks: `parent_id = :parentId` (matches `listSubtasks`, which already
  orders subtasks by the canonical rule).

No visible order change comes from this alone: ties still resolve by
`created_at`, so lists render identically until reordering begins.

---

### Task 2: `POST /tasks/reorder` — neighbor-splice endpoint

**Files to modify:**
- `apps/api/src/routes/tasks.ts`
- `apps/api/src/services/task-service.ts`
- `packages/shared/src/index.ts`

**Contract:**

```ts
// ReorderTaskDto (packages/shared)
{
  taskId: string;
  beforeId?: string | null; // insert immediately before this container sibling
  afterId?: string | null;  // insert immediately after this container sibling
}
```

- Exactly one of `beforeId` / `afterId` may be set, or both `null` → insert at
  the **start** of the container. Both set → 400.
- The client never sends indexes or full orderings. Anchoring on neighbor IDs
  is globally correct even for partially loaded containers, because
  "before/after" are stable points in the canonical order independent of what
  the client can see.

**Algorithm (single immediate transaction, following the services' existing
transaction convention):**

1. Load the dragged task; reject (400) if missing, not owned (404), deleted,
   completed, `archivedAt` set, or recurring (`recurrenceRule` present — parity
   with the calendar's `canDrag` non-draggable set).
2. Resolve the container: `projectId` + `parentId IS NULL` (top-level tasks
   only — the drag surfaces are top-level lists); validate each provided
   neighbor is a top-level task in the **same container** and active, else 400
   (use the existing `BadRequestError` / `NotFoundError` error precedent from
   `lib/app-error.js`).
3. Build the top-level container order via the canonical rule
   (`ORDER BY sort_order, created_at, id`), remove the dragged task, splice it
   at the anchor (or container start for `null`/`null`).
4. Renumber the container `0..n-1` — cheap at personal-task scale and it
   prevents sparse positions from exhausting integer gaps over time. It also
   deterministically settles legacy all-zero rows on first use.
5. Update only the changed rows in the same transaction.
6. Idempotent: if the splice yields the identity permutation, return the
   current task without writes. Response: `200 { task }` (the updated task).

Keep `PATCH /tasks/:id` order passthrough unchanged — it remains useful for
API consumers and does not participate in renumbering.

Register the route with `withJsonResponse` schema and request-body
`ReorderTaskDto#` per the tasks-route conventions, then regenerate the OpenAPI
spec so `pnpm docs:check` (CI) stays green.

---

### Task 3: Isolate cross-project lens ordering from `sort_order` (regression guard)

This task exists because renumbering project containers would otherwise
silently reorder views this feature never touches.

**Problem:** the cross-project read paths are ordered by `sort_order` today:

- Server: `listTasksForOwner` ends every list query with
  `orderBy(asc(tasks.order), asc(tasks.createdAt))` — including the
  `view=today|inbox|upcoming` and `overdue`/`undated` filters.
- Client: `task.service.ts` signals sort these responses by
  `left.order - right.order` (`todayTasks`, `overdueTasks`, `inboxTasks`,
  `upcomingTasks`).

While every `order` is 0 this equals stable creation order. Once Task 2 starts
renumbering containers, project ranks would interleave across projects in
Today, Inbox, Upcoming, overdue lists, and the calendar's "No date" panel
(`undatedTasks`, which renders raw server order).

**Fix:**

1. `apps/api/src/services/task-service.ts` — `listTasksForOwner`:
   `ORDER BY sort_order` applies only to container-shaped queries (the
   `parentId` subtask query). For cross-project query shapes (no `parentId`,
   `view`/status/date filters), order by `created_at` asc + `id`. While orders
   are all-zero the output is byte-identical to today, so this is a no-op
   until reordering starts, after which it keeps lens views stable.
2. `apps/frontend/src/app/core/services/task.service.ts` — replace the
   `left.order - right.order` comparator in the four view signals with the
   same stable creation-order comparator (`createdAt`, then `id` as
   tie-breaker; mirror `compareTasksByOrder`'s shape minus `order`).

**Verification:** an API test asserting that after a reorder in project A, the
`view=inbox`, `view=today`, and `overdue` responses keep their
pre-reorder sequence; a frontend spec asserting the same for the signals.

---

### Task 4: Project view drag host

**Files to modify:**
- `apps/frontend/src/app/features/personal/pages/project-detail-page.component.ts` / `.html`
- `apps/frontend/src/app/core/services/task.service.ts`

**Implementation details:**

1. Import `DragDropModule` and place a `cdkDropList` on the active-tasks
   `.task-stack` container in `project-detail-page.component.html`
   (the `@for` over `activeProjectTasks()`; the trailing `+ Add new task`
   button stays outside the sortable items — CDK counts only `cdkDrag` items).
2. Each card gets `cdkDrag` **on the `<app-personal-task-card>` host element**
   in the page template — the card component itself needs no changes:

   ```html
   <app-personal-task-card
     cdkDrag
     [cdkDragData]="task.id"
     [cdkDragDisabled]="!canDrag(task)"
     [task]="task"
     [interactive]="true"
     (select)="editTask(task)"
   />
   ```

3. **Guards** mirror the calendar exactly: `canDrag(task) = !task.completed &&
   !task.recurrenceRule` — completed and recurring cards stay immovable, and
   the completed-tasks section gets no `cdkDrag` at all. Desktop-only parity
   with the calendar: disable drag when the app's mobile check
   (`!isMobile()`, as used by `calendar-page.component.html` for
   `[allowDrag]`) is true.
4. **Click suppression:** dragging a card ends with browsers firing the
   trailing click; the card's `(select)` currently opens the workspace modal.
   Copy the calendar's `suppressClickUntil = Date.now() + 250` /
   `isClickSuppressed()` mechanism into the page and guard
   `workspace.editTask(task)` (the `(select)` handler) with it, so a drag
   never opens the task.
5. **Preview/placeholder styling:** reuse the calendar's `::ng-deep`
   `.cdk-drag-preview` / `.cdk-drag-placeholder` treatment so the row follows
   the app's visual language.
6. **Anchor mapping** in `(cdkDropListDropped)`: the project list is fully
   loaded (no pagination), so compute directly from the event's
   `previousIndex`/`currentIndex` over `activeProjectTasks()` —
   `afterId = newOrder[currentIndex - 1]?.id`, else
   `beforeId = newOrder[currentIndex + 1]?.id`, else `null`/`null` (top).
7. `taskService.reorderTask(dto)` — POST `/tasks/reorder`, then the existing
   `refreshState` bump so signals refetch (same convention as
   `updateTask`, including `errorState` handling; labels/projects don't need a
   refresh bump).

---

### Task 5: Optimistic reorder + rollback (project page)

**Files to modify:**
- `apps/frontend/src/app/features/personal/pages/project-detail-page.component.ts`

Follow the calendar's precedent (`dueDateOverrides` with rollback-and-toast):

1. On drop, recompute the ordered list locally and `projectTasks.update(...)`
   immediately — the computed `activeProjectTasks()` picks it up on the next
   tick.
2. Fire `taskService.reorderTask(dto)`; on success the `refreshState` bump
   triggers the page's existing version-diff effect and reconciles canonical
   server order.
3. On failure, roll the local splice back (restore the prior array) and show
   `statusService.error('Could not move the task. Please try again.')` — same
   error copy as the calendar's `moveTask`.

---

### Task 6: API tests

**Files to create:**
- `apps/api/src/services/task-reorder.test.ts`

**Cases:**

1. Splice to middle, top, and bottom via each anchor form (`afterId`,
   `beforeId`, both-null→start).
2. Idempotent no-op returns 200 without a write.
3. Subtask renumbering stays scoped to `parent_id` — reordering one parent's
   subtasks never shifts another parent's or any top-level task's position
   (assuming subtask support arrives later; the predicate guard is enforced
   now).
4. Container independence: reordering project A never moves project B's tasks.
5. Legacy data: a container seeded all-`order: 0` reorders cleanly (renumber
   collapses ties; visual order preserved via `created_at`).
6. Lens isolation (Task 3): after a reorder in project A, `view=inbox`,
   `view=today`, and overdue responses keep their pre-reorder sequence.
7. Validation: both anchors set → 400; neighbor in another container → 400;
   neighbor unknown → 404; completed, archived, or recurring dragged task →
   400.
8. Auth: another user's task → not found (existing route conventions).
9. Create lands at the container's bottom after drags.

---

### Task 7: E2E + verification

**Files to modify:**
- `apps/frontend/e2e/specs/authenticated/` (new `project-reorder.spec.ts`)

**Specs** (authenticated fixtures already cover login state via `e2e/.auth`);
use Playwright mouse-step choreography as in the authenticated calendar specs
(desktop viewport only — drag is desktop-gated):

1. Create two tasks in a project, drag the second above the first. Assert DOM
   order, reload, assert persistence, and confirm the trailing click did not
   open the task modal.
2. Reorder inside project A, assert project B's list and the Inbox/Today are
   visually unchanged (lens isolation surfaced e2e).
3. Completed/recurring cards are not draggable.

**Verification commands:**

```bash
# 1. OpenAPI / docs consistency (CI runs this)
pnpm docs:check

# 2. Typecheck workspace
pnpm typecheck

# 3. Unit tests (API + frontend)
pnpm test

# 4. Lint check
pnpm lint

# 5. E2E — Playwright lives in the frontend package
pnpm --filter @yotara/frontend e2e
```

---

## 4. Risks & Mitigations

| Risk | Mitigation |
|:---|:---|
| Whole-row drag ends on the card and accidentally opens the task modal | Copy the calendar's `suppressClickUntil` 250ms window and guard the `(select)` handler; covered by e2e assertion 1. |
| Renumbering project containers interleaves cross-project lens views (Today, Inbox, Upcoming, overdue, calendar No-date panel) | Task 3 explicitly funnels `ORDER BY sort_order` into container queries only and repins lens ordering to `created_at`; dedicated API + frontend tests lock the invariant. |
| Legacy rows all begin at `order = 0`, so the first drag renumbers rows that didn't visibly move | Harmless by design: the canonical `created_at` tie-break preserves the visual order; covered by API test 5. |
| Renumbering writes several rows per drop | Trivial at personal-task scale inside one immediate transaction (better-sqlite3 synchronous writes, WAL); no batching or fractional scheme needed. |
| Two rapid drags in sequence race the refresh | Sequential drops are serialized through the existing refresh-diff effect; reordering is additionally blocked while a reorder POST is in flight (simple boolean guard, mirroring `calendar-page`'s in-flight scheduling guard habit). |
| Completed/recurring tasks reordered by hand | Mirrored guards on both sides: `canDrag` on the page and 400s from the endpoint (calendar already treats both as non-draggable). |
| Optimistic state diverges from server truth | Rollback-and-toast on failure exactly like the calendar's `moveTask`; the `refreshState` refetch reconciles on success. |
| OpenAPI drift | Regenerate the spec; `pnpm docs:check` CI verifies. |

---

## 5. Fragment of "accept feedback" the plan deliberately does not do

The recorded feedback likely comes from the Inbox view, which is not draggable
in v1. The gap is closed by naming it: ordering applies wherever a task
actually *lives* (its project page, including the auto-seeded "Inbox" project),
and the changelog/release notes must say so plainly, rather than implying the
Inbox view itself is reorderable. Phase B below is the honest completion of
the feedback, gated on real validation.

---

## 6. Phase B (follow-up plan, deferred): per-view ordering for Inbox and Today

Only start after the container feature is validated and there is a concrete
second request for "sequence my day / my inbox":

1. New table `task_view_orders` (`owner_id`, `task_id`, `view`
   ('inbox' | 'today'), `position`) — the Todoist `day_order` pattern kept
   separately from `child_order` so both can coexist (Todoist needed two order
   fields for exactly this reason).
2. Reorder endpoint generalized by scope (`container` vs. `view`).
3. Inbox/Today gain an explicit "Order" sort pill persisted per view in
   `PreferencesStore` (localStorage, existing per-key pattern); drag activates
   only in Order mode, mapping the `manualOrderIds` lens over the fetched
   tasks.
4. Subtask drag UI and mobile/touch drag remain separate later phases.
