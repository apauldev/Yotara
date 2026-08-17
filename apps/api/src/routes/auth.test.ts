import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import test from 'node:test';

// Ensure the SQLite singleton uses a shared temp DB before any module imports it.
import '../db/test-db.js';

const TEST_EMAIL = 'register-login@example.com';
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Register Login User';
const TEST_ORIGIN = 'http://localhost:4200';

import { setLockoutConfig } from '../lib/login-lockout.js';

async function createTestApp() {
  const previousNodeEnv = process.env['NODE_ENV'];

  process.env['NODE_ENV'] = 'test';
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  return {
    app,
    async cleanup() {
      // Clear email rate-limit state so tests don't hit the IP cap
      try {
        const { sqlite } = await import('../db/client.js');
        sqlite.prepare('DELETE FROM email_sends').run();
      } catch {
        // best-effort: db might already be closed
      }
      await app.close();
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
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

test('config endpoint exposes requireEmailVerification from env', async () => {
  const ctx = await createTestApp();

  try {
    // createTestApp sets NODE_ENV=test; flag unset → false.
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/config',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().requireEmailVerification, false);

    // With the override flag, verification is required even in test env.
    const previousFlag = process.env['REQUIRE_EMAIL_VERIFICATION'];
    process.env['REQUIRE_EMAIL_VERIFICATION'] = 'true';
    try {
      const { buildApp } = await import('../server.js');
      const overrideApp = await buildApp();
      const overrideResponse = await overrideApp.inject({
        method: 'GET',
        url: '/config',
      });
      assert.equal(overrideResponse.statusCode, 200);
      assert.equal(overrideResponse.json().requireEmailVerification, true);
      await overrideApp.close();
    } finally {
      if (previousFlag === undefined) {
        delete process.env['REQUIRE_EMAIL_VERIFICATION'];
      } else {
        process.env['REQUIRE_EMAIL_VERIFICATION'] = previousFlag;
      }
    }
  } finally {
    await ctx.cleanup();
  }
});

test('verification resend is rate-limited without revealing account existence', async () => {
  const ctx = await createTestApp();
  const email = `resend-${randomUUID()}@example.com`;

  try {
    const firstResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/send-verification-email',
      headers: { origin: TEST_ORIGIN },
      payload: { email },
    });
    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.json().status, true);

    const secondResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/send-verification-email',
      headers: { origin: TEST_ORIGIN },
      payload: { email },
    });
    assert.equal(secondResponse.statusCode, 429);
    assert.equal(secondResponse.headers['retry-after'] !== undefined, true);
    assert.equal(secondResponse.json().retryAfterSeconds > 1500, true);
    assert.match(secondResponse.json().message, /Too many verify requests/);
  } finally {
    await ctx.cleanup();
  }
});

test('honeypot signup triggers IP ban and creates no user', async () => {
  const ctx = await createTestApp();

  try {
    const { isIpBanned } = await import('../lib/blocked-ips.js');

    // Bot fills the hidden website field → fake success, no user created.
    const honeypotResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: {
        email: `honeypot-${randomUUID()}@example.com`,
        password: TEST_PASSWORD,
        name: 'Bot',
        website: 'http://spam.example.com',
      },
    });
    assert.equal(honeypotResponse.statusCode, 200, 'fake success so bots cannot detect the trap');

    // The IP is now banned → subsequent auth requests from it are 403.
    const bannedResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: {
        email: `second-${randomUUID()}@example.com`,
        password: TEST_PASSWORD,
        name: 'Bot 2',
      },
    });
    assert.equal(bannedResponse.statusCode, 403);
    assert.equal(isIpBanned('127.0.0.1'), true);
  } finally {
    // Remove the ban so it doesn't leak into other tests sharing the DB.
    const { sqlite } = await import('../db/client.js');
    sqlite.prepare(`DELETE FROM blocked_ips WHERE ip = '127.0.0.1'`).run();
    await ctx.cleanup();
  }
});

