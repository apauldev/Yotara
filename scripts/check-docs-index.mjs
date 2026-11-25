/**
 * Verify that every tracked document under `docs/` has a row in `docs/README.md`.
 *
 * The index promises to cover every document in the repository, but it listed
 * three plans while fourteen were tracked, and missed a second plan tree and
 * two standalone documents. Because the index is hand-maintained, the only
 * durable fix is to make an incomplete index a failing check.
 *
 * Scoped to top-level docs and the two plan trees. `docs/archive/` has its own
 * index, and directories under `docs/assets/` hold no documents. Only tracked
 * files count: a local, untracked draft is not part of the published index.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(root, 'docs/README.md');
const indexSource = readFileSync(indexPath, 'utf8');

const indexedPaths = [
  /^docs\/[^/]+\.md$/,
  /^docs\/plans\/[^/]+\.md$/,
  /^docs\/superpowers\/plans\/[^/]+\.md$/,
];

const tracked = execFileSync('git', ['ls-files', 'docs'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const required = tracked.filter(
  (file) => file !== 'docs/README.md' && indexedPaths.some((pattern) => pattern.test(file)),
);

if (required.length === 0) {
  console.error('No documents found under docs/. The index check is misconfigured.');
  process.exit(1);
}

// Match the full docs-relative link target, not just the basename. Two tracked
// plans already share `2026-10-15-sqlite-scaling-and-concurrency.md`; a
// basename check would accept one row as proof that both are indexed.
const missing = required
  .filter((file) => !indexSource.includes(`](${file.replace(/^docs\//, './')})`))
  .sort();

if (missing.length > 0) {
  console.error(`Documents missing from docs/README.md (${missing.length}):\n`);
  for (const file of missing) {
    console.error(`  - ${file}`);
  }
  console.error('\nAdd a row to the matching table in docs/README.md.');
  process.exit(1);
}

console.log(`docs/README.md indexes all ${required.length} tracked documents.`);
