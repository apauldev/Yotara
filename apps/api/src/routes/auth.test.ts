import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

const TEST_EMAIL = 'register-login@example.com';
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Register Login User';
const TEST_ORIGIN = 'http://localhost:4200';

async function createTestApp() {
  const dbFile = join(tmpdir(), `yotara-auth-test-${randomUUID()}.db`);
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

function readCookie(response: { headers: Record<string, unknown> }) {
  const cookie = response.headers['set-cookie'];
  assert.ok(cookie);
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

test('auth routes register and login with email/password', async () => {
  const ctx = await createTestApp();

  try {
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: {
        origin: TEST_ORIGIN,
      },
      payload: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    assert.equal(registerResponse.statusCode, 200);
    assert.equal(registerResponse.headers['access-control-allow-origin'], TEST_ORIGIN);
    assert.equal(registerResponse.headers['access-control-allow-credentials'], 'true');
    const registerBody = registerResponse.json();
    assert.equal(registerBody.user.email, TEST_EMAIL);
    assert.equal(registerBody.user.name, TEST_NAME);
    const registerCookie = readCookie(registerResponse);

    const meAfterRegister = await ctx.app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        origin: TEST_ORIGIN,
        cookie: registerCookie,
      },
    });

    assert.equal(meAfterRegister.statusCode, 200);
    assert.equal(meAfterRegister.json().user.email, TEST_EMAIL);
    assert.equal(meAfterRegister.json().user.onboardingCompleted, false);

    const updateMeResponse = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: {
        origin: TEST_ORIGIN,
        cookie: registerCookie,
      },
      payload: {
        workspaceMode: 'personal',
        onboardingCompleted: true,
      },
    });

    assert.equal(updateMeResponse.statusCode, 200);
    assert.equal(updateMeResponse.json().user.workspaceMode, 'personal');
    assert.equal(updateMeResponse.json().user.onboardingCompleted, true);

    const signOutResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-out',
      headers: {
        cookie: registerCookie,
        origin: TEST_ORIGIN,
      },
    });

    assert.equal(signOutResponse.statusCode, 200);

    const loginResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: {
        origin: TEST_ORIGIN,
      },
      payload: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.headers['access-control-allow-origin'], TEST_ORIGIN);
    assert.equal(loginResponse.headers['access-control-allow-credentials'], 'true');
    const loginBody = loginResponse.json();
    assert.equal(loginBody.user.email, TEST_EMAIL);
    const loginCookie = readCookie(loginResponse);

    const meAfterLogin = await ctx.app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        origin: TEST_ORIGIN,
        cookie: loginCookie,
      },
    });

    assert.equal(meAfterLogin.statusCode, 200);
    assert.equal(meAfterLogin.json().user.email, TEST_EMAIL);
    assert.equal(meAfterLogin.json().user.workspaceMode, 'personal');
    assert.equal(meAfterLogin.json().user.onboardingCompleted, true);
  } finally {
    await ctx.cleanup();
  }
});

test('auth routes answer CORS preflight for sign-up', async () => {
  const ctx = await createTestApp();

  try {
    const response = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/auth/sign-up/email',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], TEST_ORIGIN);
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
  } finally {
    await ctx.cleanup();
  }
});

test('authenticated profile route includes CORS headers for allowed frontend origins', async () => {
  const ctx = await createTestApp();

  try {
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: {
        origin: TEST_ORIGIN,
      },
      payload: {
        email: `cors-${randomUUID()}@example.com`,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    const cookie = readCookie(registerResponse);

    const meResponse = await ctx.app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        origin: TEST_ORIGIN,
        cookie,
      },
    });

    assert.equal(meResponse.statusCode, 200);
    assert.equal(meResponse.headers['access-control-allow-origin'], TEST_ORIGIN);
    assert.equal(meResponse.headers['access-control-allow-credentials'], 'true');
  } finally {
    await ctx.cleanup();
  }
});
