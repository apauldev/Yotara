import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import { TaskListPageComponent } from './task-list-page.component';
import { TaskService } from '../../../../core/services/task.service';
import { ProjectService } from '../../../../core/services/project.service';
import { LabelService } from '../../../../core/services/label.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { CaptureBarComponent } from '../../components/capture-bar.component';
import { Task } from '@yotara/shared';

describe('TaskListPageComponent', () => {
  let mockTaskService: any;
  let mockProjectService: any;
  let mockLabelService: any;
  let mockAuthStateService: any;
  let mockActivatedRoute: any;
  let mockRouter: any;

  beforeEach(async () => {
    localStorage.clear();
    mockTaskService = {
      loading: signal(false),
      creating: signal(false),
      error: signal<string | null>(null),
      tasks: signal([]),
      inboxTasks: signal([]),
      todayTasks: signal([]),
      todayCompletedTasks: signal([]),
      overdueTasks: signal([]),
      upcomingTasks: signal([]),
      upcomingTaskGroups: signal([]),
      upcomingBucketForTask: jasmine.createSpy().and.returnValue('Later'),
      createTask: jasmine.createSpy().and.returnValue(Promise.resolve({})),
    };

    mockProjectService = {
      projects: signal([{ id: '1', name: 'Inbox' }]),
    };

    mockLabelService = {
      labels: signal([]),
    };

    mockAuthStateService = {
      user: signal({ id: 'user-1', captureBehavior: 'quick' }),
    };

    mockActivatedRoute = {
      queryParamMap: of(new Map([['view', 'inbox']])),
      snapshot: {
        queryParamMap: new Map([['view', 'inbox']]),
      },
    };

    mockRouter = {
      url: '/tasks?view=inbox',
      navigate: jasmine.createSpy(),
    };

    await TestBed.configureTestingModule({
      imports: [TaskListPageComponent],
      providers: [
        provideMarkdown(),
        provideNoopAnimations(),
        { provide: TaskService, useValue: mockTaskService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: LabelService, useValue: mockLabelService },
        { provide: AuthStateService, useValue: mockAuthStateService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  describe('View Mode Rendering', () => {
    it('renders the inbox view by default', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Inbox');
      expect(fixture.nativeElement.textContent).toContain('Clear skies');
    });

    it('renders the today view when requested', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'today']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Today');
      const text = fixture.nativeElement.textContent;
      expect(text.toLowerCase()).toMatch(/daily clarity|the yotara journal/);
    });

    it('renders the upcoming view when requested', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'upcoming']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Upcoming');
      expect(fixture.nativeElement.textContent).toContain('Nothing is crowding the horizon');
    });

    it('shows all groups in upcoming view without pagination controls', () => {
      const mockTasks: Partial<Task>[] = Array.from({ length: 12 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Upcoming task ${i + 1}`,
        createdAt: `2026-05-${20 + i}T10:00:00Z`,
        dueDate: `2026-05-${20 + i}`,
      }));
      mockTaskService.upcomingTasks.set(mockTasks as Task[]);
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'upcoming']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      // All tasks shown in a single view (no paginator splitting groups)
      expect(fixture.nativeElement.textContent).toContain('12 tasks');
      const paginator = fixture.debugElement.query(By.css('app-pagination'));
      expect(paginator).toBeNull();
    });

    it('renders the insight panel in inbox, today, and upcoming views', () => {
      ['inbox', 'today', 'upcoming'].forEach((view) => {
        mockActivatedRoute.queryParamMap = of(new Map([['view', view]]));
        const fixture = TestBed.createComponent(TaskListPageComponent);
        fixture.detectChanges();
        const panel = fixture.debugElement.query(By.css('.insight-panel'));
        expect(panel).toBeTruthy();
      });
    });

    it('dismisses the insight panel when the x is clicked', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();
      const dismissBtn = fixture.debugElement.query(By.css('.insight-dismiss'));
      dismissBtn.nativeElement.click();
      fixture.detectChanges();
      const panel = fixture.debugElement.query(By.css('.insight-panel'));
      expect(panel).toBeNull();
    });
  });

  describe('Inbox Capture', () => {
    it('quick captures a task when behavior is quick', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.setTitle('Quick task');
      await (fixture.componentInstance as any).handleCapture();

      expect(mockTaskService.createTask).toHaveBeenCalled();
      const args = mockTaskService.createTask.calls.mostRecent().args[0];
      expect(args.title).toBe('Quick task');
    });

    it('opens task workspace modal when behavior is capture', () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'capture' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const workspaceDebugEl = fixture.debugElement.query(
        By.directive(PersonalTaskWorkspaceComponent),
      );
      const workspace = workspaceDebugEl.componentInstance as PersonalTaskWorkspaceComponent;
      spyOn(workspace, 'openCreateTaskModal');

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.setTitle('Capture task');
      fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
      fixture.detectChanges();

      expect(workspace.openCreateTaskModal).toHaveBeenCalled();
    });

    it('always opens modal when "Add task with details" button is clicked', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const workspaceDebugEl = fixture.debugElement.query(
        By.directive(PersonalTaskWorkspaceComponent),
      );
      const workspace = workspaceDebugEl.componentInstance as PersonalTaskWorkspaceComponent;
      spyOn(workspace, 'openCreateTaskModal');

      const captureBarDebugEl = fixture.debugElement.query(By.directive(CaptureBarComponent));
      const captureBar = captureBarDebugEl.componentInstance as CaptureBarComponent;
      captureBar.setTitle('Force capture');

      // Simulate clicking the details button by setting the type and triggering capture
      captureBar.setSubmissionType('capture');
      await (fixture.componentInstance as any).handleCapture();

      expect(workspace.openCreateTaskModal).toHaveBeenCalled();
      expect(mockTaskService.createTask).not.toHaveBeenCalled();
    });

    it('shows capture error when title is empty', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBarDebugEl = fixture.debugElement.query(By.directive(CaptureBarComponent));
      const captureBar = captureBarDebugEl.componentInstance as CaptureBarComponent;
      captureBar.setTitle('   ');
      captureBarDebugEl.query(By.css('form')).triggerEventHandler('ngSubmit', null);
      fixture.detectChanges();

      expect(captureBar.getError()).toBe('Add a task title to capture it.');
    });

    it('clears capture form after successful save', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.setTitle('Test task');
      fixture.componentInstance['handleTaskSaved']('create');

      expect(captureBar.getTitle()).toBe('');
    });

    it('displays randomized insight prompts in inbox view', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      const foundClarity = text.includes('Daily Clarity');
      const foundJournal = text.includes('The Yotara Journal');
      expect(foundClarity || foundJournal).toBeTrue();
    });
  });

  describe('Task Editing', () => {
    it('calls editTask when task is selected', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();
      const workspaceDebugEl = fixture.debugElement.query(
        By.directive(PersonalTaskWorkspaceComponent),
      );
      const workspace = workspaceDebugEl.componentInstance as PersonalTaskWorkspaceComponent;
      spyOn(workspace, 'editTask');

      const mockTask: Partial<Task> = {
        id: '1',
        title: 'Test task',
        completed: false,
        description: '',
        priority: 'medium',
        projectId: '1',
      };

      fixture.componentInstance['editTask'](mockTask as Task);

      expect(workspace.editTask).toHaveBeenCalledWith(mockTask as Task);
    });
  });

  describe('Loading and Error States', () => {
    it('displays loading state in inbox', () => {
      mockTaskService.loading = signal(true);
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Loading your inbox');
    });

    it('keeps the existing list visible while refreshing inbox tasks', () => {
      mockTaskService.loading = signal(true);
      mockTaskService.tasks.set([
        {
          id: '1',
          title: 'Visible task',
          createdAt: '2023-01-01T10:00:00Z',
        } as Task,
      ]);
      mockTaskService.inboxTasks.set([
        {
          id: '1',
          title: 'Visible task',
          createdAt: '2023-01-01T10:00:00Z',
        } as Task,
      ]);
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Loading your inbox');
      expect(fixture.nativeElement.textContent).toContain('Visible task');
    });

    it('displays error state in today', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'today']]));
      mockTaskService.error = signal('Failed to load tasks');
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Failed to load tasks');
    });
  });

  describe('Sorting and Pagination', () => {
    it('sorts inbox tasks by date by default', () => {
      const mockTasks: Partial<Task>[] = [
        { id: '1', title: 'Task B', createdAt: '2023-01-02T10:00:00Z', dueDate: undefined },
        { id: '2', title: 'Task A', createdAt: '2023-01-01T10:00:00Z', dueDate: undefined },
      ];
      mockTaskService.inboxTasks.set(mockTasks as Task[]);
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const processed = (fixture.componentInstance as any).processedInboxTasks();
      expect(processed[0].id).toBe('1');
    });

    it('sorts inbox tasks alphabetically when requested', () => {
      const mockTasks: Partial<Task>[] = [
        { id: '1', title: 'Task B', createdAt: '2023-01-02T10:00:00Z', dueDate: undefined },
        { id: '2', title: 'Task A', createdAt: '2023-01-01T10:00:00Z', dueDate: undefined },
      ];
      mockTaskService.inboxTasks.set(mockTasks as Task[]);
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).sortOption.set('alpha');
      fixture.detectChanges();

      const processed = (fixture.componentInstance as any).processedInboxTasks();
      expect(processed[0].id).toBe('2');
    });

    it('paginates inbox tasks correctly', () => {
      const mockTasks: Partial<Task>[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Task ${i + 1}`,
        createdAt: `2023-01-${15 - i}T10:00:00Z`,
        dueDate: undefined,
      }));
      mockTaskService.inboxTasks.set(mockTasks as Task[]);
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).pageSize.set(10);
      (fixture.componentInstance as any).currentPage.set(1);
      fixture.detectChanges();

      let processed = (fixture.componentInstance as any).processedInboxTasks();
      expect(processed.length).toBe(10);
      expect(processed[0].id).toBe('1');

      (fixture.componentInstance as any).currentPage.set(2);
      fixture.detectChanges();

      processed = (fixture.componentInstance as any).processedInboxTasks();
      expect(processed.length).toBe(5);
      expect(processed[0].id).toBe('11');
    });

    it('resets currentPage when sortOption changes', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).currentPage.set(2);
      (fixture.componentInstance as any).sortOption.set('alpha');
      fixture.detectChanges();

      expect((fixture.componentInstance as any).currentPage()).toBe(1);
    });

    it('resets currentPage when pageSize changes', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      (fixture.componentInstance as any).currentPage.set(2);
      (fixture.componentInstance as any).pageSize.set(25);
      fixture.detectChanges();

      expect((fixture.componentInstance as any).currentPage()).toBe(1);
    });
  });

  describe('FAB Button', () => {
    it('renders FAB button in all views', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const fab = fixture.debugElement.query(By.css('.fab'));
      expect(fab).toBeTruthy();
      expect(fab.nativeElement.getAttribute('aria-label')).toBe('Quick add task');
    });
  });
});
