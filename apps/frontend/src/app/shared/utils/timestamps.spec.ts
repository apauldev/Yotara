import { parseCalendarDate } from './timestamps';

describe('parseCalendarDate', () => {
  it('parses date-only strings as local calendar dates', () => {
    const parsed = parseCalendarDate('2026-05-20');

    expect(parsed).toBeTruthy();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(20);
  });

  it('parses full ISO strings to local calendar dates', () => {
    const parsed = parseCalendarDate('2026-05-20T12:30:00.000Z');

    expect(parsed).toBeTruthy();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(20);
  });

  it('returns null for invalid dates', () => {
    expect(parseCalendarDate('invalid-date')).toBeNull();
  });
});
