import { DateTime } from 'luxon';
import { BadRequestError } from './app-error.js';

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calendar bounds are interpolated into the date range predicate, so they are
 * checked here rather than trusted from the route schema: a caller reaching
 * this service directly must not be able to pass an arbitrary string.
 *
 * This rule lives in `lib/` rather than inside `task-service.ts` because the
 * task service and the calendar event service share it. A service-private
 * helper must not be imported across a service boundary.
 */
export function assertCalendarDate(value: string, field: string): void {
  if (!CALENDAR_DATE_PATTERN.test(value) || !DateTime.fromISO(value, { zone: 'utc' }).isValid) {
    throw new BadRequestError(`${field} must be a calendar date (YYYY-MM-DD)`);
  }
}
