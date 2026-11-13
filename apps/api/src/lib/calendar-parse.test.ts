import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToPlainText, parseCalendarFeed, parseDuration } from './calendar-parse.js';

const WINDOW = { start: '2026-03-01T00:00:00.000Z', end: '2026-03-15T00:00:00.000Z' };

function feed(...events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yotara//tests//EN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function event(body: string): string {
  return ['BEGIN:VEVENT', body, 'END:VEVENT'].join('\r\n');
}

function parse(body: string, options: { window?: typeof WINDOW; maxInstances?: number } = {}) {
  return parseCalendarFeed(body, {
    window: options.window ?? WINDOW,
    ...(options.maxInstances === undefined ? {} : { maxInstances: options.maxInstances }),
  });
}

describe('parseDuration', () => {
  it('parses hours and minutes', () => {
    assert.deepEqual(parseDuration('PT1H30M'), { days: 0, seconds: 5400 });
  });

  it('parses days and weeks', () => {
    assert.deepEqual(parseDuration('P2D'), { days: 2, seconds: 0 });
    assert.deepEqual(parseDuration('P1W'), { days: 7, seconds: 0 });
  });

  it('parses a combined duration', () => {
    assert.deepEqual(parseDuration('P1DT2H30M'), { days: 1, seconds: 9000 });
  });

  it('rejects a value that is not a duration', () => {
    assert.equal(parseDuration('tomorrow'), null);
    assert.equal(parseDuration('P'), null);
  });
});

describe('htmlToPlainText', () => {
  it('strips tags', () => {
    assert.equal(htmlToPlainText('<p>Hello <b>there</b></p>'), 'Hello there');
  });

  it('turns line breaks into newlines', () => {
    assert.equal(htmlToPlainText('One<br>Two'), 'One\nTwo');
  });

  it('decodes entities', () => {
    assert.equal(htmlToPlainText('Fish &amp; chips'), 'Fish & chips');
    assert.equal(htmlToPlainText('&lt;tag&gt;'), '<tag>');
  });

  it('drops the contents of a script block', () => {
    assert.equal(htmlToPlainText('a<script>alert(1)</script>b'), 'ab');
  });
});

describe('parseCalendarFeed — the shape of a time', () => {
  it('stores a UTC time as the instant it names', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Utc',
            'DTSTART:20260303T090000Z',
            'DTEND:20260303T100000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].startAt, '2026-03-03T09:00:00.000Z');
    assert.equal(result.events[0].endAt, '2026-03-03T10:00:00.000Z');
    assert.equal(result.events[0].floating, false);
    assert.equal(result.events[0].timezone, 'UTC');
    assert.equal(result.events[0].allDay, false);
  });

  it('stores a zoned time as the instant it names', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Zoned',
            'DTSTART;TZID=America/New_York:20260303T090000',
            'DTEND;TZID=America/New_York:20260303T100000',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].startAt, '2026-03-03T14:00:00.000Z');
    assert.equal(result.events[0].timezone, 'America/New_York');
    assert.equal(result.events[0].floating, false);
  });

  it('stores a floating time as its own wall clock read as UTC', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Floating',
            'DTSTART:20260303T090000',
            'DTEND:20260303T100000',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].startAt, '2026-03-03T09:00:00.000Z');
    assert.equal(result.events[0].floating, true);
    assert.equal(result.events[0].timezone, null);
  });

  it('stores an all-day event with display dates and an exclusive end', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Offsite',
            'DTSTART;VALUE=DATE:20260303',
            'DTEND;VALUE=DATE:20260305',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].allDay, true);
    assert.equal(result.events[0].startDate, '2026-03-03');
    assert.equal(result.events[0].endDate, '2026-03-05');
    assert.equal(result.events[0].startAt, '2026-03-03T00:00:00.000Z');
    assert.equal(result.events[0].endAt, '2026-03-05T00:00:00.000Z');
  });

  it('gives an all-day event without an end a single day', () => {
    const result = parse(
      feed(event(['UID:a@example.com', 'SUMMARY:Day', 'DTSTART;VALUE=DATE:20260303'].join('\r\n'))),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].startDate, '2026-03-03');
    assert.equal(result.events[0].endDate, '2026-03-04');
  });

  it('computes the end from a duration', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:With duration',
            'DTSTART:20260303T090000Z',
            'DURATION:PT1H30M',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].endAt, '2026-03-03T10:30:00.000Z');
  });

  it('treats an unknown zone as floating rather than dropping the event', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Custom zone',
            'DTSTART;TZID=Custom/Zone:20260303T090000',
            'DTEND;TZID=Custom/Zone:20260303T100000',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].floating, true);
    assert.equal(result.events[0].startAt, '2026-03-03T09:00:00.000Z');
  });
});

