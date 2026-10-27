import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Footer badge: "v0.66.1 · released Jul 9, 2026"
export const FOOTER_BADGE_PATTERN = /v([\d.]+) · released [A-Z][a-z]+ \d+, \d{4}/;
// JSON-LD: "softwareVersion": "0.66.1"
export const SOFTWARE_VERSION_PATTERN = /"softwareVersion": "([\d.]+)"/;
// Self-host compose image tags: "apauldev2/yotara-api:v0.85.0"
export const COMPOSE_IMAGE_PATTERN = /apauldev2\/yotara-(api|frontend):v[\d.]+/g;
export const COMPOSE_API_IMAGE_PATTERN = /apauldev2\/yotara-api:v[\d.]+/;
export const COMPOSE_FRONTEND_IMAGE_PATTERN = /apauldev2\/yotara-frontend:v[\d.]+/;

/**
 * Stamp the website version values into the homepage HTML.
 *
 * Returns the updated HTML plus whether each pattern was found, so callers can
 * fail loudly instead of writing a silent no-op when the page format changes.
 */
export function applyVersionStamp(html, version, date) {
  const footerBadgeFound = FOOTER_BADGE_PATTERN.test(html);
  const softwareVersionFound = SOFTWARE_VERSION_PATTERN.test(html);

  const updated = html
    .replace(FOOTER_BADGE_PATTERN, `v${version} · released ${date}`)
    .replace(SOFTWARE_VERSION_PATTERN, `"softwareVersion": "${version}"`);

  return { html: updated, footerBadgeFound, softwareVersionFound };
}

/** Footer badge date, e.g. "Oct 16, 2026". */
export function formatReleaseDate(now = new Date()) {
  return now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Stamp the released version into the self-host compose image tags.
 *
 * The compose file is what the website tells self-hosters to curl, so its
 * tags are release-coupled: a file left on an old tag silently serves an old
 * build. Returns which image lines were found so callers can fail loudly.
 */
export function applyComposeVersionStamp(yaml, version) {
  const apiImageFound = COMPOSE_API_IMAGE_PATTERN.test(yaml);
  const frontendImageFound = COMPOSE_FRONTEND_IMAGE_PATTERN.test(yaml);

  const updated = yaml.replace(COMPOSE_IMAGE_PATTERN, `apauldev2/yotara-$1:v${version}`);

  return { yaml: updated, apiImageFound, frontendImageFound };
}

export function syncWebsiteVersion({ htmlPath, version, date }) {
  const html = readFileSync(htmlPath, 'utf8');
  const {
    html: updated,
    footerBadgeFound,
    softwareVersionFound,
  } = applyVersionStamp(html, version, date);

  if (!footerBadgeFound || !softwareVersionFound) {
    const missing = [
      !footerBadgeFound && 'footer badge ("vX.Y.Z · released Mon D, YYYY")',
      !softwareVersionFound && '"softwareVersion": "X.Y.Z"',
    ].filter(Boolean);
    throw new Error(
      `could not find ${missing.join(' and ')} in ${htmlPath}. ` +
        'A silent no-op would leave the site stale for every future release — ' +
        'fix the page format or update the patterns in scripts/sync-website-version.mjs.',
    );
  }

  writeFileSync(htmlPath, updated);
  return { footerBadgeFound, softwareVersionFound };
}

export function syncComposeVersion({ yamlPath, version }) {
  const yaml = readFileSync(yamlPath, 'utf8');
  const {
    yaml: updated,
    apiImageFound,
    frontendImageFound,
  } = applyComposeVersionStamp(yaml, version);

  if (!apiImageFound || !frontendImageFound) {
    const missing = [
      !apiImageFound && 'the api image tag ("apauldev2/yotara-api:vX.Y.Z")',
      !frontendImageFound && 'the frontend image tag ("apauldev2/yotara-frontend:vX.Y.Z")',
    ].filter(Boolean);
    throw new Error(
      `could not find ${missing.join(' and ')} in ${yamlPath}. ` +
        'A stale image tag would serve an old build to every self-hoster — ' +
        'fix the compose file or update the patterns in scripts/sync-website-version.mjs.',
    );
  }

  writeFileSync(yamlPath, updated);
  return { apiImageFound, frontendImageFound };
}

function main() {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const htmlPath = resolve(root, 'apps/yotara-website/index.html');
  const composePath = resolve(root, 'docker-compose.selfhost.yml');

  syncWebsiteVersion({ htmlPath, version: pkg.version, date: formatReleaseDate() });
  syncComposeVersion({ yamlPath: composePath, version: pkg.version });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
