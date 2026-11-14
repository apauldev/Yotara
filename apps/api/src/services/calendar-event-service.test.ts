import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { CalendarEventInput } from '../lib/calendar-parse.js';

const dbFile = join(tmpdir(), `yotara-calendar-event-service-${randomUUID()}.db`);
process.env['DATABASE_URL'] = dbFile;

const { db, sqlite } = await import('../db/client.js');
const {
  calendarEventId,
  calendarIngestWindow,
  countCalendarEventsForSource,
  listCalendarEventsForOwner,
  replaceCalendarEventsForSource,
} = await import('./calendar-event-service.js');
const { calendarEvents, calendarSources, users } = await import('../db/schema.js');

after(() => {
  sqlite.close();
  rmSync(dbFile, { force: true });
  delete process.env['DATABASE_URL'];
});

const WINDOW = { start: '2026-03-01T00:00:00.000Z', end: '2026-04-01T00:00:00.000Z' };

function event(overrides: Partial<CalendarEventInput> = {}): CalendarEventInput {
  return {
    uid: 'event-1@example.com',
    recurrenceId: '',
    summary: 'Standup',
    description: null,
    location: null,
    startAt: '2026-03-02T14:00:00.000Z',
    endAt: '2026-03-02T14:30:00.000Z',
    allDay: false,
    startDate: null,
    endDate: null,
    timezone: 'America/New_York',
    floating: false,
    status: 'CONFIRMED',
    ...overrides,
  };
}

