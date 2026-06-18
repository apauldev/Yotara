import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { tasks } from '../db/schema.js';
import { DateTime } from 'luxon';

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

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function assertIsoTimestamp(value: unknown) {
  assert.equal(typeof value, 'string');
  assert.match(String(value), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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
        simpleMode: true,
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();
    assert.equal(created.title, 'Write first task');
    assert.equal(created.completed, false);
    assert.ok(created.projectId);
    assert.equal(created.simpleMode, true);
    assert.equal(created.dueDate, undefined);
    assertIsoTimestamp(created.createdAt);
    assertIsoTimestamp(created.updatedAt);

    const { db } = await import('../db/client.js');
    const [storedTask] = await db
      .select({
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        archivedAt: tasks.archivedAt,
      })
      .from(tasks)
      .where(eq(tasks.id, created.id))
      .limit(1);
    assert.ok(storedTask);
    assertIsoTimestamp(storedTask.createdAt);
    assertIsoTimestamp(storedTask.updatedAt);

    const blankTitleResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: {
        cookie: firstUserCookie,
      },
      payload: {
        title: '   ',
      },
    });
    assert.equal(blankTitleResponse.statusCode, 400);

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

test('tasks list supports pagination and delete removes the row', async () => {
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

    const blankTitlePatch = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${deleteId}`,
      headers: { cookie: userCookie },
      payload: {
        title: '   ',
      },
    });
    assert.equal(blankTitlePatch.statusCode, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('tasks pagination validates query bounds and deleted tasks cannot be updated', async () => {
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

test('temporary archived tasks are cleaned up in the database while permanent archives stay', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`archive-${randomUUID()}@example.com`);
    const { db } = await import('../db/client.js');

    const disableCleanupResponse = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: {
        cookie: userCookie,
      },
      payload: {
        archiveAutoDelete: false,
      },
    });
    assert.equal(disableCleanupResponse.statusCode, 200);
    assert.equal(disableCleanupResponse.json().user.archiveAutoDelete, false);

    const temporaryCreate = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'Temporary archive',
        status: 'inbox',
        priority: 'medium',
        simpleMode: true,
      },
    });
    assert.equal(temporaryCreate.statusCode, 201);
    const temporaryTask = temporaryCreate.json();

    const completeTemporary = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${temporaryTask.id}`,
      headers: { cookie: userCookie },
      payload: { completed: true, permanentArchive: false },
    });
    assert.equal(completeTemporary.statusCode, 200);
    assert.equal(completeTemporary.json().permanentArchive, false);
    assertIsoTimestamp(completeTemporary.json().createdAt);
    assertIsoTimestamp(completeTemporary.json().updatedAt);

    const storedTemporary = await db
      .select({
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        archivedAt: tasks.archivedAt,
      })
      .from(tasks)
      .where(eq(tasks.id, temporaryTask.id))
      .limit(1);
    assert.equal(storedTemporary.length, 1);
    assertIsoTimestamp(storedTemporary[0].createdAt);
    assertIsoTimestamp(storedTemporary[0].updatedAt);
    assertIsoTimestamp(storedTemporary[0].archivedAt);

    await db
      .update(tasks)
      .set({ archivedAt: daysAgoIso(40) })
      .where(eq(tasks.id, temporaryTask.id));

    const temporaryArchiveVisible = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { cookie: userCookie },
    });
    assert.equal(temporaryArchiveVisible.statusCode, 200);
    assert.equal(temporaryArchiveVisible.json().meta.total, 1);

    const enableCleanupResponse = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: {
        cookie: userCookie,
      },
      payload: {
        archiveAutoDelete: true,
      },
    });
    assert.equal(enableCleanupResponse.statusCode, 200);
    assert.equal(enableCleanupResponse.json().user.archiveAutoDelete, true);

    const cleanedArchive = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { cookie: userCookie },
    });
    assert.equal(cleanedArchive.statusCode, 200);
    assert.equal(cleanedArchive.json().meta.total, 0);

    const cleanedFetch = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${temporaryTask.id}`,
      headers: { cookie: userCookie },
    });
    assert.equal(cleanedFetch.statusCode, 404);

    const permanentCreate = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'Permanent archive',
        status: 'inbox',
        priority: 'medium',
        simpleMode: true,
      },
    });
    assert.equal(permanentCreate.statusCode, 201);
    const permanentTask = permanentCreate.json();

    const completePermanent = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${permanentTask.id}`,
      headers: { cookie: userCookie },
      payload: {
        completed: true,
        permanentArchive: true,
      },
    });
    assert.equal(completePermanent.statusCode, 200);
    assert.equal(completePermanent.json().permanentArchive, true);

    await db
      .update(tasks)
      .set({ archivedAt: daysAgoIso(40) })
      .where(eq(tasks.id, permanentTask.id));

    const permanentArchiveVisible = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { cookie: userCookie },
    });
    assert.equal(permanentArchiveVisible.statusCode, 200);
    assert.equal(permanentArchiveVisible.json().meta.total, 1);
    assert.equal(permanentArchiveVisible.json().data[0].id, permanentTask.id);
    assert.equal(permanentArchiveVisible.json().data[0].permanentArchive, true);
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

