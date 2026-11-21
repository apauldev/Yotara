import * as dnsPromises from 'node:dns/promises';
import { LRUCache } from 'lru-cache';
import mailChecker from 'mailchecker';
import { isValidEmail, normalizeEmail } from '@yotara/shared';
import { getAppBaseUrl } from './auth-origins.js';
import { emailVerificationRequired } from './auth.js';
import { isLoopbackHostname } from './dev-mode.js';

/**
 * Signup email validation: reject disposable/dummy domains and domains that
 * cannot receive mail before any verification email is sent.
 *
 * This module is deliberately called from the Fastify auth bridge, *before*
 * `auth.handler()`. Better Auth wraps signup in a SQLite write transaction;
 * doing a slow DNS lookup inside a database hook would hold the write lock
 * open and serialize signups.
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const DISPOSABLE_REASON = 'Disposable or temporary email addresses are not permitted.';
const NO_MAIL_REASON = 'This email domain does not have an active mail server.';
const NO_MAIL_ACCEPTED_REASON = 'This domain does not accept email.';
const TEMPORARY_REASON =
  'We could not verify this email domain right now. Please try again in a moment.';
const INVALID_REASON = 'Enter a valid email address.';

const DNS_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2_000;

/** RFC 2606 reserved names; they are guaranteed never to receive real mail. */
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);
const RESERVED_SUFFIXES = ['.example', '.test', '.invalid', '.localhost', '.local'];

/**
 * DNS functions are held in an object so tests can stub them with
 * `mock.method`. ESM module namespace properties are not mockable directly.
 */
export const dnsResolver = {
  resolveMx: dnsPromises.resolveMx,
  resolve4: dnsPromises.resolve4,
  resolve6: dnsPromises.resolve6,
};

/** Definitive domain results only. Timeouts/resolver failures are never cached. */
const domainCache = new LRUCache<string, ValidationResult>({
  max: CACHE_MAX_ENTRIES,
  ttl: CACHE_TTL_MS,
});

class DnsTimeoutError extends Error {}

function withTimeout<T>(lookup: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DnsTimeoutError('DNS lookup timed out')),
      DNS_TIMEOUT_MS,
    );
    lookup.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** ENODATA/ENOTFOUND mean "definitively no record"; anything else is transient. */
function isNoRecordsError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ENODATA' || code === 'ENOTFOUND';
}

function transientResult(error: unknown): ValidationResult {
  if (error instanceof DnsTimeoutError) {
    return { valid: false, reason: TEMPORARY_REASON };
  }
  // Log for diagnosis when a deployment has a resolver problem, but never
  // expose the raw DNS error to the client.
  console.warn('[email-validator] DNS lookup failed:', error);
  return { valid: false, reason: TEMPORARY_REASON };
}

/** True for known burner domains and RFC 2606 placeholder domains. */
export function isDisposableOrReservedDomain(email: string, domain: string): boolean {
  if (!mailChecker.isValid(email)) {
    return true;
  }
  return (
    RESERVED_DOMAINS.has(domain) || RESERVED_SUFFIXES.some((suffix) => domain.endsWith(suffix))
  );
}

/**
 * Check whether a domain can receive mail:
 *   - explicit null MX (RFC 7505) → reject
 *   - MX records → accept
 *   - no MX → accept if A/AAAA records exist (RFC 5321 implicit MX)
 *   - no records at all → reject
 * A timeout or resolver failure yields a *temporary* rejection and is not
 * cached, so a brief DNS outage doesn't poison the cache for 15 minutes.
 */
export async function checkDomainMailSupport(rawDomain: string): Promise<ValidationResult> {
  const domain = normalizeEmail(rawDomain);

  const cached = domainCache.get(domain);
  if (cached !== undefined) {
    return cached;
  }

  let mxRecords: Awaited<ReturnType<typeof dnsResolver.resolveMx>>;
  try {
    mxRecords = await withTimeout(dnsResolver.resolveMx(domain));
  } catch (error) {
    if (!isNoRecordsError(error)) {
      return transientResult(error);
    }
    mxRecords = [];
  }

  // RFC 7505: a single MX with exchange "." means the domain sends no mail.
  if (mxRecords.some((record) => record.exchange === '.')) {
    domainCache.set(domain, { valid: false, reason: NO_MAIL_ACCEPTED_REASON });
    return { valid: false, reason: NO_MAIL_ACCEPTED_REASON };
  }

  if (mxRecords.length > 0) {
    domainCache.set(domain, { valid: true });
    return { valid: true };
  }

  // RFC 5321 implicit MX: no MX records does not mean no mail service —
  // delivery falls back to the domain's A/AAAA address.
  for (const lookup of [dnsResolver.resolve4, dnsResolver.resolve6] as const) {
    try {
      const records = await withTimeout(lookup(domain));
      if (records.length > 0) {
        domainCache.set(domain, { valid: true });
        return { valid: true };
      }
    } catch (error) {
      if (!isNoRecordsError(error)) {
        return transientResult(error);
      }
    }
  }

  const noMail = { valid: false as const, reason: NO_MAIL_REASON };
  domainCache.set(domain, noMail);
  return noMail;
}

/** Full signup validation. `rawEmail` may be untrimmed/mixed case. */
export async function validateSignupEmail(rawEmail: string): Promise<ValidationResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { valid: false, reason: INVALID_REASON };
  }

  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (isDisposableOrReservedDomain(email, domain)) {
    return { valid: false, reason: DISPOSABLE_REASON };
  }

  return checkDomainMailSupport(domain);
}

/**
 * Validation is on only when the product itself requires email verification,
 * since that's when a bad address would turn into a hard bounce. Test runs,
 * non-production local development (including `pnpm dev:email`), and the
 * explicit emergency bypass skip it.
 *
 * The loopback carve-out must NOT apply in production: the Docker images ship
 * with `APP_BASE_URL=http://localhost:8080` because nginx strips the /api
 * prefix, so loopback does not mean "local" in a deployed instance.
 */
export function shouldValidateSignupEmail(): boolean {
  if (process.env['NODE_ENV'] === 'test') {
    return false;
  }
  if (process.env['SKIP_EMAIL_DOMAIN_VALIDATION'] === 'true') {
    return false;
  }
  try {
    if (
      process.env['NODE_ENV'] !== 'production' &&
      isLoopbackHostname(new URL(getAppBaseUrl()).hostname)
    ) {
      return false;
    }
  } catch {
    // A malformed APP_BASE_URL is a deployment error handled elsewhere; do not
    // let it turn into a signup failure here.
  }
  return emailVerificationRequired();
}
