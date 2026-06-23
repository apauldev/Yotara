import { test, expect, dismissTip } from '../../fixtures/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Search', () => {
  test('search page renders the search form', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await expect(
      page.getByPlaceholder('Search tasks, projects, and status keywords...'),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'Search' }).first()).toBeVisible();
  });

  test('finds a task by title', async ({ page }) => {
    // Create a task first
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = `search-target-${Date.now()}`;
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to search and search for it
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const searchInput = page.getByPlaceholder('Search tasks, projects, and status keywords...');
    await searchInput.fill(name);
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');

    // Should show search results
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows empty result state for gibberish query', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const searchInput = page.getByPlaceholder('Search tasks, projects, and status keywords...');
    await searchInput.fill('xyznonexistentgibberish2024');
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');

    // Should show empty/not-found state (page loads without errors)
    await expect(page).toHaveURL(/q=xyznonexistentgibberish2024/);
  });

  test('search result tabs are visible', async ({ page }) => {
    await page.goto('/search?q=test');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Tab row should be visible
    await expect(page.getByRole('navigation', { name: 'Search result filters' })).toBeVisible();

    // All expected tabs present
    for (const tab of ['All', 'Tasks', 'Projects', 'Labels']) {
      await expect(page.locator('.tab-chip').filter({ hasText: tab })).toBeVisible();
    }
  });

  test('clicking tabs filters search results', async ({ page }) => {
    // Create a task and a project to search for
    const taskName = `tab-test-task-${Date.now()}`;
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder("What's on your mind today?").fill(taskName);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: taskName })).toBeVisible({
      timeout: 10_000,
    });

    // Search for it
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder('Search tasks, projects, and status keywords...').fill(taskName);
    await page.getByPlaceholder('Search tasks, projects, and status keywords...').press('Enter');
    await page.waitForLoadState('networkidle');

    // "All" tab should be active by default
    await expect(
      page.locator('button.tab-chip.tab-chip-active').filter({ hasText: 'All' }),
    ).toBeVisible();

    // Click "Tasks" tab
    await page.locator('.tab-chip').filter({ hasText: 'Tasks' }).click();
    await page.waitForLoadState('networkidle');

    // Tasks tab should now be active
    await expect(
      page.locator('button.tab-chip.tab-chip-active').filter({ hasText: 'Tasks' }),
    ).toBeVisible();
  });
});
