import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  outputDir: './e2e/test-results',
  reporter: process.env['CI']
    ? [['html', { outputFolder: './e2e/playwright-report' }], ['github']]
    : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  globalSetup: './e2e/global-setup.ts',
  projects: [
    {
      name: 'login',
      testDir: './e2e/specs/login',
      use: {
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'e2e',
      testDir: './e2e/specs/authenticated',
      use: {
        storageState: './e2e/.auth/user.json',
      },
    },
    {
      name: 'onboarding',
      testDir: './e2e/specs/authenticated',
      testMatch: 'onboarding.spec.ts',
      use: {
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
