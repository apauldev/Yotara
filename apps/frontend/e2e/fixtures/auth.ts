import { test as base, expect, type Page } from '@playwright/test';

export interface RuntimeConfig {
  requireEmailVerification: boolean;
  devMode: boolean;
}

function isRuntimeConfig(value: unknown): value is RuntimeConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('requireEmailVerification' in value) || !('devMode' in value)) {
    return false;
  }
  return typeof value.requireEmailVerification === 'boolean' && typeof value.devMode === 'boolean';
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/config`);
  if (!response.ok) {
    throw new Error(`Runtime config request failed with status ${response.status}`);
  }

  const config: unknown = await response.json();
  if (!isRuntimeConfig(config)) {
    throw new Error(`Runtime config response has an invalid shape from ${response.url}`);
  }
  return config;
}

const e2eTest = base.extend({
  page: async ({ page }, use) => {
    const apiUrl = process.env['E2E_API_URL'];
    if (apiUrl) {
      await page.addInitScript((url) => {
        (window as Window & { __YOTARA_E2E_API_URL__?: string }).__YOTARA_E2E_API_URL__ = url;
      }, apiUrl);
    }
    await use(page);
  },
});

export async function dismissTip(page: Page) {
  const tip = page.locator('.tip-backdrop');
  if (await tip.isVisible({ timeout: 1000 }).catch(() => false)) {
    await tip.locator('.tip-close').click();
    await page.waitForTimeout(300);
  }
}

export const test = e2eTest;

export { expect };
