import { sqlite } from '../db/client.js';
import { emailVerificationRequired } from './auth.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const UNVERIFIED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Delete accounts that were created but never verified, once they are older
 * than 24h. Only runs when email verification is required (production, or the
 * REQUIRE_EMAIL_VERIFICATION dev/test override) — otherwise dev/test users who
 * registered without verification would be deleted.
 *
 * Returns the number of accounts deleted (useful for tests).
 */
export function cleanupUnverifiedAccounts(): number {
  if (!emailVerificationRequired()) {
    return 0;
  }

  const cutoff = Date.now() - UNVERIFIED_TTL_MS;
  const result = sqlite
    .prepare(`DELETE FROM user WHERE emailVerified = 0 AND createdAt < ?`)
    .run(cutoff);

  // Related rows cascade via FK where configured; be explicit about the
  // Better Auth tables that use NO ACTION, to avoid orphaned rows.
  return result.changes;
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
