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
  const previousNodeEnv = process.env['NODE_ENV'];

  process.env['NODE_ENV'] = 'test';
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
          if (previousNodeEnv === undefined) {
            delete process.env['NODE_ENV'];
          } else {
            process.env['NODE_ENV'] = previousNodeEnv;
          }
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

test('PATCH /me seeds the seven starter projects and labels on the onboarding transition', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`seed-${randomUUID()}@example.com`);

    // Before onboarding completes, a profile save must not seed anything.
    const preOnboarding = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal' },
    });
    assert.equal(preOnboarding.statusCode, 200);

    const { db } = await import('../db/client.js');
    const { projects, labels } = await import('../db/schema.js');
    const { and, eq, sql } = await import('drizzle-orm');

    const [preCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.ownerId, preOnboarding.json().user.id));
    assert.equal(preCount.value, 0, 'Seeding waits for the onboarding transition');

    const patchResponse = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { onboardingCompleted: true },
    });

    assert.equal(patchResponse.statusCode, 200);
    const userId = patchResponse.json().user.id;
    assertIsoTimestamp(patchResponse.json().user.createdAt);
    assertIsoTimestamp(patchResponse.json().user.updatedAt);

    // Verify seeding directly in the DB. GET /projects no longer seeds on read,
    // so a regression in the PATCH handler must show up here.
    const [projectCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.ownerId, userId));
    assert.equal(projectCount.value, 7, 'PATCH should seed the seven non-Inbox projects');

    const [inboxCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.name, 'Inbox')));
    assert.equal(inboxCount.value, 0, 'Inbox is a view, not a seeded project');

    const [labelCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(labels)
      .where(eq(labels.userId, userId));
    assert.ok(labelCount.value >= 6, 'PATCH should seed the six default labels');

    // Route-level assertions (these verify the full request/response chain.)
    const projectsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    assert.equal(projectsResponse.statusCode, 200);
    const projectsList = projectsResponse.json();
    assert.equal(projectsList.length, 7);
    assert.ok(!projectsList.some((p: { name: string }) => p.name === 'Inbox'));
    assert.ok(projectsList.some((p: { name: string }) => p.name === 'Work'));
    assert.ok(projectsList.some((p: { name: string }) => p.name === 'Side Projects'));

    const labelsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.equal(labelsResponse.statusCode, 200);
    const labelsList = labelsResponse.json();
    assert.ok(labelsList.length >= 6);
    assert.ok(labelsList.some((l: { name: string }) => l.name === 'Urgent'));
    assert.ok(labelsList.some((l: { name: string }) => l.name === 'Errands'));
    assert.ok(labelsList.some((l: { name: string }) => l.name === 'Someday'));

    // Rename and remove a starter, then save the profile again. Repeat saves must
    // neither recreate a removed default nor resurrect a renamed one.
    await db
      .update(projects)
      .set({ name: 'Renamed Work' })
      .where(and(eq(projects.ownerId, userId), eq(projects.name, 'Work')));
    await db
      .delete(projects)
      .where(and(eq(projects.ownerId, userId), eq(projects.name, 'Learning')));

    const patchRepeat = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal', onboardingCompleted: true },
    });
    assert.equal(patchRepeat.statusCode, 200);

    const projectsAfterRepeat = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    assert.equal(projectsAfterRepeat.statusCode, 200);
    const namesAfterRepeat = projectsAfterRepeat.json().map((p: { name: string }) => p.name);
    assert.equal(namesAfterRepeat.length, 6, 'Repeat saves must not recreate defaults');
    assert.ok(namesAfterRepeat.includes('Renamed Work'));
    assert.ok(!namesAfterRepeat.includes('Work'));
    assert.ok(!namesAfterRepeat.includes('Learning'));
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me can retry onboarding after starter label seeding fails', async () => {
  const ctx = await createAuthedApp();

  try {
    const email = `seed-retry-${randomUUID()}@example.com`;
    const cookie = await signUpAndGetCookie(email);

    const { db, sqlite } = await import('../db/client.js');
    const { labels, projects, users } = await import('../db/schema.js');
    const { eq, sql } = await import('drizzle-orm');

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    assert.ok(user);

    // Projects seed first, then labels. Fail the second seed to verify the
    // whole completion is transactional: no partial content is left behind
    // and the completion marker is not persisted, so the retry can finish
    // provisioning without duplicating anything.
    sqlite.exec(`
      CREATE TRIGGER fail_starter_labels
      BEFORE INSERT ON labels
      WHEN NEW.user_id = '${user.id}'
      BEGIN
        SELECT RAISE(ABORT, 'forced starter label failure');
      END;
    `);

    try {
      const failed = await ctx.app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { cookie },
        payload: { workspaceMode: 'personal', onboardingCompleted: true },
      });
      assert.equal(failed.statusCode, 500);

      const profileAfterFailure = await ctx.app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie },
      });
      assert.equal(profileAfterFailure.statusCode, 200);
      assert.equal(
        profileAfterFailure.json().user.onboardingCompleted,
        false,
        'A failed seed must leave onboarding retryable',
      );

      const [projectCountAfterFailure] = await db
        .select({ value: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.ownerId, user.id));
      assert.equal(projectCountAfterFailure.value, 0, 'The transaction rolls the projects back');

      const [labelCountAfterFailure] = await db
        .select({ value: sql<number>`count(*)` })
        .from(labels)
        .where(eq(labels.userId, user.id));
      assert.equal(labelCountAfterFailure.value, 0);
    } finally {
      sqlite.exec('DROP TRIGGER IF EXISTS fail_starter_labels');
    }

    const retry = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal', onboardingCompleted: true },
    });
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.json().user.onboardingCompleted, true);

    const [projectCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.ownerId, user.id));
    assert.equal(projectCount.value, 7, 'Retry must not duplicate seeded projects');

    const [labelCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(labels)
      .where(eq(labels.userId, user.id));
    assert.ok(labelCount.value >= 6, 'Retry should finish seeding the default labels');
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me seeds exactly the supplied starter content', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`starter-subset-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: {
        workspaceMode: 'personal',
        onboardingCompleted: true,
        starterContent: {
          projects: [
            { name: 'Work', description: 'Custom work', color: 'teal' },
            { name: 'Garden' },
          ],
          labels: [{ name: 'Deep Work', color: '#123456', icon: 'leaf' }, { name: 'Later' }],
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.onboardingCompleted, true);

    const projectsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    assert.equal(projectsResponse.statusCode, 200);
    const projectsList = projectsResponse.json() as Array<{
      name: string;
      description: string | null;
      color: string | null;
    }>;
    assert.deepEqual(projectsList.map((project) => project.name).sort(), ['Garden', 'Work']);
    const work = projectsList.find((project) => project.name === 'Work');
    assert.equal(work?.description, 'Custom work');
    assert.equal(work?.color, 'teal');
    const garden = projectsList.find((project) => project.name === 'Garden');
    assert.equal(garden?.description ?? null, null);
    assert.equal(garden?.color ?? null, null);

    const labelsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.equal(labelsResponse.statusCode, 200);
    const labelsList = labelsResponse.json() as Array<{
      name: string;
      color: string;
      icon: string;
    }>;
    assert.deepEqual(labelsList.map((label) => label.name).sort(), ['Deep Work', 'Later']);
    const deepWork = labelsList.find((label) => label.name === 'Deep Work');
    assert.equal(deepWork?.color, '#123456');
    assert.equal(deepWork?.icon, 'leaf');
    const later = labelsList.find((label) => label.name === 'Later');
    assert.ok(later?.color);
    assert.equal(later?.icon, 'tag');
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me with empty starter content seeds nothing and completes onboarding', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`starter-empty-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: {
        workspaceMode: 'personal',
        onboardingCompleted: true,
        starterContent: { projects: [], labels: [] },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().user.onboardingCompleted, true);

    const projectsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    assert.deepEqual(projectsResponse.json(), []);

    const labelsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    assert.deepEqual(labelsResponse.json(), []);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me rejects invalid starter content without seeding anything', async () => {
  const ctx = await createAuthedApp();

  try {
    const email = `starter-invalid-${randomUUID()}@example.com`;
    const cookie = await signUpAndGetCookie(email);

    const invalidPayloads = [
      {
        projects: [{ name: 'Work' }, { name: 'work' }],
        labels: [],
      },
      { projects: [{ name: '   ' }], labels: [] },
      { projects: [{ name: 'X', color: 'neon' }], labels: [] },
      { projects: [], labels: [{ name: 'Bad color', color: 'red' }] },
      { projects: [], labels: [{ name: 'Bad icon', icon: 'sparkles' }] },
      {
        projects: Array.from({ length: 51 }, (_, index) => ({ name: `Project ${index}` })),
        labels: [],
      },
    ];

    for (const starterContent of invalidPayloads) {
      const response = await ctx.app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { cookie },
        payload: { workspaceMode: 'personal', onboardingCompleted: true, starterContent },
      });
      assert.equal(response.statusCode, 400, JSON.stringify(starterContent));
    }

    const profile = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    assert.equal(profile.json().user.onboardingCompleted, false);

    const { db } = await import('../db/client.js');
    const { labels, projects } = await import('../db/schema.js');
    const { eq, sql } = await import('drizzle-orm');

    const [projectCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.ownerId, profile.json().user.id));
    assert.equal(projectCount.value, 0);

    const [labelCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(labels)
      .where(eq(labels.userId, profile.json().user.id));
    assert.equal(labelCount.value, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me ignores starter content for a team workspace', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`starter-team-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: {
        workspaceMode: 'team',
        onboardingCompleted: true,
        starterContent: { projects: [{ name: 'Should Not Seed' }], labels: [] },
      },
    });

    assert.equal(response.statusCode, 200);

    const profile = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    assert.equal(profile.json().user.workspaceMode, 'team');
    assert.equal(profile.json().user.onboardingCompleted, true);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me ignores starter content after onboarding is complete', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`starter-late-${randomUUID()}@example.com`);

    const first = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { workspaceMode: 'personal', onboardingCompleted: true },
    });
    assert.equal(first.statusCode, 200);

    const second = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: {
        starterContent: {
          projects: [{ name: 'Extra Project' }],
          labels: [{ name: 'Extra Label' }],
        },
      },
    });
    assert.equal(second.statusCode, 200);

    const projectsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/projects',
      headers: { cookie },
    });
    const projectNames = (projectsResponse.json() as Array<{ name: string }>).map(
      (project) => project.name,
    );
    assert.equal(projectNames.length, 7);
    assert.ok(!projectNames.includes('Extra Project'));

    const labelsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    const labelNames = (labelsResponse.json() as Array<{ name: string }>).map(
      (label) => label.name,
    );
    assert.equal(labelNames.length, 6);
    assert.ok(!labelNames.includes('Extra Label'));
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me stores a validated profile photo and clears it with null', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`avatar-${randomUUID()}@example.com`);
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

    const saved = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { image },
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json().user.image, image);

    const me = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    assert.equal(me.json().user.image, image);

    const cleared = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { cookie },
      payload: { image: null },
    });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.json().user.image, null);
  } finally {
    await ctx.cleanup();
  }
});

