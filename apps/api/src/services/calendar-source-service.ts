import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type {
  CalendarSource,
  CalendarSyncStatus,
  CreateCalendarSourceDto,
  ProjectColor,
  UpdateCalendarSourceDto,
} from '@yotara/shared';
import { PROJECT_COLORS } from '@yotara/shared';
import { db } from '../db/client.js';
import { calendarEvents, calendarSources } from '../db/schema.js';
import {
  CalendarFetchError,
  assertFetchableCalendarUrl,
  fetchCalendarFeed,
  normalizeCalendarFeedUrl,
  type CalendarFetchOptions,
  type CalendarFetchResult,
} from '../lib/calendar-fetch.js';
import { decryptUrl, describeSourceUrl, encryptUrl, hashUrl } from '../lib/calendar-encryption.js';
import { parseCalendarFeed } from '../lib/calendar-parse.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../lib/app-error.js';
import {
  calendarIngestWindow,
  countCalendarEventsForSource,
  replaceCalendarEventsForSource,
} from './calendar-event-service.js';

export type CalendarSourceRow = typeof calendarSources.$inferSelect;

/**
 * How a feed is fetched.
 */
export type CalendarFeedFetcher = (
  url: string,
  options?: CalendarFetchOptions,
) => Promise<CalendarFetchResult>;

export interface CalendarSyncOptions {
  /**
   * The URL to fetch, when the source has not stored one yet.
   *
   * After the first sync the encrypted copy is the source of truth, so this is
   * only needed while connecting a new source.
   */
  plainUrl?: string;
  /**
   * Test seam: replaces the fetcher.
   *
   * The fetch guard refuses loopback addresses, so a local test server cannot
   * be reached without it. Production code never sets it.
   */
  fetchFeed?: CalendarFeedFetcher;
}

const DEFAULT_SOURCE_COLOR: ProjectColor = 'teal';
const DEFAULT_SOURCE_NAME = 'Calendar';

/**
 * Whether plain `http://` feed URLs are permitted.
 *
 * Off by default: an http URL sends the secret calendar token in the clear.
 */
function insecureUrlsAllowed(): boolean {
  return process.env['ALLOW_INSECURE_CALENDAR_URLS'] === 'true';
}

/**
 * Turn a fetch failure into a short, safe message.
 *
 * The message never contains the URL or anything beyond the host: it is
 * stored on the source and shown in Settings.
 */
export function describeFetchFailure(error: unknown): string {
  if (error instanceof CalendarFetchError) {
    switch (error.reason) {
      case 'invalid-url':
        return 'That does not look like a calendar URL.';
      case 'scheme-not-allowed':
        return 'The calendar URL must use https://.';
      case 'credentials-in-url':
        return 'Remove the username and password from the calendar URL.';
      case 'blocked-address':
        return 'The calendar URL points at an address the server will not fetch.';
      case 'dns-failure':
        return 'The calendar host could not be reached.';
      case 'too-many-redirects':
        return 'The calendar URL redirected too many times.';
      case 'timeout':
        return 'The calendar server took too long to answer.';
      case 'response-too-large':
        return 'The calendar feed is larger than the limit.';
      case 'http-error':
        return 'The calendar server returned an error.';
      case 'network-error':
        return 'The calendar server could not be reached.';
    }
  }

  return 'The calendar could not be fetched.';
}

function normalizeSourceName(name: string | undefined, host: string): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed.slice(0, 120);
  }
  return host || DEFAULT_SOURCE_NAME;
}

