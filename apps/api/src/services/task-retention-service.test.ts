import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { projects, tasks, users } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-retention-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const taskRetentionService = await import('./task-retention-service.js');
  const taskQueryService = await import('./task-query-service.js');

  return {
    db,
    sqlite,
    taskRetentionService,
    taskQueryService,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('Task Retention Service Lifecycle', async (t) => {
  const ctx = await setupTestDb();
  const ownerId = randomUUID();
  const now = nowIsoTimestamp();

  try {
    await ctx.db.insert(users).values({
      id: ownerId,
      name: 'Retention Test User',
      email: `${ownerId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await t.test('deleteTaskForOwner cascades to subtasks and recurring instances', async () => {
      const parentTaskId = randomUUID();
      const subtaskId = randomUUID();
      const instanceTaskId = randomUUID();

      await ctx.db.insert(tasks).values([
        {
          id: parentTaskId,
          userId: ownerId,
          title: 'Parent Task',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          simpleMode: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: subtaskId,
          userId: ownerId,
          parentId: parentTaskId,
          title: 'Subtask',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          simpleMode: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: instanceTaskId,
          userId: ownerId,
          baseTaskId: parentTaskId,
          title: 'Recurring Instance',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          simpleMode: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const deleted = ctx.taskRetentionService.deleteTaskForOwner(ownerId, parentTaskId);
      assert.equal(deleted, true);

      // Verify all rows are gone
      const parentCheck = ctx.taskQueryService.getTaskForOwnerSync(parentTaskId, ownerId);
      const subtaskCheck = ctx.taskQueryService.getTaskForOwnerSync(subtaskId, ownerId);
      const instanceCheck = ctx.taskQueryService.getTaskForOwnerSync(instanceTaskId, ownerId);
      assert.equal(parentCheck, null);
      assert.equal(subtaskCheck, null);
      assert.equal(instanceCheck, null);
    });

    await t.test('clearCompletedTasksForOwner preserves permanentArchive tasks', async () => {
      const normalCompletedId = randomUUID();
      const permanentCompletedId = randomUUID();

      await ctx.db.insert(tasks).values([
        {
          id: normalCompletedId,
          userId: ownerId,
          title: 'Normal Completed',
          status: 'done',
          priority: 'medium',
          completed: true,
          permanentArchive: false,
          simpleMode: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: permanentCompletedId,
          userId: ownerId,
          title: 'Permanent Completed',
          status: 'done',
          priority: 'medium',
          completed: true,
          permanentArchive: true,
          simpleMode: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const clearedCount = ctx.taskRetentionService.clearCompletedTasksForOwner(ownerId);
      assert.equal(clearedCount, 1);

      const normalCheck = ctx.taskQueryService.getTaskForOwnerSync(normalCompletedId, ownerId);
      const permanentCheck = ctx.taskQueryService.getTaskForOwnerSync(
        permanentCompletedId,
        ownerId,
      );
      assert.equal(normalCheck, null);
      assert.ok(permanentCheck);
      assert.equal(permanentCheck.id, permanentCompletedId);
    });

    await t.test('restoreTaskForOwner un-retires deleted project and restores tasks', async () => {
      const projectId = randomUUID();
      const taskId = randomUUID();
      const deletedAt = new Date().toISOString();

      await ctx.db.insert(projects).values({
        id: projectId,
        ownerId,
        name: 'Restorable Project',
        retiredAt: deletedAt,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert(tasks).values({
        id: taskId,
        userId: ownerId,
        projectId,
        title: 'Project Task in Trash',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        simpleMode: false,
        deletedAt,
        order: 0,
        createdAt: now,
        updatedAt: now,
      });

      const restored = ctx.taskRetentionService.restoreTaskForOwner(ownerId, taskId);
      assert.equal(restored, true);

      // Verify task deletedAt is null
      const taskCheck = ctx.taskQueryService.getTaskForOwnerSync(taskId, ownerId);
      assert.ok(taskCheck);
      assert.equal(taskCheck.deletedAt, null);

      // Verify project retiredAt is null
      const [projectCheck] = ctx.db.select().from(projects).where(eq(projects.id, projectId)).all();
      assert.equal(projectCheck.retiredAt, null);
    });
  } finally {
    ctx.cleanup();
  }
});
