import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import corsPlugin from './cors.js';

test('cors plugin allows configured auth origins with credentials', async () => {
  process.env['TRUSTED_ORIGINS'] = 'https://app.example.com';
  process.env['CORS_ORIGIN'] = 'https://docs.example.com';

  const app = Fastify();

  await app.register(corsPlugin);

  try {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/auth/session',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'https://app.example.com');
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
  } finally {
    await app.close();
  }
});
