# Plan: Wrap Multi-Table Writes in Database Transactions

## Goal

Eliminate partial-data corruption risk by wrapping every multi-table write in a SQLite transaction. If any step in a create/update/delete chain fails (e.g., task inserts but label sync fails), all writes are rolled back atomically.

## Current Risk

Five code paths write across multiple tables with no transaction protection:

| Path | Tables | Writes | Failure scenario |
|---|---|---|---|
| `updateTaskForOwner` | tasks + task_labels | 10–15+ writes (task update, label sync, recurrence materialization, subtask loops) | Recurring instance + subtasks created but original task update fails — labels out of sync, orphaned subtasks |
| `createTaskForOwner` | tasks + task_labels | 2–6+ writes (task insert, label sync, subtask loop with per-subtask label sync) | Task inserted but label sync fails — orphaned task with no labels |
| `deleteTaskForOwner` | tasks | 3 cascading deletes (subtasks, materialized instances, parent) — all against same `tasks` table | Subtasks deleted but parent survives — cross-table risk is low (single table), still worth wrapping for consistency |
| `syncTaskLabels` | task_labels | delete + insert | All labels cleared if insert fails — task loses all labels |
| `deleteLabelForOwner` | task_labels + labels | 2 deletes | Label–task mappings deleted but label itself survives |

`cleanupExpiredArchivedTasks` (2 deletes on the same `tasks` table) is **excluded** — no cross-table inconsistency risk, partial cleanup is acceptable.

## Type System

### The Problem

The naive approach (`export type Database = typeof db`) is a **TypeScript blocker**:

```
BetterSQLiteDatabase  ─── has $client, wraps a connection
    │
    └── BaseSQLiteDatabase  ←  shared base (select, insert, update, delete, etc.)
                                    │
                           SQLiteTransaction  ─── does NOT have $client
                                    │
                           BetterSQLiteTransaction  (the tx param in db.transaction(cb => tx))
```

`db` is `BetterSQLiteDatabase` (has `$client`). The `tx` parameter in `db.transaction(cb)` is `BetterSQLiteTransaction`, which extends `BaseSQLiteDatabase` — it has the full query builder (`select`, `insert`, `update`, `delete`) but **not** `$client`. TypeScript will reject passing `BetterSQLiteTransaction` where `BetterSQLiteDatabase` is expected.

### Solution: `BaseSQLiteDatabase` as the shared type

Export `Database` as the shared base type that both `db` and `tx` satisfy:

```ts
// apps/api/src/db/client.ts
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

export type Database = BaseSQLiteDatabase<
  'sync',
  import('better-sqlite3').RunResult,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
```

This is the same base class that both `BetterSQLiteDatabase` and `BetterSQLiteTransaction` extend. Both satisfy it. No casts needed.

## Approach

### Step 1 — Export the `Database` type from `client.ts`

See the **Type System** section above. Exported as `Database` so all service functions can import it.

### Step 2 — Add `tx` parameter to transaction-participating functions

Every function that performs writes gets an optional `tx: Database` parameter. Use `tx ?? db` to select the right client:

```ts
import { db, type Database } from '../db/client.js';

async function syncTaskLabels(
  ownerId: string,
  taskId: string,
  labelIds: string[] | undefined,
  tx?: Database
): Promise<void> {
  const client = tx ?? db;
  await client.delete(taskLabels).where(...);
  await client.insert(taskLabels).values(...);
}
```

There are two categories of write functions:

**Entry points** (called from routes, own the transaction): `createTaskForOwner`, `updateTaskForOwner`, `deleteTaskForOwner`, `deleteLabelForOwner`

**Internal helpers** (only called from other service functions, no `tx` → they must be given one): `syncTaskLabels`

**Read helpers used inside a transaction** must also receive `tx?: Database`. This matters for the planned Postgres/pool portability: a module-level `db` read may use a different session and cannot reliably see the transaction's writes. The relevant helpers are `getTaskForOwner`, `getTaskLabels`, `getArchiveAutoDeleteForOwner`, `getDefaultProjectForOwner`, and `seedDefaultProjectsForOwner`. Any inline query in an entry point (such as the recurrence instance count) uses `client` directly.

### Step 3 — Thread `tx` through all internal calls first

Before wrapping anything in transactions, thread `tx` to every callee. If a function currently uses `db`, change it to `tx ?? db` and add `tx?: Database` to its signature. This is mechanical and must happen before Step 4.

