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

test('IP-based cap limits unique emails per IP per hour', async () => {
  const dbFile = join(tmpdir(), `yotara-email-rate-ip-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  try {
    await import('../db/client.js');
    const { checkEmailRateLimit, recordEmailSend } = await import('./email-rate-limit.js');

    const TEST_IP = '203.0.113.1';
    const OTHER_IP = '198.51.100.1';
    let firstEmail = '';

    // ── Send to 5 unique emails from the same IP (should all succeed) ──
    for (let i = 1; i <= 5; i++) {
      const email = `ip-cap-${i}-${randomUUID()}@test.com`;
      if (i === 1) firstEmail = email;
      const result = checkEmailRateLimit(email, 'signup', TEST_IP);
      assert.equal(result.allowed, true, `email ${i} should be allowed`);
      recordEmailSend(email, 'signup', TEST_IP);
    }

    // ── 6th unique email from the same IP should be blocked ──
    const blockedEmail = `ip-cap-blocked-${randomUUID()}@test.com`;
    const blockedResult = checkEmailRateLimit(blockedEmail, 'signup', TEST_IP);
    assert.equal(blockedResult.allowed, false, '6th unique email from same IP should be blocked');
    assert.equal(blockedResult.retryAfterSeconds, 3600);

    // ── A different IP should still be allowed ──
    const otherEmail = `ip-cap-other-${randomUUID()}@test.com`;
    const otherResult = checkEmailRateLimit(otherEmail, 'signup', OTHER_IP);
    assert.equal(otherResult.allowed, true, 'different IP should not be affected');
    assert.equal(otherResult.retryAfterSeconds, null);

    // ── Previously seen email from same IP should still be allowed
    //    (the IP cap counts distinct emails, not total sends) ──
    // Clear per-email rows first so the per-email cap doesn't interfere
    const { sqlite } = await import('../db/client.js');
    sqlite.prepare('DELETE FROM email_sends WHERE email = ?').run(firstEmail);
    const afterClear = checkEmailRateLimit(firstEmail, 'reset', TEST_IP);
    assert.equal(afterClear.allowed, true, 'previously seen email should be allowed under IP cap');

    // ── Cleanup ──
    sqlite.prepare('DELETE FROM email_sends WHERE ip = ?').run(TEST_IP);
    sqlite.prepare('DELETE FROM email_sends WHERE ip = ?').run(OTHER_IP);
  } finally {
    delete process.env['DATABASE_URL'];
    rmSync(dbFile, { force: true });
  }
});
