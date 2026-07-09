import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupTestDb } from '../db/test-db.js';
import { sqlite } from '../db/client.js';
import {
  clearAttempts,
  getRemainingAttempts,
  getRemainingLockoutSeconds,
  isLockedOut,
  recordFailedAttempt,
  setLockoutConfig,
} from './login-lockout.js';

const VICTIM = 'victim@example.com';
const ATTACKER_IP = '203.0.113.9';
const OTHER_IP = '198.51.100.23';

before(() => {
  setLockoutConfig({ attempts: 3, minutes: 5 });
});

after(() => {
  setLockoutConfig({});
  cleanupTestDb();
});

function failedSignIns(ip: string, email: string, count: number) {
  for (let i = 0; i < count; i++) {
    recordFailedAttempt(ip, email);
  }
}

test('attempts from different IPs do not share a counter', () => {
  failedSignIns(ATTACKER_IP, VICTIM, 2);
  failedSignIns(OTHER_IP, VICTIM, 1);
  assert.equal(getRemainingAttempts(ATTACKER_IP, VICTIM), 1);
  assert.equal(getRemainingAttempts(OTHER_IP, VICTIM), 2);
});

test('lockout is scoped to (ip, email) — another IP is unaffected', () => {
  failedSignIns(ATTACKER_IP, VICTIM, 3);
  assert.equal(getRemainingLockoutSeconds(ATTACKER_IP, VICTIM) > 0, true);
  assert.equal(getRemainingLockoutSeconds(OTHER_IP, VICTIM), 0);
});

test('clearAttempts only clears the specific (ip, email) tuple', () => {
  clearAttempts(ATTACKER_IP, VICTIM);
  assert.equal(getRemainingLockoutSeconds(ATTACKER_IP, VICTIM), 0);
  assert.equal(getRemainingAttempts(ATTACKER_IP, VICTIM), 3);
  assert.equal(getRemainingAttempts(OTHER_IP, VICTIM), 2);
});

test('unlocked tuple reports zero remaining lockout', () => {
  assert.equal(getRemainingLockoutSeconds(OTHER_IP, VICTIM), 0);
  assert.equal(isLockedOut(OTHER_IP, VICTIM), false);
});

test('locked tuple reports locked', () => {
  const ip = '10.0.0.1';
  const email = 'locked-test@example.com';
  failedSignIns(ip, email, 3);
  assert.equal(isLockedOut(ip, email), true);
});

const CLEANUP_IP = '203.0.113.50';
const CLEANUP_EMAIL = 'cleanup@example.com';

test('stale rows are purged by getRemainingLockoutSeconds', () => {
  // Seed a pre-lockout attempt row older than the window and a locked row whose
  // lockout already expired. Both should be removed lazily when the lockout
  // status is queried (cleanExpiredLockouts runs inside getRemainingLockoutSeconds).
  const old = Date.now() - 10 * 60 * 1000;
  const expiredLockout = Date.now() - 60 * 1000;

  sqlite
    .prepare(
      `INSERT INTO login_attempts (ip, email, attempts, locked_until, last_attempt_at)
       VALUES (?, ?, 1, NULL, ?)`,
    )
    .run(CLEANUP_IP, CLEANUP_EMAIL, old);

  sqlite
    .prepare(
      `INSERT INTO login_attempts (ip, email, attempts, locked_until, last_attempt_at)
       VALUES (?, ?, 5, ?, ?)`,
    )
    .run(CLEANUP_IP, `other-${CLEANUP_EMAIL}`, expiredLockout, expiredLockout);

  assert.equal(getRemainingLockoutSeconds(CLEANUP_IP, CLEANUP_EMAIL), 0);

  const remaining = sqlite
    .prepare('SELECT COUNT(*) AS cnt FROM login_attempts WHERE ip = ?')
    .get(CLEANUP_IP) as { cnt: number };
  assert.equal(remaining.cnt, 0, 'both stale rows should be purged');
});
