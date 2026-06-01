import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';
import { of, Subject, throwError } from 'rxjs';
import { ArchivePageComponent } from './archive-page.component';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { LabelService } from '../../../core/services/label.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginatedResponse, Task } from '@yotara/shared';

const archivedTask = (overrides?: Partial<Task>): Task =>
  ({
    id: 'task-1',
    title: 'Submit the release notes',
    description: 'Final copy for v0.51',
    status: 'archived' as const,
    priority: 'medium' as const,
    completed: true,
    order: 0,
    permanentArchive: false,
    dueDate: null,
    simpleMode: false,
    bucket: 'personal-sanctuary' as const,
    projectId: 'project-1',
    parentId: null,
    labels: [],
    subtaskCount: 0,
    subtaskCompletedCount: 0,
    recurrenceRule: null,
    deletedAt: null,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-05T10:00:00.000Z',
    ...overrides,
  }) as Task;

function paginatedResponse(tasks: Task[]): PaginatedResponse<Task[]> {
  return {
    data: tasks,
    meta: {
      total: tasks.length,
      page: 1,
      pageSize: 10,
      totalPages: tasks.length === 0 ? 0 : 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

describe('ArchivePageComponent', () => {
  let mockTaskService: {
    loading: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
    revision: ReturnType<typeof signal>;
    getArchivedTasks: jasmine.Spy;
    updateTask: jasmine.Spy;
    deleteTask: jasmine.Spy;
  };

  beforeEach(async () => {
    mockTaskService = {
      loading: signal(false),
      error: signal<string | null>(null),
      revision: signal(0),
      getArchivedTasks: jasmine
        .createSpy('getArchivedTasks')
        .and.returnValue(of(paginatedResponse([]))),
      updateTask: jasmine.createSpy('updateTask').and.resolveTo(undefined),
      deleteTask: jasmine.createSpy('deleteTask').and.resolveTo(undefined),
    };

    const projectServiceStub = {
      projects: signal([{ id: 'project-1', name: 'Inbox' }]),
      saving: signal(false),
      error: signal<string | null>(null),
      getProject: jasmine.createSpy('getProject').and.resolveTo(null),
      getProjectTasks: jasmine.createSpy('getProjectTasks').and.resolveTo([]),
      updateProject: jasmine.createSpy('updateProject'),
      refreshProjects: jasmine.createSpy('refreshProjects'),
      createProject: jasmine.createSpy('createProject'),
      deleteProject: jasmine.createSpy('deleteProject'),
    };

    const labelServiceStub = {
      labels: signal([]),
    };

    await TestBed.configureTestingModule({
      imports: [ArchivePageComponent],
      providers: [
        provideMarkdown(),
        { provide: TaskService, useValue: mockTaskService },
        { provide: ProjectService, useValue: projectServiceStub },
        { provide: LabelService, useValue: labelServiceStub },
      ],
    }).compileComponents();
  });

  it('displays the archive page header', () => {
    const fixture = TestBed.createComponent(ArchivePageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Archive');
    expect(text).toContain('Completed tasks stay here');
  });

  describe('Loading state', () => {
    it('renders loading copy while archive is being fetched', () => {
      const pending = new Subject<PaginatedResponse<Task[]>>();
      mockTaskService.getArchivedTasks.and.returnValue(pending.asObservable());

      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Loading your recent completions');

      pending.next(paginatedResponse([]));
      pending.complete();
      fixture.detectChanges();
    });
  });

  describe('Error state', () => {
    it('renders the error message when fetching fails', () => {
      mockTaskService.getArchivedTasks.and.returnValue(throwError(() => new Error('boom')));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Could not load archive right now.');
    });
  });

  describe('Empty state', () => {
    it('renders the shared EmptyStateComponent with the archive icon', () => {
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(By.directive(EmptyStateComponent));
      expect(emptyState).toBeTruthy();

      const component = emptyState.componentInstance as EmptyStateComponent;
      expect(component.title).toBe('Nothing archived yet');
      expect(component.description).toContain('Completed work will appear here');

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Nothing archived yet');
      expect(text).toContain('Completed work will appear here');
    });

    it('does not render the empty state when there are archived tasks', () => {
      mockTaskService.getArchivedTasks.and.returnValue(of(paginatedResponse([archivedTask()])));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).not.toContain('Nothing archived yet');
      expect(text).toContain('Submit the release notes');
    });
  });

  describe('Archived task list', () => {
    it('renders each archived task', () => {
      mockTaskService.getArchivedTasks.and.returnValue(
        of(
          paginatedResponse([
            archivedTask(),
            archivedTask({ id: 'task-2', title: 'Draft the changelog' }),
          ]),
        ),
      );
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Submit the release notes');
      expect(text).toContain('Draft the changelog');
      expect(text).toContain('2 archived tasks');
    });

    it('renders archive action pills for each task card', () => {
      mockTaskService.getArchivedTasks.and.returnValue(of(paginatedResponse([archivedTask()])));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Make permanent');
    });

    it('highlights permanent archive pill when a task is permanently archived', () => {
      mockTaskService.getArchivedTasks.and.returnValue(
        of(paginatedResponse([archivedTask({ permanentArchive: true })])),
      );
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Permanent archive');
    });
  });

  describe('Permanent archive toggle', () => {
    it('toggles permanentArchive via the task service', async () => {
      const task = archivedTask();
      mockTaskService.getArchivedTasks.and.returnValue(of(paginatedResponse([task])));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      await (fixture.componentInstance as any).togglePermanentArchive(task);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', { permanentArchive: true });
    });
  });

  describe('Delete flow', () => {
    it('opens the confirm dialog when delete is requested', () => {
      mockTaskService.getArchivedTasks.and.returnValue(of(paginatedResponse([archivedTask()])));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).requestDelete({
        id: 'task-1',
        title: 'Submit the release notes',
      });
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Delete archived task?');
      expect(text).toContain('Delete forever');
    });

    it('calls deleteTask on the service when deletion is confirmed', async () => {
      mockTaskService.getArchivedTasks.and.returnValue(of(paginatedResponse([archivedTask()])));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).requestDelete({
        id: 'task-1',
        title: 'Submit the release notes',
      });
      fixture.detectChanges();

      await (fixture.componentInstance as any).deleteArchivedTask();

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith('task-1');
    });

    it('closes the confirm dialog when cancelled', () => {
      mockTaskService.getArchivedTasks.and.returnValue(of(paginatedResponse([archivedTask()])));
      const fixture = TestBed.createComponent(ArchivePageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).requestDelete({
        id: 'task-1',
        title: 'Submit the release notes',
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Delete archived task?');

      (fixture.componentInstance as any).closeDeleteConfirm();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Delete archived task?');
    });
  });
});
