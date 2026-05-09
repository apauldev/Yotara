import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light-forest' | 'dark-forest' | 'coastal-calm' | 'minimal-slate';

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
      const allThemes: Theme[] = ['light-forest', 'dark-forest', 'coastal-calm', 'minimal-slate'];
      document.documentElement.classList.remove(...allThemes.map((t) => `theme-${t}`));

      // Add current theme class
      document.documentElement.classList.add(`theme-${currentTheme}`);

      // For now, let's just use a simple check for dark forest as the primary "dark" theme
      // but coastal-calm and minimal-slate are light-ish.
      document.documentElement.classList.toggle('dark', currentTheme === 'dark-forest');

      document.documentElement.style.colorScheme =
        currentTheme === 'dark-forest' ? 'dark' : 'light';
      localStorage.setItem(this.STORAGE_KEY, currentTheme);
    });
  }

  setTheme(theme: Theme) {
    this.themeSignal.set(theme);
  }

  toggleTheme() {
    this.themeSignal.update((current) =>
      current === 'dark-forest' ? 'light-forest' : 'dark-forest',
    );
  }

  isDarkTheme(): boolean {
    return this.themeSignal() === 'dark-forest';
  }

  private isThemeDark(theme: Theme): boolean {
    return theme === 'dark-forest';
  }

  private resolveInitialTheme(): Theme {
    const storedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme;
    if (['light-forest', 'dark-forest', 'coastal-calm', 'minimal-slate'].includes(storedTheme)) {
      return storedTheme;
    }

    // Fallback to old keys for migration
    const legacyTheme = localStorage.getItem(this.STORAGE_KEY);
    if (legacyTheme === 'dark') return 'dark-forest';
    if (legacyTheme === 'light') return 'light-forest';

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark-forest'
      : 'light-forest';
  }
}
