import assert from 'node:assert/strict';
import test from 'node:test';
import { labelNameKey } from './label-name.js';

test('labelNameKey trims, composes, and lowercases Unicode label names', () => {
  assert.equal(labelNameKey('  Writing  '), 'writing');
  assert.equal(labelNameKey('Étude'), 'étude');
  assert.equal(labelNameKey('étude'), 'étude');
  assert.equal(labelNameKey('E\u0301tude'), 'étude');
  assert.equal(labelNameKey('Ｆｕｌｌ Ｗｉｄｔｈ'), 'full width');
});
