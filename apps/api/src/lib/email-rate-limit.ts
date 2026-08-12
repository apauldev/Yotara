import { sqlite } from '../db/client.js';

export type EmailType = 'signup' | 'reset' | 'verify';

/** Cooldown per type. 'verify' (verification email resends) is 30 min; the
 *  signup and reset emails keep the original 5-minute window. */
const PER_TYPE_WINDOW_MS: Record<EmailType, number> = {
  signup: 5 * 60 * 1000,
  reset: 5 * 60 * 1000,
  verify: 30 * 60 * 1000,
};

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
/** IP cap: max 5 unique email addresses per IP per hour (configurable via EMAIL_RATE_IP_CAP env var) */
const IP_UNIQUE_CAP = Number(process.env['EMAIL_RATE_IP_CAP'] ?? 5);
const IP_WINDOW_MS = 60 * 60 * 1000;

/**
 * Check whether an email send is allowed for the given email + type.
 * Cleans stale rows for this email on each check (lazy cleanup, scoped).
 */
export function checkEmailRateLimit(
  email: string,
  type: EmailType,
  clientIp?: string,
): RateLimitResult {
  // Scoped cleanup — only delete stale rows for this email to avoid
  // paying a full-table scan cost on every check.
  const cutoff = Date.now() - TOTAL_WINDOW_MS;
  sqlite.prepare('DELETE FROM email_sends WHERE email = ? AND created_at < ?').run(email, cutoff);

  const now = Date.now();
  const perTypeWindow = PER_TYPE_WINDOW_MS[type];
  const perTypeCutoff = now - perTypeWindow;

  // Check 1: same type in the per-type window (5 min for signup/reset, 30 min
  // for verify resends)
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
      ? Math.ceil((lastSend.last_ts + perTypeWindow - now) / 1000)
      : perTypeWindow / 1000;

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

  // Check 3: IP-based cap — max N unique emails per IP per hour
  if (clientIp) {
    const ipUniqueRow = sqlite
      .prepare(
        `SELECT COUNT(DISTINCT email) AS cnt FROM email_sends
         WHERE ip = ? AND created_at >= ?`,
      )
      .get(clientIp, now - IP_WINDOW_MS) as { cnt: number };

    if (ipUniqueRow.cnt >= IP_UNIQUE_CAP) {
      return { allowed: false, retryAfterSeconds: 3600 }; // 1 hour
    }
  }

  return { allowed: true, retryAfterSeconds: null };
}

/** Record a successful email send. */
export function recordEmailSend(email: string, type: EmailType, clientIp?: string): void {
  sqlite
    .prepare(
      `INSERT INTO email_sends (email, type, ip, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(email, type, clientIp ?? '', Date.now());
}
