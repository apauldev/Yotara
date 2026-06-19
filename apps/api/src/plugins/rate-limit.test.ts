import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

test('rate-limit plugin returns 429 when limit is exceeded and respects X-Forwarded-For', async () => {
  const app = Fastify({ trustProxy: 1 });
  await app.register(rateLimit, {
    max: 3,
    timeWindow: 60000,
    keyGenerator: (request) => request.ip,
  });

  app.get('/test', async () => ({ ok: true }));

  await app.ready();

  try {
    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const response = await app.inject({ method: 'GET', url: '/test' });
      assert.equal(response.statusCode, 200, `default ip request ${i + 1} should succeed`);
    }

    // 4th request from default IP should be rate-limited
    const blocked = await app.inject({ method: 'GET', url: '/test' });
    assert.equal(blocked.statusCode, 429, '4th request from default IP should be rate-limited');
    const body = blocked.json();
    assert.match(body.message, /Rate limit exceeded/i);

    // A different IP via X-Forwarded-For should still succeed
    const r1 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-forwarded-for': '10.0.0.99' },
    });
    assert.equal(r1.statusCode, 200, 'different IP should succeed on first request');

    // Second request from different IP should also succeed
    const r2 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-forwarded-for': '10.0.0.99' },
    });
    assert.equal(r2.statusCode, 200, 'different IP should succeed on second request');

    // Third request from different IP should also succeed
    const r3 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-forwarded-for': '10.0.0.99' },
    });
    assert.equal(r3.statusCode, 200, 'different IP should succeed on third request');

    // Fourth request from different IP should be rate-limited
    const blockedDiff = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-forwarded-for': '10.0.0.99' },
    });
    assert.equal(blockedDiff.statusCode, 429, 'different IP should be rate-limited on 4th request');
  } finally {
    await app.close();
  }
});

test('rate-limit key uses last entry in X-Forwarded-For when trustProxy is enabled', async () => {
  // Simulate nginx's $proxy_add_x_forwarded_for: the real client IP is the
  // last entry in the chain; a spoofed first entry must be ignored.
  const app = Fastify({ trustProxy: 1 });

  const keys: string[] = [];
  await app.register(rateLimit, {
    max: 5,
    timeWindow: 60000,
    keyGenerator: (request) => {
      const key = request.ip;
      keys.push(key);
      return key;
    },
  });

  app.get('/test', async () => ({ ok: true }));
  await app.ready();

  try {
    // Send X-Forwarded-For with a spoofed first entry and the real IP last,
    // matching nginx's $proxy_add_x_forwarded_for behaviour.
    const r = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-forwarded-for': 'spoofed-ip, 10.0.0.1' },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(keys[0], '10.0.0.1', 'key must be the last X-Forwarded-For entry, not the first');
  } finally {
    await app.close();
  }
});
