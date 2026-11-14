import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CalendarEncryptionError,
  decryptUrl,
  describeSourceUrl,
  encryptUrl,
  hashUrl,
  normalizeCalendarUrl,
  resolveCalendarEncryptionKey,
} from './calendar-encryption.js';

const SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);

let savedSecret: string | undefined;
let savedKey: string | undefined;

beforeEach(() => {
  savedSecret = process.env['BETTER_AUTH_SECRET'];
  savedKey = process.env['CALENDAR_ENCRYPTION_KEY'];
  process.env['BETTER_AUTH_SECRET'] = SECRET;
  delete process.env['CALENDAR_ENCRYPTION_KEY'];
});

afterEach(() => {
  if (savedSecret === undefined) {
    delete process.env['BETTER_AUTH_SECRET'];
  } else {
    process.env['BETTER_AUTH_SECRET'] = savedSecret;
  }
  if (savedKey === undefined) {
    delete process.env['CALENDAR_ENCRYPTION_KEY'];
  } else {
    process.env['CALENDAR_ENCRYPTION_KEY'] = savedKey;
  }
});

describe('calendar URL encryption', () => {
  it('round-trips a URL', () => {
    const url = 'https://calendar.example.com/basic.ics?token=super-secret';
    const ciphertext = encryptUrl(url);
    assert.notEqual(ciphertext, url);
    assert.ok(!ciphertext.includes('super-secret'));
    assert.equal(decryptUrl(ciphertext), url);
  });

  it('produces a different ciphertext each time', () => {
    const url = 'https://calendar.example.com/basic.ics';
    assert.notEqual(encryptUrl(url), encryptUrl(url));
  });

  it('names the format version so the scheme can be rotated', () => {
    assert.ok(encryptUrl('https://example.com/a.ics').startsWith('v1.'));
  });

  it('falls back to BETTER_AUTH_SECRET when no dedicated key is set', () => {
    const url = 'https://calendar.example.com/basic.ics';
    const ciphertext = encryptUrl(url);
    assert.equal(decryptUrl(ciphertext), url);
  });

  it('prefers CALENDAR_ENCRYPTION_KEY over BETTER_AUTH_SECRET', () => {
    process.env['CALENDAR_ENCRYPTION_KEY'] = 'dedicated-key-value';
    const url = 'https://calendar.example.com/basic.ics';
    const ciphertext = encryptUrl(url);

    const dedicatedKey = resolveCalendarEncryptionKey();
    assert.equal(decryptUrl(ciphertext, dedicatedKey), url);

    // The fallback secret must not be able to open a payload sealed with the
    // dedicated key.
    delete process.env['CALENDAR_ENCRYPTION_KEY'];
    const fallbackKey = resolveCalendarEncryptionKey();
    assert.notDeepEqual(dedicatedKey, fallbackKey);
    assert.throws(() => decryptUrl(ciphertext, fallbackKey), CalendarEncryptionError);
  });

  it('fails closed when the key does not match', () => {
    const ciphertext = encryptUrl('https://calendar.example.com/basic.ics');
    const wrongKey = resolveCalendarEncryptionKey();
    // A different secret yields a different derived key.
    process.env['BETTER_AUTH_SECRET'] = OTHER_SECRET;
    const otherKey = resolveCalendarEncryptionKey();

    assert.notDeepEqual(wrongKey, otherKey);
    assert.throws(() => decryptUrl(ciphertext, otherKey), CalendarEncryptionError);
  });

  it('fails closed on a tampered ciphertext', () => {
    const ciphertext = encryptUrl('https://calendar.example.com/basic.ics');
    const parts = ciphertext.split('.');
    const body = Buffer.from(parts[3], 'base64url');
    body[0] = (body[0] + 1) % 256;
    const tampered = [parts[0], parts[1], parts[2], body.toString('base64url')].join('.');

    assert.throws(() => decryptUrl(tampered), CalendarEncryptionError);
  });

  it('rejects a payload that is not in the expected format', () => {
    assert.throws(() => decryptUrl('not-a-payload'), CalendarEncryptionError);
    assert.throws(() => decryptUrl('v2.a.b.c'), CalendarEncryptionError);
    assert.throws(() => decryptUrl('v1.short.tag.value'), CalendarEncryptionError);
  });

  it('never leaks the URL in an error message', () => {
    const url = 'https://calendar.example.com/basic.ics?token=super-secret';
    const ciphertext = encryptUrl(url);
    process.env['BETTER_AUTH_SECRET'] = OTHER_SECRET;

    try {
      decryptUrl(ciphertext);
      assert.fail('expected the decryption to fail');
    } catch (error) {
      assert.ok(error instanceof CalendarEncryptionError);
      assert.equal(error.message, 'Calendar URL could not be decrypted with the configured key');
    }
  });

  it('refuses to run with no key material at all', () => {
    delete process.env['BETTER_AUTH_SECRET'];
    delete process.env['CALENDAR_ENCRYPTION_KEY'];
    assert.throws(() => encryptUrl('https://example.com/a.ics'), CalendarEncryptionError);
  });

  it('refuses to run with the default placeholder secret', () => {
    process.env['BETTER_AUTH_SECRET'] = 'local-dev-secret-change-me';
    assert.throws(() => encryptUrl('https://example.com/a.ics'), CalendarEncryptionError);
  });
});

describe('hashUrl', () => {
  it('is stable for the same URL', () => {
    const url = 'https://calendar.example.com/basic.ics';
    assert.equal(hashUrl(url), hashUrl(url));
  });

  it('ignores the host case and the default port', () => {
    assert.equal(
      hashUrl('https://Calendar.Example.com/basic.ics'),
      hashUrl('https://calendar.example.com:443/basic.ics'),
    );
  });

  it('ignores the fragment', () => {
    assert.equal(
      hashUrl('https://calendar.example.com/basic.ics#anchor'),
      hashUrl('https://calendar.example.com/basic.ics'),
    );
  });

  it('separates different URLs', () => {
    assert.notEqual(
      hashUrl('https://calendar.example.com/a.ics'),
      hashUrl('https://calendar.example.com/b.ics'),
    );
  });

  it('does not confuse a split between host and path', () => {
    assert.notEqual(
      hashUrl('https://calendar.example.com/a.ics'),
      hashUrl('https://calendar.example.com/a/ics'),
    );
  });
});

describe('normalizeCalendarUrl', () => {
  it('lowercases the scheme and host but keeps the path', () => {
    assert.equal(
      normalizeCalendarUrl('HTTPS://Calendar.Example.COM/Basic.ics'),
      'https://calendar.example.com/Basic.ics',
    );
  });

  it('drops the default port', () => {
    assert.equal(
      normalizeCalendarUrl('https://calendar.example.com:443/a.ics'),
      'https://calendar.example.com/a.ics',
    );
  });
});

describe('describeSourceUrl', () => {
  it('returns only the host', () => {
    assert.equal(
      describeSourceUrl('https://calendar.example.com/basic.ics?token=super-secret'),
      'calendar.example.com',
    );
  });

  it('does not include the path or the query', () => {
    const description = describeSourceUrl('https://calendar.example.com/basic.ics?token=secret');
    assert.ok(!description.includes('basic.ics'));
    assert.ok(!description.includes('secret'));
  });

  it('degrades gracefully for an unparseable URL', () => {
    assert.equal(describeSourceUrl('not a url'), 'unknown host');
  });
});
