import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projectEventToZone } from './calendar-local.js';

function stored(overrides: Partial<Parameters<typeof projectEventToZone>[0]> = {}) {
  return {
    startAt: '2026-11-13T09:00:00.000Z',
    endAt: '2026-11-13T10:00:00.000Z',
    allDay: false,
    startDate: null,
    endDate: null,
    floating: false,
    ...overrides,
  };
}

describe('projectEventToZone — absolute events', () => {
  it('projects the instant into the reader’s zone', () => {
    const result = projectEventToZone(stored(), 'America/New_York');
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
    assert.equal(result.startTime, '04:00');
    assert.equal(result.endTime, '05:00');
  });

  it('projects into a zone ahead of UTC', () => {
    const result = projectEventToZone(stored(), 'Pacific/Auckland');
    assert.equal(result.startTime, '22:00');
    assert.equal(result.endTime, '23:00');
  });

  it('moves the day when the instant falls on the previous day locally', () => {
    const result = projectEventToZone(
      stored({ startAt: '2026-11-13T02:00:00.000Z', endAt: '2026-11-13T03:00:00.000Z' }),
      'America/Los_Angeles',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-12']);
    assert.equal(result.startTime, '18:00');
    assert.equal(result.endTime, '19:00');
  });

  it('falls back to UTC for an unknown zone', () => {
    const result = projectEventToZone(stored(), 'Not/AZone');
    assert.equal(result.startTime, '09:00');
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
  });

  it('falls back to UTC when no zone is given', () => {
    const result = projectEventToZone(stored());
    assert.equal(result.startTime, '09:00');
  });

  it('gives an empty projection for an unreadable instant', () => {
    const result = projectEventToZone(stored({ startAt: 'not-a-date' }), 'UTC');
    assert.deepEqual(result.dayKeys, []);
    assert.equal(result.startTime, null);
  });
});

describe('projectEventToZone — multi-day events', () => {
  it('occupies every day it spans', () => {
    const result = projectEventToZone(
      stored({
        startAt: '2026-11-12T09:00:00.000Z',
        endAt: '2026-11-15T17:00:00.000Z',
      }),
      'UTC',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  });

  it('does not claim the day an event ends on at midnight', () => {
    const result = projectEventToZone(
      stored({
        startAt: '2026-11-12T09:00:00.000Z',
        endAt: '2026-11-14T00:00:00.000Z',
      }),
      'UTC',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-12', '2026-11-13']);
  });

  it('splits the days across the reader’s zone', () => {
    // 21:00 in New York on the 13th, running to 03:00 on the 14th.
    const result = projectEventToZone(
      stored({
        startAt: '2026-11-14T02:00:00.000Z',
        endAt: '2026-11-14T08:00:00.000Z',
      }),
      'America/New_York',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-13', '2026-11-14']);
    assert.equal(result.startTime, '21:00');
    assert.equal(result.endTime, '03:00');
  });

  it('keeps an event on one day when the reader’s zone does not move it', () => {
    const result = projectEventToZone(
      stored({
        startAt: '2026-11-13T23:00:00.000Z',
        endAt: '2026-11-14T02:00:00.000Z',
      }),
      'America/New_York',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
    assert.equal(result.startTime, '18:00');
    assert.equal(result.endTime, '21:00');
  });
});

describe('projectEventToZone — floating events', () => {
  it('reads the stored wall clock without shifting it', () => {
    const result = projectEventToZone(
      stored({
        floating: true,
        startAt: '2026-11-13T09:00:00.000Z',
        endAt: '2026-11-13T10:00:00.000Z',
      }),
      'Pacific/Auckland',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
    assert.equal(result.startTime, '09:00');
    assert.equal(result.endTime, '10:00');
  });

  it('does not shift a 09:00 standup for a reader east of UTC', () => {
    const result = projectEventToZone(
      stored({
        floating: true,
        startAt: '2026-11-13T09:00:00.000Z',
        endAt: '2026-11-13T09:30:00.000Z',
      }),
      'Asia/Tokyo',
    );
    assert.equal(result.startTime, '09:00');
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
  });

  it('does not shift a 09:00 standup for a reader west of UTC', () => {
    const result = projectEventToZone(
      stored({
        floating: true,
        startAt: '2026-11-13T09:00:00.000Z',
        endAt: '2026-11-13T09:30:00.000Z',
      }),
      'America/Los_Angeles',
    );
    assert.equal(result.startTime, '09:00');
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
  });

  it('still spans every day a floating event covers', () => {
    const result = projectEventToZone(
      stored({
        floating: true,
        startAt: '2026-11-12T09:00:00.000Z',
        endAt: '2026-11-15T17:00:00.000Z',
      }),
      'UTC',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  });
});

describe('projectEventToZone — all-day events', () => {
  it('uses the stored display dates, not the instants', () => {
    const result = projectEventToZone(
      stored({
        allDay: true,
        startAt: '2026-11-13T00:00:00.000Z',
        endAt: '2026-11-15T00:00:00.000Z',
        startDate: '2026-11-13',
        endDate: '2026-11-15',
      }),
      'Pacific/Auckland',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-13', '2026-11-14']);
    assert.equal(result.startTime, null);
    assert.equal(result.endTime, null);
  });

  it('covers a single day', () => {
    const result = projectEventToZone(
      stored({
        allDay: true,
        startAt: '2026-11-13T00:00:00.000Z',
        endAt: '2026-11-14T00:00:00.000Z',
        startDate: '2026-11-13',
        endDate: '2026-11-14',
      }),
      'UTC',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
  });

  it('falls back to the instants when the display dates are missing', () => {
    const result = projectEventToZone(
      stored({
        allDay: true,
        startAt: '2026-11-13T00:00:00.000Z',
        endAt: '2026-11-15T00:00:00.000Z',
        startDate: null,
        endDate: null,
      }),
      'UTC',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-13', '2026-11-14']);
  });
});

describe('projectEventToZone — DST boundaries', () => {
  it('keeps an event on one day across a spring-forward transition', () => {
    // 2026-03-08 is a 23-hour day in New York.
    const result = projectEventToZone(
      stored({
        startAt: '2026-03-08T05:00:00.000Z',
        endAt: '2026-03-09T04:00:00.000Z',
      }),
      'America/New_York',
    );
    assert.deepEqual(result.dayKeys, ['2026-03-08']);
  });

  it('keeps an event on one day across a fall-back transition', () => {
    // 2026-11-01 is a 25-hour day in New York.
    const result = projectEventToZone(
      stored({
        startAt: '2026-11-01T04:00:00.000Z',
        endAt: '2026-11-02T05:00:00.000Z',
      }),
      'America/New_York',
    );
    assert.deepEqual(result.dayKeys, ['2026-11-01']);
  });

  it('reads a wall clock at the far side of the date line', () => {
    const result = projectEventToZone(
      stored({ startAt: '2026-11-13T09:00:00.000Z', endAt: '2026-11-13T10:00:00.000Z' }),
      'Pacific/Kiritimati',
    );
    assert.equal(result.startTime, '23:00');
    assert.deepEqual(result.dayKeys, ['2026-11-13']);
  });

  it('reads a wall clock at the near side of the date line', () => {
    const result = projectEventToZone(
      stored({ startAt: '2026-11-13T09:00:00.000Z', endAt: '2026-11-13T10:00:00.000Z' }),
      'Pacific/Midway',
    );
    assert.equal(result.startTime, '22:00');
    assert.deepEqual(result.dayKeys, ['2026-11-12']);
  });
});
