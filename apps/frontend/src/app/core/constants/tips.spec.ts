import { TIPS, WIZARD_QUICK_ADD_TIPS, WIZARD_TIPS } from './tips';

describe('tips catalogue', () => {
  it('gives every tip a stable, unique id and non-empty text', () => {
    const ids = new Set<string>();
    for (const tip of TIPS) {
      expect(tip.id.trim()).not.toBe('');
      expect(tip.text.trim()).not.toBe('');
      expect(ids.has(tip.id)).toBeFalse();
      ids.add(tip.id);
    }
  });

  it('keeps the curated wizard subset derived from TIPS with stable ids', () => {
    expect(WIZARD_TIPS.map((tip) => tip.id)).toEqual([
      'capture-date',
      'today-view',
      'calendar-drag',
    ]);
    expect(WIZARD_QUICK_ADD_TIPS.map((tip) => tip.id)).toEqual([
      'capture-label',
      'capture-project',
      'capture-priority',
    ]);
    for (const tip of [...WIZARD_TIPS, ...WIZARD_QUICK_ADD_TIPS]) {
      expect(tip.text.trim()).not.toBe('');
      expect(TIPS.some((entry) => entry.id === tip.id)).toBeTrue();
    }
  });

  it('does not reference unshipped-feature tips', () => {
    const forbidden = ['`?`', 'batch action', 'reorder'];
    for (const tip of TIPS) {
      for (const phrase of forbidden) {
        expect(tip.text.toLowerCase()).not.toContain(phrase);
      }
    }
  });
});