test('PATCH /me rejects invalid profile photos and leaves the stored value unchanged', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`avatar-invalid-${randomUUID()}@example.com`);
    const jpegBytesAsPng = 'data:image/png;base64,/9j/4AAQSkZJRg==';
    const oversizedPng =
      'data:image/png;base64,' +
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(128 * 1024),
      ]).toString('base64');

    const invalidImages = [
      'https://example.com/avatar.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'data:image/png;base64,!!!!',
      jpegBytesAsPng,
      oversizedPng,
    ];

    for (const image of invalidImages) {
      const response = await ctx.app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { cookie },
        payload: { image },
      });
      assert.equal(response.statusCode, 400, image.slice(0, 40));
    }

    const me = await ctx.app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    assert.equal(me.json().user.image, null);
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

test('GET /me/counts returns 401 without authentication', async () => {
  const ctx = await createAuthedApp();

  try {
    const response = await ctx.app.inject({ method: 'GET', url: '/me/counts' });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().message, 'Unauthorized');
  } finally {
    await ctx.cleanup();
  }
});

test('GET /me/counts returns zero counts for new user', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`counts-zero-${randomUUID()}@example.com`);

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/me/counts',
      headers: { cookie },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(typeof body.tasks, 'number');
    assert.equal(typeof body.projects, 'number');
    assert.equal(typeof body.labels, 'number');
    assert.equal(body.tasks, 0);
    assert.equal(body.projects, 0);
    assert.equal(body.labels, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('GET /me/counts includes completed tasks in count', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`counts-complete-${randomUUID()}@example.com`);

    // Create an active task
    const activeTask = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Active task' },
    });
    assert.equal(activeTask.statusCode, 201);

    // Create and complete a second task
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: { title: 'Completed task' },
    });
    assert.equal(created.statusCode, 201);
    const taskId = created.json().id;

    await ctx.app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: { completed: true },
    });

    // Counts should include both tasks (active + completed)
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/me/counts',
      headers: { cookie },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().tasks, 2, 'counts should include completed tasks');
  } finally {
    await ctx.cleanup();
  }
});