describe('parseCalendarFeed — recurrence', () => {
  it('expands a daily rule inside the window', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RRULE:FREQ=DAILY;COUNT=5',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 5);
    assert.equal(result.events[0].startAt, '2026-03-01T09:00:00.000Z');
    assert.equal(result.events[4].startAt, '2026-03-05T09:00:00.000Z');
  });

  it('gives every instance of a rule its own key', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RRULE:FREQ=DAILY;COUNT=3',
          ].join('\r\n'),
        ),
      ),
    );

    const keys = result.events.map((entry) => entry.recurrenceId);
    assert.deepEqual(keys, [
      '2026-03-01T09:00:00.000Z',
      '2026-03-02T09:00:00.000Z',
      '2026-03-03T09:00:00.000Z',
    ]);
    assert.equal(new Set(keys).size, 3);
  });

  it('keeps a recurring event at the same local time across a DST change', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Standup',
            'DTSTART;TZID=America/New_York:20260306T090000',
            'DTEND;TZID=America/New_York:20260306T093000',
            'RRULE:FREQ=DAILY;COUNT=6',
          ].join('\r\n'),
        ),
      ),
      { window: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-20T00:00:00.000Z' } },
    );

    assert.equal(result.events.length, 6);
    // Before the March 8 transition New York is UTC-5.
    assert.equal(result.events[1].startAt, '2026-03-07T14:00:00.000Z');
    // After it, New York is UTC-4 — the local time has not moved.
    assert.equal(result.events[2].startAt, '2026-03-08T13:00:00.000Z');
  });

  it('leaves out the instances that fall outside the window', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260201T090000Z',
            'DTEND:20260201T093000Z',
            'RRULE:FREQ=DAILY',
          ].join('\r\n'),
        ),
      ),
      { window: { start: '2026-03-10T00:00:00.000Z', end: '2026-03-12T00:00:00.000Z' } },
    );

    assert.equal(result.events.length, 2);
    assert.equal(result.events[0].startAt, '2026-03-10T09:00:00.000Z');
    assert.equal(result.events[1].startAt, '2026-03-11T09:00:00.000Z');
  });

  it('honours an EXDATE', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RRULE:FREQ=DAILY;COUNT=4',
            'EXDATE:20260302T090000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 3);
    assert.ok(!result.events.some((entry) => entry.startAt === '2026-03-02T09:00:00.000Z'));
  });

  it('honours an RDATE', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:One off',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RDATE:20260305T110000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 2);
    assert.ok(result.events.some((entry) => entry.startAt === '2026-03-05T11:00:00.000Z'));
  });

  it('replaces an instance with its RECURRENCE-ID override', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RRULE:FREQ=DAILY;COUNT=3',
          ].join('\r\n'),
        ),
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Moved',
            'RECURRENCE-ID:20260302T090000Z',
            'DTSTART:20260302T140000Z',
            'DTEND:20260302T150000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 3);
    const overridden = result.events.find(
      (entry) => entry.recurrenceId === '2026-03-02T09:00:00.000Z',
    );
    assert.ok(overridden);
    assert.equal(overridden.summary, 'Moved');
    assert.equal(overridden.startAt, '2026-03-02T14:00:00.000Z');
  });

  it('keeps an override that cancels its instance out of the set', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RRULE:FREQ=DAILY;COUNT=3',
          ].join('\r\n'),
        ),
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Cancelled',
            'RECURRENCE-ID:20260302T090000Z',
            'DTSTART:20260302T090000Z',
            'DTEND:20260302T093000Z',
            'STATUS:CANCELLED',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 2);
    assert.ok(!result.events.some((entry) => entry.startAt === '2026-03-02T09:00:00.000Z'));
  });

  it('skips an event that is cancelled outright', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Gone',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'STATUS:CANCELLED',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 0);
  });
});

