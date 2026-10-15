import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDbClient } from './client.js';

test('createDbClient sets concurrency pragmas on in-memory databases', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    // SQLite refuses WAL for in-memory DBs; journal_mode stays 'memory'.
    assert.equal(sqlite.pragma('journal_mode', { simple: true }), 'memory');
    assert.equal(sqlite.pragma('synchronous', { simple: true }), 1); // 1 = NORMAL
    assert.equal(sqlite.pragma('busy_timeout', { simple: true }), 5000);
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1);
  } finally {
    sqlite.close();
  }
});

test('createDbClient enables WAL on file-backed databases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yotara-pragmas-'));
  const { sqlite } = createDbClient(join(dir, 'test.db'));
  try {
    assert.equal(sqlite.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(sqlite.pragma('synchronous', { simple: true }), 1);
    assert.equal(sqlite.pragma('busy_timeout', { simple: true }), 5000);
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1);
  } finally {
    sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

const CHILD_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]); // argv[1] = dbFile (node -e)
  db.exec('BEGIN IMMEDIATE');
  db.prepare('INSERT INTO busy_lock_test DEFAULT VALUES').run();
  console.log('LOCKED');
  setTimeout(() => { db.exec('COMMIT'); process.exit(0); }, 1000);
`;

function waitForLine(stream: NodeJS.ReadableStream, line: string): Promise<void> {
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes(line)) {
        stream.off('data', onData);
        resolve();
      }
    };
    stream.on('data', onData);
  });
}

test(
  'a contended write waits out an external writer instead of failing with SQLITE_BUSY',
  { timeout: 15_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yotara-busy-'));
    const dbFile = join(dir, 'test.db');
    const { sqlite } = createDbClient(dbFile);
    sqlite.exec('CREATE TABLE IF NOT EXISTS busy_lock_test (id INTEGER PRIMARY KEY)');

    // cwd: the apps/api package root, so the child can require('better-sqlite3').
    const child = spawn(process.execPath, ['-e', CHILD_SCRIPT, dbFile], {
      cwd: new URL('../../', import.meta.url),
    });
    if (!child.stdout) {
      throw new Error('child process has no stdout pipe');
    }

    try {
      await waitForLine(child.stdout, 'LOCKED');
      const started = Date.now();
      sqlite.prepare('INSERT INTO busy_lock_test DEFAULT VALUES').run();
      // Without busy_timeout the line above throws SQLITE_BUSY immediately.
      // The child holds the lock for ~1s, so the write must have waited.
      assert.ok(Date.now() - started >= 200, 'write should have waited for the lock');
    } finally {
      child.kill();
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
