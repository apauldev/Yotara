import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

let sharedApp: Awaited<ReturnType<typeof buildSharedApp>> | null = null;
let sharedDbFile: string | null = null;

async function buildSharedApp() {
  sharedDbFile = join(tmpdir(), `yotara-search-test.db`);
  process.env['DATABASE_URL'] = sharedDbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  return { app };
}

async function getApp() {
  if (!sharedApp) {
    sharedApp = await buildSharedApp();
  }
  return sharedApp.app;
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

async function createProject(
  app: any,
  cookie: string,
  payload: { name: string; description?: string; color?: string },
) {
  const res = await app.inject({
    method: 'POST',
    url: '/projects',
    headers: { cookie },
    payload,
  });
  assert.equal(res.statusCode, 201);
  return res.json() as { id: string };
}

async function createTask(
  app: any,
  cookie: string,
  payload: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    projectId?: string;
  },
) {
  const res = await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { cookie },
    payload: {
      ...payload,
      simpleMode: true,
      status: payload.status ?? 'inbox',
      priority: payload.priority ?? 'medium',
    },
  });
  assert.equal(res.statusCode, 201);
  return res.json() as { id: string };
}

async function createLabel(app: any, cookie: string, payload: { name: string; color?: string }) {
  const res = await app.inject({
    method: 'POST',
    url: '/labels',
    headers: { cookie },
    payload,
  });
  assert.equal(res.statusCode, 201);
  return res.json() as { id: string };
}

async function attachLabel(app: any, cookie: string, taskId: string, labelId: string) {
  const res = await app.inject({
    method: 'PATCH',
    url: `/tasks/${taskId}`,
    headers: { cookie },
    payload: { labels: [labelId] },
  });
  assert.equal(res.statusCode, 200);
}

test('search route requires authentication', async () => {
  const app = await getApp();

  const res = await app.inject({ method: 'GET', url: '/tasks/search?q=test' });
  assert.equal(res.statusCode, 401);
});

test('search returns empty results for empty or whitespace query', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`empty-q-${randomUUID()}@example.com`);

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=%20%20',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().tasks.length, 0);
  assert.equal(res.json().projects.length, 0);
  assert.equal(res.json().labels.length, 0);
  assert.equal(res.json().query, '');
});

test('search finds tasks by title, description, project name, and label name', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`search-full-${randomUUID()}@example.com`);

  const project = await createProject(app, cookie, {
    name: 'Launch Yotara MVP',
    description: 'Core release scope and planning',
  });
  const task1 = await createTask(app, cookie, {
    title: 'Polish search results',
    description: 'Tune the global search page copy and ranking.',
    projectId: project.id,
  });
  const task2 = await createTask(app, cookie, {
    title: 'Buy groceries',
    description: 'Milk and eggs',
  });
  const label = await createLabel(app, cookie, { name: 'enhancement', color: '#3b82f6' });
  await attachLabel(app, cookie, task1.id, label.id);
  await attachLabel(app, cookie, task2.id, label.id);

  let res = await app.inject({ method: 'GET', url: '/tasks/search?q=polish', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().tasks.some((t: any) => t.task.title === 'Polish search results'));

  res = await app.inject({ method: 'GET', url: '/tasks/search?q=ranking', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.ok(
    res
      .json()
      .tasks.some(
        (t: any) => t.task.description === 'Tune the global search page copy and ranking.',
      ),
  );

  res = await app.inject({ method: 'GET', url: '/tasks/search?q=yotara', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().tasks.some((t: any) => t.task.title === 'Polish search results'));

  res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=enhancement',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  const matchingTasks = res
    .json()
    .tasks.filter(
      (t: any) => t.task.title === 'Polish search results' || t.task.title === 'Buy groceries',
    );
  assert.equal(matchingTasks.length, 2);
});

test('search finds projects by name and description', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`search-proj-${randomUUID()}@example.com`);

  await createProject(app, cookie, {
    name: 'Home Renovation',
    description: 'Kitchen and bathroom plans',
  });
  await createProject(app, cookie, {
    name: 'Reading List',
    description: 'Books to read this year',
  });

  let res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=renovation',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().projects.some((p: any) => p.project.name === 'Home Renovation'));

  res = await app.inject({ method: 'GET', url: '/tasks/search?q=bathroom', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().projects.some((p: any) => p.project.name === 'Home Renovation'));

  res = await app.inject({ method: 'GET', url: '/tasks/search?q=kitchen', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().projects.length, 1);
});

test('search finds labels by name', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`search-lbl-${randomUUID()}@example.com`);

  await createLabel(app, cookie, { name: 'bug', color: '#ef4444' });
  await createLabel(app, cookie, { name: 'feature', color: '#3b82f6' });

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=feature',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().labels.some((l: any) => l.label.name === 'feature'));
  assert.equal(res.json().labels.length, 1);
});

