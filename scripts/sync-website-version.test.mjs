import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FOOTER_BADGE_PATTERN,
  SOFTWARE_VERSION_PATTERN,
  applyVersionStamp,
  formatReleaseDate,
} from './sync-website-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/yotara-website/index.html');
const packageVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;

test('footer badge version matches package.json', () => {
  const html = readFileSync(htmlPath, 'utf8');
  const match = html.match(FOOTER_BADGE_PATTERN);
  assert.ok(match, 'footer badge not found in index.html — the release stamp cannot run');
  assert.equal(match[1], packageVersion);
});

test('JSON-LD softwareVersion matches package.json', () => {
  const html = readFileSync(htmlPath, 'utf8');
  const match = html.match(SOFTWARE_VERSION_PATTERN);
  assert.ok(match, 'softwareVersion not found in index.html — the release stamp cannot run');
  assert.equal(match[1], packageVersion);
});

test('applyVersionStamp rewrites both values and reports the patterns it found', () => {
  const html = '<span>v0.71.1 · released Aug 1, 2026</span>\n"softwareVersion": "0.70.2"';
  const result = applyVersionStamp(html, '1.2.3', 'Oct 16, 2026');

  assert.equal(result.footerBadgeFound, true);
  assert.equal(result.softwareVersionFound, true);
  assert.equal(
    result.html,
    '<span>v1.2.3 · released Oct 16, 2026</span>\n"softwareVersion": "1.2.3"',
  );
});

test('applyVersionStamp reports missing patterns instead of silently no-oping', () => {
  const result = applyVersionStamp('<html></html>', '1.2.3', 'Oct 16, 2026');

  assert.equal(result.footerBadgeFound, false);
  assert.equal(result.softwareVersionFound, false);
  assert.equal(result.html, '<html></html>');
});

test('formatReleaseDate renders the badge date format', () => {
  assert.equal(formatReleaseDate(new Date('2026-08-01T12:00:00Z')), 'Aug 1, 2026');
});
