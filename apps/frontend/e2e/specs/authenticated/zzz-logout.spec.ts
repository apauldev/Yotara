import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Logout (runs last)', () => {
  test('performs logout from settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Click logout danger link
    await page.locator('.settings-link-danger').click();

    // Verify confirmation modal
    await expect(page.getByRole('heading', { name: 'Leave the Sanctuary?' })).toBeVisible({
      timeout: 3_000,
    });

    // Confirm logout
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
