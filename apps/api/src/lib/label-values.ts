import { DEFAULT_LABEL_ICON, isLabelIcon, type LabelIcon } from '@yotara/shared';
import { BadRequestError } from './app-error.js';

/** Matches a normalized 3- or 6-digit hex color. */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Validates and normalizes a label color sent by a client. Accepts 3- or
 * 6-digit hex; 3-digit forms expand to 6. Anything else is rejected so broken
 * CSS colors never reach the browser. Legacy stored values that fail this
 * check are tolerated on read (toLabel) but never pass through unchanged
 * writes.
 */
export function normalizeHexColor(value: string, context: string): string {
  const raw = value.trim();
  if (!HEX_COLOR_PATTERN.test(raw)) {
    throw new BadRequestError(`${context} must be a 3- or 6-digit hex color, e.g. #82d7a9`);
  }
  const hex = raw.toLowerCase();
  if (hex.length === 4) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
}

/** Validates a picked icon against the shared allowlist. */
export function normalizeLabelIcon(value: string | undefined): LabelIcon {
  if (value === undefined) {
    return DEFAULT_LABEL_ICON;
  }
  if (!isLabelIcon(value)) {
    throw new BadRequestError(`Unknown label icon "${value}"`);
  }
  return value;
}
