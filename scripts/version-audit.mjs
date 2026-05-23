#!/usr/bin/env node

/**
 * Version Audit — walks every tagged release in the project's history,
 * recalculates what each version SHOULD have been (without the preMajor
 * downgrade), and compares against reality.
 *
 * Use this when:
 *   - The version has drifted from the actual work done
 *   - You want to reset the baseline after a versioning fix
 *   - You're diagnosing versioning issues
 *
 * Usage:
 *   node scripts/version-audit.mjs           # preview
 *   node scripts/version-audit.mjs --apply   # update package.json
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  const result = execSync(cmd, { encoding: 'utf-8', ...opts });
  return result == null ? '' : result.trim();
}

function subject(raw) {
  return raw.split('\n')[0] ?? '';
}

/** Classify a single commit message. */
function classify(msg) {
  const subj = subject(msg);
  const body = msg;

  const isBreaking =
    /^BREAKING\s+CHANGE[:\s]/im.test(body) ||
    /^BREAKING[:\s]/im.test(body) ||
    /^[a-zA-Z]+(\([^)]*\))?!:/i.test(subj);

  if (isBreaking) return 'major';

  const match = subj.match(/^([a-zA-Z]+)(\([^)]*\))?!?:/);
  const type = match ? match[1].toLowerCase() : null;

  if (type === 'feat' || type === 'feature') return 'minor';
  if (type === 'fix') return 'patch';

  return 'patch';
}

function bumpLevel(type) {
  if (type === 'major') return 0;
  if (type === 'minor') return 1;
  return 2;
}

function applyBump(ver, type) {
  const [maj, min, pat] = ver;
  switch (type) {
    case 'major':
      return [maj + 1, 0, 0];
    case 'minor':
      return [maj, min + 1, 0];
    default:
      return [maj, min, pat + 1];
  }
}

function formatVer(ver) {
  return `${ver[0]}.${ver[1]}.${ver[2]}`;
}

// ---------------------------------------------------------------------------
// 1. Gather all tags in order
// ---------------------------------------------------------------------------

const rawTags = run('git tag -l "v*" --sort=version:refname');
const allTags = rawTags ? rawTags.split('\n') : [];

if (allTags.length < 2) {
  console.log('ℹ️  Need at least two tags to compare — nothing to audit.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Walk each tag range
// ---------------------------------------------------------------------------

// Baseline: the first tag is taken as truth for the starting version.
// Every subsequent range is recalculated without preMajor downgrade.
const firstTag = allTags[0];
const firstActual = firstTag.replace('v', '').split('.').map(Number);
let correctVer = [...firstActual];

const rows = [];

for (let i = 1; i < allTags.length; i++) {
  const tagPrev = allTags[i - 1];
  const tagCurr = allTags[i];
  const actualVer = tagCurr.replace('v', '').split('.').map(Number);

  const range = `${tagPrev}..${tagCurr}`;
  const rawLog = run(`git log "${range}" --format="---COMMIT---%n%B" --no-merges`, {
    maxBuffer: 10 * 1024 * 1024,
  });

  const commits = rawLog
    ? rawLog
        .split('---COMMIT---')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  let rangeBump = 'patch';
  for (const c of commits) {
    const cBump = classify(c);
    if (bumpLevel(cBump) < bumpLevel(rangeBump)) {
      rangeBump = cBump;
    }
  }

  const nextCorrect = applyBump(correctVer, rangeBump);
  const correctStr = formatVer(nextCorrect);
  const actualStr = formatVer(actualVer);

  rows.push({
    tag: tagCurr,
    commits: commits.length,
    bump: rangeBump,
    correct: correctStr,
    actual: actualStr,
    match: correctStr === actualStr ? '✓' : '✗',
  });

  correctVer = nextCorrect;
}

// Unreleased commits after the last tag
const lastTag = allTags[allTags.length - 1];
const headLog = run(`git log "${lastTag}..HEAD" --format="---COMMIT---%n%B" --no-merges`, {
  maxBuffer: 10 * 1024 * 1024,
});
const headCommits = headLog
  ? headLog
      .split('---COMMIT---')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

let headBump = null;
for (const c of headCommits) {
  const cBump = classify(c);
  if (headBump === null || bumpLevel(cBump) < bumpLevel(headBump)) {
    headBump = cBump;
  }
}
const suggestedVersion = headBump
  ? formatVer(applyBump(correctVer, headBump))
  : formatVer(correctVer);

// ---------------------------------------------------------------------------
// 3. Print report
// ---------------------------------------------------------------------------

const currentVersion = JSON.parse(readFileSync('./package.json', 'utf-8')).version;

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  Version Audit Report');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`  Baseline      : ${firstTag} (first tag, taken as starting point)`);
console.log(`  Tags scanned  : ${allTags.length}`);
console.log(`  Unreleased    : ${headCommits.length} commit(s) since ${lastTag}`);
console.log(`  Current       : ${currentVersion}`);
console.log(`  Suggested     : ${suggestedVersion}`);
console.log('');
console.log(
  '  Tag'.padEnd(14) +
    'C'.padEnd(5) +
    'Bump'.padEnd(10) +
    'Should be'.padEnd(14) +
    'Actual'.padEnd(14) +
    'Match',
);
console.log('  ' + '─'.repeat(61));

let mismatches = 0;
for (const r of rows) {
  if (r.match === '✗') mismatches++;
  const marker = r.match === '✗' ? '  ◄' : '';
  console.log(
    `  ${r.tag.padEnd(12)}` +
      `${String(r.commits).padEnd(4)}` +
      `${r.bump.padEnd(10)}` +
      `${r.correct.padEnd(12)}` +
      `${r.actual.padEnd(12)}` +
      `${r.match}${marker}`,
  );
}

console.log('  ' + '─'.repeat(61));
console.log('');
console.log(`  Mismatched    : ${mismatches} / ${rows.length} releases`);
console.log('');

// ---------------------------------------------------------------------------
// 4. Summary
// ---------------------------------------------------------------------------

if (mismatches > 0 || suggestedVersion !== currentVersion) {
  console.log('  ⚠️  Version has drifted. To fix:');
  console.log(`     node scripts/version-audit.mjs --apply`);
  console.log('');
  console.log(`     (sets package.json to ${suggestedVersion})`);
} else {
  console.log('  ✓ Version is aligned with all commits.');
}

// ---------------------------------------------------------------------------
// 5. Apply
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes('--apply')) {
  if (suggestedVersion === currentVersion) {
    console.log('  Nothing to change.');
    process.exit(0);
  }

  const pkgPath = './package.json';
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.version = suggestedVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  console.log(`  ✅ package.json: ${currentVersion} → ${suggestedVersion}`);
  console.log('');
  console.log('  Next:');
  console.log(`    git add package.json`);
  console.log(`    git commit -m "chore: align version to ${suggestedVersion}"`);
  console.log(`    git tag v${suggestedVersion}`);
  console.log(`    git push --follow-tags origin main`);
}

console.log('');
