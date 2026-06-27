import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

const TEST_EMAIL = `email-rate-${randomUUID()}@test.com`;

test('email rate limiter enforces per-type 5-min cooldown and total 3-per-hour cap', async () => {
  const dbFile = join(tmpdir(), `yotara-email-rate-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  try {
    await import('../db/client.js');
    const { checkEmailRateLimit, recordEmailSend } = await import('./email-rate-limit.js');

    // ── Fresh email: should be allowed ──
    const fresh = checkEmailRateLimit(TEST_EMAIL, 'signup');
    assert.equal(fresh.allowed, true);
    assert.equal(fresh.retryAfterSeconds, null);

    // ── After 1 signup send: same type blocked for 5 min ──
    recordEmailSend(TEST_EMAIL, 'signup');
    const afterOne = checkEmailRateLimit(TEST_EMAIL, 'signup');
    assert.equal(afterOne.allowed, false, 'second signup email should be blocked');
    assert.ok(afterOne.retryAfterSeconds! > 0, 'retryAfter should be positive');
    assert.ok(afterOne.retryAfterSeconds! <= 300, 'retryAfter should not exceed 5 minutes');

    // ── Different type should still be allowed ──
    const resetAfterSignup = checkEmailRateLimit(TEST_EMAIL, 'reset');
    assert.equal(resetAfterSignup.allowed, true, 'reset should be allowed after signup');

    // ── Hit the total cap: 2 more resets = 3 total ──
    recordEmailSend(TEST_EMAIL, 'reset');
    recordEmailSend(TEST_EMAIL, 'reset');

    // 3 total sends now: 1 signup + 2 reset. Next should hit the hourly cap.
    const afterThree = checkEmailRateLimit(TEST_EMAIL, 'reset');
    assert.equal(afterThree.allowed, false, 'should hit hourly cap at 3 total');
    assert.ok(afterThree.retryAfterSeconds! > 0);

    // Signup is also blocked by the total cap
    const signupAfterCap = checkEmailRateLimit(TEST_EMAIL, 'signup');
    assert.equal(signupAfterCap.allowed, false, 'signup also blocked by total cap');

    // ── Cleanup: after removing old rows, should be allowed again ──
    // Manually clear all rows to simulate the window passing
    const { sqlite } = await import('../db/client.js');
    sqlite.prepare('DELETE FROM email_sends WHERE email = ?').run(TEST_EMAIL);

    const afterReset = checkEmailRateLimit(TEST_EMAIL, 'signup');
    assert.equal(afterReset.allowed, true, 'should be allowed after clearing');
    assert.equal(afterReset.retryAfterSeconds, null);
  } finally {
    delete process.env['DATABASE_URL'];
    rmSync(dbFile, { force: true });
  }
});
