#!/usr/bin/env node

/**
 * Semi-automated beta deploy for Yotara.
 *
 * Verifies that a merged + released version is fully published (CI green,
 * images on Docker Hub), then deploys it to the beta EC2 over SSH: DB backup,
 * compose bump, pull, restart frontend-first, verify. Prints a rollback command.
 *
 * It never merges, tags, or releases, and `--check` never mutates anything.
 *
 * Usage:
 *   node scripts/deploy.mjs [--version vX.Y.Z] [--check] [--yes] [--no-backup]
 *                           [--force] [--rollback] [--host <ssh-alias>]
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

import {
  backupSucceeded,
  buildComposeCommand,
  buildTagBumpScript,
  classifyCiRuns,
  findImageVersionLine,
  normalizeLineEndings,
  parseDeployArgs,
  parseDeployedImageVersions,
  releaseCheckFailure,
  parseDeployedVersion,
  pollUntilReady,
  pullWithComposeRestore,
  isValidComposeProjectName,
  isValidDockerImageName,
  resolveTargetVersion,
  selectRollbackBackup,
  shellQuote,
} from './deploy-logic.mjs';

const BACKUP_SCRIPT = new URL('./ec2-backup.sh', import.meta.url);

const config = {
  host: process.env['DEPLOY_HOST'] || 'yotara',
  composeFile: process.env['DEPLOY_COMPOSE_FILE'] || '/home/ubuntu/docker-compose.hub.yml',
  composeDir: process.env['DEPLOY_COMPOSE_DIR'] || '/home/ubuntu',
  project: process.env['DEPLOY_PROJECT'] || 'ubuntu',
  apiImage: process.env['DEPLOY_API_IMAGE'] || 'apauldev2/yotara-api',
  frontendImage: process.env['DEPLOY_FRONTEND_IMAGE'] || 'apauldev2/yotara-frontend',
  healthUrl: process.env['DEPLOY_HEALTH_URL'] || 'https://beta.yotara.website/api/health',
  ghRepo: process.env['DEPLOY_GH_REPO'] || 'apauldev/Yotara',
  sshOpts: (process.env['DEPLOY_SSH_OPTS'] || '-o BatchMode=yes -o ConnectTimeout=15')
    .split(/\s+/)
    .filter(Boolean),
};

const FIRST_DEPLOY_MESSAGE =
  `Compose not found or not version-pinned at ${config.composeFile}. ` +
  'Deploy once by hand (or pin the image tags), then re-run.';

function validateConfig() {
  for (const [name, image] of [
    ['DEPLOY_API_IMAGE', config.apiImage],
    ['DEPLOY_FRONTEND_IMAGE', config.frontendImage],
  ]) {
    if (!isValidDockerImageName(image)) {
      die(`${name} is not a supported Docker image repository: ${image}`);
    }
  }
  if (!isValidComposeProjectName(config.project)) {
    die(`DEPLOY_PROJECT is not a valid Compose project name: ${config.project}`);
  }
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(config.ghRepo)) {
    die(`DEPLOY_GH_REPO must be an owner/repository pair: ${config.ghRepo}`);
  }
  try {
    const healthUrl = new URL(config.healthUrl);
    if (!['http:', 'https:'].includes(healthUrl.protocol)) {
      throw new Error('unsupported protocol');
    }
  } catch {
    die(`DEPLOY_HEALTH_URL must be a valid HTTP(S) URL: ${config.healthUrl}`);
  }
}

function composeCommand() {
  return buildComposeCommand({
    composeDir: config.composeDir,
    project: config.project,
    composeFile: config.composeFile,
  });
}

// ---------------------------------------------------------------------------
// Output + process helpers
// ---------------------------------------------------------------------------

const out = (message = '') => process.stdout.write(`${message}\n`);
const step = (message) => out(`\n▸ ${message}`);
const ok = (message) => out(`  ✓ ${message}`);
const warn = (message) => out(`  ! ${message}`);
const info = (message) => out(`    ${message}`);

function die(message, code = 1) {
  process.stderr.write(`\n✖ ${message}\n`);
  process.exit(code);
}

function execFile(file, args) {
  return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function ssh(command, timeout = 0) {
  const res = spawnSync('ssh', [...config.sshOpts, config.host, command], {
    encoding: 'utf8',
    ...(timeout ? { timeout } : {}),
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function sshWithInput(command, input) {
  const res = spawnSync('ssh', [...config.sshOpts, config.host, command], {
    encoding: 'utf8',
    input,
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function utcStamp() {
  return new Date()
    .toISOString()
    .replace(/:/g, '')
    .replace(/\.\d+Z$/, 'Z');
}

function remoteOk(command) {
  return ssh(command).status === 0;
}

function assertRemote(label, command) {
  const res = ssh(command);
  if (res.status !== 0) {
    die(`${label} failed on ${config.host}:\n${(res.stderr || res.stdout).trim()}`);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Phases 1–4 (read-only)
// ---------------------------------------------------------------------------

function resolveTarget(args) {
  step('Resolving target version');
  let fetchError = null;
  try {
    execFile('git', [
      'fetch',
      '--tags',
      '--force',
      'origin',
      '+refs/heads/main:refs/remotes/origin/main',
    ]);
  } catch (error) {
    fetchError = error;
  }

  if (args.version) {
    if (fetchError) {
      warn(
        `git fetch failed; checking the explicit version against local tags: ${fetchError.message}`,
      );
    }
    try {
      const resolved = resolveTargetVersion({ override: args.version });
      ok(`target ${resolved.version} (source: ${resolved.source})`);
      return resolved.version;
    } catch (error) {
      die(error.message);
    }
  }

  if (fetchError) {
    die(
      `Could not fetch origin/main and tags; refusing to select a potentially stale release: ${fetchError.message}`,
    );
  }

  let describeResult = null;
  try {
    describeResult = execFile('git', [
      'describe',
      '--tags',
      '--abbrev=0',
      'origin/main',
      '--match',
      'v*',
    ]);
  } catch {
    /* no reachable tag — fall back to the tag list */
  }

  let sortedTags = [];
  if (!describeResult) {
    try {
      sortedTags = execFile('git', ['tag', '--list', 'v*', '--sort=-v:refname'])
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      /* no tags at all */
    }
  }

  let resolved;
  try {
    resolved = resolveTargetVersion({ describeResult, sortedTags });
  } catch (error) {
    die(error.message);
  }

  ok(`target ${resolved.version} (source: ${resolved.source})`);
  return resolved.version;
}