describe('parseCalendarFeed — text and identity', () => {
  it('keeps the summary, description, and location', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Team sync',
            'DESCRIPTION:Line one\\nLine two',
            'LOCATION:Room 3',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].summary, 'Team sync');
    assert.equal(result.events[0].description, 'Line one\nLine two');
    assert.equal(result.events[0].location, 'Room 3');
  });

  it('reduces an HTML description to plain text', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Team sync',
            'DESCRIPTION:<p>Hello <b>there</b></p>',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events[0].description, 'Hello there');
  });

  it('gives a standalone event an empty instance key', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Once',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
          ].join('\r\n'),
        ),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].recurrenceId, '');
  });

  it('gives an event without a UID a stable identity', () => {
    const body = feed(
      event(
        ['SUMMARY:No identity', 'DTSTART:20260301T090000Z', 'DTEND:20260301T093000Z'].join('\r\n'),
      ),
    );

    const first = parse(body);
    const second = parse(body);

    assert.equal(first.events.length, 1);
    assert.equal(first.events[0].uid, second.events[0].uid);
    assert.ok(first.events[0].uid.length > 0);
  });

  it('gives two events without a UID different identities', () => {
    const result = parse(
      feed(
        event(['SUMMARY:One', 'DTSTART:20260301T090000Z', 'DTEND:20260301T093000Z'].join('\r\n')),
        event(['SUMMARY:Two', 'DTSTART:20260301T100000Z', 'DTEND:20260301T110000Z'].join('\r\n')),
      ),
    );

    assert.equal(result.events.length, 2);
    assert.notEqual(result.events[0].uid, result.events[1].uid);
  });
});

describe('parseCalendarFeed — resilience', () => {
  it('skips a malformed event and keeps the good ones', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:good@example.com',
            'SUMMARY:Good',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
          ].join('\r\n'),
        ),
        event(['UID:bad@example.com', 'SUMMARY:Bad', 'DTSTART:not-a-date'].join('\r\n')),
      ),
    );

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].summary, 'Good');
    assert.equal(result.skippedEvents, 1);
  });

  it('skips an event with no start at all', () => {
    const result = parse(feed(event(['UID:bad@example.com', 'SUMMARY:Bad'].join('\r\n'))));

    assert.equal(result.events.length, 0);
    assert.equal(result.skippedEvents, 1);
  });

  it('stops at the instance cap and says so', () => {
    const result = parse(
      feed(
        event(
          [
            'UID:a@example.com',
            'SUMMARY:Daily',
            'DTSTART:20260301T090000Z',
            'DTEND:20260301T093000Z',
            'RRULE:FREQ=DAILY;COUNT=20',
          ].join('\r\n'),
        ),
      ),
      { maxInstances: 5 },
    );

    assert.equal(result.events.length, 5);
    assert.equal(result.truncated, true);
  });

  it('reports a feed it cannot parse', () => {
    assert.throws(() => parse('this is not a calendar'), /could not be parsed/i);
  });

  it('reports an invalid window', () => {
    assert.throws(
      () =>
        parseCalendarFeed(feed(), {
          window: { start: 'not-a-date', end: '2026-03-15T00:00:00.000Z' },
        }),
      /valid range of instants/i,
    );
  });

  it('ignores components other than VEVENT', () => {
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTODO',
      'UID:todo@example.com',
      'SUMMARY:Not an event',
      'DTSTART:20260301T090000Z',
      'END:VTODO',
      'BEGIN:VEVENT',
      'UID:a@example.com',
      'SUMMARY:Real',
      'DTSTART:20260301T090000Z',
      'DTEND:20260301T093000Z',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');

    const result = parse(body);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].summary, 'Real');
  });
});
