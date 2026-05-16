import { Injectable, effect, signal } from '@angular/core';
export type Theme =
  | 'light-forest'
  | 'dark-forest'
  | 'coastal-calm'
  | 'minimal-slate'
  | 'midnight-amethyst'
  | 'golden-hour'
  | 'deep-trench';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly STORAGE_KEY = 'yotara-theme';
  private readonly themeSignal = signal<Theme>(this.resolveInitialTheme());

  readonly theme = this.themeSignal.asReadonly();

  constructor() {
    effect(() => {
      const currentTheme = this.themeSignal();

      // Remove all theme classes
      const allThemes: Theme[] = [
        'light-forest',
        'dark-forest',
        'coastal-calm',
        'minimal-slate',
        'midnight-amethyst',
        'golden-hour',
        'deep-trench',
      ];
      document.documentElement.classList.remove(...allThemes.map((t) => `theme-${t}`));

      // Add current theme class
      document.documentElement.classList.add(`theme-${currentTheme}`);

      // Handle dark mode class for Tailwind and system
      const isDark = this.isThemeDark(currentTheme);
      document.documentElement.classList.toggle('dark', isDark);

      const colorScheme = isDark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = colorScheme;
      localStorage.setItem(this.STORAGE_KEY, currentTheme);
    });
  }

  setTheme(theme: Theme) {
    this.themeSignal.set(theme);
  }

  toggleTheme() {
    this.themeSignal.update((current) => {
      const allThemes: Theme[] = [
        'light-forest',
        'dark-forest',
        'coastal-calm',
        'minimal-slate',
        'midnight-amethyst',
        'golden-hour',
        'deep-trench',
      ];
      const currentIndex = allThemes.indexOf(current);
      return allThemes[(currentIndex + 1) % allThemes.length];
    });
  }

  isDarkTheme(): boolean {
    return this.isThemeDark(this.themeSignal());
  }

  private isThemeDark(theme: Theme): boolean {
    return ['dark-forest', 'midnight-amethyst', 'deep-trench'].includes(theme);
  }

  private resolveInitialTheme(): Theme {
    const storedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme;
    if (
      [
        'light-forest',
        'dark-forest',
        'coastal-calm',
        'minimal-slate',
        'midnight-amethyst',
        'golden-hour',
        'deep-trench',
      ].includes(storedTheme)
    ) {
      return storedTheme;
    }

    const legacyTheme = localStorage.getItem(this.STORAGE_KEY);
    if (legacyTheme === 'dark') return 'dark-forest';
    if (legacyTheme === 'light') return 'light-forest';

    return 'light-forest';
  }
}
