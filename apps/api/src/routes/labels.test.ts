import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { labels } from '../db/schema.js';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-labels-test-${randomUUID()}.db`);
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

test('labels store ISO timestamps and update their text rows consistently', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`labels-${randomUUID()}@example.com`);

    const createResponse = await ctx.app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: {
        name: 'Focus',
        color: '#82d7a9',
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json();
    assert.equal(created.name, 'Focus');
    assert.equal(created.color, '#82d7a9');
    assertIsoTimestamp(created.createdAt);
    assertIsoTimestamp(created.updatedAt);

    const { db } = await import('../db/client.js');
    const [storedLabel] = await db
      .select({
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt,
      })
      .from(labels)
      .where(eq(labels.id, created.id))
      .limit(1);
    assert.ok(storedLabel);
    assertIsoTimestamp(storedLabel.createdAt);
    assertIsoTimestamp(storedLabel.updatedAt);

    const updateResponse = await ctx.app.inject({
      method: 'PATCH',
      url: `/labels/${created.id}`,
      headers: { cookie },
      payload: {
        name: 'Deep Focus',
      },
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().name, 'Deep Focus');
    assertIsoTimestamp(updateResponse.json().createdAt);
    assertIsoTimestamp(updateResponse.json().updatedAt);

    const [updatedLabel] = await db
      .select({
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt,
      })
      .from(labels)
      .where(eq(labels.id, created.id))
      .limit(1);
    assert.ok(updatedLabel);
    assertIsoTimestamp(updatedLabel.createdAt);
    assertIsoTimestamp(updatedLabel.updatedAt);
  } finally {
    await ctx.cleanup();
  }
});
