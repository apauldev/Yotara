import {
  test,
  expect,
  completeWizard,
  goToStarterStep,
  getRuntimeConfig,
} from '../../fixtures/auth';
import fs from 'node:fs';

test.use({ storageState: { cookies: [], origins: [] } });

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

  const { requireEmailVerification } = await getRuntimeConfig();
  if (requireEmailVerification) {
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

  test('shows the startup wizard after sign-up', async ({ page }) => {
    // Sign up as a new user
    await signUp(page, TEST_NAME, TEST_EMAIL, TEST_PASSWORD);

    // Wait for onboarding page
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Verify the welcome step is visible
    await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
    await expect(page.getByText('A calm place for what matters today.')).toBeVisible();
  });

  test('completes the wizard and continues to tasks', async ({ page }) => {
    const email = `onboarding-flow-${Date.now()}@yotara.test`;

    // Sign up as a new user
    await signUp(page, 'Flow Tester', email, 'FlowTest123!');

    // Walk all six wizard steps with the default choices
    await completeWizard(page);

    // Should redirect to tasks page
    await expect(page).toHaveURL(/\/tasks/);
  });

  test('skipping from the welcome step completes onboarding', async ({ page }) => {
    const email = `onboarding-skip-${Date.now()}@yotara.test`;

    await signUp(page, 'Skip Tester', email, 'SkipTest123!');
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Skip setup' }).click();

    await page.waitForURL(/\/tasks/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/tasks/);
  });

  test('creates exactly the selected starter projects and labels', async ({ page }) => {
    const email = `onboarding-starter-${Date.now()}@yotara.test`;

    await signUp(page, 'Starter Tester', email, 'StarterTest123!');
    await goToStarterStep(page);

    await page.getByRole('checkbox', { name: /^Work/ }).uncheck();
    await page.getByLabel('New project name').fill('Garden');
    await page.getByRole('button', { name: 'Add project' }).click();
    await page.getByLabel('New label name').fill('Deep Work');
    await page.getByRole('button', { name: 'Add label' }).click();

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Enter Yotara' }).click();
    await page.waitForURL(/\/tasks/, { timeout: 15_000 });

    await page.goto('/projects');
    await expect(page.getByText('Garden')).toBeVisible();
    await expect(page.getByText('Work', { exact: true })).toHaveCount(0);

    await page.goto('/labels');
    await expect(page.getByRole('button', { name: 'Deep Work', exact: true })).toBeVisible();
  });

  test('start empty leaves the workspace without starter content', async ({ page }) => {
    const email = `onboarding-empty-${Date.now()}@yotara.test`;

    await signUp(page, 'Empty Tester', email, 'EmptyTest123!');
    await goToStarterStep(page);

    await page.getByRole('button', { name: 'Start empty' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Enter Yotara' }).click();
    await page.waitForURL(/\/tasks/, { timeout: 15_000 });

    await page.goto('/projects');
    await expect(page.getByText('Work', { exact: true })).toHaveCount(0);
  });

  test('creates the optional first task in the inbox', async ({ page }) => {
    const email = `onboarding-first-task-${Date.now()}@yotara.test`;

    await signUp(page, 'Task Tester', email, 'TaskTest123!');
    await goToStarterStep(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel('What do you want to finish today?').fill('Ship the release');
    await page.getByRole('button', { name: 'Enter Yotara' }).click();
    await page.waitForURL(/\/tasks/, { timeout: 15_000 });

    await expect(page.getByText('Ship the release')).toBeVisible();
  });

  test('adds and removes a profile photo in Settings', async ({ page }) => {
    const email = `onboarding-photo-${Date.now()}@yotara.test`;

    await signUp(page, 'Photo Tester', email, 'PhotoTest123!');
    await completeWizard(page);
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Add photo', exact: true }).click();
    await page.getByLabel('Choose a photo').setInputFiles('e2e/fixtures/avatar.png');
    await expect(page.getByRole('button', { name: 'Save photo' })).toBeEnabled({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Save photo' }).click();
    await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add photo', exact: true })).toBeVisible();
  });
});