function verifyBuild(version) {
  step(`Verifying the build (CI) for ${version}`);
  let releaseCommit;
  try {
    releaseCommit = execFile('git', ['rev-parse', `${version}^{commit}`]);
  } catch {
    die(`Tag ${version} not found locally (run: git fetch --tags).`);
  }
  let ciSha;
  try {
    ciSha = execFile('git', ['rev-parse', `${releaseCommit}^`]);
  } catch {
    die(`Tag ${version} has no parent commit to verify CI against.`);
  }
  info(`release commit ${releaseCommit.slice(0, 7)}, CI commit ${ciSha.slice(0, 7)}`);

  let runs = [];
  try {
    runs = JSON.parse(
      execFile('gh', [
        'run',
        'list',
        '--workflow',
        'ci.yml',
        '--commit',
        ciSha,
        '--limit',
        '3',
        '--json',
        'conclusion,url',
      ]),
    );
  } catch (error) {
    die(`Could not list CI runs via gh: ${error.message}`);
  }

  const result = classifyCiRuns(runs);
  if (result.status === 'success') {
    ok('CI succeeded');
    return;
  }
  if (result.status === 'in-progress') {
    die(`CI is still running on ${ciSha.slice(0, 7)}; re-run shortly.`, 3);
  }
  if (result.status === 'failed') {
    die(`CI failed${result.url ? `: ${result.url}` : ''}`);
  }
  die(`No CI run found for ${ciSha.slice(0, 7)} (is the commit on main?)`);
}

