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

// Set lockout env vars before any module import caches login-lockout.ts
process.env['PASSWORD_LOCKOUT_ATTEMPTS'] = '3';
process.env['PASSWORD_LOCKOUT_MINUTES'] = '2';

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
    assert.equal(typeof meAfterRegister.json().user.createdAt, 'string');
    assert.match(
      meAfterRegister.json().user.createdAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    assert.match(
      meAfterRegister.json().user.updatedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

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
    assert.equal(typeof meAfterLogin.json().user.createdAt, 'string');

    const NEW_PASSWORD = 'NewPassword123!';

    const changePasswordResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: {
        origin: TEST_ORIGIN,
        cookie: loginCookie,
      },
      payload: {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
        revokeOtherSessions: true,
      },
    });

    assert.equal(changePasswordResponse.statusCode, 200);

    // Verify old password no longer works
    const loginFailResponse = await ctx.app.inject({
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

    assert.notEqual(loginFailResponse.statusCode, 200);

    // Verify new password works
    const loginSuccessResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: {
        origin: TEST_ORIGIN,
      },
      payload: {
        email: TEST_EMAIL,
        password: NEW_PASSWORD,
      },
    });

    assert.equal(loginSuccessResponse.statusCode, 200);
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

test('password lockout locks account after repeated failed login attempts', async () => {
  process.env['PASSWORD_LOCKOUT_ATTEMPTS'] = '2';
  process.env['PASSWORD_LOCKOUT_MINUTES'] = '1';

  const ctx = await createTestApp();
  const email = `lockout-${randomUUID()}@example.com`;

  try {
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Lockout Test' },
    });
    assert.equal(registerResponse.statusCode, 200);

    // First wrong password -> remainingAttempts: 1
    const firstFail = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'WrongPassword1!' },
    });
    assert.equal(firstFail.statusCode, 401);
    const firstBody = firstFail.json();
    assert.equal(firstBody.remainingAttempts, 1);
    assert.equal(typeof firstBody.message, 'string');

    // Second wrong password -> lockout, remainingAttempts: 0
    const secondFail = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'WrongPassword2!' },
    });
    assert.equal(secondFail.statusCode, 429);
    const secondBody = secondFail.json();
    assert.equal(secondBody.remainingAttempts, 0);
    assert.ok(typeof secondBody.retryAfterSeconds === 'number' && secondBody.retryAfterSeconds > 0);
    assert.ok(secondFail.headers['retry-after']);
    assert.match(secondBody.message, /locked/i);

    // Third attempt while locked -> still 429
    const thirdFail = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'WrongPassword3!' },
    });
    assert.equal(thirdFail.statusCode, 429);
    const thirdBody = thirdFail.json();
    assert.equal(thirdBody.remainingAttempts, 0);
    assert.ok(typeof thirdBody.retryAfterSeconds === 'number' && thirdBody.retryAfterSeconds > 0);

    // Correct password while locked -> still 429
    const correctWhileLocked = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(correctWhileLocked.statusCode, 429);
  } finally {
    await ctx.cleanup();
  }
});

test('locked account can log in after lockout window expires', async () => {
  process.env['PASSWORD_LOCKOUT_ATTEMPTS'] = '2';
  process.env['PASSWORD_LOCKOUT_MINUTES'] = '0.05'; // ~3s lockout window

  const ctx = await createTestApp();
  const email = `lockout-recover-${randomUUID()}@example.com`;

  try {
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Lockout Recover' },
    });
    assert.equal(registerResponse.statusCode, 200);

    // First wrong password
    await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'WrongPassword1!' },
    });

    // Second wrong password → lockout (2 attempts threshold)
    const lockoutResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'WrongPassword2!' },
    });
    assert.equal(lockoutResponse.statusCode, 429);

    // Wait for lockout to expire (3s window + 500ms buffer)
    await new Promise((resolve) => setTimeout(resolve, 3500));

    // Correct password should now succeed and clear attempts
    const successResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(successResponse.statusCode, 200);

    // After successful login, a wrong password should start fresh (remainingAttempts: 1)
    const failAfterRecovery = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'WrongAgain1!' },
    });
    assert.equal(failAfterRecovery.statusCode, 401);
    const afterRecoveryBody = failAfterRecovery.json();
    assert.equal(afterRecoveryBody.remainingAttempts, 1);
  } finally {
    await ctx.cleanup();
  }
});
