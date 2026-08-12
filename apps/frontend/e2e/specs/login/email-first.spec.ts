import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// This spec exercises the email-first signup flow (verification required).
// It only runs when REQUIRE_EMAIL_VERIFICATION=true (dev/test override or
// production), because the signup form differs in that mode. In the default
// dev/test CI run the flag is off, so the legacy flow is what runs.
const emailFirst = process.env['REQUIRE_EMAIL_VERIFICATION'] === 'true';

test.use({ storageState: { cookies: [], origins: [] } });

// Better Auth emails a JWT link (console fallback in dev) and does not persist
// the token in the DB, so read the most recent verification URL from the API log.
function getVerificationToken(): string {
  const logFile = process.env['E2E_API_LOG'] ?? process.env['API_LOG_FILE'];
  if (!logFile) {
    throw new Error('E2E_API_LOG must point at the API log file');
  }
  const log = fs.readFileSync(logFile, 'utf8');
  const lines = log.split('\n').reverse();
  const linkLine = lines.find((l) => l.includes('verify-email?token='));
  if (!linkLine) {
    throw new Error(`No verification link found in ${logFile}`);
  }
  const match = linkLine.match(/verify-email\?token=([^&\s]+)/);
  if (!match) {
    throw new Error(`Could not extract token from: ${linkLine}`);
  }
  return decodeURIComponent(match[1]);
}

test.describe('Email-first signup', () => {
  test.skip(!emailFirst, 'REQUIRE_EMAIL_VERIFICATION=true is not set');

  test('signs up with email only, verifies, sets password, and reaches onboarding', async ({
    page,
  }) => {
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

    // Grab the verification token and open the emailed link.
    const token = getVerificationToken();
    await page.goto(`/verify-email?token=${token}`);

    // Set-password step.
    await expect(page.getByText('Your email is verified')).toBeVisible();
    await page.getByLabel('Password').fill('NewPassword123!');
    await page.getByRole('button', { name: 'Set password and continue' }).click();

    // Lands in onboarding (session created via autoSignInAfterVerification).
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
  });
});
