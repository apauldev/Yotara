import { sqlite } from '../db/client.js';

function getLockoutAttempts(): number {
  return Number(process.env['PASSWORD_LOCKOUT_ATTEMPTS'] ?? 3);
}

export function getLockoutMinutes(): number {
  return Number(process.env['PASSWORD_LOCKOUT_MINUTES'] ?? 5);
}

export function getRemainingLockoutSeconds(email: string): number {
  // Clean up any expired lockouts before checking
  cleanExpiredLockouts();

  const row = sqlite
    .prepare('SELECT locked_until FROM login_attempts WHERE email = ?')
    .get(email) as { locked_until: number | null } | undefined;

  if (!row || row.locked_until === null) return 0;

  const remaining = row.locked_until - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function isLockedOut(email: string): boolean {
  return getRemainingLockoutSeconds(email) > 0;
}

export function getRemainingAttempts(email: string): number {
  const row = sqlite.prepare('SELECT attempts FROM login_attempts WHERE email = ?').get(email) as
    | { attempts: number }
    | undefined;

  return Math.max(0, getLockoutAttempts() - (row?.attempts ?? 0));
}

export function recordFailedAttempt(email: string): {
  locked: boolean;
  remainingLockoutSeconds: number;
  remainingAttempts: number;
} {
  // Don't extend an active lockout — return immediately if already locked
  const alreadyLockedSeconds = getRemainingLockoutSeconds(email);
  if (alreadyLockedSeconds > 0) {
    return { locked: true, remainingLockoutSeconds: alreadyLockedSeconds, remainingAttempts: 0 };
  }

  const now = Date.now();

  sqlite
    .prepare(
      `INSERT INTO login_attempts (email, attempts, last_attempt_at)
       VALUES (?, 1, ?)
       ON CONFLICT(email) DO UPDATE SET
         attempts = attempts + 1,
         last_attempt_at = ?`,
    )
    .run(email, now, now);

  const row = sqlite.prepare('SELECT attempts FROM login_attempts WHERE email = ?').get(email) as {
    attempts: number;
  };

  const remainingAttempts = Math.max(0, getLockoutAttempts() - row.attempts);

  if (remainingAttempts <= 0) {
    const lockedUntil = now + getLockoutMinutes() * 60 * 1000;
    sqlite
      .prepare('UPDATE login_attempts SET locked_until = ? WHERE email = ?')
      .run(lockedUntil, email);
    return {
      locked: true,
      remainingLockoutSeconds: getLockoutMinutes() * 60,
      remainingAttempts: 0,
    };
  }

  return { locked: false, remainingLockoutSeconds: 0, remainingAttempts };
}

/**
 * Clean up expired lockout rows that are no longer needed.
 * Safe to call periodically — no-op if no expired rows exist.
 */
export function cleanExpiredLockouts(): void {
  sqlite
    .prepare(`DELETE FROM login_attempts WHERE locked_until IS NOT NULL AND locked_until < ?`)
    .run(Date.now());
}

export function clearAttempts(email: string): void {
  sqlite.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
}
