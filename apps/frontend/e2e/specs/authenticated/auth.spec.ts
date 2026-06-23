import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Authenticated session', () => {
  test('redirects to tasks when already logged in', async ({ page }) => {
    await page.goto('/login');
    await page.waitForURL(/\/tasks/, { timeout: 15_000 });
  });

  test('can access protected routes', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/login');
  });

  test('shows logout confirmation modal', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await page.locator('.settings-link-danger').click();
    await expect(page.getByRole('heading', { name: 'Leave the Sanctuary?' })).toBeVisible({
      timeout: 3000,
    });
    await page.getByRole('button', { name: 'Stay and Focus' }).click();
  });
});
