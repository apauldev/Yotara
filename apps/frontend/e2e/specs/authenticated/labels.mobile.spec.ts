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

test.describe('Labels mobile', () => {
  test('drills into a label and returns to the directory', async ({ page }) => {
    const name = labelName('mobile');
    await createLabel(page, name);

    const browser = page.locator('.label-browser');
    await expect(browser).not.toHaveClass(/label-browser-detail/);
    await expect(page.getByRole('button', { name: 'Back to labels' })).toBeHidden();

    await page.locator('.label-row').filter({ hasText: name }).locator('.label-row-link').click();
    await expect(browser).toHaveClass(/label-browser-detail/);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to labels' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to labels' }).click();
    await expect(browser).not.toHaveClass(/label-browser-detail/);
    await expect(page.getByRole('heading', { name: 'Labels', exact: true })).toBeVisible();
  });
});
