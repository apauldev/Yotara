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

      // Self-parenting on update must be rejected
      const selfParentTask = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Self-parent task',
      });
      assert.ok(selfParentTask);
      await assert.rejects(
        () =>
          ctx.taskService.updateTaskForOwner(ownerId, selfParentTask.id, {
            parentId: selfParentTask.id,
          }),
        /A task cannot be its own parent/,
      );
      const selfFetched = await ctx.taskService.getTaskForOwner(selfParentTask.id, ownerId);
      assert.ok(selfFetched);
      assert.equal(selfFetched.parentId, null);
    });

    await t.test('Update self-parenting is rejected and does not persist', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Self-parent isolated',
      });
      assert.ok(task);
      await assert.rejects(
        () =>
          ctx.taskService.updateTaskForOwner(ownerId, task.id, {
            parentId: task.id,
          }),
        /A task cannot be its own parent/,
      );
      const fetched = await ctx.taskService.getTaskForOwner(task.id, ownerId);
      assert.ok(fetched);
      assert.equal(fetched.parentId, null);
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
        dueTime: '15:00',
        recurrenceRule: { frequency: 'weekly', interval: 1 },
      });

      assert.ok(weeklyTask);
      await ctx.taskService.updateTaskForOwner(ownerId, weeklyTask.id, { completed: true });

      // Check if new instance exists
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const nextWeekly = allTasks.data.find((t) => t.title === 'Weekly Task' && !t.completed);
      assert.ok(nextWeekly);
      assert.equal(nextWeekly.dueDate, '2026-05-08T00:00:00Z');
      assert.equal(nextWeekly.dueTime, '15:00');

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

    await t.test('Complete + recurrenceRule: null does NOT materialize new instance', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'End Recurring Task',
        dueDate: '2026-06-01T00:00:00Z',
        recurrenceRule: { frequency: 'daily', interval: 1 },
      });
      assert.ok(task);

      // Complete AND clear the recurrence rule
      await ctx.taskService.updateTaskForOwner(ownerId, task.id, {
        completed: true,
        recurrenceRule: null,
      });

      // Verify no new instance was created
      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const next = allTasks.data.find((t) => t.title === 'End Recurring Task' && !t.completed);
      assert.equal(
        next,
        undefined,
        'Should not create instance when recurrenceRule is explicitly cleared',
      );

      // Verify the original task is completed and has no recurrence rule
      const updated = await ctx.taskService.getTaskForOwner(task.id, ownerId);
      assert.ok(updated?.completed);
      assert.equal(updated?.recurrenceRule, null);
    });

    await t.test('Restoring a completed future-dated task returns it to upcoming', async () => {
      const futureTask = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Future dated task',
        dueDate: '2099-01-15T00:00:00Z',
        status: 'upcoming',
      });

      assert.ok(futureTask);
      await ctx.taskService.updateTaskForOwner(ownerId, futureTask.id, { completed: true });

      const restored = await ctx.taskService.updateTaskForOwner(ownerId, futureTask.id, {
        completed: false,
      });

      assert.ok(restored);
      assert.equal(restored.completed, false);
      assert.equal(restored.status, 'upcoming');
    });

    await t.test('Restoring a task with explicit timezone uses tz-aware date', async () => {
      const futureTask = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'TZ-aware task',
        dueDate: '2099-01-15T00:00:00Z',
        status: 'upcoming',
      });
      assert.ok(futureTask);
      await ctx.taskService.updateTaskForOwner(ownerId, futureTask.id, { completed: true });

      const restored = await ctx.taskService.updateTaskForOwner(
        ownerId,
        futureTask.id,
        { completed: false },
        undefined,
        'America/New_York',
      );

      assert.ok(restored);
      assert.equal(restored.completed, false);
      assert.equal(restored.status, 'upcoming');
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

    // Seed a label for transaction rollback tests
    const { labels: _labels } = await import('../db/schema.js');
    const rollbackLabelId = randomUUID();
    const now = new Date().toISOString();
    await ctx.db.insert(_labels).values({
      id: rollbackLabelId,
      userId: ownerId,
      name: 'Rollback Test Label',
      color: '#999999',
      createdAt: now,
      updatedAt: now,
    });

    await t.test('Drizzle transaction rolls back on throw', async () => {
      const { eq } = await import('drizzle-orm');
      const { tasks } = await import('../db/schema.js');
      const testTaskId = randomUUID();

      assert.throws(() => {
        ctx.db.transaction(
          (tx) => {
            tx.insert(tasks)
              .values({
                id: testTaskId,
                userId: ownerId,
                title: 'should not exist',
                status: 'inbox',
                priority: 'medium',
                simpleMode: false,
                completed: false,
                archivedAt: null,
                permanentArchive: false,
                order: 0,
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
              })
              .run();
            throw new Error('forced rollback');
          },
          { behavior: 'immediate' },
        );
      }, /forced rollback/);

      const [row] = await ctx.db.select().from(tasks).where(eq(tasks.id, testTaskId)).limit(1);
      assert.equal(row, undefined);
    });

    await t.test('concurrent task creates do not conflict on transaction start', async () => {
      const [first, second] = await Promise.all([
        ctx.taskService.createTaskForOwner(ownerId, { title: `Concurrent A ${randomUUID()}` }),
        ctx.taskService.createTaskForOwner(ownerId, { title: `Concurrent B ${randomUUID()}` }),
      ]);

      assert.ok(first);
      assert.ok(second);
      assert.notEqual(first.id, second.id);
    });

    await t.test('createTaskForOwner rolls back when label sync fails', async () => {
      const { eq } = await import('drizzle-orm');
      const { tasks } = await import('../db/schema.js');

      ctx.sqlite.exec(`
        CREATE TRIGGER fail_create_label_sync
        BEFORE INSERT ON task_labels
        WHEN EXISTS (
          SELECT 1 FROM tasks
          WHERE id = NEW.task_id AND title LIKE '%ROLLBACK_MARKER%'
        )
        BEGIN
          SELECT RAISE(ABORT, 'forced rollback test');
        END;
      `);

      const title = `Should Not Exist ROLLBACK_MARKER ${randomUUID()}`;
      try {
        await ctx.taskService.createTaskForOwner(ownerId, {
          title,
          labels: [rollbackLabelId],
        });
        assert.fail('Expected createTaskForOwner to throw');
      } catch (err: any) {
        assert.match(err.message, /forced rollback/);
      } finally {
        ctx.sqlite.exec('DROP TRIGGER IF EXISTS fail_create_label_sync');
      }

      const rows = await ctx.db.select().from(tasks).where(eq(tasks.userId, ownerId));
      const leakedTask = rows.find((r: any) => r.title === title);
      assert.equal(leakedTask, undefined);
    });

    await t.test('updateTaskForOwner recurrence materialization rolls back as a unit', async () => {
      const recurring = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Recurring Rollback Test',
        dueDate: '2026-01-01T00:00:00Z',
        recurrenceRule: { frequency: 'daily', interval: 1 },
      });
      assert.ok(recurring);
      assert.equal(recurring.completed, false);

      const originalUpdateTime = recurring.updatedAt;

      ctx.sqlite.exec(`
          CREATE TRIGGER fail_recurrence_label_sync
          BEFORE INSERT ON task_labels
          WHEN NEW.task_id = '${recurring.id}'
          BEGIN
            SELECT RAISE(ABORT, 'forced rollback recurrence test');
          END;
        `);

      try {
        await ctx.taskService.updateTaskForOwner(ownerId, recurring.id, {
          completed: true,
          labels: [rollbackLabelId],
        });
        assert.fail('Expected updateTaskForOwner to throw');
      } catch (err: any) {
        assert.match(err.message, /forced rollback/);
      } finally {
        ctx.sqlite.exec('DROP TRIGGER IF EXISTS fail_recurrence_label_sync');
      }

      const parentAfter = await ctx.taskService.getTaskForOwner(recurring.id, ownerId);
      assert.ok(parentAfter);
      assert.equal(parentAfter.completed, false);
      assert.equal(parentAfter.updatedAt, originalUpdateTime);

      const allTasks = await ctx.taskService.listTasksForOwner(ownerId, 1, 50, true);
      const instances = allTasks.data.filter(
        (t) => t.title === 'Recurring Rollback Test' && !t.completed,
      );
      assert.equal(
        instances.length,
        1,
        'Expected only original task, no materialized instance leaked',
      );
      assert.equal(instances[0].id, recurring.id);
    });

    await t.test('deleteTaskForOwner returns null for non-existent task', async () => {
      const result = await ctx.taskService.deleteTaskForOwner(ownerId, randomUUID());
      assert.equal(result, null);
    });

    await t.test('updateTaskForOwner falls back to default project', async () => {
      // Create task without specifying a project — createTaskForOwner assigns the default (Inbox)
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'No Project Task',
      });
      assert.ok(task);
      const originalProjectId = task.projectId;
      assert.ok(originalProjectId);

      // Update without specifying projectId — should keep the default project
      const updated = await ctx.taskService.updateTaskForOwner(ownerId, task.id, {
        title: 'No Project Task Updated',
      });
      assert.ok(updated);
      assert.ok(updated.projectId);
    });

    await t.test('updateTaskForOwner sets recurrence rule on existing task', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Becomes Recurring Later',
        dueDate: '2026-06-01T00:00:00Z',
      });
      assert.ok(task);
      assert.equal(task.recurrenceRule, null);

      // Add a recurrence rule via update
      const updated = await ctx.taskService.updateTaskForOwner(ownerId, task.id, {
        recurrenceRule: { frequency: 'weekly', interval: 2 },
      });
      assert.ok(updated);
      assert.ok(updated.recurrenceRule);
      // DB stores recurrenceRule as a JSON string
      const parsed = JSON.parse(updated.recurrenceRule as string);
      assert.equal(parsed.frequency, 'weekly');
      assert.equal(parsed.interval, 2);
    });

    await t.test('updateTaskForOwner creates subtasks from body', async () => {
      const task = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Parent With Subtask Update',
      });
      assert.ok(task);

      // Update with subtasks in the body
      const updated = await ctx.taskService.updateTaskForOwner(ownerId, task.id, {
        subtasks: [{ title: 'Update Sub 1' }, { title: 'Update Sub 2' }],
      });
      assert.ok(updated);

      // Verify subtasks exist
      const subtasks = await ctx.taskService.listSubtasks(task.id, ownerId);
      assert.equal(subtasks.length, 2);
      const titles = subtasks.map((s) => s.title).sort();
      assert.deepEqual(titles, ['Update Sub 1', 'Update Sub 2']);
    });

    await t.test('createTaskForOwner creates subtasks from body', async () => {
      const parent = await ctx.taskService.createTaskForOwner(ownerId, {
        title: 'Parent With Bulk Subtasks',
        subtasks: [{ title: 'Bulk Sub A' }, { title: 'Bulk Sub B' }],
      });
      assert.ok(parent);

      const subtasks = await ctx.taskService.listSubtasks(parent.id, ownerId);
      assert.equal(subtasks.length, 2);
      const titles = subtasks.map((s) => s.title).sort();
      assert.deepEqual(titles, ['Bulk Sub A', 'Bulk Sub B']);
    });

    await t.test('updateTaskForOwner returns null for non-existent task', async () => {
      const result = await ctx.taskService.updateTaskForOwner(ownerId, randomUUID(), {
        title: 'ghost',
      });
      assert.equal(result, null);
    });
  } finally {
    ctx.cleanup();
  }
});

