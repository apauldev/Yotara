import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Forgot password flow', () => {
  test('shows forgot password form with email input and back link', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.waitForURL('/forgot-password');

    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back to sign in/ })).toBeVisible();
  });

  test('shows validation error for empty email', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
  });

  test('shows validation error for invalid email format', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
  });

  test('transitions to confirmation screen on valid email', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // The form always shows success for privacy (even if email doesn't exist)
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send again' })).toBeVisible();
  });

  test('back to sign in navigates to login page', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('button', { name: /Back to sign in/ }).click();

    await page.waitForURL('/login');
    await expect(page.getByRole('heading', { name: 'Welcome to Yotara' })).toBeVisible();
  });

  test('send again goes back to form', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your email')).toBeVisible();

    await page.getByRole('button', { name: 'Send again' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });
});
