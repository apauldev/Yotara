import { DateTime } from 'luxon';
import * as chrono from 'chrono-node/en';
import type { ParsedResult } from 'chrono-node/en';

export type TaskDueDateParseStatus =
  | 'date'
  | 'none'
  | 'time'
  | 'recurring'
  | 'range'
  | 'multiple'
  | 'invalid'
  | 'unsupported';

export interface TaskDueDateParseResult {
  status: TaskDueDateParseStatus;
  matchedText: string | null;
  matchStart: number | null;
  matchEnd: number | null;
  dueDate: string | null;
  dueTime: string | null;
  referenceDate: string | null;
}

type CandidateKind =
  | 'today'
  | 'tomorrow'
  | 'relativeDays'
  | 'weekday'
  | 'monthDate'
  | 'unsupportedIso';

type RejectionStatus = 'time' | 'recurring' | 'range' | 'unsupported' | 'invalid';

interface DateCandidate {
  kind: CandidateKind;
  text: string;
  start: number;
  end: number;
  days?: number;
  weekday?: number;
  strictNext?: boolean;
  month?: number;
  day?: number;
  year?: number;
  chronoText?: string;
}

type DateResolution = { status: 'date'; date: DateTime } | { status: 'invalid' | 'unsupported' };

type CandidateContext =
  | { kind: 'reject'; status: RejectionStatus; start: number; end: number }
  | { kind: 'accept'; dueTime: string | null; start: number; end: number };

interface TimeSuffix {
  length: number;
  dueTime: string;
}

const MAX_RELATIVE_DAYS = 3650;

const WEEKDAY_NUMBERS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const WEEKDAY_PATTERN = Object.keys(WEEKDAY_NUMBERS).join('|');
const MONTH_PATTERN = Object.keys(MONTH_NUMBERS).join('|');

