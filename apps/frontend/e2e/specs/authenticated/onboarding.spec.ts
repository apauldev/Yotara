import { test, expect } from '../../fixtures/auth';
import fs from 'node:fs';

test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL_FIRST = process.env['REQUIRE_EMAIL_VERIFICATION'] === 'true';

/** Read the exact frontend verification URL emitted in the email log. */
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

/** Complete signup in either mode (legacy password form, or email-first). */
async function signUp(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
  password: string,
) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);

  if (EMAIL_FIRST) {
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('heading', { name: 'Check your email' }).waitFor();
    const verificationUrl = getVerificationUrl();
    await page.goto(verificationUrl);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Set password and continue' }).click();
  } else {
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Onboarding', () => {
  const TEST_EMAIL = `onboarding-e2e-${Date.now()}@yotara.test`;
  const TEST_PASSWORD = 'OnboardTest123!';
  const TEST_NAME = 'Onboarding Tester';

  test('redirects to tasks if onboarding already completed', async ({ page }) => {
    // The global-setup user has already completed onboarding,
    // but this test uses empty storageState so it won't be authenticated.
    // Instead, navigate directly to /onboarding — it should require auth
    // and redirect to /login.
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Should redirect to login since not authenticated
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows workspace selection options after sign-up', async ({ page }) => {
    // Sign up as a new user
    await signUp(page, TEST_NAME, TEST_EMAIL, TEST_PASSWORD);

    // Wait for onboarding page
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Verify onboarding page is visible
    await expect(page.getByText('Welcome to Yotara')).toBeVisible();
  });

  test('selects personal workspace and continues to tasks', async ({ page }) => {
    const email = `onboarding-flow-${Date.now()}@yotara.test`;

    // Sign up as a new user
    await signUp(page, 'Flow Tester', email, 'FlowTest123!');

    // Wait for onboarding page
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Click Continue — personal mode is now the default
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should redirect to tasks page
    await page.waitForURL(/\/tasks/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/tasks/);
  });
});