test('tasks timezone-aware queries (overdue, view, completedSince)', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`tz-owner-${randomUUID()}@example.com`);

    const todayUtc = DateTime.now().setZone('UTC');
    const todayStr = todayUtc.toFormat('yyyy-MM-dd');
    const yesterdayStr = todayUtc.minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const tomorrowStr = todayUtc.plus({ days: 1 }).toFormat('yyyy-MM-dd');

    // Create overdue task
    const tOverdue = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Overdue task', dueDate: yesterdayStr },
    });
    assert.equal(tOverdue.statusCode, 201);

    // Create overdue task with status='today' (should not appear in view=today)
    const tOverdueToday = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Overdue today-status task', status: 'today', dueDate: yesterdayStr },
    });
    assert.equal(tOverdueToday.statusCode, 201);

    // Create today task
    const tToday = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Today task', dueDate: todayStr },
    });
    assert.equal(tToday.statusCode, 201);

    // Create upcoming task
    const tUpcoming = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Upcoming task', dueDate: tomorrowStr },
    });
    assert.equal(tUpcoming.statusCode, 201);

    // Create upcoming task with dueDate=today (should not appear in view=upcoming)
    const tUpcomingToday = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Upcoming today-due task', status: 'upcoming', dueDate: todayStr },
    });
    assert.equal(tUpcomingToday.statusCode, 201);

    // Create inbox task without due date
    const tInboxNoDate = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Inbox task no date', status: 'inbox' },
    });
    assert.equal(tInboxNoDate.statusCode, 201);

    // 1. Test overdue filter
    const overdueRes = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?overdue=true&tz=UTC`,
      headers: { cookie },
    });
    assert.equal(overdueRes.statusCode, 200);
    const overdueTasksList = overdueRes.json().data;
    assert.equal(overdueTasksList.length, 2);
    assert.ok(overdueTasksList.some((t: any) => t.title === 'Overdue task'));
    assert.ok(overdueTasksList.some((t: any) => t.title === 'Overdue today-status task'));

    // 2. Test view=today
    const todayRes = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?view=today&tz=UTC`,
      headers: { cookie },
    });
    assert.equal(todayRes.statusCode, 200);
    const todayTasksList = todayRes.json().data;
    // Should return Today task (based on dueDate = today)
    assert.ok(todayTasksList.some((t: any) => t.title === 'Today task'));
    assert.ok(!todayTasksList.some((t: any) => t.title === 'Upcoming task'));
    assert.ok(!todayTasksList.some((t: any) => t.title === 'Overdue task'));
    // Overdue task with status='today' must not appear in view=today
    assert.ok(!todayTasksList.some((t: any) => t.title === 'Overdue today-status task'));

    // 3. Test view=upcoming
    const upcomingRes = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?view=upcoming&tz=UTC`,
      headers: { cookie },
    });
    assert.equal(upcomingRes.statusCode, 200);
    const upcomingTasksList = upcomingRes.json().data;
    assert.ok(upcomingTasksList.some((t: any) => t.title === 'Upcoming task'));
    assert.ok(!upcomingTasksList.some((t: any) => t.title === 'Today task'));
    // Upcoming task with dueDate=today must not appear in view=upcoming
    assert.ok(!upcomingTasksList.some((t: any) => t.title === 'Upcoming today-due task'));

    // 4. Test view=inbox (should return status='inbox' with no date)
    const inboxRes = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?view=inbox&tz=UTC`,
      headers: { cookie },
    });
    assert.equal(inboxRes.statusCode, 200);
    const inboxTasksList = inboxRes.json().data;
    assert.ok(inboxTasksList.some((t: any) => t.title === 'Inbox task no date'));
    assert.ok(!inboxTasksList.some((t: any) => t.title === 'Today task'));
    assert.ok(!inboxTasksList.some((t: any) => t.title === 'Upcoming task'));
    assert.ok(!inboxTasksList.some((t: any) => t.title === 'Overdue task'));

    // 5. Test completedSince filter
    // Complete the today task
    const completeRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${tToday.json().id}`,
      headers: { cookie },
      payload: { completed: true },
    });
    assert.equal(completeRes.statusCode, 200);

    const completedRes = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?completedSince=${todayStr}&tz=UTC`,
      headers: { cookie },
    });
    assert.equal(completedRes.statusCode, 200);
    const completedTasksList = completedRes.json().data;
    assert.ok(completedTasksList.some((t: any) => t.title === 'Today task'));

    // completedSince tomorrow should NOT return it
    const completedResTomorrow = await ctx.app.inject({
      method: 'GET',
      url: `/tasks?completedSince=${tomorrowStr}&tz=UTC`,
      headers: { cookie },
    });
    assert.equal(completedResTomorrow.statusCode, 200);
    assert.equal(completedResTomorrow.json().data.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('tasks export endpoint returns all tasks without pagination limit', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`export-owner-${randomUUID()}@example.com`);

    // Create 3 tasks
    for (let i = 0; i < 3; i++) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { cookie },
        payload: { title: `Export task ${i}` },
      });
      assert.equal(res.statusCode, 201);
    }

    // Request with export=true should return all tasks
    const exportRes = await ctx.app.inject({
      method: 'GET',
      url: '/tasks?export=true',
      headers: { cookie },
    });
    assert.equal(exportRes.statusCode, 200);
    const exportData = exportRes.json();
    assert.equal(exportData.data.length, 3);
    assert.equal(exportData.meta.total, 3);
  } finally {
    await ctx.cleanup();
  }
});
