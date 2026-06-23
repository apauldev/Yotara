import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Sidebar & Navigation', () => {
  test('sidebar navigation works for all links', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const links = [
      { name: 'Inbox', url: /\/tasks/ },
      { name: 'Today', url: /\/tasks/ },
      { name: 'Upcoming', url: /\/tasks/ },
      { name: 'Projects', url: /\/projects/ },
      { name: 'Labels', url: /\/labels/ },
      { name: 'Archive', url: /\/archive/ },
    ];

    for (const link of links) {
      await page.getByRole('link', { name: link.name }).click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(link.url);
    }
  });

  test('profile menu opens and shows actions', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Open profile menu
    await page.getByRole('button', { name: 'Open account menu' }).click();

    // Verify menu items visible
    await expect(page.getByRole('menuitem', { name: 'Stay and Focus' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();

    // Close by clicking backdrop
    await page.getByRole('button', { name: 'Close profile menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).not.toBeVisible();
  });

  test('sidebar search navigates to search page', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Find the sidebar search input
    const searchInput = page.getByPlaceholder('Search tasks and projects...');
    await expect(searchInput).toBeVisible();

    // Type a query and submit
    await searchInput.fill('test query');
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');

    // Should navigate to /search with query
    await expect(page).toHaveURL(/\/search\?q=/);
  });

  test('preferences menu opens and shows settings link', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Open preferences menu
    await page.getByRole('button', { name: 'Preferences' }).click();

    // Verify menu visible with Settings link
    await expect(page.getByRole('menuitem', { name: /Settings/ })).toBeVisible();

    // Close via backdrop
    await page.getByRole('button', { name: 'Close preferences menu' }).click();
    await expect(page.getByRole('menuitem', { name: /Settings/ })).not.toBeVisible();
  });

  test('simple mode toggle is visible in topbar', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Simple mode button should be visible in the topbar
    await expect(page.getByRole('button', { name: 'Simple' })).toBeVisible();
  });
});