const RELATIVE_DAYS_PATTERN = /\bin\s+([1-9]\d*)\s+days\b/gi;
const RELATIVE_WORD_PATTERN = /\b(today|tomorrow)\b/gi;
const WEEKDAY_CANDIDATE_PATTERN = new RegExp(`\\b(?:(on|next)\\s+)?(${WEEKDAY_PATTERN})\\b`, 'gi');
const MONTH_FIRST_DATE_CANDIDATE_PATTERN = new RegExp(
  `\\b(?:(on)\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2})(?:(?:,\\s*|\\s+)(\\d{4}))?\\b`,
  'gi',
);
const DAY_FIRST_DATE_CANDIDATE_PATTERN = new RegExp(
  `\\b(?:(on)\\s+)?(\\d{1,2})\\s+(${MONTH_PATTERN})(?:(?:,\\s*|\\s+)(\\d{4}))?\\b`,
  'gi',
);
const ISO_DATE_PATTERN = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const COMMAND_TOKEN_PATTERN = /(?:^|\s)(?:!(?:h|l|m|high|med|medium|low)\b|#[\w-]+\b)/gi;
const RECURRING_TOKEN_PATTERN = /\b(?:every|each)\b/i;
const RECURRING_BEFORE_PATTERN = /\b(?:every|each)\s+other\s*$/i;
const VAGUE_TIME_TOKEN_PATTERN =
  /\b(?:morning|afternoon|evening|tonight|midnight|noon|eod|cob|close of business)\b/i;
const UNSUPPORTED_RELATIVE_PATTERN = /\bin\s+(?:[+-]?0+(?:\.\d+)?|[+-]?\d+\.\d+|\.\d+)\s+days?\b/i;
const BARE_MONTH_PATTERN = new RegExp(`\\b(?:${MONTH_PATTERN})\\b`, 'i');
const INVALID_RELATIVE_AFTER_PATTERN = /^[-–—/]/;
const PUNCTUATION_ONLY_PATTERN = /^[.,;:!?)\]}]+$/;
const POSSESSIVE_BEFORE_PATTERN = /[A-Za-z0-9]['’]\s*$/;
const URL_PREFIX_PATTERN = /(?:https?:\/\/|www\.)\S*$/i;

const TIME_AFTER_WORDS = new Set([
  'at',
  'am',
  'pm',
  'morning',
  'afternoon',
  'evening',
  'night',
  'tonight',
  'midnight',
  'noon',
  'eod',
  'cob',
  'close',
  'oclock',
  'utc',
  'gmt',
  'est',
  'edt',
  'cst',
  'cdt',
  'mst',
  'mdt',
  'pst',
  'pdt',
]);

const RELATIONAL_BEFORE_WORDS = new Set([
  'last',
  'this',
  'before',
  'after',
  'by',
  'from',
  'until',
  'till',
  'during',
  'the',
  'in',
  'next',
  'on',
]);

const RELATIONAL_AFTER_WORDS = new Set([
  'to',
  'through',
  'until',
  'till',
  'before',
  'after',
  'by',
  'from',
  'next',
  'on',
  'in',
]);

const TIME_LIKE_AFTER_PATTERN = /^\d{1,2}(?::\d{2})?(?:am|pm)?(?:\b|$)/i;

// Accepted exact-time tokens, used both as a suffix after the date phrase and
// as a directly adjacent prefix before it. `at` is optional for every form;
// the lookarounds keep a match from starting or ending mid-token.
const TIME_TOKEN_SOURCE =
  '(?:at\\s+)?(?:(noon|midnight)|(\\d{1,2}):(\\d{2})\\s?(am|pm)|(\\d{1,2})\\s?(am|pm)|(\\d{2}):(\\d{2}))';
const TIME_SUFFIX_PATTERN = new RegExp(`^${TIME_TOKEN_SOURCE}(?![A-Za-z0-9])`, 'i');
const TIME_PREFIX_PATTERN = new RegExp(`(?<![A-Za-z0-9])${TIME_TOKEN_SOURCE}$`, 'i');

/**
 * Parse one of the deliberately small due-date phrases supported by the
 * capture MVP, including an optional exact time suffix. The input is never
 * mutated.
 *
 * The caller supplies the local calendar reference. This keeps relative-date
 * behavior deterministic and prevents the parser from depending on UTC
 * serialization or the machine's current time.
 */
export function parseTaskDueDate(input: string, reference: DateTime): TaskDueDateParseResult {
  const referenceDay = reference.isValid ? reference.startOf('day') : null;
  const referenceDate = referenceDay?.toISODate() ?? null;

  if (!referenceDay) {
    return createResult('unsupported', null);
  }

  const maskedInput = maskCommandTokens(input);

  // A malformed date is rejected on its own terms, before any candidate is
  // considered. Checking this only when nothing else matched let a valid
  // weekday elsewhere in the title hide it, so "2026-02-30 due Friday" used to
  // resolve to Friday and quietly discard the date the user actually wrote.
  if (hasInvalidIsoDate(maskedInput)) {
    return createResult('invalid', referenceDate);
  }

  if (UNSUPPORTED_RELATIVE_PATTERN.test(maskedInput)) {
    return createResult('unsupported', referenceDate);
  }

  const candidates = findCandidates(maskedInput);

  if (candidates.length > 1) {
    return createResult('multiple', referenceDate);
  }

  if (candidates.length === 0) {
    return classifyWithoutCandidate(maskedInput, referenceDay, referenceDate);
  }

  const candidate = candidates[0];
  const context = validateCandidateContext(maskedInput, candidate);

  if (context.kind === 'reject') {
    return createResult(context.status, referenceDate, candidate, {
      text: maskedInput.slice(context.start, context.end),
      start: context.start,
      end: context.end,
    });
  }

  const resolution = resolveCandidate(candidate, referenceDay);
  const matchedText = maskedInput.slice(context.start, context.end);
  if (resolution.status !== 'date') {
    return createResult(resolution.status, referenceDate, candidate, {
      text: matchedText,
      start: context.start,
      end: context.end,
    });
  }

  return {
    status: 'date',
    matchedText,
    matchStart: context.start,
    matchEnd: context.end,
    dueDate: resolution.date.toFormat('yyyy-MM-dd'),
    dueTime: context.dueTime,
    referenceDate,
  };
}

function findCandidates(input: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];

  for (const match of input.matchAll(RELATIVE_DAYS_PATTERN)) {
    const start = match.index ?? 0;
    candidates.push({
      kind: 'relativeDays',
      text: match[0],
      start,
      end: start + match[0].length,
      days: Number(match[1]),
    });
  }

  for (const match of input.matchAll(RELATIVE_WORD_PATTERN)) {
    const word = match[1].toLowerCase();
    if (word !== 'today' && word !== 'tomorrow') continue;

    const start = match.index ?? 0;
    candidates.push({
      kind: word,
      text: match[0],
      start,
      end: start + match[0].length,
    });
  }

  for (const match of input.matchAll(WEEKDAY_CANDIDATE_PATTERN)) {
    const weekday = WEEKDAY_NUMBERS[match[2].toLowerCase()];
    if (!weekday) continue;

    const start = match.index ?? 0;
    const prefix = match[1]?.toLowerCase();
    candidates.push({
      kind: 'weekday',
      text: match[0],
      start,
      end: start + match[0].length,
      weekday,
      strictNext: prefix === 'next',
    });
  }

  for (const match of input.matchAll(MONTH_FIRST_DATE_CANDIDATE_PATTERN)) {
    addMonthDateCandidate(candidates, match, match[2], match[3], match[4]);
  }

  for (const match of input.matchAll(DAY_FIRST_DATE_CANDIDATE_PATTERN)) {
    addMonthDateCandidate(candidates, match, match[3], match[2], match[4]);
  }

  // An ISO date is outside the supported grammar, but it still counts as a
  // candidate so it can never be silently dropped in favour of another date
  // phrase. It always resolves to 'unsupported', which keeps a lone ISO date
  // behaving exactly as before while making "2026-10-12 Friday" ambiguous
  // rather than resolving to Friday.
  for (const match of input.matchAll(ISO_DATE_PATTERN)) {
    const start = match.index ?? 0;
    candidates.push({
      kind: 'unsupportedIso',
      text: match[0],
      start,
      end: start + match[0].length,
    });
  }

  candidates.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    return right.end - right.start - (left.end - left.start);
  });

  const nonOverlapping: DateCandidate[] = [];
  for (const candidate of candidates) {
    const previous = nonOverlapping[nonOverlapping.length - 1];
    if (previous && candidate.start < previous.end) continue;
    nonOverlapping.push(candidate);
  }

  return nonOverlapping;
}

