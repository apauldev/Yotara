import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import ICAL from 'ical.js';
import { compile } from 'html-to-text';

/**
 * Parse an ICS feed into the concrete event instances that get stored.
 *
 * The design rule throughout this module is that **a recurrence is expanded in
 * wall-clock space, and only the finished occurrence is turned into an
 * instant**. A meeting that happens at 09:00 New York time stays at 09:00
 * local across a DST boundary, which is what a reader expects; expanding in
 * instant space would slide it to 08:00 or 10:00 once the clocks move.
 *
 * `ical.js` supplies the recurrence engine. The values it hands back for
 * `DTSTART` lose the `TZID` parameter — an unknown zone silently degrades to a
 * floating time — so the raw jCal value is read directly and the zone is
 * resolved separately.
 */

export interface CalendarEventInput {
  /** ICS `UID`, or a stable hash when the feed omits it. */
  uid: string;
  /** Instance key: `''` for a standalone event, otherwise the instance start. */
  recurrenceId: string;
  summary: string;
  description: string | null;
  location: string | null;
  /** UTC ISO instant. */
  startAt: string;
  /** UTC ISO instant, exclusive. */
  endAt: string;
  allDay: boolean;
  /** `YYYY-MM-DD`, for all-day display only. */
  startDate: string | null;
  /** `YYYY-MM-DD`, exclusive, for all-day display only. */
  endDate: string | null;
  /** The source's IANA zone, when it declared a known one. */
  timezone: string | null;
  /** True when the feed gave no zone: the stored time is the source's wall clock. */
  floating: boolean;
  status: string | null;
}

/** A half-open instant range: `start` is included, `end` is excluded. */
export interface CalendarParseWindow {
  /** Inclusive lower bound, UTC ISO instant. */
  start: string;
  /** Exclusive upper bound, UTC ISO instant. */
  end: string;
}

export interface ParseCalendarOptions {
  window: CalendarParseWindow;
  /** Maximum number of instances produced for the whole feed. */
  maxInstances?: number;
  /** Maximum number of recurrence steps examined for a single event. */
  maxIterations?: number;
}

export interface ParseCalendarResult {
  events: CalendarEventInput[];
  /** True when a limit cut the output short. */
  truncated: boolean;
  /** How many `VEVENT`s were skipped because they were malformed. */
  skippedEvents: number;
}

export const DEFAULT_MAX_INSTANCES = 10_000;
export const DEFAULT_MAX_ITERATIONS = 20_000;

// ─── Wall clock ─────────────────────────────────────────────────────────────

interface WallClock {
  year: number;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
  hour: number;
  minute: number;
  second: number;
}

type TimeKind =
  | { type: 'date' }
  | { type: 'utc' }
  | { type: 'zoned'; zone: string }
  | { type: 'floating' };

const RAW_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z)?)?$/;

function parseRawDateTime(value: string): { wall: WallClock; utc: boolean } | null {
  const match = RAW_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, zulu] = match;
  const wall: WallClock = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: hour ? Number(hour) : 0,
    minute: minute ? Number(minute) : 0,
    second: second ? Number(second) : 0,
  };

  if (wall.month < 1 || wall.month > 12 || wall.day < 1 || wall.day > 31) {
    return null;
  }
  if (wall.hour > 23 || wall.minute > 59 || wall.second > 59) {
    return null;
  }

  return { wall, utc: zulu === 'Z' };
}

function toDateTimeObject(wall: WallClock): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  return {
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour: wall.hour,
    minute: wall.minute,
    second: wall.second,
  };
}

