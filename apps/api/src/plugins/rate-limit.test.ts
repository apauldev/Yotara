import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

test('rate-limit plugin ignores forwarded IPs from direct clients', async () => {
  const app = Fastify({ trustProxy: false });
  const keys: string[] = [];
  await app.register(rateLimit, {
    max: 3,
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
    for (let i = 0; i < 3; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '203.0.113.10',
        headers: { 'x-forwarded-for': '10.0.0.99' },
      });
      assert.equal(response.statusCode, 200);
    }

    const blocked = await app.inject({
      method: 'GET',
      url: '/test',
      remoteAddress: '203.0.113.10',
      headers: { 'x-forwarded-for': '10.0.0.99' },
    });
    assert.equal(blocked.statusCode, 429);
    assert.deepEqual(new Set(keys), new Set(['203.0.113.10']));
  } finally {
    await app.close();
  }
});

test('rate-limit plugin honors forwarded IPs only from a trusted proxy', async () => {
  const app = Fastify({ trustProxy: ['172.16.0.0/12'] });
  const keys: string[] = [];
  await app.register(rateLimit, {
    max: 3,
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
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      remoteAddress: '172.16.0.5',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(keys[0], '203.0.113.10');
  } finally {
    await app.close();
  }
});

test('rate-limit plugin returns 429 when the trusted client IP exceeds the limit', async () => {
  const app = Fastify({ trustProxy: ['172.16.0.0/12'] });
  await app.register(rateLimit, {
    max: 3,
    timeWindow: 60000,
    keyGenerator: (request) => request.ip,
  });

  app.get('/test', async () => ({ ok: true }));

  await app.ready();

  try {
    for (let i = 0; i < 3; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '172.16.0.5',
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });
      assert.equal(response.statusCode, 200, `trusted request ${i + 1} should succeed`);
    }

    const blocked = await app.inject({
      method: 'GET',
      url: '/test',
      remoteAddress: '172.16.0.5',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    assert.equal(blocked.statusCode, 429);
    assert.match(blocked.json().message, /Rate limit exceeded/i);

    const otherClient = await app.inject({
      method: 'GET',
      url: '/test',
      remoteAddress: '172.16.0.5',
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });
    assert.equal(otherClient.statusCode, 200);
  } finally {
    await app.close();
  }
});

test('rate-limit key uses the sanitized client address from a trusted proxy', async () => {
  const app = Fastify({ trustProxy: ['172.16.0.0/12'] });

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
    const r = await app.inject({
      method: 'GET',
      url: '/test',
      remoteAddress: '172.16.0.5',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(keys[0], '203.0.113.10');
  } finally {
    await app.close();
  }
});
