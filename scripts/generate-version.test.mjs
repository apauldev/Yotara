import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const generatorPath = join(rootDir, 'scripts/generate-version.mjs');
const outputPath = join(rootDir, 'apps/frontend/src/app/core/constants/version.ts');

test('Version Generator Script (Final Polish)', async (t) => {
  await t.test('should execute without error', () => {
    const output = execSync(`node ${generatorPath}`).toString();
    assert.match(output, /✅ Version generated:/);
  });

  await t.test('should generate a valid immutable TypeScript file with env and detached state', () => {
    assert.strictEqual(existsSync(outputPath), true);
    const content = readFileSync(outputPath, 'utf-8');
    
    assert.match(content, /export const APP_VERSION = {/);
    assert.match(content, /} as const;/);
    assert.match(content, /isDetached: (true|false)/);
    assert.match(content, /nodeEnv: ["'](development|production|test)["']/);
    assert.match(content, /version: ["']\d+\.\d+\.\d+/);
    assert.match(content, /hash: ["'][a-f0-9]{7,40}["']|["']unknown["']/);
    assert.match(content, /branch: ["'][a-zA-Z0-9\-/._]+["']|["']unknown["']/);
    assert.match(content, /buildDate: ["']\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
