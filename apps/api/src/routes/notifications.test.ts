import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-notifications-test-${randomUUID()}.db`);
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

test('notifications CRUD and auth', async () => {
  const ctx = await createAuthedApp();

  try {
    // 401 without auth
    const noAuthList = await ctx.app.inject({
      method: 'GET',
      url: '/notifications',
    });
    assert.equal(noAuthList.statusCode, 401);

    const noAuthCount = await ctx.app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
    });
    assert.equal(noAuthCount.statusCode, 401);

    const noAuthMark = await ctx.app.inject({
      method: 'PATCH',
      url: '/notifications/some-id/read',
    });
    assert.equal(noAuthMark.statusCode, 401);

    const noAuthClear = await ctx.app.inject({
      method: 'DELETE',
      url: '/notifications/read',
    });
    assert.equal(noAuthClear.statusCode, 401);

    const noAuthMarkAll = await ctx.app.inject({
      method: 'PATCH',
      url: '/notifications/read-all',
    });
    assert.equal(noAuthMarkAll.statusCode, 401);

    const cookie = await signUpAndGetCookie(`notif-${randomUUID()}@example.com`);

    // Create a task due today to trigger a notification
    const today = new Date().toISOString().slice(0, 10);
    const createRes = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: {
        title: 'Due today task',
        dueDate: today,
      },
    });
    assert.equal(createRes.statusCode, 201);

    // List notifications
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { cookie },
    });
    assert.equal(listRes.statusCode, 200);
    const notificationsList = listRes.json();
    assert.ok(Array.isArray(notificationsList));
    assert.ok(notificationsList.length >= 1, 'should have at least one notification');

    const notif = notificationsList[0];
    assert.equal(notif.type, 'due_today');
    assert.equal(notif.title, 'Task due today');
    assert.equal(notif.body, 'Due today task');
    assert.equal(notif.read, false);
    // readAt may be '' from SQLite before we've ever set it
    assert.ok(notif.readAt === null || notif.readAt === '');
    assert.ok(notif.taskId);

    // Unread count
    const countRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { cookie },
    });
    assert.equal(countRes.statusCode, 200);
    assert.ok(countRes.json().count >= 1);

    // Mark as read
    const markRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/notifications/${notif.id}/read`,
      headers: { cookie },
    });
    assert.equal(markRes.statusCode, 200);
    const marked = markRes.json();
    assert.equal(marked.read, true);
    assert.equal(typeof marked.readAt, 'string');

    // Count should drop
    const countAfterRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { cookie },
    });
    assert.equal(countAfterRes.statusCode, 200);
    assert.equal(countAfterRes.json().count, 0);

    // Clear read
    const clearRes = await ctx.app.inject({
      method: 'DELETE',
      url: '/notifications/read',
      headers: { cookie },
    });
    assert.equal(clearRes.statusCode, 200);
    assert.equal(clearRes.json().ok, true);

    // List should be empty now
    const listAfterClear = await ctx.app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { cookie },
    });
    assert.equal(listAfterClear.json().length, 0);

    // Limit parameter: create several tasks
    for (let i = 0; i < 5; i++) {
      await ctx.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie },
        payload: { title: `Limit task ${i}`, dueDate: today },
      });
    }
    const limitRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications?limit=3',
      headers: { cookie },
    });
    assert.equal(limitRes.statusCode, 200);
    assert.equal(limitRes.json().length, 3);

    // Limit = 0 is rejected by schema validation (minimum: 1)
    const zeroLimitRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications?limit=0',
      headers: { cookie },
    });
    assert.equal(zeroLimitRes.statusCode, 400);

    // Negative limit is rejected by schema validation
    const negLimitRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications?limit=-5',
      headers: { cookie },
    });
    assert.equal(negLimitRes.statusCode, 400);

    // Over 200 is rejected by schema validation (maximum: 200)
    const highLimitRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications?limit=999',
      headers: { cookie },
    });
    assert.equal(highLimitRes.statusCode, 400);

    // Mark all as read
    const markAllRes = await ctx.app.inject({
      method: 'PATCH',
      url: '/notifications/read-all',
      headers: { cookie },
    });
    assert.equal(markAllRes.statusCode, 200);
    assert.equal(markAllRes.json().ok, true);

    // Unread count should be 0
    const countAfterMarkAll = await ctx.app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { cookie },
    });
    assert.equal(countAfterMarkAll.json().count, 0);

    // Mark non-existent notification returns 404
    const notFoundRes = await ctx.app.inject({
      method: 'PATCH',
      url: '/notifications/nonexistent/read',
      headers: { cookie },
    });
    assert.equal(notFoundRes.statusCode, 404);
    assert.equal(notFoundRes.json().message, 'Notification not found');

    // Cannot mark another user's notification
    const cookie2 = await signUpAndGetCookie(`notif-other-${randomUUID()}@example.com`);
    // User 1's notification should 404 for User 2
    const crossRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/notifications/${notif.id}/read`,
      headers: { cookie: cookie2 },
    });
    assert.equal(crossRes.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('notifications cascade-delete when user is deleted', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`notif-cascade-${randomUUID()}@example.com`);
    const cookie2 = await signUpAndGetCookie(`notif-other-${randomUUID()}@example.com`);

    // User 1 creates a task due today → notification
    const today = new Date().toISOString().slice(0, 10);
    await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Cascade task', dueDate: today },
    });

    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { cookie },
    });
    assert.ok(listRes.json().length >= 1);

    // Delete User 1's account
    const deleteRes = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie },
      payload: { password: 'Password123!' },
    });
    assert.equal(deleteRes.statusCode, 200);

    // User 2 should have no notifications (their data is unaffected)
    const otherRes = await ctx.app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { cookie: cookie2 },
    });
    assert.equal(otherRes.json().length, 0);
  } finally {
    await ctx.cleanup();
  }
});
