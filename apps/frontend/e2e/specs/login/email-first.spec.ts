import { test, expect, getRuntimeConfig } from '../../fixtures/auth';
import fs from 'node:fs';

// This spec exercises the email-first signup flow (verification required).
// It only runs when REQUIRE_EMAIL_VERIFICATION=true (dev/test override or
// production), because the signup form differs in that mode. In the default
// dev/test CI run the flag is off, so the legacy flow is what runs.
let emailFirst = false;

test.use({ storageState: { cookies: [], origins: [] } });

// Read the exact frontend verification URL emitted in the email log.
function getVerificationUrl(): string {
  const logFile = process.env['E2E_API_LOG'] ?? process.env['API_LOG_FILE'];
  if (!logFile) {
    throw new Error('E2E_API_LOG must point at the API log file');
  }
  const log = fs.readFileSync(logFile, 'utf8');
  const lines = log.split('\n').reverse();
  const linkLine = lines.find((l) => l.includes('/verify-email?token='));
  if (!linkLine) {
    throw new Error(`No verification link found in ${logFile}`);
  }
  const match = linkLine.match(/https?:\/\/[^\s]+\/verify-email\?token=[^&\s]+/);
  if (!match) {
    throw new Error(`Could not extract verification URL from: ${linkLine}`);
  }
  return match[0];
}

test.describe('Email-first signup', () => {
  test.beforeAll(async () => {
    emailFirst = (await getRuntimeConfig()).requireEmailVerification;
  });

  test('signs up with email only, verifies, sets password, and reaches onboarding', async ({
    page,
  }) => {
    test.skip(!emailFirst, 'Email verification is not required by the running API');
    const email = `e2e-email-first-${Date.now()}@yotara.test`;

    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account' }).click();

    // Email-first form: no password field.
    await expect(page.getByRole('heading', { name: 'Create your Yotara account' })).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveCount(0);

    await page.getByLabel('Name').fill('Email First User');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Check-your-inbox screen.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // Open the exact verification link emitted in the email.
    const verificationUrl = getVerificationUrl();
    await page.goto(verificationUrl);

    // Set-password step.
    await expect(page.getByText('Your email is verified')).toBeVisible();
    await page.getByLabel('Password').fill('NewPassword123!');
    await page.getByRole('button', { name: 'Set password and continue' }).click();

    // Lands in onboarding (session created via autoSignInAfterVerification).
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
  });
});