test('direct clients cannot ban a spoofed forwarded IP', async () => {
  const ctx = await createTestApp();
  const spoofedIp = '203.0.113.99';

  try {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      remoteAddress: '198.51.100.10',
      headers: {
        origin: TEST_ORIGIN,
        'x-forwarded-for': spoofedIp,
      },
      payload: {
        email: `spoof-${randomUUID()}@example.com`,
        password: TEST_PASSWORD,
        name: 'Spoofed Bot',
        website: 'http://spam.example.com',
      },
    });
    assert.equal(response.statusCode, 200);

    const { isIpBanned } = await import('../lib/blocked-ips.js');
    assert.equal(isIpBanned(spoofedIp), false);
    assert.equal(isIpBanned('198.51.100.10'), true);
  } finally {
    const { sqlite } = await import('../db/client.js');
    sqlite.prepare(`DELETE FROM blocked_ips WHERE ip IN ('198.51.100.10', ?)`).run(spoofedIp);
    await ctx.cleanup();
  }
});

test('dev mode flips the require-email flag and bypasses rate limit, lockout, and IP ban', async () => {
  const ctx = await createTestApp();
  const previousDevMode = process.env['DEV_MODE'];

  try {
    process.env['DEV_MODE'] = 'true';

    // The runtime flag is flipped off even if REQUIRE_EMAIL_VERIFICATION
    // would otherwise force it on (it is unset here; the unit-level flip is
    // covered in dev-mode.test.ts).
    const configResponse = await ctx.app.inject({ method: 'GET', url: '/config' });
    assert.equal(configResponse.statusCode, 200);
    assert.equal(configResponse.json().requireEmailVerification, false);
    assert.equal(configResponse.json().devMode, true);

    // Email rate limit bypassed: two verification resends for the same email
    // both succeed (normally the second is a 429 from the 30-min cooldown).
    const resendEmail = `devmode-resend-${randomUUID()}@example.com`;
    const firstResend = await ctx.app.inject({
      method: 'POST',
      url: '/auth/send-verification-email',
      headers: { origin: TEST_ORIGIN },
      payload: { email: resendEmail },
    });
    const secondResend = await ctx.app.inject({
      method: 'POST',
      url: '/auth/send-verification-email',
      headers: { origin: TEST_ORIGIN },
      payload: { email: resendEmail },
    });
    assert.equal(firstResend.statusCode, 200);
    assert.equal(secondResend.statusCode, 200);

    // Lockout bypassed: repeated wrong passwords never lock (no 429), and the
    // response is a plain 401 without attempt-counting noise.
    const lockoutEmail = `devmode-lockout-${randomUUID()}@example.com`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const signIn = await ctx.app.inject({
        method: 'POST',
        url: '/auth/sign-in/email',
        headers: { origin: TEST_ORIGIN },
        payload: { email: lockoutEmail, password: 'WrongPassword1!' },
      });
      assert.equal(signIn.statusCode, 401, `attempt ${attempt + 1} should stay 401`);
      assert.equal(signIn.json().message, 'Invalid email or password.');
    }

    // IP ban bypassed: a banned IP can still reach auth endpoints.
    const { banIp } = await import('../lib/blocked-ips.js');
    banIp('127.0.0.1');
    const { sqlite } = await import('../db/client.js');
    const banRow = sqlite
      .prepare(`SELECT blocked_until FROM blocked_ips WHERE ip = '127.0.0.1'`)
      .get() as { blocked_until: number } | undefined;
    assert.ok(banRow, 'ban is recorded even in dev mode');
    const bannedSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: {
        email: `devmode-ban-${randomUUID()}@example.com`,
        password: TEST_PASSWORD,
        name: 'Dev Mode User',
      },
    });
    assert.equal(bannedSignUp.statusCode, 200, 'banned IP is not blocked in dev mode');
  } finally {
    if (previousDevMode === undefined) {
      delete process.env['DEV_MODE'];
    } else {
      process.env['DEV_MODE'] = previousDevMode;
    }
    // Remove the ban so it doesn't leak into other tests sharing the DB.
    const { sqlite } = await import('../db/client.js');
    sqlite.prepare(`DELETE FROM blocked_ips WHERE ip = '127.0.0.1'`).run();
    await ctx.cleanup();
  }
});

