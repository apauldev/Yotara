import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Reset password page', () => {
  test('shows invalid token error when token is missing', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('No reset token found')).toBeVisible();
  });

  test('shows invalid token error with INVALID_TOKEN query param', async ({ page }) => {
    await page.goto('/reset-password?error=INVALID_TOKEN');
    await expect(page.getByText('Invalid or expired link')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request a new link' })).toBeVisible();
  });

  test('shows set password form with a valid-looking token', async ({ page }) => {
    await page.goto('/reset-password?token=valid-test-token-123');
    await expect(page.getByRole('heading', { name: 'Set new password' })).toBeVisible();
    await expect(page.getByLabel('New password')).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset password' })).toBeVisible();
  });

  test('shows validation error for empty password', async ({ page }) => {
    await page.goto('/reset-password?token=valid-test-token-123');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('shows validation error when passwords do not match', async ({ page }) => {
    await page.goto('/reset-password?token=valid-test-token-123');
    await page.getByLabel('New password').fill('password123');
    await page.getByLabel('Confirm password').fill('different456');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('shows error for invalid/expired token on submit', async ({ page }) => {
    // Use a fake token — Better Auth will reject it, but the frontend
    // shows a generic error message
    await page.goto('/reset-password?token=definitely-fake-token');
    await page.getByLabel('New password').fill('NewValidPass123!');
    await page.getByLabel('Confirm password').fill('NewValidPass123!');
    await page.getByRole('button', { name: 'Reset password' }).click();

    // Should show an error since the token doesn't exist on the server
    await expect(
      page.getByText(/Invalid token|link may have expired|Failed to reset password/i),
    ).toBeVisible({ timeout: 15000 });
  });

  test('request a new link navigates to forgot-password', async ({ page }) => {
    await page.goto('/reset-password?error=INVALID_TOKEN');
    await page.getByRole('button', { name: 'Request a new link' }).click();

    await page.waitForURL('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });

  test('back to sign in navigates to login', async ({ page }) => {
    await page.goto('/reset-password?token=some-token');
    await page.getByRole('button', { name: /Back to sign in/ }).click();

    await page.waitForURL('/login');
    await expect(page.getByRole('heading', { name: 'Welcome to Yotara' })).toBeVisible();
  });
});
