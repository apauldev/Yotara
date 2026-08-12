import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

test('unverified account cleanup', async () => {
  const dbFile = join(tmpdir(), `yotara-cleanup-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  const previousEnv = process.env['NODE_ENV'];
  const previousFlag = process.env['REQUIRE_EMAIL_VERIFICATION'];
  process.env['NODE_ENV'] = 'test';
  delete process.env['REQUIRE_EMAIL_VERIFICATION'];

  try {
    const { sqlite } = await import('../db/client.js');

    // Create users directly: one verified, one unverified old, one unverified new.
    const now = Date.now();
    const insert = sqlite.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    insert.run(
      `verified-${randomUUID()}`,
      'Verified',
      `v-${randomUUID()}@test.com`,
      1,
      now - 48 * 3600_000,
      now,
    );
    insert.run(
      `unverified-old-${randomUUID()}`,
      'Old Unverified',
      `o-${randomUUID()}@test.com`,
      0,
      now - 48 * 3600_000,
      now,
    );
    insert.run(
      `unverified-new-${randomUUID()}`,
      'New Unverified',
      `n-${randomUUID()}@test.com`,
      0,
      now - 1 * 3600_000,
      now,
    );

    // Default (no flag): verification not required → cleanup is a no-op.
    const { cleanupUnverifiedAccounts } = await import('./email-cleanup.js');
    assert.equal(cleanupUnverifiedAccounts(), 0);
    const countUnverified = () =>
      (
        sqlite.prepare(`SELECT COUNT(*) AS c FROM user WHERE emailVerified = 0`).get() as {
          c: number;
        }
      ).c;
    const countVerified = () =>
      (
        sqlite.prepare(`SELECT COUNT(*) AS c FROM user WHERE emailVerified = 1`).get() as {
          c: number;
        }
      ).c;
    assert.equal(countUnverified(), 2, 'no users deleted when verification not required');

    // With the override flag: only the old unverified account is deleted.
    process.env['REQUIRE_EMAIL_VERIFICATION'] = 'true';
    const deleted = cleanupUnverifiedAccounts();
    assert.equal(deleted, 1, 'exactly one unverified account older than 24h deleted');
    assert.equal(countUnverified(), 1, 'new unverified account survives');
    assert.equal(countVerified(), 1, 'verified account survives');
  } finally {
    delete process.env['DATABASE_URL'];
    if (previousEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = previousEnv;
    }
    if (previousFlag === undefined) {
      delete process.env['REQUIRE_EMAIL_VERIFICATION'];
    } else {
      process.env['REQUIRE_EMAIL_VERIFICATION'] = previousFlag;
    }
    rmSync(dbFile, { force: true });
  }
});
