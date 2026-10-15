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
  findImageVersionLine,
  parseDeployArgs,
  buildComposeCommand,
  isValidComposeProjectName,
  isValidDockerImageName,
  releaseCheckFailure,
  classifyDockerTagResponse,
  pollUntilReady,
  selectRollbackBackup,
  composeBackupStamp,
  selectDbBackupForRollback,
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

test('image repository validation accepts registry hostnames and rejects shell syntax', () => {
  assert.equal(isValidDockerImageName('registry.example.com:5000/team/api-image'), true);
  assert.equal(isValidDockerImageName('apauldev2/yotara-api'), true);
  assert.equal(isValidDockerImageName('registry.example.com/team/api;touch /tmp/pwned'), false);
  assert.equal(isValidComposeProjectName('ubuntu'), true);
  assert.equal(isValidComposeProjectName('bad project'), false);
});

test('buildComposeCommand pins project, file, and working directory', () => {
  assert.equal(
    buildComposeCommand({
      composeDir: '/home/ubuntu app',
      project: 'ubuntu',
      composeFile: '/home/ubuntu app/docker-compose.hub.yml',
    }),
    "cd '/home/ubuntu app' && docker compose --project-name 'ubuntu' -f '/home/ubuntu app/docker-compose.hub.yml'",
  );
});

