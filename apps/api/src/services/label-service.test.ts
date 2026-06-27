import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

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

      // Should include 8 default labels
      assert.ok(labels.length >= 8);
      const names = labels.map((l) => l.name);
      assert.ok(names.includes('Urgent'));
      assert.ok(names.includes('Waiting'));
      assert.ok(names.includes('Planning'));
    });

    await t.test('seeds default labels only once', async () => {
      // Second call should not duplicate defaults
      const labels = await ctx.labelService.listLabelsForOwner(ownerId);
      const urgentCount = labels.filter((l) => l.name === 'Urgent').length;
      assert.equal(urgentCount, 1, 'Urgent should only exist once');
    });

    await t.test('creates a label with default color', async () => {
      const label = await ctx.labelService.createLabelForOwner(ownerId, {
        name: 'My Label',
      });

      assert.ok(label);
      assert.equal(label.name, 'My Label');
      assert.equal(label.userId, ownerId);
      assert.ok(label.color);
      assert.ok(label.id);
      assert.ok(label.createdAt);
      assert.ok(label.updatedAt);

      // listing should now include the new label + defaults
      const labels = await ctx.labelService.listLabelsForOwner(ownerId);
      assert.ok(labels.length >= 9);
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
  } finally {
    ctx.cleanup();
  }
});
