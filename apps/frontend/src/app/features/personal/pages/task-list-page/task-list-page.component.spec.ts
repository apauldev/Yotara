import { signal } from '@angular/core';
import { DateTime } from 'luxon';
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
import { PersonalTaskCardComponent } from '../../components/personal-task-card.component';
import { CaptureBarComponent } from '../../components/capture-bar.component';
import { Task } from '@yotara/shared';
import { StatusService } from '../../../../core/services/status.service';

describe('TaskListPageComponent', () => {
  let mockTaskService: any;
  let mockProjectService: any;
  let mockLabelService: any;
  let mockAuthStateService: any;
  let mockActivatedRoute: any;
  let mockRouter: any;
  let mockStatusService: any;

  beforeEach(async () => {
    localStorage.clear();
    mockTaskService = {
      loading: signal(false),
      creating: signal(false),
      error: signal<string | null>(null),
      allActiveTasks: signal([]),
      inboxTasks: signal([]),
      todayTasks: signal([]),
      todayCompletedTasks: signal([]),
      overdueTasks: signal([]),
      upcomingTasks: signal([]),
      todayTruncated: signal(false),
      overdueTruncated: signal(false),
      inboxTruncated: signal(false),
      upcomingTruncated: signal(false),
      upcomingTaskGroups: signal([]),
      upcomingBucketForTask: jasmine.createSpy().and.returnValue('Later'),
      createTask: jasmine.createSpy().and.returnValue(Promise.resolve({})),
      filteredTasks: signal([]),
      filterLoading: signal(false),
      filterPending: signal(false),
      filterTruncated: signal(false),
      setFilters: jasmine.createSpy('setFilters'),
    };

    mockProjectService = {
      projects: signal([
        { id: '1', name: 'Inbox' },
        { id: '2', name: 'Work' },
      ]),
    };

    mockLabelService = {
      labels: signal([]),
      labelById: () => new Map(),
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

    mockStatusService = {
      success: jasmine.createSpy('success'),
      show: jasmine.createSpy('show'),
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
        { provide: StatusService, useValue: mockStatusService },
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

    it('marks cards and the workspace as Inbox only in the inbox view', () => {
      const inboxTask = {
        id: 'task-inbox',
        title: 'Inbox task',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        createdAt: '2026-04-17T10:00:00Z',
        updatedAt: '2026-04-17T10:00:00Z',
        order: 0,
      } as Task;

      mockTaskService.inboxTasks.set([inboxTask]);
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const inboxFixture = TestBed.createComponent(TaskListPageComponent);
      inboxFixture.detectChanges();

      const inboxCard = inboxFixture.debugElement.query(By.directive(PersonalTaskCardComponent))
        .componentInstance as PersonalTaskCardComponent;
      const inboxWorkspace = inboxFixture.debugElement.query(
        By.directive(PersonalTaskWorkspaceComponent),
      ).componentInstance as PersonalTaskWorkspaceComponent;
      expect(inboxCard.fromInbox).toBeTrue();
      expect(inboxWorkspace.fromInbox).toBeTrue();

      mockTaskService.todayTasks.set([
        {
          ...inboxTask,
          status: 'today',
          dueDate: '2026-04-17',
        },
      ]);
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'today']]));
      const todayFixture = TestBed.createComponent(TaskListPageComponent);
      todayFixture.detectChanges();

      const todayCard = todayFixture.debugElement.query(By.directive(PersonalTaskCardComponent))
        .componentInstance as PersonalTaskCardComponent;
      const todayWorkspace = todayFixture.debugElement.query(
        By.directive(PersonalTaskWorkspaceComponent),
      ).componentInstance as PersonalTaskWorkspaceComponent;
      expect(todayCard.fromInbox).toBeFalse();
      expect(todayWorkspace.fromInbox).toBeFalse();
    });
  });

  describe('Task filters', () => {
    const writingLabel = {
      id: 'label-writing',
      name: 'Writing',
      color: '#82d7a9',
      icon: 'pen' as const,
      pinned: false,
      userId: 'user-1',
      openTaskCount: 1,
      completedTaskCount: 0,
      totalTaskCount: 1,
    };
    const filteredTask = {
      id: 'task-labeled',
      title: 'Draft essay',
      description: '',
      status: 'inbox',
      priority: 'medium',
      completed: false,
      createdAt: '2026-04-17T10:00:00Z',
      updatedAt: '2026-04-17T10:00:00Z',
      order: 0,
      labels: [writingLabel.id],
    } as Task;

    it('renders the server-filtered result set and syncs the service query', () => {
      mockLabelService.labels.set([writingLabel]);
      mockLabelService.labelById = () => new Map([[writingLabel.id, writingLabel]]);
      mockTaskService.filteredTasks.set([filteredTask]);
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'inbox'],
          ['labels', writingLabel.id],
        ]),
      );

      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(mockTaskService.setFilters).toHaveBeenCalledWith({
        labelIds: [writingLabel.id],
        labelMode: 'any',
        projectId: null,
        priority: null,
      });
      expect(fixture.nativeElement.textContent).toContain('Labeled: Writing');
      expect(fixture.nativeElement.textContent).toContain('Draft essay');
      // The normal inbox stack and capture bar do not double-render.
      expect(fixture.debugElement.query(By.css('app-capture-bar'))).toBeTruthy();
    });

    it('hides the previous result set while a new filter is pending', () => {
      mockLabelService.labels.set([writingLabel]);
      mockLabelService.labelById = () => new Map([[writingLabel.id, writingLabel]]);
      mockTaskService.filteredTasks.set([filteredTask]);
      mockTaskService.filterPending.set(true);
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'inbox'],
          ['labels', writingLabel.id],
        ]),
      );

      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Loading filtered tasks...');
      expect(fixture.nativeElement.textContent).not.toContain('Draft essay');
    });

    it('surfaces the filter result cap instead of truncating silently', () => {
      mockLabelService.labels.set([writingLabel]);
      mockTaskService.filterTruncated.set(true);
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'inbox'],
          ['labels', writingLabel.id],
        ]),
      );

      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        "Task limit exceeded. Some tasks aren't shown.",
      );
    });

    it('combines labels, project, and priority in the URL and filter summary', () => {
      mockLabelService.labels.set([writingLabel]);
      mockLabelService.labelById = () => new Map([[writingLabel.id, writingLabel]]);
      mockTaskService.filteredTasks.set([filteredTask]);
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'upcoming'],
          ['labels', `${writingLabel.id},label-second`],
          ['labelMode', 'all'],
          ['projectId', '2'],
          ['priority', 'high'],
        ]),
      );

      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(mockTaskService.setFilters).toHaveBeenCalledWith({
        labelIds: [writingLabel.id, 'label-second'],
        labelMode: 'all',
        projectId: '2',
        priority: 'high',
      });
      expect(fixture.nativeElement.textContent).toContain(
        'Labeled: Writing · Project: Work · High priority',
      );
      expect(
        fixture.debugElement.query(By.css('.filter-badge')).nativeElement.textContent,
      ).toContain('4');

      (fixture.componentInstance as any).onFiltersChange({
        labelIds: ['label-third'],
        labelMode: 'any',
        projectId: '2',
        priority: 'high',
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockActivatedRoute,
        queryParams: {
          labels: 'label-third',
          labelMode: null,
          projectId: '2',
          priority: 'high',
        },
        queryParamsHandling: 'merge',
      });
    });

    it('filters by project and priority without any labels', () => {
      mockTaskService.filteredTasks.set([filteredTask]);
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'inbox'],
          ['projectId', '2'],
          ['priority', 'high'],
        ]),
      );

      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Project: Work · High priority');
      expect(fixture.nativeElement.textContent).toContain('Draft essay');
      expect(
        fixture.debugElement.query(By.css('.filter-badge')).nativeElement.textContent,
      ).toContain('2');
    });

    it('toggles a chip label filter on and off', () => {
      mockLabelService.labels.set([writingLabel]);
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const page = fixture.componentInstance as any;
      page.filterByLabel(writingLabel);
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockActivatedRoute,
        queryParams: {
          labels: writingLabel.id,
          labelMode: null,
          projectId: null,
          priority: null,
        },
        queryParamsHandling: 'merge',
      });

      mockRouter.navigate.calls.reset();
      mockActivatedRoute.queryParamMap = of(
        new Map([
          ['view', 'inbox'],
          ['labels', writingLabel.id],
        ]),
      );
      const filteredFixture = TestBed.createComponent(TaskListPageComponent);
      filteredFixture.detectChanges();
      (filteredFixture.componentInstance as any).filterByLabel(writingLabel);
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockActivatedRoute,
        queryParams: {
          labels: null,
          labelMode: null,
          projectId: null,
          priority: null,
        },
        queryParamsHandling: 'merge',
      });
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
      expect(args.projectId).toBeNull();
      expect(captureBar.getProjectId()).toBeNull();
      expect(mockStatusService.success).toHaveBeenCalledWith('"Quick task" added to Inbox');
    });

    it('quick captures into the selected project and resets the picker', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.setTitle('Draft proposal');
      captureBar['projectId'].set('2');

      await (fixture.componentInstance as any).handleCapture();

      const args = mockTaskService.createTask.calls.mostRecent().args[0];
      expect(args.projectId).toBe('2');
      expect(captureBar.getProjectId()).toBeNull();
      expect(mockStatusService.success).toHaveBeenCalledWith('"Draft proposal" added to Work');
    });

    it('applies a label created in the capture combobox to the saved task', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      spyOn(captureBar, 'getCreatedLabels').and.returnValue([{ id: 'new-label', name: 'Writing' }]);
      captureBar.setTitle('Draft essay #Writing');

      await (fixture.componentInstance as any).handleCapture();

      const payload = mockTaskService.createTask.calls.mostRecent().args[0];
      expect(payload.title).toBe('Draft essay');
      expect(payload.labels).toEqual(['new-label']);
    });

    it('includes an inferred due date in the quick-create payload', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Quick task Friday');
      await (fixture.componentInstance as any).handleCapture();

      const payload = mockTaskService.createTask.calls.mostRecent().args[0];
      expect(payload.dueDate).toBe('2026-10-02');
      expect('dueTime' in payload).toBeFalse();
      expect(payload.simpleMode).toBeFalse();
      expect(mockStatusService.success).toHaveBeenCalledWith(
        // The default project is never named in the toast: a default project
        // called "Inbox" would otherwise read as the destination view on a
        // dated task that actually lands in Today/Upcoming/Overdue.
        jasmine.stringMatching(/^"Quick task Friday" added to (Today|Upcoming|Overdue) · due /),
      );
    });

    it('retains the title and date draft when quick capture fails', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      mockTaskService.createTask.and.rejectWith(new Error('offline'));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Quick task Friday');
      captureBar.setSubmissionType('quick');
      await (fixture.componentInstance as any).handleCapture();

      expect(captureBar.getTitle()).toBe('Quick task Friday');
      expect(captureBar.getDueDateDraft().value).toBe('2026-10-02');
      expect(captureBar.getError()).toBe('Failed to quick capture task.');
      expect(captureBar.getLastSubmissionType()).toBe('quick');
    });

    it('includes an inferred due time in the quick-create payload', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Quick task Friday at 3pm');
      await (fixture.componentInstance as any).handleCapture();

      const payload = mockTaskService.createTask.calls.mostRecent().args[0];
      expect(payload.dueDate).toBe('2026-10-02');
      expect(payload.dueTime).toBe('15:00');
      expect(payload.simpleMode).toBeFalse();
      expect(mockStatusService.success).toHaveBeenCalledWith(
        jasmine.stringMatching(/"Quick task Friday at 3pm" added to .* · due .*3:00 PM/),
      );
    });

    it('does not include a due date or time after the user clears the draft', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Quick task Friday at 3pm');
      captureBar['clearDueDate']();
      await (fixture.componentInstance as any).handleCapture();

      const payload = mockTaskService.createTask.calls.mostRecent().args[0];
      expect(payload.dueDate).toBeUndefined();
      expect('dueDate' in payload).toBeFalse();
      expect(payload.dueTime).toBeUndefined();
      expect('dueTime' in payload).toBeFalse();
      expect(payload.simpleMode).toBeFalse();
    });

    it('passes the structured date draft to the details workspace', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'quick' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
        .componentInstance as PersonalTaskWorkspaceComponent;
      const openSpy = spyOn(workspace, 'openCreateTaskModal');
      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Capture task Friday');
      captureBar.setSubmissionType('capture');

      await (fixture.componentInstance as any).handleCapture();

      expect(openSpy).toHaveBeenCalledWith(
        null,
        jasmine.objectContaining({
          value: '2026-10-02',
          dueTime: null,
          source: 'inferred',
          matchedText: 'Friday',
        }),
        [],
        'Capture task Friday',
      );
      expect(captureBar.getTitle()).toBe('Capture task Friday');
    });

    it('passes the selected project through the details handoff', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'capture' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
        .componentInstance as PersonalTaskWorkspaceComponent;
      const openSpy = spyOn(workspace, 'openCreateTaskModal');
      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.setTitle('Capture task');
      captureBar['projectId'].set('2');
      captureBar.setSubmissionType('capture');

      await (fixture.componentInstance as any).handleCapture();

      expect(openSpy).toHaveBeenCalledWith(
        jasmine.anything(),
        jasmine.anything(),
        [],
        'Capture task',
      );
      expect(openSpy.calls.mostRecent().args[0]).toBe('2');
    });

    it('passes the inferred time through the details handoff without reparsing', async () => {
      mockAuthStateService.user.set({ id: 'user-1', captureBehavior: 'capture' });
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
        .componentInstance as PersonalTaskWorkspaceComponent;
      const openSpy = spyOn(workspace, 'openCreateTaskModal');
      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Capture task Friday at 3pm');
      captureBar.setSubmissionType('capture');

      await (fixture.componentInstance as any).handleCapture();

      expect(openSpy).toHaveBeenCalledWith(
        null,
        jasmine.objectContaining({
          value: '2026-10-02',
          dueTime: '15:00',
          source: 'inferred',
          matchedText: 'Friday at 3pm',
        }),
        [],
        'Capture task Friday at 3pm',
      );
      expect(captureBar.getTitle()).toBe('Capture task Friday at 3pm');
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

    it('clears the due-date draft after a successful details save', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.referenceDate = DateTime.fromObject(
        { year: 2026, month: 9, day: 28 },
        { zone: 'UTC' },
      );
      captureBar.setTitle('Details task Friday');
      fixture.componentInstance['handleTaskSaved']('create');

      expect(captureBar.getTitle()).toBe('');
      expect(captureBar.getDueDateDraft().source).toBe('none');
      expect(captureBar.getParserResult()).toBeNull();
    });

    it('clears capture form and project selection after successful save', () => {
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      const captureBar = fixture.debugElement.query(By.directive(CaptureBarComponent))
        .componentInstance as CaptureBarComponent;
      captureBar.setTitle('Test task');
      captureBar['projectId'].set('2');
      fixture.componentInstance['handleTaskSaved']('create');

      expect(captureBar.getTitle()).toBe('');
      expect(captureBar.getProjectId()).toBeNull();
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
      mockTaskService.allActiveTasks.set([
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

  describe('Task limit notice', () => {
    it('shows only when the active view hit the page cap', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'inbox']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Task limit exceeded');

      // A truncated list belonging to another view does not raise the notice.
      mockTaskService.todayTruncated.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Task limit exceeded');

      mockTaskService.inboxTruncated.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Task limit exceeded');
    });

    it('covers the suppressed lists of the today view', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'today']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      mockTaskService.overdueTruncated.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Task limit exceeded');

      mockTaskService.overdueTruncated.set(false);
      mockTaskService.todayTruncated.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Task limit exceeded');
    });

    it('hides the notice for the upcoming view when only today is truncated', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'upcoming']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      mockTaskService.todayTruncated.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Task limit exceeded');
    });

    it('stays hidden for an unrecognized view param', () => {
      mockActivatedRoute.queryParamMap = of(new Map([['view', 'done']]));
      const fixture = TestBed.createComponent(TaskListPageComponent);
      fixture.detectChanges();

      mockTaskService.inboxTruncated.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Task limit exceeded');
    });
  });
});
