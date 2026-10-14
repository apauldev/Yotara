import { parseArgs } from 'node:util';

/**
 * Pure helpers for the deploy driver (`scripts/deploy.mjs`).
 *
 * Everything here is side-effect free so it can be unit-tested without
 * git, ssh, gh, or the network. The driver wires these to real I/O.
 */

/** Escape the characters that are special in a sed basic-regex (BRE) search. */
export function escapeSedRegex(value) {
  return String(value).replace(/[\\.[\]^$#*]/g, '\\$&');
}

export function isValidDockerImageName(value) {
  return /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*)(?::[0-9]+)?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/.test(
    String(value),
  );
}

export function isValidComposeProjectName(value) {
  return /^[a-z0-9][a-z0-9_-]*$/.test(String(value));
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function buildComposeCommand({ composeDir, project, composeFile }) {
  return `cd ${shellQuote(composeDir)} && docker compose --project-name ${shellQuote(project)} -f ${shellQuote(composeFile)}`;
}

/** True for `vX.Y.Z` or `X.Y.Z` (no pre-release/build metadata). */
export function isValidVersion(version) {
  return /^v?\d+\.\d+\.\d+$/.test(String(version));
}

/** Escape regex metacharacters when interpolating a literal string. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pull the deployed version tag out of a `grep` line for the API image, e.g.
 *   "    image: apauldev2/yotara-api:v0.79.3" -> "v0.79.3"
 * Returns null when the line has no match (including the frontend line).
 */
export function parseDeployedVersion(grepLine, image) {
  if (!grepLine) {
    return null;
  }
  const match = String(grepLine).match(/^\s*image:\s*(\S+)\s*$/);
  if (!match) {
    return null;
  }
  const prefix = `${image}:`;
  if (!match[1].startsWith(prefix)) {
    return null;
  }
  const version = match[1].slice(prefix.length);
  return isValidVersion(version) ? version : null;
}

export function parseDeployedImageVersions({ apiLine, frontendLine, apiImage, frontendImage }) {
  return {
    apiVersion: parseDeployedVersion(apiLine, apiImage),
    frontendVersion: parseDeployedVersion(frontendLine, frontendImage),
  };
}

export function findImageVersionLine(lines, image) {
  return lines.find((line) => {
    const match = String(line).match(/^\s*image:\s*(\S+)\s*$/);
    return match?.[1].startsWith(`${image}:`);
  });
}

/**
 * Resolve the target version from (in order) an explicit override, a
 * `git describe` result, or an already-sorted tag list. Throws when nothing
 * usable is supplied or the override is malformed.
 */
export function resolveTargetVersion({ override, describeResult, sortedTags = [] } = {}) {
  if (override !== undefined && override !== null && override !== '') {
    if (!isValidVersion(override)) {
      throw new Error(`Invalid version: ${override}`);
    }
    return { version: override, source: 'override' };
  }
  if (describeResult && String(describeResult).trim() !== '') {
    return { version: String(describeResult).trim(), source: 'describe' };
  }
  if (Array.isArray(sortedTags) && sortedTags.length > 0) {
    return { version: sortedTags[0], source: 'tag-list' };
  }
  throw new Error('No target version could be resolved (no override, describe, or tags).');
}

export function parseDeployArgs(args) {
  const { values } = parseArgs({
    args,
    options: {
      version: { type: 'string' },
      check: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      'no-backup': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      rollback: { type: 'boolean', default: false },
      host: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  return {
    version: values.version,
    check: values.check || values['dry-run'],
    yes: values.yes,
    noBackup: values['no-backup'],
    force: values.force,
    rollback: values.rollback,
    host: values.host,
    help: values.help,
  };
}

export function releaseCheckFailure(status, version) {
  return status === 0 ? null : `GitHub Release ${version} could not be verified; aborting deploy.`;
}

export async function pollUntilReady({
  probe,
  attempts = 60,
  timeoutMs = 60_000,
  now = Date.now,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const deadline = now() + timeoutMs;
  let lastResult;
  let attempt = 0;
  while (attempt < attempts && now() < deadline) {
    attempt += 1;
    lastResult = await probe();
    if (lastResult.ready) {
      return { ready: true, attempts: attempt, result: lastResult };
    }
    const remainingMs = deadline - now();
    if (attempt < attempts && remainingMs > 0) {
      await delay(Math.min(1000, remainingMs));
    }
  }
  return { ready: false, attempts: attempt, result: lastResult };
}

/**
 * Classify the CI runs for a commit. `gh run list` returns newest first, so the
 * first entry wins. `conclusion: null` means the run is still going.
 */
export function classifyCiRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return { status: 'missing' };
  }
  const first = runs[0] ?? {};
  const url = first.url;
  if (first.conclusion === null || first.conclusion === undefined) {
    return { status: 'in-progress', url };
  }
  if (first.conclusion === 'success') {
    return { status: 'success', url };
  }
  return { status: 'failed', url };
}

/** Build the `;`-joined `sed -i` expression that bumps both image tags. */
export function buildTagBumpScript({ current, target, apiImage, frontendImage }) {
  const from = escapeSedRegex(current);
  const to = escapeSedRegex(target);
  const api = escapeSedRegex(apiImage);
  const frontend = escapeSedRegex(frontendImage);
  return `s#${api}:${from}#${api}:${to}#;s#${frontend}:${from}#${frontend}:${to}#`;
}

export function pullWithComposeRestore({ pull, restore }) {
  if (pull()) {
    return { pulled: true, restored: false };
  }
  return { pulled: false, restored: restore() };
}

/**
 * Choose the compose backup to restore. Names look like
 * `docker-compose.hub.yml.bak.2026-10-11T061358Z`; stamps are fixed-width UTC so
 * a plain string compare orders them. Returns the newest stamp strictly older
 * than `currentStamp`, or null when there is none.
 */
export function selectRollbackBackup(backups, currentStamp, currentVersion) {
  const candidates = (Array.isArray(backups) ? backups : [])
    .filter(({ name, version }) => {
      const stamp = String(name).split('.bak.').pop();
      return (
        /^\d{4}-\d{2}-\d{2}T\d{6}Z$/.test(stamp) &&
        stamp < currentStamp &&
        version &&
        version !== currentVersion
      );
    })
    .sort((a, b) => {
      const aStamp = String(a.name).split('.bak.').pop();
      const bStamp = String(b.name).split('.bak.').pop();
      return aStamp < bStamp ? 1 : aStamp > bStamp ? -1 : 0;
    });

  return candidates[0]?.name ?? null;
}

/** A backup run is only trusted when the integrity check passed. */
export function backupSucceeded(output) {
  const text = String(output ?? '');
  return text.includes('integrity_check ok') && !text.includes('integrity_check FAILED');
}

/** Normalize CRLF to LF (the backup script breaks under a CRLF shebang line). */
export function normalizeLineEndings(text) {
  return String(text).replace(/\r\n/g, '\n');
}
