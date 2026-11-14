import { createHash } from 'node:crypto';
import { and, eq, inArray, lt, gt, or, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { CalendarEventDto } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { calendarEvents, calendarSources } from '../db/schema.js';
import { projectEventToZone } from '../lib/calendar-local.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { calendarRangeToInstants } from '../lib/timezone.js';
import type { CalendarEventInput } from '../lib/calendar-parse.js';

/**
 * How far back and how far forward the ingest window reaches.
 *
 * The window is what gets stored, so a reader browsing further out sees
 * nothing rather than a partial answer. The plan calls for a note in the UI
 * when the reader goes past it.
 */
export const CALENDAR_WINDOW_PAST_DAYS = 31;
export const CALENDAR_WINDOW_FUTURE_DAYS = 366;

/** The widest range a single events query may cover. */
export const CALENDAR_MAX_RANGE_DAYS = 400;

/**
 * The half-open instant range the ingest window covers.
 *
 * The bounds are UTC calendar days: the window is a server-side concern, and
 * the reader's zone only matters when a query is projected onto it.
 */
export function calendarIngestWindow(now: DateTime = DateTime.now()): {
  start: string;
  end: string;
} {
  const utcStart = now.toUTC().startOf('day');
  const start = utcStart.minus({ days: CALENDAR_WINDOW_PAST_DAYS }).toISO();
  const end = utcStart.plus({ days: CALENDAR_WINDOW_FUTURE_DAYS }).toISO();

  if (start === null || end === null) {
    throw new RangeError('Could not compute the calendar ingest window');
  }

  return { start, end };
}

/**
 * The deterministic id of a stored event.
 *
 * The same occurrence of the same event always produces the same id, so a
 * refresh overwrites the row rather than adding a second one. The parts are
 * separated because a bare concatenation would make `source = "ab"` + `uid =
 * "c"` hash the same string as `source = "a"` + `uid = "bc"`.
 */
export function calendarEventId(sourceId: string, uid: string, recurrenceId: string): string {
  return createHash('sha256').update(`${sourceId}|${uid}|${recurrenceId}`, 'utf8').digest('hex');
}

/**
 * Store the events of one source, replacing what is already there.
 *
 * The replacement is scoped to the window: the new instances are written, and
 * the rows for that source inside the window that are no longer present are
 * removed. Rows outside the window are left alone, so a source that is only
 * partially inside the window does not lose the rest.
 *
 * A cancelled event disappears because it is never written, and the replace
 * removes the row that used to hold it. An event that vanished from the feed
 * disappears the same way.
 */
export function replaceCalendarEventsForSource(
  ownerId: string,
  sourceId: string,
  window: { start: string; end: string },
  events: readonly CalendarEventInput[],
): number {
  const now = nowIsoTimestamp();

  db.transaction(
    (tx) => {
      const rows = events.map((event) => ({
        id: calendarEventId(sourceId, event.uid, event.recurrenceId),
        sourceId,
        userId: ownerId,
        uid: event.uid,
        recurrenceId: event.recurrenceId,
        summary: event.summary,
        description: event.description,
        location: event.location,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        startDate: event.startDate,
        endDate: event.endDate,
        timezone: event.timezone,
        floating: event.floating,
        status: event.status,
        updatedAt: now,
      }));

      if (rows.length > 0) {
        tx.insert(calendarEvents)
          .values(rows)
          .onConflictDoUpdate({
            target: [calendarEvents.sourceId, calendarEvents.uid, calendarEvents.recurrenceId],
            set: {
              summary: sql`excluded.summary`,
              description: sql`excluded.description`,
              location: sql`excluded.location`,
              startAt: sql`excluded.start_at`,
              endAt: sql`excluded.end_at`,
              allDay: sql`excluded.all_day`,
              startDate: sql`excluded.start_date`,
              endDate: sql`excluded.end_date`,
              timezone: sql`excluded.timezone`,
              floating: sql`excluded.floating`,
              status: sql`excluded.status`,
              updatedAt: now,
            },
          })
          .run();
      }

      // Everything for this source inside the window that the new set does
      // not mention is gone: an event was deleted from the feed, or it was
      // cancelled.
      const keep = new Set(rows.map((row) => row.id));
      const stale = tx
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.sourceId, sourceId),
            lt(calendarEvents.startAt, window.end),
            gt(calendarEvents.endAt, window.start),
          ),
        )
        .all()
        .map((row) => row.id)
        .filter((id) => !keep.has(id));

      if (stale.length > 0) {
        tx.delete(calendarEvents).where(inArray(calendarEvents.id, stale)).run();
      }
    },
    { behavior: 'immediate' },
  );

  return events.length;
}

