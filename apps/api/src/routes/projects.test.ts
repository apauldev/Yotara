import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-projects-test-${randomUUID()}.db`);
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

test('projects routes require auth and scope project data to the current user', async () => {
  const ctx = await createAuthedApp();

  try {
    const unauthorized = await ctx.app.inject({ method: 'GET', url: '/projects' });
    assert.equal(unauthorized.statusCode, 401);

    const firstUserCookie = await signUpAndGetCookie(`first-${randomUUID()}@example.com`);
    const secondUserCookie = await signUpAndGetCookie(`second-${randomUUID()}@example.com`);

    const createResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: firstUserCookie },
      payload: {
        name: ' Launch Yotara MVP ',
        description: ' Core release scope ',
        color: 'sage',
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();
    assert.equal(created.name, 'Launch Yotara MVP');
    assert.equal(created.description, 'Core release scope');
    assert.equal(created.color, 'sage');
    assert.equal(created.taskCount, 0);
    assert.equal(created.completedTaskCount, 0);
    assert.equal(created.openTaskCount, 0);

    const ownerList = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie: firstUserCookie },
    });
    assert.equal(ownerList.statusCode, 200);
    assert.equal(ownerList.json().length, 9);

    const otherUserList = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie: secondUserCookie },
    });
    assert.equal(otherUserList.statusCode, 200);
    assert.equal(otherUserList.json().length, 8);

    const otherUserFetch = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${created.id}`,
      headers: { cookie: secondUserCookie },
    });
    assert.equal(otherUserFetch.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('projects validate payloads and support updates', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`owner-${randomUUID()}@example.com`);

    const emptyNameResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: '   ',
      },
    });
    assert.equal(emptyNameResponse.statusCode, 400);

    const invalidColorResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'New Project',
        color: 'purple',
      },
    });
    assert.equal(invalidColorResponse.statusCode, 400);

    const createResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'Website Refresh',
        description: 'Refresh the home page',
        color: 'teal',
      },
    });
    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();

    const updateResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/projects/${created.id}`,
      headers: { cookie: userCookie },
      payload: {
        name: ' Website Refresh Phase 1 ',
        description: '   ',
        color: 'forest',
      },
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().name, 'Website Refresh Phase 1');
    assert.equal(updateResponse.json().description, undefined);
    assert.equal(updateResponse.json().color, 'forest');

    const emptyNamePatchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/projects/${created.id}`,
      headers: { cookie: userCookie },
      payload: {
        name: '   ',
      },
    });
    assert.equal(emptyNamePatchResponse.statusCode, 400);

    const invalidColorPatchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/projects/${created.id}`,
      headers: { cookie: userCookie },
      payload: {
        color: 'magenta',
      },
    });
    assert.equal(invalidColorPatchResponse.statusCode, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('project task listing returns only active tasks assigned to that project', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`tasks-${randomUUID()}@example.com`);

    const createProjectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'Garden Renovation',
        color: 'olive',
      },
    });
    assert.equal(createProjectResponse.statusCode, 201);
    const projectId = createProjectResponse.json().id as string;

    const firstTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'Buy soil samples',
        projectId,
      },
    });
    assert.equal(firstTaskResponse.statusCode, 201);
    const firstTaskId = firstTaskResponse.json().id as string;

    const secondTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'Sketch new patio layout',
        projectId,
      },
    });
    assert.equal(secondTaskResponse.statusCode, 201);

    const unrelatedTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'General inbox note',
      },
    });
    assert.equal(unrelatedTaskResponse.statusCode, 201);

    const deleteResponse = await ctx.app.inject({
      method: 'DELETE',
      url: `/tasks/${firstTaskId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(deleteResponse.statusCode, 200);

    const projectTasksResponse = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}/tasks`,
      headers: { cookie: userCookie },
    });
    assert.equal(projectTasksResponse.statusCode, 200);
    assert.equal(projectTasksResponse.json().length, 1);
    assert.equal(projectTasksResponse.json()[0].title, 'Sketch new patio layout');

    const projectResponse = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(projectResponse.statusCode, 200);
    assert.equal(projectResponse.json().taskCount, 1);
    assert.equal(projectResponse.json().openTaskCount, 1);
    assert.equal(projectResponse.json().completedTaskCount, 0);
  } finally {
    await ctx.cleanup();
  }
});
