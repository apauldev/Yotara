/**
 * Verify every environment variable in `apps/api/.env.example` is documented in
 * `docs/CONFIGURATION.md`.
 *
 * This exists because configuration documentation drifted badly once already:
 * `RATE_LIMIT_MAX` was documented as 1000/min while the code defaulted to 200,
 * and `APP_BASE_URL` was documented with an `/api` suffix that would have broken
 * auth callbacks. Requiring the key to appear in the reference makes adding a
 * variable without documenting it a build failure rather than a future audit
 * finding.
 *
 * The reverse direction is intentionally not enforced: `docs/CONFIGURATION.md`
 * documents more variables than the example file ships, which is fine.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, 'apps/api/.env.example');
const docsPath = resolve(root, 'docs/CONFIGURATION.md');

const envSource = readFileSync(envPath, 'utf8');
const docsSource = readFileSync(docsPath, 'utf8');

// Match both active (`KEY=value`) and commented-out (`# KEY=value`) entries, so
// optional variables are covered too.
const keys = new Set();
for (const line of envSource.split('\n')) {
  const match = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/);
  if (match) {
    keys.add(match[1]);
  }
}

if (keys.size === 0) {
  console.error(`No environment variables found in ${envPath}. The parser is out of date.`);
  process.exit(1);
}

const missing = [...keys].filter((key) => !docsSource.includes(`\`${key}\``)).sort();

if (missing.length > 0) {
  console.error(`Undocumented environment variables (${missing.length}):\n`);
  for (const key of missing) {
    console.error(`  ${key}`);
  }
  console.error(
    `\nAdd each one to docs/CONFIGURATION.md, using backticks around the name.\n` +
      `Source: apps/api/.env.example  ->  Reference: docs/CONFIGURATION.md`,
  );
  process.exit(1);
}

console.log(`All ${keys.size} variables from apps/api/.env.example are documented.`);
