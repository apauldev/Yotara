#!/usr/bin/env node

/**
 * Custom release script for Yotara.
 *
 * Replaces raw `commit-and-tag-version` because the default tool enables a
 * `preMajor` downgrade when version < 1.0.0, converting every `feat:` into a
 * patch bump instead of minor.
 *
 * This script:
 *   1. Reads ALL commits since the last tag (traversing merged branches).
 *   2. Analyses them for conventional-commit types.
 *   3. Determines the correct semver bump — WITHOUT the preMajor downgrade.
 *   4. Delegates to `commit-and-tag-version --release-as <type>` for the
 *      actual changelog generation, commit, and tagging.
 *
 * Usage:
 *   node scripts/release.mjs            # real release
 *   node scripts/release.mjs --dry-run  # preview only
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');

if (dryRun) {
  console.log('═══════════════════════════════════════════');
  console.log('  DRY RUN — no files will be changed');
  console.log('═══════════════════════════════════════════\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  const result = execSync(cmd, { encoding: 'utf-8', ...opts });
  return result == null ? '' : result.trim();
}

/** Extract the subject (first line) from a raw commit message. */
function subject(raw) {
  return raw.split('\n')[0] ?? '';
}

// ---------------------------------------------------------------------------
// 1. Find the latest version tag
// ---------------------------------------------------------------------------

let latestTag;
try {
  latestTag = run('git describe --tags --abbrev=0 --match "v*"');
} catch {
  latestTag = null;
}

if (!latestTag) {
  console.log('ℹ️  No previous version tag found — this looks like a first release.');
}

// ---------------------------------------------------------------------------
// 2. Get all commit messages since that tag
// ---------------------------------------------------------------------------

// Format: full body (%B) followed by a unique delimiter + hash.
// Using git log's default traversal (both parents in merges) so commits
// from merged feature branches are included.
const delimiter = '---␞YOTARA␞---';
const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';

const rawLog = run(`git log "${range}" --format="${delimiter}%n%B" --no-merges`, {
  maxBuffer: 10 * 1024 * 1024,
});

// Split on delimiter, drop empty entries at the start
const rawCommits = rawLog
  .split(delimiter)
  .map((s) => s.trim())
  .filter(Boolean);

if (rawCommits.length === 0) {
  console.log('ℹ️  No new commits since last release — nothing to bump.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 3. Classify each commit
//
// commitlint now enforces standard conventional-commit types on new commits,
// but older commits (pre-commitlint) used non-standard prefixes like:
//   Fixed:, Fix:, misc:, bug:, refactor:
// They all safely fall through to the default "patch" bump below.
// ---------------------------------------------------------------------------

let hasBreaking = false;
let hasFeat = false;
let hasFix = false;

for (const msg of rawCommits) {
  const subj = subject(msg);
  const body = msg; // full message including subject

  // --- BREAKING CHANGE detection ---
  // (a) "BREAKING CHANGE:" or "BREAKING:" in the body
  // (b) "feat!:" or "feat(scope)!:" — the ! before the colon
  const isBreaking =
    /^BREAKING\s+CHANGE[:\s]/im.test(body) ||
    /^BREAKING[:\s]/im.test(body) ||
    /^[a-zA-Z]+(\([^)]*\))?!:/i.test(subj);

  if (isBreaking) {
    hasBreaking = true;
  }

  // --- type detection ---
  // Match conventional-commit type prefixes: feat, fix, etc.
  const match = subj.match(/^([a-zA-Z]+)(\([^)]*\))?!?:/);
  const type = match ? match[1].toLowerCase() : null;

  if (type === 'feat' || type === 'feature') {
    hasFeat = true;
  } else if (type === 'fix') {
    hasFix = true;
  }
}

// ---------------------------------------------------------------------------
// 4. Determine the correct bump type
// ---------------------------------------------------------------------------
//
// The official `conventional-changelog-conventionalcommits` preset enables a
// `preMajor` flag when version < 1.0.0, which downgrades every bump:
//   major → minor,  minor → patch.
//
// Since we want standard semver behaviour (feat = minor, breaking = major)
// even during pre-1.0 development, we detect the bump WITHOUT that downgrade.

let bumpType;
if (hasBreaking) {
  bumpType = 'major';
} else if (hasFeat) {
  bumpType = 'minor';
} else {
  // Default: patch. This covers fix, docs, refactor, chore, etc.
  bumpType = 'patch';
}

// ---------------------------------------------------------------------------
// 5. Pre-flight summary
// ---------------------------------------------------------------------------

const currentVersion = JSON.parse(readFileSync('./package.json', 'utf-8')).version;
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Yotara Release');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Current version   ${currentVersion}`);
console.log(`  Latest tag        ${latestTag || '(none)'}`);
console.log(`  Commits analysed  ${rawCommits.length}`);
console.log(`  Breaking changes  ${hasBreaking ? '⚠️  YES' : 'no'}`);
console.log(`  Features          ${hasFeat ? '✨ YES' : 'no'}`);
console.log(`  Fixes             ${hasFix ? '🔧 YES' : 'no'}`);
console.log(`  ───────────────────────────────────`);
console.log(`  → Bump type:      ${bumpType}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ---------------------------------------------------------------------------
// 6. Delegate to commit-and-tag-version
// ---------------------------------------------------------------------------

const dryRunFlag = dryRun ? ' --dry-run' : '';
const cmd = `npx --no-install commit-and-tag-version --release-as ${bumpType}${dryRunFlag}`;

try {
  run(cmd, { stdio: 'inherit' });
  if (!dryRun) {
    console.log(`✅ Release complete: ${bumpType} bump applied.`);
  }
} catch (err) {
  console.error('❌ Release failed:', err.message);
  process.exit(1);
}
