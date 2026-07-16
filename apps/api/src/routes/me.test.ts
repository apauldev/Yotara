import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

// Use a shared temp database per process (same pattern as auth.test.ts).
// Module-level singleton in db/client.ts means setting DATABASE_URL per-test will
// be ignored after the first import — the singleton always points to whichever DB
// was loaded first. Using test-db.ts avoids this by setting DATABASE_URL once
// before any module imports resolve.
import '../db/test-db.js';

async function createAuthedApp() {
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

test('GET /me returns 401 without authentication', async () => {
  const ctx = await createAuthedApp();

  try {
    const response = await ctx.app.inject({ method: 'GET', url: '/me' });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().message, 'Unauthorized');
  } finally {
    await ctx.cleanup();
  }
});

test('GET /me returns user profile after sign-up', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`profile-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(typeof body.user.id, 'string');
    assert.equal(typeof body.user.email, 'string');
    assert.equal(typeof body.user.name, 'string');
    assert.equal(body.user.emailVerified, false);
    assert.equal(body.user.onboardingCompleted, false);
    assert.equal(body.user.archiveAutoDelete, true);
    assert.equal(body.user.captureBehavior, 'quick');
    assertIsoTimestamp(body.user.createdAt);
    assertIsoTimestamp(body.user.updatedAt);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me sets workspaceMode', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`workspace-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.workspaceMode, 'personal');
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me sets onboardingCompleted', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`onboarding-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { onboardingCompleted: true },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.onboardingCompleted, true);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me sets archiveAutoDelete', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`archive-auto-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { archiveAutoDelete: false },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.archiveAutoDelete, false);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me toggles captureBehavior', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`capture-${randomUUID()}@example.com`);

    const setCapture = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { captureBehavior: 'capture' },
    });
    assert.equal(setCapture.statusCode, 200);
    assert.equal(setCapture.json().user.captureBehavior, 'capture');

    const setQuick = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { captureBehavior: 'quick' },
    });
    assert.equal(setQuick.statusCode, 200);
    assert.equal(setQuick.json().user.captureBehavior, 'quick');
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me seeds default projects and labels when onboarding is completed', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`seed-${randomUUID()}@example.com`);

    const patchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal', onboardingCompleted: true },
    });

    assert.equal(patchResponse.statusCode, 200);
    const userId = patchResponse.json().user.id;
    assertIsoTimestamp(patchResponse.json().user.createdAt);
    assertIsoTimestamp(patchResponse.json().user.updatedAt);

    // Verify seeding directly in the DB — GET /projects and GET /labels
    // side-effect seed on read, so they'd mask a regression in the PATCH handler.
    const { db } = await import('../db/client.js');
    const { projects, labels } = await import('../db/schema.js');
    const { eq, sql } = await import('drizzle-orm');

    const [projectCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.ownerId, userId));
    assert.ok(projectCount.value >= 8, 'PATCH should seed at least 8 projects');

    const [labelCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(labels)
      .where(eq(labels.userId, userId));
    assert.ok(labelCount.value >= 8, 'PATCH should seed at least 8 labels');

    // Route-level assertions (side-effecting — seed on read, so these don't
    // prove the PATCH seeded, but verify the full request/response chain.)
    const projectsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    assert.equal(projectsResponse.statusCode, 200);
    const projectsList = projectsResponse.json();
    assert.ok(projectsList.length >= 8);
    assert.ok(projectsList.some((p: { name: string }) => p.name === 'Inbox'));

    const labelsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.equal(labelsResponse.statusCode, 200);
    const labelsList = labelsResponse.json();
    assert.ok(labelsList.length >= 8);
    assert.ok(labelsList.some((l: { name: string }) => l.name === 'Urgent'));

    const patchIdempotent = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal', onboardingCompleted: true },
    });
    assert.equal(patchIdempotent.statusCode, 200);

    const projectsAfterSecond = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    assert.equal(projectsAfterSecond.statusCode, 200);
    const inboxCount = projectsAfterSecond
      .json()
      .filter((p: { name: string }) => p.name === 'Inbox').length;
    assert.equal(inboxCount, 1, 'Seeding should be idempotent — no duplicate projects');
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me returns 401 without authentication', async () => {
  const ctx = await createAuthedApp();

  try {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { workspaceMode: 'personal' },
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me with empty body succeeds and changes nothing', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`empty-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: {},
    });

    assert.equal(response.statusCode, 200);
    const user = response.json().user;
    assert.equal(user.workspaceMode, null);
    assert.equal(user.onboardingCompleted, false);
    assert.equal(user.archiveAutoDelete, true);
    assert.equal(user.captureBehavior, 'quick');
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me ignores unknown fields', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`unknown-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { unknownField: 'should-be-ignored' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.unknownField, undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('CORS headers are present on /me responses', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`cors-${randomUUID()}@example.com`);

    const getResponse = await ctx.app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie, origin: 'http://localhost:4200' },
    });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.headers['access-control-allow-origin'], 'http://localhost:4200');
    assert.equal(getResponse.headers['access-control-allow-credentials'], 'true');

    const patchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie, origin: 'http://localhost:4200' },
      payload: { workspaceMode: 'personal' },
    });
    assert.equal(patchResponse.statusCode, 200);
    assert.equal(patchResponse.headers['access-control-allow-origin'], 'http://localhost:4200');
    assert.equal(patchResponse.headers['access-control-allow-credentials'], 'true');
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me returns 401 without authentication', async () => {
  const ctx = await createAuthedApp();

  try {
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      payload: { password: 'anything' },
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me with wrong password returns 403', async () => {
  const ctx = await createAuthedApp();

  try {
    const email = `wrong-pass-${randomUUID()}@example.com`;
    const cookie = await signUpAndGetCookie(email);

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie },
      payload: { password: 'wrong-password' },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().message, 'Incorrect password');
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me deletes the account and invalidates its session', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`delete-${randomUUID()}@example.com`);
    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie },
      payload: { password: 'Password123!' },
    });

    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(deleted.json(), { ok: true });

    const me = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    assert.equal(me.statusCode, 401);
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me invalidates every session for the user', async () => {
  const ctx = await createAuthedApp();

  try {
    const email = `multi-session-${randomUUID()}@example.com`;
    const cookie1 = await signUpAndGetCookie(email);

    // Open a second, independent session for the same user.
    const { auth } = await import('../lib/auth.js');
    const signIn = await auth.api.signInEmail({
      body: { email, password: 'Password123!' },
      asResponse: true,
    });
    assert.equal(signIn.status, 200);
    const cookie2 = signIn.headers.get('set-cookie');
    assert.ok(cookie2);

    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie: cookie1 },
      payload: { password: 'Password123!' },
    });
    assert.equal(deleted.statusCode, 200);

    const me1 = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie1 } });
    assert.equal(me1.statusCode, 401);

    const me2 = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie2 } });
    assert.equal(me2.statusCode, 401);
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me without password body returns 400', async () => {
  const ctx = await createAuthedApp();

  try {
    const email = `no-pass-${randomUUID()}@example.com`;
    const cookie = await signUpAndGetCookie(email);

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie },
      payload: {},
    });

    assert.equal(response.statusCode, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me rejects an empty password', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`empty-pass-${randomUUID()}@example.com`);
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie },
      payload: { password: '' },
    });
    assert.equal(response.statusCode, 400);
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me rate limits repeated password failures', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`delete-limit-${randomUUID()}@example.com`);
    for (let i = 0; i < 5; i += 1) {
      const response = await ctx.app.inject({
        method: 'DELETE',
        url: '/me',
        headers: { cookie },
        payload: { password: 'wrong-password' },
      });
      assert.equal(response.statusCode, 403);
    }

    const limited = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie },
      payload: { password: 'wrong-password' },
    });
    assert.equal(limited.statusCode, 429);
  } finally {
    await ctx.cleanup();
  }
});

test('DELETE /me rate limits are per-session, not per-IP', async () => {
  const ctx = await createAuthedApp();

  try {
    const email1 = `rate-a-${randomUUID()}@example.com`;
    const email2 = `rate-b-${randomUUID()}@example.com`;
    const cookie1 = await signUpAndGetCookie(email1);
    const cookie2 = await signUpAndGetCookie(email2);

    // Exhaust rate limit for session 1
    for (let i = 0; i < 5; i += 1) {
      const response = await ctx.app.inject({
        method: 'DELETE',
        url: '/me',
        headers: { cookie: cookie1 },
        payload: { password: 'wrong-password' },
      });
      assert.equal(response.statusCode, 403);
    }

    // Session 1 should now be rate-limited
    const limited1 = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie: cookie1 },
      payload: { password: 'wrong-password' },
    });
    assert.equal(limited1.statusCode, 429);

    // Session 2 should still work (same IP, different session token)
    const session2 = await ctx.app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { cookie: cookie2 },
      payload: { password: 'wrong-password' },
    });
    assert.equal(session2.statusCode, 403, 'session 2 should not be rate-limited by session 1');
  } finally {
    await ctx.cleanup();
  }
});
