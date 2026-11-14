import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { calendarSources } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import {
  syncCalendarSource,
  type CalendarFeedFetcher,
} from '../services/calendar-source-service.js';

/**
 * The periodic refresh of connected calendar feeds.
 *
 * Inbound is the direction Yotara controls, so the cadence is its own choice:
 * a source is polled on a fixed interval, and a broken one backs off rather
 * than being retried on every tick.
 *
 * The job is shaped like `email-cleanup.ts` — a module-level interval that is
 * unreferenced so it never keeps the process alive — with three additions
 * that a network job needs: a boot delay so a restart does not stampede every
 * source at once, a concurrency cap, and a per-source interval with jitter so
 * sources do not all fall due in the same second.
 */

export const CALENDAR_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/** How many sources may be refreshed at the same time. */
export const CALENDAR_REFRESH_CONCURRENCY = 3;

/**
 * How long after a start the first sweep waits.
 *
 * A restart refreshes every source at once otherwise, which hammers both the
 * calendar provider and this server.
 */
export const CALENDAR_REFRESH_BOOT_DELAY_MS = 30 * 1000;

/** How often the job wakes up to look for due sources. */
export const CALENDAR_REFRESH_TICK_MS = 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * A per-source offset so sources do not all fall due in the same second.
 *
 * Derived from the source id rather than stored, so it stays the same across
 * restarts and does not need a column.
 */
export function calendarRefreshJitterMs(sourceId: string): number {
  let hash = 0;
  for (let index = 0; index < sourceId.length; index += 1) {
    hash = (hash * 31 + sourceId.charCodeAt(index)) >>> 0;
  }
  // A quarter of the interval, so every source still refreshes roughly on
  // time.
  return hash % Math.floor(CALENDAR_REFRESH_INTERVAL_MS / 4);
}

/**
 * Whether a source is due for a refresh.
 *
 * A source is due when it is enabled, its backoff has elapsed, and enough
 * time has passed since the last attempt. A source that has never been
 * fetched is always due.
 */
export function isCalendarSourceDue(
  source: {
    id: string;
    enabled: boolean;
    lastFetchedAt: string | null;
    nextAttemptAt: string | null;
  },
  now: number,
): boolean {
  if (!source.enabled) {
    return false;
  }

  if (source.nextAttemptAt) {
    const nextAttempt = Date.parse(source.nextAttemptAt);
    if (!Number.isNaN(nextAttempt) && nextAttempt > now) {
      return false;
    }
  }

  if (!source.lastFetchedAt) {
    return true;
  }

  const lastFetched = Date.parse(source.lastFetchedAt);
  if (Number.isNaN(lastFetched)) {
    return true;
  }

  return lastFetched + CALENDAR_REFRESH_INTERVAL_MS - calendarRefreshJitterMs(source.id) <= now;
}

/**
 * The sources that are due for a refresh right now.
 */
export function dueCalendarSources(
  now: number = Date.now(),
): Array<typeof calendarSources.$inferSelect> {
  const nowIso = new Date(now).toISOString();

  const candidates = db
    .select()
    .from(calendarSources)
    .where(
      and(
        eq(calendarSources.enabled, true),
        or(isNull(calendarSources.nextAttemptAt), lte(calendarSources.nextAttemptAt, nowIso)),
      ),
    )
    .all();

  return candidates.filter((source) => isCalendarSourceDue(source, now));
}

export interface CalendarRefreshSummary {
  /** How many sources were refreshed. */
  attempted: number;
  /** How many succeeded. */
  succeeded: number;
  /** How many failed. */
  failed: number;
}

/**
 * Refresh every source that is due.
 *
 * The sources are processed with a concurrency cap, so a hundred due feeds
 * do not open a hundred sockets at once.
 */
export async function refreshDueCalendarSources(
  now: number = Date.now(),
  fetchFeed?: CalendarFeedFetcher,
): Promise<CalendarRefreshSummary> {
  const due = dueCalendarSources(now);
  const summary: CalendarRefreshSummary = { attempted: 0, succeeded: 0, failed: 0 };

  const queue = [...due];
  const workers = Array.from({ length: Math.min(CALENDAR_REFRESH_CONCURRENCY, queue.length) }, () =>
    (async () => {
      for (;;) {
        const source = queue.shift();
        if (!source) {
          return;
        }

        summary.attempted += 1;
        try {
          const status = await syncCalendarSource(source.id, source.userId, { fetchFeed });
          if (status.lastError) {
            summary.failed += 1;
          } else {
            summary.succeeded += 1;
          }
        } catch {
          // A source that fails in a way the service did not anticipate is
          // still just one bad source; the rest of the sweep continues.
          summary.failed += 1;
        }
      }
    })(),
  );

  await Promise.all(workers);
  return summary;
}

/**
 * Start the periodic refresh job.
 *
 * Nothing runs until the boot delay has elapsed, so a restart does not
 * refresh every source at once.
 */
export function startCalendarRefreshJob(
  options: { bootDelayMs?: number; tickMs?: number } = {},
): void {
  if (refreshTimer) {
    return;
  }

  const bootDelayMs = options.bootDelayMs ?? CALENDAR_REFRESH_BOOT_DELAY_MS;
  const tickMs = options.tickMs ?? CALENDAR_REFRESH_TICK_MS;

  const runSweep = () => {
    refreshDueCalendarSources().catch((error: unknown) => {
      console.warn('[calendar] Refresh sweep failed:', error);
    });
  };

  bootTimer = setTimeout(() => {
    bootTimer = null;
    runSweep();
  }, bootDelayMs);
  bootTimer.unref?.();

  refreshTimer = setInterval(runSweep, tickMs);
  // Don't keep the process alive just for the refresh interval.
  refreshTimer.unref?.();

  // The first sweep also runs on the tick, so a restart does not refresh every
  // source at once; the boot delay above only guards the first call.
}

export function stopCalendarRefreshJob(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
}

/**
 * The timestamp the next sweep should look at.
 *
 * Exposed so a test can assert the job is scheduled without waiting for it.
 */
export function nextCalendarSweepAt(now: number = Date.now()): string {
  return new Date(now + CALENDAR_REFRESH_TICK_MS).toISOString();
}

/**
 * Mark every source as fetched right now.
 *
 * Used by the tests and by a manual "refresh everything" path; it does not
 * fetch anything.
 */
export function touchAllCalendarSources(nowIso: string = nowIsoTimestamp()): void {
  db.update(calendarSources).set({ lastFetchedAt: nowIso }).run();
}
