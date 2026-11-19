import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { users } from '../db/schema.js';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-write-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const taskWriteService = await import('./task-write-service.js');
  const taskQueryService = await import('./task-query-service.js');

  return {
    db,
    sqlite,
    taskWriteService,
    taskQueryService,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('Task Write Service Workflows', async (t) => {
  const ctx = await setupTestDb();
  const ownerId = randomUUID();

  try {
    await ctx.db.insert(users).values({
      id: ownerId,
      name: 'Write Test User',
      email: `${ownerId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await t.test('createTaskForOwner creates task and returns task with labels', async () => {
      const created = await ctx.taskWriteService.createTaskForOwner(ownerId, {
        title: 'New Write Task',
        priority: 'high',
        dueDate: '2026-11-25',
      });

      assert.ok(created);
      assert.equal(created.title, 'New Write Task');
      assert.equal(created.priority, 'high');
      assert.equal(created.dueDate, '2026-11-25');
      assert.equal(created.completed, false);
      assert.deepEqual(created.labels, []);
    });

    await t.test(
      'updateTaskForOwner updates task and materializes recurrence on completion',
      async () => {
        const created = await ctx.taskWriteService.createTaskForOwner(ownerId, {
          title: 'Recurring Template',
          dueDate: '2026-11-19T09:00:00Z',
          recurrenceRule: {
            frequency: 'daily',
            interval: 1,
          },
        });
        assert.ok(created);

        const updated = await ctx.taskWriteService.updateTaskForOwner(ownerId, created.id, {
          completed: true,
        });

        assert.ok(updated);
        assert.equal(updated.completed, true);
        assert.equal(updated.status, 'done');

        // Verify the next instance was materialized
        const activeList = await ctx.taskQueryService.listTasksForOwner(ownerId, 1, 10);
        const nextInstance = activeList.data.find(
          (task) =>
            task.baseTaskId === created.id ||
            (task.id !== created.id && task.title === 'Recurring Template'),
        );

        assert.ok(nextInstance, 'Expected next recurring task instance to be created');
        assert.equal(nextInstance.completed, false);
        assert.equal(nextInstance.title, 'Recurring Template');
      },
    );

    await t.test('updateTasksForOwner applies batch update atomically', async () => {
      const taskA = await ctx.taskWriteService.createTaskForOwner(ownerId, {
        title: 'Batch Task A',
        priority: 'low',
      });
      const taskB = await ctx.taskWriteService.createTaskForOwner(ownerId, {
        title: 'Batch Task B',
        priority: 'low',
      });
      assert.ok(taskA);
      assert.ok(taskB);

      const result = ctx.taskWriteService.updateTasksForOwner(
        ownerId,
        [taskA.id, taskB.id, 'missing-id'],
        { priority: 'high' },
      );

      assert.equal(result.updated, 2);
      assert.deepEqual(result.missing, ['missing-id']);

      const updatedA = await ctx.taskQueryService.getTaskForOwner(taskA.id, ownerId);
      const updatedB = await ctx.taskQueryService.getTaskForOwner(taskB.id, ownerId);
      assert.equal(updatedA?.priority, 'high');
      assert.equal(updatedB?.priority, 'high');
    });
  } finally {
    ctx.cleanup();
  }
});
