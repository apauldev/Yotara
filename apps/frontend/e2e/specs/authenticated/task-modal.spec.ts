import { test, expect, dismissTip } from '../../fixtures/auth';
import type { Page } from '@playwright/test';

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
  monthLabel: string;
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
      monthLabel: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
      }).format(date),
    };
  }, days);
}

async function selectCalendarDate(page: Page, target: CalendarDate) {
  // The picker popover renders into a document-level portal, so always query
  // from the page: scoping to a component locator misses the panel entirely.
  const panel = page.locator('.date-picker-panel').last();
  await expect(panel).toBeVisible();
  const monthLabel = panel.locator('.date-picker-month');

  // The calendar re-renders asynchronously after each navigation click, so wait
  // for the target month to actually display instead of assuming one click is
  // enough. Clicking blindly overshoots (e.g. landing on November for an
  // October target) and the detached click then silently no-ops.
  for (
    let attempt = 0;
    attempt < 6 && (await monthLabel.textContent()) !== target.monthLabel;
    attempt += 1
  ) {
    await page.locator('.date-picker-nav:visible').last().click({ force: true });
    await expect(monthLabel).toHaveText(target.monthLabel, { timeout: 5_000 });
  }
  await expect(monthLabel).toHaveText(target.monthLabel);

  const day = panel.locator(`.date-picker-day[aria-label="${target.accessibleLabel}"]`);
  await day.click();
  // Selecting a date closes the popover; failing here means the click missed
  // rather than surfacing pages later as a stale preview.
  await expect(panel).toHaveCount(0);
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
    // Escape, rather than clicking the capture input: the panel flips above its
    // trigger when the capture bar sits low enough, and then covers that input,
    // so an outside click there is a pointer-interception gamble.
    await page.keyboard.press('Escape');
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
    await expect(page.getByText(/" added to Inbox/).first()).toBeVisible();

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
    await selectCalendarDate(page, manualDate);
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
    await expect(page.getByText(/" added to Upcoming( \(.+?\))? · due /).first()).toBeVisible();

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
    await selectCalendarDate(page, manualDate);
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
    await expect(page.getByText(/" added to Upcoming( \(.+?\))? · due /).first()).toBeVisible();

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
    await expect(page.getByText(/" added to Today/).first()).toBeVisible();
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

  test('sets, persists, and clears a due time in the modal', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('due-time');
    const manualDate = await calendarDateAfter(page, 7);

    await page.getByPlaceholder("What's on your mind today?").fill(name);
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Simple Mode disables the schedule controls; turn it off first. The time
    // field then still waits for a date.
    const timeInput = page.locator('#task-due-time');
    await expect(timeInput).toBeDisabled();
    const simpleModeCheckbox = page.getByRole('checkbox', {
      name: 'Keep it lightweight with no date metadata',
    });
    await expect(simpleModeCheckbox).toBeVisible({ timeout: 3_000 });
    if (await simpleModeCheckbox.isChecked()) {
      await simpleModeCheckbox.click();
    }

    await page.locator('.schedule-picker .date-picker-trigger').click();
    await selectCalendarDate(page, manualDate);
    await expect(timeInput).toBeEnabled();
    await timeInput.fill('15:30');

    // The preview shows the exact date and time that will be saved.
    const preview = page.locator('#task-date-preview');
    await expect(preview).toContainText(manualDate.displayLabel);
    await expect(preview).toContainText('3:30 PM');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Create Task' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      dueTime?: string;
    };
    expect(payload.dueDate).toBe(manualDate.iso);
    expect(payload.dueTime).toBe('15:30');
    const createdTask = (await createResponse.json()) as { dueDate?: string; dueTime?: string };
    expect(createdTask.dueTime).toBe('15:30');

    // The persisted time round-trips when the task is reopened.
    const card = await findTaskCard(page, name);
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#task-due-time')).toHaveValue('15:30');

    // Clearing the time sends null and persists the clear.
    const clearResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname.startsWith('/tasks/'),
    );
    await page.locator('#task-due-time').fill('');
    await page.getByRole('button', { name: 'Save Task' }).click();
    const clearResponse = await clearResponsePromise;
    expect(clearResponse.status()).toBe(200);
    const clearPayload = clearResponse.request().postDataJSON() as { dueTime?: string | null };
    expect(clearPayload.dueTime).toBeNull();

    // Reopening shows the cleared time while the date survives.
    const cardAfterClear = await findTaskCard(page, name);
    await cardAfterClear.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#task-due-time')).toHaveValue('');
    await expect(page.locator('.schedule-picker .date-picker-trigger')).toContainText(
      manualDate.displayLabel,
    );
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('quick-captures a timed task and persists its time', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('quick-timed');
    const today = await calendarDateAfter(page, 0);
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} today at 3pm`);

    const preview = page.locator('#capture-date-preview');
    await expect(preview).toContainText('today at 3pm resolves to');
    await expect(preview).toContainText('3:00 PM');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      dueTime?: string;
    };
    expect(payload.dueDate).toBe(today.iso);
    expect(payload.dueTime).toBe('15:00');
    const createdTask = (await createResponse.json()) as { dueTime?: string };
    expect(createdTask.dueTime).toBe('15:00');

    // The confirmation and the card badge both name the time that was set.
    await expect(page.getByText(/" added to Today( \(.+?\))? · due /).first()).toContainText(
      '3:00 PM',
    );

    const card = await findTaskCard(page, name);
    await expect(card).toContainText('3:00 PM');
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#task-due-time')).toHaveValue('15:00');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('quick-captures a time that precedes the date', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('prefix-timed');
    const today = await calendarDateAfter(page, 0);
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} at 5pm today`);

    const preview = page.locator('#capture-date-preview');
    await expect(preview).toContainText('at 5pm today resolves to');
    await expect(preview).toContainText('5:00 PM');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      dueTime?: string;
    };
    expect(payload.dueDate).toBe(today.iso);
    expect(payload.dueTime).toBe('17:00');
  });

  test('carries a timed NLP draft through the details modal', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('details-timed');
    const tomorrow = await calendarDateAfter(page, 1);
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} tomorrow at 9:30am`);
    await page.getByRole('button', { name: 'Add task with details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const preview = page.locator('#task-date-preview');
    await expect(preview).toContainText('tomorrow at 9:30am resolves to');
    await expect(preview).toContainText('9:30 AM');
    await expect(page.locator('#task-due-time')).toHaveValue('09:30');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Create Task' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      dueTime?: string;
    };
    expect(payload.dueDate).toBe(tomorrow.iso);
    expect(payload.dueTime).toBe('09:30');
    const createdTask = (await createResponse.json()) as { dueTime?: string };
    expect(createdTask.dueTime).toBe('09:30');
    await expect(page.getByText(/" added to Upcoming( \(.+?\))? · due /).first()).toBeVisible();

    const card = await findTaskCard(page, name);
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#task-due-time')).toHaveValue('09:30');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('keeps a vague time as plain text with a notice', async ({ page }) => {
    await page.goto('/tasks?view=inbox');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = taskName('vague-time');
    await page.getByPlaceholder("What's on your mind today?").fill(`${name} tomorrow morning`);

    await expect(page.locator('#capture-date-note')).toContainText(
      'To set a timed due date, include a date and exact time',
    );
    await expect(page.locator('#capture-date-preview')).toHaveCount(0);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/tasks',
    );
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const payload = createResponse.request().postDataJSON() as {
      dueDate?: string;
      dueTime?: string;
    };
    expect(payload.dueDate).toBeUndefined();
    expect(payload.dueTime).toBeUndefined();
  });
});
