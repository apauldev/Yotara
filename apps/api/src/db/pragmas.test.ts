import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDbClient } from './client.js';
import { spawnNode, waitForExit, waitForLine } from './test-child-helpers.js';

/**
 * The contention tests below use child processes rather than in-process
 * contenders: better-sqlite3 is synchronous, so an in-process "second writer"
 * would block the very thread that needs to release the lock and could only
 * ever run out the timeout.
 */

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

const CONTENTION_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]); // argv[1] = dbFile (node -e)
  db.exec('BEGIN IMMEDIATE');
  db.prepare('INSERT INTO busy_lock_test DEFAULT VALUES').run();
  console.log('LOCKED');
  setTimeout(() => { db.exec('COMMIT'); process.exit(0); }, 1000);
`;

test(
  'a contended write waits out an external writer instead of failing with SQLITE_BUSY',
  { timeout: 15_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yotara-busy-'));
    const dbFile = join(dir, 'test.db');
    const { sqlite } = createDbClient(dbFile);
    sqlite.exec('CREATE TABLE IF NOT EXISTS busy_lock_test (id INTEGER PRIMARY KEY)');

    const { child, stdout } = spawnNode(CONTENTION_SCRIPT, [dbFile]);

    try {
      await waitForLine(child, stdout, 'LOCKED');
      const started = Date.now();
      sqlite.prepare('INSERT INTO busy_lock_test DEFAULT VALUES').run();
      // The child holds the lock for ~1s, so this write must have waited for
      // it; without any busy timeout it would throw SQLITE_BUSY immediately.
      assert.ok(Date.now() - started >= 200, 'write should have waited for the lock');
    } finally {
      child.kill();
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

const ISOLATION_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.exec('BEGIN IMMEDIATE');
  db.prepare("INSERT INTO isolation_test (note) VALUES ('pending')").run();
  console.log('LOCKED');
  setTimeout(() => { db.exec('COMMIT'); process.exit(0); }, 1000);
`;