Key nesting to thread:
- `updateTaskForOwner` → `createTaskForOwner(tx)` (recurrence materialization)
- `updateTaskForOwner` → `syncTaskLabels(tx)` (label sync)
- `updateTaskForOwner` → `getTaskForOwner(tx)`, `getTaskLabels(tx)`, `getArchiveAutoDeleteForOwner(tx)` (validation, recurrence, and preferences)
- `createTaskForOwner` → `syncTaskLabels(tx)` (label sync + subtask label sync)
- `createTaskForOwner` → `getTaskForOwner(tx)`, `getDefaultProjectForOwner(tx)`, `getTaskLabels(tx)` (validation, default project, and read-back)
- Any subtask creation loops → `syncTaskLabels(tx)`

### Step 3a — Keep the read-back, but make it transaction-aware

`createTaskForOwner` currently ends with:

```ts
return getTaskForOwner(id, ownerId);
```

`getTaskForOwner` and its nested `getTaskLabels` call currently read from module-level `db`. On the current better-sqlite3 driver this is not a live visibility bug because the transaction uses the same connection, but it would be wrong with a pooled Postgres connection.

**Fix**: add `tx?: Database` to both helpers, use `const client = tx ?? db`, and retain the read-back:

```ts
async function getTaskForOwner(taskId: string, ownerId: string, tx?: Database) {
  const client = tx ?? db;
  // select task with client
  // read labels with getTaskLabels(taskId, tx)
}

// At the tail of createTaskForOwner's run(client):
return getTaskForOwner(id, ownerId, client);
```

This preserves the current `TaskRow & { labels: string[] }` response shape for `toTask(created, created.labels)`, and returns the **actual** persisted labels after `syncTaskLabels` has deduplicated IDs and discarded labels not owned by the user. Do not construct `labels` from `payload.labels`.

### Step 3b — Thread every transaction-scoped read

`getDefaultProjectForOwner` calls `seedDefaultProjectsForOwner`, which writes projects. It, and every read used by an entry point, must use the transaction client.

**Fix**: Thread `tx` through `getDefaultProjectForOwner` → `seedDefaultProjectsForOwner`, `getTaskForOwner` → `getTaskLabels`, and `getArchiveAutoDeleteForOwner`. Each uses `tx ?? db` for every read and write. Replace the inline recurrence count query with `client.select(...)`.

**Why reads too**: On the current better-sqlite3 driver this isn't a live visibility bug (savepoints share one connection, so a `db.select` inside the transaction sees `tx`'s uncommitted writes). The driver is portability: on Postgres with pooled connections, a `db.select` would hit a different session and miss writes made through `tx`. Routing all reads and writes through the same `tx ?? db` handle guarantees consistent visibility on both drivers.

**Behavior change**: a rolled-back task operation also rolls back any newly-seeded default projects. Previously, seeded projects survived a failed task creation. The new behavior is more correct (atomic), but it is a change worth being aware of.

### Step 4 — Wrap entry points in `db.transaction()`

After all internal callees accept `tx`, wrap each entry point using the two-mode pattern:

```ts
export async function createTaskForOwner(ownerId: string, body: CreateTaskDto, tx?: Database) {
  const run = async (client: Database) => {
    // All reads and writes in this workflow use client or helpers passed client.
  };

  return tx ? run(tx) : db.transaction(run);
}
```

**Entry points that get wrapped**: `createTaskForOwner`, `updateTaskForOwner`, `deleteTaskForOwner`, `deleteLabelForOwner`

**`syncTaskLabels` is NOT wrapped** — it is only called from service workflows that already own a transaction.

**`deleteLabelForOwner` returns `true`** (not a row or object — just a success boolean). If the transaction callback throws, the return is naturally lost. No special handling needed.

## Nested Call Behavior

**Recurrence materialization in `updateTaskForOwner` calls `createTaskForOwner` inline (~line 390).** The child call should share the parent's `tx` so the recurring instance is part of the same transaction. If the parent fails *after* materialization (e.g., the task update or label sync throws), the child instance is rolled back along with everything else.

This is a one-line change: pass `tx` from the recurrence call site — `createTaskForOwner(ownerId, {...}, tx)`. Step 3 already adds the `tx?: Database` parameter to `createTaskForOwner` and lists this nesting under "Key nesting to thread", so no extra plumbing is needed. better-sqlite3 supports nested savepoints, so there is no technical risk.

This is not a negligible edge case: "update succeeds, recurrence instance commits, then a later write in the same operation fails" is precisely the partial-corruption scenario this plan exists to eliminate. Bringing the child into the parent transaction closes it.

## Out of Scope