/**
 * How many events a source currently has stored.
 */
export function countCalendarEventsForSource(sourceId: string): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(calendarEvents)
    .where(eq(calendarEvents.sourceId, sourceId))
    .get();

  return row?.count ?? 0;
}

/**
 * The events overlapping a range, projected onto the reader's zone.
 *
 * `from` and `to` are calendar dates in the reader's zone, while the stored
 * instants are absolute, so the range is converted before the query runs. The
 * predicate is a strict overlap, so an event ending exactly at the window
 * start is out and an event starting exactly at the window end is out.
 */
export function listCalendarEventsForOwner(
  ownerId: string,
  from: string,
  to: string,
  tz?: string,
): CalendarEventDto[] {
  const range = calendarRangeToInstants(from, to, tz);
  // Floating events are stored as UTC-shaped values whose date and time parts
  // represent the feed's wall clock. Filter them against the requested dates
  // interpreted as UTC so the reader's timezone cannot shift them out of the
  // range before projectEventToZone preserves their wall clock.
  const floatingRange = calendarRangeToInstants(from, to, 'UTC');

  // An inverted range matches nothing rather than erroring.
  if (range.end <= range.start) {
    return [];
  }

  const rows = db
    .select({
      id: calendarEvents.id,
      sourceId: calendarEvents.sourceId,
      sourceName: calendarSources.name,
      sourceColor: calendarSources.color,
      summary: calendarEvents.summary,
      description: calendarEvents.description,
      location: calendarEvents.location,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay,
      startDate: calendarEvents.startDate,
      endDate: calendarEvents.endDate,
      timezone: calendarEvents.timezone,
      floating: calendarEvents.floating,
      status: calendarEvents.status,
    })
    .from(calendarEvents)
    .innerJoin(calendarSources, eq(calendarSources.id, calendarEvents.sourceId))
    .where(
      and(
        eq(calendarEvents.userId, ownerId),
        eq(calendarSources.enabled, true),
        or(
          and(
            eq(calendarEvents.floating, true),
            lt(calendarEvents.startAt, floatingRange.end),
            gt(calendarEvents.endAt, floatingRange.start),
          ),
          and(
            eq(calendarEvents.floating, false),
            lt(calendarEvents.startAt, range.end),
            gt(calendarEvents.endAt, range.start),
          ),
        ),
      ),
    )
    .orderBy(calendarEvents.startAt, calendarEvents.id)
    .all();

  return rows.map((row) => {
    const projected = projectEventToZone(
      {
        startAt: row.startAt,
        endAt: row.endAt,
        allDay: row.allDay,
        startDate: row.startDate,
        endDate: row.endDate,
        floating: row.floating,
      },
      tz,
    );

    return {
      id: row.id,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      sourceColor: row.sourceColor,
      summary: row.summary,
      description: row.description,
      location: row.location,
      allDay: row.allDay,
      dayKeys: projected.dayKeys,
      startTime: projected.startTime,
      endTime: projected.endTime,
      floating: row.floating,
      timezone: row.timezone,
      status: row.status,
    };
  });
}

/**
 * Delete every event of a source.
 *
 * The foreign key cascades, but the events are removed explicitly so the
 * count is right even for a database written before the cascade existed.
 */
export function deleteCalendarEventsForSource(tx: Database, sourceId: string): void {
  tx.delete(calendarEvents).where(eq(calendarEvents.sourceId, sourceId)).run();
}
