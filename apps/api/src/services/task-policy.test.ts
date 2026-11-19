import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { users } from '../db/schema.js';
import {
  getArchiveAutoDeleteForOwner,
  normalizeCreatePayload,
  normalizeStatusOnCompletion,
} from './task-policy.js';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-policy-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');

  return {
    db,
    sqlite,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('task-policy: normalizeCreatePayload trims title and sets defaults', () => {
  const result = normalizeCreatePayload({
    title: '  Trimmed Task  ',
  });

  assert.equal(result.title, 'Trimmed Task');
  assert.equal(result.status, 'inbox');
  assert.equal(result.priority, 'medium');
  assert.equal(result.dueDate, undefined);
  assert.equal(result.dueTime, undefined);
});

test('task-policy: normalizeCreatePayload clears dueDate and dueTime in simpleMode', () => {
  const result = normalizeCreatePayload({
    title: 'Simple Mode Task',
    simpleMode: true,
    dueDate: '2026-11-20',
    dueTime: '15:00',
  });

  assert.equal(result.dueDate, undefined);
  assert.equal(result.dueTime, undefined);
});

test('task-policy: normalizeStatusOnCompletion transitions correctly', () => {
  // 1. Completed always becomes done
  assert.equal(normalizeStatusOnCompletion('inbox', true), 'done');

  // 2. Uncompleting an undated task returns to inbox
  assert.equal(normalizeStatusOnCompletion('done', false, null), 'inbox');

  // 3. Uncompleting a dated task returns to upcoming or today based on tz
  const futureDate = '2099-01-01';
  assert.equal(normalizeStatusOnCompletion('done', false, futureDate, 'UTC'), 'upcoming');

  // 4. Non-done incomplete tasks preserve current status
  assert.equal(normalizeStatusOnCompletion('today', false), 'today');
});

test('task-policy: getArchiveAutoDeleteForOwner reads user setting with and without tx', async () => {
  const ctx = await setupTestDb();
  const ownerId = randomUUID();

  try {
    await ctx.db.insert(users).values({
      id: ownerId,
      name: 'Policy User',
      email: `${ownerId}@example.com`,
      emailVerified: true,
      archiveAutoDelete: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Without tx
    const directSetting = getArchiveAutoDeleteForOwner(ownerId);
    assert.equal(directSetting, false);

    // Inside tx
    ctx.db.transaction((tx) => {
      const txSetting = getArchiveAutoDeleteForOwner(ownerId, tx);
      assert.equal(txSetting, false);
    });

    // Default for missing user is true
    const defaultSetting = getArchiveAutoDeleteForOwner('non-existent');
    assert.equal(defaultSetting, true);
  } finally {
    ctx.cleanup();
  }
});