**`seedDefaultLabelsForOwner`** (label-service.ts) does `db.select(...)` then a plain `db.insert(labels).values(...)` and is called from route handlers (me.ts, labels.ts). It is a single-table operation and is out of scope for this transaction work, but it has a separate concurrency bug: the schema has no `(user_id, name)` unique constraint, so concurrent first requests can insert duplicate default labels. Track a follow-up to add that constraint and use explicit conflict handling; do not assume `.values()` uses `INSERT OR IGNORE`.

## Files to Modify

| File | Changes |
|---|---|
| `apps/api/src/db/client.ts` | Export `type Database` using `BaseSQLiteDatabase` base type (see Type System section) |
| `apps/api/src/services/label-service.ts` | Add `tx?` to `syncTaskLabels`, `deleteLabelForOwner`, and `getTaskLabels`. Replace `db` with `tx ?? db` in their bodies. Wrap `deleteLabelForOwner` in `db.transaction()`. `syncTaskLabels` does NOT get its own transaction. |
| `apps/api/src/services/task-service.ts` | Add `tx?` to the entry points and transaction-scoped reads (`getTaskForOwner`, `getArchiveAutoDeleteForOwner`). Wrap each entry point in `db.transaction()` when no `tx` is passed. Thread `tx` to every internal read/write call and use `client` for the recurrence count. Retain the transaction-aware `getTaskForOwner` read-back in `createTaskForOwner`. |
| `apps/api/src/services/project-service.ts` | Add `tx?` param to `getDefaultProjectForOwner` and `seedDefaultProjectsForOwner`. Replace `db` with `tx ?? db` in **both reads and writes** (see Step 3b). |
| `apps/api/src/routes/tasks.ts` | No changes — route handlers call service functions which handle transactions internally. |
| `apps/api/src/routes/labels.ts` | No changes. |
| `apps/api/src/routes/me.ts` | No changes. |

## Testing

**Existing tests**: All should pass as-is. Transaction behavior is transparent to callers (same return values, same errors on failure). The current risk is only on partial failures, which existing tests don't trigger.

**Test infrastructure**: Current service tests import functions directly and run against a real SQLite database with zero mocking. No mocking framework (Vitest/Jest mocks) is used anywhere in the service layer. Since `syncTaskLabels` is imported directly (not dependency-injected), mocking it to throw mid-transaction would require a module-mocking framework that doesn't exist in the project today, OR a helper that stubs the function on an object.

**Approach: Test-only SQLite triggers.** The FK-violation idea doesn't work: `syncTaskLabels` validates ownership before inserting, so the normal path cannot create an invalid label reference. Instead, add a trigger to the isolated test database that deliberately aborts the desired `task_labels` insert:

```sql
CREATE TRIGGER fail_parent_label_sync
BEFORE INSERT ON task_labels
WHEN NEW.task_id = '<parent-task-id>'
BEGIN
  SELECT RAISE(ABORT, 'forced rollback test failure');
END;
```

For create, target the newly-created task ID (obtain it deterministically by supplying the relevant test setup or add a generic one-shot trigger). For recurrence, target the original parent task ID and pass `labels` in the update body. The recurring child and its labels are created first; the parent-label insert then fails, proving the outer transaction rolls back both the child and the parent update. Drop the trigger in test cleanup.

This exercises the real service wiring without mocking, namespace-import refactors, or production-only `_test` parameters.

**Direct transaction primitive test (no seam, lower value):** As a baseline, verify the primitive itself works:

```ts
await assert.rejects(db.transaction(async (tx) => {
  await tx.insert(tasks).values({ ... });
  throw new Error('rollback');
}));
// assert no row inserted
```

This confirms Drizzle's `db.transaction()` rolls back on throw, independent of the service layer.

**New tests (recommended)**:
- `createTaskForOwner` transaction rollback: test-only trigger aborts label insert → assert task row does not exist
- `updateTaskForOwner` (recurrence path) transaction rollback: trigger aborts parent-label insert after recurrence materialization → assert no new recurring instance was created and parent remains unchanged
- Direct `db.transaction()` primitive rollback: insert then throw → assert no row inserted

## Effort Estimate

- Type export and validation: ~30 min
- Add `tx?` params and `client = tx ?? db` to entry points and transaction-scoped helpers (including project-service): ~1.5 hours
- Thread `tx` through nested calls in `updateTaskForOwner` and `createTaskForOwner`: ~30 min
- Make task/label read-back transaction-aware: ~30 min
- Thread `tx` through default-project, archive-preference, task, and label helpers: ~45 min
- Wrap 4 entry points in `db.transaction()`: ~30 min
- Verify existing tests pass: ~30 min
- Write 3 rollback tests (2 trigger-based + 1 primitive): ~1 hour

**Total: ~5.5 hours**
