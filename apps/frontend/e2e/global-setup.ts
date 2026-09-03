import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { getRuntimeConfig } from './fixtures/auth';

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
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

/** Read the most recent verification URL from the API log (console fallback). */
function getVerificationUrl(): string {
  const logFile = process.env['E2E_API_LOG'] ?? process.env['API_LOG_FILE'];
  if (!logFile) {
    throw new Error(
      'E2E_API_LOG must point at the API log file (it contains the console-printed verification link).',
    );
  }
  const log = fs.readFileSync(logFile, 'utf8');
  const lines = log.split('\n').reverse();
  const linkLine = lines.find((l) => l.includes('/verify-email?token='));
  if (!linkLine) {
    throw new Error(`No verification link found in ${logFile}`);
  }
  const match = linkLine.match(/https?:\/\/[^\s]+\/verify-email\?token=[^&\s]+/);
  if (!match) {
    throw new Error(`Could not extract verification URL from: ${linkLine}`);
  }
  return match[0];
}

async function setup() {
  log('Starting setup...');
  await waitForServer(BASE_URL, 'Frontend');
  log('Frontend ready');
  const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
  await waitForServer(`${apiUrl}/health`, 'API');
  log('API ready');
  const { requireEmailVerification } = await getRuntimeConfig();
  log(`Runtime config: requireEmailVerification=${requireEmailVerification}`);

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
  const apiLogFile = process.env['E2E_API_LOG'] ?? process.env['API_LOG_FILE'];
  if (apiLogFile && !fs.existsSync(apiLogFile)) {
    fs.writeFileSync(apiLogFile, '');
  }

  log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const browserApiUrl = process.env['E2E_API_URL'];
  if (browserApiUrl) {
    await context.addInitScript((url) => {
      (window as Window & { __YOTARA_E2E_API_URL__?: string }).__YOTARA_E2E_API_URL__ = url;
    }, browserApiUrl);
  }
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

    // The beta ToS agreement checkbox renders only when legal content is
    // configured (e.g. a /legal mount exists). Accept it when present so
    // setup works in both modes.
    const termsAgreement = page.getByLabel(/I agree to the/);
    if ((await termsAgreement.count()) > 0) {
      await termsAgreement.check();
    }

    if (requireEmailVerification) {
      // Email-first: no password field at signup; use the exact verification
      // link emitted in the API console fallback.
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.getByRole('heading', { name: 'Check your email' }).waitFor();
      const verificationUrl = getVerificationUrl();
      await page.goto(verificationUrl);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Set password and continue' }).click();
    } else {
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Create account' }).click();
    }

    log('Waiting for onboarding...');
    await page.waitForURL(/\/onboarding/);
    log(`Onboarding URL: ${page.url()}`);

    log('Clicking Continue (personal mode is default)...');

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
