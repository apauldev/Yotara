import { DateTime } from 'luxon';

/**
 * Parse an ISO date or date-only string into a Luxon DateTime.
 * Date-only strings ('2026-05-20') are parsed in the local timezone.
 * Full ISO strings keep their calendar date portion so UTC timestamps do not
 * shift a day when viewed in a different local timezone.
 * Returns null for invalid or empty input.
 */
export function parseCalendarDate(value?: string | null): DateTime | null {
  if (!value) {
    return null;
  }

  const datePart = value.trim().slice(0, 10);
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = DateTime.local(Number(year), Number(month), Number(day));
    return parsed.isValid ? parsed : null;
  }

  return null;
}

export function startOfToday(): DateTime {
  const now = DateTime.local();
  return DateTime.local(now.year, now.month, now.day);
}
