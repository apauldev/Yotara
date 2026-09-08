import { test, expect, dismissTip } from '../../fixtures/auth';
import type { Page } from '@playwright/test';

const taskName = (label: string) => `${label}-mobile-${Date.now()}`;
const titlePlaceholder = 'Redesign sanctuary garden layout';
const detailsButtonName = 'Add task with details';

async function openCreateModal(page: Page, viewport?: { width: number; height: number }) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  await page.goto('/tasks?view=inbox');
  await page.waitForLoadState('networkidle');
  await dismissTip(page);

  await page.getByPlaceholder("What's on your mind today?").fill('mobile test title');
  await page.getByRole('button', { name: detailsButtonName }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

async function expandDetails(page: Page) {
  const toggle = page.getByRole('button', { name: /More details/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function measureTouchTargets(page: Page, selectors: string[]) {
  const targets = [];
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    await expect(target, `${selector} should render`).toBeVisible();
    const box = await target.boundingBox();
    targets.push({
      selector,
      width: box?.width ?? 0,
      height: box?.height ?? 0,
    });
  }
  return targets;
}
test.describe.configure({ mode: 'serial' });

test.describe('Task modal on mobile', () => {
  test('renders as a bottom sheet with a visible fixed footer', async ({ page }) => {
    await openCreateModal(page);

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    const box = await page.getByRole('dialog').boundingBox();
    expect(box).toBeTruthy();
    // Bottom-sheet geometry: full-width and anchored to the viewport bottom.
    expect(box!.width).toBeGreaterThanOrEqual(viewport!.width - 4);
    expect(viewport!.height - (box!.y + box!.height)).toBeLessThanOrEqual(4);

    // The footer lives outside the scroll region and stays visible.
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible();
  });

  test('keeps the shared modal body as the only effective mobile scroll container', async ({
    page,
  }) => {
    await openCreateModal(page);

    const scrollOwner = await page.locator('.modal-body-scroll').evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        overflowY: styles.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    });
    expect(['auto', 'scroll']).toContain(scrollOwner.overflowY);
    expect(scrollOwner.scrollHeight).toBeGreaterThan(scrollOwner.clientHeight);

    const nestedScrollables = await page
      .locator('.task-main, .task-details, .subtask-list')
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const styles = getComputedStyle(element);
            return (
              styles.display !== 'none' &&
              ['auto', 'scroll'].includes(styles.overflowY) &&
              element.scrollHeight - element.clientHeight > 4
            );
          })
          .map((element) => element.className.toString()),
      );
    expect(nestedScrollables).toEqual([]);

    await page.locator('.modal-body-scroll').evaluate((element) => element.scrollTo(0, 999_999));
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible();
    const footerBox = await page.getByRole('button', { name: 'Create Task' }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height + 2);
  });

  test('focuses the title on open and restores focus on Escape', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Invoke from the FAB: a stable control that survives the modal lifecycle.
    const fab = page.getByRole('button', { name: 'Quick add task' });
    await fab.focus();
    await fab.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByPlaceholder(titlePlaceholder)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(fab).toBeFocused();
  });

  test('traps Tab focus inside the dialog', async ({ page }) => {
    await openCreateModal(page);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return !!dialog?.contains(document.activeElement);
      });
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Shift+Tab');
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog?.contains(document.activeElement);
    });
    expect(inside).toBe(true);
  });

  test('collapses More details for new tasks and expands on demand', async ({ page }) => {
    await openCreateModal(page);

    const toggle = page.getByRole('button', { name: /More details/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#task-project')).not.toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#task-project')).toBeVisible();
    await expect(page.locator('.priority-dot[aria-label="high priority"]')).toBeVisible();
  });

  test('auto-expands More details when editing a task with metadata', async ({ page }) => {
    const name = taskName('expand');

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByRole('button', { name: detailsButtonName }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(titlePlaceholder).fill(name);

    // Advanced metadata lives behind the disclosure on mobile.
    await page.getByRole('button', { name: /More details/ }).click();
    await page.locator('.priority-dot[aria-label="high priority"]').click();
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    await page.locator('article.task-card').filter({ hasText: name }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByRole('button', { name: /More details/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.locator('.priority-dot[aria-label="high priority"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('keeps advanced fields usable after expansion', async ({ page }) => {
    await openCreateModal(page);

    await page.getByRole('button', { name: /More details/ }).click();
    await page.selectOption('#task-status', 'today');
    await expect(page.locator('#task-due-date-error, .date-picker-trigger').first()).toBeVisible();

    await page.locator('.priority-dot[aria-label="medium priority"]').click();
    await expect(page.locator('.priority-dot[aria-label="medium priority"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('keeps key task controls at least 44px on touch layouts', async ({ page }) => {
    await openCreateModal(page, { width: 390, height: 844 });
    await expandDetails(page);

    const targetSelectors = [
      '.modal-card .close-button',
      '.details-toggle',
      '.priority-dot',
      '.label-chip',
      '.palette-swatch',
      '.date-picker-trigger',
      '.checkbox-control',
      '.add-subtask-button',
      '.primary-button',
      '.secondary-button',
    ];
    const targets = await measureTouchTargets(page, targetSelectors);
    expect(targets).toHaveLength(targetSelectors.length);
    for (const target of targets) {
      expect(target.width, `${target.selector} width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${target.selector} height`).toBeGreaterThanOrEqual(44);
    }

    const simpleMode = page.getByRole('checkbox', {
      name: 'Keep it lightweight with no date metadata',
    });
    if (await simpleMode.isChecked()) {
      await simpleMode.click();
    }
    await page.locator('.schedule-picker .date-picker-trigger').click();
    const calendarTargets = await measureTouchTargets(page, ['.date-picker-nav']);
    for (const target of calendarTargets) {
      expect(target.width, `${target.selector} width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${target.selector} height`).toBeGreaterThanOrEqual(44);
    }

    await page.locator('.date-picker-day:not([data-disabled])').first().click();
    const clearTarget = await measureTouchTargets(page, ['.date-picker-clear']);
    expect(clearTarget[0].width).toBeGreaterThanOrEqual(44);
    expect(clearTarget[0].height).toBeGreaterThanOrEqual(44);
  });

  test('completes the advanced workflow at 320px and persists metadata', async ({ page }) => {
    const name = taskName('advanced');
    await openCreateModal(page, { width: 320, height: 568 });

    const title = page.getByPlaceholder(titlePlaceholder);
    await title.fill(name);
    await page.getByRole('textbox', { name: 'Description' }).fill('Narrow-screen details');
    await expandDetails(page);

    const label = page.locator('.label-chip').first();
    await expect(label).toBeVisible();
    const labelName = await label.innerText();
    await label.click();
    await expect(label).toHaveAttribute('aria-pressed', 'true');

    const repeatSection = page
      .locator('.task-details .sidebar-section')
      .filter({ hasText: 'Repeat' });
    await repeatSection.locator('select.status-select').selectOption('weekly');
    await page.locator('.day-chip').nth(1).click();
    await expect(page.locator('.day-chip').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await page.selectOption('#task-status', 'today');

    const simpleMode = page.getByRole('checkbox', {
      name: 'Keep it lightweight with no date metadata',
    });
    if (await simpleMode.isChecked()) {
      await simpleMode.click();
    }

    const schedule = page.locator('.schedule-picker .date-picker-trigger');
    await schedule.click();
    const today = new Date().getDate().toString();
    const date = page
      .locator('.date-picker-day:not([data-outside]):not([data-disabled])')
      .filter({ hasText: today })
      .first();
    await expect(date).toBeVisible();
    await date.click();
    await expect(schedule).not.toContainText('Pick a date');

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(320);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Create Task' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    await page.goto('/tasks?view=today');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('article.task-card').filter({ hasText: name }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expandDetails(page);
    await expect(page.locator('.label-chip').filter({ hasText: labelName })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const reopenedRepeatSection = page
      .locator('.task-details .sidebar-section')
      .filter({ hasText: 'Repeat' });
    await expect(reopenedRepeatSection.locator('select.status-select')).toHaveValue('weekly');
    await expect(page.locator('.day-chip').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.schedule-picker .date-picker-trigger')).not.toContainText(
      'Pick a date',
    );
  });

  test('keeps the modal open and preserves drafts after a save error', async ({ page }) => {
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/tasks') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Could not save your task right now.' }),
        });
        return;
      }
      await route.continue();
    });

    await openCreateModal(page);
    const title = page.getByPlaceholder(titlePlaceholder);
    await title.fill('Retry this mobile save');
    await page.getByRole('button', { name: 'Create Task' }).click();

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'Could not save your task right now.',
    );
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(title).toHaveValue('Retry this mobile save');

    await page.unroute('**/*');
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  });

  test('validates with associations and moves focus to the title', async ({ page }) => {
    await openCreateModal(page);

    await page.getByPlaceholder(titlePlaceholder).clear();
    await page.getByRole('button', { name: 'Create Task' }).click();

    await expect(page.getByText('Title is required')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByPlaceholder(titlePlaceholder)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByPlaceholder(titlePlaceholder)).toHaveAttribute(
      'aria-describedby',
      'task-title-error',
    );
    await expect(page.getByPlaceholder(titlePlaceholder)).toBeFocused();
  });

  test('removes draft subtasks without hover', async ({ page }) => {
    const name = taskName('draft');

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByRole('button', { name: detailsButtonName }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(titlePlaceholder).fill(name);

    await page.getByRole('button', { name: 'Add subtask' }).click();
    await page.getByPlaceholder('What needs to be done?').fill('Touch step');
    await page.getByPlaceholder('What needs to be done?').press('Enter');

    // Visible without hovering: touch layouts have no hover state.
    const removeButton = page.getByRole('button', { name: 'Remove draft subtask Touch step' });
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    await expect(removeButton).not.toBeVisible();

    await page.locator('footer').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('creates a task end to end on mobile', async ({ page }) => {
    const name = taskName('create');

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByRole('button', { name: detailsButtonName }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(titlePlaceholder).fill(name);

    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('article.task-card').filter({ hasText: name }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('keeps the FAB clear of bottom content', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const fab = page.getByRole('button', { name: 'Quick add task' });
    await expect(fab).toBeVisible();
    const fabBox = await fab.boundingBox();
    expect(fabBox).toBeTruthy();

    const cards = page.locator('article.task-card');
    if ((await cards.count()) > 0) {
      const last = cards.last();
      await last.scrollIntoViewIfNeeded();
      const cardBox = await last.boundingBox();
      expect(cardBox).toBeTruthy();
      const overlaps =
        fabBox!.x < cardBox!.x + cardBox!.width &&
        fabBox!.x + fabBox!.width > cardBox!.x &&
        fabBox!.y < cardBox!.y + cardBox!.height &&
        fabBox!.y + fabBox!.height > cardBox!.y;
      expect(overlaps).toBe(false);
    }
  });

  test('composes a compact topbar with second-row search', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const brandBox = await page.locator('.topbar-brand').boundingBox();
    const actionsBox = await page.locator('.topbar-actions').boundingBox();
    const searchBox = await page.locator('.search-shell').boundingBox();
    expect(brandBox).toBeTruthy();
    expect(actionsBox).toBeTruthy();
    expect(searchBox).toBeTruthy();

    // First row: brand and actions share a vertical band.
    expect(Math.abs(brandBox!.y - actionsBox!.y)).toBeLessThanOrEqual(24);
    // Second row: the search sits below the brand row, full width.
    expect(searchBox!.y).toBeGreaterThanOrEqual(brandBox!.y + brandBox!.height - 4);
    expect(searchBox!.width).toBeGreaterThanOrEqual(390 - 40);
  });

  test('has no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const listOverflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(listOverflow).toBeLessThanOrEqual(320);

    await page.getByPlaceholder("What's on your mind today?").fill('overflow check');
    await page.getByRole('button', { name: detailsButtonName }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const modalOverflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(modalOverflow).toBeLessThanOrEqual(320);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
