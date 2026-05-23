# Subtasks & Recurring Tasks — Phased Execution Plan

## Objective

Introduce hierarchical task management (subtasks) and automated task generation (recurring
tasks) to Yotra personal mode. These are implemented together to design a single cohesive Task
Detail UI and avoid redundant refactors later.

---

## Design Decisions

### Subtasks

- **Model**: Self-referencing `parent_id` on the tasks table. Supports N-level nesting in schema;
  MVP limits UI to 1 level.
- **Completion behavior**: Subtasks are independent — completing a parent does not auto-complete
  its children.
- **Inheritance**: Subtasks inherit the parent's `project_id` by default but can be overridden.
  Labels are **not** inherited (each subtask has its own label set).
- **List visibility**: Subtasks are excluded from Inbox / Today / Upcoming / Search by default.
  They only appear inside their parent's detail view.
- **Deletion**: Cascade-delete subtasks when the parent is deleted (simplest approach for MVP;
  no configurable orphan behavior).

### Recurring Tasks

- **Model**: `recurrence_rule` stores a simple JSON object on the template task.
- **Format**: `{ "frequency": "daily" | "weekly" | "monthly" | "yearly", "interval": number }`
  - `{ "frequency": "daily", "interval": 1 }` = every day
  - `{ "frequency": "weekly", "interval": 2 }` = every 2 weeks
  - `{ "frequency": "monthly", "interval": 1 }` = every month
- **Strategy**: "Materialization on Completion". When a recurring-task instance is completed,
  the API creates the next instance with `dueDate` advanced by the rule. This avoids future-task
  clutter in the database.
