import { DateTime } from 'luxon';

/**
 * Resolve a caller-supplied IANA timezone, or `null` when none was supplied
 * or the value is not a real zone. Callers that need a day boundary should
 * use todayInTimezone; callers evaluating an exact wall-clock instant must
 * use this so an unknown zone is never silently read as UTC.
 */
export function resolveTimezone(tz?: string, now: DateTime = DateTime.now()): string | null {
  if (!tz) return null;
  return now.setZone(tz).isValid ? tz : null;
}

/**
 * Compute today's date (YYYY-MM-DD) in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid or undefined.
 */
export function todayInTimezone(tz?: string, now: DateTime = DateTime.now()): string {
  if (!tz) {
    return now.setZone('UTC').toFormat('yyyy-MM-dd');
  }
  const dt = now.setZone(tz);
  const zone = dt.isValid ? tz : 'UTC';
  return now.setZone(zone).toFormat('yyyy-MM-dd');
}

/**
 * Format an instant as a UTC ISO string, rejecting an invalid DateTime rather
 * than emitting Luxon's "Invalid DateTime" placeholder. A caller that cannot
 * name a real instant must fail rather than hand a fabricated value to a
 * comparison.
 */
export function toUtcIsoString(dt: DateTime): string {
  const iso = dt.toUTC().toISO();
  if (iso === null) {
    throw new RangeError('Cannot format an invalid DateTime as an ISO timestamp');
  }
  return iso;
}

/**
 * Compute the start of a given date (YYYY-MM-DD) in the specified timezone and
 * return it as a UTC ISO timestamp. Falls back to UTC for an invalid or absent
 * timezone; a date that is not a real calendar day is rejected.
 */
export function startOfDayInUtc(dateStr: string, tz?: string): string {
  const zone = tz && DateTime.now().setZone(tz).isValid ? tz : 'UTC';
  return toUtcIsoString(DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone }).startOf('day'));
}

/**
 * Compute the start of the day *after* a given date (YYYY-MM-DD) in the
 * specified timezone and return it as a UTC ISO timestamp.
 *
 * The upper bound of a calendar range is the start of the next day rather than
 * the last instant of the given day, so a 23- or 25-hour DST day is covered
 * exactly instead of losing or double-counting an hour.
 */
export function startOfNextDayInUtc(dateStr: string, tz?: string): string {
  const zone = tz && DateTime.now().setZone(tz).isValid ? tz : 'UTC';
  const nextDay = DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone }).plus({ days: 1 });
  return toUtcIsoString(nextDay.startOf('day'));
}

/**
 * A half-open range of instants: `start` is included, `end` is excluded.
 */
export interface CalendarInstantRange {
  /** Inclusive lower bound, as a UTC ISO instant. */
  start: string;
  /** Exclusive upper bound, as a UTC ISO instant. */
  end: string;
}

/**
 * Convert a range of calendar dates into the half-open instant range that the
 * events query filters on.
 *
 * `from` and `to` are calendar dates in the reader's zone, while `start_at`
 * and `end_at` are absolute instants, so the range has to cross the zone
 * boundary before it can be compared against stored rows.
 *
 * An inverted range is not an error: it yields a range whose upper bound is at
 * or below its lower bound, and the strict overlap predicate then matches
 * nothing.
 */
export function calendarRangeToInstants(
  from: string,
  to: string,
  tz?: string,
): CalendarInstantRange {
  return {
    start: startOfDayInUtc(from, tz),
    end: startOfNextDayInUtc(to, tz),
  };
}
