import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

const TEST_EMAIL = `lockout-${randomUUID()}@test.com`;

test('login lockout utility tracks attempts and locks at threshold', async () => {
  const dbFile = join(tmpdir(), `yotara-lockout-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  process.env['PASSWORD_LOCKOUT_ATTEMPTS'] = '3';
  process.env['PASSWORD_LOCKOUT_MINUTES'] = '5';

  try {
    // Import db/client to initialize the SQLite singleton with temp DB path.
    // Must be imported before login-lockout since login-lockout imports sqlite from it.
    await import('../db/client.js');
    const {
      isLockedOut,
      getRemainingAttempts,
      getRemainingLockoutSeconds,
      recordFailedAttempt,
      clearAttempts,
    } = await import('./login-lockout.js');

    assert.equal(isLockedOut(TEST_EMAIL), false, 'not locked before any attempts');
    assert.equal(getRemainingAttempts(TEST_EMAIL), 3, '3 remaining before any attempts');
    assert.equal(
      getRemainingLockoutSeconds(TEST_EMAIL),
      0,
      'no lockout seconds before any attempts',
    );

    const first = recordFailedAttempt(TEST_EMAIL);
    assert.equal(first.locked, false);
    assert.equal(first.remainingAttempts, 2);
    assert.equal(first.remainingLockoutSeconds, 0);
    assert.equal(isLockedOut(TEST_EMAIL), false);
    assert.equal(getRemainingAttempts(TEST_EMAIL), 2);

    const second = recordFailedAttempt(TEST_EMAIL);
    assert.equal(second.locked, false);
    assert.equal(second.remainingAttempts, 1);
    assert.equal(isLockedOut(TEST_EMAIL), false);
    assert.equal(getRemainingAttempts(TEST_EMAIL), 1);

    const third = recordFailedAttempt(TEST_EMAIL);
    assert.equal(third.locked, true);
    assert.equal(third.remainingAttempts, 0);
    assert.ok(third.remainingLockoutSeconds > 0, 'lockout seconds are positive');
    assert.equal(isLockedOut(TEST_EMAIL), true);
    assert.equal(getRemainingAttempts(TEST_EMAIL), 0);

    const lockoutSeconds = getRemainingLockoutSeconds(TEST_EMAIL);
    assert.ok(lockoutSeconds > 0 && lockoutSeconds <= 300, 'lockout seconds within range');

    // Attempting while locked should not extend the lockout
    const whileLocked = recordFailedAttempt(TEST_EMAIL);
    assert.equal(whileLocked.locked, true);
    assert.equal(whileLocked.remainingAttempts, 0);
    assert.ok(whileLocked.remainingLockoutSeconds > 0);
    assert.ok(whileLocked.remainingLockoutSeconds <= 300, 'lockout not extended beyond window');

    clearAttempts(TEST_EMAIL);
    assert.equal(isLockedOut(TEST_EMAIL), false);
    assert.equal(getRemainingAttempts(TEST_EMAIL), 3);
    assert.equal(getRemainingLockoutSeconds(TEST_EMAIL), 0);
  } finally {
    delete process.env['DATABASE_URL'];
    delete process.env['PASSWORD_LOCKOUT_ATTEMPTS'];
    delete process.env['PASSWORD_LOCKOUT_MINUTES'];
    rmSync(dbFile, { force: true });
  }
});