- **Due-date anchor**: For daily tasks, the next instance is calculated from the **completion
  date** (so you don't accumulate overdue instances if you miss a few days). For weekly, monthly,
  and yearly tasks, the next instance is calculated from the **original due date** to keep the
  schedule consistent (e.g., "every Monday" or "the 1st of the month").
- **Template link**: `base_task_id` links materialized instances back to their source template.
  The template task is never completed itself — it acts as the "blueprint."
- **Template editing**: Editing the recurrence rule on the template only affects future instances
  (next materialization picks up the new rule). Existing instances are unchanged.
- **Template deletion**: Deleting the template also cascade-deletes all its materialized instances.

---

## Phase 1: Shared Types & Database Schema

**Goal**: All types defined, DB columns exist, indexes in place. No behavior changes yet — all
existing tests must still pass.

### Step 1.1 — Shared types (`packages/shared/src/index.ts`)

1. Add `RecurrenceFrequency` type:
   ```ts
   export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
   ```

2. Add `RecurrenceRule` interface:
   ```ts
   export interface RecurrenceRule {
     frequency: RecurrenceFrequency;
     interval: number;
   }
   ```

3. Update `Task` interface — add fields:
   - `parentId?: string` (rename existing `parentTaskId` → `parentId`)
   - `recurrenceRule?: RecurrenceRule`
   - `baseTaskId?: string`
   - REMOVE `assigneeId?: string` (unused, never in DB, dead field)
   - REMOVE dead `Comment` interface at bottom

4. Update `CreateTaskDto` — rename `parentTaskId` → `parentId`, add:
   - `parentId?: string`
   - `recurrenceRule?: RecurrenceRule`

5. Update `UpdateTaskDto` — rename `parentTaskId` → `parentId`, change to:
   - `parentId?: string | null` (null = promote to top-level)
   - `recurrenceRule?: RecurrenceRule | null` (null = remove rule)

### Step 1.2 — DB schema (`apps/api/src/db/schema.ts`)

Add three columns to the `tasks` table definition:

```ts
parent_id: text('parent_id').references((): AnySQLiteColumn => tasks.id),
recurrence_rule: text('recurrence_rule'),
base_task_id: text('base_task_id').references((): AnySQLiteColumn => tasks.id),
```

Need to import `AnySQLiteColumn` type from drizzle-orm if not already imported.

### Step 1.3 — DB migration (`apps/api/src/db/client.ts`)

**In `SQLITE_BOOTSTRAP_SQL`**: add to the tasks `CREATE TABLE` block:
```sql
parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
recurrence_rule TEXT,
base_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL
```

**In `ensureSqliteSchema()`**: add `ALTER TABLE` checks after existing task column migrations:
```ts
if (!taskColumnNames.has('parent_id')) {
  sqlite.exec(`ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`);
}
if (!taskColumnNames.has('recurrence_rule')) {
  sqlite.exec(`ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT`);
}
if (!taskColumnNames.has('base_task_id')) {
  sqlite.exec(`ALTER TABLE tasks ADD COLUMN base_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`);
}

sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id)`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_base_task_id ON tasks(base_task_id)`);
```

**Validation**: Run `pnpm --filter @yotara/api typecheck` and `pnpm --filter @yotara/api test`.

---

## Phase 2: API Service Layer

**Goal**: Backend fully supports subtasks and recurring tasks. Frontend still untouched — all
existing frontend should work unchanged.

### Step 2.1 — `toTask()` mapping (`apps/api/src/services/task-service.ts`)

Add new fields to the returned object:
```ts
parentId: task.parent_id ?? undefined,
recurrenceRule: task.recurrence_rule
  ? (JSON.parse(task.recurrence_rule) as RecurrenceRule)
  : undefined,
baseTaskId: task.base_task_id ?? undefined,
```

Note: the DB column is `parent_id` (snake_case as used throughout this table) but the shared
type field is `parentId` (camelCase). Map between them here.

### Step 2.2 — `advanceDueDate()` helper (`apps/api/src/services/task-service.ts`)

Add as a module-level function (not exported — internal to this file):

```ts
function advanceDueDate(from: string, rule: RecurrenceRule): string {
  const d = new Date(from);
  const { frequency, interval } = rule;
  const n = interval || 1;

  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();
  let day = d.getUTCDate();

  switch (frequency) {
    case 'daily': {
      const next = new Date(Date.UTC(year, month, day + n));
      year = next.getUTCFullYear();
      month = next.getUTCMonth();
      day = next.getUTCDate();
      break;
    }
    case 'weekly': {
      const next = new Date(Date.UTC(year, month, day + 7 * n));
      year = next.getUTCFullYear();
      month = next.getUTCMonth();
      day = next.getUTCDate();
      break;
    }
    case 'monthly': {
      month += n;
      while (month > 11) { year++; month -= 12; }
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      day = Math.min(day, lastDay);
      break;
    }
    case 'yearly': {
      year += n;
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      day = Math.min(day, lastDay);
      break;
    }
  }

  return new Date(Date.UTC(year, month, day)).toISOString().split('.')[0] + 'Z';
}
```

### Step 2.3 — `createTaskForOwner()` — parentId & recurrenceRule

After `normalizeCreatePayload` and before `db.insert().values()`:

```ts
// Validate parent exists and belongs to same owner
if (payload.parentId) {
  if (payload.parentId === id) {
    throw new Error('A task cannot be its own parent');
  }
  const parent = await getTaskForOwner(payload.parentId, ownerId);
  if (!parent) {
    throw new Error('Parent task not found');
  }
  // Inherit project from parent if not explicitly set
  if (!payload.projectId) {
    payload.projectId = parent.projectId;
  }
}
```

In `db.insert().values()`:
```ts
parentId: payload.parentId ?? null,
recurrenceRule: payload.recurrenceRule ? JSON.stringify(payload.recurrenceRule) : null,
baseTaskId: null, // always null for new user-created tasks
```

### Step 2.4 — `updateTaskForOwner()` — recurrence materialization

After the completion-transition block (where `archivedAt` and `permanentArchive` are set),
before the `db.update()` call:

```ts
// Recurrence materialization: when a recurring task is completed, create the next instance
if (completed && !current.completed && current.recurrence_rule) {
  const rule: RecurrenceRule = JSON.parse(current.recurrence_rule);

  const anchorDate =
    rule.frequency === 'daily'
      ? nowIsoTimestamp()
      : (current.due_date ?? nowIsoTimestamp());

  const nextDueDate = advanceDueDate(anchorDate, rule);

  await createTaskForOwner(ownerId, {
    title: current.title,
    description: current.description ?? undefined,
    priority: (current.priority ?? 'medium') as Priority,
    dueDate: nextDueDate,
    simpleMode: current.simple_mode === 1,
    projectId: current.project_id ?? undefined,
    recurrenceRule: rule,
    baseTaskId: current.base_task_id ?? current.id, // link to template
    labels: currentLabels, // from getTaskLabels
  });
}
```

Note: `getTaskLabels` needs to be called to get the current task's labels. The function already
calls `getTaskLabels` via `getTaskForOwner` but that returns label IDs. We need the IDs for the
`createTaskForOwner` call. Store the labels separately before this block.

### Step 2.5 — `listTasksForOwner()` — subtask filtering

Add `includeSubtasks?: boolean` parameter (default false):

```ts
export async function listTasksForOwner(
  ownerId: string,
  page: number,
  pageSize: number,
  includeSubtasks = false,
): Promise<PaginatedResponse<Task[]>> {
```

In the where clause:
```ts
const baseWhere = and(eq(tasks.userId, ownerId), isNull(tasks.deletedAt));
const whereClause = includeSubtasks
  ? baseWhere
  : and(baseWhere, isNull(tasks.parentId));
```

### Step 2.6 — `listSubtasks()` helper

New exported function:

```ts
export async function listSubtasks(
  parentId: string,
  ownerId: string,
): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.parentId, parentId),
        eq(tasks.userId, ownerId),
        isNull(tasks.deletedAt),
      ),
    )
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  return Promise.all(
    rows.map(async (row) =>
      toTask(
        row,
        (await getTaskLabels(row.id)).map((l) => l.id),
      ),
    ),
  );
}
```

### Step 2.7 — `deleteTaskForOwner()` — cascade subtasks & instances

Before the final `db.delete()`:

```ts
// Cascade-delete subtasks (one level)
await db
  .delete(tasks)
  .where(and(eq(tasks.parentId, taskId), eq(tasks.userId, ownerId)));

// Cascade-delete materialized instances (if this is a recurring template)
await db
  .delete(tasks)
  .where(and(eq(tasks.baseTaskId, taskId), eq(tasks.userId, ownerId)));
```

**Validation**: Run `pnpm --filter @yotara/api test`. All existing tests must pass.

---

## Phase 3: API Routes & OpenAPI

**Goal**: Routes expose the new capabilities. OpenAPI docs are updated. Swagger UI shows the
new schemas.

### Step 3.1 — Routes (`apps/api/src/routes/tasks.ts`)

**`GET /tasks`**: Add `includeSubtasks` and `parentId` query params:

```ts
fastify.get<{
  Querystring: { page?: number; pageSize?: number; includeSubtasks?: boolean; parentId?: string };
  Reply: PaginatedResponse<Task[]> | { message: string };
}>
```

Pass them through:
```ts
const includeSubtasks = request.query.includeSubtasks === true;
const parentId = request.query.parentId;
return listTasksForOwner(userId, page, pageSize, includeSubtasks, parentId);
```

Update the OpenAPI querystring schema inline to document these params.

**`GET /tasks/:id`**: After fetching the task, compute `subtaskCount` and `subtaskCompletedCount`:
```ts
const subtasks = await listSubtasks(request.params.id, userId);
const task = toTask(row, row.labels);
task.subtaskCount = subtasks.length;
task.subtaskCompletedCount = subtasks.filter(s => s.completed).length;
return task;
```

**`PATCH /tasks/:id`**: Update the body schema to reference the new `UpdateTaskDto` with
`recurrenceRule` and `parentId`.

### Step 3.2 — OpenAPI schemas (`apps/api/src/docs/openapi.ts`)

1. Register `RecurrenceFrequency` as a JSON schema (enum of 4 string values)
2. Register `RecurrenceRule` as a JSON schema (object with `frequency` and `interval`)
3. Update `Task` schema with `parentId`, `recurrenceRule`, `baseTaskId`, `subtaskCount`,
   `subtaskCompletedCount`
4. Update `CreateTaskDto` schema with `parentId`, `recurrenceRule`
5. Update `UpdateTaskDto` schema with `parentId`, `recurrenceRule`
6. Add examples: task with subtasks, task with recurrence

**Validation**: Run `pnpm --filter @yotara/api docs:check`. Start API, check Swagger UI at
`/docs`.

---

## Phase 4: Frontend Service Layer

**Goal**: Frontend can call the new API endpoints. No visual changes yet — existing UI works
unchanged.

### Step 4.1 — Update `TaskService` (`apps/frontend/src/app/core/services/task.service.ts`)

Add async method:
```ts
async fetchSubtasks(parentId: string): Promise<Task[]> {
  try {
    const response = await firstValueFrom(
      this.http.get<PaginatedResponse<Task[]>>(
        `${this.baseUrl}/tasks?parentId=${parentId}&pageSize=100`,
        { withCredentials: true },
      ),
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch subtasks', error);
    return [];
  }
}
```

Verify `createTask` and `updateTask` already pass through `parentId` and `recurrenceRule`
(they do — they take `CreateTaskDto` / `UpdateTaskDto` and pass directly to the HTTP call).

### Step 4.2 — Update `LabelService` / `ProjectService` if needed

No changes needed — they're independent of subtasks/recurrence.

**Validation**: Run `pnpm --filter @yotara/frontend typecheck`. The shared type changes from
Phase 1 should compile cleanly on the frontend side.

---

## Phase 5: Frontend UI — Card Component

**Goal**: Cards show subtask count and recurring indicator. Smallest visual change first.

### Step 5.1 — `PersonalTaskCardComponent`

**File**: `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts`

No new inputs needed — `task` input already carries `subtaskCount`, `subtaskCompletedCount`,
and `recurrenceRule`.

**Subtask count pill**: Add to the badges row (between status badge and priority chip) when
`task.subtaskCount > 0`:
```
[0/3]  or  [2/5]
```
- If all complete → green pill
- If partial → amber pill
- If none → muted pill

**Recurring icon**: Add to the badges row when `task.recurrenceRule` is present:
```
↻  Daily   or   ↻  Weekly
```
- Small pill with icon and frequency label
- Tooltip via `title` attribute: "Repeats daily"

**Validation**: Visual check — existing cards with no subtasks/recurrence should look identical.
Create a task with subtasks (via API or DB insert) and verify the pill appears.

---

## Phase 6: Frontend UI — Task Modal

**Goal**: Full subtask management and recurrence configuration in the modal. This is the
largest phase.

### Step 6.1 — `PersonalTaskModalComponent` — "Repeat" sidebar section

**File**: `apps/frontend/src/app/features/personal/components/personal-task-modal.component.ts`
**File**: `apps/frontend/src/app/features/personal/components/personal-task-modal.component.html`

**Position**: Between "Schedule" (date picker) and "Priority" sections in the sidebar.

**New signals in the component class**:
```ts
draftRecurrenceFrequency = signal<RecurrenceFrequency | null>(null);
draftRecurrenceInterval = signal<number>(1);
```

**Hydration** (in existing `hydrateDraft` method):
```ts
if (this.task?.recurrenceRule) {
  this.draftRecurrenceFrequency.set(this.task.recurrenceRule.frequency);
  this.draftRecurrenceInterval.set(this.task.recurrenceRule.interval);
} else {
  this.draftRecurrenceFrequency.set(null);
  this.draftRecurrenceInterval.set(1);
}
```

**Template**: Add to sidebar HTML:
```html
<!-- Repeat -->
<section class="modal-sidebar-section">
  <h3 class="modal-sidebar-label">Repeat</h3>
  <select [(ngModel)]="draftRecurrenceFrequency">
    <option [ngValue]="null">None</option>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
  </select>
  @if (draftRecurrenceFrequency()) {
    <label>
      Every
      <input type="number" [(ngModel)]="draftRecurrenceInterval"
             min="1" max="30" />
      {{ draftRecurrenceFrequency() === 'daily' ? 'day(s)' :
         draftRecurrenceFrequency() === 'weekly' ? 'week(s)' :
         draftRecurrenceFrequency() === 'monthly' ? 'month(s)' : 'year(s)' }}
    </label>
  }
</section>
```

**Disabled when**: The task has a `parentId` (it's a subtask — subtasks don't recur independently).
Add `[disabled]="!!task?.parentId"` on the dropdown.

**Save payload** (in the existing submit/build-payload logic):
```ts
recurrenceRule: draftRecurrenceFrequency()
  ? { frequency: draftRecurrenceFrequency()!, interval: draftRecurrenceInterval() }
  : null,
```

### Step 6.2 — `PersonalTaskModalComponent` — "Subtasks" main-area section

**Position**: Below the description textarea, above the footer area.

**New signals**:
```ts
subtasks = signal<Task[]>([]);
subtaskLoading = signal(false);
newSubtaskTitle = signal('');
newSubtaskCreating = signal(false);
```

**Lifecycle**: When the modal opens in edit mode (`task` is set), fetch subtasks:
```ts
private async loadSubtasks(taskId: string) {
  if (!taskId) return;
  this.subtaskLoading.set(true);
  try {
    const tasks = await this.taskService.fetchSubtasks(taskId);
    this.subtasks.set(tasks);
  } finally {
    this.subtaskLoading.set(false);
  }
}
```

Call this from the existing hydration logic when `this.task` is present.

**Template structure** (in the main content area, between description and footer):
```html
<!-- Subtasks section — only in edit mode -->
@if (task) {
  <section class="subtasks-section">
    <div class="subtasks-header">
      <h3>Subtasks</h3>
      @if (subtasks().length > 0) {
        <span class="subtask-count"
              [class.complete]="allSubtasksDone()"
              [class.partial]="!allSubtasksDone() && doneSubtaskCount() > 0">
          {{ doneSubtaskCount() }} / {{ subtasks().length }}
        </span>
      }
    </div>

    @if (subtaskLoading()) {
      <p class="subtask-loading">Loading...</p>
    } @else {
      <ul class="subtask-list">
        @for (subtask of subtasks(); track subtask.id) {
          <li class="subtask-row">
            <input type="checkbox"
                   [checked]="subtask.completed"
                   (change)="toggleSubtask(subtask)" />
            <span class="subtask-title"
                  [class.done]="subtask.completed"
                  (click)="editSubtask(subtask)">
              {{ subtask.title }}
            </span>
          </li>
        }
      </ul>

      <!-- Quick-add input -->
      <div class="subtask-quick-add">
        <input type="text"
               placeholder="Add a subtask..."
               [(ngModel)]="newSubtaskTitle"
               (keydown.enter)="quickAddSubtask()"
               [disabled]="newSubtaskCreating()" />
      </div>
    }
  </section>
}
```

**Computed helpers**:
```ts
doneSubtaskCount = computed(() => this.subtasks().filter(s => s.completed).length);
allSubtasksDone = computed(() =>
  this.subtasks().length > 0 && this.subtasks().every(s => s.completed)
);
```

**Methods**:
```ts
async toggleSubtask(subtask: Task) {
  await this.taskService.updateTask(subtask.id, { completed: !subtask.completed });
  await this.loadSubtasks(this.task!.id);
}

async quickAddSubtask() {
  const title = this.newSubtaskTitle().trim();
  if (!title || !this.task) return;

  this.newSubtaskCreating.set(true);
  try {
    await this.taskService.createTask({
      title,
      parentId: this.task.id,
      status: 'inbox',
      priority: 'medium',
    });
    this.newSubtaskTitle.set('');
    await this.loadSubtasks(this.task.id);
  } finally {
    this.newSubtaskCreating.set(false);
  }
}

editSubtask(subtask: Task) {
  // Open the full modal for the subtask — emit to workspace
  this.workspace?.editTask(subtask); // or equivalent
}

// In the submit payload, include parentId if this is a subtask creation
parentId: this.task?.parentId ?? undefined,
```

**SCSS**: Add styles for `.subtasks-section`, `.subtasks-header`, `.subtask-list`,
`.subtask-row`, `.subtask-quick-add`. Follow existing modal styling patterns
(border radius, spacing, font sizes from the description area).

### Step 6.3 — `PersonalTaskWorkspaceComponent` — wire subtask editing

When the modal emits `editSubtask`, the workspace should open the modal for that subtask.
The workspace already has `editTask(task)` — clicking a subtask row calls this via the
existing modal-open flow.

**Validation**: Full manual test — create a task, open the modal, add subtasks, toggle them,
see the count update. Set a repeat rule, complete the task, verify a new instance appears.

---

## Phase 7: Tests & Verification

### Step 7.1 — API tests

**File**: `apps/api/src/services/task-service.test.ts` (or closest existing test file)

Test cases:
1. Create a task with `parentId` → subtask inherits parent's project
2. Create a task with `parentId` pointing to non-existent parent → error
3. List tasks excludes subtasks by default
4. List tasks with `includeSubtasks=true` includes them
5. List subtasks for a parent returns correct tasks
6. Completing a recurring task creates the next instance with correct due date
7. Completing a daily recurring task anchors from now (not original due date)
8. Completing a weekly recurring task anchors from original due date
9. Deleting a parent cascades to subtasks
10. Deleting a recurring template cascades to instances
11. Self-parent validation rejects `parentId === own id`

### Step 7.2 — Smoke test

1. Create a task "Weekly Review" with repeat = Weekly
2. Complete it → verify new instance appears with due date +7 days
3. Create a task "Project X" with 3 subtasks
4. Toggle subtasks → verify count updates
5. Complete the parent → subtasks remain in their states
6. Delete parent → subtasks gone
7. Check Inbox/Today/Upcoming → no subtasks visible

---

## Summary: Files Changed Per Phase

| Phase | Files |
|-------|-------|
| 1 | `packages/shared/src/index.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts` |
| 2 | `apps/api/src/services/task-service.ts` |
| 3 | `apps/api/src/routes/tasks.ts`, `apps/api/src/docs/openapi.ts` |
| 4 | `apps/frontend/src/app/core/services/task.service.ts` |
| 5 | `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts` (+ HTML) |
| 6 | `apps/frontend/src/app/features/personal/components/personal-task-modal.component.ts` (+ HTML + SCSS), `apps/frontend/src/app/features/personal/components/personal-task-workspace.component.ts` |
| 7 | `apps/api/src/services/task-service.test.ts` (new or existing) |

**Total**: 10 files changed, 1 new test file.
