import { test, expect, dismissTip } from '../../fixtures/auth';

const taskName = (label: string) => `${label}-${Date.now()}`;

function monthLabel(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

test.describe.configure({ mode: 'serial' });

test.describe('Calendar', () => {
  test('shows a task due today and navigates months', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // A task captured with "today" gets a due date, so it leaves the Inbox
    // (which lists only undated tasks). The capture bar clears on success.
    const name = taskName('cal');
    const capture = page.getByPlaceholder("What's on your mind today?");
    await capture.fill(`${name} today`);
    await capture.press('Enter');
    await expect(capture).toHaveValue('');

    await page.getByRole('link', { name: 'Calendar' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible({
      timeout: 10_000,
    });

    const now = new Date();
    const current = monthLabel(now);
    const next = monthLabel(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    await expect(page.getByText(current, { exact: true })).toBeVisible();

    // Today is selected by default, so the task shows in the day panel.
    await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: 'Add task for this date' })).toBeVisible();

    // Month navigation
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByText(next, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByText(current, { exact: true })).toBeVisible();
  });

  test('toggles the No date list', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByRole('button', { name: /No date/ }).click();
    await expect(page.getByRole('heading', { name: 'No date', exact: true })).toBeVisible();
  });

  test('creates a task for a selected day and it persists after reload', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const target = new Date();
    target.setDate(1);
    target.setMonth(target.getMonth() + 1);
    target.setDate(10);
    const targetMonth = monthLabel(target);
    const panelLabel = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(target);
    const expectedPreview = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(target);

    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByText(targetMonth, { exact: true })).toBeVisible();

    const targetCell = page
      .locator('.cal-cell:not(.cal-cell-outside)')
      .filter({ has: page.locator('.cal-day-number', { hasText: /^10$/ }) })
      .first();
    await expect(targetCell).toBeVisible();

    // Clicking a day selects it and opens the panel — it never opens the editor.
    await targetCell.click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(panelLabel, { exact: true })).toBeVisible();

    // Creating is an explicit action, pre-filled with the selected day.
    await page.getByRole('button', { name: 'Add task for this date' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(`Due ${expectedPreview}`)).toBeVisible();

    const name = taskName('cell');
    await page.getByPlaceholder('Redesign sanctuary garden layout').fill(name);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(targetCell.getByText(name)).toBeVisible({ timeout: 10_000 });

    // It persists on that day after a reload.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByText(targetMonth, { exact: true })).toBeVisible();
    await expect(targetCell.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('completes a task from its chip without opening the editor', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('complete');
    const capture = page.getByPlaceholder("What's on your mind today?");
    await capture.fill(`${name} today`);
    await capture.press('Enter');
    await expect(capture).toHaveValue('');

    await page.getByRole('link', { name: 'Calendar' }).click();
    await page.waitForLoadState('networkidle');

    const chip = page.locator('.cal-chip').filter({ hasText: name }).first();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await chip.locator('.cal-chip-check').click();

    // Completing never opens the editor; the chip leaves the active calendar.
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0, {
      timeout: 10_000,
    });

    // It stays completed after a reload and shows in the archive.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);

    await page.getByRole('link', { name: 'Archive' }).click();
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('schedules an undated task from the No date list', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('nodate');
    const capture = page.getByPlaceholder("What's on your mind today?");
    await capture.fill(`${name} water the plants`);
    await capture.press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'Calendar' }).click();
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByRole('button', { name: /No date/ }).click();

    const row = page.locator('.cal-nodate-row').filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: 'Today', exact: true }).click();

    // The row leaves the list and the task lands on today's cell.
    await expect(row).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.cal-cell-today').getByText(name)).toBeVisible({ timeout: 10_000 });

    // It stays scheduled after a reload.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await page.getByRole('button', { name: /No date/ }).click();
    await expect(page.locator('.cal-nodate-row').filter({ hasText: name })).toHaveCount(0);
  });
});
