/**
 * Cap white-box `componentInstance as any` casts in frontend specs.
 *
 * CONTRIBUTING.md asks tests to stay at the boundary they want to keep stable:
 * DOM assertions, the public API, or signal inspection. A recorded baseline
 * lets us lint the specs without pretending the existing casts are gone, while
 * making every new white-box cast a failing lint job. Reducing the number is
 * always fine; the cap only moves when the casts are deliberately removed.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = 78;
const pattern = /componentInstance\s+as\s+any/g;

const specs = execFileSync('git', ['ls-files', 'apps/frontend/src'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file.endsWith('.spec.ts'));

let found = 0;
const byFile = new Map();

for (const file of specs) {
  const source = readFileSync(resolve(root, file), 'utf8');
  const matches = source.match(pattern)?.length ?? 0;

  if (matches > 0) {
    byFile.set(file, matches);
    found += matches;
  }
}

if (found > baseline) {
  console.error(`New white-box componentInstance casts: ${found} (baseline ${baseline}).\n`);
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${count}  ${file}`);
  }
  console.error(
    '\nPrefer DOM assertions, the public API, or signal inspection. See CONTRIBUTING.md.',
  );
  process.exit(1);
}

console.log(`White-box componentInstance casts: ${found} (baseline ${baseline}).`);
