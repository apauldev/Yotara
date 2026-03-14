import assert from 'node:assert/strict';
import test from 'node:test';
import { getAppBaseUrl, getCorsOrigins, getTrustedOrigins } from './auth-origins.js';

test('auth origin helpers merge defaults with configured origins', () => {
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
});
