import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import type { Project, ProjectSection } from '@yotara/shared';
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
    getSections: jasmine.Spy;
    createSection: jasmine.Spy;
    updateSection: jasmine.Spy;
    reorderSections: jasmine.Spy;
    deleteSection: jasmine.Spy;
    updateProject: jasmine.Spy;
    completeProject: jasmine.Spy;
    reopenProject: jasmine.Spy;
    archiveProject: jasmine.Spy;
    unarchiveProject: jasmine.Spy;
    deleteProject: jasmine.Spy;
    refresh: jasmine.Spy;
  };
  let taskVersion = signal(0);

  const baseProject: Project = {
    id: 'project-1',
    name: 'Launch Yotara MVP',
    description: 'Core release scope',
    color: 'sage' as const,
    kind: 'project',
    sortOrder: 0,
    pinned: false,
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

  async function configure(projectResponse: Project | null) {
    TestBed.resetTestingModule();
    taskVersion = signal(0);

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
      getSections: jasmine.createSpy('getSections').and.resolveTo([]),
      createSection: jasmine.createSpy('createSection').and.resolveTo(undefined),
      updateSection: jasmine.createSpy('updateSection').and.resolveTo(undefined),
      reorderSections: jasmine.createSpy('reorderSections').and.resolveTo([]),
      deleteSection: jasmine.createSpy('deleteSection').and.resolveTo(undefined),
      updateProject: jasmine.createSpy('updateProject').and.resolveTo(baseProject),
      completeProject: jasmine.createSpy('completeProject').and.resolveTo(baseProject),
      reopenProject: jasmine.createSpy('reopenProject').and.resolveTo(baseProject),
      archiveProject: jasmine.createSpy('archiveProject').and.resolveTo(baseProject),
      unarchiveProject: jasmine.createSpy('unarchiveProject').and.resolveTo(baseProject),
      deleteProject: jasmine.createSpy('deleteProject').and.resolveTo(undefined),
      refresh: jasmine.createSpy('refresh'),
    };

    const taskServiceStub = {
      error: signal(null),
      version: taskVersion,
      creating: signal(false),
      createTask: jasmine.createSpy('createTask').and.resolveTo(undefined),
      updateTask: jasmine.createSpy('updateTask').and.resolveTo(undefined),
      updateTasks: jasmine.createSpy('updateTasks').and.resolveTo({ ok: true, updated: 2 }),
      getUnassignedTasks: jasmine.createSpy('getUnassignedTasks').and.returnValue(
        of({
          data: [],
          meta: {
            total: 0,
            page: 1,
            pageSize: 3000,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
      ),
    };

    const labelServiceStub = {
      labels: signal([]),
      labelById: () => new Map(),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectDetailPageComponent],
      providers: [
        provideRouter([]),
        provideMarkdown(),
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
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Launch Yotara MVP');
    expect(text).toContain('Core release scope');
    expect(text).toContain('Draft launch copy');
    expect(text).toContain('Add new task');
    expect(text).toContain('Completed');

    // Completed tasks are collapsed by default per spec; expand to reveal
    fixture.componentInstance['toggleCompletedCollapsed']();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const expandedText = fixture.nativeElement.textContent;
    expect(expandedText).toContain('Outline release checklist');
    expect(expandedText.indexOf('Draft launch copy')).toBeLessThan(
      expandedText.indexOf('Outline release checklist'),
    );

    // Overflow action button exists
    const menuBtn = fixture.nativeElement.querySelector('.menu-trigger');
    expect(menuBtn).toBeTruthy();
  });

  it('offers Add new task and Add existing task actions', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.debugElement
      .queryAll(By.css('.actions-row .action-button'))
      .map((button) => button.nativeElement.textContent.replace(/\s+/g, ' ').trim());
    expect(buttons).toEqual(['Add new task', 'Add existing task', '+ Add Section']);

    const addExisting = fixture.debugElement.queryAll(By.css('.actions-row .action-button'))[1]
      .nativeElement as HTMLButtonElement;
    addExisting.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['addExistingOpen']()).toBeTrue();
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
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Project not found');
  });

  it('reloads project details when task revisions change', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const initialTaskCalls = projectServiceStub.getProjectTasks.calls.count();
    taskVersion.set(1);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(projectServiceStub.getProjectTasks.calls.count()).toBeGreaterThan(initialTaskCalls);
  });

  it('reloads project details after saving project changes', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    projectServiceStub.getProject.calls.reset();
    projectServiceStub.getProjectTasks.calls.reset();

    await (fixture.componentInstance as any).saveProject({
      name: 'Renamed Project',
      description: 'Updated scope',
      color: 'olive',
      kind: 'project',
      targetDate: null,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(projectServiceStub.updateProject).toHaveBeenCalledWith('project-1', {
      name: 'Renamed Project',
      description: 'Updated scope',
      color: 'olive',
      kind: 'project',
      targetDate: null,
    });
    expect(projectServiceStub.getProject).toHaveBeenCalled();
    expect(projectServiceStub.getProjectTasks).toHaveBeenCalled();
  });

  it('renders ongoing area without completion progress bar', async () => {
    const ongoingProject: Project = {
      ...baseProject,
      kind: 'ongoing',
      name: 'Home Sanctuary',
    };
    await configure(ongoingProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Home Sanctuary');
    expect(text).toContain('Ongoing area');
    expect(text).not.toContain('% total progress');
    expect(text).not.toContain('% tasks complete');
  });

  it('shows an actionable completion helper when open tasks remain', async () => {
    await configure({ ...baseProject, openTaskCount: 3 });
    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.menu-trigger').click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Finish or move the remaining 3 tasks first');
    expect(text).toContain('View open tasks');

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.header-menu [role="menuitem"]'),
    ) as HTMLButtonElement[];
    const complete = items.find((item) => item.textContent?.includes('Complete project'));
    expect(complete).toBeTruthy();
    expect(complete!.disabled).toBeTrue();
  });

  const planningSection: ProjectSection = {
    id: 'section-1',
    projectId: 'project-1',
    name: 'Planning',
    sortOrder: 0,
    taskCount: 1,
    completedTaskCount: 0,
    openTaskCount: 1,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  };

  it('renders unsectioned tasks first, then sections with their tasks', async () => {
    await configure(baseProject);
    projectServiceStub.getSections.and.resolveTo([planningSection]);
    projectServiceStub.getProjectTasks.and.resolveTo([
      { ...activeTask, id: 'task-2', title: 'Section task', sectionId: 'section-1', order: 0 },
      { ...activeTask, id: 'task-1', title: 'Flat task', sectionId: undefined, order: 1 },
    ]);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Planning');
    expect(text.indexOf('Flat task')).toBeLessThan(text.indexOf('Section task'));
    expect(fixture.nativeElement.querySelectorAll('.project-section').length).toBe(1);
    expect(projectServiceStub.getSections).toHaveBeenCalledWith('project-1');

    // The "To Do" header counts only the flat group it renders, not the
    // sectioned task displayed further down the page.
    const todoHeader = [...fixture.nativeElement.querySelectorAll('app-section-header')].find(
      (header: HTMLElement) => header.textContent?.includes('To Do'),
    ) as HTMLElement | undefined;
    expect(todoHeader?.querySelector('.section-header-count')?.textContent?.trim()).toBe('1');
  });

  it('creates a section inline and offers a safe delete confirmation', async () => {
    await configure(baseProject);
    projectServiceStub.getSections.and.resolveTo([planningSection]);
    projectServiceStub.createSection.and.resolveTo({
      ...planningSection,
      id: 'section-2',
      name: 'Bookings',
    });

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.add-section-button').click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.section-create-row input');
    input.value = 'Bookings';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await (fixture.componentInstance as any).confirmCreateSection();
    fixture.detectChanges();

    expect(projectServiceStub.createSection).toHaveBeenCalledWith('project-1', {
      name: 'Bookings',
    });
    expect(fixture.nativeElement.textContent).toContain('Bookings');

    (fixture.componentInstance as any).askDeleteSection(planningSection);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Its tasks will stay in this project.');
  });

  it('displays archived banner and allows restoration when archived', async () => {
    const archivedProject: Project = {
      ...baseProject,
      archivedAt: '2026-04-10T10:00:00.000Z',
    };
    await configure(archivedProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Archived project');
    expect(text).toContain('Restore project');

    const restoreBtn = fixture.nativeElement.querySelector('.restore-button');
    expect(restoreBtn).toBeTruthy();
    restoreBtn.click();
    expect(projectServiceStub.unarchiveProject).toHaveBeenCalledWith('project-1');
  });
});
