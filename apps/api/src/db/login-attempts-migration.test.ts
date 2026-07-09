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