async function verifyDocker(version) {
  step(`Verifying Docker images for ${version}`);
  const releaseStatus = spawnSync('gh', [
    'api',
    `repos/${config.ghRepo}/releases/tags/${version}`,
    '--silent',
  ]).status;
  const releaseFailure = releaseCheckFailure(releaseStatus, version);
  if (releaseFailure) {
    die(releaseFailure);
  }
  ok(`GitHub Release ${version} exists`);

  const missing = [];
  for (const image of [config.apiImage, config.frontendImage]) {
    const imagePath = image.split('/').map(encodeURIComponent).join('/');
    const url = `https://hub.docker.com/v2/repositories/${imagePath}/tags/${encodeURIComponent(version)}/`;
    let present = false;
    try {
      const res = await fetch(url);
      present = res.ok;
    } catch (error) {
      die(`Docker Hub request failed for ${image}: ${error.message}`);
    }
    if (present) {
      ok(`${image}:${version} published`);
    } else {
      missing.push(`${image}:${version}`);
    }
  }

  if (missing.length > 0) {
    die(`Docker images not published yet:\n  - ${missing.join('\n  - ')}`);
  }
}

function readDeployedVersions() {
  const res = ssh(
    `grep -F -e ${shellQuote(`${config.apiImage}:`)} -e ${shellQuote(`${config.frontendImage}:`)} ${shellQuote(config.composeFile)}`,
  );
  const lines = res.stdout.split('\n');
  return parseDeployedImageVersions({
    apiLine: findImageVersionLine(lines, config.apiImage),
    frontendLine: findImageVersionLine(lines, config.frontendImage),
    apiImage: config.apiImage,
    frontendImage: config.frontendImage,
  });
}

