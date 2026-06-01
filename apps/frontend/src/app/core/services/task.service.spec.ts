import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TaskService } from './task.service';
import { AuthStateService } from './auth-state.service';
import { LabelService } from './label.service';
import { ProjectService } from './project.service';
import { Task } from '@yotara/shared';

describe('TaskService', () => {
  const initialized = signal(false);
  const isAuthenticated = signal(false);
  const currentUserId = signal<string | null>(null);
  let labelServiceStub: { refreshLabels: jasmine.Spy };
  let projectServiceStub: { projects: ReturnType<typeof signal>; refreshProjects: jasmine.Spy };

  const ACTIVE_URL =
    'http://localhost:3000/tasks?page=1&pageSize=100&completed=false&includeSubtasks=true';
  const COMPLETED_URL =
    'http://localhost:3000/tasks?page=1&pageSize=100&completed=true&includeSubtasks=true';

  function dayOffset(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString();
  }

  function daysAgo(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return date.toISOString();
  }

  function paginated(tasks: Task[]) {
    return {
      data: tasks,
      meta: {
        total: tasks.length,
        page: 1,
        pageSize: 100,
        totalPages: tasks.length === 0 ? 0 : 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  function flushCompletedTasks(http: HttpTestingController, tasks: Task[] = []) {
    const req = http.expectOne(COMPLETED_URL);
    req.flush(paginated(tasks));
  }

  beforeEach(() => {
    localStorage.clear();
    initialized.set(false);
    isAuthenticated.set(false);
    currentUserId.set(null);
    projectServiceStub = {
      projects: signal([]),
      refreshProjects: jasmine.createSpy('refreshProjects'),
    };
    labelServiceStub = {
      refreshLabels: jasmine.createSpy('refreshLabels'),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskService,
        {
          provide: AuthStateService,
          useValue: {
            initialized,
            isAuthenticated,
            currentUserId,
          },
        },
        {
          provide: ProjectService,
          useValue: projectServiceStub,
        },
        {
          provide: LabelService,
          useValue: labelServiceStub,
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('does not request tasks before auth initialization completes', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone(ACTIVE_URL);
    http.expectNone(COMPLETED_URL);
  }));

  it('does not request tasks when the user is not authenticated', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone(ACTIVE_URL);
    http.expectNone(COMPLETED_URL);
  }));

  it('clears the previous user data and refetches when the active account changes', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush(
      paginated([
        {
          id: 'user-1-task',
          title: 'User one task',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          simpleMode: true,
          bucket: 'personal-sanctuary',
          order: 0,
          createdAt: dayOffset(0),
          updatedAt: dayOffset(0),
        },
      ]),
    );
    flushCompletedTasks(http);
    tick();

    expect(service.tasks().map((task) => task.id)).toEqual(['user-1-task']);

    currentUserId.set(null);
    isAuthenticated.set(false);
    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone(ACTIVE_URL);

    isAuthenticated.set(true);
    currentUserId.set('user-2');
    tick();

    http.expectOne(ACTIVE_URL).flush(
      paginated([
        {
          id: 'user-2-task',
          title: 'User two task',
          status: 'today',
          priority: 'high',
          completed: false,
          simpleMode: false,
          bucket: 'deep-work',
          order: 0,
          createdAt: dayOffset(1),
          updatedAt: dayOffset(1),
        },
      ]),
    );
    flushCompletedTasks(http);
    tick();

    expect(service.tasks().map((task) => task.id)).toEqual(['user-2-task']);
  }));

  it('returns an empty list when the tasks endpoint responds with 401', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    const request = http.expectOne(ACTIVE_URL);
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const completedReq = http.expectOne(COMPLETED_URL);
    completedReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(service.tasks()).toEqual([]);
    expect(service.pendingTasks()).toEqual([]);
    expect(service.completedTasks()).toEqual([]);
  }));

  it('derives inbox, overdue, today, and upcoming selectors from the fetched tasks', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    const activeTasks: Task[] = [
      {
        id: 'inbox-1',
        title: 'Inbox item',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        order: 0,
        createdAt: dayOffset(-1),
        updatedAt: dayOffset(-1),
      },
      {
        id: 'overdue-1',
        title: 'Overdue item',
        status: 'today',
        priority: 'high',
        completed: false,
        dueDate: dayOffset(-1),
        simpleMode: false,
        bucket: 'deep-work',
        order: 1,
        createdAt: dayOffset(-2),
        updatedAt: dayOffset(-2),
      },
      {
        id: 'today-1',
        title: 'Today item',
        status: 'today',
        priority: 'medium',
        completed: false,
        dueDate: dayOffset(0),
        simpleMode: false,
        bucket: 'home',
        order: 2,
        createdAt: dayOffset(-1),
        updatedAt: dayOffset(-1),
      },
      {
        id: 'upcoming-1',
        title: 'Upcoming item',
        status: 'upcoming',
        priority: 'low',
        completed: false,
        dueDate: dayOffset(5),
        simpleMode: false,
        bucket: 'deep-work',
        order: 4,
        createdAt: dayOffset(-1),
        updatedAt: dayOffset(-1),
      },
      {
        id: 'inbox-due-today',
        title: 'Inbox item due today',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        dueDate: dayOffset(0),
        simpleMode: false,
        bucket: 'personal-sanctuary',
        order: 5,
        createdAt: dayOffset(-1),
        updatedAt: dayOffset(-1),
      },
      {
        id: 'inbox-due-upcoming',
        title: 'Inbox item due later',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        dueDate: dayOffset(5),
        simpleMode: false,
        bucket: 'personal-sanctuary',
        order: 6,
        createdAt: dayOffset(-1),
        updatedAt: dayOffset(-1),
      },
      {
        id: 'upcoming-overdue',
        title: 'Upcoming item now overdue',
        status: 'upcoming',
        priority: 'high',
        completed: false,
        dueDate: dayOffset(-2),
        simpleMode: false,
        bucket: 'deep-work',
        order: 7,
        createdAt: dayOffset(-3),
        updatedAt: dayOffset(-3),
      },
    ];

    const completedTasks: Task[] = [
      {
        id: 'done-1',
        title: 'Completed item',
        status: 'today',
        priority: 'low',
        completed: true,
        dueDate: dayOffset(0),
        simpleMode: false,
        bucket: 'health',
        order: 3,
        createdAt: dayOffset(-1),
        updatedAt: dayOffset(-1),
      },
    ];

    http.expectOne(ACTIVE_URL).flush(paginated(activeTasks));
    http.expectOne(COMPLETED_URL).flush(paginated(completedTasks));
    tick();

    expect(service.inboxTasks().map((task) => task.id)).toEqual([
      'inbox-1',
      'overdue-1',
      'upcoming-overdue',
    ]);
    expect(service.overdueTasks().map((task) => task.id)).toEqual([
      'overdue-1',
      'upcoming-overdue',
    ]);
    expect(service.todayTasks().map((task) => task.id)).toEqual(['today-1', 'inbox-due-today']);
    expect(service.todayCompletedTasks().map((task) => task.id)).toEqual(['done-1']);
    expect(service.upcomingTasks().map((task) => task.id)).toEqual([
      'upcoming-1',
      'inbox-due-upcoming',
    ]);
    expect(service.archivedTasks().map((task) => task.id)).toEqual(['done-1']);
    expect(service.upcomingTaskGroups()).toEqual([
      {
        label: 'This Week',
        tasks: [
          jasmine.objectContaining({ id: 'upcoming-1' }),
          jasmine.objectContaining({ id: 'inbox-due-upcoming' }),
        ],
      },
    ]);
  }));

  it('treats date-only due dates as local calendar days', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);
    const today = new Date();
    const todayDateOnly = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush(
      paginated([
        {
          id: 'date-only-today',
          title: 'Date-only today',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          dueDate: todayDateOnly,
          simpleMode: false,
          bucket: 'personal-sanctuary',
          order: 0,
          createdAt: dayOffset(0),
          updatedAt: dayOffset(0),
        },
      ]),
    );
    flushCompletedTasks(http);
    tick();

    expect(service.todayTasks().map((task) => task.id)).toEqual(['date-only-today']);
    expect(service.inboxTasks()).toEqual([]);
  }));

  it('includes all completed tasks in the archive selector', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    const completedTasks: Task[] = [
      {
        id: 'recent-done',
        title: 'Recent completed task',
        status: 'done',
        priority: 'medium',
        completed: true,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        order: 0,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      {
        id: 'old-done',
        title: 'Old completed task',
        status: 'done',
        priority: 'medium',
        completed: true,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        order: 1,
        createdAt: daysAgo(40),
        updatedAt: daysAgo(40),
      },
    ];

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    http.expectOne(COMPLETED_URL).flush(paginated(completedTasks));
    tick();

    expect(service.archivedTasks().map((task) => task.id)).toEqual(['recent-done', 'old-done']);
  }));

  it('creates a task and refreshes the fetched list', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    flushCompletedTasks(http);
    tick();

    let createdTask: Task | undefined;
    void service
      .createTask({
        title: 'New capture',
        status: 'inbox',
        priority: 'medium',
        simpleMode: true,
        bucket: 'personal-sanctuary',
      })
      .then((task) => {
        createdTask = task;
      });

    const postRequest = http.expectOne('http://localhost:3000/tasks');
    expect(postRequest.request.method).toBe('POST');
    expect(postRequest.request.withCredentials).toBeTrue();
    postRequest.flush({
      id: 'created-1',
      title: 'New capture',
      status: 'inbox',
      priority: 'medium',
      completed: false,
      simpleMode: true,
      bucket: 'personal-sanctuary',
      order: 0,
      createdAt: dayOffset(0),
      updatedAt: dayOffset(0),
    });
    tick();

    http.expectOne(ACTIVE_URL).flush(
      paginated([
        {
          id: 'created-1',
          title: 'New capture',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          simpleMode: true,
          bucket: 'personal-sanctuary',
          order: 0,
          createdAt: dayOffset(0),
          updatedAt: dayOffset(0),
        },
      ]),
    );
    flushCompletedTasks(http);
    tick();

    expect(createdTask?.id).toBe('created-1');
    expect(service.inboxTasks().map((task) => task.id)).toEqual(['created-1']);
    expect(labelServiceStub.refreshLabels).toHaveBeenCalled();
    expect(projectServiceStub.refreshProjects).toHaveBeenCalled();
  }));

  it('updates a task with metadata and refreshes the list', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    flushCompletedTasks(http);
    tick();

    void service.updateTask('task-1', {
      title: 'Refined task',
      simpleMode: false,
      dueDate: '2026-04-08',
      bucket: 'deep-work',
    });

    const patchRequest = http.expectOne('http://localhost:3000/tasks/task-1');
    expect(patchRequest.request.method).toBe('PATCH');
    expect(patchRequest.request.withCredentials).toBeTrue();
    patchRequest.flush({
      id: 'task-1',
      title: 'Refined task',
      status: 'inbox',
      priority: 'medium',
      completed: false,
      simpleMode: false,
      dueDate: '2026-04-08',
      bucket: 'deep-work',
      order: 0,
      createdAt: dayOffset(0),
      updatedAt: dayOffset(0),
    });
    tick();

    http.expectOne(ACTIVE_URL).flush(
      paginated([
        {
          id: 'task-1',
          title: 'Refined task',
          status: 'inbox',
          priority: 'medium',
          completed: false,
          simpleMode: false,
          dueDate: '2026-04-08',
          bucket: 'deep-work',
          order: 0,
          createdAt: dayOffset(0),
          updatedAt: dayOffset(0),
        },
      ]),
    );
    flushCompletedTasks(http);
    tick();

    expect(service.inboxTasks()[0]?.bucket).toBe('deep-work');
    expect(service.inboxTasks()[0]?.simpleMode).toBeFalse();
    expect(labelServiceStub.refreshLabels).toHaveBeenCalled();
    expect(projectServiceStub.refreshProjects).toHaveBeenCalled();
  }));

  it('refreshes recentlyCompleted when refreshState increments', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    http.expectOne(COMPLETED_URL).flush(
      paginated([
        {
          id: 'completed-1',
          title: 'First batch',
          status: 'done' as const,
          priority: 'medium' as const,
          completed: true,
          simpleMode: true,
          bucket: 'personal-sanctuary' as const,
          order: 0,
          createdAt: daysAgo(5),
          updatedAt: daysAgo(5),
        },
      ]),
    );
    tick();

    expect(service.recentlyCompleted().map((t) => t.id)).toEqual(['completed-1']);

    service.refreshTasks();
    tick();

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    http.expectOne(COMPLETED_URL).flush(
      paginated([
        {
          id: 'completed-1',
          title: 'First batch',
          status: 'done' as const,
          priority: 'medium' as const,
          completed: true,
          simpleMode: true,
          bucket: 'personal-sanctuary' as const,
          order: 0,
          createdAt: daysAgo(5),
          updatedAt: daysAgo(5),
        },
        {
          id: 'completed-2',
          title: 'Just finished',
          status: 'done' as const,
          priority: 'high' as const,
          completed: true,
          simpleMode: false,
          bucket: 'deep-work' as const,
          order: 1,
          createdAt: daysAgo(1),
          updatedAt: daysAgo(1),
        },
      ]),
    );
    tick();

    expect(service.recentlyCompleted().map((t) => t.id)).toEqual(['completed-1', 'completed-2']);
  }));

  it('stops paginating when the server returns an empty page despite hasNextPage', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush({
      data: [
        {
          id: 't1',
          title: 'Only task',
          status: 'inbox' as const,
          priority: 'medium' as const,
          completed: false,
          simpleMode: true,
          bucket: 'personal-sanctuary' as const,
          order: 0,
          createdAt: dayOffset(0),
          updatedAt: dayOffset(0),
        },
      ],
      meta: {
        total: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    });

    http
      .expectOne(
        'http://localhost:3000/tasks?page=2&pageSize=100&completed=false&includeSubtasks=true',
      )
      .flush({
        data: [],
        meta: {
          total: 1,
          page: 2,
          pageSize: 100,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      });

    flushCompletedTasks(http);
    tick();

    expect(service.tasks().map((t) => t.id)).toEqual(['t1']);
  }));

  it('deletes a task and refreshes the list', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    flushCompletedTasks(http);
    tick();

    void service.deleteTask('task-to-delete');

    const deleteRequest = http.expectOne('http://localhost:3000/tasks/task-to-delete');
    expect(deleteRequest.request.method).toBe('DELETE');
    expect(deleteRequest.request.withCredentials).toBeTrue();
    deleteRequest.flush({ ok: true });
    tick();

    http.expectOne(ACTIVE_URL).flush(paginated([]));
    flushCompletedTasks(http);
    tick();

    expect(service.error()).toBeNull();
    expect(labelServiceStub.refreshLabels).toHaveBeenCalled();
    expect(projectServiceStub.refreshProjects).toHaveBeenCalled();
  }));
});
