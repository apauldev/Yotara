import { test, expect, dismissTip } from '../../fixtures/auth';

const taskName = (label: string) => `${label}-arch-${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Archive', () => {
  test('shows completed tasks in archive', async ({ page }) => {
    // Create and complete a task
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('view');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // Complete the task
    const card = page.locator('article.task-card').filter({ hasText: name });
    await card.getByRole('button', { name: 'Mark task complete' }).click({ force: true });
    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to archive
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // Verify task appears in archive
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('deletes a task forever from archive', async ({ page }) => {
    // Create and complete a task
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('delete');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // Complete the task
    const card = page.locator('article.task-card').filter({ hasText: name });
    await card.getByRole('button', { name: 'Mark task complete' }).click({ force: true });
    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to archive
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // Click "Delete forever"
    const archCard = page.locator('article.task-card').filter({ hasText: name });
    await archCard.getByRole('button', { name: 'Delete task forever' }).click();

    // Confirm deletion in dialog
    await expect(page.getByText('Delete archived task?')).toBeVisible({ timeout: 3_000 });
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await page.waitForTimeout(1000);

    // Task should no longer be visible
    await expect(page.locator('article.task-card').filter({ hasText: name })).not.toBeVisible();
  });

  test('restores a task from archive back to inbox', async ({ page }) => {
    // Create and complete a task
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('restore');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // Complete the task
    const card = page.locator('article.task-card').filter({ hasText: name });
    await card.getByRole('button', { name: 'Mark task complete' }).click({ force: true });
    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to archive
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // Click "Restore"
    const archCard = page.locator('article.task-card').filter({ hasText: name });
    await archCard.getByRole('button', { name: 'Restore task' }).click();

    // Confirm in dialog
    await expect(page.getByText('Move task back to doing?')).toBeVisible({ timeout: 3_000 });
    await page.getByRole('button', { name: 'Put back into doing' }).click();
    await page.waitForTimeout(1000);

    // Task should be gone from archive
    await expect(page.locator('article.task-card').filter({ hasText: name })).not.toBeVisible();

    // Navigate to inbox and verify task is active again
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('marks a task as permanent archive', async ({ page }) => {
    // Create and complete a task
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('perm');
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // Complete the task
    const card = page.locator('article.task-card').filter({ hasText: name });
    await card.getByRole('button', { name: 'Mark task complete' }).click({ force: true });
    const confirmBtn = page.getByRole('button', { name: 'Mark complete' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to archive
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // Click "Make permanent"
    const archCard = page.locator('article.task-card').filter({ hasText: name });
    await archCard.getByRole('button', { name: 'Mark permanent archive' }).click();
    await page.waitForTimeout(1000);

    // Should now show "Permanent archive" state
    await expect(
      archCard.getByRole('button', { name: 'Remove permanent archive tag' }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
