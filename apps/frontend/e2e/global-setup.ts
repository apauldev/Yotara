import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4200';
const AUTH_DIR = path.resolve('e2e/.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');
const TEST_EMAIL = `e2e-${Date.now()}@yotara.test`;
const TEST_PASSWORD = 'E2eTestPass123!';
const TEST_NAME = 'E2E Tester';
const LOG_FILE = path.resolve('e2e/.auth/setup-log.txt');

function log(msg: string) {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // Silently ignore — logging is best-effort during setup.
  }
}

async function waitForServer(url: string, label: string, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet — will retry after delay.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} at ${url} did not become available`);
}

async function setup() {
  log('Starting setup...');
  await waitForServer(BASE_URL, 'Frontend');
  log('Frontend ready');
  await waitForServer('http://localhost:3000/health', 'API');
  log('API ready');

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    log('Navigating to login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    log(`Current URL: ${page.url()}`);

    log('Clicking Create an account...');
    await page.getByRole('button', { name: 'Create an account' }).click();

    log('Filling form...');
    await page.getByLabel('Name').fill(TEST_NAME);
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);

    log('Submitting...');
    await page.getByRole('button', { name: 'Create account' }).click();

    log('Waiting for onboarding...');
    await page.waitForURL(/\/onboarding/);
    log(`Onboarding URL: ${page.url()}`);

    log('Selecting Personal workspace...');
    await page.getByText('Personal & Simple').click();

    log('Clicking Continue...');
    await page.getByRole('button', { name: 'Continue' }).click();

    log('Waiting for tasks...');
    await page.waitForURL(/\/tasks/);
    log(`Final URL: ${page.url()}`);

    log('Saving storage state...');
    await context.storageState({ path: AUTH_FILE });
    process.env['E2E_TEST_EMAIL'] = TEST_EMAIL;
    log('Setup complete!');
  } catch (err) {
    log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    await page.screenshot({ path: path.join(AUTH_DIR, 'setup-failure.png') });
    log(`Screenshot saved to setup-failure.png`);
    throw err;
  } finally {
    await browser.close();
  }
}

export default setup;
