import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAppBaseUrl,
  getCorsOrigins,
  getFrontendBaseUrl,
  getFrontendVerificationUrl,
  getTrustedOrigins,
} from './auth-origins.js';

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

    process.env['NODE_ENV'] = 'production';
    delete process.env['FRONTEND_BASE_URL'];
    process.env['APP_BASE_URL'] = 'https://example.com/api';
    assert.equal(getFrontendBaseUrl(), 'https://example.com');
    assert.equal(
      getFrontendVerificationUrl('https://example.com/api/verify-email?token=abc'),
      'https://example.com/verify-email?token=abc',
    );
    assert.throws(
      () => getFrontendVerificationUrl('https://example.com/api/verify-email'),
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
