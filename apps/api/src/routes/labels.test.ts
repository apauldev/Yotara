import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { labels } from '../db/schema.js';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-labels-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  return {
    app,
    cleanup() {
      return Promise.resolve()
        .then(() => app.close())
        .finally(() => {
          rmSync(dbFile, { force: true });
          delete process.env['DATABASE_URL'];
          delete process.env['BETTER_AUTH_SECRET'];
          delete process.env['APP_BASE_URL'];
        });
    },
  };
}

async function signUpAndGetCookie(email: string) {
  const { auth } = await import('../lib/auth.js');
  const response = await auth.api.signUpEmail({
    body: {
      email,
      password: 'Password123!',
      name: email.split('@')[0],
    },
    asResponse: true,
  });

  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie;
}

function assertIsoTimestamp(value: unknown) {
  assert.equal(typeof value, 'string');
  assert.match(String(value), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

test('labels store ISO timestamps and update their text rows consistently', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`labels-${randomUUID()}@example.com`);

    const createResponse = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: {
        name: 'Focus',
        color: '#82d7a9',
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();
    assert.equal(created.name, 'Focus');
    assert.equal(created.color, '#82d7a9');
    assertIsoTimestamp(created.createdAt);
    assertIsoTimestamp(created.updatedAt);

    const { db } = await import('../db/client.js');
    const [storedLabel] = await db
      .select({
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt,
      })
      .from(labels)
      .where(eq(labels.id, created.id))
      .limit(1);
    assert.ok(storedLabel);
    assertIsoTimestamp(storedLabel.createdAt);
    assertIsoTimestamp(storedLabel.updatedAt);

    const updateResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/labels/${created.id}`,
      headers: { cookie },
      payload: {
        name: 'Deep Focus',
      },
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().name, 'Deep Focus');
    assertIsoTimestamp(updateResponse.json().createdAt);
    assertIsoTimestamp(updateResponse.json().updatedAt);

    const [updatedLabel] = await db
      .select({
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt,
      })
      .from(labels)
      .where(eq(labels.id, created.id))
      .limit(1);
    assert.ok(updatedLabel);
    assertIsoTimestamp(updatedLabel.createdAt);
    assertIsoTimestamp(updatedLabel.updatedAt);
  } finally {
    await ctx.cleanup();
  }
});

test('duplicate label names are rejected with a 409 and the existing label id', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`label-conflict-${randomUUID()}@example.com`);

    const createResponse = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Writing', color: '#82d7a9' },
    });
    assert.equal(createResponse.statusCode, 201);
    const original = createResponse.json();

    const caseDupe = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'WRITING' },
    });
    assert.equal(caseDupe.statusCode, 409);
    assert.equal(caseDupe.json().existingLabel.id, original.id);

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Sibling' },
    });
    assert.equal(second.statusCode, 201);
    const conflict = await ctx.app.inject({
      method: 'PATCH',
      url: `/labels/${second.json().id}`,
      headers: { cookie },
      payload: { name: 'writing' },
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().existingLabel.id, original.id);
  } finally {
    await ctx.cleanup();
  }
});

test('label routes reject empty names, invalid colors, and normalize short hex', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`label-validation-${randomUUID()}@example.com`);

    const blank = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: '   ' },
    });
    assert.equal(blank.statusCode, 400);

    const invalidColor = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Valid', color: 'blue' },
    });
    assert.equal(invalidColor.statusCode, 400);

    const shortHex = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Short', color: '#ABC' },
    });
    assert.equal(shortHex.statusCode, 201);
    assert.equal(shortHex.json().color, '#aabbcc');

    const invalidUpdate = await ctx.app.inject({
      method: 'PATCH',
      url: `/labels/${shortHex.json().id}`,
      headers: { cookie },
      payload: { name: 'Short', color: 'rebeccapurple' },
    });
    assert.equal(invalidUpdate.statusCode, 400);

    const invalidIcon = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Bad icon', icon: 'not-a-real-icon' },
    });
    assert.equal(invalidIcon.statusCode, 400);

    const iconPinned = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Icon pinned', icon: 'flame', pinned: true },
    });
    assert.equal(iconPinned.statusCode, 201);
    assert.equal(iconPinned.json().icon, 'flame');
    assert.equal(iconPinned.json().pinned, true);

    const invalidIconUpdate = await ctx.app.inject({
      method: 'PATCH',
      url: `/labels/${iconPinned.json().id}`,
      headers: { cookie },
      payload: { icon: 'not-a-real-icon' },
    });
    assert.equal(invalidIconUpdate.statusCode, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('GET /labels does not seed defaults and never resurrects deleted labels', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`label-no-seed-${randomUUID()}@example.com`);

    // A fresh account that never completed onboarding has NO labels, and
    // reading the list does not create any.
    const emptyResponse = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.equal(emptyResponse.statusCode, 200);
    assert.deepEqual(emptyResponse.json(), []);

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Only One' },
    });
    assert.equal(created.statusCode, 201);

    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: `/labels/${created.json().id}`,
      headers: { cookie },
    });
    assert.equal(deleted.statusCode, 200);

    // Reloading the page must NOT recreate the deleted label (and no new user
    // defaults appear either since seeding only happens during onboarding).
    const reloaded = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.equal(reloaded.statusCode, 200);
    assert.deepEqual(reloaded.json(), []);
  } finally {
    await ctx.cleanup();
  }
});

test('label counts split open and completed and exclude deleted tasks', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`label-counts-${randomUUID()}@example.com`);

    // Skip onboarding seeding: complete onboarding, then wipe defaults to
    // count only the labels this test owns.
    const me = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal', onboardingCompleted: true },
    });
    assert.equal(me.statusCode, 200);

    const { db } = await import('../db/client.js');
    const { labels: labelsTable, tasks: tasksTable, taskLabels } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const { userId } = await db
      .select({ userId: labelsTable.userId })
      .from(labelsTable)
      .limit(1)
      .then((rows) => rows[0] ?? { userId: null });
    assert.ok(userId, 'onboarding seeded labels, so a row exists');

    const ownerJoins = await db
      .select({ taskId: taskLabels.taskId })
      .from(taskLabels)
      .innerJoin(labelsTable, eq(taskLabels.labelId, labelsTable.id))
      .where(eq(labelsTable.userId, userId));
    for (const join of ownerJoins) {
      await db.delete(taskLabels).where(eq(taskLabels.taskId, join.taskId));
    }
    await db.delete(labelsTable).where(eq(labelsTable.userId, userId));

    const create = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'Counted' },
    });
    assert.equal(create.statusCode, 201);
    const label = create.json();

    const tasksToCreate = ['open task', 'done task', 'deleted task'];
    const ids: string[] = [];
    for (const title of tasksToCreate) {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie },
        payload: { title, labels: [label.id] },
      });
      assert.equal(response.statusCode, 201);
      ids.push(response.json().id);
    }

    const complete = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${ids[1]}`,
      headers: { cookie },
      payload: { completed: true },
    });
    assert.equal(complete.statusCode, 200);

    // Soft delete the third task directly so the count integrity is testable.
    const now = new Date().toISOString();
    await db.update(tasksTable).set({ deletedAt: now }).where(eq(tasksTable.id, ids[2]));

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.equal(list.statusCode, 200);
    const counted = list.json().find((l: { id: string }) => l.id === label.id);
    assert.ok(counted);
    assert.equal(counted.openTaskCount, 1);
    assert.equal(counted.completedTaskCount, 1);
    assert.equal(counted.totalTaskCount, 2);
    assert.equal(counted.taskCount, 2);
  } finally {
    await ctx.cleanup();
  }
});

