import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-test-${randomUUID()}.db`);
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

test('tasks routes require auth and scope data to the current user', async () => {
  const ctx = await createAuthedApp();

  try {
    const unauthorized = await ctx.app.inject({ method: 'GET', url: '/tasks' });
    assert.equal(unauthorized.statusCode, 401);

    const firstUserCookie = await signUpAndGetCookie(`first-${randomUUID()}@example.com`);
    const secondUserCookie = await signUpAndGetCookie(`second-${randomUUID()}@example.com`);

    const createResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: {
        cookie: firstUserCookie,
      },
      payload: {
        title: 'Write first task',
        priority: 'high',
        status: 'today',
        bucket: 'deep-work',
        simpleMode: true,
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();
    assert.equal(created.title, 'Write first task');
    assert.equal(created.completed, false);
    assert.equal(created.bucket, 'deep-work');
    assert.equal(created.simpleMode, true);
    assert.equal(created.dueDate, undefined);

    const ownerList = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: {
        cookie: firstUserCookie,
      },
    });
    assert.equal(ownerList.statusCode, 200);
    assert.equal(ownerList.json().length, 1);

    const otherUserList = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: {
        cookie: secondUserCookie,
      },
    });
    assert.equal(otherUserList.statusCode, 200);
    assert.equal(otherUserList.json().length, 0);

    const otherUserFetch = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${created.id}`,
      headers: {
        cookie: secondUserCookie,
      },
    });
    assert.equal(otherUserFetch.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});
