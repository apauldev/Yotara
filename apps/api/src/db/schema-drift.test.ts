import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { createDbClient } from './client.js';
import * as schema from './schema.js';

type DrizzleTable = Parameters<typeof getTableConfig>[0];

// Managed by raw SQL in client.ts rather than by Drizzle.
const RAW_SQL_TABLES = ['blocked_ips', 'email_sends', 'login_attempts'];

function isDrizzleTable(value: unknown): value is DrizzleTable {
  return typeof value === 'object' && value !== null && Symbol.for('drizzle:Name') in value;
}

function drizzleTables(): DrizzleTable[] {
  return Object.values(schema).filter(isDrizzleTable);
}

function columnNames(sqlite: import('better-sqlite3').Database, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info('${table}')`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

test('bootstrap and Drizzle define the same tables', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const rows = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;

    const bootstrapTables = rows.map((row) => row.name).sort();
    const expectedTables = [
      ...drizzleTables().map((table) => getTableConfig(table).name),
      ...RAW_SQL_TABLES,
    ].sort();

    assert.deepEqual(
      bootstrapTables,
      expectedTables,
      'Table names differ: add the table to the bootstrap in client.ts, to schema.ts, or to the raw-SQL allowlist in this test.',
    );
  } finally {
    sqlite.close();
  }
});

test('bootstrap and Drizzle define the same column names for every Drizzle table', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    for (const table of drizzleTables()) {
      const { name, columns } = getTableConfig(table);
      const declared = columns.map((column) => column.name).sort();
      const actual = columnNames(sqlite, name).sort();

      const missing = declared.filter((column) => !actual.includes(column));
      assert.deepEqual(
        missing,
        [],
        `${name}: columns declared in schema.ts are missing from the bootstrap. Add them to client.ts.`,
      );

      const unexpected = actual.filter((column) => !declared.includes(column));
      assert.deepEqual(
        unexpected,
        [],
        `${name}: bootstrap-only columns are not declared in schema.ts. Remove them from client.ts or add them to schema.ts.`,
      );
    }
  } finally {
    sqlite.close();
  }
});
