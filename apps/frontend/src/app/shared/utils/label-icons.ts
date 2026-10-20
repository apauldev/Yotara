import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
  faBasketShopping,
  faBook,
  faBriefcase,
  faCalendarDays,
  faCar,
  faChartLine,
  faCheckDouble,
  faCreditCard,
  faDumbbell,
  faEnvelope,
  faFire,
  faGraduationCap,
  faHeart,
  faHouse,
  faHourglass,
  faLaptopCode,
  faLeaf,
  faLightbulb,
  faMugHot,
  faPen,
  faPhone,
  faPlane,
  faTag,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons';
import { DEFAULT_LABEL_ICON, isLabelIcon, type LabelIcon } from '@yotara/shared';

/**
 * The one place the shared icon keys meet Font Awesome. The shared package
 * stays runtime-agnostic; the frontend owns the glyph mapping.
 *
 * Note `flame` maps to `faFire` — the installed package has no `faFlame`.
 */
const ICON_DEFINITIONS: Record<LabelIcon, IconDefinition> = {
  briefcase: faBriefcase,
  'laptop-code': faLaptopCode,
  pen: faPen,
  book: faBook,
  'graduation-cap': faGraduationCap,
  'chart-line': faChartLine,
  heart: faHeart,
  house: faHouse,
  dumbbell: faDumbbell,
  leaf: faLeaf,
  'mug-hot': faMugHot,
  utensils: faUtensils,
  'basket-shopping': faBasketShopping,
  'credit-card': faCreditCard,
  phone: faPhone,
  envelope: faEnvelope,
  car: faCar,
  plane: faPlane,
  flame: faFire,
  hourglass: faHourglass,
  'calendar-days': faCalendarDays,
  'check-double': faCheckDouble,
  lightbulb: faLightbulb,
  tag: faTag,
};

/** Renders any stored value; unknown legacy keys fall back to the tag. */
export function labelIconDefinition(icon: string | null | undefined): IconDefinition {
  return isLabelIcon(icon) ? ICON_DEFINITIONS[icon] : ICON_DEFINITIONS[DEFAULT_LABEL_ICON];
}

const SUGGESTION_KEYWORDS: ReadonlyArray<{ keywords: readonly string[]; icon: LabelIcon }> = [
  { keywords: ['family', 'love', 'personal'], icon: 'heart' },
  { keywords: ['moving', 'move', 'home', 'house'], icon: 'house' },
  { keywords: ['writing', 'write', 'draft', 'blog'], icon: 'pen' },
  { keywords: ['call', 'phone', 'ring'], icon: 'phone' },
  { keywords: ['waiting', 'wait', 'blocked', 'pending'], icon: 'hourglass' },
  { keywords: ['urgent', 'asap', 'priority', 'fire'], icon: 'flame' },
  { keywords: ['review', 'verify', 'check'], icon: 'check-double' },
  { keywords: ['idea', 'ideas', 'brainstorm', 'concept'], icon: 'lightbulb' },
  { keywords: ['finance', 'money', 'budget', 'bill', 'invoice', 'tax'], icon: 'credit-card' },
  { keywords: ['reading', 'read', 'study', 'learn'], icon: 'book' },
  { keywords: ['errand', 'shopping', 'grocery', 'buy'], icon: 'basket-shopping' },
  { keywords: ['planning', 'plan', 'schedule', 'calendar'], icon: 'calendar-days' },
  { keywords: ['email', 'mail', 'inbox'], icon: 'envelope' },
  { keywords: ['travel', 'flight', 'trip'], icon: 'plane' },
  { keywords: ['drive', 'car'], icon: 'car' },
  { keywords: ['gym', 'fitness', 'workout'], icon: 'dumbbell' },
  { keywords: ['coffee', 'break'], icon: 'mug-hot' },
  { keywords: ['food', 'lunch', 'dinner', 'meal'], icon: 'utensils' },
  { keywords: ['garden', 'plant', 'outside'], icon: 'leaf' },
  { keywords: ['code', 'coding', 'dev', 'development'], icon: 'laptop-code' },
  { keywords: ['course', 'school', 'class'], icon: 'graduation-cap' },
  { keywords: ['metrics', 'report', 'analysis', 'analytics'], icon: 'chart-line' },
  { keywords: ['work', 'office', 'client'], icon: 'briefcase' },
];

/**
 * Deterministic icon suggestion from the label name. The first keyword match
 * wins; the editor selects it but the user can always choose another icon.
 */
export function suggestLabelIcon(name: string): LabelIcon {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_LABEL_ICON;
  }

  for (const suggestion of SUGGESTION_KEYWORDS) {
    if (suggestion.keywords.some((keyword) => normalized.includes(keyword))) {
      return suggestion.icon;
    }
  }

  return DEFAULT_LABEL_ICON;
}
