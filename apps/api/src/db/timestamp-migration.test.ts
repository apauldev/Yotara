import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

function toIso(value: number) {
  return new Date(value).toISOString();
}

function seedLegacyDatabase(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
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
    );

    CREATE TABLE projects (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE NO ACTION
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'inbox',
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      simple_mode INTEGER NOT NULL DEFAULT 0,
      bucket TEXT DEFAULT 'personal-sanctuary',
      project_id TEXT,
      deleted_at TEXT,
      archived_at TEXT,
      permanent_archive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE labels (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    CREATE TABLE task_labels (
      task_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (task_id, label_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    );
  `);

  const userId = `user-${randomUUID()}`;
  const projectId = `project-${randomUUID()}`;
  const taskId = `task-${randomUUID()}`;
  const labelId = `label-${randomUUID()}`;
  const createdAt = 1773652800000;
  const updatedAt = 1773656400000;
  const archivedAt = 1773660000000;

  sqlite
    .prepare(
      `INSERT INTO user (id, name, email, emailVerified, image, workspaceMode, onboardingCompleted, archiveAutoDelete, captureBehavior, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      'Legacy User',
      'legacy@example.com',
      0,
      null,
      null,
      0,
      1,
      'quick',
      createdAt,
      updatedAt,
    );

  sqlite
    .prepare(
      `INSERT INTO projects (id, owner_id, name, description, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      projectId,
      userId,
      'Legacy Project',
      'Seeded legacy project',
      'sage',
      createdAt,
      updatedAt,
    );

  sqlite
    .prepare(
      `INSERT INTO tasks (id, user_id, title, description, status, priority, completed, sort_order, due_date, simple_mode, bucket, project_id, deleted_at, archived_at, permanent_archive, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      taskId,
      userId,
      'Legacy Task',
      'Seeded legacy task',
      'today',
      'high',
      1,
      0,
      null,
      0,
      'deep-work',
      projectId,
      '',
      '',
      0,
      createdAt,
      updatedAt,
    );

  sqlite
    .prepare(
      `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(labelId, userId, 'Legacy Label', '#82d7a9', '', updatedAt);

  sqlite.prepare(`INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)`).run(taskId, labelId);
  sqlite.close();

  return { userId, projectId, taskId, labelId, createdAt, updatedAt, archivedAt };
}

function assertIsoTimestamp(value: unknown) {
  assert.equal(typeof value, 'string');
  assert.match(String(value), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

test('legacy timestamp rows are normalized to ISO text on startup', async () => {
  const dbFile = join(tmpdir(), `yotara-timestamp-migration-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  try {
    const seeded = seedLegacyDatabase(dbFile);
    const { sqlite } = await import('./client.js');

    const projectRow = sqlite
      .prepare(
        `SELECT typeof(created_at) AS created_type, typeof(updated_at) AS updated_type, created_at, updated_at FROM projects WHERE id = ?`,
      )
      .get(seeded.projectId) as {
      created_type: string;
      updated_type: string;
      created_at: string;
      updated_at: string;
    };
    assert.equal(projectRow.created_type, 'text');
    assert.equal(projectRow.updated_type, 'text');
    assertIsoTimestamp(projectRow.created_at);
    assertIsoTimestamp(projectRow.updated_at);
    assert.equal(projectRow.created_at, toIso(seeded.createdAt));
    assert.equal(projectRow.updated_at, toIso(seeded.updatedAt));

    const taskRow = sqlite
      .prepare(
        `SELECT typeof(created_at) AS created_type, typeof(updated_at) AS updated_type, typeof(archived_at) AS archived_type, typeof(deleted_at) AS deleted_type, created_at, updated_at, archived_at, deleted_at FROM tasks WHERE id = ?`,
      )
      .get(seeded.taskId) as {
      created_type: string;
      updated_type: string;
      archived_type: string;
      deleted_type: string;
      created_at: string;
      updated_at: string;
      archived_at: string | null;
      deleted_at: string | null;
    };
    assert.equal(taskRow.created_type, 'text');
    assert.equal(taskRow.updated_type, 'text');
    assert.equal(taskRow.archived_type, 'text');
    assert.equal(taskRow.deleted_type, 'null');
    assertIsoTimestamp(taskRow.created_at);
    assertIsoTimestamp(taskRow.updated_at);
    assertIsoTimestamp(taskRow.archived_at);
    assert.equal(taskRow.deleted_at, null);
    assert.equal(taskRow.archived_at, toIso(seeded.updatedAt));

    const labelRow = sqlite
      .prepare(
        `SELECT typeof(created_at) AS created_type, typeof(updated_at) AS updated_type, created_at, updated_at FROM labels WHERE id = ?`,
      )
      .get(seeded.labelId) as {
      created_type: string;
      updated_type: string;
      created_at: string;
      updated_at: string;
    };
    assert.equal(labelRow.created_type, 'text');
    assert.equal(labelRow.updated_type, 'text');
    assertIsoTimestamp(labelRow.created_at);
    assertIsoTimestamp(labelRow.updated_at);
    assert.equal(labelRow.created_at, toIso(seeded.updatedAt));
    assert.equal(labelRow.updated_at, toIso(seeded.updatedAt));
  } finally {
    rmSync(dbFile, { force: true });
    delete process.env['DATABASE_URL'];
    delete process.env['BETTER_AUTH_SECRET'];
    delete process.env['APP_BASE_URL'];
  }
});
