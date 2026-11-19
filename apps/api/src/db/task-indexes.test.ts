import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from './client.js';

/** The date-filtered task views rely on these indexes to avoid full scans. */
test('bootstrap creates the composite task indexes on due date and owner', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const indexes = (
      sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks'`)
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    assert.ok(indexes.includes('idx_tasks_owner_deleted_due_date'));
    assert.ok(indexes.includes('idx_tasks_owner_deleted'));
  } finally {
    sqlite.close();
  }
});

test('a calendar-style date range is answered with the expression index', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT id FROM tasks
         WHERE user_id = ? AND deleted_at IS NULL
           AND date(due_date) >= ? AND date(due_date) <= ?`,
      )
      .all('user-1', '2026-11-01', '2026-11-30') as Array<{ detail: string }>;

    assert.ok(
      plan.some((row) => row.detail.includes('idx_tasks_owner_deleted_due_date')),
      `expected the date index in the query plan, got: ${JSON.stringify(plan)}`,
    );
  } finally {
    sqlite.close();
  }
});
