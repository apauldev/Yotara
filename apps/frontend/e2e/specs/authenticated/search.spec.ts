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

  test('finds a project by name in search results', async ({ page }) => {
    // Create a project first
    const projectName = `search-project-${Date.now()}`;
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByPlaceholder('e.g. Morning Rituals').fill(projectName);
    await page
      .getByPlaceholder('Describe the sanctuary of this project...')
      .fill('A test project for search');
    await page.getByRole('button', { name: 'Teal' }).click();
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });

    // Navigate to search and find it
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder('Search tasks, projects, and status keywords...').fill(projectName);
    await page.getByPlaceholder('Search tasks, projects, and status keywords...').press('Enter');
    await page.waitForLoadState('networkidle');

    // Project should appear in the "All" tab results
    await expect(page.locator('.project-card').filter({ hasText: projectName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('finds a label by name in search results', async ({ page }) => {
    // Create a label first
    const labelName = `search-label-${Date.now()}`;
    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByRole('button', { name: '+ New Label' }).click();
    const nameInput = page.locator('.label-editor input').first();
    await nameInput.fill(labelName);
    await page.getByRole('button', { name: 'Create Label', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Navigate to search
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder('Search tasks, projects, and status keywords...').fill(labelName);
    await page.getByPlaceholder('Search tasks, projects, and status keywords...').press('Enter');
    await page.waitForLoadState('networkidle');

    // Switch to Labels tab
    await page.locator('.tab-chip').filter({ hasText: 'Labels' }).click();
    await page.waitForLoadState('networkidle');

    // Label should appear in results
    await expect(page.locator('.project-card').filter({ hasText: labelName })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('searches archived/completed tasks', async ({ page }) => {
    // Create a task and mark it complete
    const taskName = `archive-search-${Date.now()}`;
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder("What's on your mind today?").fill(taskName);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: taskName })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // Mark the task complete
    const card = page.locator('article.task-card').filter({ hasText: taskName });
    await card.getByRole('button', { name: 'Mark task complete' }).click({ force: true });
    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // Navigate to search
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder('Search tasks, projects, and status keywords...').fill(taskName);
    await page.getByPlaceholder('Search tasks, projects, and status keywords...').press('Enter');
    await page.waitForLoadState('networkidle');

    // The task should not appear in active results (it's completed)
    await expect(page.locator('article.task-card').filter({ hasText: taskName })).not.toBeVisible();

    // Click "Search Archive"
    await page.getByRole('button', { name: 'Search Archive' }).click();
    await page.waitForLoadState('networkidle');

    // The completed task should appear in archive results
    await expect(
      page.locator('.archive-results article.task-card').filter({ hasText: taskName }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Tasks tab shows all results with pagination controls', async ({ page }) => {
    // Create enough tasks to span multiple pages (11 tasks, page size 10 = 2 pages)
    const prefix = `pagination-${Date.now()}-`;
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const taskCount = 11;
    for (let i = 0; i < taskCount; i++) {
      const name = `${prefix}${i}`;
      await page.getByPlaceholder("What's on your mind today?").fill(name);
      await page.getByPlaceholder("What's on your mind today?").press('Enter');
      await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
        timeout: 10_000,
      });
      await page.waitForTimeout(300);
    }

    // Navigate to search
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder('Search tasks, projects, and status keywords...').fill(prefix);
    await page.getByPlaceholder('Search tasks, projects, and status keywords...').press('Enter');
    await page.waitForLoadState('networkidle');

    // "All" tab shows only up to 5 tasks (the cap)
    const taskCards = page.locator('article.task-card');
    const allTabCards = await taskCards.count();
    expect(allTabCards).toBeLessThanOrEqual(5);

    // Switch to Tasks tab
    await page.locator('.tab-chip').filter({ hasText: 'Tasks' }).click();
    await page.waitForURL(/tab=tasks/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Page 1 with 10 tasks (pageSize 10, 11 tasks = 2 pages)
    await expect(page.locator('article.task-card').first()).toBeVisible({ timeout: 10_000 });
    const page1Cards = await page.locator('article.task-card').count();
    expect(page1Cards).toBe(10);

    // Pagination controls should be visible (2 pages)
    await expect(page.locator('.pagination-container')).toBeVisible({ timeout: 5_000 });

    // Navigate to page 2 and verify the 11th task appears
    await page.locator('.pagination-button').filter({ hasText: '→' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.task-card').filter({ hasText: `${prefix}10` })).toBeVisible({
      timeout: 5_000,
    });
    const page2Cards = await page.locator('article.task-card').count();
    expect(page2Cards).toBe(1);
  });
});
