export type Theme =
  | 'light-forest'
  | 'dark-forest'
  | 'coastal-calm'
  | 'minimal-slate'
  | 'floral-blossoms'
  | 'midnight-amethyst'
  | 'ember-hearth'
  | 'golden-hour'
  | 'deep-trench';

export interface ThemeOption {
  readonly id: Theme;
  readonly label: string;
  readonly isDark: boolean;
}

/**
 * Single source of truth for theme ids, display labels, and light/dark tone.
 * Ids must not be renamed: they are persisted in localStorage (`yotara-theme`)
 * and appear as `theme-<id>` CSS classes in `styles.css`.
 */
export const THEMES: readonly ThemeOption[] = [
  { id: 'light-forest', label: 'Light Forest', isDark: false },
  { id: 'dark-forest', label: 'Dark Forest', isDark: true },
  { id: 'coastal-calm', label: 'Coastal Calm', isDark: false },
  { id: 'minimal-slate', label: 'Minimal Slate', isDark: false },
  { id: 'floral-blossoms', label: 'Floral Blossoms', isDark: false },
  { id: 'midnight-amethyst', label: 'Midnight Amethyst', isDark: true },
  { id: 'ember-hearth', label: 'Ember Hearth', isDark: true },
  { id: 'golden-hour', label: 'Golden Hour', isDark: false },
  { id: 'deep-trench', label: 'Deep Trench', isDark: true },
];

export const DEFAULT_THEME: Theme = 'light-forest';

/** Whether the given theme uses the dark palette. */
export function isDarkTheme(id: Theme): boolean {
  return THEMES.some((option) => option.id === id && option.isDark);
}
