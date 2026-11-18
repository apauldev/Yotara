import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap, ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import type { Project, ProjectSection } from '@yotara/shared';
import { ProjectDetailPageComponent } from './project-detail-page.component';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { LabelService } from '../../../core/services/label.service';
import { StatusService } from '../../../core/services/status.service';

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
  let taskServiceStub: {
    error: ReturnType<typeof signal>;
    version: ReturnType<typeof signal>;
    creating: ReturnType<typeof signal>;
    createTask: jasmine.Spy;
    updateTask: jasmine.Spy;
    updateTasks: jasmine.Spy;
    getUnassignedTasks: jasmine.Spy;
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

    taskServiceStub = {
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

  const sectionOne: ProjectSection = {
    id: 'section-1',
    projectId: 'project-1',
    name: 'Planning',
    sortOrder: 0,
    taskCount: 0,
    completedTaskCount: 0,
    openTaskCount: 0,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  };

  const sectionTwo: ProjectSection = {
    ...sectionOne,
    id: 'section-2',
    name: 'Delivery',
    sortOrder: 1,
  };

  async function createFixture(project: Project = baseProject, sections: ProjectSection[] = []) {
    await configure(project);
    projectServiceStub.getSections.and.resolveTo(sections);
    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
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

  it('toasts the actual updated count when tasks are added to the project', async () => {
    await configure(baseProject);

    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const statusSpy = spyOn((fixture.componentInstance as any).statusService, 'show');

    // Case 1: All tasks updated (2 of 2)
    taskServiceStub.updateTasks.and.resolveTo({ ok: true, updated: 2 });
    await (fixture.componentInstance as any).confirmAddExistingTasks({
      taskIds: ['task-1', 'task-2'],
      patch: { projectId: 'project-1' },
    });
    expect(statusSpy).toHaveBeenCalledWith('2 tasks added to this project', 'success', 4000);

    // Case 2: Partial update (2 of 3)
    statusSpy.calls.reset();
    taskServiceStub.updateTasks.and.resolveTo({ ok: true, updated: 2 });
    await (fixture.componentInstance as any).confirmAddExistingTasks({
      taskIds: ['task-1', 'task-2', 'task-3'],
      patch: { projectId: 'project-1' },
    });
    expect(statusSpy).toHaveBeenCalledWith('2 of 3 tasks added to this project', 'success', 4000);

    // Case 3: 0 tasks updated
    statusSpy.calls.reset();
    taskServiceStub.updateTasks.and.resolveTo({ ok: true, updated: 0 });
    await (fixture.componentInstance as any).confirmAddExistingTasks({
      taskIds: ['task-1', 'task-2'],
      patch: { projectId: 'project-1' },
    });
    expect(statusSpy).toHaveBeenCalledWith('No tasks were added to this project', 'info', 4000);
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

  it('validates section creation, handles failures, and ignores invalid moves', async () => {
    const fixture = await createFixture(baseProject, [sectionOne, sectionTwo]);
    const cmp = fixture.componentInstance as any;
    const showSpy = spyOn(TestBed.inject(StatusService), 'show');

    cmp.startCreateSection();
    cmp.newSectionName.set('   ');
    await cmp.confirmCreateSection();
    expect(cmp.sectionNameError()).toBe('Give the section a name.');
    expect(projectServiceStub.createSection).not.toHaveBeenCalled();

    cmp.cancelCreateSection();
    expect(cmp.creatingSection()).toBeFalse();

    projectServiceStub.createSection.and.rejectWith(new Error('nope'));
    cmp.startCreateSection();
    cmp.newSectionName.set('Broken');
    await cmp.confirmCreateSection();
    expect(cmp.sectionNameError()).toBe('Could not add the section right now.');

    expect(cmp.canMoveSection(sectionOne, -1)).toBeFalse();
    expect(cmp.canMoveSection(sectionTwo, 1)).toBeFalse();
    await cmp.moveSection(sectionOne, -1);
    expect(projectServiceStub.reorderSections).not.toHaveBeenCalled();
    cmp.onSectionDrop({
      previousIndex: 0,
      currentIndex: 0,
    } as any);
    expect(projectServiceStub.reorderSections).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('sorts tasks by order, then createdAt, then id', async () => {
    await configure(baseProject);
    projectServiceStub.getProjectTasks.and.resolveTo([
      { ...activeTask, id: 'task-b', order: 1, createdAt: '2026-04-02T10:00:00.000Z' },
      { ...activeTask, id: 'task-a', order: 1, createdAt: '2026-04-01T10:00:00.000Z' },
      { ...activeTask, id: 'task-c', order: 1, createdAt: '2026-04-01T10:00:00.000Z' },
    ]);
    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const ids = (fixture.componentInstance as any)
      .activeProjectTasks()
      .map((task: { id: string }) => task.id);
    expect(ids).toEqual(['task-a', 'task-c', 'task-b']);
  });

  it('renames sections with validation, no-op detection, and error handling', async () => {
    const fixture = await createFixture(baseProject, [sectionOne]);
    const cmp = fixture.componentInstance as any;

    cmp.startRenameSection(sectionOne);
    expect(cmp.editingSectionId()).toBe('section-1');
    expect(cmp.sectionDraftName()).toBe('Planning');

    cmp.sectionDraftName.set('   ');
    await cmp.confirmRenameSection(sectionOne);
    expect(cmp.sectionNameError()).toBe('Give the section a name.');

    cmp.sectionDraftName.set('Planning');
    await cmp.confirmRenameSection(sectionOne);
    expect(cmp.editingSectionId()).toBeNull();
    expect(projectServiceStub.updateSection).not.toHaveBeenCalled();

    const renamed = { ...sectionOne, name: 'Refined' };
    projectServiceStub.updateSection.and.resolveTo(renamed);
    cmp.startRenameSection(sectionOne);
    cmp.sectionDraftName.set('Refined');
    await cmp.confirmRenameSection(sectionOne);
    expect(projectServiceStub.updateSection).toHaveBeenCalledWith('section-1', { name: 'Refined' });
    expect(cmp.sections()[0].name).toBe('Refined');
    expect(cmp.editingSectionId()).toBeNull();

    projectServiceStub.updateSection.and.rejectWith(new Error('nope'));
    cmp.startRenameSection(renamed);
    cmp.sectionDraftName.set('Broken');
    await cmp.confirmRenameSection(renamed);
    expect(cmp.sectionNameError()).toBe('Could not rename the section right now.');
  });

  it('moves sections via menu and drop, restoring order on failure', async () => {
    const fixture = await createFixture(baseProject, [sectionOne, sectionTwo]);
    const cmp = fixture.componentInstance as any;
    const showSpy = spyOn(TestBed.inject(StatusService), 'show');

    expect(cmp.canMoveSection(sectionOne, -1)).toBeFalse();
    expect(cmp.canMoveSection(sectionOne, 1)).toBeTrue();
    expect(cmp.canMoveSection(sectionTwo, 1)).toBeFalse();

    projectServiceStub.reorderSections.and.resolveTo([sectionTwo, sectionOne]);
    await cmp.moveSection(sectionTwo, -1);
    expect(projectServiceStub.reorderSections).toHaveBeenCalledWith('project-1', [
      'section-2',
      'section-1',
    ]);

    projectServiceStub.reorderSections.and.rejectWith(new Error('nope'));
    await cmp.moveSection(sectionTwo, 1);
    expect(showSpy).toHaveBeenCalledWith(
      'Could not reorder your sections right now.',
      'error',
      5000,
    );

    projectServiceStub.reorderSections.and.resolveTo([sectionOne, sectionTwo]);
    cmp.onSectionDrop({
      previousIndex: 1,
      currentIndex: 0,
      previousContainer: undefined,
      container: undefined,
      isPointerOverContainer: true,
      item: undefined,
      distance: { x: 0, y: 0 },
      dropPoint: { x: 0, y: 0 },
      pointerPosition: undefined,
      event: new Event('drop'),
    } as any);
    await fixture.whenStable();
    expect(projectServiceStub.reorderSections).toHaveBeenCalledWith('project-1', [
      'section-2',
      'section-1',
    ]);
  });

  it('toggles section menus/collapse and opens the create modal in a section', async () => {
    const fixture = await createFixture(baseProject, [sectionOne]);
    const cmp = fixture.componentInstance as any;
    const event = new MouseEvent('click');
    const stopSpy = spyOn(event, 'stopPropagation');

    cmp.toggleSectionMenu('section-1', event);
    expect(cmp.sectionMenuId()).toBe('section-1');
    cmp.toggleSectionMenu('section-1', event);
    expect(cmp.sectionMenuId()).toBeNull();

    const before = cmp.isSectionCollapsed('section-1');
    cmp.toggleSectionCollapsed('section-1');
    expect(cmp.isSectionCollapsed('section-1')).toBe(!before);
    // PreferencesStore persists to localStorage; restore so later tests render
    // the section's tasks normally.
    cmp.toggleSectionCollapsed('section-1');

    const openSpy = spyOn(cmp.workspace(), 'openCreateTaskModal');
    cmp.openAddTaskInSection(sectionOne, event);
    expect(openSpy).toHaveBeenCalledWith('project-1', null, [], '', 'section-1');

    cmp.askDeleteSection(sectionOne, event);
    expect(cmp.sectionToDelete()).toEqual(sectionOne);
    cmp.closeDeleteSection();
    expect(cmp.sectionToDelete()).toBeNull();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('confirms section deletion with success and error toasts', async () => {
    const fixture = await createFixture(baseProject, [sectionOne]);
    const cmp = fixture.componentInstance as any;
    const showSpy = spyOn(TestBed.inject(StatusService), 'show');

    await cmp.confirmDeleteSection();
    expect(projectServiceStub.deleteSection).not.toHaveBeenCalled();

    cmp.sectionToDelete.set(sectionOne);
    projectServiceStub.deleteSection.and.rejectWith(new Error('nope'));
    await cmp.confirmDeleteSection();
    expect(showSpy).toHaveBeenCalledWith('Could not delete the section right now.', 'error', 5000);

    projectServiceStub.deleteSection.and.resolveTo(undefined);
    await cmp.confirmDeleteSection();
    expect(cmp.sections()).toEqual([]);
    expect(showSpy).toHaveBeenCalledWith(
      'Section deleted · its tasks stayed in this project',
      'info',
      5000,
    );
    expect(cmp.sectionToDelete()).toBeNull();
  });

  it('runs project actions: pin, complete with undo, reopen, archive, and delete', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance as any;
    const showSpy = spyOn(TestBed.inject(StatusService), 'show');
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const event = new MouseEvent('click');

    await cmp.togglePinned(event);
    expect(projectServiceStub.updateProject).toHaveBeenCalledWith('project-1', { pinned: true });

    // Gated: this project still has an open task.
    await cmp.completeProject(event);
    expect(projectServiceStub.completeProject).not.toHaveBeenCalled();

    cmp.project.set({ ...baseProject, openTaskCount: 0 });
    await cmp.completeProject(event);
    expect(projectServiceStub.completeProject).toHaveBeenCalledWith('project-1');
    const completionCall = showSpy.calls.all().find((call) => call.args[0] === 'Project completed');
    expect(completionCall).toBeTruthy();
    (completionCall!.args[3] as any).action.callback();
    await fixture.whenStable();
    expect(projectServiceStub.reopenProject).toHaveBeenCalled();

    await cmp.reopenProject(event);
    await cmp.archiveProject(event);
    await cmp.unarchiveProject(event);
    expect(projectServiceStub.reopenProject).toHaveBeenCalledWith('project-1');
    expect(projectServiceStub.archiveProject).toHaveBeenCalledWith('project-1');
    expect(projectServiceStub.unarchiveProject).toHaveBeenCalledWith('project-1');

    cmp.viewOpenTasks(event);
    cmp.askDeleteProject(event);
    expect(cmp.deleteModalOpen()).toBeTrue();
    cmp.closeDeleteModal();
    expect(cmp.deleteModalOpen()).toBeFalse();

    await cmp.confirmDeleteProject({ keepTasks: false });
    expect(projectServiceStub.deleteProject).toHaveBeenCalledWith('project-1', false);
    expect(showSpy).toHaveBeenCalledWith('Project deleted', 'info', 4000);
  });

  it('formats and evaluates target dates and retries loading', async () => {
    const fixture = await createFixture({ ...baseProject, targetDate: '2020-01-02' } as Project);
    const cmp = fixture.componentInstance as any;

    expect(cmp.formatTargetDate('2026-04-03')).toBe('Apr 3, 2026');
    expect(cmp.formatTargetDate(null)).toBeNull();
    expect(cmp.isTargetDateOverdue('2020-01-02')).toBeTrue();
    expect(cmp.isTargetDateOverdue('2999-01-02')).toBeFalse();
    expect(cmp.isTargetDateOverdue(null)).toBeFalse();

    const getProjectCalls = projectServiceStub.getProject.calls.count();
    cmp.retryLoad();
    await fixture.whenStable();
    expect(projectServiceStub.getProject.calls.count()).toBeGreaterThan(getProjectCalls);
  });

  it('shows an error state when loading the project fails', async () => {
    await configure(baseProject);
    projectServiceStub.getProject.and.rejectWith(new Error('nope'));
    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const cmp = fixture.componentInstance as any;
    expect(cmp.projectState()).toBe('error');
    expect(cmp.loadError()).toBe('Could not load this project right now.');
  });

  it('treats missing project tasks as a not-found state', async () => {
    await configure(baseProject);
    projectServiceStub.getProjectTasks.and.resolveTo(null);
    const fixture = TestBed.createComponent(ProjectDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance['projectState']()).toBe('not-found');
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
