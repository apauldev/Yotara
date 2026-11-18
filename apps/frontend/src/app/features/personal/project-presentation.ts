import type { ProjectColor } from '@yotara/shared';

export interface ProjectPaletteOption {
  value: ProjectColor;
  label: string;
  accent: string;
  accentSoft: string;
  panel: string;
}

export const PROJECT_PALETTE: ProjectPaletteOption[] = [
  {
    value: 'sage',
    label: 'Sage',
    accent: '#49a56e',
    accentSoft: '#e3f3e8',
    panel: 'linear-gradient(135deg, rgba(227, 243, 232, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'teal',
    label: 'Teal',
    accent: '#0e9e98',
    accentSoft: '#daf2f0',
    panel: 'linear-gradient(135deg, rgba(218, 242, 240, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'olive',
    label: 'Olive',
    accent: '#94a62f',
    accentSoft: '#eef2d8',
    panel: 'linear-gradient(135deg, rgba(238, 242, 216, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'clay',
    label: 'Clay',
    accent: '#d66b43',
    accentSoft: '#fae8df',
    panel: 'linear-gradient(135deg, rgba(250, 232, 223, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'forest',
    label: 'Forest',
    accent: '#20714b',
    accentSoft: '#dcefe3',
    panel: 'linear-gradient(135deg, rgba(220, 239, 227, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'deep-ocean',
    label: 'Deep Ocean',
    accent: '#3183bd',
    accentSoft: '#e2eff8',
    panel: 'linear-gradient(135deg, rgba(226, 239, 248, 0.95), rgba(248, 244, 232, 0.92))',
  },
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