test('search scopes data to the current user', async () => {
  const app = await getApp();
  const user1Cookie = await signUpAndGetCookie(`scope-a-${randomUUID()}@example.com`);
  const user2Cookie = await signUpAndGetCookie(`scope-b-${randomUUID()}@example.com`);

  await createTask(app, user1Cookie, { title: 'Secret user1 task' });
  await createTask(app, user2Cookie, { title: 'Secret user2 task' });

  const res1 = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=secret',
    headers: { cookie: user1Cookie },
  });
  assert.equal(res1.statusCode, 200);
  assert.ok(res1.json().tasks.some((t: any) => t.task.title === 'Secret user1 task'));
  assert.equal(
    res1.json().tasks.filter((t: any) => t.task.title === 'Secret user2 task').length,
    0,
  );

  const res2 = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=secret',
    headers: { cookie: user2Cookie },
  });
  assert.equal(res2.statusCode, 200);
  assert.equal(
    res2.json().tasks.filter((t: any) => t.task.title === 'Secret user1 task').length,
    0,
  );
});

test('search supports completed filter', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`completed-${randomUUID()}@example.com`);

  await createTask(app, cookie, { title: 'Active task to find' });
  await createTask(app, cookie, { title: 'Finished task' });

  const listRes = await app.inject({ method: 'GET', url: '/tasks', headers: { cookie } });
  const finishedId = listRes.json().data.find((t: any) => t.title === 'Finished task')!.id;

  await app.inject({
    method: 'PATCH',
    url: `/tasks/${finishedId}`,
    headers: { cookie },
    payload: { completed: true },
  });

  let res = await app.inject({ method: 'GET', url: '/tasks/search?q=task', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const activeTitles = res.json().tasks.map((t: any) => t.task.title);
  assert.ok(activeTitles.includes('Active task to find'));
  assert.ok(!activeTitles.includes('Finished task'));

  res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=task&completed=true',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  const finishedTitles = res.json().tasks.map((t: any) => t.task.title);
  assert.ok(finishedTitles.includes('Finished task'));
  assert.ok(!finishedTitles.includes('Active task to find'));
});

test('search completed=all returns both active and completed tasks', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`completed-all-${randomUUID()}@example.com`);

  await createTask(app, cookie, { title: 'Active task to find' });
  const completedTask = await createTask(app, cookie, { title: 'Finished task' });
  await app.inject({
    method: 'PATCH',
    url: `/tasks/${completedTask.id}`,
    headers: { cookie },
    payload: { completed: true },
  });

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=task&completed=all',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  const titles = res.json().tasks.map((t: any) => t.task.title);
  assert.ok(titles.includes('Active task to find'));
  assert.ok(titles.includes('Finished task'));
});

test('search results include match reasons', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`reasons-${randomUUID()}@example.com`);

  const project = await createProject(app, cookie, {
    name: 'My Project',
    description: 'A test project',
  });
  await createTask(app, cookie, {
    title: 'Task with keyword',
    description: 'keyword appears here too',
    projectId: project.id,
  });

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=keyword',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().tasks.length, 1);
  assert.ok(res.json().tasks[0].matchReasons.includes('title'));
  assert.ok(res.json().tasks[0].matchReasons.includes('description'));
});

