import { getInitials } from './initials';

describe('getInitials', () => {
  it('uses the first letters of the first two words', () => {
    expect(getInitials('Jordan Doe')).toBe('JD');
    expect(getInitials('  Jordan   Doe  ')).toBe('JD');
    expect(getInitials('Jean Luc Picard')).toBe('JL');
  });

  it('uses the first letter for a single word', () => {
    expect(getInitials('Madonna')).toBe('M');
  });

  it('falls back to the email first letter when the name is empty', () => {
    expect(getInitials('', 'alex@example.com')).toBe('A');
    expect(getInitials(null, 'alex@example.com')).toBe('A');
    expect(getInitials('   ', 'bob@example.com')).toBe('B');
  });

  it('falls back to Y when both name and email are empty', () => {
    expect(getInitials('', '')).toBe('Y');
    expect(getInitials(null, null)).toBe('Y');
    expect(getInitials(undefined, undefined)).toBe('Y');
  });

  it('prefers the name over the email', () => {
    expect(getInitials('Jordan Doe', 'alex@example.com')).toBe('JD');
  });

  it('keeps composed and non-Latin graphemes intact', () => {
    expect(getInitials('Zoë Smith')).toBe('ZS');
    expect(getInitials('田中 太郎')).toBe('田太');
  });

  it('falls back to Array.from if Intl.Segmenter throws or is unavailable', () => {
    const originalSegmenter = (Intl as unknown as { Segmenter: unknown }).Segmenter;
    try {
      (Intl as unknown as { Segmenter: unknown }).Segmenter = function () {
        throw new Error('Not supported');
      };
      expect(getInitials('Fallback Test')).toBe('FT');
      expect(getInitials('', 'fallback@example.com')).toBe('F');
    } finally {
      (Intl as unknown as { Segmenter: unknown }).Segmenter = originalSegmenter;
    }
  });
});
