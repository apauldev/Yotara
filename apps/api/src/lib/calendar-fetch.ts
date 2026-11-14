import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';

/**
 * Fetching a calendar feed means fetching a URL a user typed, which makes it
 * a server-side request forgery surface: the API would happily reach
 * `http://169.254.169.254/` or `http://127.0.0.1:6379/` on the user's behalf.
 *
 * Every request therefore goes through the same guard:
 *
 * - Only `https:` (and `http:` behind an explicit opt-in).
 * - No credentials in the URL — the URL *is* the credential here.
 * - The hostname is resolved before the request, and every resolved address is
 *   checked against the private, loopback, link-local, and metadata ranges.
 * - The connection is then pinned to those already-validated addresses, so a
 *   DNS record that changes between the check and the connect cannot smuggle
 *   the request onto a private address.
 * - Redirects are followed manually, at most three hops, and every hop is
 *   validated again from scratch.
 * - A response body over the size cap is aborted mid-stream rather than
 *   buffered.
 */

export const CALENDAR_FETCH_MAX_BYTES = 5 * 1024 * 1024;
export const CALENDAR_FETCH_TIMEOUT_MS = 10_000;
export const CALENDAR_FETCH_MAX_REDIRECTS = 3;

const DEFAULT_USER_AGENT = 'Yotara Calendar Fetcher';
const ACCEPT_HEADER = 'text/calendar, text/plain;q=0.9, */*;q=0.8';

export type CalendarFetchFailure =
  | 'invalid-url'
  | 'scheme-not-allowed'
  | 'credentials-in-url'
  | 'blocked-address'
  | 'dns-failure'
  | 'too-many-redirects'
  | 'timeout'
  | 'response-too-large'
  | 'http-error'
  | 'network-error';

export class CalendarFetchError extends Error {
  constructor(
    public readonly reason: CalendarFetchFailure,
    message: string,
  ) {
    super(message);
    this.name = 'CalendarFetchError';
  }
}

export interface CalendarFetchOptions {
  /** Last known ETag, for a conditional GET. */
  etag?: string | null;
  /** Last known Last-Modified, for a conditional GET. */
  lastModified?: string | null;
  /** Maximum size of the decoded response body. */
  maxBytes?: number;
  /** Total deadline for the request, including DNS and redirects. */
  timeoutMs?: number;
  /** Maximum number of redirects to follow. */
  maxRedirects?: number;
  /** Permit `http:` URLs. Off by default. */
  allowInsecureUrls?: boolean;
  /** Value sent in the `User-Agent` header. */
  userAgent?: string;
  /**
   * Test seam: replaces DNS resolution.
   *
   * The server can only reach a loopback or private address by going through
   * this hook, so the guard cannot be exercised end to end against a local
   * test server without it. Production code never sets it.
   */
  resolveHost?: (hostname: string) => Promise<CalendarFetchTarget[]>;
}

export interface CalendarFetchResult {
  /** The feed body. Empty when the server answered `304 Not Modified`. */
  body: string;
  /** True when the server confirmed the stored copy is still current. */
  notModified: boolean;
  /** The final HTTP status, after any redirects. */
  status: number;
  /** The response ETag, when present. */
  etag: string | null;
  /** The response Last-Modified, when present. */
  lastModified: string | null;
}

interface ResolvedTarget {
  address: string;
  family: 4 | 6;
}

/**
 * A host the fetcher is willing to connect to.
 *
 * Exported so a caller can describe a target without reaching into the
 * internals of the fetcher.
 */
export type CalendarFetchTarget = ResolvedTarget;

// ─── Address classification ─────────────────────────────────────────────────

function isBlockedIpv4(address: string): boolean {
  const octets = address.split('.');
  if (octets.length !== 4) {
    return true;
  }

  const values = octets.map((octet) => Number(octet));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }

  const [a, b, c] = values;

  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, including 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay anycast
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

/**
 * Expand an IPv6 address into its eight 16-bit groups.
 *
 * Returns `null` for anything that is not a well-formed IPv6 address, which
 * the caller treats as blocked.
 */