function addMonthDateCandidate(
  candidates: DateCandidate[],
  match: RegExpMatchArray,
  monthText: string,
  dayText: string,
  yearText: string | undefined,
): void {
  const month = MONTH_NUMBERS[monthText.toLowerCase()];
  if (!month) return;

  const start = match.index ?? 0;
  const year = yearText ? Number(yearText) : undefined;
  const chronoText = match[0].replace(/^on\s+/i, '').trim();
  candidates.push({
    kind: 'monthDate',
    text: match[0],
    start,
    end: start + match[0].length,
    month,
    day: Number(dayText),
    year,
    chronoText,
  });
}

function validateCandidateContext(input: string, candidate: DateCandidate): CandidateContext {
  const before = input.slice(0, candidate.start);
  const after = input.slice(candidate.end);
  const beforeTrimmed = before.trimEnd();
  const afterTrimmed = after.trimStart();
  const previousCharacter = beforeTrimmed.slice(-1);
  const previousWord = getLastWord(beforeTrimmed);
  const afterWord = getFirstWord(afterTrimmed);

  const reject = (
    status: RejectionStatus,
    end = candidate.end,
    start = candidate.start,
  ): CandidateContext => ({
    kind: 'reject',
    status,
    start,
    end,
  });
  const accept = (
    dueTime: string | null,
    start = candidate.start,
    end = candidate.end,
  ): CandidateContext => ({
    kind: 'accept',
    dueTime,
    start,
    end,
  });

  if (previousCharacter && '#@/\\-–—?&=:;'.includes(previousCharacter)) {
    return reject('unsupported');
  }

  if (URL_PREFIX_PATTERN.test(before.slice(-100))) {
    return reject('unsupported');
  }

  if (POSSESSIVE_BEFORE_PATTERN.test(before)) {
    return reject('unsupported');
  }

  // An exact time directly before the date is the mirror of the suffix form:
  // adjacency is required, and the token before the time must not itself be a
  // time or zone cue.
  const prefix = matchSupportedTimePrefix(beforeTrimmed);
  let prefixDueTime: string | null = null;
  let prefixStart = candidate.start;

  if (prefix) {
    const wordBeforePrefix = getLastWord(
      beforeTrimmed.slice(0, beforeTrimmed.length - prefix.length),
    );
    if (TIME_AFTER_WORDS.has(wordBeforePrefix) || TIME_LIKE_AFTER_PATTERN.test(wordBeforePrefix)) {
      return reject('time');
    }

    prefixDueTime = prefix.dueTime;
    prefixStart = candidate.start - (before.length - beforeTrimmed.length) - prefix.length;
  } else {
    if (VAGUE_TIME_TOKEN_PATTERN.test(beforeTrimmed) || TIME_AFTER_WORDS.has(previousWord)) {
      return reject('time');
    }

    if (TIME_LIKE_AFTER_PATTERN.test(previousWord)) {
      return reject('time');
    }
  }

  if (/^\d{4}$/.test(previousWord)) {
    return reject('unsupported');
  }

  if (RECURRING_BEFORE_PATTERN.test(before)) {
    return reject('recurring');
  }

  if (previousWord === 'every' || previousWord === 'each') {
    return reject('recurring');
  }

  if (RELATIONAL_BEFORE_WORDS.has(previousWord)) {
    return reject('unsupported');
  }

  if (after.startsWith("'") || after.startsWith('’') || after.startsWith('@')) {
    return reject('unsupported');
  }

  if (INVALID_RELATIVE_AFTER_PATTERN.test(afterTrimmed)) {
    return reject('range');
  }

  // An exact clock time is the only accepted continuation after the date. It
  // must be followed by punctuation or the end of the title, mirroring the
  // single-phrase rule the date-only grammar already enforces.
  const suffix = matchSupportedTimeSuffix(afterTrimmed);
  if (suffix) {
    const end = candidate.end + (after.length - afterTrimmed.length) + suffix.length;
    const start = prefixDueTime ? prefixStart : candidate.start;
    const remainder = afterTrimmed.slice(suffix.length).trimStart();

    if (!remainder || PUNCTUATION_ONLY_PATTERN.test(remainder)) {
      // Two exact time cues around one date are ambiguous; fail closed.
      if (prefixDueTime) {
        return reject('time', end, start);
      }
      return accept(suffix.dueTime, candidate.start, end);
    }

    if (
      remainder.startsWith(':') ||
      TIME_LIKE_AFTER_PATTERN.test(remainder) ||
      TIME_AFTER_WORDS.has(getFirstWord(remainder))
    ) {
      return reject('time', end, start);
    }

    return reject('unsupported', end, start);
  }

  if (TIME_AFTER_WORDS.has(afterWord) || TIME_LIKE_AFTER_PATTERN.test(afterTrimmed)) {
    return reject('time');
  }

  if (afterWord === 'every' || afterWord === 'each') {
    return reject('recurring');
  }

  if (RELATIONAL_AFTER_WORDS.has(afterWord)) {
    return reject('unsupported');
  }

  if (afterTrimmed && !PUNCTUATION_ONLY_PATTERN.test(afterTrimmed)) {
    return reject('unsupported');
  }

  return accept(prefixDueTime, prefixStart, candidate.end);
}

