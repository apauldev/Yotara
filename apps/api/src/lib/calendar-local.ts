import { DateTime } from 'luxon';

/**
 * Project a stored calendar event onto the reader's zone.
 *
 * Which day an event belongs to is a property of the reader, not of the
 * source, and the server owns that answer so the client and the server can
 * never disagree about where a chip sits. The client receives the day keys
 * and the times and does no timezone arithmetic of its own.
 *
 * Two kinds of event are stored differently (§6.3 of the plan):
 *
 * - An absolute event holds a true instant and is projected into the reader's
 *   zone.
 * - A floating event holds the source's own wall clock, read as UTC. Its UTC
 *   parts *are* that wall clock, so they are read straight off and never
 *   re-projected — reprojecting would slide a 09:00 standup to 22:00 for
 *   anyone east of UTC.
 */

export interface StoredCalendarEvent {
  /** UTC ISO instant. */
  startAt: string;
  /** UTC ISO instant, exclusive. */
  endAt: string;
  allDay: boolean;
  /** `YYYY-MM-DD`, for all-day display. */
  startDate: string | null;
  /** `YYYY-MM-DD`, exclusive, for all-day display. */
  endDate: string | null;
  /** True when the source gave no zone. */
  floating: boolean;
}

export interface LocalCalendarEvent {
  /** The reader-local days this event occupies. One entry for an ordinary event. */
  dayKeys: string[];
  /** Reader-local start time (`HH:mm`), or null for an all-day event. */
  startTime: string | null;
  /** Reader-local end time (`HH:mm`), or null for an all-day event. */
  endTime: string | null;
}

/**
 * The longest span a single event may cover.
 *
 * The events query is capped at a 400-day range, so an event covering more
 * days than that is outside anything the calendar can show.
 */
const MAX_EVENT_DAYS = 400;

function resolveZone(tz?: string): string {
  if (!tz) {
    return 'UTC';
  }
  return DateTime.now().setZone(tz).isValid ? tz : 'UTC';
}

/**
 * List the days from `first` to `lastInclusive`, both `YYYY-MM-DD`.
 *
 * An inverted range collapses to the first day rather than to nothing: an
 * event always occupies at least the day it starts on.
 */
function enumerateDays(first: string, lastInclusive: string): string[] {
  const start = DateTime.fromISO(first, { zone: 'utc' }).startOf('day');
  const end = DateTime.fromISO(lastInclusive, { zone: 'utc' }).startOf('day');

  if (!start.isValid) {
    return [];
  }
  if (!end.isValid || end < start) {
    return [first];
  }

  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < MAX_EVENT_DAYS) {
    days.push(cursor.toFormat('yyyy-MM-dd'));
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

/**
 * The last day an event occupies.
 *
 * `end_at` is exclusive, so an event that ends exactly at midnight belongs to
 * the day before, not to the new one.
 */
function lastOccupiedDay(end: DateTime): string {
  return end.minus({ milliseconds: 1 }).toFormat('yyyy-MM-dd');
}

/**
 * Project a stored event onto the reader's zone.
 *
 * `tz` is the reader's IANA zone. An unknown zone falls back to UTC, which
 * keeps the answer deterministic rather than guessing.
 */
export function projectEventToZone(event: StoredCalendarEvent, tz?: string): LocalCalendarEvent {
  const zone = resolveZone(tz);

  const start = DateTime.fromISO(event.startAt, { zone: 'utc' });
  const end = DateTime.fromISO(event.endAt, { zone: 'utc' });

  if (!start.isValid || !end.isValid) {
    return { dayKeys: [], startTime: null, endTime: null };
  }

  if (event.allDay) {
    const startDate = event.startDate ?? start.toFormat('yyyy-MM-dd');
    const endDate = event.endDate ?? end.toFormat('yyyy-MM-dd');
    const lastDay = DateTime.fromISO(endDate, { zone: 'utc' })
      .minus({ days: 1 })
      .toFormat('yyyy-MM-dd');

    return { dayKeys: enumerateDays(startDate, lastDay), startTime: null, endTime: null };
  }

  if (event.floating) {
    // The stored UTC parts are the source's own wall clock. Read them as they
    // are: shifting them into the reader's zone would move the event.
    const startDate = start.toFormat('yyyy-MM-dd');
    const endDate = lastOccupiedDay(end);

    return {
      dayKeys: enumerateDays(startDate, endDate),
      startTime: start.toFormat('HH:mm'),
      endTime: end.toFormat('HH:mm'),
    };
  }

  const localStart = start.setZone(zone);
  const localEnd = end.setZone(zone);

  return {
    dayKeys: enumerateDays(localStart.toFormat('yyyy-MM-dd'), lastOccupiedDay(localEnd)),
    startTime: localStart.toFormat('HH:mm'),
    endTime: localEnd.toFormat('HH:mm'),
  };
}
