/**
 * Guard the TC-4 supply-chain hardening:
 *
 * - every remote GitHub Action is pinned to a full commit SHA with a readable
 *   version comment, so a publisher cannot move the tag underneath us;
 * - every workflow declares explicit least-privilege permissions;
 * - Dependabot watches Docker manifests, while ignoring our own published
 *   images that the release script already keeps in sync.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const workflows = readdirSync(resolve(root, '.github/workflows'))
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => `.github/workflows/${file}`);

test('every remote action is pinned to a SHA with a version comment', () => {
  assert.ok(workflows.length > 0, 'no workflow files found');
  let checked = 0;

  for (const workflow of workflows) {
    for (const line of read(workflow).split('\n')) {
      const match = /\buses:\s+([a-zA-Z0-9][\w.-]*\/[\w./-]+)@(\S+)/.exec(line);
      if (!match) continue;
      const [, action, ref] = match;
      assert.match(ref, /^[0-9a-f]{40}$/, `${workflow}: ${action} is not SHA-pinned`);
      assert.match(
        line,
        /#\s+v\d+(?:\.\d+)*/,
        `${workflow}: ${action} needs a "# vX.Y.Z" comment for the tag`,
      );
      checked += 1;
    }
  }

  assert.ok(checked >= 52, `expected at least 52 pinned actions, found ${checked}`);
});

test('workflows declare explicit permissions', () => {
  for (const workflow of workflows) {
    const source = read(workflow);
    assert.match(source, /^permissions:/m, `${workflow}: needs a top-level permissions block`);
  }

  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /^permissions:\n  contents: read$/m);

  const secretScan = read('.github/workflows/secret-scan.yml');
  assert.match(secretScan, /^permissions:\n  contents: read\n  pull-requests: write$/m);
});

test('Dependabot covers Docker manifests but ignores self-published images', () => {
  const config = read('.github/dependabot.yml');

  for (const ecosystem of ['npm', 'github-actions', 'docker', 'docker-compose']) {
    assert.ok(
      config.includes(`package-ecosystem: '${ecosystem}'`),
      `Dependabot is missing the ${ecosystem} ecosystem`,
    );
  }

  for (const directory of ['/apps/api', '/apps/frontend']) {
    assert.ok(
      config.includes(`directory: '${directory}'`),
      `Docker updates missing for ${directory}`,
    );
  }

  assert.match(config, /dependency-name: 'apauldev2\/\*'/);
});
