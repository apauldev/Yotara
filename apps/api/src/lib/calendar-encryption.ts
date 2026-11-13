import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Encryption for calendar source URLs.
 *
 * An ICS URL is a credential: it usually embeds a secret token, and anyone
 * holding it can read the calendar. The URL is therefore stored encrypted at
 * rest, never logged, and never returned by the API.
 *
 * The format is `v1.<iv>.<tag>.<ciphertext>`, each part base64url encoded.
 * The version prefix exists so the scheme can be rotated later without
 * guessing which payloads use which layout.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const VERSION = 'v1';

const HKDF_SALT = 'yotara.calendar.url.v1';
const HKDF_INFO = 'yotara.calendar.url.encryption.v1';

const DEFAULT_AUTH_SECRET = 'local-dev-secret-change-me';

export class CalendarEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarEncryptionError';
  }
}

/**
 * Derive a 32-byte key from secret material.
 *
 * HKDF is used for both key sources so the derived key is uniformly
 * distributed and separated by purpose. The raw secret is used as the input
 * key material: `BETTER_AUTH_SECRET` is required to be at least 32 random
 * bytes encoded as hex or Base64, so its textual form carries the same entropy
 * as the bytes it encodes.
 */
function deriveKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      Buffer.from(HKDF_SALT, 'utf8'),
      Buffer.from(HKDF_INFO, 'utf8'),
      KEY_BYTES,
    ),
  );
}

let cachedKey: { secret: string; key: Buffer } | null = null;

/**
 * Resolve the secret the calendar URL key is derived from.
 *
 * `CALENDAR_ENCRYPTION_KEY` is preferred and is the only way to rotate the
 * key independently of the session secret. `BETTER_AUTH_SECRET` is the
 * fallback, which keeps a self-hoster who set only that one variable working.
 */
function resolveSecret(): string {
  const explicit = process.env['CALENDAR_ENCRYPTION_KEY']?.trim();
  if (explicit) {
    return explicit;
  }

  const fallback = process.env['BETTER_AUTH_SECRET']?.trim();
  if (fallback) {
    if (fallback === DEFAULT_AUTH_SECRET) {
      throw new CalendarEncryptionError(
        'Refusing to encrypt calendar URLs with the default BETTER_AUTH_SECRET placeholder. Set CALENDAR_ENCRYPTION_KEY to a unique secret.',
      );
    }
    return fallback;
  }

  throw new CalendarEncryptionError(
    'No calendar encryption key is configured. Set CALENDAR_ENCRYPTION_KEY, or set BETTER_AUTH_SECRET so it can be used as the fallback.',
  );
}

/**
 * Resolve the 32-byte key used to encrypt and decrypt calendar source URLs.
 *
 * The key is derived once and cached until the underlying secret changes, so
 * repeated calls do not pay for HKDF on every row.
 */
export function resolveCalendarEncryptionKey(): Buffer {
  const secret = resolveSecret();
  if (cachedKey && cachedKey.secret === secret) {
    return cachedKey.key;
  }

  const key = deriveKey(secret);
  cachedKey = { secret, key };
  return key;
}

/**
 * Encrypt a calendar source URL.
 *
 * A fresh random IV is used for every call, so encrypting the same URL twice
 * produces different ciphertexts.
 */
export function encryptUrl(
  plaintext: string,
  key: Buffer = resolveCalendarEncryptionKey(),
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt a calendar source URL.
 *
 * Fails closed: a wrong key, a truncated payload, or a tampered ciphertext all
 * raise rather than returning anything. The message never contains the URL or
 * the key.
 */
export function decryptUrl(payload: string, key: Buffer = resolveCalendarEncryptionKey()): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new CalendarEncryptionError('Unrecognised calendar URL ciphertext format');
  }

  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new CalendarEncryptionError('Malformed calendar URL ciphertext');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new CalendarEncryptionError(
      'Calendar URL could not be decrypted with the configured key',
    );
  }
}

/**
 * Normalise a calendar URL before it is hashed.
 *
 * Duplicate detection compares hashes, so two spellings of the same URL must
 * hash the same. The scheme and host are case-insensitive and the default port
 * is implied, while the path and query are left untouched because they are
 * what actually identifies the feed.
 */
export function normalizeCalendarUrl(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';

  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = '';
  }

  return parsed.toString();
}

/**
 * Hash a calendar URL for duplicate detection.
 *
 * SHA-256 matches the hash family used for event ids, so the feature does not
 * carry two.
 */
export function hashUrl(url: string): string {
  return createHash('sha256').update(normalizeCalendarUrl(url), 'utf8').digest('hex');
}

/**
 * Describe a calendar URL in a form that is safe to log or return.
 *
 * Only the host survives. The path and query of an ICS URL usually carry the
 * secret token, so nothing beyond the host may appear in an error message, a
 * log line, or an API response.
 */
export function describeSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || 'unknown host';
  } catch {
    return 'unknown host';
  }
}
