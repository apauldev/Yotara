import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { projects } from '../db/schema.js';

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

function assertIsoTimestamp(value: unknown) {
  assert.equal(typeof value, 'string');
  assert.match(String(value), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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
    assertIsoTimestamp(created.createdAt);
    assertIsoTimestamp(created.updatedAt);

    const { db } = await import('../db/client.js');
    const [storedProject] = await db
      .select({
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.id, created.id))
      .limit(1);
    assert.ok(storedProject);
    assertIsoTimestamp(storedProject.createdAt);
    assertIsoTimestamp(storedProject.updatedAt);

    const ownerList = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie: firstUserCookie },
    });
    assert.equal(ownerList.statusCode, 200);
    // Reads no longer seed a fallback project: only the custom project exists.
    assert.equal(ownerList.json().length, 1);

    const otherUserList = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie: secondUserCookie },
    });
    assert.equal(otherUserList.statusCode, 200);
    assert.equal(otherUserList.json().length, 0);

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
    assertIsoTimestamp(updateResponse.json().createdAt);
    assertIsoTimestamp(updateResponse.json().updatedAt);

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

test('project task listing includes label ids so cards can render chips', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`project-labels-${randomUUID()}@example.com`);

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

    const createLabelResponse = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie: userCookie },
      payload: { name: 'Call' },
    });
    assert.equal(createLabelResponse.statusCode, 201);
    const labelId = createLabelResponse.json().id as string;

    const createTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'Call the plumber',
        projectId,
        labels: [labelId],
      },
    });
    assert.equal(createTaskResponse.statusCode, 201);
    const taskId = createTaskResponse.json().id as string;

    const projectTasksResponse = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}/tasks`,
      headers: { cookie: userCookie },
    });
    assert.equal(projectTasksResponse.statusCode, 200);
    const [task] = projectTasksResponse.json();
    assert.equal(task.id, taskId);
    assert.deepEqual(task.labels, [labelId]);
  } finally {
    await ctx.cleanup();
  }
});

test('project task listing returns tasks in stable order', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`order-${randomUUID()}@example.com`);

    const createProjectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'Ordered Project',
        color: 'sage',
      },
    });
    assert.equal(createProjectResponse.statusCode, 201);
    const projectId = createProjectResponse.json().id as string;

    const lowOrderTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'Second task',
        projectId,
      },
    });
    assert.equal(lowOrderTaskResponse.statusCode, 201);

    const highOrderTaskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: {
        title: 'First task',
        projectId,
      },
    });
    assert.equal(highOrderTaskResponse.statusCode, 201);

    const firstTaskId = lowOrderTaskResponse.json().id as string;
    const secondTaskId = highOrderTaskResponse.json().id as string;

    await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${firstTaskId}`,
      headers: { cookie: userCookie },
      payload: {
        order: 2,
      },
    });

    await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${secondTaskId}`,
      headers: { cookie: userCookie },
      payload: {
        order: 1,
      },
    });

    const projectTasksResponse = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}/tasks`,
      headers: { cookie: userCookie },
    });

    assert.equal(projectTasksResponse.statusCode, 200);
    assert.deepEqual(
      projectTasksResponse.json().map((task: { title: string }) => task.title),
      ['First task', 'Second task'],
    );
  } finally {
    await ctx.cleanup();
  }
});

