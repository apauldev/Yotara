import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';

async function setupTestDb() {
  const dbFile = join(tmpdir(), `yotara-label-service-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  const { db, sqlite } = await import('../db/client.js');
  const labelService = await import('./label-service.js');

  return {
    db,
    sqlite,
    labelService,
    cleanup() {
      sqlite.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
    },
  };
}

test('Label Service', async (t) => {
  const ctx = await setupTestDb();
  const ownerId = randomUUID();

  try {
    const { users } = await import('../db/schema.js');
    await ctx.db.insert(users).values({
      id: ownerId,
      name: 'Test User',
      email: `${ownerId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await t.test('lists labels for owner (includes defaults)', async () => {
      await ctx.labelService.seedDefaultLabelsForOwner(ownerId);
      const labels = await ctx.labelService.listLabelsForOwner(ownerId);

      // Should include the six default context labels
      assert.ok(labels.length >= 6);
      const names = labels.map((l) => l.name);
      assert.ok(names.includes('Urgent'));
      assert.ok(names.includes('Waiting'));
      assert.ok(names.includes('Planning'));
      assert.ok(names.includes('Errand'));
      assert.ok(names.includes('Review'));
      assert.ok(names.includes('Idea'));

      const icons = new Map(labels.map((label) => [label.name, label.icon]));
      assert.equal(icons.get('Urgent'), 'flame');
      assert.equal(icons.get('Waiting'), 'hourglass');
      assert.equal(icons.get('Planning'), 'calendar-days');
      assert.equal(icons.get('Errand'), 'basket-shopping');
      assert.equal(icons.get('Review'), 'check-double');
      assert.equal(icons.get('Idea'), 'lightbulb');

      const colors = new Map(labels.map((label) => [label.name, label.color]));
      assert.equal(colors.get('Urgent'), '#d44d3c');
      assert.equal(colors.get('Waiting'), '#f1c582');
      assert.equal(colors.get('Planning'), '#bcd0fb');
      assert.equal(colors.get('Errand'), '#c7e9b3');
      assert.equal(colors.get('Review'), '#b9a3f4');
      assert.equal(colors.get('Idea'), '#82d7a9');
    });

    await t.test('seeds default labels only once', async () => {
      // Second call should not duplicate defaults
      const labels = await ctx.labelService.listLabelsForOwner(ownerId);
      const urgentCount = labels.filter((l) => l.name === 'Urgent').length;
      assert.equal(urgentCount, 1, 'Urgent should only exist once');
    });

    await t.test('creating a label with default color', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'My Label',
      });

      assert.ok(label);
      assert.equal(label.name, 'My Label');
      assert.equal(label.userId, ownerId);
      assert.ok(label.color);
      assert.equal(label.icon, 'tag');
      assert.equal(label.pinned, false);
      assert.ok(label.id);
      assert.ok(label.createdAt);
      assert.ok(label.updatedAt);

      // listing should now include the new label + defaults
      const labels = await ctx.labelService.listLabelsForOwner(ownerId);
      assert.ok(labels.length >= 7);
      assert.ok(labels.some((l) => l.name === 'My Label'));
    });

    await t.test('creates a label with custom color', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Colored Label',
        color: '#ff0000',
      });

      assert.ok(label);
      assert.equal(label.name, 'Colored Label');
      assert.equal(label.color, '#ff0000');
    });

    await t.test('creates and updates icon and pinned', async () => {
      const created = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Pinned Icon Label',
        icon: 'flame',
        pinned: true,
      });
      assert.ok(created);
      assert.equal(created.icon, 'flame');
      assert.equal(created.pinned, true);

      const updated = await ctx.labelService.updateLabelForOwner(ownerId, created.id, {
        icon: 'lightbulb',
        pinned: false,
      });
      assert.ok(updated);
      assert.equal(updated.icon, 'lightbulb');
      assert.equal(updated.pinned, false);

      const listed = await ctx.labelService.listLabelsForOwner(ownerId);
      const listedRow = listed.find((label) => label.id === created.id);
      assert.equal(listedRow?.icon, 'lightbulb');
      assert.equal(listedRow?.pinned, false);
    });

    await t.test('lists pinned labels before alphabetical labels', async () => {
      const pinned = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'ZZZ Pinned Last Alphabetically',
        pinned: true,
      });
      assert.ok(pinned);

      const labels = await ctx.labelService.listLabelsForOwner(ownerId);
      assert.equal(labels[0]?.id, pinned.id, 'the pinned label should lead the list');
    });

    await t.test('rejects an unknown icon key', async () => {
      await assert.rejects(
        () =>
          ctx.labelService.createLabelForOwner(ownerId, {
            name: 'Bad Icon',
            // @ts-expect-error — exercising the runtime allowlist
            icon: 'not-a-real-icon',
          }),
        (error: { statusCode?: number }) => error.statusCode === 400,
      );

      const existing = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Valid Icon' });
      await assert.rejects(
        () =>
          ctx.labelService.updateLabelForOwner(ownerId, existing!.id, {
            // @ts-expect-error — exercising the runtime allowlist
            icon: 'not-a-real-icon',
          }),
        (error: { statusCode?: number }) => error.statusCode === 400,
      );
    });

    await t.test('gets a label by id', async () => {
      const created = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Get Test',
      });
      assert.ok(created);

      const fetched = await ctx.labelService.getLabelForOwner(created.id, ownerId);
      assert.ok(fetched);
      assert.equal(fetched.id, created.id);
      assert.equal(fetched.name, 'Get Test');
    });

    await t.test('returns null for non-existent label', async () => {
      const fetched = await ctx.labelService.getLabelForOwner(randomUUID(), ownerId);
      assert.equal(fetched, null);
    });

    await t.test('updates a label', async () => {
      const created = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Update Me',
      });
      assert.ok(created);

      const updated = await ctx.labelService.updateLabelForOwner(ownerId, created.id, {
        name: 'Updated Name',
        color: '#00ff00',
      });

      assert.ok(updated);
      assert.equal(updated.name, 'Updated Name');
      assert.equal(updated.color, '#00ff00');
    });

    await t.test('returns null when updating non-existent label', async () => {
      const updated = await ctx.labelService.updateLabelForOwner(ownerId, randomUUID(), {
        name: 'Noop',
      });
      assert.equal(updated, null);
    });

    await t.test('deletes a label', async () => {
      const created = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Delete Me',
      });
      assert.ok(created);

      const result = await ctx.labelService.deleteLabelForOwner(ownerId, created.id);
      assert.equal(result, true);

      const fetched = await ctx.labelService.getLabelForOwner(created.id, ownerId);
      assert.equal(fetched, null);
    });

    await t.test('returns null when deleting non-existent label', async () => {
      const result = await ctx.labelService.deleteLabelForOwner(ownerId, randomUUID());
      assert.equal(result, null);
    });

    await t.test('syncs task labels', async () => {
      const label1 = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Sync 1' });
      const label2 = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Sync 2' });
      assert.ok(label1);
      assert.ok(label2);

      // Create a task
      const { createTaskForOwner } = await import('./task-service.js');
      const task = await createTaskForOwner(ownerId, { title: 'Label Sync Task' });
      assert.ok(task);

      // Sync labels
      await ctx.labelService.syncTaskLabels(ownerId, task.id, [label1.id, label2.id]);

      // Verify labels are attached
      const taskLabels = await ctx.labelService.getTaskLabels(task.id);
      assert.equal(taskLabels.length, 2);
      const names = taskLabels.map((l) => l.name);
      assert.ok(names.includes('Sync 1'));
      assert.ok(names.includes('Sync 2'));

      // Re-sync with only one label — should remove the other
      await ctx.labelService.syncTaskLabels(ownerId, task.id, [label1.id]);
      const taskLabelsAfter = await ctx.labelService.getTaskLabels(task.id);
      assert.equal(taskLabelsAfter.length, 1);
      assert.equal(taskLabelsAfter[0].name, 'Sync 1');
    });

    await t.test('syncTaskLabels returns early when no labels are owned', async () => {
      const { createTaskForOwner } = await import('./task-service.js');
      const task = await createTaskForOwner(ownerId, { title: 'No Label Match Task' });
      assert.ok(task);

      // Pass label IDs that don't belong to this owner — should return early
      ctx.labelService.syncTaskLabels(ownerId, task.id, [randomUUID()]);

      const taskLabels = ctx.labelService.getTaskLabels(task.id);
      assert.equal(taskLabels.length, 0);
    });

    await t.test('getLabelsForTasks', async () => {
      const label1 = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Batch 1' });
      const label2 = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Batch 2' });
      const label3 = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Batch 3' });
      assert.ok(label1 && label2 && label3);

      const { createTaskForOwner } = await import('./task-service.js');
      const task1 = await createTaskForOwner(ownerId, { title: 'Task 1' });
      const task2 = await createTaskForOwner(ownerId, { title: 'Task 2' });
      const task3 = await createTaskForOwner(ownerId, { title: 'Task 3' });
      assert.ok(task1 && task2 && task3);

      await ctx.labelService.syncTaskLabels(ownerId, task1.id, [label1.id, label2.id]);
      await ctx.labelService.syncTaskLabels(ownerId, task2.id, [label3.id]);

      const map = await ctx.labelService.getLabelsForTasks([task1.id, task2.id, task3.id]);
      assert.deepEqual([...map.get(task1.id)!.sort()], [label1.id, label2.id].sort());
      assert.deepEqual(map.get(task2.id), [label3.id]);
      assert.equal(map.has(task3.id), false);

      const emptyMap = await ctx.labelService.getLabelsForTasks([]);
      assert.equal(emptyMap.size, 0);
    });

    await t.test('updateLabelForOwner returns null for wrong ownerId (4b)', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Owner Check' });
      assert.ok(label);

      const wrongOwner = randomUUID();
      const result = await ctx.labelService.updateLabelForOwner(wrongOwner, label.id, {
        name: 'Hacked Name',
      });
      assert.equal(result, null);
    });

    await t.test('deleteLabelForOwner returns null for wrong ownerId (4b)', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Delete Check' });
      assert.ok(label);

      const wrongOwner = randomUUID();
      const result = await ctx.labelService.deleteLabelForOwner(wrongOwner, label.id);
      assert.equal(result, null);

      // Label should still exist for the real owner
      const stillThere = await ctx.labelService.getLabelForOwner(label.id, ownerId);
      assert.ok(stillThere);
    });

    await t.test('create rejects a case-insensitive duplicate name with 409 details', async () => {
      const original = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Writing',
        color: '#82d7a9',
      });

      await assert.rejects(
        () => ctx.labelService.createLabelForOwner(ownerId, { name: ' writing ' }),
        (error: { statusCode?: number; details?: { existingLabel?: { id?: string } } }) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.details?.existingLabel?.id, original?.id);
          return true;
        },
      );
    });

    await t.test(
      'update rejects renaming into an existing label but keeps unchanged writes',
      async () => {
        const a = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Errands' });
        const b = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Calls' });
        assert.ok(a && b);

        await assert.rejects(
          () => ctx.labelService.updateLabelForOwner(ownerId, b!.id, { name: 'ERRANDS' }),
          (error: { statusCode?: number }) => {
            assert.equal(error.statusCode, 409);
            return true;
          },
        );

        // Saving a label with its own current name stays a 200 path.
        const ok = await ctx.labelService.updateLabelForOwner(ownerId, b!.id, { name: 'Calls' });
        assert.ok(ok);
        assert.equal(ok.name, 'Calls');
      },
    );

    await t.test('create rejects empty names and invalid colors', async () => {
      await assert.rejects(
        () => ctx.labelService.createLabelForOwner(ownerId, { name: '   ' }),
        (error: { statusCode?: number }) => error.statusCode === 400,
      );
      await assert.rejects(
        () => ctx.labelService.createLabelForOwner(ownerId, { name: 'Valid', color: 'blue' }),
        (error: { statusCode?: number }) => error.statusCode === 400,
      );
    });

    await t.test('does not report unrelated constraint failures as duplicate labels', async () => {
      // A non-existent owner trips the labels.user_id foreign key. That must
      // surface as the original constraint error, not a misleading 409.
      await assert.rejects(
        () =>
          ctx.labelService.createLabelForOwner(randomUUID(), {
            name: 'Orphaned label',
          }),
        (error: { statusCode?: number; code?: string }) => {
          assert.notEqual(error.statusCode, 409);
          assert.equal(error.code, 'SQLITE_CONSTRAINT_FOREIGNKEY');
          return true;
        },
      );
    });

    await t.test('create normalizes 3-digit hex colors', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'Trio',
        color: '#ABC',
      });
      assert.ok(label);
      assert.equal(label.color, '#aabbcc');
    });

    await t.test(
      'update keeps unchanged legacy color and rejects changed invalid color',
      async () => {
        const { labels } = await import('../db/schema.js');
        // Simulate a legacy row with a non-hex color written before validation.
        const legacy = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Legacy' });
        await ctx.db
          .update(labels)
          .set({ color: 'rebeccapurple' })
          .where(eq(labels.id, legacy!.id));

        // Unchanged color passes (no color field sent).
        const kept = await ctx.labelService.updateLabelForOwner(ownerId, legacy!.id, {
          name: 'Legacy Renamed',
        });
        assert.ok(kept);
        assert.equal(kept.color, 'rebeccapurple');

        // An explicit invalid color is rejected.
        await assert.rejects(
          () =>
            ctx.labelService.updateLabelForOwner(ownerId, legacy!.id, {
              name: 'Legacy Renamed',
              color: 'oops',
            }),
          (error: { statusCode?: number }) => error.statusCode === 400,
        );
      },
    );

    await t.test('counts split open/completed and exclude deleted tasks', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, { name: 'Counted' });
      assert.ok(label);

      const { createTaskForOwner, updateTaskForOwner } = await import('./task-service.js');
      const open = await createTaskForOwner(ownerId, { title: 'Counted open' });
      const done = await createTaskForOwner(ownerId, { title: 'Counted done' });
      const gone = await createTaskForOwner(ownerId, { title: 'Counted deleted' });
      assert.ok(open && done && gone);

      await ctx.labelService.syncTaskLabels(ownerId, open!.id, [label.id]);
      await ctx.labelService.syncTaskLabels(ownerId, done!.id, [label.id]);
      await ctx.labelService.syncTaskLabels(ownerId, gone!.id, [label.id]);
      await updateTaskForOwner(ownerId, done!.id, { completed: true });
      await updateTaskForOwner(ownerId, gone!.id, { completed: true });
      // deleteTaskForOwner is a hard delete; emulate the soft-delete path instead.
      await ctx.db.run(
        sql`UPDATE tasks SET deleted_at = '2026-10-20T10:00:00.000Z' WHERE id = ${gone!.id} AND user_id = ${ownerId}`,
      );

      const labels = await ctx.labelService.listLabelsForOwner(ownerId);
      const counted = labels.find((l) => l.id === label.id);
      assert.ok(counted);
      assert.equal(counted.openTaskCount, 1);
      assert.equal(counted.completedTaskCount, 1);
      assert.equal(counted.totalTaskCount, 2);
      assert.equal(counted.taskCount, 2, 'legacy alias mirrors totalTaskCount');
    });
  } finally {
    ctx.cleanup();
  }
});
