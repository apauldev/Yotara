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
 * Compute the start of a given date (YYYY-MM-DD) in the specified timezone
 * and return it as a UTC ISO timestamp (e.g. 2026-06-18T04:00:00.000Z).
 * Falls back to UTC if the timezone is invalid or undefined.
 */
export function startOfDayInUtc(dateStr: string, tz?: string): string {
  const zone = tz && DateTime.now().setZone(tz).isValid ? tz : 'UTC';
  const dt = DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone }).startOf('day');
  return dt.toUTC().toISO() || dt.toUTC().toString();
}
