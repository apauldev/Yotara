import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from './client.js';

function seedLegacyLoginAttempts(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE login_attempts (
      email TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      last_attempt_at INTEGER NOT NULL,
      PRIMARY KEY (email)
    )
  `);

  sqlite
    .prepare(
      `INSERT INTO login_attempts (email, attempts, locked_until, last_attempt_at)
     VALUES (?, ?, ?, ?)`,
    )
    .run('attack@example.com', 5, Date.now() + 300000, Date.now());

  sqlite.close();
}

test('legacy login_attempts table is migrated to composite (ip, email) key', () => {
  const dbFile = join(tmpdir(), `yotara-login-attempts-migration-${randomUUID()}.db`);

  seedLegacyLoginAttempts(dbFile);

  const { sqlite } = createDbClient(dbFile);

  try {
    const columns = sqlite.prepare(`PRAGMA table_info('login_attempts')`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = columns.map((c) => c.name);
    assert.ok(columnNames.includes('ip'), 'ip column should exist after migration');
    assert.ok(columnNames.includes('email'), 'email column should exist after migration');

    const ipColumn = columns.find((c) => c.name === 'ip');
    assert.equal(ipColumn?.type, 'TEXT');

    const row = sqlite
      .prepare(`SELECT * FROM login_attempts WHERE email = ?`)
      .get('attack@example.com') as { email: string; attempts: number } | undefined;

    assert.equal(row, undefined, 'old rows should be dropped during migration');
  } finally {
    sqlite.close();
    rmSync(dbFile, { force: true });
  }
});

test('legacy user table gains password setup flag', () => {
  const dbFile = join(tmpdir(), `yotara-user-migration-${randomUUID()}.db`);
  const legacy = new Database(dbFile);
  legacy.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      emailVerified INTEGER NOT NULL,
      image TEXT,
      workspaceMode TEXT,
      onboardingCompleted INTEGER NOT NULL DEFAULT 0,
      archiveAutoDelete INTEGER NOT NULL DEFAULT 1,
      captureBehavior TEXT NOT NULL DEFAULT 'quick',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  legacy.close();

  const { sqlite } = createDbClient(dbFile);
  try {
    const columns = sqlite.prepare(`PRAGMA table_info('user')`).all() as Array<{
      name: string;
      dflt_value: string | null;
    }>;
    const passwordSetupColumn = columns.find((column) => column.name === 'passwordSetupRequired');
    assert.equal(passwordSetupColumn?.dflt_value, '0');
  } finally {
    sqlite.close();
    rmSync(dbFile, { force: true });
  }
});

test('fresh database creates login_attempts with composite key', () => {
  const dbFile = join(tmpdir(), `yotara-login-attempts-fresh-${randomUUID()}.db`);

  const { sqlite } = createDbClient(dbFile);

  try {
    const columns = sqlite.prepare(`PRAGMA table_info('login_attempts')`).all() as Array<{
      name: string;
      type: string;
    }>;

    const columnNames = columns.map((c) => c.name);
    assert.ok(columnNames.includes('ip'), 'ip column should exist in fresh db');
    assert.ok(columnNames.includes('email'), 'email column should exist in fresh db');
  } finally {
    sqlite.close();
    rmSync(dbFile, { force: true });
  }
});

test('schema bootstrap wraps DDL in a transaction (7b)', () => {
  const dbFile = join(tmpdir(), `yotara-schema-tx-${randomUUID()}.db`);

  const { sqlite } = createDbClient(dbFile);

  try {
    // All core tables should exist after bootstrap
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    assert.ok(tableNames.includes('user'));
    const userColumns = sqlite.prepare(`PRAGMA table_info('user')`).all() as Array<{
      name: string;
      dflt_value: string | null;
    }>;
    const passwordSetupColumn = userColumns.find(
      (column) => column.name === 'passwordSetupRequired',
    );
    assert.equal(passwordSetupColumn?.dflt_value, '0');
    assert.ok(tableNames.includes('session'));
    assert.ok(tableNames.includes('account'));
    assert.ok(tableNames.includes('tasks'));
    assert.ok(tableNames.includes('projects'));
    assert.ok(tableNames.includes('labels'));
    assert.ok(tableNames.includes('email_sends'));
    assert.ok(tableNames.includes('login_attempts'));
    assert.ok(tableNames.includes('notifications'));

    // Verify indexes were also created
    const indexes = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    assert.ok(indexNames.includes('idx_email_sends_ip'));
  } finally {
    sqlite.close();
    rmSync(dbFile, { force: true });
  }
});

test('database file permissions are locked down (7a)', async () => {
  const { statSync } = await import('node:fs');
  const dbFile = join(tmpdir(), `yotara-perm-${randomUUID()}.db`);

  const { sqlite } = createDbClient(dbFile);

  try {
    const stats = statSync(dbFile);
    const perms = stats.mode & 0o777;
    assert.ok((perms & 0o007) === 0, 'file should not be world-readable');
    assert.ok((perms & 0o070) === 0, 'file should not be group-readable');
  } finally {
    sqlite.close();
    rmSync(dbFile, { force: true });
  }
});
