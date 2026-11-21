import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

// The validator imports auth.ts (for the gating flag), which bootstraps the
// database. Point it at a temp DB before any module is loaded.
import '../db/test-db.js';

process.env['NODE_ENV'] = 'test';
process.env['DEV_MODE'] = 'false';

const {
  dnsResolver,
  checkDomainMailSupport,
  isDisposableOrReservedDomain,
  shouldValidateSignupEmail,
  validateSignupEmail,
} = await import('./email-validator.js');

function uniqueDomain(label: string): string {
  return `${label}-${randomUUID()}.com`;
}

afterEach(() => {
  mock.restoreAll();
  mock.timers.reset();
});

test('accepts a domain with MX records', async () => {
  const domain = uniqueDomain('mx');
  const resolveMx = mock.method(dnsResolver, 'resolveMx', async () => [
    { exchange: 'mail.example.net', priority: 10 },
  ]);

  assert.deepEqual(await checkDomainMailSupport(domain), { valid: true });
  assert.equal(resolveMx.mock.calls.length, 1);
});

test('rejects an explicit null MX record (RFC 7505)', async () => {
  const domain = uniqueDomain('null-mx');
  mock.method(dnsResolver, 'resolveMx', async () => [{ exchange: '.', priority: 0 }]);

  const result = await checkDomainMailSupport(domain);
  assert.equal(result.valid, false);
  assert.match(result.reason ?? '', /does not accept email/);
});

test('accepts a domain with no MX but an A record (RFC 5321 implicit MX)', async () => {
  const domain = uniqueDomain('implicit-mx');
  mock.method(dnsResolver, 'resolveMx', async () => []);
  const resolve4 = mock.method(dnsResolver, 'resolve4', async () => ['203.0.113.10']);

  assert.deepEqual(await checkDomainMailSupport(domain), { valid: true });
  assert.equal(resolve4.mock.calls.length, 1);
});

test('rejects a domain with neither MX nor A/AAAA records', async () => {
  const domain = uniqueDomain('no-mail');
  mock.method(dnsResolver, 'resolveMx', async () => {
    throw Object.assign(new Error('no MX'), { code: 'ENODATA' });
  });
  mock.method(dnsResolver, 'resolve4', async () => {
    throw Object.assign(new Error('no A'), { code: 'ENODATA' });
  });
  mock.method(dnsResolver, 'resolve6', async () => {
    throw Object.assign(new Error('no AAAA'), { code: 'ENODATA' });
  });

  const result = await checkDomainMailSupport(domain);
  assert.equal(result.valid, false);
  assert.match(result.reason ?? '', /does not have an active mail server/);
});

test('a DNS timeout is a temporary rejection and is not cached', async () => {
  const domain = uniqueDomain('timeout');
  mock.timers.enable({ apis: ['setTimeout'] });
  const resolveMx = mock.method(dnsResolver, 'resolveMx', () => new Promise<never>(() => {}));

  const pending = checkDomainMailSupport(domain);
  mock.timers.tick(2_000);
  const result = await pending;

  assert.equal(result.valid, false);
  assert.match(result.reason ?? '', /could not verify/);
  resolveMx.mock.restore();
  mock.method(dnsResolver, 'resolveMx', async () => [
    { exchange: 'mail.example.net', priority: 10 },
  ]);
  assert.deepEqual(await checkDomainMailSupport(domain), { valid: true });
});

test('caches definitive results so repeat signups do not re-query DNS', async () => {
  const domain = uniqueDomain('cache');
  const resolveMx = mock.method(dnsResolver, 'resolveMx', async () => [
    { exchange: 'mail.example.net', priority: 10 },
  ]);

  assert.deepEqual(await checkDomainMailSupport(domain), { valid: true });
  assert.deepEqual(await checkDomainMailSupport(domain), { valid: true });
  assert.equal(resolveMx.mock.calls.length, 1);
});

test('rejects disposable and RFC 2606 domains without touching DNS', () => {
  const resolveMx = mock.method(dnsResolver, 'resolveMx', async () => []);

  assert.equal(isDisposableOrReservedDomain('user@mailinator.com', 'mailinator.com'), true);
  assert.equal(isDisposableOrReservedDomain('user@example.com', 'example.com'), true);
  assert.equal(isDisposableOrReservedDomain('user@mail.example.test', 'mail.example.test'), true);
  assert.equal(isDisposableOrReservedDomain('user@realdomain.com', 'realdomain.com'), false);
  assert.equal(resolveMx.mock.calls.length, 0);
});

test('validateSignupEmail normalizes input and validates syntax first', async () => {
  const resolveMx = mock.method(dnsResolver, 'resolveMx', async () => [
    { exchange: 'mail.example.net', priority: 10 },
  ]);

  assert.deepEqual(await validateSignupEmail('  User@MixedCase.com '), { valid: true });
  assert.equal(resolveMx.mock.calls[0]?.arguments[0], 'mixedcase.com');

  const invalid = await validateSignupEmail('not-an-email');
  assert.equal(invalid.valid, false);
  assert.match(invalid.reason ?? '', /valid email address/);
  assert.equal(resolveMx.mock.calls.length, 1, 'syntax failure makes no DNS call');
});

test('shouldValidateSignupEmail gates on verification, env flags, and loopback', () => {
  const previous = {
    NODE_ENV: process.env['NODE_ENV'],
    APP_BASE_URL: process.env['APP_BASE_URL'],
    REQUIRE_EMAIL_VERIFICATION: process.env['REQUIRE_EMAIL_VERIFICATION'],
    SKIP_EMAIL_DOMAIN_VALIDATION: process.env['SKIP_EMAIL_DOMAIN_VALIDATION'],
  };
  try {
    process.env['NODE_ENV'] = 'production';
    process.env['APP_BASE_URL'] = 'https://api.example.com';
    delete process.env['SKIP_EMAIL_DOMAIN_VALIDATION'];
    assert.equal(shouldValidateSignupEmail(), true, 'production with verification required');

    process.env['SKIP_EMAIL_DOMAIN_VALIDATION'] = 'true';
    assert.equal(shouldValidateSignupEmail(), false, 'emergency bypass');

    delete process.env['SKIP_EMAIL_DOMAIN_VALIDATION'];

    // The Docker images default APP_BASE_URL to http://localhost:8080 because
    // nginx strips /api. Production must still validate on loopback.
    process.env['APP_BASE_URL'] = 'http://localhost:8080';
    assert.equal(shouldValidateSignupEmail(), true, 'production Docker loopback base URL');
    process.env['APP_BASE_URL'] = 'http://[::1]:8080';
    assert.equal(shouldValidateSignupEmail(), true, 'production IPv6 loopback base URL');

    process.env['NODE_ENV'] = 'development';
    process.env['APP_BASE_URL'] = 'http://localhost:3000';
    assert.equal(shouldValidateSignupEmail(), false, 'non-production loopback deployment');

    process.env['APP_BASE_URL'] = 'http://[::1]:3000';
    assert.equal(shouldValidateSignupEmail(), false, 'IPv6 loopback deployment');

    process.env['APP_BASE_URL'] = 'http://api.example.com';
    delete process.env['REQUIRE_EMAIL_VERIFICATION'];
    assert.equal(shouldValidateSignupEmail(), false, 'verification not required');

    process.env['NODE_ENV'] = 'test';
    process.env['REQUIRE_EMAIL_VERIFICATION'] = 'true';
    assert.equal(shouldValidateSignupEmail(), false, 'test suite');
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
