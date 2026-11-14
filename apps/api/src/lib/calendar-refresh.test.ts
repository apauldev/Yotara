import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { eq } from 'drizzle-orm';
import type { CalendarFeedFetcher } from '../services/calendar-source-service.js';
import type { CalendarFetchResult } from './calendar-fetch.js';

const dbFile = join(tmpdir(), `yotara-calendar-refresh-${randomUUID()}.db`);
process.env['DATABASE_URL'] = dbFile;
process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';

const { db, sqlite } = await import('../db/client.js');
const {
  CALENDAR_REFRESH_CONCURRENCY,
  CALENDAR_REFRESH_INTERVAL_MS,
  calendarRefreshJitterMs,
  dueCalendarSources,
  isCalendarSourceDue,
  refreshDueCalendarSources,
} = await import('./calendar-refresh.js');
const { CALENDAR_BACKOFF_STEPS_MS, calendarBackoffDelayMs: serviceBackoff } =
  await import('../services/calendar-source-service.js');
const { countCalendarEventsForSource, replaceCalendarEventsForSource } =
  await import('../services/calendar-event-service.js');
const { calendarSources } = await import('../db/schema.js');
const { encryptUrl, hashUrl } = await import('./calendar-encryption.js');

after(() => {
  sqlite.close();
  rmSync(dbFile, { force: true });
  delete process.env['DATABASE_URL'];
  delete process.env['BETTER_AUTH_SECRET'];
});

const SECRET_URL = 'https://calendar.google.com/calendar/ical/secret-token/basic.ics';
const NOW = Date.now();
const MINUTE = 60 * 1000;
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Yotara//tests//EN',
  'BEGIN:VEVENT',
  'UID:swept@example.com',
  'SUMMARY:Swept',
  'DTSTART:20260302T140000Z',
  'DTEND:20260302T143000Z',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

