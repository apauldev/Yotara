import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

// Ensure the SQLite singleton uses a shared temp DB before any module imports it.
import '../db/test-db.js';

import { setLockoutConfig } from '../lib/login-lockout.js';

const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Security Test User';
const TEST_ORIGIN = 'http://localhost:4200';

async function createTestApp() {
  process.env['NODE_ENV'] = 'test';
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  return {
    app,
    async cleanup() {
      await app.close();
      delete process.env['NODE_ENV'];
      delete process.env['BETTER_AUTH_SECRET'];
      delete process.env['APP_BASE_URL'];
    },
  };
}

// Spawn the real server entry point and assert it refuses to start with a
// default/placeholder BETTER_AUTH_SECRET in production. Runs out-of-process so
// the auth module cache is isolated from the other tests.
function bootServer(
  execArgv: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'tsx', ...execArgv], {
      cwd: join(import.meta.dirname, '..', '..'),
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => child.kill(), 4000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

test('production boot refuses a default/placeholder BETTER_AUTH_SECRET', async () => {
  const dbFile = join(tmpdir(), `yotara-boot-${randomUUID()}.db`);
  const { code, stderr } = await bootServer(
    [join(import.meta.dirname, '..', '..', 'src', 'server.ts')],
    {
      ...process.env,
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'local-dev-secret-change-me',
      DATABASE_URL: dbFile,
      APP_BASE_URL: 'http://localhost:3000',
    },
  );

  assert.notEqual(
    code,
    0,
    'server must exit non-zero when the default secret is used in production',
  );
  assert.match(stderr, /BETTER_AUTH_SECRET/i, 'failure must mention the missing/insecure secret');

  rmSync(dbFile, { force: true });
});

test('lockout is scoped to (ip, email) — a victim can still log in from their own IP', async () => {
  setLockoutConfig({ attempts: 2, minutes: 5 });

  const ctx = await createTestApp();
  const email = `lockout-scope-${randomUUID()}@example.com`;
  const attackerIp = '203.0.113.9';
  const victimIp = '198.51.100.23';

  try {
    const registerResponse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: TEST_ORIGIN },
      payload: { email, password: TEST_PASSWORD, name: TEST_NAME },
    });
    assert.equal(registerResponse.statusCode, 200);

    // Attacker sprays wrong passwords for the victim's account from their own IP.
    for (let i = 1; i <= 2; i++) {
      const fail = await ctx.app.inject({
        method: 'POST',
        url: '/auth/sign-in/email',
        headers: { origin: TEST_ORIGIN, 'x-forwarded-for': attackerIp },
        payload: { email, password: `WrongPassword${i}!` },
      });
      if (i < 2) {
        assert.equal(fail.statusCode, 401);
      } else {
        assert.equal(fail.statusCode, 429, 'attacker IP should be locked out');
      }
    }

    // The real victim, logging in from a different IP, must NOT be locked out
    // and must authenticate successfully with the correct password.
    const victimLogin = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN, 'x-forwarded-for': victimIp },
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(victimLogin.statusCode, 200, 'victim must still be able to log in from their IP');
    assert.ok(victimLogin.headers['set-cookie'], 'victim login should set a session cookie');

    // The attacker IP remains locked.
    const attackerRetry = await ctx.app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: TEST_ORIGIN, 'x-forwarded-for': attackerIp },
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(attackerRetry.statusCode, 429, 'attacker IP stays locked');
  } finally {
    await ctx.cleanup();
  }
});