/** Render a wall clock as a sortable ISO-like string, for hashing and keys. */
function wallToKey(wall: WallClock): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`;
}

/**
 * Resolve a wall clock to an instant.
 *
 * `zone` is the zone the wall clock belongs to. A `null` zone means the value
 * is floating and is read as UTC — the deterministic placeholder described in
 * the plan, whose UTC parts *are* the source's wall clock.
 */
function resolveInstant(wall: WallClock, zone: string | null): DateTime | null {
  const resolved = DateTime.fromObject(toDateTimeObject(wall), { zone: zone ?? 'UTC' });
  return resolved.isValid ? resolved : null;
}

function toUtcIso(dt: DateTime | null): string | null {
  if (!dt || !dt.isValid) {
    return null;
  }
  return dt.toUTC().toISO();
}

function resolveZone(tzid: string | null): { kind: TimeKind; timezone: string | null } {
  if (!tzid) {
    return { kind: { type: 'floating' }, timezone: null };
  }

  const candidate = DateTime.now().setZone(tzid);
  if (!candidate.isValid) {
    // A zone the server does not know is still a wall clock. Treating it as
    // floating keeps the time the feed intended instead of dropping the event.
    return { kind: { type: 'floating' }, timezone: null };
  }

  return { kind: { type: 'zoned', zone: tzid }, timezone: tzid };
}

// ─── Raw property access ────────────────────────────────────────────────────

/**
 * Read the raw jCal values of a property.
 *
 * `getFirstValue()` would hand back an `ICAL.Time` for a date-time, but that
 * value has already lost the `TZID` parameter, so the raw string is read
 * instead and the zone is resolved from the property parameters.
 */
function rawValues(property: ICAL.Property): string[] {
  const values: string[] = [];
  for (const value of property.jCal.slice(3)) {
    if (typeof value === 'string') {
      values.push(value);
    }
  }
  return values;
}

function firstRawValue(property: ICAL.Property): string | null {
  return rawValues(property)[0] ?? null;
}

function readText(component: ICAL.Component, name: string): string | null {
  const property = component.getFirstProperty(name);
  if (!property) {
    return null;
  }
  const value = rawValues(property).join('');
  return value.length > 0 ? value : null;
}

// ─── Text cleanup ───────────────────────────────────────────────────────────

/**
 * Reduce an HTML description to plain text.
 *
 * Calendar feeds can include HTML in descriptions and locations. Convert it
 * with an HTML parser so malformed markup is handled consistently; the client
 * displays this output as text and only linkifies validated HTTP(S) URLs.
 */
const convertCalendarHtml = compile({
  wordwrap: false,
  preserveNewlines: true,
  selectors: [
    { selector: 'script', format: 'skip' },
    { selector: 'style', format: 'skip' },
    {
      selector: 'a',
      options: {
        linkBrackets: [' — ', ''],
        hideLinkHrefIfSameAsText: true,
        pathRewrite: (href: string) =>
          href.toLowerCase().startsWith('http://') || href.toLowerCase().startsWith('https://')
            ? href
            : '',
      },
    },
  ],
});

export function htmlToPlainText(value: string): string {
  return convertCalendarHtml(value).trim();
}

// ─── Durations ──────────────────────────────────────────────────────────────

const DURATION_PATTERN = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

interface ParsedDuration {
  days: number;
  seconds: number;
}

/**
 * Parse an RFC 5545 `DURATION`.
 *
 * Weeks are folded into days; hours, minutes, and seconds are kept apart from
 * days because a day is not always 24 hours once a zone is involved.
 */
export function parseDuration(value: string): ParsedDuration | null {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, sign, weeks, days, hours, minutes, seconds] = match;
  if (!weeks && !days && !hours && !minutes && !seconds) {
    return null;
  }

  const totalDays = Number(weeks ?? 0) * 7 + Number(days ?? 0);
  const totalSeconds = Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);

  return sign === '-'
    ? { days: -totalDays, seconds: -totalSeconds }
    : { days: totalDays, seconds: totalSeconds };
}

// ─── Event context ──────────────────────────────────────────────────────────

interface EventContext {
  component: ICAL.Component;
  uid: string;
  kind: TimeKind;
  timezone: string | null;
  floating: boolean;
  allDay: boolean;
  /** The zone used to turn a wall clock into an instant. */
  resolutionZone: string | null;
  startWall: WallClock;
  /** Duration in seconds, for timed events. */
  durationSeconds: number;
  /** Duration in days, for all-day events. */
  durationDays: number;
  summary: string;
  description: string | null;
  location: string | null;
  status: string | null;
}

function readKind(component: ICAL.Component): { kind: TimeKind; timezone: string | null } {
  const property = component.getFirstProperty('dtstart');
  if (!property) {
    throw new Error('VEVENT has no DTSTART');
  }

  const raw = firstRawValue(property);
  if (raw === null) {
    throw new Error('VEVENT has an unreadable DTSTART');
  }

  const parsed = parseRawDateTime(raw);
  if (!parsed) {
    throw new Error('VEVENT has an invalid DTSTART');
  }

  if (property.type === 'date' || !raw.includes('T')) {
    return { kind: { type: 'date' }, timezone: null };
  }

  if (parsed.utc) {
    return { kind: { type: 'utc' }, timezone: 'UTC' };
  }

  const tzid = property.getParameter('tzid');
  return resolveZone(typeof tzid === 'string' ? tzid : null);
}

function readDuration(component: ICAL.Component): ParsedDuration | null {
  const property = component.getFirstProperty('duration');
  if (!property) {
    return null;
  }
  const raw = firstRawValue(property);
  if (raw === null) {
    return null;
  }
  return parseDuration(raw);
}

/**
 * Work out how long an event lasts.
 *
 * `DTEND` wins over `DURATION`. The difference is measured in wall-clock
 * terms, so an event that spans a DST change keeps its stated length instead
 * of silently gaining or losing an hour.
 */
function readSpan(
  component: ICAL.Component,
  startWall: WallClock,
  allDay: boolean,
): { durationSeconds: number; durationDays: number } {
  const endProperty = component.getFirstProperty('dtend');
  if (endProperty) {
    const raw = firstRawValue(endProperty);
    const parsed = raw === null ? null : parseRawDateTime(raw);
    if (parsed) {
      const endWall = parsed.wall;
      if (allDay) {
        const days = Math.round(
          (DateTime.fromObject(toDateTimeObject(endWall), { zone: 'UTC' }).toMillis() -
            DateTime.fromObject(toDateTimeObject(startWall), { zone: 'UTC' }).toMillis()) /
            86_400_000,
        );
        return { durationSeconds: 0, durationDays: Math.max(days, 1) };
      }
      const seconds = Math.round(
        (DateTime.fromObject(toDateTimeObject(endWall), { zone: 'UTC' }).toMillis() -
          DateTime.fromObject(toDateTimeObject(startWall), { zone: 'UTC' }).toMillis()) /
          1000,
      );
      return { durationSeconds: Math.max(seconds, 1), durationDays: 0 };
    }
  }

  const duration = readDuration(component);
  if (duration) {
    if (allDay) {
      const days = Math.round(duration.days + duration.seconds / 86_400);
      return { durationSeconds: 0, durationDays: Math.max(days, 1) };
    }
    return {
      durationSeconds: Math.max(duration.seconds + duration.days * 86_400, 1),
      durationDays: 0,
    };
  }

  // No end and no duration: a single point in time, or a single day.
  return allDay
    ? { durationSeconds: 0, durationDays: 1 }
    : { durationSeconds: 3600, durationDays: 0 };
}

function buildContext(component: ICAL.Component): EventContext {
  const { kind, timezone } = readKind(component);
  const allDay = kind.type === 'date';

  const startProperty = component.getFirstProperty('dtstart');
  const rawStart = startProperty ? firstRawValue(startProperty) : null;
  const parsedStart = rawStart === null ? null : parseRawDateTime(rawStart);
  if (!parsedStart) {
    throw new Error('VEVENT has an invalid DTSTART');
  }

  const startWall = parsedStart.wall;
  const { durationSeconds, durationDays } = readSpan(component, startWall, allDay);

  const summary = readText(component, 'summary') ?? '';
  const rawDescription = readText(component, 'description');
  const location = readText(component, 'location');
  const status = readText(component, 'status');

  const resolutionZone = kind.type === 'zoned' ? kind.zone : 'UTC';

  const effectiveUid =
    readEventIdentity(component) ?? hashText(`${summary}|${wallToKey(startWall)}`);

  return {
    component,
    uid: effectiveUid,
    kind,
    timezone,
    floating: kind.type === 'floating',
    allDay,
    resolutionZone,
    startWall,
    durationSeconds,
    durationDays,
    summary,
    description: rawDescription === null ? null : htmlToPlainText(rawDescription),
    location: location === null ? null : htmlToPlainText(location),
    status: status === null ? null : status.trim().toUpperCase(),
  };
}

function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * The identity a component is grouped and stored under.
 *
 * A feed without a `UID` still has to produce stable rows, so the identity
 * falls back to a hash of the summary and the start. The same value is used
 * for grouping and for the stored row, so the two can never disagree.
 *
 * Returns `null` when the component carries nothing to identify it by.
 */
function readEventIdentity(component: ICAL.Component): string | null {
  const uid = readText(component, 'uid');
  if (uid && uid.length > 0) {
    return uid;
  }

  const startProperty = component.getFirstProperty('dtstart');
  const raw = startProperty ? firstRawValue(startProperty) : null;
  const parsed = raw === null ? null : parseRawDateTime(raw);
  if (!parsed) {
    return null;
  }

  const summary = readText(component, 'summary') ?? '';
  return hashText(`${summary}|${wallToKey(parsed.wall)}`);
}

// ─── Recurrence ─────────────────────────────────────────────────────────────

interface DatedValue {
  wall: WallClock;
  /** The zone the value was declared in; null means it inherits the event's. */
  zone: string | null;
  allDay: boolean;
}

function readDatedValues(
  component: ICAL.Component,
  name: string,
  fallbackZone: string | null,
): DatedValue[] {
  const results: DatedValue[] = [];

  for (const property of component.getAllProperties(name)) {
    const declaredZone = property.getParameter('tzid');
    const zone = typeof declaredZone === 'string' ? declaredZone : fallbackZone;
    const allDay = property.type === 'date';

    for (const raw of rawValues(property)) {
      const parsed = parseRawDateTime(raw);
      if (!parsed) {
        continue;
      }
      results.push({ wall: parsed.wall, zone: parsed.utc ? 'UTC' : zone, allDay });
    }
  }

  return results;
}

function toFloatingTime(wall: WallClock): ICAL.Time {
  return ICAL.Time.fromData({
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour: wall.hour,
    minute: wall.minute,
    second: wall.second,
    isDate: false,
  });
}

function fromFloatingTime(time: ICAL.Time): WallClock {
  return {
    year: time.year,
    month: time.month,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
    second: time.second,
  };
}

/**
 * Move the base of an unbounded recurrence forward so the iterator does not
 * have to walk through every occurrence since the event was created.
 *
 * This only applies to the plain daily and weekly series — a rule with `BY*`
 * parts or a `COUNT` describes a set whose shape depends on the parts, and
 * the day arithmetic below would not reproduce it exactly.
 */
function fastForwardBase(
  recur: ICAL.Recur,
  base: WallClock,
  targetMs: number,
): { wall: WallClock; offsetDays: number } | null {
  if (recur.count !== undefined && recur.count !== null) {
    return null;
  }
  if (Object.keys(recur.parts).length > 0) {
    return null;
  }

  const frequency = recur.freq;
  const interval = Math.max(1, recur.interval ?? 1);
  const stepDays = frequency === 'DAILY' ? interval : frequency === 'WEEKLY' ? interval * 7 : 0;
  if (stepDays === 0) {
    return null;
  }

  const baseUtc = DateTime.fromObject(toDateTimeObject(base), { zone: 'UTC' });
  if (!baseUtc.isValid) {
    return null;
  }

  const target = DateTime.fromMillis(targetMs, { zone: 'UTC' });
  const difference = target.diff(baseUtc, 'days').days;
  // One step of slack, so an occurrence that starts just before the target but
  // runs into it is not skipped.
  const steps = Math.max(0, Math.floor(difference / stepDays) - 1);

  if (steps === 0) {
    return null;
  }

  const shifted = baseUtc.plus({ days: steps * stepDays });
  return {
    wall: {
      year: shifted.year,
      month: shifted.month,
      day: shifted.day,
      hour: shifted.hour,
      minute: shifted.minute,
      second: shifted.second,
    },
    offsetDays: steps * stepDays,
  };
}

interface ExpansionResult {
  walls: WallClock[];
  truncated: boolean;
}

/**
 * Expand a recurrence rule into the wall clocks of its occurrences.
 *
 * The iteration is bounded twice: by the end of the requested window, and by
 * a step limit, so a hostile rule cannot spin forever.
 */
function expandRule(
  recur: ICAL.Recur,
  base: WallClock,
  zone: string | null,
  windowStartMs: number,
  windowEndMs: number,
  durationMs: number,
  maxIterations: number,
): ExpansionResult {
  let iteratorBase = base;
  const shifted = fastForwardBase(recur, base, windowStartMs - durationMs);
  if (shifted) {
    iteratorBase = shifted.wall;
  }

  const iterator = recur.iterator(toFloatingTime(iteratorBase));
  const walls: WallClock[] = [];
  let truncated = false;
  let iterations = 0;

  for (;;) {
    const next = iterator.next();
    if (!next) {
      break;
    }

    iterations += 1;
    if (iterations > maxIterations) {
      truncated = true;
      break;
    }

    const wall = fromFloatingTime(next);
    const resolved = resolveInstant(wall, zone);
    if (!resolved) {
      continue;
    }

    if (resolved.toMillis() >= windowEndMs) {
      break;
    }

    walls.push(wall);
  }

  return { walls, truncated };
}

// ─── Occurrence assembly ────────────────────────────────────────────────────

function occurrenceEnd(context: EventContext, wall: WallClock): DateTime | null {
  if (context.allDay) {
    const start = resolveInstant(wall, 'UTC');
    if (!start) {
      return null;
    }
    return start.plus({ days: context.durationDays });
  }

  const start = resolveInstant(wall, context.resolutionZone);
  if (!start) {
    return null;
  }
  return start.plus({ seconds: context.durationSeconds });
}

function buildEvent(
  context: EventContext,
  wall: WallClock,
  recurrenceId: string,
): CalendarEventInput | null {
  const start = context.allDay
    ? resolveInstant(wall, 'UTC')
    : resolveInstant(wall, context.resolutionZone);
  if (!start) {
    return null;
  }

  const end = occurrenceEnd(context, wall);
  if (!end) {
    return null;
  }

  const startIso = toUtcIso(start);
  const endIso = toUtcIso(end);
  if (startIso === null || endIso === null) {
    return null;
  }

  return {
    uid: context.uid,
    recurrenceId,
    summary: context.summary,
    description: context.description,
    location: context.location,
    startAt: startIso,
    endAt: endIso,
    allDay: context.allDay,
    startDate: context.allDay ? start.toFormat('yyyy-MM-dd') : null,
    endDate: context.allDay ? end.toFormat('yyyy-MM-dd') : null,
    timezone: context.timezone,
    floating: context.floating,
    status: context.status,
  };
}

function readRecurrenceId(
  component: ICAL.Component,
  fallbackZone: string | null,
): { wall: WallClock; zone: string | null; instantMs: number } | null {
  const property = component.getFirstProperty('recurrence-id');
  if (!property) {
    return null;
  }

  const raw = firstRawValue(property);
  if (raw === null) {
    return null;
  }

  const parsed = parseRawDateTime(raw);
  if (!parsed) {
    return null;
  }

  const declaredZone = property.getParameter('tzid');
  const zone = parsed.utc ? 'UTC' : typeof declaredZone === 'string' ? declaredZone : fallbackZone;
  const resolved = resolveInstant(parsed.wall, zone);
  if (!resolved) {
    return null;
  }

  return { wall: parsed.wall, zone, instantMs: resolved.toMillis() };
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Parse an ICS feed into the event instances that overlap the window.
 *
 * A malformed `VEVENT` is skipped rather than failing the whole feed: one
 * broken entry should not cost the user their calendar.
 */
export function parseCalendarFeed(
  body: string,
  options: ParseCalendarOptions,
): ParseCalendarResult {
  const maxInstances = options.maxInstances ?? DEFAULT_MAX_INSTANCES;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const windowStart = DateTime.fromISO(options.window.start, { zone: 'utc' });
  const windowEnd = DateTime.fromISO(options.window.end, { zone: 'utc' });
  if (!windowStart.isValid || !windowEnd.isValid) {
    throw new Error('The calendar window must be a valid range of instants');
  }

  const windowStartMs = windowStart.toMillis();
  const windowEndMs = windowEnd.toMillis();

  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(body));
  } catch {
    throw new Error('The calendar feed could not be parsed');
  }

  const components = root.getAllSubcomponents('vevent');
  const groups = new Map<string, { master: ICAL.Component | null; overrides: ICAL.Component[] }>();
  let unidentified = 0;

  for (const component of components) {
    const key = readEventIdentity(component);
    if (key === null) {
      // Nothing identifies this component, so there is no stable row to store
      // it in. It is counted as skipped rather than given a key that depends
      // on where it happened to sit in the feed.
      unidentified += 1;
      continue;
    }

    let group = groups.get(key);
    if (!group) {
      group = { master: null, overrides: [] };
      groups.set(key, group);
    }

    if (component.getFirstProperty('recurrence-id')) {
      group.overrides.push(component);
    } else if (!group.master) {
      group.master = component;
    } else {
      // A second master for the same UID is a duplicate; the first one wins.
      group.overrides.push(component);
    }
  }

  const events: CalendarEventInput[] = [];
  let truncated = false;
  let skippedEvents = 0;

  for (const group of groups.values()) {
    if (events.length >= maxInstances) {
      truncated = true;
      break;
    }

    try {
      const produced = expandGroup(group, {
        windowStartMs,
        windowEndMs,
        maxIterations,
        maxInstances: maxInstances - events.length,
      });

      events.push(...produced.events);
      truncated = truncated || produced.truncated;
      skippedEvents += produced.skipped;
    } catch {
      skippedEvents += 1;
    }
  }

  return { events, truncated, skippedEvents: skippedEvents + unidentified };
}

interface GroupOptions {
  windowStartMs: number;
  windowEndMs: number;
  maxIterations: number;
  maxInstances: number;
}

interface GroupResult {
  events: CalendarEventInput[];
  truncated: boolean;
  skipped: number;
}

function expandGroup(
  group: { master: ICAL.Component | null; overrides: ICAL.Component[] },
  options: GroupOptions,
): GroupResult {
  const events: CalendarEventInput[] = [];
  let truncated = false;
  let skipped = 0;

  if (!group.master) {
    // Only overrides: each stands on its own as a single instance.
    for (const override of group.overrides) {
      if (events.length >= options.maxInstances) {
        truncated = true;
        break;
      }

      const context = buildContext(override);
      if (context.status === 'CANCELLED') {
        continue;
      }
      const recurrenceId = readRecurrenceId(override, context.resolutionZone);
      if (!recurrenceId) {
        skipped += 1;
        continue;
      }

      const recurrenceKey = toUtcIso(DateTime.fromMillis(recurrenceId.instantMs, { zone: 'utc' }));
      if (!recurrenceKey) {
        skipped += 1;
        continue;
      }

      const event = buildEvent(context, context.startWall, recurrenceKey);
      if (!event) {
        skipped += 1;
        continue;
      }
      events.push(event);
    }
    return { events, truncated, skipped };
  }

  const context = buildContext(group.master);
  if (context.status === 'CANCELLED') {
    return { events, truncated, skipped };
  }

  const masterWalls = collectOccurrenceWalls(context, options);
  truncated = truncated || masterWalls.truncated;

  // An event that recurs gets an instance key per occurrence, so the same
  // occurrence keeps the same row across refreshes. A standalone event keeps
  // the empty key, which marks it as the master.
  const recurs =
    context.component.getFirstProperty('rrule') !== null ||
    context.component.getAllProperties('rdate').length > 0;

  const excluded = new Set<number>();
  for (const exdate of readDatedValues(group.master, 'exdate', context.resolutionZone)) {
    const resolved = resolveInstant(exdate.wall, exdate.zone);
    if (resolved) {
      excluded.add(resolved.toMillis());
    }
  }

  // An override replaces the occurrence it names, so those occurrences are
  // removed from the master's set and emitted in the override's own right.
  const overrideByInstant = new Map<number, ICAL.Component>();
  for (const override of group.overrides) {
    const overrideContext = buildContext(override);
    const overrideRecurrenceId = readRecurrenceId(override, overrideContext.resolutionZone);
    if (!overrideRecurrenceId) {
      skipped += 1;
      continue;
    }
    overrideByInstant.set(overrideRecurrenceId.instantMs, override);
  }

  for (const wall of masterWalls.walls) {
    if (events.length >= options.maxInstances) {
      truncated = true;
      break;
    }

    const resolved = resolveInstant(wall, context.resolutionZone);
    if (!resolved) {
      continue;
    }
    const startMs = resolved.toMillis();

    if (excluded.has(startMs)) {
      continue;
    }

    const end = occurrenceEnd(context, wall);
    if (!end) {
      continue;
    }
    const endMs = end.toMillis();

    // Strict overlap: an event ending exactly at the window start is out, and
    // an event starting exactly at the window end is out.
    if (!(startMs < options.windowEndMs && endMs > options.windowStartMs)) {
      continue;
    }

    const instanceKey = toUtcIso(resolved) ?? '';

    const override = overrideByInstant.get(startMs);
    if (override) {
      overrideByInstant.delete(startMs);
      const overrideContext = buildContext(override);
      if (overrideContext.status === 'CANCELLED') {
        continue;
      }
      const overrideEvent = buildEvent(overrideContext, overrideContext.startWall, instanceKey);
      if (overrideEvent) {
        events.push(overrideEvent);
      }
      continue;
    }

    const event = buildEvent(context, wall, recurs ? instanceKey : '');
    if (event) {
      events.push(event);
    }
  }

  // Overrides that name an occurrence the master did not produce still stand
  // on their own — the instance may exist even though the master no longer
  // lists it.
  for (const [instantMs, override] of overrideByInstant) {
    if (events.length >= options.maxInstances) {
      truncated = true;
      break;
    }

    const overrideContext = buildContext(override);
    if (overrideContext.status === 'CANCELLED') {
      continue;
    }

    const event = buildEvent(
      overrideContext,
      overrideContext.startWall,
      toUtcIso(DateTime.fromMillis(instantMs, { zone: 'utc' })) ?? '',
    );
    if (event) {
      events.push(event);
    }
  }

  return { events, truncated, skipped };
}

interface WallCollection {
  walls: WallClock[];
  truncated: boolean;
}

/**
 * Collect the wall clocks of every occurrence of an event, whether they come
 * from a rule, from extra dates, or from the event's own start.
 */
function collectOccurrenceWalls(context: EventContext, options: GroupOptions): WallCollection {
  const walls: WallClock[] = [];
  let truncated = false;

  const rruleProperty = context.component.getFirstProperty('rrule');
  if (rruleProperty) {
    const rule = rruleProperty.getFirstValue();
    if (rule instanceof ICAL.Recur) {
      const durationMs = context.allDay
        ? context.durationDays * 86_400_000
        : context.durationSeconds * 1000;

      const expansion = expandRule(
        rule,
        context.startWall,
        context.resolutionZone,
        options.windowStartMs,
        options.windowEndMs,
        durationMs,
        options.maxIterations,
      );
      walls.push(...expansion.walls);
      truncated = expansion.truncated;
    }
  }

  for (const rdate of readDatedValues(context.component, 'rdate', context.resolutionZone)) {
    walls.push(rdate.wall);
  }

  // `DTSTART` is always the first instance of the recurrence set, even when
  // the event also carries extra dates.
  const startKey = wallToKey(context.startWall);
  if (!walls.some((wall) => wallToKey(wall) === startKey)) {
    walls.unshift(context.startWall);
  }

  return { walls, truncated };
}
