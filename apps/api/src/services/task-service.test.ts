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

      // 4. Nested subtask rejection
      await assert.rejects(
        () =>
          ctx.taskService.createTaskForOwner(ownerId, {
            title: 'Nested subtask',
            parentId: subtask.id,
          }),
        /Subtasks cannot have subtasks/,
      );

      // 5. Reparenting a task to a subtask should also be rejected
      const anotherParent = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Another parent',
      });
      assert.ok(anotherParent);
      await assert.rejects(
        () =>
          ctx.taskService.updateTaskForOwner(ownerId, anotherParent.id, {
            parentId: subtask.id,
          }),
        /Subtasks cannot have subtasks/,
      );
    });

    await t.test('List filtering and subtask counts', async () => {
      const parent = await ctx.taskService.createTaskForOwner(ownerId, { title: 'Parent 2' });
      assert.ok(parent);
      const parentId = parent.id;
      await ctx.taskService.createTaskForOwner(ownerId, { title: 'Sub 1', parentId });
      const sub2 = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Sub 2',
        parentId,
      });
      assert.ok(sub2);
      // Complete Sub 2 properly via updateTaskForOwner
      const sub2Id = sub2.id;
      await ctx.taskService.updateTaskForOwner(ownerId, sub2Id, { completed: true });

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
      const subtasks = await ctx.taskService.listSubtasks(parentId, ownerId);
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

      assert.ok(weeklyTask);
      await ctx.taskService.updateTaskForOwner(ownerId, weeklyTask.id, { completed: true });

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

      assert.ok(dailyTask);
      await ctx.taskService.updateTaskForOwner(ownerId, dailyTask.id, { completed: true });

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

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Weekday Task' && !t.completed);
      assert.ok(next);
      const dueDate = next.dueDate;
      assert.ok(dueDate);

      // Due date must be a weekday (Mon=1 .. Fri=5)
      const day = new Date(dueDate).getUTCDay();
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

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Mon Wed Fri Task' && !t.completed);
      assert.ok(next);
      const dueDate = next.dueDate;
      assert.ok(dueDate);

      // Due date must be Mon(1), Wed(3), or Fri(5)
      const day = new Date(dueDate).getUTCDay();
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

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

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

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

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
      assert.ok(parent);
      const parentId = parent.id;
      const sub = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Sub to die',
        parentId,
      });
      assert.ok(sub);

      // Delete parent
      await ctx.taskService.deleteTaskForOwner(ownerId, parentId);

      // Verify both are gone
      const subCheck = await ctx.taskService.getTaskForOwner(sub.id, ownerId);
      assert.equal(subCheck, null);

      // Recurring instance cascade
      const template = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Template',
        recurrenceRule: { frequency: 'daily', interval: 1 },
      });
      assert.ok(template);
      const templateId = template.id;
      await ctx.taskService.updateTaskForOwner(ownerId, templateId, { completed: true });

      const instance = (await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true)).data.find(
        (t) => t.title === 'Template' && !t.completed,
      );
      assert.ok(instance);

      // Delete template
      await ctx.taskService.deleteTaskForOwner(ownerId, templateId);

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

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      // No new instance — past end date
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Weekday Ended Task' && !t.completed);
      assert.equal(next, undefined, 'Weekday recurrence should respect endDate');
    });

    // ── Boundary / Leap Year Tests ─────────────────────────────────────────

    await t.test('Monthly overflow: Jan 31 → clamps to Feb last day', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Monthly Jan 31',
        dueDate: '2025-01-31T00:00:00Z',
        recurrenceRule: { frequency: 'monthly', interval: 1 },
      });

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Monthly Jan 31' && !t.completed);
      assert.ok(next);
      assert.equal(next.dueDate, '2025-02-28T00:00:00Z');

      // Complete the Feb 28 instance — should advance to Mar 28 (not jump to Mar 31)
      await ctx.taskService.updateTaskForOwner(ownerId, next.id, { completed: true });

      const allTasks2 = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const third = allTasks2.data.find((t) => t.title === 'Monthly Jan 31' && !t.completed);
      assert.ok(third);
      assert.equal(third.dueDate, '2025-03-28T00:00:00Z');
    });

    await t.test('Monthly overflow: Mar 31 → clamps to Apr 30', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Monthly Mar 31',
        dueDate: '2025-03-31T00:00:00Z',
        recurrenceRule: { frequency: 'monthly', interval: 1 },
      });

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Monthly Mar 31' && !t.completed);
      assert.ok(next);
      assert.equal(next.dueDate, '2025-04-30T00:00:00Z');
    });

    await t.test('Monthly: Dec 31 wraps to next year', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Monthly Dec 31',
        dueDate: '2025-12-31T00:00:00Z',
        recurrenceRule: { frequency: 'monthly', interval: 1 },
      });

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Monthly Dec 31' && !t.completed);
      assert.ok(next);
      assert.equal(next.dueDate, '2026-01-31T00:00:00Z');
    });

    await t.test('Yearly overflow: Feb 29 leap day → Feb 28 non-leap year', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Yearly Feb 29',
        dueDate: '2024-02-29T00:00:00Z',
        recurrenceRule: { frequency: 'yearly', interval: 1 },
      });

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Yearly Feb 29' && !t.completed);
      assert.ok(next);
      assert.equal(next.dueDate, '2025-02-28T00:00:00Z');
    });

    await t.test('Yearly: Dec 31 wraps to Dec 31 next year', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Yearly Dec 31',
        dueDate: '2025-12-31T00:00:00Z',
        recurrenceRule: { frequency: 'yearly', interval: 1 },
      });

      assert.ok(task);
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'Yearly Dec 31' && !t.completed);
      assert.ok(next);
      assert.equal(next.dueDate, '2026-12-31T00:00:00Z');
    });

    await t.test(
      'Daily: next occurrence is always tomorrow regardless of dueDate year',
      async () => {
        const task = await ctx.taskService.createTaskForOwner(ownerId, {
          title: 'Daily Anchored',
          dueDate: '2020-01-01T00:00:00Z', // Way in the past
          recurrenceRule: { frequency: 'daily', interval: 1 },
        });

        assert.ok(task);
        await ctx.taskService.updateTaskForOwner(ownerId, task.id, { completed: true });

        const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
        const next = allTasks.data.find((t) => t.title === 'Daily Anchored' && !t.completed);
        assert.ok(next);

        // Due date should be tomorrow (not the year 2020)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const expectedPrefix = tomorrow.toISOString().split('T')[0];
        assert.ok(next.dueDate?.startsWith(expectedPrefix));
      },
    );
  } finally {
    ctx.cleanup();
  }
});
