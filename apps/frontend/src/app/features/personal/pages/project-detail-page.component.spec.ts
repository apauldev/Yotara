import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailPageComponent } from './project-detail-page.component';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { LabelService } from '../../../core/services/label.service';

describe('ProjectDetailPageComponent', () => {
  let projectServiceStub: {
    projects: ReturnType<typeof signal>;
    saving: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
    getProject: jasmine.Spy;
    getProjectTasks: jasmine.Spy;
    updateProject: jasmine.Spy;
    refreshProjects: jasmine.Spy;
  };
  let taskRevision = signal(0);

  const baseProject = {
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
  };

  const activeTask = {
    id: 'task-1',
    title: 'Draft launch copy',
    description: 'Write the first pass',
    status: 'inbox' as const,
    priority: 'medium' as const,
    completed: false,
    order: 0,
    dueDate: null,
    simpleMode: false,
    bucket: 'personal-sanctuary' as const,
    projectId: 'project-1',
    deletedAt: null,
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedAt: '2026-04-02T10:00:00.000Z',
  };

  const completedTask = {
    ...activeTask,
    id: 'task-2',
    title: 'Outline release checklist',
    completed: true,
    status: 'done' as const,
  };

  async function configure(projectResponse: typeof baseProject | null) {
    TestBed.resetTestingModule();
    taskRevision = signal(0);

    projectServiceStub = {
      projects: signal([baseProject]),
      saving: signal(false),
      error: signal<string | null>(null),
      getProject: jasmine.createSpy('getProject').and.resolveTo(projectResponse),
      getProjectTasks: jasmine.createSpy('getProjectTasks').and.resolveTo(
        projectResponse
          ? [
              { ...completedTask, order: 2 },
              { ...activeTask, order: 1 },
            ]
          : null,
      ),
      updateProject: jasmine.createSpy('updateProject').and.resolveTo(baseProject),
      refreshProjects: jasmine.createSpy('refreshProjects'),
    };

    const taskServiceStub = {
      error: signal(null),
      revision: taskRevision,
      createTask: jasmine.createSpy('createTask').and.resolveTo(undefined),
      updateTask: jasmine.createSpy('updateTask').and.resolveTo(undefined),
    };

    const labelServiceStub = {
      labels: signal([]),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectDetailPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'project-1' })),
            snapshot: { paramMap: convertToParamMap({ id: 'project-1' }) },
          },
        },
        { provide: ProjectService, useValue: projectServiceStub },
        { provide: TaskService, useValue: taskServiceStub },
        { provide: LabelService, useValue: labelServiceStub },
      ],
    }).compileComponents();
  }

  it('loads project-scoped data on a cold route load', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Launch Yotara MVP');
    expect(text).toContain('Core release scope');
    expect(text).toContain('Draft launch copy');
    expect(text).toContain('Outline release checklist');
    expect(text).toContain('Edit Project');
    expect(text).toContain('Add Task');
    expect(text.indexOf('Draft launch copy')).toBeLessThan(
      text.indexOf('Outline release checklist'),
    );
  });

  it('surfaces project save errors in the edit modal', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.componentInstance as any).openEditProjectModal();
    projectServiceStub.error.set('Could not update your project right now.');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Could not update your project right now.');
  });

  it('shows a not found state when the project is missing', async () => {
    await configure(null);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Project not found');
    expect(text).not.toContain('Edit Project');
  });

  it('reloads project details when task revisions change', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const initialTaskCalls = projectServiceStub.getProjectTasks.calls.count();
    taskRevision.set(1);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(projectServiceStub.getProjectTasks.calls.count()).toBeGreaterThan(initialTaskCalls);
  });
});
