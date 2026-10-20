import type { Page } from '@playwright/test';
import { test, expect, dismissTip } from '../../fixtures/auth';

const labelName = (label: string) => `${label}-label-${Date.now()}`;

async function createLabel(page: Page, name: string) {
  await page.goto('/labels');
  await page.waitForLoadState('networkidle');
  await dismissTip(page);

  await page.getByRole('button', { name: '+ New Label' }).click();
  const nameInput = page.locator('.label-editor input').first();
  await nameInput.fill(name);
  await page.getByRole('button', { name: 'Create label', exact: true }).click();
  await expect(page.locator('.label-row-name').filter({ hasText: name })).toBeVisible({
    timeout: 5_000,
  });
}

async function openRowMenu(page: Page, name: string) {
  const row = page.locator('.label-row').filter({ hasText: name });
  await row.getByRole('button', { name: `More actions for ${name}` }).click();
  return row;
}

async function openInbox(page: Page) {
  await page.goto('/tasks?view=inbox');
  await page.waitForLoadState('networkidle');
  await dismissTip(page);
}

/** Captures a task, resolving an existing `#label` through the combobox. */
async function captureTask(page: Page, title: string, label?: string) {
  const capture = page.getByPlaceholder("What's on your mind today?");
  await capture.fill(label ? `${title} #${label}` : title);

  if (label) {
    await page
      .locator('.tag-suggestions [role="option"]')
      .filter({ hasText: `#${label}` })
      .first()
      .click();
    await expect(page.locator('.tag-suggestions')).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Add Task', exact: true }).click();
  const card = page.locator('article.task-card').filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 10_000 });
  return card;
}

test.describe.configure({ mode: 'serial' });

test.describe('Labels CRUD', () => {
  test('shows labels page', async ({ page }) => {
    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: 'Labels', exact: true })).toBeVisible();
  });

  test('creates a label', async ({ page }) => {
    const name = labelName('create');
    await createLabel(page, name);

    await expect(page.locator('.label-row-name').filter({ hasText: name })).toBeVisible();
  });

  test('edits a label from the row menu', async ({ page }) => {
    const name = labelName('edit');
    const updatedName = labelName('edited');
    await createLabel(page, name);

    const row = await openRowMenu(page, name);
    await row.getByRole('menuitem', { name: 'Edit' }).click();

    const editInput = page.locator('.label-editor input').first();
    await editInput.clear();
    await editInput.fill(updatedName);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();

    await expect(page.locator('.label-row-name').filter({ hasText: updatedName })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('deletes a label without deleting its tasks', async ({ page }) => {
    const name = labelName('delete');
    await createLabel(page, name);

    const row = await openRowMenu(page, name);
    await row.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(page.getByRole('heading', { name: `Delete ${name}?` })).toBeVisible();
    await page.getByRole('button', { name: 'Delete label', exact: true }).click();

    await expect(page.locator('.label-row-name').filter({ hasText: name })).toHaveCount(0);
  });

  test('filters the task list by a label', async ({ page }) => {
    const name = labelName('filter');
    await createLabel(page, name);

    await openInbox(page);

    const taskTitle = `task-${name}`;
    await captureTask(page, taskTitle, name);

    await page.getByRole('button', { name: 'Labels', exact: true }).click();
    const panel = page.locator('#task-label-filter-panel');
    await panel.getByRole('button', { name: new RegExp(name) }).click();
    await panel.getByRole('button', { name: 'Done', exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`labels=`));
    await expect(page.getByText(`Labeled: ${name}`)).toBeVisible();
    const filteredCard = page.locator('article.task-card').filter({ hasText: taskTitle });
    await expect(filteredCard).toBeVisible({ timeout: 10_000 });

    // A reload keeps the filter, and browser history restores it on forward.
    await page.reload();
    await expect(page.getByText(`Labeled: ${name}`)).toBeVisible();
    await expect(filteredCard).toBeVisible({ timeout: 10_000 });

    await page.goBack();
    await expect(page.getByText(`Labeled: ${name}`)).toHaveCount(0);
    await page.goForward();
    await expect(page.getByText(`Labeled: ${name}`)).toBeVisible();
  });

  test('creates a label from capture and applies it to the task', async ({ page }) => {
    const name = labelName('capture-create');
    await openInbox(page);

    const taskTitle = `task-${name}`;
    const capture = page.getByPlaceholder("What's on your mind today?");
    await capture.fill(`${taskTitle} #${name}`);

    const createOption = page.locator('.suggestion-create').filter({ hasText: name });
    await expect(createOption).toBeVisible();
    await createOption.click();

    await expect(capture).toHaveValue(`${taskTitle} #${name} `);
    await page.getByRole('button', { name: 'Add Task', exact: true }).click();

    const card = page.locator('article.task-card').filter({ hasText: taskTitle });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText(name, { exact: true })).toBeVisible();

    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);
    await expect(page.locator('.label-row-name').filter({ hasText: name })).toBeVisible();
  });

  test('merges a duplicate label and preserves its tasks', async ({ page }) => {
    const sourceName = labelName('merge-source');
    const targetName = labelName('merge-target');
    await createLabel(page, targetName);
    await createLabel(page, sourceName);

    await openInbox(page);
    const taskTitle = `task-${sourceName}`;
    const beforeCard = await captureTask(page, taskTitle, sourceName);
    await expect(beforeCard.getByText(sourceName, { exact: true })).toBeVisible();

    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const row = await openRowMenu(page, sourceName);
    await row.getByRole('menuitem', { name: 'Edit' }).click();

    const editInput = page.locator('.label-editor input').first();
    await editInput.clear();
    await editInput.fill(targetName);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();

    await expect(page.getByText(`A label named “${targetName}” already exists.`)).toBeVisible();
    await page.getByRole('button', { name: `Merge into “${targetName}”` }).click();
    await page.getByRole('button', { name: 'Merge labels', exact: true }).click();

    await expect(page.locator('.label-row-name').filter({ hasText: sourceName })).toHaveCount(0);
    await expect(page.locator('.label-row-name').filter({ hasText: targetName })).toBeVisible();

    await openInbox(page);
    const afterCard = page.locator('article.task-card').filter({ hasText: taskTitle });
    await expect(afterCard).toBeVisible({ timeout: 10_000 });
    await expect(afterCard.getByText(targetName, { exact: true })).toBeVisible();
    await expect(afterCard.getByText(sourceName, { exact: true })).toHaveCount(0);
  });

  test('filters by label using only the keyboard', async ({ page }) => {
    const name = labelName('keyboard');
    await createLabel(page, name);
    await openInbox(page);

    const trigger = page.getByRole('button', { name: 'Labels', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const panel = page.locator('#task-label-filter-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('searchbox', { name: 'Search labels' })).toBeFocused();

    await page.keyboard.type(name);
    const option = panel.getByRole('button', { name: new RegExp(name) });
    // Wait for the filtered list to render before moving focus with Tab.
    await expect(panel.locator('.filter-option')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(option).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(option).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/labels=/);
    await expect(page.getByText(`Labeled: ${name}`)).toBeVisible();
  });
});
