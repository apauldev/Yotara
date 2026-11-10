import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STARTER_CONTENT_MAX_ITEMS,
  STARTER_DESCRIPTION_MAX_LENGTH,
  STARTER_NAME_MAX_LENGTH,
  normalizeStarterContent,
} from './starter-content.js';

test('normalizeStarterContent rejects non-object root inputs', () => {
  assert.throws(() => normalizeStarterContent(null), /starterContent must be an object/);
  assert.throws(() => normalizeStarterContent('invalid'), /starterContent must be an object/);
  assert.throws(() => normalizeStarterContent([]), /starterContent must be an object/);
  assert.throws(() => normalizeStarterContent(123), /starterContent must be an object/);
});

test('normalizeStarterContent accepts empty object and defaults lists to empty arrays', () => {
  const result = normalizeStarterContent({});
  assert.deepEqual(result, { projects: [], labels: [] });
});

test('normalizeStarterContent validates project and label list types and limits', () => {
  assert.throws(
    () => normalizeStarterContent({ projects: 'not-array' }),
    /starterContent\.projects must be an array/,
  );
  assert.throws(
    () => normalizeStarterContent({ labels: 123 }),
    /starterContent\.labels must be an array/,
  );

  const tooManyProjects = Array.from({ length: STARTER_CONTENT_MAX_ITEMS + 1 }, (_, i) => ({
    name: `Project ${i}`,
  }));
  assert.throws(
    () => normalizeStarterContent({ projects: tooManyProjects }),
    /starterContent\.projects may contain at most 50 items/,
  );

  const tooManyLabels = Array.from({ length: STARTER_CONTENT_MAX_ITEMS + 1 }, (_, i) => ({
    name: `Label ${i}`,
  }));
  assert.throws(
    () => normalizeStarterContent({ labels: tooManyLabels }),
    /starterContent\.labels may contain at most 50 items/,
  );
});

test('normalizeStarterContent validates project items and descriptions', () => {
  assert.throws(
    () => normalizeStarterContent({ projects: ['not-an-object'] }),
    /Each starter project must be an object/,
  );
  assert.throws(
    () => normalizeStarterContent({ projects: [{ name: 123 }] }),
    /Project name must be a string/,
  );
  assert.throws(
    () => normalizeStarterContent({ projects: [{ name: '   ' }] }),
    /Project name is required/,
  );
  assert.throws(
    () =>
      normalizeStarterContent({ projects: [{ name: 'A'.repeat(STARTER_NAME_MAX_LENGTH + 1) }] }),
    /must be 80 characters or fewer/,
  );
  assert.throws(
    () => normalizeStarterContent({ projects: [{ name: 'Work' }, { name: '  work  ' }] }),
    /Duplicate starter project name "work"/,
  );

  // Description validation
  assert.throws(
    () => normalizeStarterContent({ projects: [{ name: 'Work', description: 123 }] }),
    /Description for "Work" must be a string/,
  );
  assert.throws(
    () =>
      normalizeStarterContent({
        projects: [{ name: 'Work', description: 'x'.repeat(STARTER_DESCRIPTION_MAX_LENGTH + 1) }],
      }),
    /must be 200 characters or fewer/,
  );

  // Color validation
  assert.throws(
    () => normalizeStarterContent({ projects: [{ name: 'Work', color: 'neon-rainbow' }] }),
    /Unknown project color "neon-rainbow" for "Work"/,
  );

  const normalized = normalizeStarterContent({
    projects: [
      { name: '  Work  ', description: '  Main jobs  ', color: 'sage' },
      { name: 'Personal', description: '   ' },
      { name: 'EmptyDesc', description: null },
    ],
  });
  assert.deepEqual(normalized.projects, [
    { name: 'Work', description: 'Main jobs', color: 'sage' },
    { name: 'Personal' },
    { name: 'EmptyDesc' },
  ]);
});

test('normalizeStarterContent validates label items, colors, and icons', () => {
  assert.throws(
    () => normalizeStarterContent({ labels: [null] }),
    /Each starter label must be an object/,
  );
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: 99 }] }),
    /Label name must be a string/,
  );
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: ' ' }] }),
    /Label name is required/,
  );
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: 'B'.repeat(STARTER_NAME_MAX_LENGTH + 1) }] }),
    /must be 80 characters or fewer/,
  );
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: 'Urgent' }, { name: 'urgent' }] }),
    /Duplicate starter label name "urgent"/,
  );

  // Color validation
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: 'Urgent', color: 12345 }] }),
    /Label color for "Urgent" must be a hex string/,
  );
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: 'Urgent', color: 'not-hex' }] }),
    /must be a 3- or 6-digit hex color/i,
  );

  // Icon validation
  assert.throws(
    () => normalizeStarterContent({ labels: [{ name: 'Urgent', icon: 'invalid-icon' }] }),
    /Unknown label icon "invalid-icon" for "Urgent"/,
  );

  const normalized = normalizeStarterContent({
    labels: [
      { name: '  Urgent  ', color: '#ff0000', icon: 'flame' },
      { name: 'Waiting', color: undefined },
      { name: 'Review', color: null, icon: null },
    ],
  });
  assert.deepEqual(normalized.labels, [
    { name: 'Urgent', color: '#ff0000', icon: 'flame' },
    { name: 'Waiting' },
    { name: 'Review' },
  ]);
});
