import { DEFAULT_THEME, THEMES, isDarkTheme } from './themes';
import type { Theme } from '../services/theme.service';

describe('themes catalogue', () => {
  it('lists the nine shipped themes with unique ids', () => {
    expect(THEMES.length).toBe(9);
    expect(THEMES.map((option) => option.id)).toEqual([
      'light-forest',
      'dark-forest',
      'coastal-calm',
      'minimal-slate',
      'floral-blossoms',
      'midnight-amethyst',
      'ember-hearth',
      'golden-hour',
      'deep-trench',
    ]);
  });

  it('gives every theme a visible label', () => {
    expect(THEMES.map((option) => option.label)).toEqual([
      'Light Forest',
      'Dark Forest',
      'Coastal Calm',
      'Minimal Slate',
      'Floral Blossoms',
      'Midnight Amethyst',
      'Ember Hearth',
      'Golden Hour',
      'Deep Trench',
    ]);
    for (const option of THEMES) {
      expect(option.label.trim()).not.toBe('');
    }
  });

  it('marks the four dark themes', () => {
    expect(THEMES.filter((option) => option.isDark).map((option) => option.id)).toEqual([
      'dark-forest',
      'midnight-amethyst',
      'ember-hearth',
      'deep-trench',
    ]);
  });

  it('defaults to light forest', () => {
    expect(DEFAULT_THEME).toBe('light-forest');
  });

  it('reports darkness through isDarkTheme', () => {
    expect(isDarkTheme('light-forest' as Theme)).toBeFalse();
    expect(isDarkTheme('dark-forest' as Theme)).toBeTrue();
    expect(isDarkTheme('ember-hearth' as Theme)).toBeTrue();
  });
});