function resolveCandidate(candidate: DateCandidate, reference: DateTime): DateResolution {
  switch (candidate.kind) {
    case 'today':
      return { status: 'date', date: reference };
    case 'tomorrow':
      return { status: 'date', date: reference.plus({ days: 1 }) };
    case 'relativeDays':
      if (candidate.days === undefined || candidate.days > MAX_RELATIVE_DAYS) {
        return { status: 'unsupported' };
      }
      return { status: 'date', date: reference.plus({ days: candidate.days }) };
    case 'weekday':
      return resolveWeekday(candidate, reference);
    case 'monthDate':
      return resolveMonthDate(candidate, reference);
    case 'unsupportedIso':
      return { status: 'unsupported' };
  }
}

function resolveWeekday(candidate: DateCandidate, reference: DateTime): DateResolution {
  if (candidate.weekday === undefined) return { status: 'invalid' };

  let daysAhead = (candidate.weekday - reference.weekday + 7) % 7;
  if (candidate.strictNext && daysAhead === 0) {
    daysAhead = 7;
  }

  return { status: 'date', date: reference.plus({ days: daysAhead }) };
}

function resolveMonthDate(candidate: DateCandidate, reference: DateTime): DateResolution {
  if (candidate.month === undefined || candidate.day === undefined) {
    return { status: 'invalid' };
  }

  const month = candidate.month;
  const day = candidate.day;

  if (candidate.year !== undefined) {
    if (!isValidCalendarDate(candidate.year, month, day)) {
      return { status: 'invalid' };
    }

    return validateMonthDateWithChrono(
      candidate,
      DateTime.fromObject({ year: candidate.year, month, day }, { zone: reference.zone }),
      reference,
    );
  }

  for (let year = reference.year; year <= reference.year + 8; year += 1) {
    if (!isValidCalendarDate(year, month, day)) {
      if (month === 2 && day === 29) continue;
      return { status: 'invalid' };
    }

    const date = DateTime.fromObject({ year, month, day }, { zone: reference.zone });
    if (date >= reference) {
      return validateMonthDateWithChrono(candidate, date, reference);
    }
  }

  return { status: 'invalid' };
}

