/**
 * Shared initials helper for avatars.
 *
 * - First letters of the first two words; a single word uses its first letter.
 * - An empty name falls back to the email's first letter, then `Y`.
 * - Grapheme-safe: uses `Intl.Segmenter` when available, else `Array.from`,
 *   so non-Latin and composed characters are never split.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  const normalizedName = name?.trim() ?? '';

  if (normalizedName) {
    const parts = normalizedName.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const initials = parts
        .slice(0, 2)
        .map((part) => firstGrapheme(part).toUpperCase())
        .join('');

      if (initials) {
        return initials;
      }
    }
  }

  const normalizedEmail = email?.trim() ?? '';
  if (normalizedEmail) {
    const first = firstGrapheme(normalizedEmail);
    if (first) {
      return first.toUpperCase();
    }
  }

  return 'Y';
}

function firstGrapheme(value: string): string {
  const segmented = segmentGraphemes(value);
  return segmented[0] ?? '';
}

function segmentGraphemes(value: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return [...segmenter.segment(value)].map((part) => part.segment);
    } catch {
      // Fall through to Array.from for environments without Intl.Segmenter.
    }
  }

  return Array.from(value);
}
