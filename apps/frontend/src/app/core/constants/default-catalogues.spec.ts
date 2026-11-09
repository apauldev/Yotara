import { DEFAULT_LABELS, DEFAULT_PROJECTS } from '@yotara/shared';

describe('shared starter catalogues', () => {
  it('seeds seven stable starter projects', () => {
    expect(DEFAULT_PROJECTS.map((project) => project.name)).toEqual([
      'Work',
      'Personal',
      'Home',
      'Health',
      'Finance',
      'Learning',
      'Side Projects',
    ]);

    for (const project of DEFAULT_PROJECTS) {
      expect(project.description?.trim()).not.toBe('');
      expect(project.color).toBeTruthy();
    }
  });

  it('seeds six stable starter labels', () => {
    expect(DEFAULT_LABELS.map((label) => label.name)).toEqual([
      'Urgent',
      'Waiting',
      'Errands',
      'Review',
      'Someday',
      'Focus',
    ]);

    for (const label of DEFAULT_LABELS) {
      expect(label.color).toBeTruthy();
      expect(label.icon).toBeTruthy();
    }
  });
});
