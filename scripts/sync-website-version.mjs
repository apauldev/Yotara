import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Footer badge: "v0.66.1 · released Jul 9, 2026"
export const FOOTER_BADGE_PATTERN = /v([\d.]+) · released [A-Z][a-z]+ \d+, \d{4}/;
// JSON-LD: "softwareVersion": "0.66.1"
export const SOFTWARE_VERSION_PATTERN = /"softwareVersion": "([\d.]+)"/;

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

function main() {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const htmlPath = resolve(root, 'apps/yotara-website/index.html');

  syncWebsiteVersion({ htmlPath, version: pkg.version, date: formatReleaseDate() });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
