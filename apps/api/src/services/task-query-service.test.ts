import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { tasks, users, labels, taskLabels } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-query-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const taskQueryService = await import('./task-query-service.js');

  return {
    db,
    sqlite,
    taskQueryService,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('Task Query Service Logic', async (t) => {
  const ctx = await setupTestDb();
  const now = nowIsoTimestamp();

  try {
    await t.test(
      'getTaskForOwnerSync and getTaskForOwner work with caller transaction handle',
      async () => {
        const ownerId = randomUUID();
        await ctx.db.insert(users).values({
          id: ownerId,
          name: 'Query Test User 1',
          email: `${ownerId}@example.com`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const taskId = randomUUID();
        const labelId = randomUUID();

        await ctx.db.insert(labels).values({
          id: labelId,
          userId: ownerId,
          name: 'Urgent',
          nameNorm: 'urgent',
          color: '#e11d48',
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert(tasks).values({
          id: taskId,
          userId: ownerId,
          title: 'Query Target Task',
          status: 'inbox',
          priority: 'high',
          completed: false,
          simpleMode: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert(taskLabels).values({
          taskId,
          labelId,
        });

        // 1. Direct query without transaction
        const directResult = ctx.taskQueryService.getTaskForOwnerSync(taskId, ownerId);
        assert.ok(directResult);
        assert.equal(directResult.id, taskId);
        assert.equal(directResult.title, 'Query Target Task');
        assert.deepEqual(directResult.labels, [labelId]);

        // 2. Query inside an open transaction
        ctx.db.transaction((tx) => {
          const txResult = ctx.taskQueryService.getTaskForOwnerSync(taskId, ownerId, tx);
          assert.ok(txResult);
          assert.equal(txResult.id, taskId);
          assert.deepEqual(txResult.labels, [labelId]);
        });

        // 3. Async getTaskForOwner wrapper
        const asyncResult = await ctx.taskQueryService.getTaskForOwner(taskId, ownerId);
        assert.ok(asyncResult);
        assert.equal(asyncResult.id, taskId);

        // 4. Returns null for different owner
        const wrongOwnerResult = ctx.taskQueryService.getTaskForOwnerSync(taskId, 'other-owner');
        assert.equal(wrongOwnerResult, null);
      },
    );

    await t.test('listTasksForOwner handles pagination, filtering and subtasks', async () => {
      const ownerId = randomUUID();
      await ctx.db.insert(users).values({
        id: ownerId,
        name: 'List Query User 2',
        email: `${ownerId}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const parentId = randomUUID();
      const subtaskId = randomUUID();
      const inboxId = randomUUID();

      await ctx.db.insert(tasks).values([
        {
          id: parentId,
          userId: ownerId,
          title: 'Parent Task',
          status: 'today',
          priority: 'high',
          completed: false,
          dueDate: '2026-11-19',
          simpleMode: false,
          order: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subtaskId,
          userId: ownerId,
          parentId,
          title: 'Child Subtask',
          status: 'today',
          priority: 'medium',
          completed: false,
          simpleMode: false,
          order: 2,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: inboxId,
          userId: ownerId,
          title: 'Inbox Task',
          status: 'inbox',
          priority: 'low',
          completed: false,
          simpleMode: false,
          order: 3,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      // Top-level listing (includeSubtasks = false) excludes subtasks
      const topLevel = await ctx.taskQueryService.listTasksForOwner(ownerId, 1, 10, false);
      assert.equal(topLevel.meta.total, 2);
      const topIds = topLevel.data.map((item) => item.id);
      assert.ok(topIds.includes(parentId));
      assert.ok(topIds.includes(inboxId));
      assert.ok(!topIds.includes(subtaskId));

      // Subtask listing for parent
      const subtasks = await ctx.taskQueryService.listSubtasks(parentId, ownerId);
      assert.equal(subtasks.length, 1);
      assert.equal(subtasks[0].id, subtaskId);
      assert.equal(subtasks[0].parentId, parentId);

      // Filter by view = 'inbox'
      const inboxView = await ctx.taskQueryService.listTasksForOwner(
        ownerId,
        1,
        10,
        false,
        undefined,
        {
          view: 'inbox',
        },
      );
      assert.equal(inboxView.meta.total, 1);
      assert.equal(inboxView.data[0].id, inboxId);
    });
  } finally {
    ctx.cleanup();
  }
});
