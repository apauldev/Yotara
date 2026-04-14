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
    assert.equal(ownerList.json().data.length, 1);
    assert.equal(ownerList.json().meta.total, 1);

    const otherUserList = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: {
        cookie: secondUserCookie,
      },
    });
    assert.equal(otherUserList.statusCode, 200);
    assert.equal(otherUserList.json().data.length, 0);
    assert.equal(otherUserList.json().meta.total, 0);

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

test('tasks list supports pagination and delete is a soft delete', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`owner-${randomUUID()}@example.com`);

    for (const title of ['Task 1', 'Task 2', 'Task 3']) {
      const createResponse = await ctx.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie: userCookie },
        payload: { title, status: 'inbox', priority: 'medium', simpleMode: true },
      });
      assert.equal(createResponse.statusCode, 201);
    }

    const firstPage = await ctx.app.inject({
      method: 'GET',
      url: '/tasks?page=1&pageSize=2',
      headers: { cookie: userCookie },
    });
    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.json().data.length, 2);
    assert.equal(firstPage.json().meta.total, 3);
    assert.equal(firstPage.json().meta.totalPages, 2);
    assert.equal(firstPage.json().meta.hasNextPage, true);
    assert.equal(firstPage.json().meta.hasPreviousPage, false);

    const secondPage = await ctx.app.inject({
      method: 'GET',
      url: '/tasks?page=2&pageSize=2',
      headers: { cookie: userCookie },
    });
    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.json().data.length, 1);
    assert.equal(secondPage.json().meta.page, 2);
    assert.equal(secondPage.json().meta.hasNextPage, false);
    assert.equal(secondPage.json().meta.hasPreviousPage, true);

    const deleteId = firstPage.json().data[0].id as string;
    const deleteResponse = await ctx.app.inject({
      method: 'DELETE',
      url: `/tasks/${deleteId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(deleteResponse.statusCode, 200);

    const afterDelete = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { cookie: userCookie },
    });
    assert.equal(afterDelete.statusCode, 200);
    assert.equal(afterDelete.json().meta.total, 2);
    assert.ok(afterDelete.json().data.every((task: { id: string }) => task.id !== deleteId));

    const deletedFetch = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${deleteId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(deletedFetch.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('tasks pagination validates query bounds and soft-deleted tasks cannot be updated', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`clamp-${randomUUID()}@example.com`);

    for (let i = 0; i < 3; i += 1) {
      const createResponse = await ctx.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie: userCookie },
        payload: { title: `Task ${i + 1}`, status: 'inbox', priority: 'medium', simpleMode: true },
      });
      assert.equal(createResponse.statusCode, 201);
    }

    const invalidPageResponse = await ctx.app.inject({
      method: 'GET',
      url: '/tasks?page=0&pageSize=500',
      headers: { cookie: userCookie },
    });
    assert.equal(invalidPageResponse.statusCode, 400);

    const validResponse = await ctx.app.inject({
      method: 'GET',
      url: '/tasks?page=1&pageSize=2',
      headers: { cookie: userCookie },
    });
    assert.equal(validResponse.statusCode, 200);
    assert.equal(validResponse.json().meta.page, 1);
    assert.equal(validResponse.json().meta.pageSize, 2);
    assert.equal(validResponse.json().meta.total, 3);

    const deleteId = validResponse.json().data[0].id as string;
    const deleteResponse = await ctx.app.inject({
      method: 'DELETE',
      url: `/tasks/${deleteId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(deleteResponse.statusCode, 200);

    const patchDeleted = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${deleteId}`,
      headers: { cookie: userCookie },
      payload: { title: 'Should not update' },
    });
    assert.equal(patchDeleted.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('tasks support owned project assignment and reject foreign project references', async () => {
  const ctx = await createAuthedApp();

  try {
    const firstUserCookie = await signUpAndGetCookie(`projects-owner-${randomUUID()}@example.com`);
    const secondUserCookie = await signUpAndGetCookie(`projects-other-${randomUUID()}@example.com`);

    const createProjectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: firstUserCookie },
      payload: {
        name: 'Launch Yotara MVP',
        description: 'Personal release plan',
        color: 'sage',
      },
    });
    assert.equal(createProjectResponse.statusCode, 201);
    const ownedProjectId = createProjectResponse.json().id as string;

    const otherProjectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: secondUserCookie },
      payload: {
        name: 'Other user project',
        color: 'forest',
      },
    });
    assert.equal(otherProjectResponse.statusCode, 201);
    const foreignProjectId = otherProjectResponse.json().id as string;

    const createTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: firstUserCookie },
      payload: {
        title: 'Define launch checklist',
        status: 'today',
        priority: 'high',
        projectId: ownedProjectId,
      },
    });
    assert.equal(createTaskResponse.statusCode, 201);
    assert.equal(createTaskResponse.json().projectId, ownedProjectId);
    const taskId = createTaskResponse.json().id as string;

    const foreignCreateResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: firstUserCookie },
      payload: {
        title: 'Should fail',
        projectId: foreignProjectId,
      },
    });
    assert.equal(foreignCreateResponse.statusCode, 404);

    const assignProjectResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie: firstUserCookie },
      payload: {
        projectId: ownedProjectId,
      },
    });
    assert.equal(assignProjectResponse.statusCode, 200);
    assert.equal(assignProjectResponse.json().projectId, ownedProjectId);

    const clearProjectResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie: firstUserCookie },
      payload: {
        projectId: null,
      },
    });
    assert.equal(clearProjectResponse.statusCode, 200);
    assert.equal(clearProjectResponse.json().projectId, undefined);

    const foreignPatchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie: firstUserCookie },
      payload: {
        projectId: foreignProjectId,
      },
    });
    assert.equal(foreignPatchResponse.statusCode, 404);

    const listResponse = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { cookie: firstUserCookie },
    });
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().data[0].projectId, undefined);
  } finally {
    await ctx.cleanup();
  }
});
