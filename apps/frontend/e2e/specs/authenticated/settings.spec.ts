import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Settings', () => {
  test('settings page renders with sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
  });

  test('applies a theme selection', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Find the theme selector (first select.settings-select)
    const themeSelect = page.locator('select.settings-select').first();
    await expect(themeSelect).toBeVisible();

    // Select a different theme
    await themeSelect.selectOption('dark-forest');
    await page.waitForTimeout(500);

    // Verify the selection stuck
    await expect(themeSelect).toHaveValue('dark-forest');
  });

  test('applies the floral and ember themes', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const themeSelect = page.locator('select.settings-select').first();
    await expect(themeSelect).toBeVisible();

    // Floral Blossoms is a light theme: theme class lands, dark does not.
    await themeSelect.selectOption('floral-blossoms');
    await expect(page.locator('html')).toHaveClass(/theme-floral-blossoms/);
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Ember Hearth is a warm dark theme: theme class and dark mode both land.
    await themeSelect.selectOption('ember-hearth');
    await expect(page.locator('html')).toHaveClass(/theme-ember-hearth/);
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Restore the default so later serial tests start from a known theme.
    await themeSelect.selectOption('light-forest');
    await expect(page.locator('html')).toHaveClass(/theme-light-forest/);
  });

  test('toggles a preference setting', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Find toggle switches
    const toggles = page.locator('input[type="checkbox"].toggle-input');

    // Toggle the first available toggle
    const firstToggle = toggles.first();
    const initialChecked = await firstToggle.isChecked();

    await firstToggle.click();
    await page.waitForTimeout(500);

    // Verify state changed
    await expect(firstToggle).toBeChecked({ checked: !initialChecked });

    // Toggle back
    await firstToggle.click();
    await page.waitForTimeout(500);
    await expect(firstToggle).toBeChecked({ checked: initialChecked });
  });

  test('opens and closes change password modal', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Click "Change Password"
    await page.getByText('Change Password').click();

    // Verify modal opened — look for password fields
    await expect(page.getByText('Current Password')).toBeVisible({ timeout: 3_000 });

    // Close via Cancel
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(page.getByText('Current Password')).not.toBeVisible();
  });

  test('shows logout confirmation modal without logging out', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Click logout danger link
    await page.locator('.settings-link-danger').first().click();

    // Verify confirmation modal
    await expect(page.getByRole('heading', { name: 'Leave the Sanctuary?' })).toBeVisible({
      timeout: 3_000,
    });

    // Stay — don't actually log out (would invalidate session for subsequent tests)
    await page.getByRole('button', { name: 'Stay and Focus' }).click();
  });
});
