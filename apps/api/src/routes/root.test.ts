import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function createApp() {
  const dbFile = join(tmpdir(), `yotara-root-test-${randomUUID()}.db`);
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

test('GET / returns API metadata', async () => {
  const ctx = await createApp();

  try {
    const response = await ctx.app.inject({ method: 'GET', url: '/' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.name, 'Yotara API');
    assert.equal(typeof body.version, 'string');
    assert.ok(body.version.length > 0);
  } finally {
    await ctx.cleanup();
  }
});

test('GET / works without authentication', async () => {
  const ctx = await createApp();

  try {
    const response = await ctx.app.inject({ method: 'GET', url: '/' });
    assert.equal(response.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});

test('POST / returns 404', async () => {
  const ctx = await createApp();

  try {
    const response = await ctx.app.inject({ method: 'POST', url: '/' });
    assert.equal(response.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});