test('merging a label moves every association, dedupes, and deletes the source', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`label-merge-${randomUUID()}@example.com`);

    const createLabel = async (name: string) => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/labels',
        headers: { cookie },
        payload: { name },
      });
      assert.equal(response.statusCode, 201);
      return response.json().id as string;
    };
    const sourceId = await createLabel('Writing');
    const targetId = await createLabel('Docs');
    const untouchedId = await createLabel('Errand');

    const createTask = async (title: string, labels: string[]) => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie },
        payload: { title, labels },
      });
      assert.equal(response.statusCode, 201);
      return response.json();
    };
    await createTask('Only source', [sourceId]);
    await createTask('Source and target', [sourceId, targetId]);
    await createTask('Only target', [targetId]);
    await createTask('Untouched', [untouchedId]);

    const merge = await ctx.app.inject({
      method: 'POST',
      url: `/labels/${sourceId}/merge`,
      headers: { cookie },
      payload: { targetId },
    });
    assert.equal(merge.statusCode, 200);
    // Two source associations moved; the task that already had the target is
    // deduplicated rather than duplicated.
    assert.equal(merge.json().movedTaskCount, 2);

    const labels = await ctx.app.inject({ method: 'GET', url: '/labels', headers: { cookie } });
    assert.equal(labels.statusCode, 200);
    const names = labels.json().map((label: { name: string }) => label.name);
    assert.ok(!names.includes('Writing'));
    assert.ok(names.includes('Docs'));
    assert.ok(names.includes('Errand'));

    const targetTasks = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?labelIds=${targetId}&includeSubtasks=true`,
      headers: { cookie },
    });
    assert.equal(targetTasks.statusCode, 200);
    const titles = targetTasks.json().data.map((task: { title: string }) => task.title);
    assert.deepEqual(new Set(titles), new Set(['Only source', 'Source and target', 'Only target']));

    const selfMerge = await ctx.app.inject({
      method: 'POST',
      url: `/labels/${targetId}/merge`,
      headers: { cookie },
      payload: { targetId },
    });
    assert.equal(selfMerge.statusCode, 400);

    const missingSource = await ctx.app.inject({
      method: 'POST',
      url: `/labels/${randomUUID()}/merge`,
      headers: { cookie },
      payload: { targetId },
    });
    assert.equal(missingSource.statusCode, 404);

    const missingTarget = await ctx.app.inject({
      method: 'POST',
      url: `/labels/${targetId}/merge`,
      headers: { cookie },
      payload: { targetId: randomUUID() },
    });
    assert.equal(missingTarget.statusCode, 404);

    // A target owned by somebody else is not visible and cannot be merged into.
    const otherCookie = await signUpAndGetCookie(`label-merge-other-${randomUUID()}@example.com`);
    const foreignTarget = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie: otherCookie },
      payload: { name: 'Foreign target' },
    });
    assert.equal(foreignTarget.statusCode, 201);
    const foreignMerge = await ctx.app.inject({
      method: 'POST',
      url: `/labels/${untouchedId}/merge`,
      headers: { cookie },
      payload: { targetId: foreignTarget.json().id },
    });
    assert.equal(foreignMerge.statusCode, 404);

    const stillThere = await ctx.app.inject({ method: 'GET', url: '/labels', headers: { cookie } });
    assert.ok(stillThere.json().some((label: { id: string }) => label.id === untouchedId));
  } finally {
    await ctx.cleanup();
  }
});
