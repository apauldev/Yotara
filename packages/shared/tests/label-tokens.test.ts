import assert from 'node:assert/strict';
import test from 'node:test';

import { LABEL_COLORS, pickLabelColorForName } from '../src/label-colors.ts';
import {
  DEFAULT_LABEL_ICON,
  LABEL_ICON_GROUPS,
  LABEL_ICON_KEYS,
  isLabelIcon,
} from '../src/label-icons.ts';

test('label palette is unique and auto-assignment is deterministic', () => {
  assert.equal(new Set(LABEL_COLORS).size, LABEL_COLORS.length);

  for (const name of ['Work', 'Home', 'Ürgent', '']) {
    const color = pickLabelColorForName(name);

    assert.ok(LABEL_COLORS.includes(color), `${name} produced an unknown color`);
    assert.equal(pickLabelColorForName(name), color);
  }
});

test('label icon keys are unique and cover every group', () => {
  const grouped = LABEL_ICON_GROUPS.flatMap((group) => group.icons);

  assert.deepEqual([...LABEL_ICON_KEYS], grouped);
  assert.equal(new Set(LABEL_ICON_KEYS).size, LABEL_ICON_KEYS.length);
  assert.ok(LABEL_ICON_KEYS.length > 0);
});

test('isLabelIcon accepts only keys from the curated set', () => {
  assert.equal(isLabelIcon(DEFAULT_LABEL_ICON), true);
  assert.equal(isLabelIcon(LABEL_ICON_KEYS[0]), true);
  assert.equal(isLabelIcon('not-an-icon'), false);
  assert.equal(isLabelIcon(''), false);
  assert.equal(isLabelIcon(undefined), false);
  assert.equal(isLabelIcon(42), false);
});
