import type { ProjectColor, ProjectKind } from './domain.js';

export interface DefaultProject {
  readonly name: string;
  readonly description?: string;
  readonly color?: ProjectColor;
  readonly kind?: ProjectKind;
}

/**
 * The seven life-area projects new personal accounts start with. These are
 * the only name strings the API seeder inserts on onboarding; the frontend
 * must import the same catalogue so its starter copy never drifts from
 * what the server creates.
 */
export const DEFAULT_PROJECTS: readonly DefaultProject[] = [
  {
    name: 'Work',
    description: 'Job, clients, and professional commitments.',
    color: 'deep-ocean',
    kind: 'ongoing',
  },
  {
    name: 'Personal',
    description: 'Appointments, paperwork, and everyday life.',
    color: 'clay',
    kind: 'ongoing',
  },
  {
    name: 'Home',
    description: 'Household tasks, maintenance, and upkeep.',
    color: 'olive',
    kind: 'ongoing',
  },
  {
    name: 'Health',
    description: 'Fitness, medical care, and wellbeing.',
    color: 'teal',
    kind: 'ongoing',
  },
  {
    name: 'Finance',
    description: 'Bills, budgets, and money admin.',
    color: 'forest',
    kind: 'ongoing',
  },
  {
    name: 'Learning',
    description: 'Courses, reading, and skill building.',
    color: 'deep-ocean',
    kind: 'ongoing',
  },
  {
    name: 'Side Projects',
    description: 'Creative work and independent projects.',
    color: 'clay',
    kind: 'ongoing',
  },
];