function validateMonthDateWithChrono(
  candidate: DateCandidate,
  date: DateTime,
  reference: DateTime,
): DateResolution {
  const baseChronoText = candidate.chronoText ?? candidate.text;
  const chronoText =
    candidate.year === undefined ? `${baseChronoText} ${date.year}` : baseChronoText;
  const parsed = parseChrono(chronoText, reference);

  if (!parsed || parsed.length !== 1 || parsed[0].end || hasExplicitTime(parsed[0])) {
    return { status: 'unsupported' };
  }

  const parsedYear = parsed[0].start.get('year');
  const parsedMonth = parsed[0].start.get('month');
  const parsedDay = parsed[0].start.get('day');
  if (parsedYear !== date.year || parsedMonth !== date.month || parsedDay !== date.day) {
    return { status: 'invalid' };
  }

  return { status: 'date', date };
}

function classifyWithoutCandidate(
  input: string,
  reference: DateTime,
  referenceDate: string | null,
): TaskDueDateParseResult {
  if (UNSUPPORTED_RELATIVE_PATTERN.test(input)) {
    return createResult('unsupported', referenceDate);
  }

  if (VAGUE_TIME_TOKEN_PATTERN.test(input)) {
    return createResult('time', referenceDate);
  }

  if (BARE_MONTH_PATTERN.test(input)) {
    return createResult('unsupported', referenceDate);
  }

  const parsed = parseChrono(input, reference);
  if (!parsed) return createResult('unsupported', referenceDate);
  if (parsed.length > 1) return createResult('multiple', referenceDate);
  if (parsed.some((result) => result.end)) return createResult('range', referenceDate);
  if (RECURRING_TOKEN_PATTERN.test(input)) return createResult('recurring', referenceDate);
  if (parsed.some((result) => hasExplicitTime(result))) return createResult('time', referenceDate);
  if (parsed.length > 0) return createResult('unsupported', referenceDate);

  return createResult('none', referenceDate);
}

