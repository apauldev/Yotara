import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TaskService } from './task.service';
import { AuthStateService } from './auth-state.service';
import { Task } from '@yotara/shared';

describe('TaskService', () => {
  const initialized = signal(false);
  const isAuthenticated = signal(false);
  const currentUserId = signal<string | null>(null);

  function dayOffset(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
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

  beforeEach(() => {
    initialized.set(false);
    isAuthenticated.set(false);
    currentUserId.set(null);

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
    http.expectNone('http://localhost:3000/tasks?page=1&pageSize=100');
  }));

  it('does not request tasks when the user is not authenticated', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone('http://localhost:3000/tasks?page=1&pageSize=100');
  }));

  it('clears the previous user data and refetches when the active account changes', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100').flush(
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
    tick();

    expect(service.tasks().map((task) => task.id)).toEqual(['user-1-task']);

    currentUserId.set(null);
    isAuthenticated.set(false);
    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone('http://localhost:3000/tasks?page=1&pageSize=100');

    isAuthenticated.set(true);
    currentUserId.set('user-2');
    tick();

    http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100').flush(
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

    const request = http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
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

    const tasks: Task[] = [
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
    ];

    http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100').flush(paginated(tasks));
    tick();

    expect(service.inboxTasks().map((task) => task.id)).toEqual(['inbox-1']);
    expect(service.overdueTasks().map((task) => task.id)).toEqual(['overdue-1']);
    expect(service.todayTasks().map((task) => task.id)).toEqual(['today-1']);
    expect(service.todayCompletedTasks().map((task) => task.id)).toEqual(['done-1']);
    expect(service.upcomingTasks().map((task) => task.id)).toEqual(['upcoming-1']);
    expect(service.upcomingTaskGroups()).toEqual([
      {
        label: 'This Week',
        tasks: [jasmine.objectContaining({ id: 'upcoming-1' })],
      },
    ]);
  }));

  it('creates a task and refreshes the fetched list', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100').flush(paginated([]));
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

    const refreshRequest = http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100');
    refreshRequest.flush(
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
    tick();

    expect(createdTask?.id).toBe('created-1');
    expect(service.inboxTasks().map((task) => task.id)).toEqual(['created-1']);
  }));

  it('updates a task with metadata and refreshes the list', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100').flush(paginated([]));
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

    const refreshRequest = http.expectOne('http://localhost:3000/tasks?page=1&pageSize=100');
    refreshRequest.flush(
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
    tick();

    expect(service.inboxTasks()[0]?.bucket).toBe('deep-work');
    expect(service.inboxTasks()[0]?.simpleMode).toBeFalse();
  }));
});
