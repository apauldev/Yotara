import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AUTH_SECRET,
  MIN_AUTH_SECRET_BYTES,
  assertAuthSecretConfigured,
  validateAuthSecret,
} from './auth-secret.js';

const HEX_SECRET = '903d44f75ea956577ae15335bbbef8532a867cdeae599cccac72357d40f14214';
const BASE64_SECRET = 'w81gXgLNgJ/zOSM4bubuGh+CxPtHsCyvzTblRxR/WME=';
const SEQUENTIAL_HEX_SECRET = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const PASSPHRASE_SECRET = 'correct-horse-battery-staple-into-the-woods';

function restoreEnvironment(previous: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test('validateAuthSecret accepts canonical generated secrets', () => {
  assert.equal(validateAuthSecret(HEX_SECRET), null);
  assert.equal(validateAuthSecret(BASE64_SECRET), null);
});

test('validateAuthSecret rejects missing, placeholder, and short secrets', () => {
  assert.match(validateAuthSecret(undefined)!, /missing/);
  assert.match(validateAuthSecret('')!, /missing/);
  assert.match(validateAuthSecret(DEFAULT_AUTH_SECRET)!, /placeholder/);
  assert.match(validateAuthSecret('short-secret')!, /canonical hex or Base64/);
  assert.match(validateAuthSecret('00'.repeat(MIN_AUTH_SECRET_BYTES - 1))!, /32 random bytes/);
});

test('validateAuthSecret rejects malformed encodings and plain-text passphrases', () => {
  const invalidSecrets = [
    `${HEX_SECRET}0`,
    `${BASE64_SECRET}A`,
    BASE64_SECRET.slice(0, -1),
    'not a generated secret with whitespace',
    PASSPHRASE_SECRET,
    'password-password-password-123456789',
  ];

  for (const secret of invalidSecrets) {
    assert.match(
      validateAuthSecret(secret)!,
      /canonical hex or Base64|repeated or sequential pattern/,
    );
  }
});

test('validateAuthSecret rejects repeated and sequential generated-looking values', () => {
  const invalidSecrets = [
    '00'.repeat(MIN_AUTH_SECRET_BYTES),
    'ab'.repeat(MIN_AUTH_SECRET_BYTES),
    '0123456789abcdef'.repeat(4),
    SEQUENTIAL_HEX_SECRET,
    'abcdefghijklmnopqrstuvwxyz123456',
  ];

  for (const secret of invalidSecrets) {
    assert.match(
      validateAuthSecret(secret)!,
      /repeated or sequential pattern|canonical hex or Base64/,
    );
  }
});

test('validateAuthSecret rejects whitespace and control characters', () => {
  assert.match(validateAuthSecret(` ${HEX_SECRET}`)!, /canonical hex or Base64/);
  assert.match(validateAuthSecret(`${HEX_SECRET}\n`)!, /canonical hex or Base64/);
});

test('assertAuthSecretConfigured enforces generated secrets outside development and test', () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'],
  };

  try {
    process.env['NODE_ENV'] = 'production';

    delete process.env['BETTER_AUTH_SECRET'];
    assert.throws(() => assertAuthSecretConfigured(), /missing/);

    process.env['BETTER_AUTH_SECRET'] = DEFAULT_AUTH_SECRET;
    assert.throws(() => assertAuthSecretConfigured(), /placeholder/);

    process.env['BETTER_AUTH_SECRET'] = PASSPHRASE_SECRET;
    assert.throws(() => assertAuthSecretConfigured(), /canonical hex or Base64/);

    process.env['BETTER_AUTH_SECRET'] = BASE64_SECRET;
    assert.doesNotThrow(() => assertAuthSecretConfigured());

    process.env['BETTER_AUTH_SECRET'] = HEX_SECRET;
    assert.doesNotThrow(() => assertAuthSecretConfigured('staging'));
  } finally {
    restoreEnvironment(previous);
  }
});

test('assertAuthSecretConfigured exempts development and test', () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'],
  };

  try {
    delete process.env['BETTER_AUTH_SECRET'];

    process.env['NODE_ENV'] = 'development';
    assert.doesNotThrow(() => assertAuthSecretConfigured());

    process.env['NODE_ENV'] = 'test';
    assert.doesNotThrow(() => assertAuthSecretConfigured());
  } finally {
    restoreEnvironment(previous);
  }
});