test('project creation and update supports kind, targetDate, pinned, sortOrder', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`kind-test-${randomUUID()}@example.com`);

    const finiteResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'Launch Website',
        kind: 'project',
        targetDate: '2026-12-01',
        pinned: true,
      },
    });
    assert.equal(finiteResponse.statusCode, 201);
    const finite = finiteResponse.json();
    assert.equal(finite.name, 'Launch Website');
    assert.equal(finite.kind, 'project');
    assert.equal(finite.targetDate, '2026-12-01');
    assert.equal(finite.pinned, true);
    assert.equal(finite.sortOrder, 0);

    const ongoingResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'Health',
        kind: 'ongoing',
        targetDate: '2026-12-01', // should be cleared for ongoing
      },
    });
    assert.equal(ongoingResponse.statusCode, 201);
    const ongoing = ongoingResponse.json();
    assert.equal(ongoing.name, 'Health');
    assert.equal(ongoing.kind, 'ongoing');
    assert.equal(ongoing.targetDate, undefined);
    assert.equal(ongoing.pinned, false);
    assert.equal(ongoing.sortOrder, 1);

    // Update finite project to ongoing should clear target date
    const patchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/projects/${finite.id}`,
      headers: { cookie: userCookie },
      payload: {
        kind: 'ongoing',
        pinned: false,
        sortOrder: 5,
      },
    });
    assert.equal(patchResponse.statusCode, 200);
    const patched = patchResponse.json();
    assert.equal(patched.kind, 'ongoing');
    assert.equal(patched.targetDate, undefined);
    assert.equal(patched.pinned, false);
    assert.equal(patched.sortOrder, 5);
  } finally {
    await ctx.cleanup();
  }
});

test('project completion is gated on zero open tasks and rejects ongoing areas', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`complete-test-${randomUUID()}@example.com`);

    // Create a finite project
    const projectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Q4 Taxes', kind: 'project' },
    });
    const projectId = projectResponse.json().id as string;

    // Add an open task
    const taskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: { title: 'Gather receipts', projectId },
    });
    const taskId = taskResponse.json().id as string;

    // Completing with open task should fail with 400
    const failComplete = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${projectId}/complete`,
      headers: { cookie: userCookie },
    });
    assert.equal(failComplete.statusCode, 400);
    assert.match(failComplete.json().message, /remaining open tasks/i);

    // Complete the task
    await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie: userCookie },
      payload: { completed: true },
    });

    // Now completing the project succeeds
    const successComplete = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${projectId}/complete`,
      headers: { cookie: userCookie },
    });
    assert.equal(successComplete.statusCode, 200);
    const completedProject = successComplete.json();
    assert.ok(completedProject.completedAt);
    assertIsoTimestamp(completedProject.completedAt);

    // Reopening the project clears completedAt
    const reopenResponse = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${projectId}/reopen`,
      headers: { cookie: userCookie },
    });
    assert.equal(reopenResponse.statusCode, 200);
    assert.equal(reopenResponse.json().completedAt, undefined);

    // Ongoing area completion should be rejected
    const ongoingResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Ongoing Fitness', kind: 'ongoing' },
    });
    const ongoingId = ongoingResponse.json().id as string;

    const ongoingCompleteFail = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${ongoingId}/complete`,
      headers: { cookie: userCookie },
    });
    assert.equal(ongoingCompleteFail.statusCode, 400);
    assert.match(ongoingCompleteFail.json().message, /ongoing/i);
  } finally {
    await ctx.cleanup();
  }
});

test('project archive and unarchive toggle archivedAt without altering tasks', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`archive-test-${randomUUID()}@example.com`);

    const projectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Old Client Work' },
    });
    const projectId = projectResponse.json().id as string;

    const taskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: { title: 'Invoice payment', projectId, dueDate: '2026-11-20' },
    });
    const taskId = taskResponse.json().id as string;

    // Archive project
    const archiveResponse = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${projectId}/archive`,
      headers: { cookie: userCookie },
    });
    assert.equal(archiveResponse.statusCode, 200);
    const archived = archiveResponse.json();
    assert.ok(archived.archivedAt);
    assertIsoTimestamp(archived.archivedAt);

    // Task still belongs to project and has its due date
    const taskFetch = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${taskId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(taskFetch.statusCode, 200);
    assert.equal(taskFetch.json().projectId, projectId);
    assert.equal(taskFetch.json().dueDate, '2026-11-20');

    // Writing a new task to an archived project retains the project assignment
    const newTaskToArchived = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: { title: 'Follow-up on archived client', projectId },
    });
    assert.equal(newTaskToArchived.statusCode, 201);
    assert.equal(newTaskToArchived.json().projectId, projectId);

    // Unarchive project
    const unarchiveResponse = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${projectId}/unarchive`,
      headers: { cookie: userCookie },
    });
    assert.equal(unarchiveResponse.statusCode, 200);
    assert.equal(unarchiveResponse.json().archivedAt, undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('project listing filters by status (active, completed, archived) and sorts deterministically', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`filter-test-${randomUUID()}@example.com`);

    // Pinned active project
    await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Pinned Project', pinned: true },
    });

    // Unpinned active project
    const activeRes = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Active Project', pinned: false },
    });
    const _activeId = activeRes.json().id as string;

    // Completed project
    const completedRes = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Completed Project' },
    });
    const completedId = completedRes.json().id as string;
    await ctx.app.inject({
      method: 'POST',
      url: `/projects/${completedId}/complete`,
      headers: { cookie: userCookie },
    });

    // Archived project
    const archivedRes = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Archived Project' },
    });
    const archivedId = archivedRes.json().id as string;
    await ctx.app.inject({
      method: 'POST',
      url: `/projects/${archivedId}/archive`,
      headers: { cookie: userCookie },
    });

    // Default GET /projects: non-archived (pinned, active, completed)
    const defaultList = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie: userCookie },
    });
    assert.equal(defaultList.statusCode, 200);
    const defaultItems = defaultList.json();
    assert.equal(defaultItems.length, 3);
    assert.equal(defaultItems[0].name, 'Pinned Project'); // pinned is first!

    // Filter ?status=active
    const activeList = await ctx.app.inject({
      method: 'GET',
      url: '/projects?status=active',
      headers: { cookie: userCookie },
    });
    assert.equal(activeList.statusCode, 200);
    const activeItems = activeList.json();
    assert.equal(activeItems.length, 2);
    assert.deepEqual(
      activeItems.map((p: { name: string }) => p.name),
      ['Pinned Project', 'Active Project'],
    );

    // Filter ?status=completed
    const completedList = await ctx.app.inject({
      method: 'GET',
      url: '/projects?status=completed',
      headers: { cookie: userCookie },
    });
    assert.equal(completedList.statusCode, 200);
    const completedItems = completedList.json();
    assert.equal(completedItems.length, 1);
    assert.equal(completedItems[0].name, 'Completed Project');

    // Filter ?status=archived
    const archivedList = await ctx.app.inject({
      method: 'GET',
      url: '/projects?status=archived',
      headers: { cookie: userCookie },
    });
    assert.equal(archivedList.statusCode, 200);
    const archivedItems = archivedList.json();
    assert.equal(archivedItems.length, 1);
    assert.equal(archivedItems[0].name, 'Archived Project');
  } finally {
    await ctx.cleanup();
  }
});

test('project deletion handles task preservation (keepTasks) and cascading soft-delete', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`delete-test-${randomUUID()}@example.com`);

    // Project 1: Delete keepTasks = true (default)
    const p1Res = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Project to Unlink' },
    });
    const p1Id = p1Res.json().id as string;

    const t1Res = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: { title: 'Keep this task', projectId: p1Id },
    });
    const t1Id = t1Res.json().id as string;

    const delete1Res = await ctx.app.inject({
      method: 'DELETE',
      url: `/projects/${p1Id}`,
      headers: { cookie: userCookie },
    });
    assert.equal(delete1Res.statusCode, 200);
    assert.equal(delete1Res.json().success, true);

    // Task 1 still exists but projectId is undefined (unlinked)
    const t1Fetch = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${t1Id}`,
      headers: { cookie: userCookie },
    });
    assert.equal(t1Fetch.statusCode, 200);
    assert.equal(t1Fetch.json().projectId, undefined);

    // Project 1 is gone
    const p1Fetch = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${p1Id}`,
      headers: { cookie: userCookie },
    });
    assert.equal(p1Fetch.statusCode, 404);

    // Project 2: Delete keepTasks = false (soft-delete tasks)
    const p2Res = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Project to Cascade' },
    });
    const p2Id = p2Res.json().id as string;

    const t2Res = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: { title: 'Cascade delete this task', projectId: p2Id },
    });
    const t2Id = t2Res.json().id as string;

    const delete2Res = await ctx.app.inject({
      method: 'DELETE',
      url: `/projects/${p2Id}?keepTasks=false`,
      headers: { cookie: userCookie },
    });
    assert.equal(delete2Res.statusCode, 200);

    // Task 2 was soft-deleted (GET /tasks/:id returns 404 for soft-deleted tasks)
    const t2Fetch = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${t2Id}`,
      headers: { cookie: userCookie },
    });
    assert.equal(t2Fetch.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('project PATCH accepts null description/color to clear fields and keeps ongoing areas dateless', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`patch-null-${randomUUID()}@example.com`);

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: {
        name: 'Clearable project',
        description: 'Some context',
        color: 'teal',
      },
    });
    assert.equal(created.statusCode, 201);
    const projectId = created.json().id as string;
    assert.equal(created.json().description, 'Some context');
    assert.equal(created.json().color, 'teal');

    const cleared = await ctx.app.inject({
      method: 'PATCH',
      url: `/projects/${projectId}`,
      headers: { cookie: userCookie },
      payload: { description: null, color: null },
    });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.json().description, undefined);
    assert.equal(cleared.json().color, undefined);

    const ongoing = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Ongoing without dates', kind: 'ongoing' },
    });
    const ongoingId = ongoing.json().id as string;

    const withDate = await ctx.app.inject({
      method: 'PATCH',
      url: `/projects/${ongoingId}`,
      headers: { cookie: userCookie },
      payload: { targetDate: '2026-12-24' },
    });
    assert.equal(withDate.statusCode, 200);
    assert.equal(withDate.json().targetDate, undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('archived-status tasks do not count as open and do not block project completion', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`archived-status-${randomUUID()}@example.com`);

    const projectResponse = await ctx.app.inject({
      method: 'POST',
      url: '/projects',
      headers: { cookie: userCookie },
      payload: { name: 'Hidden task project', kind: 'project' },
    });
    const projectId = projectResponse.json().id as string;

    const taskResponse = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: userCookie },
      payload: { title: 'Hidden from task views', projectId },
    });
    const taskId = taskResponse.json().id as string;

    const archived = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie: userCookie },
      payload: { status: 'archived' },
    });
    assert.equal(archived.statusCode, 200);

    const reloaded = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { cookie: userCookie },
    });
    assert.equal(reloaded.json().openTaskCount, 0);
    assert.equal(reloaded.json().taskCount, 0);

    const completed = await ctx.app.inject({
      method: 'POST',
      url: `/projects/${projectId}/complete`,
      headers: { cookie: userCookie },
    });
    assert.equal(completed.statusCode, 200);
    assert.ok(completed.json().completedAt);
  } finally {
    await ctx.cleanup();
  }
});

