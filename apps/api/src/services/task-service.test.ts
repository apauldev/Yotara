import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-service-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const taskService = await import('./task-service.js');
  const projectService = await import('./project-service.js');

  return {
    db,
    sqlite,
    taskService,
    projectService,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('Subtasks and Recurring Tasks Service Logic', async (t) => {
  const ctx = await setupTestDb();
  const ownerId = randomUUID();

  try {
    // Create a user in the DB for FK constraints
    const { users } = await import('../db/schema.js');
    await ctx.db.insert(users).values({
      id: ownerId,
      name: 'Test User',
      email: `${ownerId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await t.test('Subtask inheritance and validation', async () => {
      // 1. Create a parent project and task
      const project = await ctx.projectService.createProjectForOwner(ownerId, {
        name: 'Parent Project',
      });
      assert.ok(project);
      const parent = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Parent Task',
        projectId: project.id,
      });
      assert.ok(parent);

      // 2. Create subtask - should inherit projectId
      const subtask = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Subtask',
        parentId: parent.id,
      });
      assert.ok(subtask);
      assert.equal(subtask.parentId, parent.id);
      assert.equal(subtask.projectId, project.id);

      // 3. Non-existent parent validation
      await assert.rejects(
        () =>
          ctx.taskService.createTaskForOwner(ownerId, {
            title: 'Ghost parent',
            parentId: randomUUID(),
          }),
        /Parent task not found/,
      );
    });

    await t.test('List filtering and subtask counts', async () => {
      const parent = await ctx.taskService.createTaskForOwner(ownerId, { title: 'Parent 2' });
      await ctx.taskService.createTaskForOwner(ownerId, { title: 'Sub 1', parentId: parent!.id });
      const sub2 = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Sub 2',
        parentId: parent!.id,
      });
      // Complete Sub 2 properly via updateTaskForOwner
      await ctx.taskService.updateTaskForOwner(ownerId, sub2!.id, { completed: true });

      // 1. Default list excludes subtasks
      const list = await ctx.taskService.listTasksForOwner(ownerId, 1, 50);
      const subtaskTitles = list.data.map((t) => t.title);
      assert.ok(!subtaskTitles.includes('Sub 1'));
      assert.ok(!subtaskTitles.includes('Sub 2'));

      // 2. includeSubtasks=true includes them
      const fullList = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const allTitles = fullList.data.map((t) => t.title);
      assert.ok(allTitles.includes('Sub 1'));
      assert.ok(allTitles.includes('Sub 2'));

      // 3. listSubtasks helper
      const subtasks = await ctx.taskService.listSubtasks(parent!.id, ownerId);
      assert.equal(subtasks.length, 2);
      assert.equal(subtasks.filter((s) => s.completed).length, 1);
    });

    await t.test('Recurrence materialization', async () => {
      // 1. Weekly recurrence - anchor from original due date
      const weeklyDueDate = '2026-05-01T00:00:00Z';
      const weeklyTask = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Weekly Task',
        dueDate: weeklyDueDate,
        recurrenceRule: { frequency: 'weekly', interval: 1 },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, weeklyTask!.id, { completed: true });

      // Check if new instance exists
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const nextWeekly = allTasks.data.find((t) => t.title === 'Weekly Task' && !t.completed);
      assert.ok(nextWeekly);
      assert.equal(nextWeekly.dueDate, '2026-05-08T00:00:00Z');

      // 2. Daily recurrence - anchor from NOW
      const dailyTask = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Daily Task',
        dueDate: '2020-01-01T00:00:00Z', // Way in the past
        recurrenceRule: { frequency: 'daily', interval: 1 },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, dailyTask!.id, { completed: true });

      const nextDaily = (await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true)).data.find(
        (t) => t.title === 'Daily Task' && !t.completed,
      );
      assert.ok(nextDaily);

      // Should be today + 1 day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedPrefix = tomorrow.toISOString().split('T')[0];
      assert.ok(nextDaily.dueDate?.startsWith(expectedPrefix));
    });

    await t.test('Weekdays recurrence skips weekends', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Weekday Task',
        recurrenceRule: { frequency: 'weekdays', interval: 1 },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, task!.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Weekday Task' && !t.completed);
      assert.ok(next);

      // Due date must be a weekday (Mon=1 .. Fri=5)
      const day = new Date(next.dueDate!).getUTCDay();
      assert.ok(day >= 1 && day <= 5, `Expected weekday, got ${day}`);
    });

    await t.test('Weekly with custom daysOfWeek', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Mon Wed Fri Task',
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
        },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, task!.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Mon Wed Fri Task' && !t.completed);
      assert.ok(next);

      // Due date must be Mon(1), Wed(3), or Fri(5)
      const day = new Date(next.dueDate!).getUTCDay();
      assert.ok(day === 1 || day === 3 || day === 5, `Expected Mon/Wed/Fri, got ${day}`);
    });

    await t.test('endDate stops recurrence when past', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const endDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Ended Task',
        recurrenceRule: {
          frequency: 'daily',
          interval: 1,
          endDate,
        },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, task!.id, { completed: true });

      // No new instance should exist — past the end date
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Ended Task' && !t.completed);
      assert.equal(next, undefined, 'Should not create instance past endDate');
    });

    await t.test('endDate in future still creates instances', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const endDate = nextWeek.toISOString().split('T')[0];

      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Future Ended Task',
        recurrenceRule: {
          frequency: 'daily',
          interval: 1,
          endDate,
        },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, task!.id, { completed: true });

      // Instance should exist — still within endDate window
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Future Ended Task' && !t.completed);
      assert.ok(next);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedPrefix = tomorrow.toISOString().split('T')[0];
      assert.ok(next.dueDate?.startsWith(expectedPrefix));
    });

    await t.test('Cascade deletion', async () => {
      const parent = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Parent to delete',
      });
      const sub = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Sub to die',
        parentId: parent!.id,
      });

      // Delete parent
      await ctx.taskService.deleteTaskForOwner(ownerId, parent!.id);

      // Verify both are gone
      const subCheck = await ctx.taskService.getTaskForOwner(sub!.id, ownerId);
      assert.equal(subCheck, null);

      // Recurring instance cascade
      const template = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Template',
        recurrenceRule: { frequency: 'daily', interval: 1 },
      });
      await ctx.taskService.updateTaskForOwner(ownerId, template!.id, { completed: true });

      const instance = (await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true)).data.find(
        (t) => t.title === 'Template' && !t.completed,
      );
      assert.ok(instance);

      // Delete template
      await ctx.taskService.deleteTaskForOwner(ownerId, template!.id);

      // Instance should be gone too
      const instanceCheck = await ctx.taskService.getTaskForOwner(instance.id, ownerId);
      assert.equal(instanceCheck, null);
    });

    await t.test('Weekdays + endDate combined', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const endDate = yesterday.toISOString().split('T')[0];

      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Weekday Ended Task',
        recurrenceRule: {
          frequency: 'weekdays',
          interval: 1,
          endDate,
        },
      });

      await ctx.taskService.updateTaskForOwner(ownerId, task!.id, { completed: true });

      // No new instance — past end date
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Weekday Ended Task' && !t.completed);
      assert.equal(next, undefined, 'Weekday recurrence should respect endDate');
    });
  } finally {
    ctx.cleanup();
  }
});