function expandIpv6(address: string): number[] | null {
  const cleaned = address.split('%')[0]?.trim() ?? '';
  if (!cleaned.includes(':')) {
    return null;
  }

  const separator = cleaned.indexOf('::');
  const headText = separator >= 0 ? cleaned.slice(0, separator) : cleaned;
  const tailText = separator >= 0 ? cleaned.slice(separator + 2) : '';

  const parseGroups = (text: string): number[] | null => {
    const groups: number[] = [];
    const chunks = text.split(':').filter((chunk) => chunk !== '');

    for (const chunk of chunks) {
      if (chunk.includes('.')) {
        // An embedded IPv4 address occupies the last two groups.
        if (isIP(chunk) !== 4) {
          return null;
        }
        const parts = chunk.split('.').map(Number);
        groups.push(((parts[0] << 8) | parts[1]) & 0xffff, ((parts[2] << 8) | parts[3]) & 0xffff);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/i.test(chunk)) {
        return null;
      }
      groups.push(Number.parseInt(chunk, 16));
    }

    return groups;
  };

  const head = parseGroups(headText);
  const tail = parseGroups(tailText);
  if (head === null || tail === null) {
    return null;
  }

  if (separator < 0) {
    return head.length === 8 ? head : null;
  }

  const missing = 8 - head.length - tail.length;
  if (missing < 0) {
    return null;
  }

  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

function ipv4FromGroups(groups: number[], offset: number): string {
  return [
    groups[offset] >> 8,
    groups[offset] & 0xff,
    groups[offset + 1] >> 8,
    groups[offset + 1] & 0xff,
  ].join('.');
}

function isBlockedIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (groups === null) {
    return true;
  }

  const [g0, g1, g2, g3, g4, g5] = groups;
  const g7 = groups[7];

  if (groups.every((group) => group === 0)) return true; // unspecified
  if (groups.slice(0, 7).every((group) => group === 0) && g7 === 1) return true; // loopback

  // IPv4-mapped, IPv4-compatible, NAT64, and 6to4 all tunnel an IPv4 address.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    if (g5 === 0xffff || g5 === 0) return isBlockedIpv4(ipv4FromGroups(groups, 6));
  }
  if (g0 === 0x0064 && g1 === 0xff9b) return isBlockedIpv4(ipv4FromGroups(groups, 6));
  if (g0 === 0x2002) return isBlockedIpv4(ipv4FromGroups(groups, 1));

  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard-only
  if (g0 === 0x2001 && g1 <= 0x01ff) return true; // IETF protocol assignments
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local
  if ((g0 & 0xff00) === 0xff00) return true; // multicast

  return false;
}

/**
 * True when an address is one the server must never reach on a user's
 * behalf: loopback, private, link-local, carrier-grade NAT, multicast, and
 * the cloud metadata endpoints that all live inside those ranges.
 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return isBlockedIpv4(address);
  }
  if (family === 6) {
    return isBlockedIpv6(address);
  }
  return true;
}

// ─── URL validation ─────────────────────────────────────────────────────────

/** Convert calendar-client subscription URLs to the HTTPS URL we can fetch. */
export function normalizeCalendarFeedUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//i, 'https://');
}

/**
 * Parse a calendar URL and reject the shapes the fetcher will not handle.
 *
 * Credentials in the URL are refused outright: the URL is already a secret,
 * and folding a second one into it means the credential would travel in the
 * request line and in every proxy log along the way.
 */
export function assertFetchableCalendarUrl(url: string, allowInsecureUrls = false): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CalendarFetchError('invalid-url', 'The calendar URL is not a valid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new CalendarFetchError(
      'scheme-not-allowed',
      'The calendar URL must use https:// (http:// requires ALLOW_INSECURE_CALENDAR_URLS)',
    );
  }

  if (parsed.protocol === 'http:' && !allowInsecureUrls) {
    throw new CalendarFetchError(
      'scheme-not-allowed',
      'The calendar URL must use https:// (http:// requires ALLOW_INSECURE_CALENDAR_URLS)',
    );
  }

  if (parsed.username || parsed.password) {
    throw new CalendarFetchError(
      'credentials-in-url',
      'The calendar URL must not contain credentials. Remove the username and password from it.',
    );
  }

  if (!parsed.hostname) {
    throw new CalendarFetchError('invalid-url', 'The calendar URL has no host');
  }

  return parsed;
}

// ─── DNS resolution and pinning ─────────────────────────────────────────────

