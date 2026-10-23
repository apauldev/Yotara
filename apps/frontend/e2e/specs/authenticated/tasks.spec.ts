import { test, expect, dismissTip } from '../../fixtures/auth';

const taskName = (label: string) => `${label}-${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Task CRUD', () => {
  test('creates a task from the capture bar', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('create');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');

    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('marks a task complete', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('complete');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    const card = page.locator('article.task-card').filter({ hasText: name });
    await card.getByRole('button', { name: 'Mark task complete' }).click({ force: true });

    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();

    const movementToast = page
      .locator('.toast')
      .filter({ hasText: `"${name}" completed and moved to Archive` });
    await expect(movementToast).toBeVisible({ timeout: 10_000 });
    await movementToast.getByRole('button', { name: 'View' }).click();

    await expect(page).toHaveURL(/\/archive$/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('switches between Inbox, Today, and Upcoming views', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'Today' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'Upcoming' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Upcoming', exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('uses inline priority command in capture bar', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('priority');
    // Type with !high inline command
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} !high`);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');

    // Task card should appear with the text (priority is extracted from title)
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('uses project selector in capture bar', async ({ page }) => {
    // Create a project first
    const projName = `cap-proj-${Date.now()}`;
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByPlaceholder('e.g. Morning Rituals').fill(projName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });
    const projectUrl = page.url();

    // Go to tasks
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('capproj');
    // Select project from the capture bar dropdown
    await page.getByLabel('Choose project').selectOption({ label: projName });
    // Type task name
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');

    // A filed task is not part of the Inbox view. The capture confirmation
    // names the project and the task is visible on that project page.
    await expect(
      page.locator('.toast').filter({ hasText: `"${name}" added to ${projName}` }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('article.task-card').filter({ hasText: name })).toHaveCount(0);

    await page.goto(projectUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('announces filing an Inbox task and opens its project', async ({ page }) => {
    const projName = `move-proj-${Date.now()}`;
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByPlaceholder('e.g. Morning Rituals').fill(projName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/, { timeout: 10_000 });
    const projectUrl = page.url();

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('move');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    const card = page.locator('article.task-card').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.locator('#task-project').selectOption({ label: projName });
    await dialog.getByRole('button', { name: 'Save Task' }).click();

    const movementToast = page
      .locator('.toast')
      .filter({ hasText: `"${name}" moved to ${projName}` });
    await expect(movementToast).toBeVisible({ timeout: 10_000 });
    await expect(card).toHaveCount(0);

    await movementToast.getByRole('button', { name: 'View' }).click();
    await expect(page).toHaveURL(projectUrl, { timeout: 10_000 });
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });
});
