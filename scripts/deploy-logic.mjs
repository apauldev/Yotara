/**
 * Pure helpers for the deploy driver (`scripts/deploy.mjs`).
 *
 * Everything here is side-effect free so it can be unit-tested without git,
 * ssh, gh, or the network. The driver wires these to real I/O.
 */

/** Escape the characters that are special in a sed basic-regex (BRE) search. */
export function escapeSedRegex(value) {
  return String(value).replace(/[\\.[\]^$#*]/g, '\\$&');
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
  const match = String(grepLine).match(
    new RegExp(`image:\\s*${escapeRegex(image)}:(v?\\d+\\.\\d+\\.\\d+)`),
  );
  return match ? match[1] : null;
}

export function parseDeployedImageVersions({ apiLine, frontendLine, apiImage, frontendImage }) {
  return {
    apiVersion: parseDeployedVersion(apiLine, apiImage),
    frontendVersion: parseDeployedVersion(frontendLine, frontendImage),
  };
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
  return `s#${apiImage}:${from}#${apiImage}:${to}#;s#${frontendImage}:${from}#${frontendImage}:${to}#`;
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
export function selectRollbackBackup(backupNames, currentStamp) {
  const candidates = (Array.isArray(backupNames) ? backupNames : [])
    .map((name) => ({ name, stamp: String(name).split('.bak.').pop() }))
    .filter((entry) => entry.stamp && entry.stamp < currentStamp);

  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
  return candidates[0].name;
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
