# SQLite Concurrency Hardening & Scaling Docs Implementation Plan

> **Status:** Completed 2026-10-15 in PR [#404](https://github.com/apauldev/Yotara/pull/404). All steps below were executed; the additional tests, benchmark, and macOS CI job are summarized in the [spec's outcome section](../../plans/2026-10-15-sqlite-scaling-and-concurrency.md#5-outcome-as-implemented).

**Goal:** Pin SQLite's runtime concurrency pragmas (`busy_timeout = 5000`, `synchronous = NORMAL`) explicitly so the contract is visible, tested, and independent of better-sqlite3 defaults (its constructor default busy timeout is already 5000ms; `synchronous` defaults to `FULL`), and thoroughly document capacity estimates, scaling limits, and PostgreSQL graduation criteria in `docs/ARCHITECTURE.md`.

**Architecture:** Set `busy_timeout` in `createDbClient` before the schema bootstrap and `synchronous = NORMAL` next to the existing WAL pragma (`apps/api/src/db/client.ts`), add pragma + multi-process contention regression tests in `apps/api/src/db/pragmas.test.ts`, and expand `docs/ARCHITECTURE.md` and `docs/CONFIGURATION.md`. Note: the `busy_timeout` pragma pins better-sqlite3's existing 5000ms constructor default explicitly; `synchronous = NORMAL` is the behavioral change. Zero new npm dependencies.

**Tech Stack:** Fastify 5, Drizzle ORM, better-sqlite3, Node ≥ 22.22.3 builtins.

**Spec:** [`docs/plans/2026-10-15-sqlite-scaling-and-concurrency.md`](../../plans/2026-10-15-sqlite-scaling-and-concurrency.md)

---

### Task 1: Add Pragmas & Regression Tests

**Files:**
- Create: `apps/api/src/db/pragmas.test.ts`
- Modify: `apps/api/src/db/client.ts`

- [x] **Step 1: Write the failing tests**
Create `apps/api/src/db/pragmas.test.ts` with pragma-value tests for both database flavors:
```ts
import assert from 'node:assert/strict';
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
```

- [x] **Step 2: Add the multi-process contention test**
Append to `pragmas.test.ts` (merge the `spawn` import into the existing import block). This must use a child process — better-sqlite3 is synchronous, so an in-process contender would block the thread that needs to release the lock and could only ever run out the timeout.
```ts
import { spawn } from 'node:child_process';

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

test('a contended write waits out an external writer instead of failing with SQLITE_BUSY', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yotara-busy-'));
  const dbFile = join(dir, 'test.db');
  const { sqlite } = createDbClient(dbFile);
  sqlite.exec('CREATE TABLE IF NOT EXISTS busy_lock_test (id INTEGER PRIMARY KEY)');

  // cwd: the apps/api package root, so the child can require('better-sqlite3').
  const child = spawn(process.execPath, ['-e', CHILD_SCRIPT, dbFile], {
    cwd: new URL('../../', import.meta.url),
  });

  try {
    await waitForLine(child.stdout!, 'LOCKED');
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
});
```

- [x] **Step 3: Run tests to confirm failure**
Run `pnpm --filter @yotara/api test` and verify both pragma tests fail on `synchronous` (better-sqlite3 defaults to `FULL` = 2). `busy_timeout` already reads 5000 from better-sqlite3's constructor default, and the contention test also passes pre-fix — that is expected; the explicit pragma pins the contract and the assertions lock it in.

- [x] **Step 4: Update `apps/api/src/db/client.ts`**
Set the two pragmas at two points in `createDbClient` (order matters):
1. Right after `const sqlite = new Database(databasePath);`, **before** `ensureSqliteSchema(sqlite)`, so the schema bootstrap's `BEGIN IMMEDIATE` also waits out external writers (this pins better-sqlite3's constructor default explicitly):
```ts
// Queue write transactions for up to 5000ms instead of failing immediately
// with SQLITE_BUSY when another process holds the write lock. Set before the
// schema bootstrap so it benefits too. (better-sqlite3's constructor default
// is also 5000ms; this pins the value explicitly so the contract is visible,
// tested, and independent of it.)
sqlite.pragma('busy_timeout = 5000');
```
2. Next to the existing `sqlite.pragma('journal_mode = WAL');`:
```ts
// In WAL mode, synchronous = NORMAL avoids an fsync per commit while staying
// safe against application and OS crashes. A power loss can roll back recent
// commits, but never corrupts the database.
sqlite.pragma('synchronous = NORMAL');
```

- [x] **Step 5: Run tests to confirm they pass**
Run `pnpm --filter @yotara/api test` and verify all tests pass.

---

### Task 2: Update `docs/ARCHITECTURE.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [x] **Step 1: Expand "SQLite first" section**
Document:
1. Concurrency model: WAL non-blocking reads, serialized immediate write transactions, and the fact that a single synchronous connection serializes in-process calls — cross-process writers (clustering, CLI/`.backup`, Litestream) are the real contention source.
2. Pragma tuning (`journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`), including:
   - `synchronous = NORMAL` is safe against application and OS crashes; a power loss can roll back the most recent commits but never corrupts the database.
   - `busy_timeout` is a synchronous wait: a contended write blocks the event loop for up to 5 seconds, and only external writers can trigger it today.
3. Capacity estimates, clearly labeled as order-of-magnitude planning figures with stated assumptions (NVMe storage, read-heavy workload), not measured benchmarks: 10k–25k DAU, 50k–100k registered users, on the order of ~1,000 writes/sec.
4. Bottleneck progression (Node.js event loop → SQLite write serialization across clustered processes → backup snapshot duration).
5. PostgreSQL Graduation Criteria (clear triggers for when to migrate).
6. High Availability & Disaster Recovery (current WAL-safe backups including `-wal`/`-shm` sidecars + Litestream path).

---

### Task 3: Align `docs/CONFIGURATION.md` & Verify

**Files:**
- Modify: `docs/CONFIGURATION.md`

- [x] **Step 1: Add a storage/pragma note near the `DATABASE_URL` row**
Document:
1. Runtime pragma defaults: `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`.
2. WAL sidecar files (`-wal`/`-shm`) live next to the database file: filesystem-level backups must include or checkpoint them, or use `sqlite3 .backup`.

- [x] **Step 2: Run checks**
  - [x] `pnpm docs:check:env`
  - [x] `pnpm typecheck`
  - [x] `pnpm test`
  - [x] `pnpm lint`
