import { sqlite } from '../db/client.js';
import { emailVerificationRequired } from './auth.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const UNVERIFIED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Delete email-first pending accounts that were created but never verified,
 * once they are older than 24h. Only runs when email verification is required
 * (production, or the REQUIRE_EMAIL_VERIFICATION dev/test override).
 *
 * The query targets only accounts marked by the email-first signup flow
 * (passwordSetupRequired = 1). Legacy unverified accounts from before this
 * flow are preserved to avoid data loss.
 *
 * The user row is deleted alongside its related rows. session/account/projects
 * use ON DELETE NO ACTION (see db/client.ts bootstrap), so they must be deleted
 * explicitly to avoid orphaned rows.
 *
 * Returns the number of accounts deleted (useful for tests).
 */
export function cleanupUnverifiedAccounts(): number {
  if (!emailVerificationRequired()) {
    return 0;
  }

  const cutoff = Date.now() - UNVERIFIED_TTL_MS;
  const staleUsers = sqlite
    .prepare(
      `SELECT id, email FROM user WHERE emailVerified = 0 AND passwordSetupRequired = 1 AND createdAt < ?`,
    )
    .all(cutoff) as Array<{ id: string; email: string }>;

  if (staleUsers.length === 0) {
    return 0;
  }

  const deleteSessions = sqlite.prepare(`DELETE FROM session WHERE userId = ?`);
  const deleteAccounts = sqlite.prepare(`DELETE FROM account WHERE userId = ?`);
  const deleteProjects = sqlite.prepare(`DELETE FROM projects WHERE owner_id = ?`);
  const deleteVerifications = sqlite.prepare(`DELETE FROM verification WHERE identifier = ?`);
  const deleteLoginAttempts = sqlite.prepare(`DELETE FROM login_attempts WHERE email = ?`);
  const deleteEmailSends = sqlite.prepare(`DELETE FROM email_sends WHERE email = ?`);
  const deleteUser = sqlite.prepare(`DELETE FROM user WHERE id = ?`);

  sqlite.exec('BEGIN IMMEDIATE');
  try {
    for (const user of staleUsers) {
      deleteSessions.run(user.id);
      deleteAccounts.run(user.id);
      deleteProjects.run(user.id);
      deleteVerifications.run(user.email);
      deleteLoginAttempts.run(user.email);
      deleteEmailSends.run(user.email);
      deleteUser.run(user.id);
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }

  return staleUsers.length;
}

/**
 * Start the periodic cleanup job. Runs once on boot, then on the interval.
 * No-op when verification is not required (dev/test default).
 */
export function startUnverifiedCleanupJob(intervalMs = DEFAULT_CLEANUP_INTERVAL_MS): void {
  if (!emailVerificationRequired()) {
    return;
  }
  if (cleanupTimer) {
    return;
  }

  try {
    cleanupUnverifiedAccounts();
  } catch (error) {
    console.error('[cleanup] Unverified account cleanup failed on boot:', error);
  }

  cleanupTimer = setInterval(() => {
    try {
      cleanupUnverifiedAccounts();
    } catch (error) {
      console.error('[cleanup] Unverified account cleanup failed:', error);
    }
  }, intervalMs);

  // Don't keep the process alive just for the cleanup interval.
  cleanupTimer.unref?.();
}

export function stopUnverifiedCleanupJob(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
