/**
 * The curated label icon set. Keys are visual names (`credit-card`, not
 * `finance`) so the picker stays predictable and the frontend owns the
 * Font Awesome mapping. The database stores only the key.
 */
export const LABEL_ICON_GROUPS = [
  {
    id: 'work',
    label: 'Work & focus',
    icons: ['briefcase', 'laptop-code', 'pen', 'book', 'graduation-cap', 'chart-line'],
  },
  {
    id: 'life',
    label: 'Life & health',
    icons: ['heart', 'house', 'dumbbell', 'leaf', 'mug-hot', 'utensils'],
  },
  {
    id: 'action',
    label: 'Action & admin',
    icons: ['basket-shopping', 'credit-card', 'phone', 'envelope', 'car', 'plane'],
  },
  {
    id: 'signals',
    label: 'Signals',
    icons: ['flame', 'hourglass', 'calendar-days', 'check-double', 'lightbulb', 'tag'],
  },
] as const;

export type LabelIconGroup = (typeof LABEL_ICON_GROUPS)[number];
export type LabelIcon = LabelIconGroup['icons'][number];

/** Flat list in picker order, useful for API validation and tests. */
export const LABEL_ICON_KEYS: readonly LabelIcon[] = LABEL_ICON_GROUPS.flatMap(
  (group) => group.icons,
);

/** The generic fallback for labels created before icons existed. */
export const DEFAULT_LABEL_ICON: LabelIcon = 'tag';

const LABEL_ICON_SET: ReadonlySet<string> = new Set(LABEL_ICON_KEYS);

export function isLabelIcon(value: unknown): value is LabelIcon {
  return typeof value === 'string' && LABEL_ICON_SET.has(value);
}
