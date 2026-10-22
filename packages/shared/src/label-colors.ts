/**
 * The curated label color tints shared by the API's auto-assignment, the seed
 * data, and the editor. Eight tints keep the palette calm and scannable.
 */
export const LABEL_COLORS = [
  '#d44d3c',
  '#f1c582',
  '#c7e9b3',
  '#82d7a9',
  '#a5d3e1',
  '#b9a3f4',
  '#bcd0fb',
  '#d19b92',
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/** Deterministic palette pick so creation surfaces agree on auto-assignment. */
export function pickLabelColorForName(name: string): LabelColor {
  const index =
    Math.abs(
      name
        .toLowerCase()
        .split('')
        .reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
    ) % LABEL_COLORS.length;
  return LABEL_COLORS[index];
}
