import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAppBaseUrl,
  getCorsOrigins,
  getFrontendBaseUrl,
  getFrontendResetUrl,
  getFrontendVerificationUrl,
  getTrustedOrigins,
  parseOriginList,
} from './auth-origins.js';

test('parseOriginList trims, filters empty and whitespace-only entries', () => {
  assert.deepEqual(parseOriginList(undefined), []);
  assert.deepEqual(parseOriginList(''), []);
  assert.deepEqual(parseOriginList('   , , '), []);
  assert.deepEqual(parseOriginList('https://a.com ,  ,https://b.com\t,'), [
    'https://a.com',
    'https://b.com',
  ]);
});

test('parseOriginList passes malformed entries through unchanged', () => {
  // Malformed values never match a real origin, so they are inert — pin that
  // behavior rather than guessing at validation rules here.
  assert.deepEqual(parseOriginList('http://[::1'), ['http://[::1']);
  assert.deepEqual(parseOriginList('not a url'), ['not a url']);
});

test('parseOriginList refuses wildcard origins', () => {
  assert.throws(() => parseOriginList('*'), /Wildcard origins are not allowed/);
  assert.throws(() => parseOriginList('https://*.example.com'), /Wildcard origins are not allowed/);
  assert.throws(() => parseOriginList('https://a.com, *'), /Wildcard origins are not allowed/);
});

test('auth origin helpers merge defaults with configured origins', () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    APP_BASE_URL: process.env['APP_BASE_URL'],
    TRUSTED_ORIGINS: process.env['TRUSTED_ORIGINS'],
    CORS_ORIGIN: process.env['CORS_ORIGIN'],
    FRONTEND_BASE_URL: process.env['FRONTEND_BASE_URL'],
  };

  try {
    process.env['NODE_ENV'] = 'test';
    process.env['APP_BASE_URL'] = 'https://api.example.com';
    process.env['TRUSTED_ORIGINS'] = 'https://app.example.com, https://admin.example.com';
    process.env['CORS_ORIGIN'] = 'https://admin.example.com, https://marketing.example.com';

    assert.equal(getAppBaseUrl(), 'https://api.example.com');
    assert.deepEqual(getTrustedOrigins(), [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://app.example.com',
      'https://admin.example.com',
    ]);
    assert.deepEqual(getCorsOrigins(), [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://app.example.com',
      'https://admin.example.com',
      'https://marketing.example.com',
    ]);

    process.env['FRONTEND_BASE_URL'] = 'https://frontend.example.com/';
    assert.equal(getFrontendBaseUrl(), 'https://frontend.example.com');
    assert.equal(
      getFrontendVerificationUrl('https://api.example.com/verify-email?token=a%2Bb'),
      'https://frontend.example.com/verify-email?token=a%2Bb',
    );
    // Reset links put the token in the URL path (Better Auth shape) and must
    // be rewritten to a direct frontend link with the token in the query —
    // never the API's redirect-based /auth/reset-password/<token> route.
    assert.equal(
      getFrontendResetUrl(
        'https://api.example.com/auth/reset-password/abc123?callbackURL=https%3A%2F%2Ffrontend.example.com%2Freset-password',
      ),
      'https://frontend.example.com/reset-password?token=abc123',
    );

    process.env['NODE_ENV'] = 'production';
    delete process.env['FRONTEND_BASE_URL'];
    process.env['APP_BASE_URL'] = 'https://example.com/api';
    assert.equal(getFrontendBaseUrl(), 'https://example.com');
    assert.equal(
      getFrontendVerificationUrl('https://example.com/api/verify-email?token=abc'),
      'https://example.com/verify-email?token=abc',
    );
    assert.equal(
      getFrontendResetUrl('https://example.com/api/auth/reset-password/xyz?callbackURL='),
      'https://example.com/reset-password?token=xyz',
    );
    assert.throws(
      () => getFrontendVerificationUrl('https://example.com/api/verify-email'),
      /missing its token/,
    );
    assert.throws(
      () => getFrontendResetUrl('https://example.com/api/auth/reset-password?callbackURL=x'),
      /missing its token/,
    );
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