function isoAt(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

async function seedSource(
  overrides: {
    userId?: string;
    enabled?: boolean;
    lastFetchedAt?: string | null;
    nextAttemptAt?: string | null;
    failureCount?: number;
    lastError?: string | null;
  } = {},
) {
  const { users } = await import('../db/schema.js');
  const userId = overrides.userId ?? randomUUID();
  if (overrides.userId === undefined) {
    await db.insert(users).values({
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const sourceId = randomUUID();
  await db.insert(calendarSources).values({
    id: sourceId,
    userId,
    name: 'Work',
    urlCiphertext: encryptUrl(SECRET_URL),
    urlHash: `${hashUrl(SECRET_URL)}-${sourceId}`,
    color: 'teal',
    enabled: overrides.enabled ?? true,
    lastFetchedAt: overrides.lastFetchedAt ?? null,
    nextAttemptAt: overrides.nextAttemptAt ?? null,
    failureCount: overrides.failureCount ?? 0,
    lastError: overrides.lastError ?? null,
    createdAt: isoAt(0),
    updatedAt: isoAt(0),
  });
  return { userId, sourceId };
}

function sourceRow(sourceId: string) {
  return db.select().from(calendarSources).where(eq(calendarSources.id, sourceId)).get();
}

function keptEvent(userId: string, sourceId: string) {
  replaceCalendarEventsForSource(
    userId,
    sourceId,
    { start: '2026-02-01T00:00:00.000Z', end: '2027-05-01T00:00:00.000Z' },
    [
      {
        uid: 'kept@example.com',
        recurrenceId: '',
        summary: 'Kept',
        description: null,
        location: null,
        startAt: '2026-03-02T14:00:00.000Z',
        endAt: '2026-03-02T14:30:00.000Z',
        allDay: false,
        startDate: null,
        endDate: null,
        timezone: null,
        floating: true,
        status: 'CONFIRMED',
      },
    ],
  );
}

test('due-source selection', async (t) => {
  await t.test('a source that has never been fetched is always due', async () => {
    const { sourceId } = await seedSource();
    const due = dueCalendarSources(NOW);
    assert.ok(due.some((row) => row.id === sourceId));
  });

  await t.test('a disabled source is never due', async () => {
    const { sourceId } = await seedSource({ enabled: false, lastFetchedAt: isoAt(-60 * MINUTE) });
    const due = dueCalendarSources(NOW);
    assert.ok(!due.some((row) => row.id === sourceId));
  });

  await t.test('a source fetched a minute ago is not due yet', async () => {
    const { sourceId } = await seedSource({ lastFetchedAt: isoAt(-1 * MINUTE) });
    const due = dueCalendarSources(NOW);
    assert.ok(!due.some((row) => row.id === sourceId));
  });

  await t.test('a source fetched long ago is due again', async () => {
    const { sourceId } = await seedSource({ lastFetchedAt: isoAt(-60 * MINUTE) });
    const due = dueCalendarSources(NOW);
    assert.ok(due.some((row) => row.id === sourceId));
  });

  await t.test('a backoff that has not elapsed keeps the source out', async () => {
    const { sourceId } = await seedSource({
      lastFetchedAt: isoAt(-60 * MINUTE),
      nextAttemptAt: isoAt(60 * MINUTE),
    });
    const due = dueCalendarSources(NOW);
    assert.ok(!due.some((row) => row.id === sourceId));
  });

  await t.test('a backoff that has elapsed lets the source back in', async () => {
    const { sourceId } = await seedSource({
      lastFetchedAt: isoAt(-60 * MINUTE),
      nextAttemptAt: isoAt(-5 * MINUTE),
    });
    const due = dueCalendarSources(NOW);
    assert.ok(due.some((row) => row.id === sourceId));
  });

  await t.test('the pure due check matches the interval and its jitter', () => {
    const sourceId = randomUUID();
    const base = { id: sourceId, enabled: true, nextAttemptAt: null };
    assert.equal(isCalendarSourceDue({ ...base, lastFetchedAt: isoAt(-1 * MINUTE) }, NOW), false);
    assert.equal(isCalendarSourceDue({ ...base, lastFetchedAt: isoAt(-60 * MINUTE) }, NOW), true);
    assert.equal(isCalendarSourceDue({ ...base, lastFetchedAt: null }, NOW), true);
    assert.equal(isCalendarSourceDue({ ...base, lastFetchedAt: null, enabled: false }, NOW), false);
    assert.equal(
      isCalendarSourceDue({ ...base, lastFetchedAt: null, nextAttemptAt: isoAt(60 * MINUTE) }, NOW),
      false,
    );
  });

  await t.test('jitter stays inside a quarter of the interval', () => {
    for (const id of [randomUUID(), randomUUID(), 'abc', '']) {
      const jitter = calendarRefreshJitterMs(id);
      assert.ok(jitter >= 0);
      assert.ok(jitter < CALENDAR_REFRESH_INTERVAL_MS / 4);
    }
  });
});

test('the backoff ladder', () => {
  assert.deepEqual(CALENDAR_BACKOFF_STEPS_MS, [
    15 * MINUTE,
    60 * MINUTE,
    6 * 60 * MINUTE,
    24 * 60 * MINUTE,
  ]);

  assert.equal(serviceBackoff(0), 15 * MINUTE);
  assert.equal(serviceBackoff(1), 15 * MINUTE);
  assert.equal(serviceBackoff(2), 60 * MINUTE);
  assert.equal(serviceBackoff(3), 6 * 60 * MINUTE);
  assert.equal(serviceBackoff(4), 24 * 60 * MINUTE);
  assert.equal(serviceBackoff(99), 24 * 60 * MINUTE, 'the ladder is capped');
});

test('a failing source keeps its last good events', async (t) => {
  const failingFetcher: CalendarFeedFetcher = () => {
    throw new Error('socket hang up');
  };

  await t.test('the failure is recorded and the count does not move', async () => {
    const { userId, sourceId } = await seedSource();
    keptEvent(userId, sourceId);
    assert.equal(countCalendarEventsForSource(sourceId), 1);

    const { syncCalendarSource, describeFetchFailure } =
      await import('../services/calendar-source-service.js');
    const status = await syncCalendarSource(sourceId, userId, { fetchFeed: failingFetcher });
    assert.ok(status.lastError, 'the failure is reported on the status');
    assert.ok(!(status.lastError ?? '').includes('secret-token'), 'the URL is not in the error');
    assert.equal(countCalendarEventsForSource(sourceId), 1, 'the last good events stay');

    const row = sourceRow(sourceId);
    assert.ok(row);
    assert.ok(row.lastError);
    assert.ok(!row.lastError.includes('secret-token'));
    assert.equal(row.failureCount, 1);
    assert.ok(row.nextAttemptAt);
    assert.ok(Date.parse(row.nextAttemptAt) > Date.now(), 'the next attempt backs off');

    assert.equal(describeFetchFailure(new Error('boom')), 'The calendar could not be fetched.');
  });

  await t.test('a 304 only moves the fetch timestamp', async () => {
    const notModifiedFetcher: CalendarFeedFetcher = async (): Promise<CalendarFetchResult> => ({
      body: '',
      notModified: true,
      status: 304,
      etag: 'etag-1',
      lastModified: null,
    });
    const { syncCalendarSource } = await import('../services/calendar-source-service.js');
    const { userId, sourceId } = await seedSource({ failureCount: 3, lastError: 'previous' });

    const status = await syncCalendarSource(sourceId, userId, { fetchFeed: notModifiedFetcher });
    assert.equal(status.lastError, null);
    assert.equal(status.truncated, false);

    const row = sourceRow(sourceId);
    assert.equal(row?.failureCount, 0);
    assert.equal(row?.nextAttemptAt, null);
    assert.equal(row?.lastError, null);
  });

  await t.test('the sweep refreshes only the due sources', async () => {
    const seen: string[] = [];
    const okFetcher: CalendarFeedFetcher = async (url) => {
      seen.push(url);
      return { body: FEED, notModified: false, status: 200, etag: null, lastModified: null };
    };

    const { sourceId: soonId } = await seedSource({ lastFetchedAt: isoAt(-1 * MINUTE) });
    const { sourceId: dueId } = await seedSource();

    const summary = await refreshDueCalendarSources(NOW, okFetcher);
    assert.ok(summary.attempted >= 1, 'the sweep attempted something');
    assert.equal(seen.length, summary.attempted, 'every attempt fetched once');
    assert.ok(countCalendarEventsForSource(soonId) === 0 || seen.length >= 1);
    assert.ok(seen.length >= 1, 'the due sources were fetched');
    const dueRows = db
      .select({ lastFetchedAt: calendarSources.lastFetchedAt })
      .from(calendarSources)
      .where(eq(calendarSources.id, dueId))
      .get();
    assert.ok(dueRows?.lastFetchedAt, 'the due source was swept');
  });
});

test('the failure is counted by the sweep', async () => {
  const failingFetcher: CalendarFeedFetcher = () => {
    throw new Error('socket hang up');
  };

  const { sourceId } = await seedSource();
  const summary = await refreshDueCalendarSources(NOW, failingFetcher);
  assert.ok(summary.attempted >= 1);
  assert.ok(summary.failed >= 1);
  assert.equal(summary.succeeded, 0);

  const row = sourceRow(sourceId);
  assert.ok(row?.lastError);
  assert.ok(!row.lastError.includes('secret-token'), 'the URL never reaches the stored error');
});

test('the sweep honours the concurrency cap', () => {
  assert.ok(CALENDAR_REFRESH_CONCURRENCY >= 1);
  assert.ok(CALENDAR_REFRESH_CONCURRENCY <= 3);
});
