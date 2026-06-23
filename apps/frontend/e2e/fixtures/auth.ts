import { test as base, expect, type Page } from '@playwright/test';

export async function dismissTip(page: Page) {
  const tip = page.locator('.tip-backdrop');
  if (await tip.isVisible({ timeout: 1000 }).catch(() => false)) {
    await tip.locator('.tip-close').click();
    await page.waitForTimeout(300);
  }
}

export const test = base;

export { expect };