test('projects can be reordered and foreign or duplicate ids are rejected', async () => {
  const ctx = await createAuthedApp();

  try {
    const userCookie = await signUpAndGetCookie(`reorder-${randomUUID()}@example.com`);
    const otherCookie = await signUpAndGetCookie(`reorder-other-${randomUUID()}@example.com`);

    const make = async (name: string, cookie: string) => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/projects',
        headers: { cookie },
        payload: { name },
      });
      assert.equal(response.statusCode, 201);
      return response.json().id as string;
    };

    const first = await make('First', userCookie);
    const second = await make('Second', userCookie);
    const foreign = await make('Foreign', otherCookie);

    const invalid = await ctx.app.inject({
      method: 'PATCH',
      url: '/projects/reorder',
      headers: { cookie: userCookie },
      payload: { ids: [first, foreign] },
    });
    assert.equal(invalid.statusCode, 400);

    const duplicate = await ctx.app.inject({
      method: 'PATCH',
      url: '/projects/reorder',
      headers: { cookie: userCookie },
      payload: { ids: [first, first] },
    });
    assert.equal(duplicate.statusCode, 400);

    const reordered = await ctx.app.inject({
      method: 'PATCH',
      url: '/projects/reorder',
      headers: { cookie: userCookie },
      payload: { ids: [second, first] },
    });
    assert.equal(reordered.statusCode, 200);
    const byId = new Map(
      (reordered.json() as Array<{ id: string; sortOrder: number }>).map((p) => [
        p.id,
        p.sortOrder,
      ]),
    );
    assert.equal(byId.get(second), 0);
    assert.equal(byId.get(first), 1);
  } finally {
    await ctx.cleanup();
  }
});
