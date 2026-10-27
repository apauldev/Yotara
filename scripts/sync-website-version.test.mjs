import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FOOTER_BADGE_PATTERN,
  SOFTWARE_VERSION_PATTERN,
  COMPOSE_API_IMAGE_PATTERN,
  COMPOSE_FRONTEND_IMAGE_PATTERN,
  applyComposeVersionStamp,
  applyVersionStamp,
  formatReleaseDate,
} from './sync-website-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/yotara-website/index.html');
const composePath = resolve(root, 'docker-compose.selfhost.yml');
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
  // Built from local components so the assertion holds in every timezone:
  // a noon-UTC instant is already the next day at UTC+12 and beyond.
  assert.equal(formatReleaseDate(new Date(2026, 7, 1)), 'Aug 1, 2026');
});

test('self-host compose image tags match package.json', () => {
  const yaml = readFileSync(composePath, 'utf8');
  const api = yaml.match(COMPOSE_API_IMAGE_PATTERN);
  const frontend = yaml.match(COMPOSE_FRONTEND_IMAGE_PATTERN);

  assert.ok(api, 'api image tag not found in docker-compose.selfhost.yml');
  assert.ok(frontend, 'frontend image tag not found in docker-compose.selfhost.yml');
  assert.equal(api[0], `apauldev2/yotara-api:v${packageVersion}`);
  assert.equal(frontend[0], `apauldev2/yotara-frontend:v${packageVersion}`);
});

test('applyComposeVersionStamp rewrites both image tags', () => {
  const yaml =
    'image: apauldev2/yotara-api:v0.77.0\n' + 'image: apauldev2/yotara-frontend:v0.77.0\n';
  const result = applyComposeVersionStamp(yaml, '1.2.3');

  assert.equal(result.apiImageFound, true);
  assert.equal(result.frontendImageFound, true);
  assert.equal(
    result.yaml,
    'image: apauldev2/yotara-api:v1.2.3\n' + 'image: apauldev2/yotara-frontend:v1.2.3\n',
  );
});

test('applyComposeVersionStamp reports missing image tags instead of silently no-oping', () => {
  const result = applyComposeVersionStamp('services:\n  api:\n    build: .\n', '1.2.3');

  assert.equal(result.apiImageFound, false);
  assert.equal(result.frontendImageFound, false);
  assert.equal(result.yaml, 'services:\n  api:\n    build: .\n');
});
