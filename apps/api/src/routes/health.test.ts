import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

async function createApp() {
  const dbFile = join(tmpdir(), `yotara-health-test-${randomUUID()}.db`);
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

function assertIsoTimestamp(value: unknown) {
  assert.equal(typeof value, 'string');
  assert.match(String(value), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

test('GET /health returns ok status with timestamp', async () => {
  const ctx = await createApp();

  try {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, 'ok');
    assertIsoTimestamp(body.timestamp);
  } finally {
    await ctx.cleanup();
  }
});

test('GET /health works without authentication', async () => {
  const ctx = await createApp();

  try {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});

test('POST /health returns 404', async () => {
  const ctx = await createApp();

  try {
    const response = await ctx.app.inject({ method: 'POST', url: '/health' });
    assert.equal(response.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});
