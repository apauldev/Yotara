import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TaskListPageComponent } from './task-list-page.component';
import { TaskService } from '../../../../core/services/task.service';
import { ProjectService } from '../../../../core/services/project.service';
import { SearchService } from '../../../../core/services/search.service';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { Task } from '@yotara/shared';

describe('TaskListPageComponent', () => {
  let mockTaskService: any;
  let mockProjectService: any;
  let mockSearchService: any;
  let mockActivatedRoute: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockTaskService = {
      loading: signal(false),
      creating: signal(false),
      error: signal<string | null>(null),
      inboxTasks: signal([]),
      todayTasks: signal([]),
      todayCompletedTasks: signal([]),
      overdueTasks: signal([]),
      upcomingTaskGroups: signal([]),
    };

    mockProjectService = {
      projects: signal([{ id: '1', name: 'Inbox' }]),
    };

    mockSearchService = {
      search: jasmine.createSpy().and.returnValue({
        tasks: [],
        projects: [],
        labels: [],
      }),
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
        { provide: TaskService, useValue: mockTaskService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  describe('View Mode Rendering', () => {
    it('renders the inbox view by default', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Inbox');
      expect(fixture.nativeElement.textContent).toContain('Clear skies');
    });

    it('renders the today view when query param is set', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'today']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Today');
      // Daily Zen is replaced by Insight Panel which is randomized
      const text = fixture.nativeElement.textContent;
      expect(text.toLowerCase()).toMatch(/daily clarity|the yotara journal/);
    });

    it('renders the upcoming view when query param is set', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'upcoming']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Upcoming');
      expect(fixture.nativeElement.textContent).toContain('Nothing is crowding the horizon');
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
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();
      const dismissBtn = fixture.debugElement.query(By.css('.insight-dismiss'));
      dismissBtn.nativeElement.click();
      fixture.detectChanges();
      const panel = fixture.debugElement.query(By.css('.insight-panel'));
      expect(panel).toBeNull();
    });

    it('renders the search view when query param is set', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'search']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Search');
      expect(fixture.nativeElement.textContent).toContain('Start with a title');
    });
  });

  describe('Inbox Capture', () => {
    it('opens task workspace modal from the inbox input', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();
      const workspaceDebugEl = fixture.debugElement.query(
        By.directive(PersonalTaskWorkspaceComponent),
      );
      const workspace = workspaceDebugEl.componentInstance as PersonalTaskWorkspaceComponent;
      spyOn(workspace, 'openCreateTaskModal');

      fixture.componentInstance['captureTitle'].set('Write morning pages');
      fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
      fixture.detectChanges();

      expect(workspace.openCreateTaskModal).toHaveBeenCalled();
    });

    it('shows capture error when title is empty', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      fixture.componentInstance['captureTitle'].set('   ');
      fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
      fixture.detectChanges();

      expect(fixture.componentInstance['captureError']()).toBe('Add a task title to capture it.');
    });

    it('clears capture form after successful save', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      fixture.componentInstance['captureTitle'].set('Test task');
      fixture.componentInstance['handleTaskSaved']('create');

      expect(fixture.componentInstance['captureTitle']()).toBe('');
      expect(fixture.componentInstance['captureError']()).toBe('');
    });

    it('displays randomized insight prompts in inbox view', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      // Verify at least one type of prompt is rendered
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

    it('displays error state in today', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'today']]));
      mockTaskService.error = signal('Failed to load tasks');
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Failed to load tasks');
    });
  });

  describe('Search Functionality', () => {
    it('renders search view with empty state', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'search']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Start with a title');
    });

    it('calls search service when searching', () => {
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'search'],
          ['q', 'meeting'],
        ]),
      );
      mockSearchService.search.and.returnValue({ tasks: [], projects: [], labels: [] });

      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(mockSearchService.search).toHaveBeenCalled();
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
