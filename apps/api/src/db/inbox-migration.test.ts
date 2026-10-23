import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import test from 'node:test';
import { createDbClient } from './client.js';

const LEGACY_INBOX_DESCRIPTION = 'Default capture space for incoming tasks.';

type SqliteDatabase = Database.Database;

interface SeedIds {
  exactInboxA: string;
  exactInboxB: string;
  exactInboxTaskA: string;
  exactInboxTaskB: string;
  workProject: string;
  workTask: string;
  renamedInbox: string;
  renamedInboxTask: string;
  differentDescription: string;
  differentDescriptionTask: string;
  noMatchProject: string;
}

function legacyDbFile(): string {
  return join(tmpdir(), `yotara-inbox-migration-${randomUUID()}.db`);
}

function insertUser(db: SqliteDatabase, id: string): void {
  db.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, ?, ?)`,
  ).run(id, id, `${id}@example.com`, Date.now(), Date.now());
}

function insertProject(
  db: SqliteDatabase,
  id: string,
  ownerId: string,
  name: string,
  description: string | null,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, owner_id, name, description, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
  ).run(id, ownerId, name, description, now, now);
}

function insertTask(db: SqliteDatabase, id: string, ownerId: string, projectId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (
       id, user_id, title, status, priority, completed, sort_order, simple_mode,
       project_id, permanent_archive, created_at, updated_at
     ) VALUES (?, ?, ?, 'inbox', 'medium', 0, 0, 0, ?, 0, ?, ?)`,
  ).run(id, ownerId, `Task ${id}`, projectId, now, now);
}

/**
 * Builds a database from before the Inbox retirement migration. The projects
 * table has description/color (as in the pre-migration app) but no retired_at.
 * Every case in the migration policy is represented by its own account.
 */