function preflight(version, args) {
  step(`Preflight against ${config.host}`);
  if (!remoteOk('true')) {
    die(`Cannot reach ${config.host} over ssh (check the alias/keys).`);
  }
  ok(`ssh ${config.host} reachable`);

  const { apiVersion, frontendVersion } = readDeployedVersions();
  if (!apiVersion || !frontendVersion) {
    die(
      `Compose must pin both ${config.apiImage} and ${config.frontendImage} to version tags. ` +
        'Deploy once by hand (or pin both image tags), then re-run.',
    );
  }
  if (apiVersion !== frontendVersion) {
    die(
      `Compose image tags differ: API is ${apiVersion}, frontend is ${frontendVersion}. ` +
        'Align both tags before deploying.',
    );
  }
  const current = apiVersion;
  ok(`deployed: ${current}`);

  if (current === version && !args.force) {
    out(`\nAlready on ${version} on ${config.host}. Nothing to do.`);
    process.exit(0);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Phase 5 — DB backup
// ---------------------------------------------------------------------------

function takeBackup(args) {
  if (args.noBackup) {
    warn('Skipping DB backup (--no-backup)');
    return null;
  }
  step('Taking a WAL-safe DB backup');
  const script = normalizeLineEndings(readFileSync(BACKUP_SCRIPT, 'utf8'));
  const upload = sshWithInput('cat > /tmp/yotara-backup.sh', script);
  if (upload.status !== 0) {
    die(`Could not upload the backup script: ${upload.stderr.trim()}`);
  }

  const res = ssh('RETENTION_DAYS=0 bash /tmp/yotara-backup.sh');
  if (!backupSucceeded(`${res.stdout}\n${res.stderr}`)) {
    die(`DB backup failed — aborting before any change.\n\n${res.stdout}${res.stderr}`);
  }

  const match = res.stdout.match(/->\s+(\S+\.db)/);
  const path = match ? match[1] : '(see /opt/backups)';
  ok(`backup ok: ${path}`);
  return path;
}

// ---------------------------------------------------------------------------
// Phase 6 — deploy
// ---------------------------------------------------------------------------

function bumpAndRestart(fromVersion, toVersion) {
  step(`Bumping ${fromVersion} -> ${toVersion} and restarting`);
  const stamp = utcStamp();
  assertRemote(
    'compose backup',
    `cp ${shellQuote(config.composeFile)} ${shellQuote(`${config.composeFile}.bak.${stamp}`)}`,
  );

  const sedExpr = buildTagBumpScript({
    current: fromVersion,
    target: toVersion,
    apiImage: config.apiImage,
    frontendImage: config.frontendImage,
  });
  assertRemote('tag bump', `sed -i ${shellQuote(sedExpr)} ${shellQuote(config.composeFile)}`);

  const bumpedVersions = readDeployedVersions();
  if (bumpedVersions.apiVersion !== toVersion || bumpedVersions.frontendVersion !== toVersion) {
    die(`Tag bump did not take effect (compose still not pinned to ${toVersion}).`);
  }
  ok(`compose pinned to ${toVersion}`);

  const compose = composeCommand();
  const pullResult = pullWithComposeRestore({
    pull: () => ssh(`${compose} pull`).status === 0,
    restore: () =>
      ssh(
        `cp ${shellQuote(`${config.composeFile}.bak.${stamp}`)} ${shellQuote(config.composeFile)}`,
      ).status === 0,
  });
  if (!pullResult.pulled) {
    if (pullResult.restored) {
      die(
        'docker compose pull failed; restored the previous compose file. No services were restarted.',
      );
    }
    die(
      'docker compose pull failed and the previous compose file could not be restored. ' +
        `Restore ${config.composeFile}.bak.${stamp} to ${config.composeFile} manually. ` +
        'No services were restarted.',
    );
  }
  ok('images pulled');
  assertRemote('frontend restart (realip first)', `${compose} up -d --no-deps frontend`);
  ok('frontend up');
  assertRemote('api restart', `${compose} up -d api`);
  ok('api up');
}

// ---------------------------------------------------------------------------
// Phase 7 — verify
// ---------------------------------------------------------------------------

async function verifyStack() {
  step('Verifying the stack');
  const compose = composeCommand();
  const frontendId = ssh(`${compose} ps -q frontend`).stdout.trim();
  const apiId = ssh(`${compose} ps -q api`).stdout.trim();
  if (!frontendId || !apiId) {
    die('Could not resolve container IDs from the compose project.');
  }

  const confd = ssh(`docker exec ${frontendId} ls /etc/nginx/conf.d`);
  if (!confd.stdout.includes('realip.conf')) {
    die('realip.conf missing from the frontend image conf.d.');
  }
  ok('realip.conf present');

  assertRemote('nginx -t', `docker exec ${frontendId} nginx -t`);
  ok('nginx -t ok');

  const readiness = await pollUntilReady({
    timeoutMs: 60_000,
    probe: () => {
      const result = ssh(
        `docker exec ${shellQuote(apiId)} wget -qO- http://127.0.0.1:3000/health`,
        5000,
      );
      return {
        ready: result.status === 0 && result.stdout.includes('"status":"ok"'),
        ...result,
      };
    },
  });
  if (!readiness.ready) {
    const result = readiness.result ?? {};
    const logs = ssh(`docker logs --tail 100 ${shellQuote(apiId)}`);
    die(
      `API did not become healthy after ${readiness.attempts} attempts; services have already been restarted.\n` +
        `Last health response:\n${result.stdout ?? ''}\n${result.stderr ?? ''}\n` +
        `API logs:\n${logs.stdout}\n${logs.stderr}`,
    );
  }
  ok(`api health ok (attempt ${readiness.attempts})`);

  try {
    const res = await fetch(config.healthUrl);
    if (res.ok) {
      ok(`external health ${config.healthUrl} ok`);
    } else {
      warn(`external health ${config.healthUrl} returned ${res.status} (warn only)`);
    }
  } catch (error) {
    warn(`external health check failed: ${error.message} (warn only)`);
  }
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

async function confirm(args, fromVersion, toVersion) {
  if (args.yes) {
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) =>
    rl.question(
      `\nDeploy ${toVersion} to ${config.host} (current ${fromVersion})? [y/N] `,
      resolve,
    ),
  );
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    die('Aborted.', 1);
  }
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

async function deployFlow(args) {
  const target = resolveTarget(args);
  verifyBuild(target);
  await verifyDocker(target);
  const current = preflight(target, args);

  out('');
  out('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  out(`  Deploy ${current} -> ${target} on ${config.host}`);
  out(`  compose: ${config.composeFile}`);
  out(`  steps:   backup -> bump -> pull -> up (frontend, api) -> verify`);
  out('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (args.check) {
    out('\n--check: stopping before any mutation.');
    return;
  }

  await confirm(args, current, target);
  const backupPath = takeBackup(args);
  bumpAndRestart(current, target);
  await verifyStack();

  out('');
  out(`✓ Deployed ${target} to ${config.host}.`);
  if (backupPath) {
    out(`  DB backup: ${backupPath}`);
  }
  out(`  Rollback:  pnpm run deploy:rollback`);
}

async function rollbackFlow(args) {
  step(`Rollback preflight against ${config.host}`);
  if (!remoteOk('true')) {
    die(`Cannot reach ${config.host} over ssh (check the alias/keys).`);
  }
  const { apiVersion, frontendVersion } = readDeployedVersions();
  if (!apiVersion || !frontendVersion) {
    die(FIRST_DEPLOY_MESSAGE);
  }
  if (apiVersion !== frontendVersion) {
    die(
      `Compose image tags differ: API is ${apiVersion}, frontend is ${frontendVersion}. ` +
        'Align both tags before rolling back.',
    );
  }
  const current = apiVersion;
  ok(`deployed: ${current}`);

  const composeFileDir = config.composeFile.slice(0, config.composeFile.lastIndexOf('/')) || '.';
  const composeFileName = config.composeFile.split('/').pop();
  const listed = ssh(
    `find ${shellQuote(composeFileDir)} -maxdepth 1 -type f -name ${shellQuote(`${composeFileName}.bak.*`)} -printf '%f\\n'`,
  );
  const backups = listed.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((path) => {
      const name = path.split('/').pop();
      const backupPath = `${composeFileDir}/${name}`;
      const version = parseDeployedVersion(
        ssh(`grep -F ${shellQuote(`${config.apiImage}:`)} ${shellQuote(backupPath)}`).stdout,
        config.apiImage,
      );
      return { name, version };
    });

  const chosen = selectRollbackBackup(backups, utcStamp(), current);
  if (!chosen) {
    die(
      'No usable compose backup found. Roll back by hand: restore a ' +
        `${config.composeFile}.bak.* file and run docker compose up -d.`,
    );
  }

  const dir = config.composeFile.slice(0, config.composeFile.lastIndexOf('/') + 1);
  const chosenPath = `${dir}${chosen}`;
  const target = parseDeployedVersion(
    ssh(`grep -F ${shellQuote(`${config.apiImage}:`)} ${shellQuote(chosenPath)}`).stdout,
    config.apiImage,
  );
  if (!target) {
    die(`Could not read a version from ${chosenPath}.`);
  }

  out('');
  out('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  out(`  Rollback ${current} -> ${target} on ${config.host}`);
  out(`  from backup: ${chosen}`);
  out('  code only — the DB schema is not reverted (migrations are additive)');
  out('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (args.check) {
    out('\n--check: stopping before any mutation.');
    return;
  }

  await confirm(args, current, target);
  bumpAndRestart(current, target);
  await verifyStack();
  out(`\n✓ Rolled back to ${target} on ${config.host}.`);
  warn('DB schema was NOT reverted — code only.');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function parseCli() {
  return parseDeployArgs(process.argv.slice(2));
}

function printHelp() {
  out(`Yotara beta deploy

Usage: pnpm run deploy [flags]

Flags:
  --version vX.Y.Z   Target release (default: newest v* tag on origin/main)
  --check, --dry-run Verify only; never mutate anything
  --yes              Skip the confirmation prompt
  --no-backup        Skip the pre-deploy DB backup (not recommended)
  --force            Redeploy even if the target is already deployed
  --rollback         Re-pin to the previously deployed version
  --host <alias>     SSH alias (default ${config.host})
  --help             Show this help`);
}

async function main() {
  const args = parseCli();
  if (args.help) {
    printHelp();
    return;
  }
  validateConfig();
  if (args.host) {
    config.host = args.host;
  }
  if (args.rollback) {
    await rollbackFlow(args);
    return;
  }
  await deployFlow(args);
}

main().catch((error) => die(error.stack || error.message));