function normalizeSourceColor(color: string | undefined): string {
  const trimmed = color?.trim();
  if (trimmed && (PROJECT_COLORS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  return DEFAULT_SOURCE_COLOR;
}

/**
 * A feed has to look like a calendar before it is stored.
 *
 * The fetch guard already caps the size and the time; this catches a URL that
 * answers with an HTML login page, which would otherwise be stored as an
 * empty calendar and look like a successful connection.
 */
function assertLooksLikeCalendar(body: string): void {
  const head = body.trimStart().slice(0, 200).toUpperCase();
  if (!head.includes('BEGIN:VCALENDAR')) {
    throw new UnprocessableEntityError('That URL did not return a calendar feed.');
  }
}

/** The fields of a source that become a `CalendarSource`. */
interface CalendarSourceView {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  eventCount: number;
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function toCalendarSource(row: CalendarSourceView, host: string): CalendarSource {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    enabled: row.enabled,
    host,
    eventCount: row.eventCount,
    lastFetchedAt: row.lastFetchedAt,
    lastSuccessAt: row.lastSuccessAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getSourceHost(urlCiphertext: string): string {
  try {
    return describeSourceUrl(decryptUrl(urlCiphertext));
  } catch {
    return 'unavailable';
  }
}

/**
 * List the sources of a user, with the host each one points at.
 *
 * The URL is decrypted only to read its host, and only for this user.
 */
export async function listCalendarSourcesForOwner(ownerId: string): Promise<CalendarSource[]> {
  const rows = db
    .select({
      id: calendarSources.id,
      name: calendarSources.name,
      color: calendarSources.color,
      enabled: calendarSources.enabled,
      urlCiphertext: calendarSources.urlCiphertext,
      eventCount: sql<number>`(select count(*) from calendar_events e where e.source_id = ${calendarSources.id})`,
      lastFetchedAt: calendarSources.lastFetchedAt,
      lastSuccessAt: calendarSources.lastSuccessAt,
      lastError: calendarSources.lastError,
      createdAt: calendarSources.createdAt,
      updatedAt: calendarSources.updatedAt,
    })
    .from(calendarSources)
    .where(eq(calendarSources.userId, ownerId))
    .orderBy(calendarSources.createdAt)
    .all();

  return rows.map((row) => toCalendarSource(row, getSourceHost(row.urlCiphertext)));
}

/**
 * Fetch a source the user owns.
 *
 * Returns `null` for a source that does not exist or belongs to somebody
 * else, so the route can answer 404 either way — an id from another account
 * must not be distinguishable from one that was never there.
 */
export async function getCalendarSourceForOwner(
  sourceId: string,
  ownerId: string,
): Promise<CalendarSourceRow | undefined> {
  return db
    .select()
    .from(calendarSources)
    .where(and(eq(calendarSources.id, sourceId), eq(calendarSources.userId, ownerId)))
    .limit(1)
    .get();
}

/**
 * Connect a calendar feed.
 *
 * The URL is validated and fetched once before anything is stored, so a
 * source only exists if it actually works. The URL is stored encrypted and
 * is never returned.
 */
export async function createCalendarSourceForOwner(
  ownerId: string,
  body: CreateCalendarSourceDto,
  options: CalendarSyncOptions = {},
): Promise<CalendarSource> {
  const url = normalizeCalendarFeedUrl(body.url ?? '');
  if (!url) {
    throw new BadRequestError('A calendar URL is required.');
  }

  let urlHash: string;
  try {
    assertFetchableCalendarUrl(url, insecureUrlsAllowed());
    urlHash = hashUrl(url);
  } catch (error) {
    throw new UnprocessableEntityError(describeFetchFailure(error));
  }

  const host = describeSourceUrl(url);
  const id = randomUUID();
  const now = nowIsoTimestamp();

  db.transaction(
    (tx) => {
      const duplicate = tx
        .select({ id: calendarSources.id })
        .from(calendarSources)
        .where(and(eq(calendarSources.userId, ownerId), eq(calendarSources.urlHash, urlHash)))
        .limit(1)
        .get();

      if (duplicate) {
        throw new ConflictError('That calendar is already connected.');
      }

      tx.insert(calendarSources)
        .values({
          id,
          userId: ownerId,
          name: normalizeSourceName(body.name, host),
          urlCiphertext: encryptUrl(url),
          urlHash,
          color: normalizeSourceColor(body.color),
          enabled: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    },
    { behavior: 'immediate' },
  );

  // The first fetch is part of connecting: a source that cannot be read is
  // not worth having, and the person should find out now rather than later.
  const status = await syncCalendarSource(id, ownerId, { ...options, plainUrl: url });
  if (status.lastError) {
    db.delete(calendarSources).where(eq(calendarSources.id, id)).run();
    throw new UnprocessableEntityError(status.lastError);
  }

  const row = await getCalendarSourceForOwner(id, ownerId);
  if (!row) {
    throw new NotFoundError('Calendar not found');
  }

  return toCalendarSource({ ...row, eventCount: status.eventCount }, host);
}

/**
 * Update a source's label, colour, or enabled state.
 *
 * The URL cannot be changed: rotating it means adding a new source, because
 * the stored ciphertext is the identity of the feed.
 */
export async function updateCalendarSourceForOwner(
  ownerId: string,
  sourceId: string,
  body: UpdateCalendarSourceDto,
): Promise<CalendarSource | null> {
  const existing = await getCalendarSourceForOwner(sourceId, ownerId);
  if (!existing) {
    return null;
  }

  const patch: Partial<typeof calendarSources.$inferInsert> = { updatedAt: nowIsoTimestamp() };

  if (body.name !== undefined) {
    patch.name = normalizeSourceName(body.name, '');
  }
  if (body.color !== undefined) {
    patch.color = normalizeSourceColor(body.color);
  }
  if (body.enabled !== undefined) {
    patch.enabled = body.enabled;
  }

  db.update(calendarSources).set(patch).where(eq(calendarSources.id, sourceId)).run();

  const row = await getCalendarSourceForOwner(sourceId, ownerId);
  if (!row) {
    return null;
  }

  return toCalendarSource(
    { ...row, eventCount: countCalendarEventsForSource(sourceId) },
    getSourceHost(row.urlCiphertext),
  );
}

/**
 * Remove a source and its events.
 */
export async function deleteCalendarSourceForOwner(
  ownerId: string,
  sourceId: string,
): Promise<boolean> {
  const existing = await getCalendarSourceForOwner(sourceId, ownerId);
  if (!existing) {
    return false;
  }

  db.transaction(
    (tx) => {
      tx.delete(calendarEvents).where(eq(calendarEvents.sourceId, sourceId)).run();
      tx.delete(calendarSources).where(eq(calendarSources.id, sourceId)).run();
    },
    { behavior: 'immediate' },
  );
  return true;
}

/**
 * Fetch a source now and replace its events.
 */
export async function refreshCalendarSourceForOwner(
  ownerId: string,
  sourceId: string,
  options: CalendarSyncOptions = {},
): Promise<CalendarSyncStatus> {
  const existing = await getCalendarSourceForOwner(sourceId, ownerId);
  if (!existing) {
    throw new NotFoundError('Calendar not found');
  }

  return syncCalendarSource(sourceId, ownerId, options);
}

/**
 * Fetch a source and replace its events.
 *
 * `plainUrl` is only needed the first time, when the source has no events
 * yet and the URL has not been stored yet — after that the encrypted copy is
 * the source of truth.
 *
 * A failure is recorded on the source rather than thrown: the last good
 * events stay, and the person sees the error in Settings.
 */
export async function syncCalendarSource(
  sourceId: string,
  ownerId: string,
  options: CalendarSyncOptions = {},
): Promise<CalendarSyncStatus> {
  const { plainUrl } = options;
  const fetchFeed = options.fetchFeed ?? fetchCalendarFeed;
  const source = db
    .select()
    .from(calendarSources)
    .where(eq(calendarSources.id, sourceId))
    .limit(1)
    .get();

  if (!source) {
    throw new NotFoundError('Calendar not found');
  }

  let url: string;
  if (plainUrl) {
    url = plainUrl;
  } else {
    try {
      url = decryptUrl(source.urlCiphertext);
    } catch {
      return recordCalendarFailure(
        source,
        'This calendar’s saved URL can no longer be read. Reconnect it in Settings.',
      );
    }
  }

  const fetchOptions: CalendarFetchOptions = {
    allowInsecureUrls: insecureUrlsAllowed(),
    etag: source.etag,
    lastModified: source.lastModified,
  };

  let response;
  try {
    response = await fetchFeed(url, fetchOptions);
  } catch (error) {
    return recordCalendarFailure(source, describeFetchFailure(error));
  }

  const now = nowIsoTimestamp();

  if (response.notModified) {
    // Nothing changed, so the stored events are still current. Only the fetch
    // timestamp moves.
    db.update(calendarSources)
      .set({
        lastFetchedAt: now,
        updatedAt: now,
        lastError: null,
        nextAttemptAt: null,
        failureCount: 0,
      })
      .where(eq(calendarSources.id, sourceId))
      .run();

    return {
      sourceId,
      eventCount: countCalendarEventsForSource(sourceId),
      lastFetchedAt: now,
      lastSuccessAt: source.lastSuccessAt,
      lastError: null,
      truncated: false,
    };
  }

  const ingestWindow = calendarIngestWindow();
  let parsed;
  try {
    assertLooksLikeCalendar(response.body);
    parsed = parseCalendarFeed(response.body, { window: ingestWindow });
  } catch (error) {
    const message =
      error instanceof UnprocessableEntityError
        ? error.message
        : 'The calendar feed could not be read.';
    return recordCalendarFailure(source, message);
  }

  replaceCalendarEventsForSource(ownerId, sourceId, ingestWindow, parsed.events);

  db.update(calendarSources)
    .set({
      lastFetchedAt: now,
      lastSuccessAt: now,
      etag: response.etag,
      lastModified: response.lastModified,
      lastError: null,
      nextAttemptAt: null,
      failureCount: 0,
      updatedAt: now,
    })
    .where(eq(calendarSources.id, sourceId))
    .run();

  return {
    sourceId,
    eventCount: parsed.events.length,
    lastFetchedAt: now,
    lastSuccessAt: now,
    lastError: null,
    truncated: parsed.truncated,
  };
}

/**
 * Record a failed fetch.
 *
 * The message is short and safe, and the backoff moves out so a broken feed
 * is not hammered on every tick.
 */
function recordCalendarFailure(source: CalendarSourceRow, message: string): CalendarSyncStatus {
  const now = nowIsoTimestamp();
  const failureCount = source.failureCount + 1;
  const nextAttemptAt = new Date(Date.now() + calendarBackoffDelayMs(failureCount)).toISOString();

  db.update(calendarSources)
    .set({
      lastFetchedAt: now,
      lastError: message,
      nextAttemptAt,
      failureCount,
      updatedAt: now,
    })
    .where(eq(calendarSources.id, source.id))
    .run();

  return {
    sourceId: source.id,
    eventCount: countCalendarEventsForSource(source.id),
    lastFetchedAt: now,
    lastSuccessAt: source.lastSuccessAt,
    lastError: message,
    truncated: false,
  };
}

/**
 * The backoff ladder: 15 minutes, then 1 hour, 6 hours, and 24 hours.
 */
export const CALENDAR_BACKOFF_STEPS_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

/**
 * How long to wait before the next attempt after a given number of
 * consecutive failures. The last step is the cap.
 */
export function calendarBackoffDelayMs(failureCount: number): number {
  if (failureCount <= 1) {
    return CALENDAR_BACKOFF_STEPS_MS[0];
  }
  const index = Math.min(failureCount, CALENDAR_BACKOFF_STEPS_MS.length) - 1;
  return CALENDAR_BACKOFF_STEPS_MS[index];
}
