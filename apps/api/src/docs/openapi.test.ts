import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { getOpenApiJson } from '../scripts/export-openapi.js';

async function createTestApp() {
  const dbFile = join(tmpdir(), `yotara-openapi-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  return {
    app,
    async cleanup() {
      await app.close();
      rmSync(dbFile, { force: true });
      delete process.env['DATABASE_URL'];
      delete process.env['BETTER_AUTH_SECRET'];
      delete process.env['APP_BASE_URL'];
    },
  };
}

test('openapi endpoint exposes documented app and auth routes', async () => {
  const ctx = await createTestApp();

  try {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/docs/openapi.json',
    });

    assert.equal(response.statusCode, 200);
    const spec = response.json();

    assert.equal(spec.info.title, 'Yotara API');
    assert.equal(spec.openapi, '3.1.0');

    assert.ok(spec.paths['/']);
    assert.ok(spec.paths['/health']);
    assert.ok(spec.paths['/me']);
    assert.ok(spec.paths['/tasks']);
    assert.ok(spec.paths['/tasks/{id}']);
    assert.ok(spec.paths['/auth/sign-up/email']);
    assert.ok(spec.paths['/auth/sign-in/email']);
    assert.ok(spec.paths['/auth/sign-out']);
    assert.ok(spec.paths['/auth/session']);

    assert.deepEqual(spec.paths['/tasks'].get.security, [{ cookieAuth: [] }]);
    assert.ok(spec.components.securitySchemes.cookieAuth);
  } finally {
    await ctx.cleanup();
  }
});

test('docs ui is served from the api and export helper returns valid json', async () => {
  const ctx = await createTestApp();

  try {
    const docsResponse = await ctx.app.inject({
      method: 'GET',
      url: '/docs',
    });

    assert.equal(docsResponse.statusCode, 200);
    assert.match(String(docsResponse.headers['content-type']), /text\/html/);
    assert.match(docsResponse.body, /Swagger UI/i);

    const exported = await getOpenApiJson();
    const spec = JSON.parse(exported);

    assert.equal(spec.info.title, 'Yotara API');
    assert.ok(spec.paths['/docs/openapi.json'] === undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('openapi spec includes representative response contracts and examples', async () => {
  const ctx = await createTestApp();

  try {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/docs/openapi.json',
    });

    assert.equal(response.statusCode, 200);
    const spec = response.json();

    assert.ok(spec.paths['/tasks'].get.responses['200']);
    assert.ok(spec.paths['/tasks'].get.responses['401']);
    assert.ok(spec.paths['/tasks'].post.responses['201']);
    assert.ok(spec.paths['/tasks'].post.responses['400']);
    assert.ok(spec.paths['/tasks'].post.responses['500']);
    assert.ok(spec.paths['/tasks/{id}'].patch.responses['404']);
    assert.ok(spec.paths['/tasks/{id}'].delete.responses['404']);
    assert.ok(spec.paths['/auth/sign-in/email'].post.responses['401']);
    assert.ok(spec.paths['/auth/session'].get.responses['200']);

    assert.equal(
      spec.paths['/tasks'].post.responses['400'].content['application/json'].example.message,
      'Task title is required',
    );
    assert.equal(
      spec.paths['/auth/sign-in/email'].post.responses['401'].content['application/json'].example
        .code,
      'INVALID_CREDENTIALS',
    );
  } finally {
    await ctx.cleanup();
  }
});

test('protected endpoints use the normalized unauthorized error shape', async () => {
  const ctx = await createTestApp();

  try {
    const meResponse = await ctx.app.inject({
      method: 'GET',
      url: '/me',
    });

    assert.equal(meResponse.statusCode, 401);
    assert.deepEqual(meResponse.json(), { message: 'Unauthorized' });

    const tasksResponse = await ctx.app.inject({
      method: 'GET',
      url: '/tasks',
    });

    assert.equal(tasksResponse.statusCode, 401);
    assert.deepEqual(tasksResponse.json(), { message: 'Unauthorized' });
  } finally {
    await ctx.cleanup();
  }
});
