import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dbFile = join(tmpdir(), `yotara-password-setup-${randomUUID()}.db`);
process.env['DATABASE_URL'] = dbFile;
process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
process.env['APP_BASE_URL'] = 'http://localhost:3000';

try {
  const { buildApp } = await import('../server.js');
  const { sqlite } = await import('../db/client.js');
  const app = await buildApp();
  const email = `password-setup-${randomUUID()}@example.com`;

  await app.inject({
    method: 'POST',
    url: '/auth/sign-up/email',
    headers: { origin: 'http://localhost:4200' },
    payload: { email, password: 'Password123!', name: 'Password Setup User' },
  });

  const row = sqlite
    .prepare('SELECT passwordSetupRequired FROM user WHERE email = ?')
    .get(email) as { passwordSetupRequired: number } | undefined;
  console.log(`PASSWORD_SETUP_REQUIRED:${row?.passwordSetupRequired ?? 'missing'}`);
  await app.close();
} finally {
  delete process.env['DATABASE_URL'];
  delete process.env['BETTER_AUTH_SECRET'];
  delete process.env['APP_BASE_URL'];
  rmSync(dbFile, { force: true });
}