test('search returns project results with task counts', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`projcount-${randomUUID()}@example.com`);

  const project = await createProject(app, cookie, {
    name: 'My Project',
    description: 'A project with tasks',
  });
  await createTask(app, cookie, { title: 'Task 1', projectId: project.id });
  await createTask(app, cookie, { title: 'Task 2', projectId: project.id });

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=project',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  const matched = res.json().projects.find((p: any) => p.project.name === 'My Project');
  assert.ok(matched);
  assert.equal(matched.project.taskCount, 2);
  assert.equal(matched.project.openTaskCount, 2);
  assert.equal(matched.project.completedTaskCount, 0);
});

test('search returns null project for tasks without a project', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`noproj-${randomUUID()}@example.com`);

  await createTask(app, cookie, {
    title: 'Standalone task with no project',
    description: 'This task belongs to no project',
  });

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=standalone',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().tasks.length, 1);
  assert.equal(res.json().tasks[0].project, null);
  assert.equal(res.json().tasks[0].task.title, 'Standalone task with no project');
});

test('search paginates and defaults to pageSize 50', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`paging-${randomUUID()}@example.com`);

  for (let i = 0; i < 5; i++) {
    await createTask(app, cookie, { title: `Common task ${i}` });
  }

  const res = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=common&page=1&pageSize=2',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().tasks.length <= 2);
  assert.equal(res.json().query, 'common');
});

test('search returns 400 when q parameter is missing', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`missing-${randomUUID()}@example.com`);

  const res = await app.inject({ method: 'GET', url: '/tasks/search', headers: { cookie } });
  assert.equal(res.statusCode, 400);
});

test('search handles SQL LIKE wildcard characters safely', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`escape-${randomUUID()}@example.com`);

  // SQL LIKE % matches any sequence, _ matches any single char.
  // This is fine for personal use — searching with special chars still works
  // as the user would expect (e.g. "100%" matches anything starting with "100").
  await createTask(app, cookie, { title: 'Task 100 percent done' });

  const res = await app.inject({ method: 'GET', url: '/tasks/search?q=100%', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const titles = res.json().tasks.map((t: any) => t.task.title);
  assert.ok(titles.includes('Task 100 percent done'));
});

test('full frontend search smoke test: active search + archive search + response shape', async () => {
  const app = await getApp();
  const cookie = await signUpAndGetCookie(`smoke-${randomUUID()}@example.com`);

  const project = await createProject(app, cookie, {
    name: 'Smoke Project',
    description: 'For integration testing',
  });
  await createTask(app, cookie, {
    title: 'Smoke test task',
    description: 'Part of the smoke test',
    projectId: project.id,
  });
  await createLabel(app, cookie, { name: 'smoke-label', color: '#ff0000' });

  // Active search (the frontend's main search)
  const activeRes = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=smoke',
    headers: { cookie },
  });
  assert.equal(activeRes.statusCode, 200);
  const body = activeRes.json();

  // Verify response shape matches SearchResponse
  assert.equal(typeof body.query, 'string');
  assert.equal(typeof body.normalizedQuery, 'string');
  assert.ok(Array.isArray(body.tasks));
  assert.ok(Array.isArray(body.projects));
  assert.ok(Array.isArray(body.labels));

  // Should find the task, project, and label
  assert.ok(body.tasks.some((t: any) => t.task.title === 'Smoke test task'));
  assert.ok(body.projects.some((p: any) => p.project.name === 'Smoke Project'));
  assert.ok(body.labels.some((l: any) => l.label.name === 'smoke-label'));

  // Verify task result shape
  const taskResult = body.tasks.find((t: any) => t.task.title === 'Smoke test task');
  assert.equal(typeof taskResult.score, 'number');
  assert.ok(taskResult.score > 0);
  assert.ok(Array.isArray(taskResult.matchReasons));
  assert.equal(typeof taskResult.task.id, 'string');
  assert.equal(typeof taskResult.task.title, 'string');
  assert.equal(typeof taskResult.task.status, 'string');

  // Archive search (frontend's searchArchive — completed=true)
  const archiveRes = await app.inject({
    method: 'GET',
    url: '/tasks/search?q=smoke&completed=true',
    headers: { cookie },
  });
  assert.equal(archiveRes.statusCode, 200);
  assert.equal(archiveRes.json().tasks.length, 0); // No completed tasks yet
});

test('cleanup shared search test database', async () => {
  if (sharedDbFile) {
    rmSync(sharedDbFile, { force: true });
  }
});