test('verification-required signup marks password setup as required', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const scriptPath = fileURLToPath(new URL('./password-setup-signup.script.ts', import.meta.url));
  const output = execFileSync(process.execPath, ['--import', 'tsx', scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, REQUIRE_EMAIL_VERIFICATION: 'true', NODE_ENV: 'test' },
  });
  assert.ok(output.includes('PASSWORD_SETUP_REQUIRED:1'), `expected setup flag, got:\n${output}`);
});

test('unverified sign-in returns EMAIL_NOT_VERIFIED without burning lockout', async () => {
  // The verification gating is read at module load (env-at-boot contract), so
  // this scenario must run in a fresh process with the flag set before import.
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const scriptPath = fileURLToPath(new URL('./unverified-signin.script.ts', import.meta.url));

  try {
    const output = execFileSync(process.execPath, ['--import', 'tsx', scriptPath], {
      encoding: 'utf8',
      env: { ...process.env, REQUIRE_EMAIL_VERIFICATION: 'true', NODE_ENV: 'test' },
    });
    const lines = output.trim().split('\n');
    assert.ok(lines.includes('SIGNIN_STATUS:403'), `expected 403, got:\n${output}`);
    assert.ok(lines.includes('SIGNIN_CODE:EMAIL_NOT_VERIFIED'), `expected code, got:\n${output}`);
    assert.ok(lines.includes('LOCKOUT_REMAINING:0'), `expected no lockout burn, got:\n${output}`);
  } catch (err) {
    assert.fail(`subprocess failed: ${(err as Error).message}`);
  }
});

test('pending password setup accounts cannot sign in with their temporary password', async () => {
  const ctx = await createTestApp();
  const email = `pending-password-${randomUUID()}@example.com`;

  try {
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Pending Password User' },
    });
    assert.equal(registerResponse.statusCode, 200);

    const { sqlite } = await import('../db/client.js');
    sqlite
      .prepare('UPDATE user SET emailVerified = 1, passwordSetupRequired = 1 WHERE email = ?')
      .run(email);

    const signIn = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD },
    });

    assert.equal(signIn.statusCode, 401);
    assert.deepEqual(signIn.json(), { message: 'Invalid email or password.' });
    const lockout = sqlite
      .prepare('SELECT attempts FROM login_attempts WHERE email = ?')
      .get(email) as { attempts: number } | undefined;
    assert.equal(lockout, undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('set-password endpoint requires verified email and sets the password', async () => {
  const ctx = await createTestApp();
  const email = `setpw-${randomUUID()}@example.com`;

  try {
    // Register + login normally; verified users without the setup flag are denied.
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Set PW User' },
    });
    assert.equal(registerResponse.statusCode, 200);
    const cookie = readCookie(registerResponse);

    // Unauthenticated → 401.
    const unauth = await ctx.app.inject({
      method: 'POST',
      url: '/me/password/set',
      payload: { newPassword: 'NewPassword123!' },
    });
    assert.equal(unauth.statusCode, 401);

    const normalUserSetPw = await ctx.app.inject({
      method: 'POST',
      url: '/me/password/set',
      headers: { origin: TEST_ORIGIN, cookie },
      payload: { newPassword: 'NewPassword123!' },
    });
    assert.equal(normalUserSetPw.statusCode, 403);

    const { sqlite } = await import('../db/client.js');
    sqlite
      .prepare('UPDATE user SET emailVerified = 1, passwordSetupRequired = 1 WHERE email = ?')
      .run(email);

    const NEW_PW = 'NewPassword123!';
    const setPw = await ctx.app.inject({
      method: 'POST',
      url: '/me/password/set',
      headers: { origin: TEST_ORIGIN, cookie },
      payload: { newPassword: NEW_PW },
    });
    assert.equal(setPw.statusCode, 200);
    assert.equal(setPw.json().ok, true);

    const secondSetPw = await ctx.app.inject({
      method: 'POST',
      url: '/me/password/set',
      headers: { origin: TEST_ORIGIN, cookie },
      payload: { newPassword: 'AnotherPassword123!' },
    });
    assert.equal(secondSetPw.statusCode, 403);

    // Old password no longer works; the new one does.
    const oldSignIn = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD },
    });
    assert.notEqual(oldSignIn.statusCode, 200);

    const newSignIn = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: NEW_PW },
    });
    assert.equal(newSignIn.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});

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
    assert.equal(registerBody.user.passwordSetupRequired, false);
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
  setLockoutConfig({ attempts: 2, minutes: 1 });

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

