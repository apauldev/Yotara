import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

test('rate-limit plugin returns 429 when limit is exceeded and respects X-Forwarded-For', async () => {
  const app = Fastify();
  await app.register(rateLimit, {
    max: 3,
    timeWindow: 60000,
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || request.ip;
      }
      return request.ip;
    },
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
