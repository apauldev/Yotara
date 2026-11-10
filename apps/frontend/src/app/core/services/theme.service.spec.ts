import { TestBed } from '@angular/core/testing';
import { DEFAULT_THEME, THEMES } from '../constants/themes';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const STORAGE_KEY = 'yotara-theme';

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('defaults to light-forest when no theme is stored', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe(DEFAULT_THEME);
    expect(service.isDarkTheme()).toBeFalse();
  });

  it('resolves an existing valid theme from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'midnight-amethyst');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('midnight-amethyst');
    expect(service.isDarkTheme()).toBeTrue();
  });

  it('migrates legacy "dark" and "light" storage values', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    let service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('dark-forest');

    TestBed.resetTestingModule();
    localStorage.setItem(STORAGE_KEY, 'light');
    service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe(DEFAULT_THEME);
  });

  it('sets theme, updates signal, persists, and toggles DOM classes', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('ember-hearth');
    TestBed.flushEffects();

    expect(service.theme()).toBe('ember-hearth');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ember-hearth');
    expect(service.isDarkTheme()).toBeTrue();
  });

  it('cycles through all themes using toggleTheme', () => {
    const service = TestBed.inject(ThemeService);
    const initialTheme = service.theme();
    const initialIndex = THEMES.findIndex((t) => t.id === initialTheme);
    const expectedNext = THEMES[(initialIndex + 1) % THEMES.length].id;

    service.toggleTheme();
    expect(service.theme()).toBe(expectedNext);
  });
});
