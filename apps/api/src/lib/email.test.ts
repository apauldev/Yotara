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

    await t.test('verify resend type enforces a 30-minute cooldown', async () => {
      const { checkRateLimitOrThrow } = await import('./email.js');
      const { recordEmailSend } = await import('./email-rate-limit.js');

      const verifyEmail = `verify-${randomUUID()}@test.com`;
      recordEmailSend(verifyEmail, 'verify');

      assert.throws(
        () => checkRateLimitOrThrow(verifyEmail, 'verify'),
        (err: Error & { statusCode?: number; retryAfterSeconds?: number }) => {
          assert.equal(err.statusCode, 429);
          assert.equal(err.message.includes('Too many verify requests'), true);
          // 30-minute window: retry after should be > 25 minutes (1500s).
          assert.ok(err.retryAfterSeconds! > 1500, 'verify cooldown should be ~30 min');
          return true;
        },
      );
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
    await t.test('escapeHtml and escapeAttribute neutralize injection', async () => {
      const { escapeHtml, escapeAttribute } = await import('./email.js');
      const name = '<script>alert("x")</script>';
      assert.equal(escapeHtml(name), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
      const url = 'https://example.com/verify?token=abc&x=" onmouseover="alert(1)';
      assert.equal(
        escapeAttribute(url),
        'https://example.com/verify?token=abc&amp;x=&quot; onmouseover=&quot;alert(1)',
      );
    });

    await t.test('production with no RESEND_API_KEY fails loudly', async () => {
      const previousNodeEnv = process.env['NODE_ENV'];
      const previousApiKey = process.env['RESEND_API_KEY'];

      process.env['NODE_ENV'] = 'production';
      delete process.env['RESEND_API_KEY'];

      try {
        // Module-level assertEmailConfigured runs on import; use dynamic import
        // after clearing any cached instance via a fresh query string.
        await assert.rejects(
          () => import(`./email.js?fail=${Date.now()}`),
          /RESEND_API_KEY must be set in production/,
        );
      } finally {
        if (previousNodeEnv === undefined) {
          delete process.env['NODE_ENV'];
        } else {
          process.env['NODE_ENV'] = previousNodeEnv;
        }
        if (previousApiKey === undefined) {
          delete process.env['RESEND_API_KEY'];
        } else {
          process.env['RESEND_API_KEY'] = previousApiKey;
        }
      }
    });
    await t.test('production with dev mode enabled does not fail loud', async () => {
      const previousNodeEnv = process.env['NODE_ENV'];
      const previousApiKey = process.env['RESEND_API_KEY'];
      const previousDevMode = process.env['DEV_MODE'];
      const previousAllow = process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];

      process.env['NODE_ENV'] = 'production';
      process.env['DEV_MODE'] = 'true';
      delete process.env['RESEND_API_KEY'];

      try {
        // Without the explicit production opt-in, dev mode refuses to start.
        delete process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];
        await assert.rejects(
          () => import(`./email.js?prod-refuse=${Date.now()}`),
          /ALLOW_DEV_MODE_IN_PRODUCTION/,
        );

        // With the opt-in (a test instance), the console fallback is allowed
        // at module load — no startup failure.
        process.env['ALLOW_DEV_MODE_IN_PRODUCTION'] = 'true';
        const mod = await import(`./email.js?devmode=${Date.now()}`);
        assert.equal(typeof mod.sendPasswordResetEmail, 'function');
      } finally {
        if (previousNodeEnv === undefined) {
          delete process.env['NODE_ENV'];
        } else {
          process.env['NODE_ENV'] = previousNodeEnv;
        }
        if (previousApiKey === undefined) {
          delete process.env['RESEND_API_KEY'];
        } else {
          process.env['RESEND_API_KEY'] = previousApiKey;
        }
        if (previousDevMode === undefined) {
          delete process.env['DEV_MODE'];
        } else {
          process.env['DEV_MODE'] = previousDevMode;
        }
        if (previousAllow === undefined) {
          delete process.env['ALLOW_DEV_MODE_IN_PRODUCTION'];
        } else {
          process.env['ALLOW_DEV_MODE_IN_PRODUCTION'] = previousAllow;
        }
      }
    });
    await t.test('dev mode logs emails to console even with RESEND_API_KEY set', async () => {
      const previousDevMode = process.env['DEV_MODE'];
      const previousApiKey = process.env['RESEND_API_KEY'];
      const logs: string[] = [];
      mock.method(console, 'log', (msg: string) => {
        if (typeof msg === 'string' && msg.startsWith('[email]')) logs.push(msg);
      });

      try {
        process.env['DEV_MODE'] = 'true';
        process.env['RESEND_API_KEY'] = 're_test_key';

        const { getResend, sendPasswordResetEmail } = await import('./email.js');
        // Dev mode forces console emailing — Resend is never used, so a
        // configured key cannot spam real inboxes during local testing.
        assert.equal(getResend(), null);

        await sendPasswordResetEmail(
          { email: `devmode-${randomUUID()}@test.com`, name: 'Dev User' },
          'https://example.com/reset?token=devmode',
        );
        assert.ok(
          logs.some((l) => l.includes('reset?token=devmode')),
          'email body is logged to console in dev mode',
        );

        // With dev mode off, the configured key is honored again.
        delete process.env['DEV_MODE'];
        assert.notEqual(getResend(), null, 'RESEND_API_KEY is honored outside dev mode');
      } finally {
        if (previousDevMode === undefined) {
          delete process.env['DEV_MODE'];
        } else {
          process.env['DEV_MODE'] = previousDevMode;
        }
        if (previousApiKey === undefined) {
          delete process.env['RESEND_API_KEY'];
        } else {
          process.env['RESEND_API_KEY'] = previousApiKey;
        }
        mock.restoreAll();
      }
    });
  } finally {
    delete process.env['DATABASE_URL'];
    mock.restoreAll();
    rmSync(dbFile, { force: true });
  }
});
