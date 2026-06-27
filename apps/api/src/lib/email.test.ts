import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import test from 'node:test';

const TEST_EMAIL = `email-test-${randomUUID()}@test.com`;

test('email module', async (t) => {
  const dbFile = join(tmpdir(), `yotara-email-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;

  try {
    await import('../db/client.js');

    await t.test('sendPasswordResetEmail logs to console (no API key)', async () => {
      const logs: string[] = [];
      mock.method(console, 'log', (msg: string) => {
        if (typeof msg === 'string' && msg.startsWith('[email]')) logs.push(msg);
      });

      try {
        const { sendPasswordResetEmail } = await import('./email.js');
        await sendPasswordResetEmail(
          { email: TEST_EMAIL, name: 'Test User' },
          'https://example.com/reset?token=abc',
        );
        assert.ok(
          logs.some((l) => l.includes(TEST_EMAIL)),
          'logs recipient',
        );
        assert.ok(
          logs.some((l) => l.includes('Reset your Yotara password')),
          'logs subject',
        );
        assert.ok(
          logs.some((l) => l.includes('reset?token=abc')),
          'logs reset URL',
        );
      } finally {
        mock.restoreAll();
      }
    });

    await t.test('sendVerificationEmail logs to console (no API key)', async () => {
      const logs: string[] = [];
      mock.method(console, 'log', (msg: string) => {
        if (typeof msg === 'string' && msg.startsWith('[email]')) logs.push(msg);
      });

      try {
        const { sendVerificationEmail } = await import('./email.js');
        await sendVerificationEmail(
          { email: TEST_EMAIL, name: 'Test User' },
          'https://example.com/verify?token=xyz',
        );
        assert.ok(
          logs.some((l) => l.includes(TEST_EMAIL)),
          'logs recipient',
        );
        assert.ok(
          logs.some((l) => l.includes('Verify your Yotara account')),
          'logs subject',
        );
        assert.ok(
          logs.some((l) => l.includes('verify?token=xyz')),
          'logs verify URL',
        );
      } finally {
        mock.restoreAll();
      }
    });

    await t.test('sendPasswordResetEmail includes html and plain text', async () => {
      const logs: string[] = [];
      mock.method(console, 'log', (msg: string) => {
        if (typeof msg === 'string' && msg.startsWith('[email]')) logs.push(msg);
      });

      try {
        const { sendPasswordResetEmail } = await import('./email.js');
        await sendPasswordResetEmail(
          { email: 'noname@test.com', name: '' },
          'https://example.com/reset?token=named',
        );
        // Should default to 'there' when name is empty
        const bodyLog = logs.find((l) => l.startsWith('[email] Body:'));
        assert.ok(bodyLog?.includes('Hi there'), 'should default to "there" when name is empty');
        assert.ok(bodyLog?.includes('reset?token=named'), 'should include token in URL');
      } finally {
        mock.restoreAll();
      }
    });

    await t.test('checkRateLimitOrThrow throws 429 when limit exceeded', async () => {
      const { checkRateLimitOrThrow } = await import('./email.js');
      const { recordEmailSend } = await import('./email-rate-limit.js');

      const limitedEmail = `rate-limited-${randomUUID()}@test.com`;
      recordEmailSend(limitedEmail, 'signup');

      assert.throws(
        () => checkRateLimitOrThrow(limitedEmail, 'signup'),
        (err: Error & { statusCode?: number; retryAfterSeconds?: number }) => {
          assert.equal(err.statusCode, 429);
          assert.ok(err.retryAfterSeconds! > 0);
          assert.ok(err.message.includes('Too many signup requests'));
          return true;
        },
      );
    });

    await t.test('checkRateLimitOrThrow allows when under limit', async () => {
      const { checkRateLimitOrThrow } = await import('./email.js');
      const freshEmail = `fresh-${randomUUID()}@test.com`;
      assert.doesNotThrow(() => checkRateLimitOrThrow(freshEmail, 'reset'));
    });

    await t.test('checkRateLimitOrThrow includes retry minutes in message', async () => {
      const { checkRateLimitOrThrow } = await import('./email.js');
      const { recordEmailSend } = await import('./email-rate-limit.js');

      const limitedEmail = `rate-limit-msg-${randomUUID()}@test.com`;
      recordEmailSend(limitedEmail, 'reset');

      assert.throws(
        () => checkRateLimitOrThrow(limitedEmail, 'reset'),
        (err: Error & { statusCode?: number; retryAfterSeconds?: number }) => {
          assert.ok(err.message.includes('minutes'), 'message should mention minutes');
          return true;
        },
      );
    });
  } finally {
    delete process.env['DATABASE_URL'];
    mock.restoreAll();
    rmSync(dbFile, { force: true });
  }
});
