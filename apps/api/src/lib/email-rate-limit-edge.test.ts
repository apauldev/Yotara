import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

test('total cap blocks different type (not per-type cooldown)', async () => {
  const dbFile = join(tmpdir(), `yotara-email-totalcap-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  try {
    await import('../db/client.js');
    const { checkEmailRateLimit, recordEmailSend } = await import('./email-rate-limit.js');

    // Record 3 signups. Per-type cooldown blocks signup, but reset should be
    // blocked by total cap only (not per-type).
    recordEmailSend('totalcap@test.com', 'signup');
    recordEmailSend('totalcap@test.com', 'signup');
    recordEmailSend('totalcap@test.com', 'signup');

    // Checking signup: blocked by per-type cooldown
    const signupCheck = checkEmailRateLimit('totalcap@test.com', 'signup');
    assert.equal(signupCheck.allowed, false, 'signup blocked by per-type');

    // Checking reset: passes per-type (0 resets), but blocked by total cap (3 total)
    const resetCheck = checkEmailRateLimit('totalcap@test.com', 'reset');
    assert.equal(resetCheck.allowed, false, 'reset blocked by total cap only');
    assert.ok(resetCheck.retryAfterSeconds! > 0, 'total cap retryAfter is positive');
    assert.ok(resetCheck.retryAfterSeconds! <= 3600, 'retryAfter <= 1 hour');
  } finally {
    delete process.env['DATABASE_URL'];
    rmSync(dbFile, { force: true });
  }
});

test('lazy cleanup removes stale rows on check', async () => {
  const dbFile = join(tmpdir(), `yotara-email-stale-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  try {
    const { sqlite } = await import('../db/client.js');
    const { checkEmailRateLimit } = await import('./email-rate-limit.js');

    // Manually insert a stale row (2 hours old)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    sqlite
      .prepare('INSERT INTO email_sends (email, type, created_at) VALUES (?, ?, ?)')
      .run('stale@test.com', 'signup', twoHoursAgo);

    // A fresh check should delete the stale row and then allow
    const result = checkEmailRateLimit('stale@test.com', 'signup');
    assert.equal(result.allowed, true, 'stale row cleaned, should be allowed');

    const count = sqlite
      .prepare('SELECT COUNT(*) AS cnt FROM email_sends WHERE email = ?')
      .get('stale@test.com') as { cnt: number };
    assert.equal(count.cnt, 0, 'stale row should be deleted');
  } finally {
    delete process.env['DATABASE_URL'];
    rmSync(dbFile, { force: true });
  }
});
