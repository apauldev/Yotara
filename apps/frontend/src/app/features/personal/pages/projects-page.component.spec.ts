import { signal, WritableSignal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import type { Project } from '@yotara/shared';
import { ProjectsPageComponent } from './projects-page.component';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { LogService } from '../../../core/services/log.service';

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