test('buildTagBumpScript escapes version and registry image regex characters', () => {
  const script = buildTagBumpScript({
    current: 'v0.79.2',
    target: 'v0.79.3',
    apiImage: 'registry.example.com/team/yotara-api',
    frontendImage: 'registry.example.com/team/yotara-frontend',
  });
  assert.ok(script.includes('registry\\.example\\.com/team/yotara-api:v0\\.79\\.2'));
  assert.ok(script.includes('registry\\.example\\.com/team/yotara-frontend:v0\\.79\\.3'));
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

test('parseDeployedVersion extracts only the exact API image tag', () => {
  assert.equal(parseDeployedVersion(`    image: ${API_IMAGE}:v0.79.3`, API_IMAGE), 'v0.79.3');
  assert.equal(parseDeployedVersion(`    image: ${FRONTEND_IMAGE}:v0.79.3`, API_IMAGE), null);
  assert.equal(parseDeployedVersion(`    image: ${API_IMAGE}:v0.79.30`, API_IMAGE), 'v0.79.30');
  assert.equal(parseDeployedVersion(`    image: ${API_IMAGE}:v0.79.3-extra`, API_IMAGE), null);
  assert.equal(parseDeployedVersion(`    image: ${API_IMAGE}:v0.79.3junk`, API_IMAGE), null);
  assert.equal(parseDeployedVersion('', API_IMAGE), null);
});

test('findImageVersionLine matches the full image repository before its tag', () => {
  const lines = [
    '    image: registry.example.com/team/yotara-api-frontend:v0.79.3',
    '    image: registry.example.com/team/yotara-api:v0.79.2',
  ];
  assert.equal(findImageVersionLine(lines, 'registry.example.com/team/yotara-api'), lines[1]);
  assert.equal(
    findImageVersionLine(lines, 'registry.example.com/team/yotara-api-frontend'),
    lines[0],
  );
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

test('parseDeployArgs accepts documented flags and maps dry-run to check mode', () => {
  assert.deepEqual(parseDeployArgs(['--version', 'v1.2.3', '--yes', '--no-backup']), {
    version: 'v1.2.3',
    check: false,
    yes: true,
    noBackup: true,
    force: false,
    rollback: false,
    restoreDb: false,
    host: undefined,
    help: false,
  });
  assert.equal(parseDeployArgs(['--dry-run']).check, true);
  assert.equal(parseDeployArgs(['--check']).check, true);
});

test('parseDeployArgs tolerates the separator forwarded by `pnpm run deploy -- ...`', () => {
  assert.deepEqual(parseDeployArgs(['--', '--version', 'v1.2.3', '--yes']), {
    version: 'v1.2.3',
    check: false,
    yes: true,
    noBackup: false,
    force: false,
    rollback: false,
    restoreDb: false,
    host: undefined,
    help: false,
  });
  assert.equal(parseDeployArgs(['--', '--restore-db', '--rollback']).restoreDb, true);
});

test('parseDeployArgs rejects unknown flags, positionals, and missing values', () => {
  assert.throws(() => parseDeployArgs(['--versoin', 'v1.2.3']), {
    code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION',
  });
  assert.throws(() => parseDeployArgs(['unexpected']), {
    code: 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL',
  });
  assert.throws(() => parseDeployArgs(['--version']), {
    code: 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE',
  });
});

test('releaseCheckFailure requires a verifiable GitHub Release', () => {
  assert.equal(releaseCheckFailure(0, 'v1.2.3'), null);
  assert.match(releaseCheckFailure(1, 'v1.2.3'), /could not be verified/);
  assert.match(releaseCheckFailure(null, 'v1.2.3'), /could not be verified/);
});

test('classifyDockerTagResponse distinguishes published, missing, and Hub errors', () => {
  assert.equal(classifyDockerTagResponse(200), 'published');
  assert.equal(classifyDockerTagResponse(299), 'published');
  assert.equal(classifyDockerTagResponse(404), 'missing');
  assert.equal(classifyDockerTagResponse(429), 'error');
  assert.equal(classifyDockerTagResponse(503), 'error');
});

test('pollUntilReady retries transient failures and returns eventual success', async () => {
  let probes = 0;
  let delays = 0;
  const result = await pollUntilReady({
    attempts: 4,
    probe: async () => ({ ready: ++probes === 3, status: probes === 3 ? 0 : 1 }),
    delay: async () => {
      delays += 1;
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.attempts, 3);
  assert.equal(delays, 2);
});

test('pollUntilReady returns the last failed probe after its bounded attempts', async () => {
  let probes = 0;
  const result = await pollUntilReady({
    attempts: 3,
    probe: async () => ({ ready: false, status: ++probes, stderr: 'starting' }),
    delay: async () => {},
  });
  assert.equal(result.ready, false);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.result, { ready: false, status: 3, stderr: 'starting' });
});

test('pollUntilReady also stops when its elapsed-time deadline expires', async () => {
  let time = 0;
  let probes = 0;
  const result = await pollUntilReady({
    attempts: 60,
    timeoutMs: 2500,
    now: () => time,
    probe: async () => {
      probes += 1;
      return { ready: false };
    },
    delay: async (ms) => {
      time += ms;
    },
  });
  assert.equal(result.ready, false);
  assert.equal(result.attempts, 3);
  assert.equal(probes, 3);
});

test('resolveTargetVersion validates and normalizes every target source', () => {
  assert.deepEqual(resolveTargetVersion({ override: 'v1.2.3', sortedTags: ['v0.1.0'] }), {
    version: 'v1.2.3',
    source: 'override',
  });
  assert.deepEqual(resolveTargetVersion({ override: '1.2.3' }), {
    version: 'v1.2.3',
    source: 'override',
  });
  assert.deepEqual(resolveTargetVersion({ describeResult: 'v0.79.3\n', sortedTags: [] }), {
    version: 'v0.79.3',
    source: 'describe',
  });
  assert.deepEqual(resolveTargetVersion({ describeResult: '0.79.3\n' }), {
    version: 'v0.79.3',
    source: 'describe',
  });
  assert.deepEqual(resolveTargetVersion({ sortedTags: ['v0.79.3', 'v0.78.0'] }), {
    version: 'v0.79.3',
    source: 'tag-list',
  });
  assert.throws(() => resolveTargetVersion({ override: 'banana' }), /Invalid version/);
  assert.throws(
    () => resolveTargetVersion({ describeResult: 'v0.79.3-rc.1' }),
    /Invalid version from describe/,
  );
  assert.throws(
    () => resolveTargetVersion({ sortedTags: ['v0.79.3-rc.1'] }),
    /Invalid version from tag-list/,
  );
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

test('selectRollbackBackup picks newest older backup with a distinct deployed version', () => {
  const backups = [
    { name: 'docker-compose.hub.yml.bak.2026-10-10T100000Z', version: 'v0.79.1' },
    { name: 'docker-compose.hub.yml.bak.2026-10-11T060000Z', version: 'v0.79.2' },
    { name: 'docker-compose.hub.yml.bak.2026-10-11T061200Z', version: 'v0.79.3' },
  ];
  assert.equal(
    selectRollbackBackup(backups, '2026-10-11T061358Z', 'v0.79.3'),
    'docker-compose.hub.yml.bak.2026-10-11T060000Z',
  );
});

test('selectRollbackBackup skips same-version snapshots left by failed pulls or forced deploys', () => {
  const backups = [
    { name: 'compose.bak.2026-10-11T061200Z', version: 'v0.79.3' },
    { name: 'compose.bak.invalid', version: 'v0.79.2' },
    { name: 'compose.bak.20261011T060000Z', version: 'v0.79.2' },
    { name: 'compose.bak.2026-10-11T060000Z', version: null },
  ];
  assert.equal(selectRollbackBackup(backups, '2026-10-11T061358Z', 'v0.79.3'), null);
  assert.equal(selectRollbackBackup([], '2026-10-11T061358Z', 'v0.79.3'), null);
});

test('selectRollbackBackup makes rollback reversible between distinct versions', () => {
  const snapshots = [
    { name: 'compose.bak.2026-10-11T050000Z', version: 'v0.79.1' },
    { name: 'compose.bak.2026-10-11T060000Z', version: 'v0.79.2' },
  ];
  assert.equal(
    selectRollbackBackup(snapshots, '2026-10-11T061000Z', 'v0.79.2'),
    'compose.bak.2026-10-11T050000Z',
  );
  assert.equal(
    selectRollbackBackup(snapshots, '2026-10-11T061500Z', 'v0.79.1'),
    'compose.bak.2026-10-11T060000Z',
  );
});

test('composeBackupStamp reads fixed-width UTC stamps and rejects other names', () => {
  assert.equal(
    composeBackupStamp('docker-compose.hub.yml.bak.2026-10-15T113544Z'),
    '2026-10-15T113544Z',
  );
  assert.equal(composeBackupStamp('compose.bak.invalid'), null);
  assert.equal(composeBackupStamp('docker-compose.hub.yml'), null);
});

test('selectDbBackupForRollback picks the newest snapshot older than the compose backup', () => {
  const names = [
    'yotara-latest.db',
    'yotara-2026-10-14T090000Z.db',
    'yotara-2026-10-15T113544Z.db',
    'yotara-2026-10-15T113544Z.db.sha256',
    'yotara-not-a-stamp.db',
    'yotara-2026-10-15T120000Z.db',
  ];
  // The chosen compose backup was taken at 113545Z, moments after the DB backup
  // from the same deploy; the 12:00 snapshot is newer and must not be picked.
  assert.equal(
    selectDbBackupForRollback(names, '2026-10-15T113545Z'),
    'yotara-2026-10-15T113544Z.db',
  );
  assert.equal(selectDbBackupForRollback(names, '2026-10-14T085959Z'), null);
  assert.equal(selectDbBackupForRollback(names, 'not-a-stamp'), null);
  assert.equal(selectDbBackupForRollback([], '2026-10-15T113545Z'), null);
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
