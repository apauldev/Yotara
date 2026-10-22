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
 * red for urgency, amber for waiting, blue for planning, green for errands,
 * purple for review, and mint for ideas. The API seeds these during onboarding
 * and the Labels empty state uses the same list for its starter gallery.
 */
export const DEFAULT_LABELS: readonly DefaultLabel[] = [
  { name: 'Urgent', color: '#d44d3c', icon: 'flame' },
  { name: 'Waiting', color: '#f1c582', icon: 'hourglass' },
  { name: 'Planning', color: '#bcd0fb', icon: 'calendar-days' },
  { name: 'Errand', color: '#c7e9b3', icon: 'basket-shopping' },
  { name: 'Review', color: '#b9a3f4', icon: 'check-double' },
  { name: 'Idea', color: '#82d7a9', icon: 'lightbulb' },
];
