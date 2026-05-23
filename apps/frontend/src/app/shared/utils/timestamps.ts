import { DateTime } from 'luxon';

/**
 * Parse an ISO date or date-only string into a Luxon DateTime.
 * Date-only strings ('2026-05-20') are parsed in the local timezone.
 * Full ISO strings are parsed and then converted to start-of-day in local timezone.
 * Returns null for invalid or empty input.
 */
export function parseCalendarDate(value?: string | null): DateTime | null {
  if (!value) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return DateTime.local(Number(year), Number(month), Number(day));
  }

  const dt = DateTime.fromISO(value);
  if (!dt.isValid) {
    return null;
  }

  return DateTime.local(dt.year, dt.month, dt.day);
}

export function startOfToday(): DateTime {
  const now = DateTime.local();
  return DateTime.local(now.year, now.month, now.day);
}
