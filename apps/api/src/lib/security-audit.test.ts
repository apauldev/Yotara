import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
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
type BootResult = {
  code: number | null;
  stderr: string;
  timedOut: boolean;
};

function bootServer(
  execArgv: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = 15_000,
): Promise<BootResult> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'tsx', ...execArgv], {
      cwd: join(import.meta.dirname, '..', '..'),
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    let timedOut = false;
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, timedOut });
    });
  });
}

async function getFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForHealth(port: number, child: ReturnType<typeof spawn>): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited before becoming healthy with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server did not become healthy before the timeout');
}

function waitForChildClose(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => child.once('close', () => resolve()));
}

async function assertProductionBootRejects(secret: string, expectedMessage: RegExp): Promise<void> {
  const dbFile = join(tmpdir(), `yotara-boot-${randomUUID()}.db`);
  try {
    const result = await bootServer([join(import.meta.dirname, '..', '..', 'src', 'server.ts')], {
      ...process.env,
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: secret,
      RESEND_API_KEY: 're_test_bootstrap_key',
      DATABASE_URL: dbFile,
      APP_BASE_URL: 'http://localhost:3000',
      HOST: '127.0.0.1',
    });

    assert.equal(result.timedOut, false, 'invalid secret must fail instead of hanging');
    assert.notEqual(result.code, 0, 'server must exit non-zero for an invalid secret');
    assert.match(result.stderr, expectedMessage);
  } finally {
    rmSync(dbFile, { force: true });
  }
}

test('production boot refuses predictable or malformed BETTER_AUTH_SECRET values', async () => {
  const cases: Array<[string, RegExp]> = [
    ['local-dev-secret-change-me', /placeholder/],
    ['0'.repeat(64), /repeated or sequential pattern/],
    ['0123456789abcdef'.repeat(4), /repeated or sequential pattern/],
    [
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      /repeated or sequential pattern/,
    ],
    ['correct-horse-battery-staple-into-the-woods', /canonical hex or Base64/],
    ['ABEiM0RVZneImaq7zN3u/xAhMkNUZXaHmKm6y9zt/g8', /canonical hex or Base64/],
    ['00'.repeat(31), /canonical hex or Base64/],
  ];

  for (const [secret, expectedMessage] of cases) {
    await assertProductionBootRejects(secret, expectedMessage);
  }
});

test('production boot reaches health with a canonical generated secret', async () => {
  const dbFile = join(tmpdir(), `yotara-boot-${randomUUID()}.db`);
  const port = await getFreePort();
  const child = spawn(
    'pnpm',
    ['exec', 'tsx', join(import.meta.dirname, '..', '..', 'src', 'server.ts')],
    {
      cwd: join(import.meta.dirname, '..', '..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: '903d44f75ea956577ae15335bbbef8532a867cdeae599cccac72357d40f14214',
        RESEND_API_KEY: 're_test_bootstrap_key',
        DATABASE_URL: dbFile,
        APP_BASE_URL: `http://127.0.0.1:${port}`,
        HOST: '127.0.0.1',
        PORT: String(port),
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHealth(port, child);
    assert.equal(stderr, '', 'a valid secret must not produce a bootstrap error');
  } finally {
    if (child.exitCode === null) {
      child.kill();
    }
    await waitForChildClose(child);
    rmSync(dbFile, { force: true });
  }
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
