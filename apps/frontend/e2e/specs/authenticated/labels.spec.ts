import { test, expect, dismissTip } from '../../fixtures/auth';

const labelName = (label: string) => `${label}-label-${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Labels CRUD', () => {
  test('shows labels page', async ({ page }) => {
    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    await expect(page.getByRole('heading', { name: 'Labels' })).toBeVisible();
  });

  test('creates a label', async ({ page }) => {
    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = labelName('create');

    // Click "+ New Label" button
    await page.getByRole('button', { name: '+ New Label' }).click();

    // The label modal should open — fill the name
    const nameInput = page.locator('.label-editor input').first();
    await nameInput.fill(name);

    // Create label — use exact match to avoid matching backdrop/close buttons
    await page.getByRole('button', { name: 'Create Label', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify label appears in left rail
    await expect(page.locator('.label-rail-item').filter({ hasText: name })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('edits a label', async ({ page }) => {
    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = labelName('edit');
    const updatedName = labelName('edited');

    // Create label first — modal stays open in edit mode after creation
    await page.getByRole('button', { name: '+ New Label' }).click();
    const nameInput = page.locator('.label-editor input').first();
    await nameInput.fill(name);
    await page.getByRole('button', { name: 'Create Label', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Modal is already in edit mode — the input still has the name pre-filled.
    // Edit the name directly without clicking the rail (which would re-hydrate).
    const editInput = page.locator('.label-editor input').first();
    await editInput.clear();
    await editInput.fill(updatedName);

    // Save changes — use exact match to avoid modal close buttons
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify updated name in the labels table (modal closes after save)
    await expect(
      page.locator('.labels-table-container .table-row').filter({ hasText: updatedName }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('deletes a label', async ({ page }) => {
    await page.goto('/labels');
    await page.waitForLoadState('networkidle');
    await dismissTip(page);

    const name = labelName('delete');

    // Create label first
    await page.getByRole('button', { name: '+ New Label' }).click();
    const nameInput = page.locator('.label-editor input').first();
    await nameInput.fill(name);
    await page.getByRole('button', { name: 'Create Label', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Click label in left rail
    await page.locator('.label-rail-item').filter({ hasText: name }).click();
    await page.waitForTimeout(500);

    // Click delete button
    await page.getByRole('button', { name: 'Delete label' }).click();

    // Confirm deletion — exact match avoids the edit button (which has "delete-label-" in its name)
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(1000);

    // Verify label no longer visible in the labels table
    await expect(
      page.locator('.labels-table-container .table-row').filter({ hasText: name }),
    ).not.toBeVisible();
  });
});
