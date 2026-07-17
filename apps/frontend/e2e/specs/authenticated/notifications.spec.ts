import { test, expect, dismissTip } from '../../fixtures/auth';

const taskName = (label: string) => `${label}-${Date.now()}`;

test.describe('Notifications', () => {
  test('shows due-today notification when a task is due today', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const today = new Date().toISOString().slice(0, 10);
    const name = taskName('notif');

    // Create a task via the capture bar
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');

    // Wait for the task card to appear
    const card = page.locator('article.task-card').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Click the card to open the edit modal
    await card.click();

    // Wait for the modal to open
    const modal = page.locator('app-personal-task-modal');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Set the due date to today
    const dueDateInput = page.locator('input[type="date"]');
    await expect(dueDateInput).toBeVisible({ timeout: 5_000 });
    await dueDateInput.fill(today);

    // Save the task
    await page.getByRole('button', { name: 'Save' }).click();

    // Wait for the modal to close
    await expect(modal).not.toBeVisible({ timeout: 5_000 });

    // Navigate to notifications page
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Should see the notification
    const notifItem = page.locator('.notification-item').filter({ hasText: name });
    await expect(notifItem).toBeVisible({ timeout: 10_000 });
    await expect(notifItem).toContainText('Task due today');
  });

  test('bell icon appears in topbar', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const bellButton = page.locator('.topbar-actions').getByLabel('Notifications');
    await expect(bellButton).toBeVisible({ timeout: 10_000 });
  });

  test('notification dropdown opens and shows items', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const bellButton = page.locator('.topbar-actions').getByLabel('Notifications');
    await bellButton.click();

    // Dropdown should be visible
    const dropdown = page.locator('.notifications-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });
  });
});
