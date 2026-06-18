import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { todayInTimezone, startOfDayInUtc } from './timezone.js';

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
});