test(
  'readers are not blocked by an open writer transaction and only see committed rows',
  { timeout: 15_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yotara-isolation-'));
    const dbFile = join(dir, 'test.db');
    const { sqlite } = createDbClient(dbFile);
    sqlite.exec(`CREATE TABLE isolation_test (
      id INTEGER PRIMARY KEY,
      note TEXT NOT NULL
    )`);
    sqlite.prepare(`INSERT INTO isolation_test (note) VALUES ('committed')`).run();

    const { child, stdout } = spawnNode(ISOLATION_SCRIPT, [dbFile]);
    const exitPromise = waitForExit(child);

    try {
      await waitForLine(child, stdout, 'LOCKED');

      // In WAL mode the read must complete while the writer holds its
      // transaction (well under the child's 1s hold) and must not see the
      // uncommitted row.
      const started = Date.now();
      const rowsBefore = sqlite.prepare(`SELECT note FROM isolation_test ORDER BY id`).all();
      const readElapsed = Date.now() - started;

      assert.deepEqual(rowsBefore, [{ note: 'committed' }], 'uncommitted rows must stay invisible');
      assert.ok(readElapsed < 700, `read must not wait for the writer (took ${readElapsed}ms)`);

      const result = await exitPromise;
      assert.equal(result.code, 0, result.stderr);

      const rowsAfter = sqlite.prepare(`SELECT note FROM isolation_test ORDER BY id`).all();
      assert.deepEqual(rowsAfter, [{ note: 'committed' }, { note: 'pending' }]);
    } finally {
      child.kill();
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

const STRESS_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  const worker = process.argv[2];
  const txns = Number(process.argv[3]);
  const insert = db.prepare('INSERT INTO stress_test (worker) VALUES (?)');
  for (let i = 0; i < txns; i += 1) {
    db.exec('BEGIN IMMEDIATE');
    insert.run(worker);
    db.exec('COMMIT');
  }
`;

test(
  'concurrent writer processes queue without SQLITE_BUSY failures',
  { timeout: 30_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yotara-stress-'));
    const dbFile = join(dir, 'test.db');
    const { sqlite } = createDbClient(dbFile);
    sqlite.exec(`CREATE TABLE stress_test (
      id INTEGER PRIMARY KEY,
      worker TEXT NOT NULL
    )`);

    const workers = ['a', 'b', 'c'];
    const txnsPerWorker = 25;
    const children = workers.map((worker) =>
      spawnNode(STRESS_SCRIPT, [dbFile, worker, String(txnsPerWorker)]),
    );
    const exitPromises = children.map(({ child }) => waitForExit(child));

    try {
      const results = await Promise.all(exitPromises);
      results.forEach((result, index) => {
        assert.equal(result.code, 0, `worker ${workers[index]} failed: ${result.stderr}`);
      });

      const { n } = sqlite.prepare(`SELECT COUNT(*) AS n FROM stress_test`).get() as { n: number };
      assert.equal(n, workers.length * txnsPerWorker, 'every transaction must be committed');

      const { worker_count: workerCount } = sqlite
        .prepare(`SELECT COUNT(DISTINCT worker) AS worker_count FROM stress_test`)
        .get() as { worker_count: number };
      assert.equal(workerCount, workers.length, 'every worker must have made progress');
    } finally {
      for (const { child } of children) {
        child.kill();
      }
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

const CRASH_MID_TXN_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.pragma('synchronous = NORMAL');
  db.exec('BEGIN IMMEDIATE');
  db.prepare("INSERT INTO crash_test (note) VALUES ('pending')").run();
  console.log('LOCKED');
  setTimeout(() => {}, 60000);
`;

test(
  'SIGKILL during an open write transaction rolls back and leaves the database intact',
  { timeout: 15_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yotara-crash-mid-'));
    const dbFile = join(dir, 'test.db');
    const { sqlite } = createDbClient(dbFile);
    sqlite.exec(`CREATE TABLE crash_test (
    id INTEGER PRIMARY KEY,
    note TEXT NOT NULL
  )`);

    const { child, stdout } = spawnNode(CRASH_MID_TXN_SCRIPT, [dbFile]);
    const exitPromise = waitForExit(child);

    try {
      await waitForLine(child, stdout, 'LOCKED');
      child.kill('SIGKILL');
      const result = await exitPromise;
      assert.equal(result.signal, 'SIGKILL');

      assert.equal(sqlite.pragma('integrity_check', { simple: true }), 'ok');
      const { pending } = sqlite
        .prepare(`SELECT COUNT(*) AS pending FROM crash_test WHERE note = 'pending'`)
        .get() as { pending: number };
      assert.equal(pending, 0, 'an uncommitted write must not survive a crashed writer');

      // The crashed writer's lock must be released and the file writable again.
      sqlite.prepare(`INSERT INTO crash_test (note) VALUES ('after-crash')`).run();
      const { total } = sqlite.prepare(`SELECT COUNT(*) AS total FROM crash_test`).get() as {
        total: number;
      };
      assert.equal(total, 1);
    } finally {
      child.kill();
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

const CRASH_AFTER_COMMIT_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.pragma('synchronous = NORMAL');
  db.exec('BEGIN IMMEDIATE');
  db.prepare("INSERT INTO crash_test (note) VALUES ('committed')").run();
  db.exec('COMMIT');
  console.log('COMMITTED');
  setTimeout(() => {}, 60000);
`;

test('SIGKILL after COMMIT preserves the committed write', { timeout: 15_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yotara-crash-after-'));
  const dbFile = join(dir, 'test.db');
  const { sqlite } = createDbClient(dbFile);
  sqlite.exec(`CREATE TABLE crash_test (
    id INTEGER PRIMARY KEY,
    note TEXT NOT NULL
  )`);

  const { child, stdout } = spawnNode(CRASH_AFTER_COMMIT_SCRIPT, [dbFile]);
  const exitPromise = waitForExit(child);

  try {
    await waitForLine(child, stdout, 'COMMITTED');
    child.kill('SIGKILL');
    const result = await exitPromise;
    assert.equal(result.signal, 'SIGKILL');

    assert.equal(sqlite.pragma('integrity_check', { simple: true }), 'ok');
    const { committed } = sqlite
      .prepare(`SELECT COUNT(*) AS committed FROM crash_test WHERE note = 'committed'`)
      .get() as { committed: number };
    assert.equal(committed, 1, 'a committed write must survive a crashed writer process');
  } finally {
    child.kill();
    sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