/**
 * Reminder tests below drive the scan with an injected clock while the update
 * path runs on the real one, so the fixtures are anchored to the real UTC day
 * rather than a hardcoded date that would only line up on the day it was
 * written.
 */
async function setupReminderTestDb() {
  const { createDbClient } = await import('../db/client.js');
  const { users } = await import('../db/schema.js');
  const { DateTime } = await import('luxon');
  const { todayInTimezone } = await import('../lib/timezone.js');

  const { db, sqlite } = createDbClient(':memory:');
  const ownerId = randomUUID();
  await db.insert(users).values({
    id: ownerId,
    name: 'Test User',
    email: `${ownerId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const today = todayInTimezone('UTC');
  const yesterday = DateTime.fromISO(today).minus({ days: 1 }).toISODate() as string;
  /** An instant on the given UTC day, for scans that take an injected clock. */
  const at = (day: string, hour: number) =>
    DateTime.fromISO(`${day}T${String(hour).padStart(2, '0')}:00:00`, { zone: 'UTC' });

  return { db, sqlite, ownerId, today, yesterday, at };
}

test('adding a due time to a date-only task retires its due_today reminder', async () => {
  const { scanDueNotifications, getNotificationsForOwner } =
    await import('./notification-service.js');
  const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
  const { db, sqlite, ownerId, today, at } = await setupReminderTestDb();

  try {
    const tz = 'UTC';
    const task = await createTaskForOwner(ownerId, { title: 'Call Sam' }, tz, db);
    assert.ok(task);
    // Set directly so the scenario does not depend on how the create path scans.
    sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run(today, task.id);

    // Morning: the date-only task earns its due_today reminder.
    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 9)), 1);

    // Midday: the user adds an exact time. The instant has not passed yet.
    await updateTaskForOwner(ownerId, task.id, { dueTime: '15:00' }, null, tz, db);
    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 12)), 0);

    // The instant passes: the exact-time reminder is the only one owed.
    scanDueNotifications(ownerId, tz, db, at(today, 20));

    const rows = getNotificationsForOwner(ownerId, 50, db);
    assert.equal(rows.length, 1, 'the date-only reminder is retired, not duplicated');
    assert.equal(rows[0].type, 'due_time');
    assert.equal(rows[0].read, false);
  } finally {
    sqlite.close();
  }
});

test('removing a due time retires the exact-time reminder and restores the date-only one', async () => {
  const { scanDueNotifications, getNotificationsForOwner } =
    await import('./notification-service.js');
  const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
  const { db, sqlite, ownerId, today, at } = await setupReminderTestDb();

  try {
    const tz = 'UTC';
    const task = await createTaskForOwner(ownerId, { title: 'Call Sam' }, tz, db);
    assert.ok(task);
    sqlite
      .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
      .run(today, '15:00', task.id);

    // The exact instant passes, so the timed reminder is issued.
    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 20)), 1);
    assert.equal(getNotificationsForOwner(ownerId, 50, db)[0].type, 'due_time');

    // The user drops the time. The task is date-only again, so the stale
    // exact-time reminder goes and the date-only one takes over.
    await updateTaskForOwner(ownerId, task.id, { dueTime: null }, null, tz, db);

    const rows = getNotificationsForOwner(ownerId, 50, db);
    assert.equal(rows.length, 1, 'the exact-time reminder is retired, not kept alongside');
    assert.equal(rows[0].type, 'due_today');
    assert.equal(rows[0].read, false);
  } finally {
    sqlite.close();
  }
});

test('clearing the whole schedule retires the reminder it earned today', async () => {
  const { scanDueNotifications, getNotificationsForOwner } =
    await import('./notification-service.js');
  const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
  const { db, sqlite, ownerId, today, at } = await setupReminderTestDb();

  try {
    const tz = 'UTC';
    const task = await createTaskForOwner(ownerId, { title: 'Call Sam' }, tz, db);
    assert.ok(task);
    sqlite
      .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
      .run(today, '15:00', task.id);

    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 20)), 1);
    assert.equal(getNotificationsForOwner(ownerId, 50, db)[0].type, 'due_time');

    // Clearing both fields is not a timing change on an unchanged date, so the
    // retirement has to recognise the cleared schedule itself. Otherwise the
    // scheduler would still announce this reminder on its next load.
    await updateTaskForOwner(ownerId, task.id, { dueDate: null, dueTime: null }, null, tz, db);

    assert.equal(getNotificationsForOwner(ownerId, 50, db).length, 0);
  } finally {
    sqlite.close();
  }
});

test('moving a task to another date while timing it keeps the other day\u2019s reminder', async () => {
  const { scanDueNotifications, getNotificationsForOwner } =
    await import('./notification-service.js');
  const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
  const { db, sqlite, ownerId, today, yesterday, at } = await setupReminderTestDb();

  try {
    const tz = 'UTC';
    const task = await createTaskForOwner(ownerId, { title: 'Call Sam' }, tz, db);
    assert.ok(task);
    sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run(yesterday, task.id);

    // A reminder earned yesterday belongs to that day, not to today.
    assert.equal(scanDueNotifications(ownerId, tz, db, at(yesterday, 20)), 1);

    // Now the task gets both a new date and a time: only the new day's state
    // is at stake, so the earlier day's reminder must survive.
    await updateTaskForOwner(ownerId, task.id, { dueDate: today, dueTime: '15:00' }, null, tz, db);

    const rows = getNotificationsForOwner(ownerId, 50, db);
    assert.ok(
      rows.some((row) => row.type === 'due_today'),
      'the earlier day\u2019s date-only reminder is untouched',
    );
  } finally {
    sqlite.close();
  }
});

test('a zone-less reschedule still lets the reminder for the new time through', async () => {
  const { scanDueNotifications, getNotificationsForOwner } =
    await import('./notification-service.js');
  const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
  const { db, sqlite, ownerId, today, at } = await setupReminderTestDb();

  try {
    const tz = 'UTC';
    const task = await createTaskForOwner(ownerId, { title: 'Call Sam' }, tz, db);
    assert.ok(task);
    sqlite
      .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
      .run(today, '08:00', task.id);

    // The 08:00 instant passes and earns its exact-time reminder.
    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 9)), 1);
    const original = getNotificationsForOwner(ownerId, 50, db)[0];
    assert.equal(original.type, 'due_time');

    // A client that sends no timezone moves the task to 15:00. Nothing about
    // that response is allowed to depend on the zone being echoed back.
    await updateTaskForOwner(ownerId, task.id, { dueTime: '15:00' }, null, undefined, db);

    // The next timezone-aware scan owes a reminder for the new instant.
    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 16)), 1);

    const rows = getNotificationsForOwner(ownerId, 50, db);
    assert.equal(rows.length, 1, 'the superseded reminder is replaced, not duplicated');
    assert.notEqual(
      rows[0].id,
      original.id,
      'the surviving row is a fresh reminder rather than the superseded one',
    );
    assert.equal(rows[0].type, 'due_time');
  } finally {
    sqlite.close();
  }
});

test('a zone-less edit that leaves the timing alone retires nothing', async () => {
  const { scanDueNotifications, getNotificationsForOwner } =
    await import('./notification-service.js');
  const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
  const { db, sqlite, ownerId, today, at } = await setupReminderTestDb();

  try {
    const tz = 'UTC';
    const task = await createTaskForOwner(ownerId, { title: 'Call Sam' }, tz, db);
    assert.ok(task);
    sqlite
      .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
      .run(today, '08:00', task.id);

    assert.equal(scanDueNotifications(ownerId, tz, db, at(today, 9)), 1);
    const earned = getNotificationsForOwner(ownerId, 50, db)[0];

    // Retiring a widened window must not leak through the gate on schedule
    // changes: renaming the task leaves the timing it was reminded for intact.
    await updateTaskForOwner(
      ownerId,
      task.id,
      { title: 'Call Sam about tax' },
      null,
      undefined,
      db,
    );

    const rows = getNotificationsForOwner(ownerId, 50, db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, earned.id, 'the earned reminder is still the one on file');
  } finally {
    sqlite.close();
  }
});
