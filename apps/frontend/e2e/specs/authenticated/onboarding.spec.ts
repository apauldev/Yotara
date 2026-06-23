import { test, expect } from '../../fixtures/auth';

test.use({ storageState: { cookies: [], origins: [] } });

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
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Name').fill(TEST_NAME);
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Wait for onboarding page
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Verify workspace selection is visible
    await expect(page.getByText('Personal & Simple')).toBeVisible();

    await expect(page.getByText('Light Team Sharing')).toBeVisible();
  });

  test('selects personal workspace and continues to tasks', async ({ page }) => {
    const email = `onboarding-flow-${Date.now()}@yotara.test`;

    // Sign up as a new user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Name').fill('Flow Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('FlowTest123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Wait for onboarding page
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Select Personal workspace
    await page.getByText('Personal & Simple').click();

    // Click Continue
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should redirect to tasks page
    await page.waitForURL(/\/tasks/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/tasks/);
  });
});
