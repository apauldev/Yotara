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

test('labelNameKey recomposes sequences that only compose after lowercasing', () => {
  // Uppercase base + combining mark has no precomposed uppercase form, but the
  // lowercase result does; the second NFKC pass must collapse the pair.
  assert.equal(labelNameKey('T\u0308'), '\u1E97'); // T + diaeresis -> ẗ
  assert.equal(labelNameKey('\u03AA\u0301'), labelNameKey('\u0390')); // Ϊ + tonos -> ΐ
  assert.equal(labelNameKey('\u03AB\u0301'), labelNameKey('\u03B0')); // Ϋ + tonos -> ΰ
});

test('labelNameKey case-folds characters where lowercase and case folding differ', () => {
  // Full case folding, not just toLowerCase(): final sigma folds to medial,
  // sharp s folds to 'ss' (ẞ lowercases to ß first, then folds the same way),
  // the Greek iota subscript folds to an explicit iota, and Cyrillic Extended-C
  // variants fold to their base letters.
  assert.equal(labelNameKey('ΟΣ'), labelNameKey('οσ')); // final sigma vs medial sigma
  assert.equal(labelNameKey('ος'), labelNameKey('οσ'));
  assert.equal(labelNameKey('Straße'), labelNameKey('STRASSE'));
  assert.equal(labelNameKey('Straße'), 'strasse');
  assert.equal(labelNameKey('ẞ'), 'ss');
  assert.equal(labelNameKey('ſhop'), labelNameKey('shop')); // long s
  assert.equal(labelNameKey('Ι\u0345'), labelNameKey('ιι')); // combining ypogegrammeni
  assert.equal(labelNameKey('ᾳ'), labelNameKey('αι')); // precomposed ypogegrammeni
  assert.equal(labelNameKey('ᾼ'), labelNameKey('αι')); // capital prosgegrammeni
  assert.equal(labelNameKey('\u1C80'), labelNameKey('в')); // Cyrillic rounded ve
  assert.equal(labelNameKey('\u1C88'), labelNameKey('ꙋ')); // Cyrillic unblended uk
});
