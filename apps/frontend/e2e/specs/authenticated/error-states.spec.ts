import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Error & Empty States', () => {
  test('shows 404 page for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: 'Lost in the woods' })).toBeVisible({
      timeout: 10_000,
    });

    // "Return to Inbox" button should navigate back
    await page.getByRole('link', { name: 'Return to Inbox' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/tasks/);
  });

  test('shows 404 for wildcard route in personal mode', async ({ page }) => {
    await page.goto('/tasks/some-nonexistent-subroute');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Should show 404
    await expect(page.getByRole('heading', { name: 'Lost in the woods' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
