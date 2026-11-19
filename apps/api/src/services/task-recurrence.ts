import { DateTime } from 'luxon';
import type { RecurrenceRule } from '@yotara/shared';
import { AppError } from '../lib/app-error.js';

export function advanceDueDate(from: string, rule: RecurrenceRule): string {
  const dt = DateTime.fromISO(from, { zone: 'utc' });
  const { frequency, interval, daysOfWeek } = rule;
  const n = interval || 1;

  let next: DateTime;

  switch (frequency) {
    case 'daily': {
      next = dt.plus({ days: n });
      break;
    }
    case 'weekdays': {
      next = dt.plus({ days: 1 });
      while (next.weekday > 5) next = next.plus({ days: 1 });
      break;
    }
    case 'weekly': {
      if (daysOfWeek && daysOfWeek.length > 0) {
        // RRULE: count weeks from DTSTART (dt), find next BYDAY in week where weekNum % n === 0
        next = dt.plus({ days: 1 });
        for (let i = 0; i < 60; i++) {
          const hoursSinceDtstart = next.diff(dt, 'hours').hours;
          const weekNum = Math.floor(hoursSinceDtstart / 24 / 7);
          const jsDay = next.weekday === 7 ? 0 : next.weekday;
          if (weekNum % n === 0 && daysOfWeek.includes(jsDay)) break;
          next = next.plus({ days: 1 });
        }
      } else {
        next = dt.plus({ weeks: n });
      }
      break;
    }
    case 'monthly': {
      next = dt.plus({ months: n });
      break;
    }
    case 'yearly': {
      next = dt.plus({ years: n });
      break;
    }
    default:
      next = dt;
  }

  const result = next.toISO({ suppressMilliseconds: true });
  if (!result) throw new AppError(500, 'Failed to format date');
  return result;
}
