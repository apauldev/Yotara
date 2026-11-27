/**
 * Guard the two config sources of truth:
 *
 * - Node and pnpm versions live in `.node-version` and root `package.json`;
 *   workflows and Dockerfiles must reference them, not re-declare them.
 * - Every tsconfig extends `tsconfig.base.json`, and the `@yotara/shared`
 *   path mapping has exactly one declaration per intentionally different
 *   entry point (source for API dev, dist for API build, browser entry for
 *   the frontend). In particular, no config may point at node_modules.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const nodeVersion = read('.node-version').trim();
const pkg = JSON.parse(read('package.json'));
const pnpmVersion = pkg.packageManager.replace(/^pnpm@/, '');

function listFiles(relative) {
  return readdirSync(resolve(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (
        ['node_modules', 'dist', '.git', 'coverage', '.angular', '.pnpm-store'].includes(entry.name)
      ) {
        return [];
      }
      return listFiles(path);
    }
    return [path];
  });
}

function stripComments(source) {
  return source.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
    match.startsWith('"') ? match : '',
  );
}

function loadTsconfig(file) {
  return JSON.parse(stripComments(read(file)));
}

test('Node version is single-sourced from .node-version', () => {
  assert.match(nodeVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.engines.node, `>=${nodeVersion}`);

  const workflows = listFiles('.github/workflows').filter((file) => /\.ya?ml$/.test(file));
  assert.ok(workflows.length > 0, 'no workflow files found');

  for (const workflow of workflows) {
    const source = read(workflow);
    const setups = source.match(/uses: actions\/setup-node@/g) ?? [];
    const fileRefs = source.match(/node-version-file: ['"]?\.node-version/g) ?? [];
    assert.equal(
      setups.length,
      fileRefs.length,
      `${workflow}: every setup-node step must use .node-version`,
    );
    assert.ok(
      !/node-version:\s*['"]?\d/.test(source),
      `${workflow}: must not pin node-version inline`,
    );
  }
});

test('Docker toolchain args match the canonical versions', () => {
  for (const dockerfile of ['apps/api/Dockerfile', 'apps/frontend/Dockerfile']) {
    const source = read(dockerfile);
    assert.match(
      source,
      new RegExp(`^ARG NODE_VERSION=${nodeVersion.replaceAll('.', '\\.')}$`, 'm'),
      `${dockerfile}: NODE_VERSION does not match .node-version`,
    );
    assert.match(
      source,
      new RegExp(`^ARG PNPM_VERSION=${pnpmVersion.replaceAll('.', '\\.')}$`, 'm'),
      `${dockerfile}: PNPM_VERSION does not match packageManager`,
    );

    const fromLines = source.split('\n').filter((line) => line.startsWith('FROM node'));
    assert.ok(fromLines.length > 0, `${dockerfile}: no node base image found`);
    for (const line of fromLines) {
      assert.match(line, /^FROM node:\$\{NODE_VERSION\}/, `${dockerfile}: ${line}`);
    }
  }
});

test('documented toolchain requirements match the canonical versions', () => {
  for (const doc of ['README.md', 'CONTRIBUTING.md', 'docs/INSTALL.md']) {
    const source = read(doc);
    assert.ok(source.includes(nodeVersion), `${doc}: documents a different Node version`);
    assert.ok(source.includes(pnpmVersion), `${doc}: documents a different pnpm version`);
  }
});

test('all tsconfigs extend the base and share one resolution per entry point', () => {
  const configs = [...listFiles('apps'), ...listFiles('packages')].filter(
    (file) => file.includes('tsconfig') && file.endsWith('.json'),
  );
  assert.ok(configs.length > 0, 'no tsconfigs found');

  for (const file of configs) {
    let config = loadTsconfig(file);
    let current = file;
    const seen = new Set();

    while (config.extends) {
      assert.ok(!seen.has(config.extends), `${file}: cyclic extends chain`);
      seen.add(config.extends);
      current = resolve(dirname(resolve(root, current)), config.extends);
      if (!current.endsWith('.json')) current += '.json';
      config = loadTsconfig(current.replace(resolve(root) + '/', ''));
      if (current.endsWith('tsconfig.base.json')) break;
    }

    assert.ok(
      current.endsWith('tsconfig.base.json'),
      `${file}: does not extend tsconfig.base.json`,
    );
  }

  const expected = new Map([
    ['tsconfig.base.json', './packages/shared/src/index.ts'],
    ['apps/frontend/tsconfig.json', '../../packages/shared/src/frontend.ts'],
    ['apps/api/tsconfig.build.json', '../../packages/shared/dist/index'],
  ]);

  const declarations = new Map();
  for (const file of ['tsconfig.base.json', ...configs]) {
    const mapping = loadTsconfig(file).compilerOptions?.paths?.['@yotara/shared'];
    if (mapping) {
      assert.equal(mapping.length, 1, `${file}: expected one @yotara/shared path`);
      assert.ok(!mapping[0].includes('node_modules'), `${file}: must not resolve via node_modules`);
      declarations.set(file, mapping[0]);
    }
  }

  assert.deepEqual([...declarations].sort(), [...expected].sort());
});
