import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CONTENT_SECURITY_POLICY } from '@yotara/shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const expected = `\${CONTENT_SECURITY_POLICY:-${CONTENT_SECURITY_POLICY}}`;

const copies = [
  ['docker-compose.yml', 2],
  ['docker-compose.selfhost.yml', 2],
  ['docker-compose.hub.yml', 2],
  ['apps/yotara-website/install.html', 2],
] as const;

for (const [file, count] of copies) {
  test(`${file} uses the canonical CSP for every service`, () => {
    const source = readFileSync(resolve(root, file), 'utf8');
    const found = source.split(expected).length - 1;

    assert.equal(
      found,
      count,
      `${file} must contain the canonical CSP ${count} time(s); found ${found}`,
    );
  });
}

test('server.ts contains no second CSP literal', () => {
  const source = readFileSync(resolve(root, 'apps/api/src/server.ts'), 'utf8');

  assert.ok(
    !source.includes("default-src 'self'; script-src"),
    'server.ts should import the canonical CSP from @yotara/shared',
  );
});
