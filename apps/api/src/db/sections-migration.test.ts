import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import test from 'node:test';
import { createDbClient } from './client.js';

function legacyDbFile(): string {
  return join(tmpdir(), `yotara-sections-migration-${randomUUID()}.db`);
}

/** A database from before sections existed: no project_sections, no section_id. */
function seedLegacyDb(dbFile: string): void {
  const db = new Database(dbFile);
  db.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      emailVerified INTEGER NOT NULL,
      passwordSetupRequired INTEGER NOT NULL DEFAULT 0,
      captureBehavior TEXT NOT NULL DEFAULT 'quick',
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
      kind TEXT NOT NULL DEFAULT 'project',
      target_date TEXT,
      completed_at TEXT,
      archived_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      retired_at TEXT,
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
      due_time TEXT,
      simple_mode INTEGER NOT NULL DEFAULT 0,
      project_id TEXT,
      parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      recurrence_rule TEXT,
      base_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      deleted_at TEXT,
      archived_at TEXT,
      permanent_archive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
  `);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, ?, ?)`,
  ).run('user-1', 'User', 'user@example.com', Date.now(), Date.now());
  db.prepare(
    `INSERT INTO projects (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('project-1', 'user-1', 'Project', now, now);
  db.prepare(
    `INSERT INTO tasks (id, user_id, title, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run('task-1', 'user-1', 'Task', 'project-1', now, now);
  db.close();
}

test('fresh databases include project_sections and tasks.section_id', () => {
  const { sqlite, databasePath } = createDbClient(':memory:');

  const sectionColumns = sqlite.prepare(`PRAGMA table_info('project_sections')`).all() as Array<{
    name: string;
  }>;
  assert.deepEqual(
    sectionColumns.map((column) => column.name),
    ['id', 'project_id', 'name', 'sort_order', 'created_at', 'updated_at'],
  );

  const taskColumns = sqlite.prepare(`PRAGMA table_info('tasks')`).all() as Array<{
    name: string;
  }>;
  assert.ok(taskColumns.some((column) => column.name === 'section_id'));

  const indexes = sqlite.prepare(`PRAGMA index_list('project_sections')`).all() as Array<{
    name: string;
  }>;
  assert.ok(indexes.some((index) => index.name === 'idx_project_sections_project_order'));

  assert.equal(databasePath, ':memory:');
});

test('legacy databases gain sections support and deleting a section unsections tasks', () => {
  const dbFile = legacyDbFile();
  try {
    seedLegacyDb(dbFile);

    // First and second startup must both be safe (idempotent migration).
    createDbClient(dbFile).sqlite.close();
    const { sqlite } = createDbClient(dbFile);

    const sectionColumns = sqlite.prepare(`PRAGMA table_info('project_sections')`).all() as Array<{
      name: string;
    }>;
    assert.equal(sectionColumns.length, 6);
    const taskColumns = sqlite.prepare(`PRAGMA table_info('tasks')`).all() as Array<{
      name: string;
    }>;
    assert.ok(taskColumns.some((column) => column.name === 'section_id'));

    const now = new Date().toISOString();
    sqlite
      .prepare(
        `INSERT INTO project_sections (id, project_id, name, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
      )
      .run('section-1', 'project-1', 'Planning', now, now);
    sqlite.prepare(`UPDATE tasks SET section_id = ? WHERE id = ?`).run('section-1', 'task-1');

    sqlite.prepare(`DELETE FROM project_sections WHERE id = ?`).run('section-1');

    const task = sqlite.prepare(`SELECT section_id FROM tasks WHERE id = ?`).get('task-1') as {
      section_id: string | null;
    };
    assert.equal(task.section_id, null);
    const remaining = sqlite.prepare(`SELECT COUNT(*) AS count FROM tasks`).get() as {
      count: number;
    };
    assert.equal(remaining.count, 1);
    sqlite.close();
  } finally {
    rmSync(dbFile, { force: true });
  }
});
