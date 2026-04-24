import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';

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
      order: 1,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
    },
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        SearchService,
        {
          provide: ProjectService,
          useValue: {
            projects,
          },
        },
        {
          provide: TaskService,
          useValue: {
            tasks,
          },
        },
      ],
    }).compileComponents();
  });

  it('finds tasks by title, description, project name, and status keywords', () => {
    const service = TestBed.inject(SearchService);

    expect(service.search('search results').tasks.map((result) => result.task.id)).toContain(
      'task-1',
    );
    expect(service.search('global search page').tasks.map((result) => result.task.id)).toContain(
      'task-1',
    );
    expect(service.search('launch yotara').tasks.map((result) => result.task.id)).toContain(
      'task-1',
    );
    expect(service.search('today').tasks.map((result) => result.task.id)).toContain('task-1');
    expect(service.search('archived').tasks.map((result) => result.task.id)).toContain('task-2');
  });

  it('returns matching projects alongside tasks for the same project name', () => {
    const service = TestBed.inject(SearchService);
    const results = service.search('launch yotara');

    expect(results.projects.map((result) => result.project.id)).toContain('project-1');
    expect(results.tasks.map((result) => result.task.id)).toContain('task-1');
  });
});
