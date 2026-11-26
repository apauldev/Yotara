import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
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
    assert.ok(indexes.includes('idx_tasks_owner_project_order'));
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

test('a project task listing is answered with the project-order index', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT id FROM tasks
         WHERE user_id = ? AND project_id = ? AND deleted_at IS NULL
         ORDER BY sort_order, created_at, id
         LIMIT 3000`,
      )
      .all('user-1', 'project-1') as Array<{ detail: string }>;

    assert.ok(
      plan.some((row) => row.detail.includes('idx_tasks_owner_project_order')),
      `expected the project-order index in the query plan, got: ${JSON.stringify(plan)}`,
    );

    const orderByDetail = plan.map((row) => row.detail).join(' | ');
    // "USE TEMP B-TREE FOR LAST TERM OF ORDER BY" is the failure mode here: the
    // index satisfies a prefix of the ORDER BY and SQLite still sorts the rest.
    // Matching the exact "FOR ORDER BY" phrasing missed that, so assert on any
    // temp B-tree at all.
    assert.ok(
      !/TEMP B-TREE/i.test(orderByDetail),
      `expected the index to satisfy the whole ORDER BY with no sort, got: ${orderByDetail}`,
    );
  } finally {
    sqlite.close();
  }
});

test('bootstrap replaces an older project-order index without the id column', () => {
  const dbFile = join(tmpdir(), `yotara-project-order-${randomUUID()}.db`);
  try {
    // A database created by the intermediate commit has the four-column index
    // under the same name, which `CREATE INDEX IF NOT EXISTS` would leave alone.
    const seeded = createDbClient(dbFile);
    seeded.sqlite.close();

    const legacy = new Database(dbFile);
    legacy.exec(`
      DROP INDEX idx_tasks_owner_project_order;
      CREATE INDEX idx_tasks_owner_project_order
        ON tasks(user_id, project_id, sort_order, created_at);
    `);
    legacy.close();

    for (let boot = 0; boot < 2; boot++) {
      const { sqlite } = createDbClient(dbFile);
      try {
        const columns = (
          sqlite.prepare(`PRAGMA index_info('idx_tasks_owner_project_order')`).all() as Array<{
            name: string;
          }>
        ).map((column) => column.name);
        assert.deepEqual(columns, ['user_id', 'project_id', 'sort_order', 'created_at', 'id']);

        const plan = sqlite
          .prepare(
            `EXPLAIN QUERY PLAN
             SELECT id FROM tasks
             WHERE user_id = ? AND project_id = ? AND deleted_at IS NULL
             ORDER BY sort_order, created_at, id
             LIMIT 3000`,
          )
          .all('user-1', 'project-1') as Array<{ detail: string }>;
        assert.ok(
          !/TEMP B-TREE/i.test(plan.map((row) => row.detail).join(' | ')),
          `expected no sort after the index upgrade, got: ${JSON.stringify(plan)}`,
        );
      } finally {
        sqlite.close();
      }
    }
  } finally {
    rmSync(dbFile, { force: true });
  }
});
