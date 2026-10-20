import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import test from 'node:test';
import { createDbClient } from './client.js';

type SqliteDatabase = Database.Database;

function seedUserRow(db: SqliteDatabase, id: string, name: string): void {
  db.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)`,
  ).run(id, name, `${id}@example.com`, Date.now(), Date.now());
}

function insertLegacyLabel(
  db: SqliteDatabase,
  id: string,
  userId: string,
  name: string,
  createdAt: string,
): void {
  db.prepare(
    `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
     VALUES (?, ?, ?, '#82d7a9', ?, ?)`,
  ).run(id, userId, name, createdAt, createdAt);
}

/**
 * Builds a legacy database that predates the label-uniqueness migration:
 * the labels table has no unique index per (user_id, lower(trim(name)))
 * and may therefore contain case/whitespace variants of the same name.
 * Running createDbClient on this file boots ensureSqliteSchema, which must
 * merge the duplicates without losing any task association.
 */
function seedLegacyDb(dbFile: string): {
  userA: string;
  userB: string;
  canonical: string;
  casingDupe: string;
  whitespaceDupe: string;
  foreignLabel: string;
} {
  const legacy = new Database(dbFile);
  legacy.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      emailVerified INTEGER NOT NULL,
      onboardingCompleted INTEGER NOT NULL DEFAULT 0,
      archiveAutoDelete INTEGER NOT NULL DEFAULT 1,
      captureBehavior TEXT NOT NULL DEFAULT 'quick',
      workspaceMode TEXT,
      image TEXT,
      passwordSetupRequired INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX user_email_unique ON user (email);
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inbox',
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      simple_mode INTEGER NOT NULL DEFAULT 0,
      bucket TEXT DEFAULT 'personal-sanctuary',
      permanent_archive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE labels (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE task_labels (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const userId = randomUUID();
  const otherUserId = randomUUID();
  seedUserRow(legacy, userId, 'User A');
  seedUserRow(legacy, otherUserId, 'User B');

  // "Writing" is the canonical row: earliest non-empty created_at.
  const canonical = randomUUID();
  const casingDupe = randomUUID();
  const whitespaceDupe = randomUUID();
  const foreignLabel = randomUUID();
  insertLegacyLabel(legacy, canonical, userId, 'Writing', '2024-01-01T00:00:00Z');
  insertLegacyLabel(legacy, casingDupe, userId, 'writing', '2024-02-01T00:00:00Z');
  insertLegacyLabel(legacy, whitespaceDupe, userId, '  Writing  ', '2024-03-01T00:00:00Z');
  // Same name, different owner: must never be merged into user A's label.
  insertLegacyLabel(legacy, foreignLabel, otherUserId, 'writing', '2024-01-01T00:00:00Z');

  const insertTask = legacy.prepare(
    `INSERT INTO tasks (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertJoin = legacy.prepare(`INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)`);
  const tasks = [
    { id: randomUUID(), labelId: canonical },
    { id: randomUUID(), labelId: casingDupe },
    { id: randomUUID(), labelId: whitespaceDupe },
    { id: randomUUID(), labelId: whitespaceDupe },
  ];
  for (const task of tasks) {
    insertTask.run(
      task.id,
      userId,
      `Task for ${task.labelId}`,
      '2024-01-02T00:00:00Z',
      '2024-01-02T00:00:00Z',
    );
    insertJoin.run(task.id, task.labelId);
  }
  // One task points at BOTH a dupe and the canonical.
  insertJoin.run(tasks[3].id, canonical);

  legacy.close();

  return { userA: userId, userB: otherUserId, canonical, casingDupe, whitespaceDupe, foreignLabel };
}