async function seedOwner(): Promise<string> {
  const ownerId = randomUUID();
  await db.insert(users).values({
    id: ownerId,
    name: 'Test User',
    email: `${ownerId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ownerId;
}

async function seedSource(ownerId: string, overrides: { id?: string; name?: string } = {}) {
  const sourceId = overrides.id ?? randomUUID();
  await db.insert(calendarSources).values({
    id: sourceId,
    userId: ownerId,
    name: overrides.name ?? 'Work',
    urlCiphertext: 'v1.cipher',
    urlHash: `hash-${sourceId}`,
    color: 'teal',
    enabled: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  });
  return sourceId;
}

test('replace-on-refresh', async (t) => {
  const ownerId = await seedOwner();
  const sourceId = await seedSource(ownerId);

  await t.test('stores the events of a source', () => {
    const count = replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({ uid: 'a@example.com' }),
      event({ uid: 'b@example.com' }),
    ]);

    assert.equal(count, 2);
    assert.equal(countCalendarEventsForSource(sourceId), 2);
  });

  await t.test('replaces the events rather than adding to them', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({ uid: 'a@example.com' }),
      event({ uid: 'b@example.com' }),
      event({ uid: 'c@example.com' }),
    ]);
    assert.equal(countCalendarEventsForSource(sourceId), 3);

    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [event({ uid: 'a@example.com' })]);
    assert.equal(
      countCalendarEventsForSource(sourceId),
      1,
      'the events that are no longer in the feed are gone',
    );
  });

  await t.test('gives an event the same row across two refreshes', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({ uid: 'stable@example.com' }),
    ]);
    const first = db.select({ id: calendarEvents.id }).from(calendarEvents).all();

    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({ uid: 'stable@example.com' }),
    ]);
    const second = db.select({ id: calendarEvents.id }).from(calendarEvents).all();

    assert.equal(second.length, first.length, 'the refresh did not add a second row');
    assert.equal(second[0].id, first[0].id, 'the row kept its identity');
  });

  await t.test('removes an event that was cancelled', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({ uid: 'cancelled@example.com' }),
      event({ uid: 'kept@example.com' }),
    ]);
    assert.equal(countCalendarEventsForSource(sourceId), 2);

    // A cancelled event is never written, so the replace removes the row that
    // used to hold it.
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [event({ uid: 'kept@example.com' })]);
    assert.equal(countCalendarEventsForSource(sourceId), 1);
  });

  await t.test('leaves the rows of another source alone', async () => {
    const secondId = await seedSource(ownerId, { name: 'Personal' });
    replaceCalendarEventsForSource(ownerId, secondId, WINDOW, [
      event({ uid: 'other@example.com' }),
    ]);

    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, []);
    assert.equal(countCalendarEventsForSource(secondId), 1, 'another source keeps its events');
  });

  await t.test('leaves the rows outside the window alone', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, []);

    replaceCalendarEventsForSource(
      ownerId,
      sourceId,
      { start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' },
      [
        event({
          uid: 'outside@example.com',
          startAt: '2027-01-01T00:00:00.000Z',
          endAt: '2027-01-01T01:00:00.000Z',
        }),
      ],
    );

    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, []);
    assert.equal(
      countCalendarEventsForSource(sourceId),
      1,
      'a row outside the window is not touched by a replace inside it',
    );
  });
});

test('the window query', async (t) => {
  const ownerId = await seedOwner();
  const sourceId = await seedSource(ownerId);

  replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
    event({ uid: 'inside@example.com' }),
    event({
      uid: 'before@example.com',
      startAt: '2026-02-27T14:00:00.000Z',
      endAt: '2026-02-27T14:30:00.000Z',
    }),
    event({
      uid: 'after@example.com',
      startAt: '2026-04-02T14:00:00.000Z',
      endAt: '2026-04-02T14:30:00.000Z',
    }),
  ]);

  await t.test('returns only the events overlapping the range', () => {
    const events = listCalendarEventsForOwner(ownerId, '2026-03-01', '2026-03-31', 'UTC');

    assert.equal(events.length, 1);
    assert.equal(events[0].summary, 'Standup');
    assert.equal(events[0].sourceName, 'Work');
    assert.equal(events[0].sourceColor, 'teal');
  });

  await t.test('excludes an event that ends exactly at the window start', () => {
    const events = listCalendarEventsForOwner(ownerId, '2026-02-28', '2026-03-01', 'UTC');

    assert.equal(
      events.length,
      0,
      'an event ending exactly at the window start is not in the range',
    );
  });

  await t.test('includes an event that starts exactly at the window start', () => {
    const events = listCalendarEventsForOwner(ownerId, '2026-03-02', '2026-03-02', 'UTC');

    assert.equal(events.length, 1, 'an event starting at the window start is in the range');
  });

  await t.test('excludes an event that starts exactly at the window end', () => {
    const events = listCalendarEventsForOwner(ownerId, '2026-02-26', '2026-02-26', 'UTC');

    assert.equal(
      events.length,
      0,
      'the day an event starts is excluded from a window that ends the day before',
    );
  });

  await t.test('returns nothing for an inverted range', () => {
    const events = listCalendarEventsForOwner(ownerId, '2026-03-31', '2026-03-01', 'UTC');

    assert.equal(events.length, 0);
  });

  await t.test('projects the events onto the reader’s zone', () => {
    const events = listCalendarEventsForOwner(
      ownerId,
      '2026-03-02',
      '2026-03-02',
      'America/New_York',
    );

    assert.equal(events.length, 1);
    assert.deepEqual(events[0].dayKeys, ['2026-03-02']);
    assert.equal(events[0].startTime, '09:00');
    assert.equal(events[0].endTime, '09:30');
  });

  await t.test('moves the day of an event that falls on the previous day locally', () => {
    const events = listCalendarEventsForOwner(
      ownerId,
      '2026-03-02',
      '2026-03-02',
      'America/Los_Angeles',
    );

    assert.equal(events.length, 1);
    assert.deepEqual(events[0].dayKeys, ['2026-03-02']);
    assert.equal(events[0].startTime, '06:00');
  });

  await t.test('leaves a floating event at the source’s own wall clock', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({
        uid: 'floating@example.com',
        startAt: '2026-03-05T12:00:00.000Z',
        endAt: '2026-03-05T13:00:00.000Z',
        floating: true,
        timezone: null,
      }),
    ]);

    const events = listCalendarEventsForOwner(
      ownerId,
      '2026-03-05',
      '2026-03-05',
      'Pacific/Kiritimati',
    );

    const floating = events.find((entry) => entry.floating);
    assert.ok(floating);
    assert.equal(floating.startTime, '12:00', 'a 12:00 event stays at 12:00');
    assert.deepEqual(floating.dayKeys, ['2026-03-05']);
  });

  await t.test('gives an all-day event no times', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({
        uid: 'allday@example.com',
        startAt: '2026-03-08T00:00:00.000Z',
        endAt: '2026-03-10T00:00:00.000Z',
        allDay: true,
        startDate: '2026-03-08',
        endDate: '2026-03-10',
      }),
    ]);

    const events = listCalendarEventsForOwner(ownerId, '2026-03-08', '2026-03-09', 'UTC');

    const allDay = events.find((entry) => entry.allDay);
    assert.ok(allDay);
    assert.equal(allDay.startTime, null);
    assert.equal(allDay.endTime, null);
    assert.deepEqual(allDay.dayKeys, ['2026-03-08', '2026-03-09']);
  });

  await t.test('leaves out the events of a disabled source', async () => {
    await db
      .update(calendarSources)
      .set({ enabled: false })
      .where(eq(calendarSources.id, sourceId));

    const events = listCalendarEventsForOwner(ownerId, '2026-03-01', '2026-03-31', 'UTC');
    assert.equal(events.length, 0);

    await db.update(calendarSources).set({ enabled: true }).where(eq(calendarSources.id, sourceId));
  });

  await t.test('leaves out the events of another user', async () => {
    const otherId = await seedOwner();

    const events = listCalendarEventsForOwner(otherId, '2026-03-01', '2026-03-31', 'UTC');
    assert.equal(events.length, 0);
  });

  await t.test('orders the events by their start', () => {
    replaceCalendarEventsForSource(ownerId, sourceId, WINDOW, [
      event({
        uid: 'late@example.com',
        startAt: '2026-03-04T14:00:00.000Z',
        endAt: '2026-03-04T14:30:00.000Z',
      }),
      event({
        uid: 'early@example.com',
        startAt: '2026-03-03T14:00:00.000Z',
        endAt: '2026-03-03T14:30:00.000Z',
      }),
    ]);

    const events = listCalendarEventsForOwner(ownerId, '2026-03-01', '2026-03-31', 'UTC');
    const starts = events.map((entry) => entry.dayKeys[0]);
    assert.deepEqual(starts, [...starts].sort());
  });
});

test('the ingest window covers the past and the future', () => {
  const window = calendarIngestWindow(DateTime.fromISO('2026-03-15T12:00:00Z'));
  assert.equal(window.start, '2026-02-12T00:00:00.000Z');
  assert.equal(window.end, '2027-03-16T00:00:00.000Z');
});

test('the event id is stable and separates its parts', () => {
  const first = calendarEventId('source-a', 'uid-1', 'rid-1');
  const second = calendarEventId('source-a', 'uid-1', 'rid-1');
  assert.equal(first, second);

  assert.notEqual(calendarEventId('ab', 'c', ''), calendarEventId('a', 'bc', ''));
  assert.notEqual(
    calendarEventId('source-a', 'uid-1', ''),
    calendarEventId('source-a', 'uid-1', 'x'),
  );
});