async function resolveTargets(hostname: string): Promise<ResolvedTarget[]> {
  let addresses: Array<{ address: string; family: number }>;

  try {
    addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new CalendarFetchError('dns-failure', `Could not resolve the calendar host ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new CalendarFetchError('dns-failure', `Could not resolve the calendar host ${hostname}`);
  }

  for (const entry of addresses) {
    if (isBlockedAddress(entry.address)) {
      throw new CalendarFetchError(
        'blocked-address',
        `The calendar host ${hostname} resolves to an address the server will not fetch`,
      );
    }
  }

  return addresses.map((entry) => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
}

/**
 * Resolve a hostname to the addresses the fetcher may connect to.
 *
 * Exported so a test can compose it with {@link CalendarFetchOptions.resolveHost}.
 */
export function resolveCalendarTargets(hostname: string): Promise<CalendarFetchTarget[]> {
  return resolveTargets(hostname);
}

/**
 * The shapes `dns.lookup` and `net.connect` pass to a custom `lookup`.
 *
 * Node hands over either a family number or an options object, and the
 * callback either wants one address or a list of them.
 */
type LookupSettings = { family?: number; all?: boolean };
type LookupCallback = (
  error: Error | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

function readLookupSettings(options: unknown): LookupSettings {
  if (typeof options === 'number') {
    return { family: options, all: false };
  }
  if (options !== null && typeof options === 'object') {
    const record = options as Record<string, unknown>;
    return {
      family: typeof record['family'] === 'number' ? record['family'] : undefined,
      all: record['all'] === true,
    };
  }
  return {};
}

/**
 * Build a `lookup` implementation that only ever returns the addresses that
 * were already validated.
 *
 * This is what closes the DNS rebinding gap: the connection cannot land on a
 * different address than the one that was checked.
 */
function pinnedLookup(targets: ResolvedTarget[]): LookupFunction {
  const lookup = (hostname: string, options: unknown, callback: unknown): void => {
    const settings = readLookupSettings(options);
    const family = settings.family ?? 0;

    const matching =
      family === 4 || family === 6 ? targets.filter((target) => target.family === family) : targets;
    const usable = matching.length > 0 ? matching : targets;

    if (typeof callback !== 'function') {
      return;
    }
    const done = callback as LookupCallback;

    if (settings.all === true) {
      done(
        null,
        usable.map((target) => ({ address: target.address, family: target.family })),
      );
      return;
    }

    done(null, usable[0].address, usable[0].family);
  };

  return lookup as LookupFunction;
}

// ─── Response reading ───────────────────────────────────────────────────────

function decompressStream(stream: Readable, encoding: string | undefined): Readable {
  const normalized = encoding?.trim().toLowerCase();
  if (normalized === 'gzip' || normalized === 'x-gzip') {
    return stream.pipe(createGunzip());
  }
  if (normalized === 'deflate') {
    return stream.pipe(createInflate());
  }
  if (normalized === 'br') {
    return stream.pipe(createBrotliDecompress());
  }
  return stream;
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (typeof chunk === 'string') {
    return Buffer.from(chunk);
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  return Buffer.alloc(0);
}

async function readCapped(stream: Readable, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    for await (const chunk of stream) {
      const buffer = toBuffer(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        stream.destroy();
        throw new CalendarFetchError(
          'response-too-large',
          `The calendar feed is larger than the ${maxBytes} byte limit`,
        );
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof CalendarFetchError) {
      throw error;
    }
    throw new CalendarFetchError('network-error', 'The calendar feed could not be read');
  }

  return Buffer.concat(chunks).toString('utf8');
}

// ─── The request ────────────────────────────────────────────────────────────

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function requestOnce(
  url: URL,
  targets: ResolvedTarget[],
  options: Required<Pick<CalendarFetchOptions, 'maxBytes' | 'userAgent'>> &
    Pick<CalendarFetchOptions, 'etag' | 'lastModified'>,
  signal: AbortSignal,
): Promise<RawResponse> {
  const transport = url.protocol === 'https:' ? https : http;

  const headers: Record<string, string> = {
    Accept: ACCEPT_HEADER,
    'User-Agent': options.userAgent,
  };
  if (options.etag) {
    headers['If-None-Match'] = options.etag;
  }
  if (options.lastModified) {
    headers['If-Modified-Since'] = options.lastModified;
  }

  return new Promise<RawResponse>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: 'GET',
        headers,
        // Pin the connection to the validated addresses so a DNS record that
        // changes after the check cannot redirect the request.
        lookup: pinnedLookup(targets),
        signal,
      },
      (response) => {
        const status = response.statusCode ?? 0;

        if (status === 304 || (status >= 300 && status < 400)) {
          // A redirect is followed by the caller, which has to validate the
          // new location before it goes anywhere near it.
          response.resume();
          resolve({ status, headers: response.headers, body: '' });
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(
            new CalendarFetchError(
              'http-error',
              `The calendar server answered with HTTP ${status}`,
            ),
          );
          return;
        }

        const declared = Number(response.headers['content-length'] ?? '');
        if (Number.isFinite(declared) && declared > options.maxBytes) {
          response.destroy();
          reject(
            new CalendarFetchError(
              'response-too-large',
              `The calendar feed is larger than the ${options.maxBytes} byte limit`,
            ),
          );
          return;
        }

        const decoded = decompressStream(response, response.headers['content-encoding']);
        readCapped(decoded, options.maxBytes)
          .then((body) => resolve({ status, headers: response.headers, body }))
          .catch((error: unknown) => {
            // The deadline can fire part-way through the body, so the read can
            // fail with a timeout rather than a network error.
            if (signal.aborted) {
              reject(new CalendarFetchError('timeout', 'The calendar request timed out'));
              return;
            }
            reject(error);
          });
      },
    );

    request.on('error', (error) => {
      if (signal.aborted) {
        reject(new CalendarFetchError('timeout', 'The calendar request timed out'));
        return;
      }
      reject(
        new CalendarFetchError('network-error', `The calendar request failed: ${error.message}`),
      );
    });

    request.end();
  });
}

/**
 * Fetch a calendar feed.
 *
 * A `304 Not Modified` is a success: the caller keeps the copy it already
 * has and only updates the fetch timestamp.
 */
export async function fetchCalendarFeed(
  url: string,
  options: CalendarFetchOptions = {},
): Promise<CalendarFetchResult> {
  const maxBytes = options.maxBytes ?? CALENDAR_FETCH_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? CALENDAR_FETCH_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? CALENDAR_FETCH_MAX_REDIRECTS;
  const allowInsecureUrls = options.allowInsecureUrls ?? false;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const deadline = Date.now() + timeoutMs;
  let current = assertFetchableCalendarUrl(url, allowInsecureUrls);
  let redirects = 0;

  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new CalendarFetchError('timeout', 'The calendar request timed out');
    }

    const hostname = current.hostname.replace(/^\[|\]$/g, '');
    const literalFamily = isIP(hostname);
    let targets: ResolvedTarget[];

    if (literalFamily !== 0) {
      if (isBlockedAddress(hostname)) {
        throw new CalendarFetchError(
          'blocked-address',
          'The calendar URL points at an address the server will not fetch',
        );
      }
      targets = [{ address: hostname, family: literalFamily === 6 ? 6 : 4 }];
    } else if (options.resolveHost) {
      targets = await options.resolveHost(hostname);
    } else {
      targets = await resolveTargets(hostname);
    }

    const response = await requestOnce(
      current,
      targets,
      { maxBytes, userAgent, etag: options.etag, lastModified: options.lastModified },
      AbortSignal.timeout(remaining),
    );

    if (response.status === 304) {
      return {
        body: '',
        notModified: true,
        status: response.status,
        etag: readHeader(response.headers.etag),
        lastModified: readHeader(response.headers['last-modified']),
      };
    }

    const location = response.headers.location;
    const isRedirect = response.status >= 300 && response.status < 400;

    if (!isRedirect) {
      return {
        body: response.body,
        notModified: false,
        status: response.status,
        etag: readHeader(response.headers.etag),
        lastModified: readHeader(response.headers['last-modified']),
      };
    }

    if (!location) {
      throw new CalendarFetchError(
        'http-error',
        `The calendar server answered with HTTP ${response.status} and no destination`,
      );
    }

    if (redirects >= maxRedirects) {
      throw new CalendarFetchError(
        'too-many-redirects',
        `The calendar URL redirected more than ${maxRedirects} times`,
      );
    }

    redirects += 1;
    // Every hop is validated from scratch: a redirect may point anywhere.
    current = assertFetchableCalendarUrl(new URL(location, current).toString(), allowInsecureUrls);
  }
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
