import assert from 'node:assert/strict';
import test from 'node:test';

import {
  escapeSedRegex,
  isValidVersion,
  parseDeployedVersion,
  resolveTargetVersion,
  classifyCiRuns,
  buildTagBumpScript,
  parseDeployedImageVersions,
  selectRollbackBackup,
  backupSucceeded,
  normalizeLineEndings,
  pullWithComposeRestore,
} from './deploy-logic.mjs';

const API_IMAGE = 'apauldev2/yotara-api';
const FRONTEND_IMAGE = 'apauldev2/yotara-frontend';

test('escapeSedRegex escapes version dots and other sed metacharacters', () => {
  assert.equal(escapeSedRegex('v0.79.3'), 'v0\\.79\\.3');
  assert.equal(escapeSedRegex('a*b[c]^d$e#f\\g'), 'a\\*b\\[c\\]\\^d\\$e\\#f\\\\g');
});

test('buildTagBumpScript produces anchored sed expressions for both images', () => {
  const script = buildTagBumpScript({
    current: 'v0.79.2',
    target: 'v0.79.3',
    apiImage: API_IMAGE,
    frontendImage: FRONTEND_IMAGE,
  });
  assert.ok(
    script.includes('s#apauldev2/yotara-api:v0\\.79\\.2#apauldev2/yotara-api:v0\\.79\\.3#'),
  );
  assert.ok(
    script.includes(
      's#apauldev2/yotara-frontend:v0\\.79\\.2#apauldev2/yotara-frontend:v0\\.79\\.3#',
    ),
  );
});

test('isValidVersion accepts vX.Y.Z and X.Y.Z only', () => {
  assert.equal(isValidVersion('v0.79.3'), true);
  assert.equal(isValidVersion('0.79.3'), true);
  assert.equal(isValidVersion('v0.79'), false);
  assert.equal(isValidVersion('v0.79.3-rc.1'), false);
  assert.equal(isValidVersion(''), false);
});

test('parseDeployedVersion extracts the api tag from a compose grep line', () => {
  assert.equal(parseDeployedVersion(`    image: ${API_IMAGE}:v0.79.3`, API_IMAGE), 'v0.79.3');
  assert.equal(parseDeployedVersion(`    image: ${FRONTEND_IMAGE}:v0.79.3`, API_IMAGE), null);
  assert.equal(parseDeployedVersion('', API_IMAGE), null);
});

test('parseDeployedImageVersions reads both image tags for compose preflight', () => {
  const lines = {
    apiLine: `    image: ${API_IMAGE}:v0.79.3`,
    frontendLine: `    image: ${FRONTEND_IMAGE}:v0.79.3`,
    apiImage: API_IMAGE,
    frontendImage: FRONTEND_IMAGE,
  };
  assert.deepEqual(parseDeployedImageVersions(lines), {
    apiVersion: 'v0.79.3',
    frontendVersion: 'v0.79.3',
  });
  assert.deepEqual(
    parseDeployedImageVersions({ ...lines, frontendLine: `image: ${FRONTEND_IMAGE}:v0.79.2` }),
    { apiVersion: 'v0.79.3', frontendVersion: 'v0.79.2' },
  );
  assert.deepEqual(parseDeployedImageVersions({ ...lines, frontendLine: undefined }), {
    apiVersion: 'v0.79.3',
    frontendVersion: null,
  });
});

test('resolveTargetVersion prefers override, then describe, then tag list', () => {
  assert.deepEqual(resolveTargetVersion({ override: 'v1.2.3', sortedTags: ['v0.1.0'] }), {
    version: 'v1.2.3',
    source: 'override',
  });
  assert.deepEqual(resolveTargetVersion({ describeResult: 'v0.79.3\n', sortedTags: [] }), {
    version: 'v0.79.3',
    source: 'describe',
  });
  assert.deepEqual(resolveTargetVersion({ sortedTags: ['v0.79.3', 'v0.78.0'] }), {
    version: 'v0.79.3',
    source: 'tag-list',
  });
  assert.throws(() => resolveTargetVersion({ override: 'banana' }));
});

test('resolveTargetVersion picks the highest semver from a sorted tag list (v0.100.0 regression)', () => {
  // Assumes the caller passes tags sorted by `--sort=-v:refname` (lexicographic would break here).
  assert.equal(resolveTargetVersion({ sortedTags: ['v0.100.0', 'v0.99.0'] }).version, 'v0.100.0');
});

test('classifyCiRuns distinguishes success, in-progress, failed, missing', () => {
  assert.deepEqual(classifyCiRuns([{ conclusion: 'success', url: 'u' }]), {
    status: 'success',
    url: 'u',
  });
  assert.equal(classifyCiRuns([{ conclusion: null, url: 'u' }]).status, 'in-progress');
  const failed = classifyCiRuns([{ conclusion: 'failure', url: 'u' }]);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.url, 'u');
  assert.equal(classifyCiRuns([]).status, 'missing');
});

test('selectRollbackBackup picks the newest backup strictly older than the current deploy', () => {
  const names = [
    'docker-compose.hub.yml.bak.2026-10-10T100000Z',
    'docker-compose.hub.yml.bak.2026-10-11T060000Z',
  ];
  assert.equal(
    selectRollbackBackup(names, '2026-10-11T061358Z'),
    'docker-compose.hub.yml.bak.2026-10-11T060000Z',
  );
  assert.equal(selectRollbackBackup(['x.bak.2026-10-11T070000Z'], '2026-10-11T061358Z'), null);
  assert.equal(selectRollbackBackup([], '2026-10-11T061358Z'), null);
});

test('pullWithComposeRestore preserves the target compose when the pull succeeds', () => {
  let restored = false;
  assert.deepEqual(
    pullWithComposeRestore({
      pull: () => true,
      restore: () => {
        restored = true;
        return true;
      },
    }),
    { pulled: true, restored: false },
  );
  assert.equal(restored, false);
});

test('pullWithComposeRestore restores the previous compose when the pull fails', () => {
  let restoreCalls = 0;
  assert.deepEqual(
    pullWithComposeRestore({
      pull: () => false,
      restore: () => {
        restoreCalls += 1;
        return true;
      },
    }),
    { pulled: false, restored: true },
  );
  assert.equal(restoreCalls, 1);
});

test('pullWithComposeRestore reports when both pull and restore fail', () => {
  assert.deepEqual(pullWithComposeRestore({ pull: () => false, restore: () => false }), {
    pulled: false,
    restored: false,
  });
});

test('backupSucceeded requires the integrity_check ok marker', () => {
  assert.equal(backupSucceeded('[verify] integrity_check ok'), true);
  assert.equal(backupSucceeded('[verify] integrity_check FAILED'), false);
  assert.equal(backupSucceeded('some other output'), false);
});

test('normalizeLineEndings converts CRLF to LF', () => {
  assert.equal(normalizeLineEndings('a\r\nb\r\n'), 'a\nb\n');
  assert.equal(normalizeLineEndings('a\nb'), 'a\nb');
});
