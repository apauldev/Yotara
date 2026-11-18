import { signal, WritableSignal } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import type { Project } from '@yotara/shared';
import { ProjectsPageComponent } from './projects-page.component';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { LogService } from '../../../core/services/log.service';
import { StatusService } from '../../../core/services/status.service';
import { projectPaletteFor } from '../project-presentation';

describe('ProjectsPageComponent', () => {
  let projects: WritableSignal<Project[]>;
  let getProjectsByStatusSpy: jasmine.Spy;

  beforeEach(async () => {
    projects = signal<Project[]>([
      {
        id: 'project-1',
        name: 'Launch Yotara MVP',
        description: 'Core release scope',
        color: 'sage' as const,
        kind: 'project',
        sortOrder: 0,
        pinned: false,
        ownerId: 'user-1',
        taskCount: 18,
        completedTaskCount: 11,
        openTaskCount: 7,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
      },
    ]);

    getProjectsByStatusSpy = jasmine.createSpy('getProjectsByStatus').and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [ProjectsPageComponent],
      providers: [
        provideRouter([]),
        provideMarkdown(),
        {
          provide: ProjectService,
          useValue: {
            projects,
            loading: signal(false),
            saving: signal(false),
            error: signal(null),
            version: signal(0),
            getProjectsByStatus: getProjectsByStatusSpy,
            createProject: jasmine.createSpy('createProject'),
            updateProject: jasmine.createSpy('updateProject'),
            completeProject: jasmine.createSpy('completeProject'),
            reopenProject: jasmine.createSpy('reopenProject'),
            archiveProject: jasmine.createSpy('archiveProject'),
            unarchiveProject: jasmine.createSpy('unarchiveProject'),
            deleteProject: jasmine.createSpy('deleteProject'),
            reorderProjects: jasmine.createSpy('reorderProjects').and.resolveTo([]),
          },
        },
        {
          provide: TaskService,
          useValue: {
            version: signal(0),
            getDeletedTasks: jasmine.createSpy('getDeletedTasks').and.returnValue(
              of({
                data: [],
                meta: {
                  total: 0,
                  page: 1,
                  pageSize: 10,
                  totalPages: 0,
                  hasNextPage: false,
                  hasPreviousPage: false,
                },
              }),
            ),
            restoreTask: jasmine.createSpy('restoreTask').and.resolveTo(undefined),
          },
        },
        { provide: LogService, useValue: { error: jasmine.createSpy('error') } },
      ],
    }).compileComponents();
  });

  it('renders real project cards and the create affordance', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Launch Yotara MVP');
    expect(text).toContain('Core release scope');
    expect(text).toContain('61%');
    expect(text.toLowerCase()).toContain('active');
    expect(text).toContain('New Project');

    // Check for edit button by aria-label
    const editBtn = fixture.nativeElement.querySelector('[aria-label*="Edit project"]');
    expect(editBtn).toBeTruthy();
  });

  it('drives the color dot from the shared palette via an inline accent', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const accent = () =>
      (
        fixture.debugElement.query(By.css('.project-color-dot')).nativeElement as HTMLElement
      ).style.getPropertyValue('--project-accent');

    expect(accent()).toBe(projectPaletteFor('sage').accent);

    projects.set([{ ...projects()[0], color: 'clay' }]);
    fixture.detectChanges();
    expect(accent()).toBe(projectPaletteFor('clay').accent);
  });

  it('shows open task counts in the always-visible project cell', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.open-task-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('7 open tasks');
    expect(badge.closest('.col-identification')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('61%');
  });

  it('uses singular copy when one task is open', () => {
    const [project] = projects();
    projects.set([{ ...project, openTaskCount: 1 }]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.open-task-badge');
    expect(badge.textContent.trim()).toBe('1 open task');
  });

  it('filters by active, completed, and archived tabs', async () => {
    const [project] = projects();
    const completedProject: Project = {
      ...project,
      id: 'project-2',
      name: 'Completed Launch',
      completedAt: '2026-04-05T10:00:00.000Z',
      openTaskCount: 0,
      completedTaskCount: 5,
      taskCount: 5,
    };
    const archivedProject: Project = {
      ...project,
      id: 'project-3',
      name: 'Archived Exploration',
      archivedAt: '2026-04-06T10:00:00.000Z',
    };
    projects.set([project, completedProject]);
    getProjectsByStatusSpy.and.resolveTo([archivedProject]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // Default tab is active: shows project-1
    expect(fixture.nativeElement.textContent).toContain('Launch Yotara MVP');
    expect(fixture.nativeElement.textContent).not.toContain('Completed Launch');

    // Switch to completed
    fixture.componentInstance['setTab']('completed');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Completed Launch');
    expect(fixture.nativeElement.textContent).not.toContain('Launch Yotara MVP');
  });

  it('renders the Trash list from the tab next to Archived', async () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const tabs = fixture.debugElement
      .queryAll(By.css('[role="tab"]'))
      .map((tab) => tab.nativeElement.textContent.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Active 1', 'Completed 0', 'Archived 0', 'Trash']);

    fixture.componentInstance['setTab']('trash');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.css('app-trash-list'))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Trash is empty');
    expect(fixture.nativeElement.textContent).not.toContain('Launch Yotara MVP');
  });

  it('labels Ongoing areas without showing a progress percentage', () => {
    const [project] = projects();
    projects.set([{ ...project, name: 'Home', kind: 'ongoing' }]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ongoing area');
    expect(fixture.nativeElement.querySelector('.progress-ongoing')).toBeTruthy();
  });

  it('persists a new order when a project is moved down', () => {
    const [first] = projects();
    const second: Project = {
      ...first,
      id: 'project-2',
      name: 'Second project',
      sortOrder: 1,
    };
    projects.set([first, second]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const service = TestBed.inject(ProjectService);
    fixture.componentInstance['moveProject'](first, 1);

    expect(service.reorderProjects).toHaveBeenCalledWith(['project-2', 'project-1']);
    expect(fixture.nativeElement.querySelector('.drag-handle')).toBeTruthy();
  });

  it('includes completed and archived ids in the reorder payload', async () => {
    const [first] = projects();
    const second: Project = { ...first, id: 'project-2', name: 'Second', sortOrder: 1 };
    const completed: Project = {
      ...first,
      id: 'project-3',
      name: 'Completed',
      completedAt: '2026-04-05T10:00:00.000Z',
      openTaskCount: 0,
    };
    const archived: Project = {
      ...first,
      id: 'project-4',
      name: 'Archived',
      archivedAt: '2026-04-06T10:00:00.000Z',
    };
    projects.set([first, second, completed]);
    getProjectsByStatusSpy.and.resolveTo([archived]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const service = TestBed.inject(ProjectService);
    fixture.componentInstance['moveProject'](first, 1);

    // The API validates the full non-retired set, so tabs outside Active must
    // still be present in the payload even though they aren't being dragged.
    expect(service.reorderProjects).toHaveBeenCalledWith([
      'project-2',
      'project-1',
      'project-3',
      'project-4',
    ]);
  });

  it('builds focus copy from active projects and switches tab lists', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    expect(cmp.focusHeadline()).toContain('Launch Yotara MVP');
    expect(cmp.focusBody()).toContain('11');

    cmp.setTab('archived');
    expect(cmp.currentTabProjects()).toEqual([]);
    cmp.setTab('trash');
    expect(cmp.currentTabProjects()).toEqual([]);
  });

  it('ignores tab keys and moves that are not applicable', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const button = fixture.nativeElement.querySelector('#projects-tab-active') as HTMLElement;

    cmp.onTabKeydown({ key: 'Enter', target: button, currentTarget: button, preventDefault() {} });
    expect(cmp.activeTab()).toBe('active');
    cmp.onTabKeydown({
      key: 'ArrowRight',
      target: document.body,
      currentTarget: button,
      preventDefault() {},
    });
    expect(cmp.activeTab()).toBe('active');

    const project = projects()[0];
    expect(cmp.canMove(project, -1)).toBeFalse();
    cmp.moveProject(project, -1);
    expect(TestBed.inject(ProjectService).reorderProjects).not.toHaveBeenCalled();
    cmp.onProjectDrop({ previousIndex: 0, currentIndex: 0 } as any, false);
    expect(TestBed.inject(ProjectService).reorderProjects).not.toHaveBeenCalled();
  });

  it('navigates tabs with Arrow/Home/End keys', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const tabs = ['active', 'completed', 'archived', 'trash'];

    const press = (key: string, tab: string) => {
      const button = fixture.nativeElement.querySelector(`#projects-tab-${tab}`) as HTMLElement;
      button.focus();
      cmp.onTabKeydown({ key, target: button, currentTarget: button, preventDefault() {} });
      fixture.detectChanges();
    };

    press('ArrowRight', 'active');
    expect(cmp.activeTab()).toBe('completed');
    press('ArrowLeft', 'completed');
    expect(cmp.activeTab()).toBe('active');
    press('End', 'active');
    expect(cmp.activeTab()).toBe('trash');
    press('Home', 'trash');
    expect(cmp.activeTab()).toBe('active');
    press('ArrowLeft', 'active');
    expect(cmp.activeTab()).toBe('trash');
    press('ArrowRight', 'trash');
    expect(cmp.activeTab()).toBe('active');
    expect(tabs.length).toBe(4);
  });

  it('opens, edits, and closes the project modal', async () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const event = new MouseEvent('click');

    cmp.openCreateModal();
    expect(cmp.modalMode()).toBe('create');
    expect(cmp.createModalOpen()).toBeTrue();
    expect(cmp.selectedProject()).toBeNull();

    cmp.openEditModal(projects()[0], event);
    expect(cmp.modalMode()).toBe('edit');
    expect(cmp.selectedProject()).toEqual(projects()[0]);

    cmp.closeProjectModal();
    expect(cmp.createModalOpen()).toBeFalse();
    expect(cmp.selectedProject()).toBeNull();
    expect(cmp.modalMode()).toBe('create');
  });

  it('creates and edits projects through the modal save', async () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const service = TestBed.inject(ProjectService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    const payload = { name: 'New Project', description: null } as any;
    (service.createProject as jasmine.Spy).and.resolveTo({ ...projects()[0], id: 'project-2' });
    await cmp.createProject(payload);
    expect(service.createProject).toHaveBeenCalledWith({
      name: 'New Project',
      description: undefined,
    });
    expect(cmp.createModalOpen()).toBeFalse();

    cmp.openEditModal(projects()[0]);
    await cmp.createProject({ name: 'Renamed', description: 'x' } as any);
    expect(service.updateProject).toHaveBeenCalledWith('project-1', {
      name: 'Renamed',
      description: 'x',
    });
    expect(cmp.createModalOpen()).toBeFalse();
  });

  it('runs row actions: pin, complete with undo, reopen, archive, unarchive, delete', async () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const service = TestBed.inject(ProjectService);
    const showSpy = spyOn(TestBed.inject(StatusService), 'show');
    const event = new MouseEvent('click');
    const project = projects()[0];

    cmp.toggleRowMenu(project, event);
    expect(cmp.rowMenuProjectId()).toBe('project-1');
    cmp.onDocumentClick();
    expect(cmp.rowMenuProjectId()).toBeNull();

    await cmp.togglePinned(project, event);
    expect(service.updateProject).toHaveBeenCalledWith('project-1', { pinned: true });

    // Gated while the project has open tasks.
    await cmp.completeProject(project, event);
    expect(service.completeProject).not.toHaveBeenCalled();

    const doneProject = { ...project, openTaskCount: 0 };
    await cmp.completeProject(doneProject, event);
    expect(service.completeProject).toHaveBeenCalledWith('project-1');
    const call = showSpy.calls.all().find((c) => c.args[0] === 'Project completed');
    expect(call).toBeTruthy();
    (call!.args[3] as any).action.callback();
    await fixture.whenStable();
    expect(service.reopenProject).toHaveBeenCalledWith('project-1');

    await cmp.reopenProject(project, event);
    await cmp.archiveProject(project, event);
    await cmp.unarchiveProject(project, event);
    expect(service.archiveProject).toHaveBeenCalledWith('project-1');
    expect(service.unarchiveProject).toHaveBeenCalledWith('project-1');

    cmp.viewOpenTasks(project, event);
    cmp.openProject('project-1');

    cmp.askDeleteProject(project, event);
    expect(cmp.deleteModalOpen()).toBeTrue();
    await cmp.confirmDeleteProject({ keepTasks: false });
    expect(service.deleteProject).toHaveBeenCalledWith('project-1', false);
    expect(cmp.deleteModalOpen()).toBeFalse();

    cmp.askDeleteProject(project, event);
    cmp.closeDeleteModal();
    expect(cmp.projectToDelete()).toBeNull();
  });

  it('exposes project status helpers', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const base = projects()[0];

    expect(cmp.getProjectStatus(base)).toBe('active');
    expect(cmp.getProjectStatus({ ...base, kind: 'ongoing' })).toBe('ongoing');
    expect(cmp.getProjectStatus({ ...base, completedAt: '2026-04-05T00:00:00Z' })).toBe(
      'completed',
    );
    expect(cmp.getProjectStatus({ ...base, archivedAt: '2026-04-06T00:00:00Z' })).toBe('archived');
    expect(cmp.getProjectStatusLabel({ ...base, kind: 'ongoing' })).toBe('Ongoing area');
    expect(cmp.getProjectStatusLabel(base)).toBe('Active');
    expect(cmp.formatTargetDate('2026-04-03')).toBe('Apr 3, 2026');
    expect(cmp.formatTargetDate(null)).toBeNull();
    expect(cmp.openTaskLabel(base)).toBe('7 open tasks');
    expect(cmp.openTaskLabel({ ...base, openTaskCount: 1 })).toBe('1 open task');
  });

  it('handles drag-drop reordering and reverts the optimistic order on failure', fakeAsync(() => {
    const second = { ...projects()[0], id: 'project-2', name: 'Second', sortOrder: 1 };
    projects.set([projects()[0], second]);
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const service = TestBed.inject(ProjectService);
    tick();

    cmp.onProjectDrop({ previousIndex: 1, currentIndex: 0 } as any, false);
    tick();
    expect(service.reorderProjects).toHaveBeenCalledWith(['project-2', 'project-1']);

    (service.reorderProjects as jasmine.Spy).and.rejectWith(new Error('nope'));
    cmp.onProjectDrop({ previousIndex: 0, currentIndex: 1 } as any, false);
    tick();
    flushMicrotasks();
    tick();
    expect(service.reorderProjects).toHaveBeenCalledTimes(2);
    expect(cmp.pendingOrder()).toBeNull();
  }));

  it('releases the optimistic order when the refreshed list never matches', fakeAsync(() => {
    const [first] = projects();
    const second: Project = { ...first, id: 'project-2', name: 'Second', sortOrder: 1 };
    projects.set([first, second]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['moveProject'](first, 1);
    tick();
    // The optimistic order is applied immediately after the drop.
    expect(fixture.componentInstance['currentTabProjects']().map((p) => p.id)).toEqual([
      'project-2',
      'project-1',
    ]);

    // The stub never refreshes the list to match, so the effect cannot release
    // the optimistic order — the timeout fallback must do it.
    tick(1600);
    expect(fixture.componentInstance['currentTabProjects']().map((p) => p.id)).toEqual([
      'project-1',
      'project-2',
    ]);
  }));
});
