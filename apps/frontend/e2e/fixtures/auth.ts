import fs from 'node:fs';
import path from 'node:path';
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

const AUTH_DIR = path.resolve('e2e/.auth');
const CREDENTIALS_FILE = path.join(AUTH_DIR, 'credentials.json');
const authenticatedProjects = new Set(['e2e', 'mobile']);
const validatedProjects = new Set<string>();

export function getE2ECredentials() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8')) as {
    email?: unknown;
    password?: unknown;
  };
  if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
    throw new Error(`Invalid E2E credentials file at ${CREDENTIALS_FILE}`);
  }
  return { email: credentials.email, password: credentials.password };
}

export async function assertAuthenticatedPage(page: Page, url: string, scope: string) {
  let sessionStatus: number | undefined;
  const onResponse = (response: { url: () => string; status: () => number }) => {
    try {
      if (new URL(response.url()).pathname === '/auth/get-session') {
        sessionStatus = response.status();
      }
    } catch {
      // Ignore malformed response URLs; the navigation result is authoritative.
    }
  };

  page.on('response', onResponse);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } finally {
    page.off('response', onResponse);
  }

  if (new URL(page.url()).pathname === '/login') {
    const reason =
      sessionStatus === 429
        ? 'the API rate limit returned 429'
        : `status ${sessionStatus ?? 'unknown'}`;
    throw new Error(
      `Authenticated E2E state was rejected for ${scope}: redirected to /login after ${reason}. ` +
        'Check that setup and tests use the same API, database, auth secret, and rate-limit configuration.',
    );
  }
}

type E2EFixtures = {
  authenticatedSession: void;
};

const e2eTest = base.extend<E2EFixtures>({
  page: async ({ page }, use) => {
    const apiUrl = process.env['E2E_API_URL'];
    if (apiUrl) {
      await page.addInitScript((url) => {
        (window as Window & { __YOTARA_E2E_API_URL__?: string }).__YOTARA_E2E_API_URL__ = url;
      }, apiUrl);
    }
    await use(page);
  },
  authenticatedSession: [
    async ({ page }, use, testInfo) => {
      if (
        authenticatedProjects.has(testInfo.project.name) &&
        !validatedProjects.has(testInfo.project.name)
      ) {
        await assertAuthenticatedPage(page, '/tasks?view=inbox', testInfo.project.name);
        validatedProjects.add(testInfo.project.name);
      }
      await use();
    },
    { auto: true },
  ],
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
