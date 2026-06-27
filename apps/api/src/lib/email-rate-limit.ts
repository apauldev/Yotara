import { sqlite } from '../db/client.js';

export type EmailType = 'signup' | 'reset';

/** Cooldown per type: 1 email of the same type per 5 minutes */
const PER_TYPE_WINDOW_MS = 5 * 60 * 1000;

/** Total cap: 3 emails of any type per 1 hour */
const TOTAL_WINDOW_MS = 60 * 60 * 1000;
const TOTAL_CAP = 3;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number | null; // null when allowed
}

/**
 * Check whether an email send is allowed for the given email + type.
 * Cleans stale rows for this email on each check (lazy cleanup, scoped).
 */
export function checkEmailRateLimit(email: string, type: EmailType): RateLimitResult {
  // Scoped cleanup — only delete stale rows for this email to avoid
  // paying a full-table scan cost on every check.
  const cutoff = Date.now() - TOTAL_WINDOW_MS;
  sqlite.prepare('DELETE FROM email_sends WHERE email = ? AND created_at < ?').run(email, cutoff);

  const now = Date.now();
  const perTypeCutoff = now - PER_TYPE_WINDOW_MS;

  // Check 1: same type in last 5 minutes
  const sameTypeRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS cnt FROM email_sends
       WHERE email = ? AND type = ? AND created_at >= ?`,
    )
    .get(email, type, perTypeCutoff) as { cnt: number };

  if (sameTypeRow.cnt >= 1) {
    // Find the most recent send to calculate retryAfter
    const lastSend = sqlite
      .prepare(
        `SELECT MAX(created_at) AS last_ts FROM email_sends
         WHERE email = ? AND type = ?`,
      )
      .get(email, type) as { last_ts: number | null };

    const retryAfter = lastSend.last_ts
      ? Math.ceil((lastSend.last_ts + PER_TYPE_WINDOW_MS - now) / 1000)
      : PER_TYPE_WINDOW_MS / 1000;

    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  // Check 2: total sends in last 1 hour
  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS cnt FROM email_sends
       WHERE email = ? AND created_at >= ?`,
    )
    .get(email, now - TOTAL_WINDOW_MS) as { cnt: number };

  if (totalRow.cnt >= TOTAL_CAP) {
    // Find oldest in window to calculate when the first slot opens up
    const oldestInWindow = sqlite
      .prepare(
        `SELECT MIN(created_at) AS oldest_ts FROM email_sends
         WHERE email = ? AND created_at >= ?`,
      )
      .get(email, now - TOTAL_WINDOW_MS) as { oldest_ts: number | null };

    const retryAfter = oldestInWindow.oldest_ts
      ? Math.ceil((oldestInWindow.oldest_ts + TOTAL_WINDOW_MS - now) / 1000)
      : TOTAL_WINDOW_MS / 1000;

    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  return { allowed: true, retryAfterSeconds: null };
}

/** Record a successful email send. */
export function recordEmailSend(email: string, type: EmailType): void {
  sqlite
    .prepare(
      `INSERT INTO email_sends (email, type, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(email, type, Date.now());
}
