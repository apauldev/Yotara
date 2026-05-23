import { parseCalendarDate, startOfToday } from './timestamps';
import { DateTime, Settings } from 'luxon';

describe('parseCalendarDate', () => {
  it('parses date-only strings as local calendar dates', () => {
    const parsed = parseCalendarDate('2026-05-20');

    expect(parsed).toBeTruthy();
    expect(parsed?.year).toBe(2026);
    expect(parsed?.month).toBe(5);
    expect(parsed?.day).toBe(20);
  });

  it('parses full ISO strings to local calendar dates', () => {
    const parsed = parseCalendarDate('2026-05-20T12:30:00.000Z');

    expect(parsed).toBeTruthy();
    expect(parsed?.year).toBe(2026);
    expect(parsed?.month).toBe(5);
    expect(parsed?.day).toBe(20);
  });

  it('returns null for invalid dates', () => {
    expect(parseCalendarDate('invalid-date')).toBeNull();
  });

  it('returns null for empty or null input', () => {
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate(undefined)).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
  });

  it('parses dates at year boundaries correctly', () => {
    const newYearsEve = parseCalendarDate('2025-12-31');
    expect(newYearsEve?.year).toBe(2025);
    expect(newYearsEve?.month).toBe(12);
    expect(newYearsEve?.day).toBe(31);

    const newYearsDay = parseCalendarDate('2026-01-01');
    expect(newYearsDay?.year).toBe(2026);
    expect(newYearsDay?.month).toBe(1);
    expect(newYearsDay?.day).toBe(1);

    // Day diff should be 1
    expect(newYearsDay!.diff(newYearsEve!, 'days').days).toBe(1);
  });

  it('parses leap day correctly', () => {
    const leapDay = parseCalendarDate('2024-02-29');
    expect(leapDay?.year).toBe(2024);
    expect(leapDay?.month).toBe(2);
    expect(leapDay?.day).toBe(29);
  });

  it('supports DateTime comparison operators for overdue/today/upcoming logic', () => {
    const today = startOfToday();
    const yesterday = parseCalendarDate(today.minus({ days: 1 }).toFormat('yyyy-MM-dd'))!;
    const tomorrow = parseCalendarDate(today.plus({ days: 1 }).toFormat('yyyy-MM-dd'))!;

    expect(yesterday < today).toBeTrue();
    expect(today.equals(today)).toBeTrue();
    expect(tomorrow > today).toBeTrue();
  });
});

describe('startOfToday', () => {
  it('returns today at midnight in local timezone', () => {
    const today = startOfToday();

    expect(today.hour).toBe(0);
    expect(today.minute).toBe(0);
    expect(today.second).toBe(0);
    expect(today.millisecond).toBe(0);
  });

  it('is between yesterday and tomorrow', () => {
    const today = startOfToday();
    const now = DateTime.local();

    expect(today <= now).toBeTrue();
    expect(today >= now.startOf('day')).toBeTrue();
  });
});
