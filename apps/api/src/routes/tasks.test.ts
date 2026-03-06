import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

test('tasks routes create and list tasks', async () => {
  const dbFile = join(tmpdir(), `yotara-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret';

  const { sqlite } = await import('../db/client.js');

  // Initialize schema for tests
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL,
      image TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'inbox',
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
    );
  `);

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  try {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'Write first task',
        priority: 'high',
        status: 'today',
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();
    assert.equal(created.title, 'Write first task');
    assert.equal(created.completed, false);

    const listResponse = await app.inject({ method: 'GET', url: '/tasks' });
    assert.equal(listResponse.statusCode, 200);

    const tasks = listResponse.json();
    assert.equal(Array.isArray(tasks), true);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Write first task');
  } finally {
    await app.close();
    rmSync(dbFile, { force: true });
  }
});
