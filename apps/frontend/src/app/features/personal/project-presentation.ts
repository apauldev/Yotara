import type { ProjectColor } from '@yotara/shared';

export interface ProjectPaletteOption {
  value: ProjectColor;
  label: string;
  /** The single source of truth for project accent hexes across the UI. */
  accent: string;
}

export const PROJECT_PALETTE: ProjectPaletteOption[] = [
  { value: 'sage', label: 'Sage', accent: '#49a56e' },
  { value: 'teal', label: 'Teal', accent: '#0e9e98' },
  { value: 'olive', label: 'Olive', accent: '#94a62f' },
  { value: 'clay', label: 'Clay', accent: '#d66b43' },
  { value: 'forest', label: 'Forest', accent: '#20714b' },
  { value: 'deep-ocean', label: 'Deep Ocean', accent: '#3183bd' },
];

export function projectPaletteFor(color?: ProjectColor | null) {
  return PROJECT_PALETTE.find((option) => option.value === color) ?? PROJECT_PALETTE[0];
}

export function projectProgressPercent(openTaskCount: number, completedTaskCount: number) {
  const total = openTaskCount + completedTaskCount;
  if (total === 0) {
    return 0;
  }

  return Math.round((completedTaskCount / total) * 100);
}
