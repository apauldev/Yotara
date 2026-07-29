import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;

const htmlPath = resolve(root, 'apps/yotara-website/index.html');
const html = readFileSync(htmlPath, 'utf8');

// Footer badge: "v0.66.1 · released Jul 9, 2026"
const date = new Date().toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const updated = html
  .replace(/v[\d.]+ · released [A-Z][a-z]+ \d+, \d{4}/, `v${version} · released ${date}`)
  .replace(/"softwareVersion": "[\d.]+"/, `"softwareVersion": "${version}"`);

writeFileSync(htmlPath, updated);