test('email rate limiting blocks duplicate sign-up within 5 minutes', async () => {
  const ctx = await createTestApp();
  const email = `rate-${randomUUID()}@example.com`;

  try {
    // First sign-up should succeed
    const firstSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Rate Test' },
    });
    assert.equal(firstSignUp.statusCode, 200);

    // Second sign-up with same email should be rate-limited (1 per 5 min)
    const secondSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Rate Test' },
    });
    assert.equal(secondSignUp.statusCode, 429);
    const secondBody = secondSignUp.json();
    assert.ok(typeof secondBody.retryAfterSeconds === 'number' && secondBody.retryAfterSeconds > 0);
    assert.ok(secondSignUp.headers['retry-after']);
    assert.match(secondBody.message, /signup/i);

    // Different email should still be allowed
    const otherEmail = `rate-other-${randomUUID()}@example.com`;
    const otherSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email: otherEmail, password: TEST_PASSWORD, name: 'Other' },
    });
    assert.equal(otherSignUp.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});

test('locked account can log in after lockout window expires', { timeout: 60_000 }, async () => {
  // Use a 1s lockout window — shorter than one Better Auth request on CI (~3s),
  // so the lockout always expires before the next poll iteration completes.
  setLockoutConfig({ attempts: 2, minutes: 0.167 }); // ~10s lockout window

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

    // Poll the login endpoint until the lockout expires and the correct
    // password is accepted. Retry every 1s, give up after 30s.
    // The lockout check returns 429 instantly (no Better Auth call), so
    // only the first successful attempt takes ~3s on CI.
    let successResponse: Awaited<ReturnType<typeof ctx.app.inject>> | null = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < 30_000) {
      const attempt = await ctx.app.inject({
        method: 'POST',
        url: '/auth/sign-in/email',
        headers: { origin: TEST_ORIGIN },
        payload: { email, password: TEST_PASSWORD },
      });
      if (attempt.statusCode === 200) {
        successResponse = attempt;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(successResponse, 'Login should succeed after lockout expires');
    assert.equal(successResponse!.statusCode, 200);

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

test('auth bridge returns 400 for invalid JSON body', async () => {
  const ctx = await createTestApp();

  try {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: {
        origin: TEST_ORIGIN,
        'content-type': 'text/plain',
      },
      body: 'not-valid-json',
    });
    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.message, 'Invalid JSON body');
  } finally {
    await ctx.cleanup();
  }
});

