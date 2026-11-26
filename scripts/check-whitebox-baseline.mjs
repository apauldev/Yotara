/**
 * Cap white-box `componentInstance as any` casts in frontend specs.
 *
 * CONTRIBUTING.md asks tests to stay at the boundary they want to keep stable:
 * DOM assertions, the public API, or signal inspection. A recorded baseline
 * lets us lint the specs without pretending the existing casts are gone, while
 * making every new white-box cast a failing lint job. Reducing the number is
 * always fine; the cap only moves when the casts are deliberately removed.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = resolve(root, 'apps/frontend/src');
const baseline = 78;
const pattern = /componentInstance\s+as\s+any/g;

// Walk the working tree, not `git ls-files`, so a brand-new spec cannot bypass
// the guard just because it has not been staged yet.
function findSpecs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return findSpecs(path);
    }

    return entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

let found = 0;
const byFile = new Map();

for (const path of findSpecs(srcRoot)) {
  const source = readFileSync(path, 'utf8');
  // Normalize redundant parentheses so `(fixture.componentInstance) as any`
  // cannot slip past the same check as `fixture.componentInstance as any`.
  const normalized = source.replace(
    /\(\s*(fixture\.componentInstance|componentInstance)\s*\)/g,
    '$1',
  );
  const matches = normalized.match(pattern)?.length ?? 0;

  if (matches > 0) {
    byFile.set(relative(root, path), matches);
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
