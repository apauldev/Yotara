import assert from 'node:assert/strict';
import test from 'node:test';

import { labelNameKey, nameKey } from '../src/name-key.ts';
import { isValidEmail, normalizeEmail } from '../src/utils/email.ts';

test('nameKey folds case, whitespace, and canonical Unicode equivalents', () => {
  assert.equal(nameKey('  Work  '), 'work');
  assert.equal(nameKey('É'), 'é');
  assert.equal(nameKey('E\u0301'), 'é');
  assert.equal(nameKey('Σ'), 'σ');
  assert.equal(nameKey('ΟΣ'), nameKey('οσ'));
  assert.equal(nameKey('Straße'), 'strasse');
  assert.equal(nameKey('STRASSE'), 'strasse');
});

test('nameKey folds characters where lowercase differs from case folding', () => {
  assert.equal(nameKey('ᾳ'), nameKey('αι'));
  assert.equal(nameKey('ſ'), 's');
  assert.equal(nameKey('\u1C80'), '\u0432');
});

test('labelNameKey is an alias of nameKey', () => {
  assert.equal(labelNameKey, nameKey);
  assert.equal(labelNameKey('  Rabatt '), nameKey('Rabatt'));
});

test('isValidEmail accepts addresses the signup schema accepts', () => {
  for (const value of [
    'user@example.com',
    'first.last+tag@example.co.uk',
    "o'neil@example.org",
    'a_b-c@example.dev',
  ]) {
    assert.equal(isValidEmail(value), true, `expected ${value} to be valid`);
  }
});

test('isValidEmail rejects malformed addresses', () => {
  for (const value of [
    '',
    'user',
    'user@',
    '@example.com',
    'user@localhost',
    'user@example.c',
    'user name@example.com',
  ]) {
    assert.equal(isValidEmail(value), false, `expected ${value} to be invalid`);
  }
});

test('normalizeEmail trims and lowercases for shared lookup keys', () => {
  const value = '  User@Example.COM ';

  assert.equal(normalizeEmail(value), 'user@example.com');
  assert.equal(normalizeEmail(normalizeEmail(value)), normalizeEmail(value));
});