test('sendResetPassword callback is wired correctly', async () => {
  const ctx = await createTestApp();
  const email = `reset-cb-${randomUUID()}@example.com`;

  try {
    // Register a user so the email exists
    await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Reset CB User' },
    });

    // Capture the console-logged email body (test env logs instead of sending).
    const logs: string[] = [];
    mock.method(console, 'log', (msg: string) => {
      if (typeof msg === 'string' && msg.startsWith('[email]')) logs.push(msg);
    });

    try {
      // Trigger the requestPasswordReset flow — this invokes the sendResetPassword
      // callback configured in auth.ts, which dynamically imports email.js and
      // calls sendPasswordResetEmail. Without RESEND_API_KEY, it logs to console.
      const { auth } = await import('../lib/auth.js');
      const result = await auth.api.requestPasswordReset({
        body: { email, redirectTo: 'http://localhost:4200/reset-password' },
      });

      // Better Auth returns { status: true } on success
      assert.equal(result.status, true);

      // The emailed link must point straight at the frontend with the token in
      // the query — never at the API's redirect-based /auth/reset-password/<token>
      // route (whose empty-callbackURL failure mode dead-ends on
      // /auth/error?error=INVALID_TOKEN).
      const body = logs.find((l) => l.includes('reset-password'));
      assert.ok(body, 'reset email was logged: ' + JSON.stringify(logs));
      const match = body!.match(/https?:\/\/[^\s]+/);
      assert.ok(match, 'email body contains a URL');
      const emailedUrl = new URL(match![0]);
      assert.equal(emailedUrl.origin, 'http://localhost:4200');
      assert.equal(emailedUrl.pathname, '/reset-password');
      assert.ok(emailedUrl.searchParams.get('token'), 'token is in the query');
      assert.equal(emailedUrl.searchParams.get('callbackURL'), null);
    } finally {
      mock.restoreAll();
    }
  } finally {
    await ctx.cleanup();
  }
});

test('sendVerificationEmail callback is wired correctly', async () => {
  const ctx = await createTestApp();
  const email = `verify-cb-${randomUUID()}@example.com`;

  try {
    // Register a user first
    await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: 'Verify CB User' },
    });

    // Trigger the verification email callback directly via Better Auth's API.
    // This invokes the sendVerificationEmail callback in auth.ts, which
    // dynamically imports email.js and calls sendVerificationEmail.
    // Without RESEND_API_KEY, it logs to console.
    const { auth } = await import('../lib/auth.js');
    const result = await auth.api.sendVerificationEmail({
      body: { email },
    });

    assert.equal(result.status, true);
  } finally {
    await ctx.cleanup();
  }
});

test('signup rejects passwords shorter than minPasswordLength (8)', async () => {
  const ctx = await createTestApp();
  const email = `short-pw-${randomUUID()}@example.com`;

  try {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'Short1!', name: 'Short PW' },
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.match(body.message, /password|short|length/i);
  } finally {
    await ctx.cleanup();
  }
});

test('signup accepts password meeting minPasswordLength (8)', async () => {
  const ctx = await createTestApp();
  const email = `ok-pw-${randomUUID()}@example.com`;

  try {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: 'LongEnough1!', name: 'OK PW' },
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});

test('duplicate signup attempt consumes rate-limit slot (3h)', async () => {
  const ctx = await createTestApp();
  const email = `dup-rate-${randomUUID()}@example.com`;

  try {
    // First sign-up should succeed
    const firstSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: '[redacted]', name: 'Dup Rate' },
    });
    assert.equal(firstSignUp.statusCode, 200);

    // Second sign-up with same email — rate-limited because the first
    // attempt consumed a slot (1 per 5 min). The rate-limit check happens
    // before the auth handler, so Better Auth never sees the duplicate.
    const secondSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: '[redacted]', name: 'Dup Rate' },
    });
    assert.equal(secondSignUp.statusCode, 429);
    const body = secondSignUp.json();
    assert.ok(typeof body.retryAfterSeconds === 'number' && body.retryAfterSeconds > 0);

    // Different email should still be allowed (same IP)
    const otherEmail = `dup-rate-other-${randomUUID()}@example.com`;
    const otherSignUp = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email: otherEmail, password: '[redacted]', name: 'Other' },
    });
    assert.equal(otherSignUp.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});
