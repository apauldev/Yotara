import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayInTimezone,
  startOfDayInUtc,
  startOfNextDayInUtc,
  calendarRangeToInstants,
} from './timezone.js';

describe('todayInTimezone', () => {
  it('returns UTC date when tz is undefined', () => {
    const result = todayInTimezone(undefined);
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns UTC date when tz is empty string', () => {
    const result = todayInTimezone('');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns date in the specified timezone', () => {
    const result = todayInTimezone('UTC');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to UTC for invalid timezone', () => {
    const result = todayInTimezone('Not/A/Timezone');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('startOfDayInUtc', () => {
  it('returns UTC midnight ISO for a valid date with UTC tz', () => {
    const result = startOfDayInUtc('2026-06-18', 'UTC');
    assert.ok(result.startsWith('2026-06-18T00:00:00'));
    assert.ok(result.endsWith('Z'));
  });

  it('converts timezone-aware start of day to UTC', () => {
    const result = startOfDayInUtc('2026-06-18', 'America/New_York');
    assert.ok(result.startsWith('2026-06-18T04:00:00'));
    assert.ok(result.endsWith('Z'));
  });

  it('falls back to UTC for invalid timezone', () => {
    const result = startOfDayInUtc('2026-06-18', 'Invalid/Zone');
    assert.ok(result.includes('2026-06-18'));
  });

  it('falls back to UTC when tz is undefined', () => {
    const result = startOfDayInUtc('2026-06-18', undefined);
    assert.ok(result.includes('2026-06-18'));
  });

  it('rejects a date that is not a real calendar day', () => {
    assert.throws(() => startOfDayInUtc('not-a-date', 'UTC'), RangeError);
  });
});

describe('startOfNextDayInUtc', () => {
  it('returns the start of the following day in UTC', () => {
    const result = startOfNextDayInUtc('2026-06-18', 'UTC');
    assert.ok(result.startsWith('2026-06-19T00:00:00'));
    assert.ok(result.endsWith('Z'));
  });

  it('crosses the zone boundary', () => {
    const result = startOfNextDayInUtc('2026-06-18', 'America/New_York');
    assert.ok(result.startsWith('2026-06-19T04:00:00'));
    assert.ok(result.endsWith('Z'));
  });

  it('covers a 23-hour spring-forward day exactly', () => {
    const start = startOfDayInUtc('2026-03-08', 'America/New_York');
    const end = startOfNextDayInUtc('2026-03-08', 'America/New_York');
    const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
    assert.equal(hours, 23);
  });

  it('covers a 25-hour fall-back day exactly', () => {
    const start = startOfDayInUtc('2026-11-01', 'America/New_York');
    const end = startOfNextDayInUtc('2026-11-01', 'America/New_York');
    const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
    assert.equal(hours, 25);
  });

  it('falls back to UTC for an invalid timezone', () => {
    const result = startOfNextDayInUtc('2026-06-18', 'Invalid/Zone');
    assert.ok(result.startsWith('2026-06-19T00:00:00'));
  });

  it('rejects a date that is not a real calendar day', () => {
    assert.throws(() => startOfNextDayInUtc('not-a-date', 'UTC'), RangeError);
  });
});

describe('calendarRangeToInstants', () => {
  it('converts a date range into a half-open instant range', () => {
    const range = calendarRangeToInstants('2026-11-13', '2026-11-14', 'UTC');
    assert.equal(range.start, '2026-11-13T00:00:00.000Z');
    assert.equal(range.end, '2026-11-15T00:00:00.000Z');
  });

  it('crosses the zone boundary', () => {
    const range = calendarRangeToInstants('2026-11-13', '2026-11-13', 'America/New_York');
    assert.equal(range.start, '2026-11-13T05:00:00.000Z');
    assert.equal(range.end, '2026-11-14T05:00:00.000Z');
  });

  it('makes the range a whole day across a DST change', () => {
    const range = calendarRangeToInstants('2026-03-08', '2026-03-08', 'America/New_York');
    const hours = (Date.parse(range.end) - Date.parse(range.start)) / 3_600_000;
    assert.equal(hours, 23);
  });

  it('makes an inverted range empty rather than failing', () => {
    const range = calendarRangeToInstants('2026-11-14', '2026-11-13', 'UTC');
    assert.ok(Date.parse(range.end) <= Date.parse(range.start));
  });
});
