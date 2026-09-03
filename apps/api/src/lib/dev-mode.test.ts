import assert from 'node:assert/strict';
import test from 'node:test';

// Ensure the SQLite singleton uses a shared temp DB before auth.js imports it.
import '../db/test-db.js';

import {
  DEFAULT_DEV_MODE_CONFIG,
  bypassEmailRateLimits,
  bypassIpBan,
  bypassLoginLockout,
  devMode,
  emailToConsole,
  isLocalDevMode,
  parseDevModeConfig,
} from './dev-mode.js';

test('parseDevModeConfig parses a full config', () => {
  const config = parseDevModeConfig(
    JSON.stringify({
      enabled: true,
      emailToConsole: false,
      bypassEmailRateLimits: false,
      bypassLoginLockout: false,
      bypassIpBan: false,
    }),
  );
  assert.deepEqual(config, {
    enabled: true,
    emailToConsole: false,
    bypassEmailRateLimits: false,
    bypassLoginLockout: false,
    bypassIpBan: false,
  });
});

test('parseDevModeConfig fills defaults for missing fields', () => {
  assert.deepEqual(parseDevModeConfig('{}'), DEFAULT_DEV_MODE_CONFIG);
  assert.deepEqual(parseDevModeConfig('{"enabled": true}'), {
    ...DEFAULT_DEV_MODE_CONFIG,
    enabled: true,
  });
});

test('parseDevModeConfig rejects malformed input', () => {
  assert.throws(() => parseDevModeConfig('not json'), /not valid JSON/);
  assert.throws(() => parseDevModeConfig('[]'), /expected a JSON object/);
  assert.throws(() => parseDevModeConfig('{"enabled": "yes"}'), /"enabled" must be a boolean/);
});

test('dev mode is off by default (committed dev-mode.json has enabled: false)', () => {
  const previous = process.env['DEV_MODE'];
  try {
    delete process.env['DEV_MODE'];
    assert.equal(devMode(), false);
    assert.equal(emailToConsole(), false);
    assert.equal(bypassEmailRateLimits(), false);
    assert.equal(bypassLoginLockout(), false);
    assert.equal(bypassIpBan(), false);
  } finally {
    if (previous === undefined) {
      delete process.env['DEV_MODE'];
    } else {
      process.env['DEV_MODE'] = previous;
    }
  }
});

test('DEV_MODE env override wins over the file', () => {
  const previous = process.env['DEV_MODE'];
  try {
    process.env['DEV_MODE'] = 'true';
    assert.equal(devMode(), true);
    // File options default to true, so all bypasses are active.
    assert.equal(emailToConsole(), true);
    assert.equal(bypassEmailRateLimits(), true);
    assert.equal(bypassLoginLockout(), true);
    assert.equal(bypassIpBan(), true);

    process.env['DEV_MODE'] = 'false';
    assert.equal(devMode(), false);
    assert.equal(bypassEmailRateLimits(), false);
  } finally {
    if (previous === undefined) {
      delete process.env['DEV_MODE'];
    } else {
      process.env['DEV_MODE'] = previous;
    }
  }
});

test('dev mode is refused in production without the explicit opt-in', () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    DEV_MODE: process.env['DEV_MODE'],
    ALLOW_DEV_MODE_IN_PRODUCTION: process.env['ALLOW_DEV_MODE_IN_PRODUCTION'],
  };

  try {
    process.env['NODE_ENV'] = 'production';
    process.env['DEV_MODE'] = 'true';

    // Enabled dev mode in production without the override → refuse to start.
    delete process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];
    assert.throws(() => devMode(), /ALLOW_DEV_MODE_IN_PRODUCTION/);

    // With the explicit opt-in, dev mode is allowed (test instance).
    process.env['ALLOW_DEV_MODE_IN_PRODUCTION'] = 'true';
    assert.equal(devMode(), true);
    assert.equal(bypassEmailRateLimits(), true);

    // Explicitly disabled dev mode never throws, even in production.
    process.env['DEV_MODE'] = 'false';
    assert.equal(devMode(), false);

    // Unset (file disabled by default) also never throws.
    delete process.env['DEV_MODE'];
    assert.equal(devMode(), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test('dev mode forces email verification off even when REQUIRE_EMAIL_VERIFICATION is set', async () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    DEV_MODE: process.env['DEV_MODE'],
    REQUIRE_EMAIL_VERIFICATION: process.env['REQUIRE_EMAIL_VERIFICATION'],
  };

  try {
    process.env['NODE_ENV'] = 'test';
    process.env['REQUIRE_EMAIL_VERIFICATION'] = 'true';

    // Without dev mode, the flag applies.
    process.env['DEV_MODE'] = 'false';
    const { emailVerificationRequired } = await import('./auth.js');
    assert.equal(emailVerificationRequired(), true);

    // With dev mode, verification is forced off.
    process.env['DEV_MODE'] = 'true';
    assert.equal(emailVerificationRequired(), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test('isLocalDevMode requires a loopback deployment, not just dev NODE_ENV', () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    DEV_MODE: process.env['DEV_MODE'],
    ALLOW_DEV_MODE_IN_PRODUCTION: process.env['ALLOW_DEV_MODE_IN_PRODUCTION'],
    APP_BASE_URL: process.env['APP_BASE_URL'],
    FRONTEND_BASE_URL: process.env['FRONTEND_BASE_URL'],
  };

  try {
    process.env['NODE_ENV'] = 'development';
    process.env['DEV_MODE'] = 'true';
    delete process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];

    // Loopback deployment → local dev mode.
    process.env['APP_BASE_URL'] = 'http://localhost:3000';
    process.env['FRONTEND_BASE_URL'] = 'http://localhost:4200';
    assert.equal(isLocalDevMode(), true);

    // Publicly reachable test deployment with dev mode on → not local.
    process.env['APP_BASE_URL'] = 'https://test.example.com/api';
    process.env['FRONTEND_BASE_URL'] = 'https://test.example.com';
    assert.equal(isLocalDevMode(), false);

    // Either base URL remote is enough to opt out.
    process.env['APP_BASE_URL'] = 'http://localhost:3000';
    assert.equal(isLocalDevMode(), false);

    // Production is never local, even with the opt-in.
    process.env['NODE_ENV'] = 'production';
    process.env['ALLOW_DEV_MODE_IN_PRODUCTION'] = 'true';
    process.env['FRONTEND_BASE_URL'] = 'http://localhost:4200';
    assert.equal(isLocalDevMode(), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
