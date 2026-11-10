import { Injectable, effect, signal } from '@angular/core';
import { DEFAULT_THEME, THEMES, isDarkTheme, type Theme } from '../constants/themes';

export type { Theme } from '../constants/themes';

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
      const allThemes = THEMES.map((option) => option.id);
      document.documentElement.classList.remove(...allThemes.map((t) => `theme-${t}`));

      // Add current theme class
      document.documentElement.classList.add(`theme-${currentTheme}`);

      // Handle dark mode class for Tailwind and system
      const isDark = isDarkTheme(currentTheme);
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
      const allThemes = THEMES.map((option) => option.id);
      const currentIndex = allThemes.indexOf(current);
      return allThemes[(currentIndex + 1) % allThemes.length] as Theme;
    });
  }

  isDarkTheme(): boolean {
    return isDarkTheme(this.themeSignal());
  }

  private resolveInitialTheme(): Theme {
    const storedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme;
    if (THEMES.some((option) => option.id === storedTheme)) {
      return storedTheme;
    }

    const legacyTheme = localStorage.getItem(this.STORAGE_KEY);
    if (legacyTheme === 'dark') return 'dark-forest';
    if (legacyTheme === 'light') return DEFAULT_THEME;

    return DEFAULT_THEME;
  }
}
