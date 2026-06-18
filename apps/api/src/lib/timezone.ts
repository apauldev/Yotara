import { DateTime } from 'luxon';

/**
 * Compute today's date (YYYY-MM-DD) in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid or undefined.
 */
export function todayInTimezone(tz?: string): string {
  if (!tz) {
    return DateTime.now().setZone('UTC').toFormat('yyyy-MM-dd');
  }
  const dt = DateTime.now().setZone(tz);
  const zone = dt.isValid ? tz : 'UTC';
  return DateTime.now().setZone(zone).toFormat('yyyy-MM-dd');
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
