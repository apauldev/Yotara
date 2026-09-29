import { test, expect, dismissTip } from '../../fixtures/auth';

const taskName = (label: string) => `${label}-${Date.now()}`;

test.describe('Notifications', () => {
  test('shows due-today notification when a task is due today', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

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

    // Turn off Simple mode so the date picker becomes enabled
    const simpleModeCheckbox = modal.getByRole('checkbox', {
      name: 'Keep it lightweight with no date metadata',
    });
    await expect(simpleModeCheckbox).toBeVisible({ timeout: 3_000 });
    if (await simpleModeCheckbox.isChecked()) {
      await simpleModeCheckbox.click();
    }

    // Open the due-date calendar popover and pick today
    const datePickerTrigger = modal.locator('.date-picker-trigger');
    await expect(datePickerTrigger).toBeVisible({ timeout: 3_000 });
    await datePickerTrigger.click();

    const todayDay = new Date().getDate();
    const todayButton = page
      .locator('.date-picker-grid button:not([data-outside])')
      .getByText(String(todayDay), { exact: true });
    await expect(todayButton).toBeVisible({ timeout: 3_000 });
    await todayButton.click();

    // Save the task
    await page.getByRole('button', { name: 'Save Task' }).click();

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

  test('pops a due-time notification once its instant has passed', async ({ page }) => {
    // Capture browser notifications and enable the desktop preference before
    // any app code runs.
    await page.addInitScript(() => {
      localStorage.setItem('yotara_desktopNotifications', 'true');
      const target = window as unknown as {
        __browserNotifications: Array<{ title: string; body: string }>;
        Notification: unknown;
      };
      target.__browserNotifications = [];
      target.Notification = class {
        static permission = 'granted';
        static requestPermission = () => Promise.resolve('granted');
        constructor(title: string, options?: { body?: string }) {
          target.__browserNotifications.push({ title, body: options?.body ?? '' });
        }
      };
    });

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('timed-notif');
    // A due time five minutes ago in the browser's local day; the day edge
    // clamps to midnight so the instant always lies in the past.
    const pastTime = await page.evaluate(() => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 5 * 60 * 1000);
      const sameDay =
        earlier.getFullYear() === now.getFullYear() &&
        earlier.getMonth() === now.getMonth() &&
        earlier.getDate() === now.getDate();
      const target = sameDay
        ? earlier
        : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
      const pad = (value: number) => String(value).padStart(2, '0');
      return `${pad(target.getHours())}:${pad(target.getMinutes())}`;
    });

    // Create the task and set today's date plus the past time in the modal.
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    const card = page.locator('article.task-card').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    const modal = page.locator('app-personal-task-modal');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    const simpleModeCheckbox = modal.getByRole('checkbox', {
      name: 'Keep it lightweight with no date metadata',
    });
    if (await simpleModeCheckbox.isChecked()) {
      await simpleModeCheckbox.click();
    }

    await modal.locator('.date-picker-trigger').click();
    await page
      .locator('.date-picker-grid button:not([data-outside])')
      .getByText(String(new Date().getDate()), { exact: true })
      .click();
    await page.locator('#task-due-time').fill(pastTime);
    await page.getByRole('button', { name: 'Save Task' }).click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });

    // Reopening the site announces what came due (the scheduler checks on
    // start), as a browser popup and an unread bell item.
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __browserNotifications: Array<unknown> }).__browserNotifications
              .length,
        ),
      )
      .toBeGreaterThan(0);

    const popups = await page.evaluate(
      () =>
        (
          window as unknown as {
            __browserNotifications: Array<{ title: string; body: string }>;
          }
        ).__browserNotifications,
    );
    expect(popups[0]).toEqual({ title: 'Task due now', body: name });

    const bellButton = page.locator('.topbar-actions').getByLabel('Notifications');
    await bellButton.click();
    await expect(page.locator('.notifications-dropdown').filter({ hasText: name })).toBeVisible({
      timeout: 5_000,
    });

    // A second visit does not announce the same notification again.
    const unreadFetch = page.waitForResponse((response) =>
      response.url().includes('/notifications/unread-count'),
    );
    await page.goto('/tasks?view=inbox');
    await unreadFetch;
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const popupsAfterReturn = await page.evaluate(
      () =>
        (window as unknown as { __browserNotifications: Array<unknown> }).__browserNotifications
          .length,
    );
    expect(popupsAfterReturn).toBe(0);
  });
});
