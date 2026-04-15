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
    accent: '#4a8a63',
    accentSoft: '#dff0e4',
    panel: 'linear-gradient(135deg, rgba(223, 240, 228, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'teal',
    label: 'Teal',
    accent: '#2d7b75',
    accentSoft: '#d9f1ef',
    panel: 'linear-gradient(135deg, rgba(217, 241, 239, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'olive',
    label: 'Olive',
    accent: '#667b46',
    accentSoft: '#e7edd7',
    panel: 'linear-gradient(135deg, rgba(231, 237, 215, 0.96), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'clay',
    label: 'Clay',
    accent: '#b86e51',
    accentSoft: '#f5e3da',
    panel: 'linear-gradient(135deg, rgba(245, 227, 218, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'forest',
    label: 'Forest',
    accent: '#2c5a42',
    accentSoft: '#d7e7de',
    panel: 'linear-gradient(135deg, rgba(215, 231, 222, 0.95), rgba(248, 244, 232, 0.92))',
  },
  {
    value: 'deep-ocean',
    label: 'Deep Ocean',
    accent: '#29586d',
    accentSoft: '#daeaf1',
    panel: 'linear-gradient(135deg, rgba(218, 234, 241, 0.95), rgba(248, 244, 232, 0.92))',
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