test('startup migration merges duplicate labels without losing task associations', () => {
  const dir = join(tmpdir(), `yotara-labels-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const dbFile = join(dir, 'test.db');
  const seed = seedLegacyDb(dbFile);

  try {
    const { sqlite } = createDbClient(dbFile);
    try {
      const labels = sqlite
        .prepare(`SELECT id, name FROM labels WHERE user_id = ? ORDER BY id`)
        .all(seed.userA) as Array<{ id: string; name: string }>;
      assert.equal(labels.length, 1, 'the three Writing variants collapse to one row');
      assert.equal(labels[0].id, seed.canonical, 'the earliest-created label survives');
      assert.equal(labels[0].name, 'Writing', 'the canonical name is kept as stored');

      const otherUser = sqlite
        .prepare(`SELECT id FROM labels WHERE user_id = ?`)
        .all(seed.userB) as Array<{ id: string }>;
      assert.deepEqual(
        otherUser.map((row) => row.id),
        [seed.foreignLabel],
        'another user’s same-named label is untouched',
      );

      const joins = sqlite
        .prepare(`SELECT task_id FROM task_labels WHERE label_id = ? ORDER BY task_id`)
        .all(seed.canonical) as Array<{ task_id: string }>;
      assert.equal(joins.length, 4, 'every task keeps exactly one association');
      const orphaned = sqlite
        .prepare(`SELECT COUNT(*) AS n FROM task_labels WHERE label_id IN (?, ?)`)
        .get(seed.casingDupe, seed.whitespaceDupe) as { n: number };
      assert.equal(orphaned.n, 0, 'join rows pointing at deleted duplicates are gone');

      const uniqueIndex = sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_labels_user_name_unique'`,
        )
        .get();
      assert.ok(uniqueIndex, 'the unique index exists after dedupe');

      const joinIndex = sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_task_labels_label_id'`,
        )
        .get();
      assert.ok(joinIndex, 'the task_labels label_id index exists');
    } finally {
      sqlite.close();
    }

    // A second startup is a no-op: the index already enforces uniqueness, the
    // dedupe pre-check finds no groups, and the data is unchanged.
    const { sqlite: reopened } = createDbClient(dbFile);
    try {
      const labels = reopened
        .prepare(`SELECT COUNT(*) AS n FROM labels WHERE user_id = ?`)
        .get(seed.userA) as { n: number };
      assert.equal(labels.n, 1);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a fresh bootstrap creates the uniqueness and join indexes', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const indexes = (
      sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN
           ('idx_labels_user_name_unique', 'idx_task_labels_label_id')`,
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    assert.ok(indexes.includes('idx_labels_user_name_unique'));
    assert.ok(indexes.includes('idx_task_labels_label_id'));

    const columns = sqlite.prepare(`PRAGMA table_info('labels')`).all() as Array<{
      name: string;
    }>;
    const names = columns.map((column) => column.name);
    assert.ok(names.includes('icon'));
    assert.ok(names.includes('pinned'));
  } finally {
    sqlite.close();
  }
});

test('startup migration backfills icon and pinned on legacy label rows', () => {
  const dir = join(tmpdir(), `yotara-labels-icons-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const dbFile = join(dir, 'labels.db');

  try {
    const seed = seedLegacyDb(dbFile);
    const { sqlite } = createDbClient(dbFile);
    try {
      const columns = sqlite.prepare(`PRAGMA table_info('labels')`).all() as Array<{
        name: string;
      }>;
      const names = columns.map((column) => column.name);
      assert.ok(names.includes('icon'));
      assert.ok(names.includes('pinned'));

      const row = sqlite
        .prepare(`SELECT icon, pinned FROM labels WHERE id = ?`)
        .get(seed.canonical) as { icon: string; pinned: number };
      assert.equal(row.icon, 'tag');
      assert.equal(row.pinned, 0);
    } finally {
      sqlite.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the unique index rejects a duplicate name that differs only by case or whitespace', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUserRow(sqlite, 'u1', 'User A');
    seedUserRow(sqlite, 'u2', 'User B');
    sqlite
      .prepare(
        `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
         VALUES ('l1', 'u1', 'Writing', '#82d7a9', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')`,
      )
      .run();
    assert.throws(() => {
      sqlite
        .prepare(
          `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
           VALUES ('l2', 'u1', '  writing  ', '#82d7a9', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z')`,
        )
        .run();
    });
    // Different owners may reuse the name.
    sqlite
      .prepare(
        `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
         VALUES ('l3', 'u2', 'writing', '#82d7a9', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z')`,
      )
      .run();
  } finally {
    sqlite.close();
  }
});
