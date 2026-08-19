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

    // Create users directly: one verified, one legacy unverified, one email-first pending, one email-first new.
    const now = Date.now();
    const insert = sqlite.prepare(
      `INSERT INTO user (id, name, email, emailVerified, passwordSetupRequired, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    insert.run(
      `verified-${randomUUID()}`,
      'Verified',
      `v-${randomUUID()}@test.com`,
      1,
      0,
      now - 48 * 3600_000,
      now,
    );
    // Legacy unverified user: passwordSetupRequired = 0 → must survive cleanup.
    insert.run(
      `legacy-unverified-${randomUUID()}`,
      'Legacy Unverified',
      `l-${randomUUID()}@test.com`,
      0,
      0,
      now - 48 * 3600_000,
      now,
    );
    // Email-first pending: passwordSetupRequired = 1, old → must be deleted.
    const staleId = `stale-${randomUUID()}`;
    const staleEmail = `stale-${randomUUID()}@test.com`;
    insert.run(staleId, 'Stale', staleEmail, 0, 1, now - 48 * 3600_000, now);
    // Orphan-prone related rows (NO ACTION FKs).
    sqlite
      .prepare(
        `INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(`sess-${randomUUID()}`, staleId, 'tok', now + 3600_000, now, now);
    sqlite
      .prepare(
        `INSERT INTO account (id, userId, accountId, providerId, createdAt, updatedAt)
                VALUES (?, ?, ?, 'credential', ?, ?)`,
      )
      .run(`acct-${randomUUID()}`, staleId, staleId, now, now);
    sqlite
      .prepare(
        `INSERT INTO projects (id, owner_id, name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        `proj-${randomUUID()}`,
        staleId,
        'P',
        new Date(now).toISOString(),
        new Date(now).toISOString(),
      );
    // New email-first pending: passwordSetupRequired = 1, recent → must survive.
    insert.run(
      `new-pending-${randomUUID()}`,
      'New Pending',
      `n-${randomUUID()}@test.com`,
      0,
      1,
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
    assert.equal(countUnverified(), 3, 'no users deleted when verification not required');

    // With the override flag: only the email-first pending account older than 24h is deleted.
    // Legacy unverified (passwordSetupRequired = 0) and recent pending survive.
    process.env['REQUIRE_EMAIL_VERIFICATION'] = 'true';
    const deleted = cleanupUnverifiedAccounts();
    assert.equal(deleted, 1, 'only the old email-first pending account is deleted');
    assert.equal(countUnverified(), 2, 'legacy and recent pending accounts survive');
    assert.equal(countVerified(), 1, 'verified account survives');

    // Related rows (NO ACTION FKs) must be cleaned up, not orphaned.
    const count = (table: string, where: string) =>
      (
        sqlite.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get() as {
          c: number;
        }
      ).c;
    assert.equal(count('session', `userId = '${staleId}'`), 0, 'sessions removed');
    assert.equal(count('account', `userId = '${staleId}'`), 0, 'accounts removed');
    assert.equal(count('projects', `owner_id = '${staleId}'`), 0, 'projects removed');
    assert.equal(count('verification', `identifier = '${staleEmail}'`), 0, 'verifications removed');
    assert.equal(count('user', `id = '${staleId}'`), 0, 'user removed');

    // Job lifecycle: start runs once on boot, then on an interval; stop clears it.
    const { startUnverifiedCleanupJob, stopUnverifiedCleanupJob } =
      await import('./email-cleanup.js');
    startUnverifiedCleanupJob(10_000); // long interval; boot run happens synchronously
    startUnverifiedCleanupJob(10_000); // idempotent — no second timer
    stopUnverifiedCleanupJob();
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
