import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { spawnNode, waitForLine } from './test-child-helpers.js';

/**
 * End-to-end version of the busy_timeout contract: an authenticated HTTP
 * write against the real app must queue behind an external process holding
 * the SQLite write lock (instead of failing with a 500), and the write must
 * land once the lock is released.
 */

const LOCK_HOLD_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.exec('BEGIN IMMEDIATE');
  console.log('LOCKED');
  setTimeout(() => { db.exec('COMMIT'); process.exit(0); }, 1500);
`;

test(
  'an API write request queues behind an external writer instead of failing',
  { timeout: 20_000 },
  async () => {
    const dbFile = join(tmpdir(), `yotara-http-contention-${randomUUID()}.db`);
    process.env['DATABASE_URL'] = dbFile;
    process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
    process.env['APP_BASE_URL'] = 'http://localhost:3000';

    const { buildApp } = await import('../server.js');
    const app = await buildApp();

    let child: ReturnType<typeof spawnNode>['child'] | undefined;

    try {
      // Sign up before contending so auth setup never races the child's lock.
      const { auth } = await import('../lib/auth.js');
      const signUp = await auth.api.signUpEmail({
        body: {
          email: `contention-${randomUUID()}@example.com`,
          password: 'Password123!',
          name: 'contention',
        },
        asResponse: true,
      });
      assert.equal(signUp.status, 200);
      const cookie = signUp.headers.get('set-cookie');
      assert.ok(cookie);

      const spawned = spawnNode(LOCK_HOLD_SCRIPT, [dbFile]);
      child = spawned.child;
      await waitForLine(spawned.child, spawned.stdout, 'LOCKED');

      const started = Date.now();
      const response = await app.inject({
        method: 'POST',
        url: '/labels',
        headers: { cookie },
        payload: { name: 'Queued write', color: '#82d7a9' },
      });
      const elapsed = Date.now() - started;

      assert.equal(response.statusCode, 201, response.body);
      const created = response.json();
      assert.equal(created.name, 'Queued write');
      assert.ok(elapsed >= 200, `request should have waited for the lock (took ${elapsed}ms)`);

      // The write must be visible after the external lock is released.
      const list = await app.inject({ method: 'GET', url: '/labels', headers: { cookie } });
      assert.equal(list.statusCode, 200);
      const labels = list.json() as Array<{ name: string }>;
      assert.ok(labels.some((label) => label.name === 'Queued write'));
    } finally {
      child?.kill();
      await app.close();
      rmSync(dbFile, { force: true });
      rmSync(`${dbFile}-wal`, { force: true });
      rmSync(`${dbFile}-shm`, { force: true });
      delete process.env['DATABASE_URL'];
      delete process.env['BETTER_AUTH_SECRET'];
      delete process.env['APP_BASE_URL'];
    }
  },
);