function seedLegacyDb(dbFile: string): SeedIds {
  const legacy = new Database(dbFile);
  legacy.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      emailVerified INTEGER NOT NULL,
      image TEXT,
      passwordSetupRequired INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX user_email_unique ON user (email);

    CREATE TABLE projects (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'inbox',
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      simple_mode INTEGER NOT NULL DEFAULT 0,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      permanent_archive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const userA = randomUUID();
  const userB = randomUUID();
  const userC = randomUUID();
  const userD = randomUUID();
  const userE = randomUUID();
  insertUser(legacy, userA);
  insertUser(legacy, userB);
  insertUser(legacy, userC);
  insertUser(legacy, userD);
  insertUser(legacy, userE);

  const ids: SeedIds = {
    exactInboxA: randomUUID(),
    exactInboxB: randomUUID(),
    exactInboxTaskA: randomUUID(),
    exactInboxTaskB: randomUUID(),
    workProject: randomUUID(),
    workTask: randomUUID(),
    renamedInbox: randomUUID(),
    renamedInboxTask: randomUUID(),
    differentDescription: randomUUID(),
    differentDescriptionTask: randomUUID(),
    noMatchProject: randomUUID(),
  };

  // Two accounts with the exact legacy seed signature (also the accepted
  // exact-signature collision case: rows are indistinguishable from seeds).
  insertProject(legacy, ids.exactInboxA, userA, 'Inbox', LEGACY_INBOX_DESCRIPTION);
  insertProject(legacy, ids.exactInboxB, userB, 'Inbox', LEGACY_INBOX_DESCRIPTION);
  insertTask(legacy, ids.exactInboxTaskA, userA, ids.exactInboxA);
  insertTask(legacy, ids.exactInboxTaskB, userB, ids.exactInboxB);

  // An unrelated project on the same account must stay intact.
  insertProject(
    legacy,
    ids.workProject,
    userA,
    'Work',
    'Job, clients, and professional commitments.',
  );
  insertTask(legacy, ids.workTask, userA, ids.workProject);

  // Renamed Inbox project: name changed, description still the seed value.
  insertProject(legacy, ids.renamedInbox, userC, 'Inbox Renamed', LEGACY_INBOX_DESCRIPTION);
  insertTask(legacy, ids.renamedInboxTask, userC, ids.renamedInbox);

  // Same name, different description: not the legacy seed.
  insertProject(legacy, ids.differentDescription, userD, 'Inbox', 'My own notes');
  insertTask(legacy, ids.differentDescriptionTask, userD, ids.differentDescription);

  // Account with no Inbox-shaped project at all.
  insertProject(legacy, ids.noMatchProject, userE, 'Only Project', 'Nothing to migrate');

  legacy.close();
  return ids;
}

function getProject(client: ReturnType<typeof createDbClient>, id: string) {
  return client.sqlite.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
    | { retired_at: string | null; name: string; description: string | null }
    | undefined;
}

function getTaskProjectId(client: ReturnType<typeof createDbClient>, id: string) {
  const row = client.sqlite.prepare(`SELECT project_id FROM tasks WHERE id = ?`).get(id) as
    | { project_id: string | null }
    | undefined;
  assert.ok(row);
  return row.project_id;
}

test('legacy Inbox retirement detaches tasks and is idempotent', () => {
  const dbFile = legacyDbFile();
  const ids = seedLegacyDb(dbFile);

  try {
    let client = createDbClient(dbFile);
    try {
      assert.ok(getProject(client, ids.exactInboxA)?.retired_at);
      assert.ok(getProject(client, ids.exactInboxB)?.retired_at);
      assert.equal(getTaskProjectId(client, ids.exactInboxTaskA), null);
      assert.equal(getTaskProjectId(client, ids.exactInboxTaskB), null);

      // Unrelated project and its task are untouched.
      assert.equal(getProject(client, ids.workProject)?.retired_at ?? null, null);
      assert.equal(getTaskProjectId(client, ids.workTask), ids.workProject);

      // Renamed projects and same-name/different-description projects stay active.
      assert.equal(getProject(client, ids.renamedInbox)?.retired_at ?? null, null);
      assert.equal(getTaskProjectId(client, ids.renamedInboxTask), ids.renamedInbox);
      assert.equal(getProject(client, ids.differentDescription)?.retired_at ?? null, null);
      assert.equal(
        getTaskProjectId(client, ids.differentDescriptionTask),
        ids.differentDescription,
      );

      // Accounts with no match are untouched.
      assert.equal(getProject(client, ids.noMatchProject)?.retired_at ?? null, null);

      const firstRetiredAt = getProject(client, ids.exactInboxA)?.retired_at;
      client.sqlite.close();

      // A second startup is a no-op for the already-retired rows.
      client = createDbClient(dbFile);
      assert.equal(getProject(client, ids.exactInboxA)?.retired_at, firstRetiredAt);
      assert.equal(getTaskProjectId(client, ids.exactInboxTaskA), null);
      assert.equal(getProject(client, ids.renamedInbox)?.retired_at ?? null, null);
    } finally {
      client.sqlite.close();
    }
  } finally {
    rmSync(dbFile, { force: true });
  }
});

test('an interrupted Inbox retirement rolls back both tasks and projects', () => {
  const dbFile = legacyDbFile();
  const ids = seedLegacyDb(dbFile);

  try {
    const raw = new Database(dbFile);
    raw.exec(`
      CREATE TRIGGER abort_inbox_retirement
      BEFORE UPDATE ON projects
      WHEN OLD.name = 'Inbox'
      BEGIN
        SELECT RAISE(ABORT, 'forced migration failure');
      END;
    `);
    raw.close();

    assert.throws(() => createDbClient(dbFile), /forced migration failure/);

    const afterFailure = new Database(dbFile);
    try {
      const projectColumns = afterFailure.prepare(`PRAGMA table_info('projects')`).all() as Array<{
        name: string;
      }>;
      const project = afterFailure
        .prepare(`SELECT name FROM projects WHERE id = ?`)
        .get(ids.exactInboxA) as { name: string } | undefined;
      assert.ok(project);
      assert.equal(project.name, 'Inbox');
      // The whole schema transaction rolled back, including the new column.
      assert.ok(!projectColumns.some((column) => column.name === 'retired_at'));
      const task = afterFailure
        .prepare(`SELECT project_id FROM tasks WHERE id = ?`)
        .get(ids.exactInboxTaskA) as { project_id: string | null };
      assert.equal(task.project_id, ids.exactInboxA, 'tasks stay attached after rollback');

      afterFailure.exec(`DROP TRIGGER abort_inbox_retirement`);
    } finally {
      afterFailure.close();
    }

    // The next startup completes the migration normally.
    const client = createDbClient(dbFile);
    try {
      assert.ok(getProject(client, ids.exactInboxA)?.retired_at);
      assert.equal(getTaskProjectId(client, ids.exactInboxTaskA), null);
    } finally {
      client.sqlite.close();
    }
  } finally {
    rmSync(dbFile, { force: true });
  }
});
