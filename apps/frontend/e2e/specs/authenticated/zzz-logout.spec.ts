import { test, expect, dismissTip, getE2ECredentials } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Logout', () => {
  test('performs logout from settings', async ({ page }) => {
    const { email, password } = getE2ECredentials();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/tasks/);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await page.locator('.settings-link-danger').first().click();

    await expect(page.getByRole('heading', { name: 'Leave the Sanctuary?' })).toBeVisible({
      timeout: 3_000,
    });

    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login/);
  });
});
