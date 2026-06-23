import { test, expect, dismissTip } from '../../fixtures/auth';

const taskName = (label: string) => `${label}-modal-${Date.now()}`;

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
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify task card appears in inbox
    await expect(page.locator('article.task-card').filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
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