function parseChrono(input: string, reference: DateTime): ParsedResult[] | null {
  try {
    return chrono.parse(input, reference.toJSDate());
  } catch {
    return null;
  }
}

function hasExplicitTime(result: ParsedResult): boolean {
  return (
    result.start.isCertain('hour') ||
    result.start.isCertain('minute') ||
    result.start.isCertain('second') ||
    result.start.isCertain('meridiem') ||
    result.start.isCertain('timezoneOffset')
  );
}

function hasInvalidIsoDate(input: string): boolean {
  for (const match of input.matchAll(ISO_DATE_PATTERN)) {
    if (!isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
      return true;
    }
  }

  return false;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = DateTime.fromObject({ year, month, day }, { zone: 'UTC' });
  return date.isValid && date.year === year && date.month === month && date.day === day;
}

function maskCommandTokens(input: string): string {
  return input.replace(COMMAND_TOKEN_PATTERN, (match) => ' '.repeat(match.length));
}

function getFirstWord(value: string): string {
  return value.match(/^[A-Za-z0-9]+(?:['’][A-Za-z]+)?/)?.[0].toLowerCase() ?? '';
}

function getLastWord(value: string): string {
  const words = value.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g);
  return words?.[words.length - 1]?.toLowerCase() ?? '';
}

/**
 * Match one of the supported exact-time forms at the start of `text`.
 * Returns null when the text does not begin with a supported form; every other
 * time cue keeps its fail-closed rejection in the caller.
 */
function matchSupportedTimeSuffix(text: string): TimeSuffix | null {
  const match = TIME_SUFFIX_PATTERN.exec(text);
  if (!match) return null;

  const dueTime = resolveTimeMatch(match);
  return dueTime ? { length: match[0].length, dueTime } : null;
}

/**
 * Match one of the supported exact-time forms at the end of `text`, for the
 * adjacent prefix position (`at 5pm friday`).
 */
function matchSupportedTimePrefix(text: string): TimeSuffix | null {
  const match = TIME_PREFIX_PATTERN.exec(text);
  if (!match) return null;

  const dueTime = resolveTimeMatch(match);
  return dueTime ? { length: match[0].length, dueTime } : null;
}

/** Resolve the shared capture groups into a 24-hour 'HH:mm' value, or null. */
function resolveTimeMatch(match: RegExpExecArray): string | null {
  const [, word, h12, min12, mer12, hOnly, merOnly, h24, min24] = match;

  if (word) {
    return word.toLowerCase() === 'noon' ? '12:00' : '00:00';
  }
  if (h12 !== undefined) {
    return formatClock(Number(h12), Number(min12), mer12 ?? null);
  }
  if (hOnly !== undefined) {
    return formatClock(Number(hOnly), 0, merOnly ?? null);
  }
  if (h24 !== undefined) {
    return formatClock(Number(h24), Number(min24), null);
  }
  return null;
}

function formatClock(hour: number, minute: number, meridiem: string | null): string | null {
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  let hours = hour;
  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    hours =
      meridiem.toLowerCase() === 'am' ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function createResult(
  status: RejectionStatus | 'none' | 'multiple',
  referenceDate: string | null,
  candidate?: DateCandidate,
  matchedSpan?: { text: string; start: number; end: number },
): TaskDueDateParseResult {
  return {
    status,
    matchedText: matchedSpan?.text ?? candidate?.text ?? null,
    matchStart: matchedSpan?.start ?? candidate?.start ?? null,
    matchEnd: matchedSpan?.end ?? candidate?.end ?? null,
    dueDate: null,
    dueTime: null,
    referenceDate,
  };
}
