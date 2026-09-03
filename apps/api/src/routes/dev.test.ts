import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

import '../db/test-db.js';
import { consumeResetLink, storeResetLink } from '../lib/dev-reset-store.js';

const previousEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  DEV_MODE: process.env['DEV_MODE'],
  ALLOW_DEV_MODE_IN_PRODUCTION: process.env['ALLOW_DEV_MODE_IN_PRODUCTION'],
  BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'],
  APP_BASE_URL: process.env['APP_BASE_URL'],
  FRONTEND_BASE_URL: process.env['FRONTEND_BASE_URL'],
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function createApp() {
  process.env['BETTER_AUTH_SECRET'] = randomBytes(32).toString('hex');
  process.env['APP_BASE_URL'] = 'http://localhost:3000';
  const { buildApp } = await import('../server.js');
  return buildApp();
}

test('local dev reset links are retrievable once', async () => {
  process.env['NODE_ENV'] = 'development';
  process.env['DEV_MODE'] = 'true';
  delete process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];
  process.env['APP_BASE_URL'] = 'http://localhost:3000';
  process.env['FRONTEND_BASE_URL'] = 'http://localhost:4200';

  const app = await createApp();
  const email = `dev-reset-${randomUUID()}@example.com`;
  const url = 'http://localhost:4200/reset-password?token=local-token';

  try {
    storeResetLink(email, url);

    const response = await app.inject({
      method: 'GET',
      url: `/dev/reset-link?email=${encodeURIComponent(email.toUpperCase())}`,
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { url });

    const consumed = await app.inject({
      method: 'GET',
      url: `/dev/reset-link?email=${encodeURIComponent(email)}`,
    });
    assert.equal(consumed.statusCode, 404);
  } finally {
    await app.close();
    restoreEnv();
  }
});

test('remote test deployments never store or expose dev reset links', async () => {
  process.env['NODE_ENV'] = 'development';
  process.env['DEV_MODE'] = 'true';
  delete process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];
  process.env['APP_BASE_URL'] = 'https://test.example.com/api';
  process.env['FRONTEND_BASE_URL'] = 'https://test.example.com';

  const email = `remote-reset-${randomUUID()}@example.com`;
  const url = 'https://test.example.com/reset-password?token=remote-token';
  storeResetLink(email, url);
  assert.equal(consumeResetLink(email), null);

  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: `/dev/reset-link?email=${encodeURIComponent(email)}`,
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
    restoreEnv();
  }
});

test('production never stores or exposes local dev reset links', async () => {
  process.env['NODE_ENV'] = 'production';
  process.env['DEV_MODE'] = 'true';
  process.env['ALLOW_DEV_MODE_IN_PRODUCTION'] = 'true';

  const email = `prod-reset-${randomUUID()}@example.com`;
  const url = 'http://localhost:4200/reset-password?token=production-token';
  storeResetLink(email, url);
  assert.equal(consumeResetLink(email), null);

  const app = await createApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: `/dev/reset-link?email=${encodeURIComponent(email)}`,
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
    restoreEnv();
  }
});
