import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';
import { LabelService } from './label.service';

describe('SearchService', () => {
  const projects = signal([
    {
      id: 'project-1',
      name: 'Launch Yotara MVP',
      description: 'Core release scope',
      color: 'sage' as const,
      ownerId: 'user-1',
      taskCount: 2,
      completedTaskCount: 1,
      openTaskCount: 1,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-03T10:00:00.000Z',
    },
    {
      id: 'project-2',
      name: 'Home Renovation',
      description: 'Kitchen and bathroom plans',
      color: 'coral' as const,
      ownerId: 'user-1',
      taskCount: 3,
      completedTaskCount: 0,
      openTaskCount: 3,
      createdAt: '2026-04-10T10:00:00.000Z',
      updatedAt: '2026-04-12T10:00:00.000Z',
    },
  ]);

  const tasks = signal([
    {
      id: 'task-1',
      title: 'Polish search results',
      description: 'Tune the global search page copy and ranking.',
      status: 'today' as const,
      priority: 'high' as const,
      completed: false,
      dueDate: '2026-04-24',
      simpleMode: false,
      bucket: 'deep-work' as const,
      projectId: 'project-1',
      order: 0,
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-23T10:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Archive old notebook',
      description: 'Move the completed notes into archive.',
      status: 'archived' as const,
      priority: 'low' as const,
      completed: true,
      dueDate: '2026-03-24',
      simpleMode: false,
      bucket: 'home' as const,
      projectId: null,
      order: 1,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
    },
    {
      id: 'task-3',
      title: 'Buy groceries',
      description: '',
      status: 'inbox' as const,
      priority: 'medium' as const,
      completed: false,
      dueDate: null,
      simpleMode: true,
      bucket: 'home' as const,
      projectId: null,
      order: 2,
      createdAt: '2026-04-25T10:00:00.000Z',
      updatedAt: '2026-04-25T10:00:00.000Z',
    },
    {
      id: 'task-4',
      title: 'Review project plan',
      description: 'Go through the renovation timeline with the contractor.',
      status: 'today' as const,
      priority: 'high' as const,
      completed: false,
      dueDate: null,
      simpleMode: false,
      bucket: 'deep-work' as const,
      projectId: null,
      order: 3,
      createdAt: '2026-04-22T10:00:00.000Z',
      updatedAt: '2026-04-24T10:00:00.000Z',
    },
  ]);

  const labels = signal([
    { id: 'label-1', name: 'bug', color: '#ef4444', taskCount: 2 },
    { id: 'label-2', name: 'enhancement', color: '#3b82f6', taskCount: 1 },
    { id: 'label-3', name: 'ui', color: '#84cc16', taskCount: 3 },
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        SearchService,
        {
          provide: ProjectService,
          useValue: { projects },
        },
        {
          provide: TaskService,
          useValue: { tasks },
        },
        {
          provide: LabelService,
          useValue: { labels },
        },
      ],
    }).compileComponents();
  });

  // ── Existing tests (kept as-is) ──────────────────────────────────

  it('finds tasks by title, description, project name, and status keywords', () => {
    const service = TestBed.inject(SearchService);

    expect(service.search('search results').tasks.map((r) => r.task.id)).toContain('task-1');
    expect(service.search('global search page').tasks.map((r) => r.task.id)).toContain('task-1');
    expect(service.search('launch yotara').tasks.map((r) => r.task.id)).toContain('task-1');
    expect(service.search('today').tasks.map((r) => r.task.id)).toContain('task-1');
    expect(service.search('archived').tasks.map((r) => r.task.id)).toContain('task-2');
  });

  it('returns matching projects alongside tasks for the same project name', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('launch yotara');

    expect(results.projects.map((r) => r.project.id)).toContain('project-1');
    expect(results.tasks.map((r) => r.task.id)).toContain('task-1');
  });

  // ── Empty / edge-case queries ───────────────────────────────────

  it('returns empty result arrays for an empty string query', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('');

    expect(results.tasks).toEqual([]);
    expect(results.projects).toEqual([]);
    expect(results.labels).toEqual([]);
    expect(results.query).toBe('');
    expect(results.normalizedQuery).toBe('');
  });

  it('treats whitespace-only queries the same as an empty query', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('   ');

    expect(results.tasks).toEqual([]);
    expect(results.projects).toEqual([]);
    expect(results.labels).toEqual([]);
  });

  it('preserves the trimmed query text in the result object', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('  hello  ');

    expect(results.query).toBe('hello');
  });

  // ── No-match path ──────────────────────────────────────────────

  it('returns empty result arrays when no entity matches the query', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('zzzznonexistent');

    expect(results.tasks).toEqual([]);
    expect(results.projects).toEqual([]);
    expect(results.labels).toEqual([]);
  });

  // ── Multi-term AND logic ───────────────────────────────────────

  it('requires ALL terms to match in a multi-term query', () => {
    const service = TestBed.inject(SearchService);
    // 'polish' matches task-1 by title; 'zzzz' matches nothing → empty
    expect(service.search('polish zzzz').tasks).toEqual([]);
    // both terms match task-1 → result returned
    expect(service.search('polish search').tasks.map((r) => r.task.id)).toContain('task-1');
  });

  it('matches multi-term queries across different fields', () => {
    const service = TestBed.inject(SearchService);
    // 'search' is in task-1 title/description, 'launch' is in task-1's project name
    const results = service.search('search launch');
    expect(results.tasks.map((r) => r.task.id)).toContain('task-1');
  });

  it('returns no results when only some terms match across different entities', () => {
    const service = TestBed.inject(SearchService);
    // 'search' matches task-1, 'renovation' matches project-2 — no single entity has both
    const results = service.search('search renovation');
    expect(results.tasks).toEqual([]);
    expect(results.projects).toEqual([]);
  });

  // ── Case insensitivity ──────────────────────────────────────────

  it('is case-insensitive', () => {
    const service = TestBed.inject(SearchService);
    const lower = service.search('search');
    const upper = service.search('SEARCH');
    const mixed = service.search('SeArCh');

    expect(lower.tasks.map((r) => r.task.id)).toEqual(upper.tasks.map((r) => r.task.id));
    expect(lower.tasks.map((r) => r.task.id)).toEqual(mixed.tasks.map((r) => r.task.id));
  });

  // ── Label matching ──────────────────────────────────────────────

  it('finds labels by name', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('bug');

    expect(results.labels.map((r) => r.label.id)).toContain('label-1');
    expect(results.labels.length).toBe(1);
  });

  it('finds labels by partial name match', () => {
    const service = TestBed.inject(SearchService);
    // 'enhance' is a prefix of 'enhancement'
    const results = service.search('enhance');
    expect(results.labels.map((r) => r.label.id)).toContain('label-2');
  });

  it('returns label match reasons', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('bug');
    expect(results.labels[0].matchReasons).toContain('label');
  });

  // ── Project matching ────────────────────────────────────────────

  it('finds projects by description content', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('kitchen');
    expect(results.projects.map((r) => r.project.id)).toContain('project-2');
  });

  it('reports project match reasons', () => {
    const service = TestBed.inject(SearchService);
    // exact match on project name
    const exactResults = service.search('Home Renovation');
    expect(exactResults.projects[0].matchReasons).toContain('project');

    // match on description
    const descResults = service.search('bathroom');
    expect(descResults.projects[0].matchReasons).toContain('description');
  });

  // ── Match reasons for tasks ─────────────────────────────────────

  it('reports title match reason when the query matches the task title', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('Polish');
    const result = results.tasks.find((r) => r.task.id === 'task-1')!;
    expect(result.matchReasons).toContain('title');
  });

  it('reports description and project match reasons', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('ranking');
    const result = results.tasks.find((r) => r.task.id === 'task-1')!;
    expect(result.matchReasons).toContain('description');
  });

  it('reports status match reason', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('today');
    const result = results.tasks.find((r) => r.task.id === 'task-1')!;
    expect(result.matchReasons).toContain('status');
  });

  it('reports project name as a match reason for tasks', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('yotara');
    const result = results.tasks.find((r) => r.task.id === 'task-1')!;
    expect(result.matchReasons).toContain('project');
  });

  // ── Score ordering ──────────────────────────────────────────────

  it('sorts results by descending score', () => {
    const service = TestBed.inject(SearchService);
    // 'the' appears in the descriptions of task-1, task-2, and task-4
    const results = service.search('the');
    expect(results.tasks.length).toBeGreaterThan(1);
    const scores = results.tasks.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('sorts projects by descending score', () => {
    const service = TestBed.inject(SearchService);
    // 'a' appears in both project names and descriptions
    const results = service.search('a');
    expect(results.projects.length).toBeGreaterThan(1);
    const scores = results.projects.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  // ── Edge cases: null / empty fields ─────────────────────────────

  it('handles tasks with empty description and no project', () => {
    const service = TestBed.inject(SearchService);
    // task-3 has no description, no projectId, no dueDate
    const results = service.search('groceries');
    const result = results.tasks.find((r) => r.task.id === 'task-3');
    expect(result).toBeTruthy();
    expect(result!.project).toBeNull();
  });

  it('does not crash when a task has null projectId and no matching project', () => {
    const service = TestBed.inject(SearchService);
    // task-4 has null projectId and searches for something in its own fields
    const results = service.search('review');
    expect(results.tasks.map((r) => r.task.id)).toContain('task-4');
    expect(results.tasks.find((r) => r.task.id === 'task-4')!.project).toBeNull();
  });

  // ── Result shape ────────────────────────────────────────────────

  it('attaches the project reference to task results when the task belongs to a project', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('search');
    const result = results.tasks.find((r) => r.task.id === 'task-1')!;
    expect(result.project).not.toBeNull();
    expect(result.project!.id).toBe('project-1');
  });

  it('includes normalizedQuery in the result', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('  Search  ');
    expect(results.normalizedQuery).toBe('search');
  });

  it('includes scores on every result', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('search');
    for (const r of results.tasks) {
      expect(typeof r.score).toBe('number');
      expect(r.score).toBeGreaterThan(0);
    }
    for (const r of results.projects) {
      expect(typeof r.score).toBe('number');
      expect(r.score).toBeGreaterThan(0);
    }
  });
});
