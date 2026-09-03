import { expect, test } from '@playwright/test';

const legalDocument = {
  type: 'terms-of-service',
  version: '1.0',
  effectiveDate: '2026-09-02',
  title: 'Yotara Beta Terms of Service',
  content: '# Beta terms\n\nUse the beta responsibly.',
};

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Optional beta terms', () => {
  test('does not show the terms notice when the document is unavailable', async ({ page }) => {
    await page.route('**/legal/terms.json', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account' }).click();

    await expect(page.locator('app-beta-terms-notice')).toHaveCount(0);
    await expect(page.getByText('Beta Terms of Service')).toHaveCount(0);
  });

  test('shows and opens the terms notice when a valid document is available', async ({ page }) => {
    await page.route('**/legal/terms.json', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(legalDocument),
      }),
    );

    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account' }).click();

    await expect(page.locator('app-beta-terms-notice')).toBeVisible();
    await expect(page.getByText('I agree to the')).toBeVisible();
    await page.getByRole('button', { name: 'Beta Terms of Service' }).click();
    await expect(page.getByRole('dialog')).toContainText('Use the beta responsibly.');
  });

  test('requires agreement before creating an account', async ({ page }) => {
    await page.route('**/legal/terms.json', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(legalDocument),
      }),
    );

    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page.locator('app-beta-terms-notice')).toBeVisible();

    await page.getByLabel(/I agree to the/).uncheck();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please accept the Beta Terms of Service')).toBeVisible();

    await page.getByLabel(/I agree to the/).check();
    await expect(page.getByText('Please accept the Beta Terms of Service')).toHaveCount(0);
  });
});
