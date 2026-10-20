/**
 * WCAG color math for label chips.
 *
 * The chip reads the user's label color straight from data, so text and glyph
 * color on top of it must be computed per color rather than assumed: a light
 * label color needs dark text, a saturated one usually reads better with
 * white. Relative luminance/contrast follow the WCAG formulas.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Matches a normalized 3- or 6-digit hex color (#abc, #aabbcc). */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

/** Parses 3- or 6-digit hex into integer RGB channels; null for anything else. */
export function parseHexColor(value: string | null | undefined): Rgb | null {
  if (!isHexColor(value)) {
    return null;
  }

  const hex = value.trim().toLowerCase();
  if (hex.length === 4) {
    const [, r, g, b] = hex;
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
    };
  }

  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** WCAG relative luminance over the sRGB channel range 0–255. */
export function relativeLuminance(rgb: Rgb): number {
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** WCAG contrast ratio between two colors, 1 (same) to 21 (black/white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The black-or-white text color with the higher contrast against the given
 * background. Used for glyph + text on the solid label-color icon tile and
 * for the selected solid pill, never for small text over soft tinted bodies.
 */
export function pickOnColor(backgroundHex: string): '#000000' | '#ffffff' | null {
  const rgb = parseHexColor(backgroundHex);
  if (!rgb) {
    return null;
  }

  const onWhite = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
  const onBlack = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
  return onWhite >= onBlack ? '#ffffff' : '#000000';
}

/**
 * Whether a color reads as near-neutral (a light gray or gray-green tint like
 * the palette's #dee0d8). Chips rendered from these need a subtle border on
 * their soft body or they disappear against the surface.
 */
export function isNearNeutralColor(hex: string): boolean {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return false;
  }

  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma === 0) {
    return true;
  }

  const lightness = (max + min) / 2;
  const saturation = chroma / (1 - Math.abs(2 * lightness - 1));
  return saturation < 0.15;
}
