# Plan: SQLite Concurrency Hardening & Architectural Scaling Docs

> **Status:** Active Plan
> **Owner:** @apauldev
> **Date:** 2026-10-15
>
> Implementation plan to pin SQLite's runtime concurrency pragmas (`busy_timeout = 5000`, `synchronous = NORMAL`) explicitly so the contract is visible, tested, and independent of better-sqlite3 defaults, and to thoroughly document capacity estimates, scaling limits, and PostgreSQL graduation criteria in `docs/ARCHITECTURE.md`.

---

## 1. Context & Motivation

Yotara is built on SQLite to provide a sovereign, zero-maintenance, calm personal task manager. In SQLite's Write-Ahead Logging (WAL) mode, reads and writes do not block each other, and single-node deployments on modern NVMe storage can serve read-heavy workloads in the 10,000–25,000+ Daily Active Users (DAU) range (an order-of-magnitude planning estimate, not a measured benchmark — see Task 3).

However, one behavior gap, one contract gap, and one documentation gap exist:

1. **Implicit `busy_timeout`**: better-sqlite3's constructor happens to default the busy timeout to 5000ms (verified against v13.0.2), but nothing in Yotara's code, tests, or docs asserts that contract — it silently depends on a library default. Pin `busy_timeout = 5000` explicitly so the wait behavior is deliberate, tested, and survives a library default change. Contention itself is multi-process: in-process writes cannot contend (better-sqlite3 is synchronous, so the event loop serializes every call on the app's single connection), but contention is real whenever a second process touches the same database file: process clustering, `sqlite3` CLI or `.backup` scripts, Litestream, and CI test processes.
2. **Default `synchronous = FULL`**: Forces multiple disk syncs per transaction commit. In WAL mode, `PRAGMA synchronous = NORMAL` is safe against application and OS crashes — a power loss can roll back the most recent commits, but SQLite never corrupts the database — while boosting write IOPS by roughly 3x–5x.
3. **Under-documented Architectural Boundaries**: `docs/ARCHITECTURE.md` only briefly mentions SQLite, leaving maintainers without clear guidance on write concurrency limits, user scale capacity, and the exact criteria for when a migration to PostgreSQL is warranted.

---

## 2. Proposed Changes

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Code & Test Changes (apps/api/src/db/)                                 │
│  ├─ client.ts: busy_timeout = 5000 (before schema bootstrap) and       │
│  │             synchronous = NORMAL (after journal_mode = WAL)         │
│  └─ pragmas.test.ts: Pragma values on :memory: + file DBs, and a       │
│                      multi-process busy_timeout regression test        │
├────────────────────────────────────────────────────────────────────────┤
│ Documentation Changes (docs/)                                          │
│  ├─ ARCHITECTURE.md: Expand "SQLite first" with scale estimates, limits,│
│  │                   concurrency model, and Postgres graduation path   │
│  └─ CONFIGURATION.md: Document pragma defaults + WAL sidecar files      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Tasks

### Task 1: Harden SQLite Pragmas in `apps/api/src/db/client.ts`

**Files to modify:**
- `apps/api/src/db/client.ts`

**Implementation details:**
In `createDbClient()`, the two pragmas are set at two different points (order matters on startup):

1. Immediately after `new Database(databasePath)` and **before** `ensureSqliteSchema(sqlite)`, so the schema bootstrap's `BEGIN IMMEDIATE` also waits out an external writer instead of failing with `SQLITE_BUSY`:

```ts
// Queue write transactions for up to 5000ms instead of failing immediately
// with SQLITE_BUSY when another process (backup, CLI, clustered instance)
// holds the write lock. Set before the schema bootstrap so it benefits too.
// (better-sqlite3's constructor default is also 5000ms; this pins the value
// explicitly so the contract is visible, tested, and independent of it.)
sqlite.pragma('busy_timeout = 5000');
```

2. Immediately after the existing `sqlite.pragma('journal_mode = WAL');` line:

```ts
// In WAL mode, synchronous = NORMAL avoids an fsync on every commit while
// staying safe against application and OS crashes. A power loss can roll
// back the most recent commits, but never corrupts the database.
sqlite.pragma('synchronous = NORMAL');
```

Note: better-sqlite3 is synchronous, so a busy wait blocks the Node.js event loop for up to 5 seconds. That is acceptable while the app is a single process (it cannot contend with itself); revisit the timeout if process clustering is introduced.

---

### Task 2: Add Pragma & Concurrency Regression Tests

**Files to create:**
- `apps/api/src/db/pragmas.test.ts`

**Verification requirements:**
1. Pragma values, asserted on both database flavors:
   - `:memory:` databases: `journal_mode === 'memory'` (SQLite refuses WAL for in-memory DBs, so asserting `'wal'` here would be wrong), plus `synchronous === 1` (`1` is SQLite's numeric `NORMAL`), `busy_timeout === 5000`, and `foreign_keys === 1`.
   - File-backed databases (temp dir): `journal_mode === 'wal'` plus the same `synchronous`/`busy_timeout`/`foreign_keys` assertions.
2. Multi-process contention: a second **child process** opens the same database file, starts an immediate write transaction, and holds the lock for ~1s while the test performs its own write on the existing connection; the write must succeed (it would throw `SQLITE_BUSY` immediately without any busy timeout). This must be a child process: better-sqlite3 is synchronous, so an in-process contender would block the very thread that needs to release the lock and could only ever run out the timeout. Note: because better-sqlite3 already defaults to a 5000ms timeout, this test passes even before the explicit pragma lands — it locks the end-to-end behavior, while the pragma-value assertions pin the explicit contract.

---

### Task 3: Expand "SQLite first" in `docs/ARCHITECTURE.md`

**Files to modify:**
- `docs/ARCHITECTURE.md`

**Content to document:**
1. **Concurrency Architecture:**
   - Explain WAL mode (concurrent readers never block writers; writer never blocks readers).
   - Note that the app runs on a single synchronous connection, so in-process calls are serialized by the event loop; `busy_timeout` matters for external writers (process clustering, CLI/`.backup` scripts, Litestream, test processes).
   - Document immediate transactions (`BEGIN IMMEDIATE`) and the 5-second `busy_timeout` queue, including its trade-off: a contended write synchronously blocks the event loop for up to 5 seconds.
   - Explain why `synchronous = NORMAL` is safe in WAL mode: application and OS crashes lose nothing; a power loss can roll back recent commits but never corrupts the database.
2. **Capacity & Performance Estimates** (clearly labeled as order-of-magnitude planning estimates, not benchmark results; state assumptions: NVMe SSD, read-heavy personal-task workload, single API process):
   - Single-node throughput: on the order of ~1,000 write ops/sec and >10,000 read ops/sec.
   - User capacity profile:
     - 50,000 to 100,000 registered users.
     - 10,000 to 25,000 Daily Active Users (DAU).
     - 500 to 1,500 concurrent active users.
   - Note that these figures are targets to validate against production metrics; the graduation criteria below — not the estimates — trigger a migration.
3. **Bottleneck Sequence (What breaks first):**
   - Stage 1: CPU / Node.js single-threaded event loop (mitigated by process clustering).
   - Stage 2: SQLite write serialization under heavy simultaneous writes (>500 writes/sec across clustered processes; a busy wait blocks the waiting process's event loop for up to the 5-second timeout).
   - Stage 3: Backup snapshot duration on very large DB files (>50GB).
4. **PostgreSQL Graduation Criteria (When to migrate):**
   - Define the explicit triggers for moving away from SQLite:
     1. Multi-node active-active horizontal scaling requirement.
     2. High-concurrency team collaboration requiring sustained >500 writes/sec.
     3. Cross-region multi-master data replication.
5. **High Availability & Disaster Recovery Roadmap:**
   - Current WAL-safe backup (`sqlite3 .backup`).
   - Future path: Continuous sub-second replication to S3/R2 via **Litestream**.

---

### Task 4: Align `docs/CONFIGURATION.md` & Verify Documentation Consistency

**Files to modify:**
- `docs/CONFIGURATION.md`

**Content to add** (a short note near the `DATABASE_URL` row):
1. Runtime pragma defaults: `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`.
2. WAL sidecar files (`-wal`/`-shm`) live next to the database file: filesystem-level backups must include or checkpoint them, or use `sqlite3 .backup`.

**Verification commands:**
```bash
# 1. Verify docs match environment variables
pnpm docs:check:env

# 2. Typecheck workspace
pnpm typecheck

# 3. Run all unit test suites
pnpm test

# 4. Lint check
pnpm lint
```

---

## 4. Risks & Mitigations

| Risk | Mitigation |
|:---|:---|
| `busy_timeout = 5000` might mask a deadlocked write in poorly structured transactions | All multi-statement write paths acquire their locks up front: the `task`, `label`, and `user` services use Drizzle's `{ behavior: 'immediate' }`, and the schema bootstrap and email cleanup use raw `BEGIN IMMEDIATE`. |
| A synchronous busy wait blocks the Node.js event loop for up to 5 seconds | The app is a single process with one connection, so it cannot contend with itself; contention requires an external writer (clustering, CLI/`.backup`, Litestream). Trade-off documented in `ARCHITECTURE.md`; revisit the timeout when clustering lands. |
| Power loss with `synchronous = NORMAL` can roll back the most recent commits | Accepted and documented: the database is never corrupted, only the newest commits may be lost. Switch to `FULL` if the durability requirement changes. |
| In-memory test databases (`:memory:`) cannot use WAL | Assertions cover both paths individually: `:memory:` keeps `journal_mode = 'memory'`; a temp-file database asserts `'wal'`. |
| Docs drift against CI scripts | Verified using automated `pnpm docs:check:env` test. |
