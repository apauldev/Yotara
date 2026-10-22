import type { LabelColor } from './label-colors.js';
import type { LabelIcon } from './label-icons.js';

export interface DefaultLabel {
  readonly name: string;
  readonly color: LabelColor;
  readonly icon: LabelIcon;
}

/**
 * The six context labels new users start with. They are cross-cutting
 * conditions, never life areas, so the names stay independent of projects.
 *
 * Colors follow the semantic role rather than a decorative palette order:
 * red for urgency, amber for waiting, green for errands, purple for review,
 * blue for someday, and mint for focus. The API seeds these once during
 * onboarding.
 */
export const DEFAULT_LABELS: readonly DefaultLabel[] = [
  { name: 'Urgent', color: '#d44d3c', icon: 'flame' },
  { name: 'Waiting', color: '#f1c582', icon: 'hourglass' },
  { name: 'Errands', color: '#c7e9b3', icon: 'basket-shopping' },
  { name: 'Review', color: '#b9a3f4', icon: 'check-double' },
  { name: 'Someday', color: '#bcd0fb', icon: 'calendar-days' },
  { name: 'Focus', color: '#82d7a9', icon: 'leaf' },
];
