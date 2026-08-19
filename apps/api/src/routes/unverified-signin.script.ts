// Spawned by auth.test.ts with REQUIRE_EMAIL_VERIFICATION=true to exercise the
// unverified-sign-in path in a fresh process (gating is read at module load).
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dbFile = join(tmpdir(), `yotara-unverified-${randomUUID()}.db`);
process.env['DATABASE_URL'] = dbFile;
process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
process.env['APP_BASE_URL'] = 'http://localhost:3000';

try {
  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  const email = `unverified-${randomUUID()}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/auth/sign-up/email',
    headers: { origin: 'http://localhost:4200' },
    payload: { email, password: 'Password123!', name: 'Unverified User' },
  });

  const signIn = await app.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: { origin: 'http://localhost:4200' },
    payload: { email, password: 'Password123!' },
  });

  console.log(`SIGNIN_STATUS:${signIn.statusCode}`);
  console.log(`SIGNIN_BODY:${JSON.stringify(signIn.json())}`);

  const unknownSignIn = await app.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    headers: { origin: 'http://localhost:4200' },
    payload: { email: `unknown-${randomUUID()}@example.com`, password: 'Password123!' },
  });
  console.log(`UNKNOWN_SIGNIN_STATUS:${unknownSignIn.statusCode}`);
  console.log(`UNKNOWN_SIGNIN_BODY:${JSON.stringify(unknownSignIn.json())}`);

  const { getRemainingLockoutSeconds } = await import('../lib/login-lockout.js');
  console.log(`LOCKOUT_REMAINING:${getRemainingLockoutSeconds('127.0.0.1', email)}`);

  await app.close();
} finally {
  delete process.env['DATABASE_URL'];
  delete process.env['BETTER_AUTH_SECRET'];
  delete process.env['APP_BASE_URL'];
  rmSync(dbFile, { force: true });
}
