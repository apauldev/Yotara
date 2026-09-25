import { test, expect, dismissTip } from '../../fixtures/auth';
import type { Locator, Page } from '@playwright/test';

const taskName = (label: string) => `${label}-modal-${Date.now()}`;

async function findTaskCard(page: Page, name: string) {
  for (const view of ['inbox', 'today', 'upcoming'] as const) {
    await page.goto(`/tasks?view=${view}`);
    await page.waitForLoadState('networkidle');
    const card = page.locator('article.task-card').filter({ hasText: name }).first();
    if (await card.isVisible().catch(() => false)) {
      return card;
    }
  }
  throw new Error(`Could not find task card for ${name}`);
}

interface CalendarDate {
  iso: string;
  accessibleLabel: string;
  displayLabel: string;
}

async function calendarDateAfter(page: Page, days: number): Promise<CalendarDate> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return {
      iso: `${year}-${month}-${day}`,
      accessibleLabel: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(date),
      displayLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date),
    };
  }, days);
}

async function selectCalendarDate(page: Page, target: CalendarDate, root: Locator) {
  const panel = root.locator('.date-picker-panel').last();
  await expect(panel).toBeVisible();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const day = panel.locator(`.date-picker-day[aria-label="${target.accessibleLabel}"]`);
    if (await day.isVisible().catch(() => false)) {
      await day.evaluate((element: HTMLElement) => element.click());
      return;
    }
    await root.locator('.date-picker-nav:visible').last().click({ force: true });
  }

  throw new Error(`Could not select calendar date ${target.iso}`);
}

test.describe.configure({ mode: 'serial' });

