import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('dev mode bypasses the global rate limiter, production does not', async () => {
  const keys = [
    'DEV_MODE',
    'RATE_LIMIT_MAX',
    'RATE_LIMIT_WINDOW_MINUTES',
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'APP_BASE_URL',
    'FRONTEND_BASE_URL',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const dbFile = join(tmpdir(), `yotara-rate-limit-test-${randomUUID()}.db`);

  process.env['RATE_LIMIT_MAX'] = '2';
  process.env['RATE_LIMIT_WINDOW_MINUTES'] = '1';
  process.env['DATABASE_URL'] = dbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';
  process.env['FRONTEND_BASE_URL'] = 'http://localhost:4200';

  const { buildApp } = await import('../server.js');

  try {
    process.env['DEV_MODE'] = 'true';
    const devApp = await buildApp();
    try {
      for (let i = 0; i < 5; i++) {
        const response = await devApp.inject({ method: 'GET', url: '/health' });
        assert.equal(response.statusCode, 200, `dev request ${i + 1} should not be limited`);
      }
    } finally {
      await devApp.close();
    }

    process.env['DEV_MODE'] = 'false';
    const prodApp = await buildApp();
    try {
      for (let i = 0; i < 2; i++) {
        const response = await prodApp.inject({ method: 'GET', url: '/health' });
        assert.equal(response.statusCode, 200, `request ${i + 1} should succeed`);
      }
      const blocked = await prodApp.inject({ method: 'GET', url: '/health' });
      assert.equal(blocked.statusCode, 429);
    } finally {
      await prodApp.close();
    }
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(dbFile, { force: true });
  }
});
