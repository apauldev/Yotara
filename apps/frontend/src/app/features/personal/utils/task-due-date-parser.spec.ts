import { DateTime } from 'luxon';
import { parseTaskDueDate } from './task-due-date-parser';

const monday = DateTime.fromObject({ year: 2026, month: 9, day: 28 }, { zone: 'UTC' });
const friday = DateTime.fromObject({ year: 2026, month: 9, day: 25 }, { zone: 'UTC' });

function expectDate(input: string, dueDate: string, reference: DateTime = monday): void {
  const result = parseTaskDueDate(input, reference);

  expect(result.status).toBe('date');
  expect(result.dueDate).toBe(dueDate);
  expect(result.referenceDate).toBe(reference.toISODate());
  expect(result.matchedText).not.toBeNull();
  expect(result.matchStart).not.toBeNull();
  expect(result.matchEnd).not.toBeNull();
  expect(input.slice(result.matchStart!, result.matchEnd!)).toBe(result.matchedText!);
}

function expectNoDate(input: string, reference: DateTime = monday): void {
  const result = parseTaskDueDate(input, reference);
  expect(result.dueDate).toBeNull();
}

describe('parseTaskDueDate', () => {
  describe('supported date-only phrases', () => {
    it('resolves today and tomorrow from the supplied local date', () => {
      expectDate('Call Sam today', '2026-09-28');
      expectDate('Call Sam tomorrow', '2026-09-29');
    });

    it('resolves positive relative day offsets', () => {
      expectDate('Call Sam in 3 days', '2026-10-01');
      expectDate('Follow up in 30 days.', '2026-10-28');
    });

    it('resolves a bare weekday to the first occurrence on or after today', () => {
      expectDate('Call Sam Friday', '2026-10-02');
      expectDate('Call Sam on Friday', '2026-10-02');
    });

    it('resolves next weekday strictly after today', () => {
      const thursday = DateTime.fromObject({ year: 2026, month: 9, day: 24 }, { zone: 'UTC' });
      expectDate('Call Sam next Friday', '2026-10-02', monday);
      expectDate('Call Sam next Friday', '2026-10-02', friday);
      expectDate('Call Sam next Friday', '2026-09-25', thursday);
    });

    it('resolves a weekday on the reference day to today when it is bare', () => {
      expectDate('Call Sam Friday', '2026-09-25', friday);
    });

    it('supports month-name dates in month-first and day-first forms', () => {
      expectDate('Call Sam Oct 12', '2026-10-12');
      expectDate('Call Sam 12 Oct', '2026-10-12');
      expectDate('Call Sam 12 Oct 2026', '2026-10-12');
      expectDate('Call Sam on October 12, 2026', '2026-10-12');
    });

    it('preserves an explicit year, including a past year', () => {
      expectDate('Review Oct 12, 2025', '2025-10-12');
    });

    it('rolls a yearless month-name date to the next occurrence', () => {
      const december = DateTime.fromObject({ year: 2026, month: 12, day: 31 }, { zone: 'UTC' });
      expectDate('Plan Oct 12', '2027-10-12', december);
    });

    it('finds the next leap day for a yearless February 29 phrase', () => {
      expectDate('Plan Feb 29', '2028-02-29');
    });

    it('accepts a date followed by punctuation or inline commands', () => {
      expectDate('Call Sam Friday.', '2026-10-02');
      expectDate('Call Sam Friday #work !high', '2026-10-02');
      expectNoDate('Call Sam on Friday, then follow up');
    });

    it('accepts supported phrases at the beginning of a title', () => {
      expectDate('today', '2026-09-28');
      expectDate('Friday', '2026-10-02');
      expectDate('on Friday', '2026-10-02');
      expectDate('next Friday', '2026-10-02');
      expectDate('in 3 days', '2026-10-01');
      expectDate('Oct 12', '2026-10-12');
      expectDate('!high today', '2026-09-28');
      expectDate('#work Friday', '2026-10-02');
    });

    it('does not confuse a date with a date-like label command', () => {
      expectDate('Call Sam Friday #friday', '2026-10-02');
      expectNoDate('Call Sam #friday');
    });
  });

  describe('rejected time, recurrence, range, and context', () => {
    it('rejects clock and vague-time phrases', () => {
      expect(parseTaskDueDate('Call Sam Friday at 3pm', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam Friday morning', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam tonight', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam Friday EOD', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam Friday UTC', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam Oct 12 PST', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam tomorrow morning', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam at 3pm', monday).status).toBe('time');
    });

    it('rejects time and URL cues before an otherwise valid date phrase', () => {
      expect(parseTaskDueDate('Call Sam morning Friday', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam at Friday', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam UTC Friday', monday).status).toBe('time');
      expect(parseTaskDueDate('Call Sam 3pm Friday', monday).status).toBe('time');
      expectNoDate('Call Sam https://example.com?date=Friday');
      expectNoDate('Call Sam www.example.com?date=Friday');
    });

    it('rejects natural-language recurrence without populating a due date', () => {
      expect(parseTaskDueDate('Call Sam every Friday', monday).status).toBe('recurring');
      expect(parseTaskDueDate('Call Sam each Friday', monday).status).toBe('recurring');
      expect(parseTaskDueDate('Call Sam every other Friday', monday).status).toBe('recurring');
    });

    it('rejects ranges and multiple candidates', () => {
      expect(parseTaskDueDate('Call Sam Oct 12-13', monday).status).toBe('range');
      expect(['multiple', 'range']).toContain(
        parseTaskDueDate('Call Sam Friday-Monday', monday).status,
      );
      expect(parseTaskDueDate('Discuss Friday and Monday', monday).status).toBe('multiple');
    });

    it('rejects unsupported relative and weekday modifiers', () => {
      expectNoDate('Call Sam yesterday');
      expectNoDate('Call Sam last Friday');
      expectNoDate('Call Sam this Friday');
      expectNoDate('Call Sam next week');
      expectNoDate('Call Sam day after tomorrow');
      expectNoDate('Call Sam Friday after next');
    });

    it('rejects standalone month names, slash dates, and ISO dates', () => {
      expectNoDate('Call Sam May');
      expectNoDate('Call Sam 12/03/2026');
      expectNoDate('Call Sam 2026-10-12');
    });

    it('rejects date-like words in ordinary title context', () => {
      expectNoDate('Read Friday notes');
      expect(parseTaskDueDate("Read Friday's novel", monday).status).toBe('unsupported');
      expect(parseTaskDueDate('Call Sam on Friday with notes', monday).status).toBe('unsupported');
      expect(parseTaskDueDate('Call Sam https://example.com/Friday', monday).status).toBe(
        'unsupported',
      );
      expect(parseTaskDueDate('Call Sam Friday@example.com', monday).status).toBe('unsupported');
    });

    it('rejects invalid and out-of-range relative dates', () => {
      expect(parseTaskDueDate('Call Sam Feb 30', monday).status).toBe('invalid');
      expect(parseTaskDueDate('Call Sam 2026-13-01', monday).status).toBe('invalid');
      expect(parseTaskDueDate('Call Sam 2026-02-30', monday).status).toBe('invalid');
      expectNoDate('Call Sam in 0 days');
      expectNoDate('Call Sam in -3 days');
      expectNoDate('Call Sam in 3.5 days');
      expectNoDate('Call Sam in 999999 days');
    });
  });

  describe('reference and safety guarantees', () => {
    it('does not change its result based on the reference time of day', () => {
      const early = DateTime.fromISO('2026-09-28T00:01:00', { zone: 'UTC' });
      const late = DateTime.fromISO('2026-09-28T23:59:00', { zone: 'UTC' });

      expectDate('Call Sam today', '2026-09-28', early);
      expectDate('Call Sam today', '2026-09-28', late);
      expectDate('Call Sam tomorrow', '2026-09-29', early);
      expectDate('Call Sam tomorrow', '2026-09-29', late);
    });

    it('keeps the same local calendar result in a non-UTC zone', () => {
      const losAngeles = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'America/Los_Angeles' },
      );
      expectDate('Call Sam tomorrow', '2026-09-29', losAngeles);
    });

    it('fails closed for an invalid reference date', () => {
      const result = parseTaskDueDate('Call Sam Friday', DateTime.invalid('bad reference'));
      expect(result.status).toBe('unsupported');
      expect(result.dueDate).toBeNull();
      expect(result.referenceDate).toBeNull();
    });

    it('returns no date for ordinary task text', () => {
      const result = parseTaskDueDate('Call Sam about the project', monday);
      expect(result.status).toBe('none');
      expect(result.dueDate).toBeNull();
    });
  });
});
