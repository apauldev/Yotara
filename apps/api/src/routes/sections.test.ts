import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-sections-test-${randomUUID()}.db`);
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

async function signUpAndGetCookie(email: string): Promise<string> {
  const { auth } = await import('../lib/auth.js');
  const response = await auth.api.signUpEmail({
    body: { email, password: 'Password123!', name: email.split('@')[0] },
    asResponse: true,
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie;
}

async function createProject(
  app: Awaited<ReturnType<typeof createAuthedApp>>['app'],
  cookie: string,
  name: string,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/projects',
    headers: { cookie },
    payload: { name },
  });
  assert.equal(response.statusCode, 201);
  return response.json().id as string;
}

async function createSection(
  app: Awaited<ReturnType<typeof createAuthedApp>>['app'],
  cookie: string,
  projectId: string,
  name: string,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: `/projects/${projectId}/sections`,
    headers: { cookie },
    payload: { name },
  });
  assert.equal(response.statusCode, 201);
  return response.json().id as string;
}

test('sections support create, rename, reorder, and list with open counts', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`sections-crud-${randomUUID()}@example.com`);
    const projectId = await createProject(ctx.app, cookie, 'Sectioned project');

    const planningId = await createSection(ctx.app, cookie, projectId, 'Planning');
    const bookingId = await createSection(ctx.app, cookie, projectId, 'Bookings');

    const task = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Draft plan', projectId, sectionId: planningId },
    });
    assert.equal(task.statusCode, 201);
    assert.equal(task.json().sectionId, planningId);

    const listed = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}/sections`,
      headers: { cookie },
    });
    assert.equal(listed.statusCode, 200);
    const sections = listed.json() as Array<{ id: string; name: string; openTaskCount: number }>;
    assert.deepEqual(
      sections.map((s) => s.name),
      ['Planning', 'Bookings'],
    );
    assert.equal(sections.find((s) => s.id === planningId)?.openTaskCount, 1);

    const renamed = await ctx.app.inject({
      method: 'PATCH',
      url: `/sections/${bookingId}`,
      headers: { cookie },
      payload: { name: 'Travel' },
    });
    assert.equal(renamed.statusCode, 200);
    assert.equal(renamed.json().name, 'Travel');

    const reordered = await ctx.app.inject({
      method: 'PATCH',
      url: '/sections/reorder',
      headers: { cookie },
      payload: { projectId, ids: [bookingId, planningId] },
    });
    assert.equal(reordered.statusCode, 200);
    const reorderedSections = reordered.json() as Array<{ id: string }>;
    assert.deepEqual(
      reorderedSections.map((s) => s.id),
      [bookingId, planningId],
    );
  } finally {
    await ctx.cleanup();
  }
});

test('deleting a section unsections its tasks without deleting them', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`sections-delete-${randomUUID()}@example.com`);
    const projectId = await createProject(ctx.app, cookie, 'Safe delete project');
    const sectionId = await createSection(ctx.app, cookie, projectId, 'Planning');

    const task = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Keep me', projectId, sectionId },
    });
    const taskId = task.json().id as string;

    const invalid = await ctx.app.inject({
      method: 'DELETE',
      url: `/sections/${sectionId}`,
      headers: { cookie: await signUpAndGetCookie(`sections-other-${randomUUID()}@example.com`) },
    });
    assert.equal(invalid.statusCode, 404);

    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: `/sections/${sectionId}`,
      headers: { cookie },
    });
    assert.equal(deleted.statusCode, 200);

    const reloaded = await ctx.app.inject({
      method: 'GET',
      url: `/tasks/${taskId}`,
      headers: { cookie },
    });
    assert.equal(reloaded.statusCode, 200);
    assert.equal(reloaded.json().sectionId, undefined);
    assert.equal(reloaded.json().projectId, projectId);

    const sections = await ctx.app.inject({
      method: 'GET',
      url: `/projects/${projectId}/sections`,
      headers: { cookie },
    });
    assert.deepEqual(sections.json(), []);
  } finally {
    await ctx.cleanup();
  }
});

test('task section assignment is validated against the owning project', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`sections-assign-${randomUUID()}@example.com`);
    const otherCookie = await signUpAndGetCookie(`sections-assign-2-${randomUUID()}@example.com`);
    const projectId = await createProject(ctx.app, cookie, 'First');
    const otherProjectId = await createProject(ctx.app, cookie, 'Second');
    const sectionId = await createSection(ctx.app, cookie, projectId, 'Planning');

    const wrongProject = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Mismatch', projectId: otherProjectId, sectionId },
    });
    assert.equal(wrongProject.statusCode, 400);

    const foreignProjectId = await createProject(ctx.app, otherCookie, 'Another');
    const foreignSection = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie: otherCookie },
      payload: { title: 'Foreign', projectId: foreignProjectId, sectionId },
    });
    assert.equal(foreignSection.statusCode, 400);

    const task = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Mover', projectId, sectionId },
    });
    const taskId = task.json().id as string;

    const moved = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: { sectionId: null },
    });
    assert.equal(moved.statusCode, 200);
    assert.equal(moved.json().sectionId, undefined);

    const back = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: { sectionId },
    });
    assert.equal(back.statusCode, 200);
    assert.equal(back.json().sectionId, sectionId);

    // Unfiled tasks cannot have a section
    const unfiledWithSection = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Invalid unfiled', projectId: null, sectionId },
    });
    assert.equal(unfiledWithSection.statusCode, 400);

    const updateToUnfiledWithSection = await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: { projectId: null, sectionId },
    });
    assert.equal(updateToUnfiledWithSection.statusCode, 400);
  } finally {
    await ctx.cleanup();
  }
});
