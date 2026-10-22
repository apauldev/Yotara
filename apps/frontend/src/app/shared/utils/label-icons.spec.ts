import { faFire, faTag } from '@fortawesome/free-solid-svg-icons';
import { LABEL_ICON_KEYS } from '@yotara/shared';
import { labelIconDefinition, suggestLabelIcon } from './label-icons';

describe('label icons', () => {
  it('maps every shared key to a Font Awesome definition', () => {
    for (const key of LABEL_ICON_KEYS) {
      const definition = labelIconDefinition(key);
      expect(definition.iconName).toBeTruthy();
      if (key !== 'tag') {
        expect(definition).not.toBe(faTag);
      }
    }
  });

  it('maps flame to the installed faFire icon', () => {
    expect(labelIconDefinition('flame')).toBe(faFire);
  });

  it('falls back to the generic tag for unknown or missing keys', () => {
    expect(labelIconDefinition('not-a-real-icon')).toBe(faTag);
    expect(labelIconDefinition(null)).toBe(faTag);
    expect(labelIconDefinition(undefined)).toBe(faTag);
  });

  it('suggests icons deterministically from label names', () => {
    expect(suggestLabelIcon('Writing')).toBe('pen');
    expect(suggestLabelIcon('Errands')).toBe('basket-shopping');
    expect(suggestLabelIcon('Family')).toBe('heart');
    expect(suggestLabelIcon('Finance')).toBe('credit-card');
    expect(suggestLabelIcon('Waiting')).toBe('hourglass');
    expect(suggestLabelIcon('Review')).toBe('check-double');
    expect(suggestLabelIcon('Ideas')).toBe('lightbulb');
    expect(suggestLabelIcon('Something else')).toBe('tag');
    expect(suggestLabelIcon('  ')).toBe('tag');
  });
});