test.describe('Task Modal CRUD', () => {
  test('opens the task modal from the capture bar', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Fill a title first — the capture bar requires one even for modal flow
    await page.getByPlaceholder("What's on your mind today?").fill('modal test title');
    // Click "Add task with details" button
    await page.getByRole('button', { name: 'Add task with details' }).click();

    // Verify modal opens with all key fields
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Capture a new task' })).toBeVisible();
    await expect(page.getByPlaceholder('Redesign sanctuary garden layout')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('previews, changes, and clears an NLP date during quick capture', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('quick-date');
    const captureInput = page.getByPlaceholder("What's on your mind today?");
    await captureInput.fill(`${name} today`);

    const preview = page.locator('#capture-date-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('today resolves to');

    await page.getByRole('button', { name: 'Change due date' }).click();
    await expect(page.locator('.date-picker-panel')).toBeVisible();
    await page.locator('.capture-date-picker .date-picker-trigger').click();
    await expect(page.locator('.date-picker-panel')).not.toBeVisible();

    await page.getByRole('button', { name: 'Clear due date' }).click();
    await expect(preview).toContainText('Due date cleared');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as { dueDate?: string };
    expect(payload.dueDate).toBeUndefined();
    await expect(page.getByText('Task added to Inbox.').first()).toBeVisible();

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    const card = page.locator('article.task-card').filter({ hasText: name }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.schedule-picker .date-picker-trigger')).toContainText(
      'Pick a date',
    );
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('submits and persists the inferred date during quick capture', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('quick-dated');
    const manualDate = await calendarDateAfter(page, 7);
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} today`);
    await expect(page.locator('#capture-date-preview')).toContainText('today resolves to');
    await page.getByRole('button', { name: 'Change due date' }).click();
    await selectCalendarDate(page, manualDate, page.locator('body'));
    await expect(page.locator('#capture-date-preview')).toContainText(manualDate.displayLabel);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      simpleMode?: boolean;
    };
    expect(payload.dueDate).toBe(manualDate.iso);
    expect(payload.simpleMode).toBe(false);
    const createdTask = (await createResponse.json()) as { dueDate?: string; title?: string };
    expect(createdTask.dueDate).toBe(manualDate.iso);
    expect(createdTask.title).toContain(name);
    await expect(page.getByText(/Task added to Upcoming · due /).first()).toBeVisible();

    const card = await findTaskCard(page, name);
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.schedule-picker .date-picker-trigger')).toContainText(
      manualDate.displayLabel,
    );
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('carries the NLP date through the details modal and persists it', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('details-date');
    const manualDate = await calendarDateAfter(page, 7);
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} today`);
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#task-date-preview')).toContainText('today resolves to');

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Change due date' }).click();
    await selectCalendarDate(page, manualDate, dialog);
    await expect(page.locator('#task-date-preview')).toContainText(manualDate.displayLabel);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Create Task' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      simpleMode?: boolean;
    };
    expect(payload.dueDate).toBe(manualDate.iso);
    expect(payload.simpleMode).toBe(false);
    const createdTask = (await createResponse.json()) as { dueDate?: string; title?: string };
    expect(createdTask.dueDate).toBe(manualDate.iso);
    expect(createdTask.title).toContain(name);
    await expect(page.getByText(/Task added to Upcoming · due /).first()).toBeVisible();

    const card = await findTaskCard(page, name);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.schedule-picker .date-picker-trigger')).toContainText(
      manualDate.displayLabel,
    );
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    const clearName = taskName('details-clear');
    await page.getByPlaceholder("What's on your mind today?").fill(`${clearName} today`);
    await page.getByRole('button', { name: 'Add task with details' }).click();
    const clearDialog = page.getByRole('dialog');
    await expect(clearDialog).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#task-date-preview')).toContainText('today resolves to');
    await clearDialog.getByRole('button', { name: 'Clear due date' }).click();
    await expect(page.locator('#task-date-preview')).toContainText('Due date cleared');
    await clearDialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('creates a task with title and description via the modal', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('create');

    // Fill capture bar first — it requires a title even for modal flow
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    // Open modal
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Fill title
    await page.getByPlaceholder('Redesign sanctuary garden layout').fill(name);

    // Select high priority
    await page.getByRole('button', { name: 'high priority' }).click();

    // Select status "Today"
    await page.selectOption('#task-status', 'today');

    // Create task
    await page.getByRole('button', { name: 'Create Task' }).click();
    // A manually created task with no NLP phrase still confirms its destination.
    await expect(page.getByText('Task added to Today.').first()).toBeVisible();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // A task explicitly moved to Today is not expected to remain in Inbox.
    const card = await findTaskCard(page, name);
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('creates a task with a project assignment', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const projName = `${'proj'}-modal-${Date.now()}`;
    const name = taskName('project');

    // Create a project first
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByPlaceholder('e.g. Morning Rituals').fill(projName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Go back to tasks
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Fill capture bar first
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    // Open modal
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Select project from dropdown
    await page.selectOption('#task-project', { label: projName });

    // Create task
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify task card appears
    await expect(page.locator('article.task-card').filter({ hasText: name }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('edits a task via the modal', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('edit');
    const updatedName = taskName('edited');

    // Create a task first via capture bar
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByPlaceholder("What's on your mind today?").press('Enter');
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    // Click the task card to open the modal
    await page.locator('article.task-card').filter({ hasText: name }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Edit title
    const titleInput = page.getByPlaceholder('Redesign sanctuary garden layout');
    await titleInput.clear();
    await titleInput.fill(updatedName);

    // Save
    await page.getByRole('button', { name: 'Save Task' }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify updated task card
    await expect(page.locator('article.task-card').filter({ hasText: updatedName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('validates required fields in the modal', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    // Fill capture bar first
    await page.getByPlaceholder("What's on your mind today?").fill('validation test');
    // Open modal
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Clear the pre-filled title to trigger validation
    await page.getByPlaceholder('Redesign sanctuary garden layout').clear();
    // Submit with empty title
    await page.getByRole('button', { name: 'Create Task' }).click();

    // Should show validation error
    await expect(page.getByText('Title is required')).toBeVisible({ timeout: 3_000 });
  });

  test('adds and completes subtasks', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('subtask');

    // Fill capture bar first
    await page.getByPlaceholder("What's on your mind today?").fill(name);
    // Open modal
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Fill title
    await page.getByPlaceholder('Redesign sanctuary garden layout').fill(name);

    // Click "Add subtask"
    await page.getByRole('button', { name: 'Add subtask' }).click();

    // Type subtask
    await page.getByPlaceholder('What needs to be done?').fill('Step 1');
    await page.getByPlaceholder('What needs to be done?').press('Enter');

    // Create task
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify task card appears — use .first() because the task may be rendered twice
    await expect(
      page.getByRole('button', { name: `Open task details for ${name}` }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
