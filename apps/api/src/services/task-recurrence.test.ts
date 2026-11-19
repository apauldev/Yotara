import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceDueDate } from './task-recurrence.js';

test('task-recurrence: daily advances by n days', () => {
  const next = advanceDueDate('2026-11-19T10:00:00Z', {
    frequency: 'daily',
    interval: 1,
  });
  assert.equal(next, '2026-11-20T10:00:00Z');

  const nextThree = advanceDueDate('2026-11-19T10:00:00Z', {
    frequency: 'daily',
    interval: 3,
  });
  assert.equal(nextThree, '2026-11-22T10:00:00Z');
});

test('task-recurrence: weekdays skips Saturday and Sunday', () => {
  // Friday -> skips Sat, Sun -> lands on Monday
  const next = advanceDueDate('2026-11-20T10:00:00Z', {
    frequency: 'weekdays',
    interval: 1,
  });
  assert.equal(next, '2026-11-23T10:00:00Z');
});

test('task-recurrence: monthly advances by n months and handles month-end clamping', () => {
  const jan31 = '2026-01-31T10:00:00Z';
  const feb = advanceDueDate(jan31, {
    frequency: 'monthly',
    interval: 1,
  });
  assert.equal(feb, '2026-02-28T10:00:00Z');
});

test('task-recurrence: yearly leap year handling', () => {
  const leapDay = '2028-02-29T10:00:00Z';
  const nonLeapNextYear = advanceDueDate(leapDay, {
    frequency: 'yearly',
    interval: 1,
  });
  assert.equal(nonLeapNextYear, '2029-02-28T10:00:00Z');
});
