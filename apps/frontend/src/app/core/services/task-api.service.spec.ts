import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TaskApiService, TASKS_PAGE_SIZE, TaskFilterState } from './task-api.service';
import { CreateTaskDto, PaginatedResponse, Priority, Task, UpdateTaskDto } from '@yotara/shared';

describe('TaskApiService', () => {
  let service: TaskApiService;
  let http: HttpTestingController;

  const sampleTask: Task = {
    id: 'task-1',
    title: 'Test Task',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function paginated<T>(
    data: T,
    meta: Partial<PaginatedResponse<T>['meta']> = {},
  ): PaginatedResponse<T> {
    return {
      data,
      meta: {
        total: Array.isArray(data) ? data.length : 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        ...meta,
      },
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TaskApiService],
    });

    service = TestBed.inject(TaskApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('fetchRecentlyCompletedTasks$ sends correct URL and withCredentials', () => {
    service.fetchRecentlyCompletedTasks$(1, 100).subscribe((res) => {
      expect(res.data).toEqual([sampleTask]);
    });

    const req = http.expectOne((r) =>
      r.url.includes('/tasks?page=1&pageSize=100&completed=true&includeSubtasks=true'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([sampleTask]));
  });

  it('getArchivedTasks requests archived completed tasks with pagination', () => {
    service.getArchivedTasks(2, 50).subscribe((res) => {
      expect(res.data).toEqual([sampleTask]);
    });

    const req = http.expectOne((r) =>
      r.url.includes('/tasks?page=2&pageSize=50&completed=true&includeSubtasks=true'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([sampleTask]));
  });

  it('getDeletedTasks requests soft-deleted tasks', () => {
    service.getDeletedTasks(1, 20).subscribe((res) => {
      expect(res.data).toEqual([sampleTask]);
    });

    const req = http.expectOne((r) =>
      r.url.includes('/tasks?deleted=true&includeSubtasks=true&page=1&pageSize=20'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([sampleTask]));
  });

  it('getUnassignedTasks requests unassigned active tasks', () => {
    service.getUnassignedTasks(TASKS_PAGE_SIZE).subscribe((res) => {
      expect(res.data).toEqual([sampleTask]);
    });

    const req = http.expectOne((r) =>
      r.url.includes(`/tasks?unassigned=true&completed=false&page=1&pageSize=${TASKS_PAGE_SIZE}`),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([sampleTask]));
  });

  it('updateTasks$ sends batch patch payload', () => {
    service.updateTasks$(['t1', 't2'], { priority: 'high' }).subscribe((res) => {
      expect(res.updated).toBe(2);
    });

    const req = http.expectOne((r) => r.url.endsWith('/tasks'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ taskIds: ['t1', 't2'], patch: { priority: 'high' } });
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ updated: 2 });
  });

  it('restoreTask$ sends restore POST request', () => {
    service.restoreTask$('t1').subscribe((res) => {
      expect(res.ok).toBeTrue();
    });

    const req = http.expectOne((r) => r.url.endsWith('/tasks/t1/restore'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ ok: true });
  });

  it('clearCompletedTasks$ sends DELETE request to clear completed tasks', () => {
    service.clearCompletedTasks$().subscribe((res) => {
      expect(res.removed).toBe(5);
    });

    const req = http.expectOne((r) => r.url.endsWith('/tasks/completed'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ ok: true, removed: 5 });
  });

  it('fetchTodayTasks$ includes view=today, tz and TASKS_PAGE_SIZE', () => {
    service.fetchTodayTasks$('UTC').subscribe();

    const req = http.expectOne((r) => r.url.includes('/tasks?view=today&tz=UTC&pageSize=3000'));
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchOverdueTasks$ includes overdue=true, tz and TASKS_PAGE_SIZE', () => {
    service.fetchOverdueTasks$('UTC').subscribe();

    const req = http.expectOne((r) => r.url.includes('/tasks?overdue=true&tz=UTC&pageSize=3000'));
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchInboxTasks$ includes view=inbox, tz and TASKS_PAGE_SIZE', () => {
    service.fetchInboxTasks$('UTC').subscribe();

    const req = http.expectOne((r) => r.url.includes('/tasks?view=inbox&tz=UTC&pageSize=3000'));
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchUpcomingTasks$ includes view=upcoming, tz and TASKS_PAGE_SIZE', () => {
    service.fetchUpcomingTasks$('UTC').subscribe();

    const req = http.expectOne((r) => r.url.includes('/tasks?view=upcoming&tz=UTC&pageSize=3000'));
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchTodayCompletedTasks$ traverses paginated results and filters subtasks', () => {
    const parentTask: Task = { ...sampleTask, id: 'parent-1' };
    const subtask: Task = { ...sampleTask, id: 'sub-1', parentId: 'parent-1' };
    const page2Task: Task = { ...sampleTask, id: 'parent-2' };

    service.fetchTodayCompletedTasks$('2026-11-19', 'UTC').subscribe((tasks) => {
      expect(tasks).toEqual([parentTask, page2Task]);
    });

    const page1Req = http.expectOne((r) => r.url.includes('page=1'));
    page1Req.flush(paginated([parentTask, subtask], { page: 1, hasNextPage: true }));

    const page2Req = http.expectOne((r) => r.url.includes('page=2'));
    page2Req.flush(paginated([page2Task], { page: 2, hasNextPage: false }));
  });

  it('fetchAllActiveTasks$ requests active non-completed tasks including subtasks', () => {
    service.fetchAllActiveTasks$().subscribe();

    const req = http.expectOne((r) =>
      r.url.includes(
        `/tasks?page=1&pageSize=${TASKS_PAGE_SIZE}&completed=false&includeSubtasks=true`,
      ),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchTasksByLabel$ formats query string with labelIds and optional completed', () => {
    service.fetchTasksByLabel$('label-1', true).subscribe();

    const req = http.expectOne(
      (r) =>
        r.url.includes('labelIds=label-1') &&
        r.url.includes('completed=true') &&
        r.url.includes('includeSubtasks=true'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchTasksByFilters$ constructs query parameters from filter state', () => {
    const filter: TaskFilterState = {
      labelIds: ['l1', 'l2'],
      labelMode: 'all',
      projectId: 'proj-1',
      priority: 'high',
    };

    service.fetchTasksByFilters$(filter).subscribe();

    const req = http.expectOne(
      (r) =>
        r.url.includes('labelIds=l1%2Cl2') &&
        r.url.includes('labelMode=all') &&
        r.url.includes('projectId=proj-1') &&
        r.url.includes('priority=high') &&
        r.url.includes('completed=false') &&
        r.url.includes('includeSubtasks=true'),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchUndatedTasks$ requests tasks without due date', () => {
    service.fetchUndatedTasks$('UTC').subscribe();

    const req = http.expectOne((r) =>
      r.url.includes(`/tasks?hasDueDate=false&completed=false&tz=UTC&pageSize=${TASKS_PAGE_SIZE}`),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchTasksDueBetween$ passes dueFrom and dueTo', () => {
    service.fetchTasksDueBetween$('2026-05-10', '2026-05-13', 'UTC').subscribe();

    const req = http.expectOne((r) =>
      r.url.includes(
        `/tasks?dueFrom=2026-05-10&dueTo=2026-05-13&tz=UTC&pageSize=${TASKS_PAGE_SIZE}`,
      ),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('fetchAllTasks$ requests tasks with export=true', () => {
    service.fetchAllTasks$().subscribe();

    const req = http.expectOne((r) => r.url.includes('/tasks?export=true'));
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });

  it('createTask$ posts task payload with tz param', () => {
    const payload: CreateTaskDto = { title: 'New task' };
    service.createTask$(payload, 'UTC').subscribe((task) => {
      expect(task.title).toBe('New task');
    });

    const req = http.expectOne((r) => r.url.endsWith('/tasks') && r.params.get('tz') === 'UTC');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ ...sampleTask, title: 'New task' });
  });

  it('updateTask$ patches task with tz in query string', () => {
    const payload: UpdateTaskDto = { title: 'Updated task' };
    service.updateTask$('task-1', payload, 'UTC').subscribe((task) => {
      expect(task.title).toBe('Updated task');
    });

    const req = http.expectOne((r) => r.url.includes('/tasks/task-1?tz=UTC'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ ...sampleTask, title: 'Updated task' });
  });

  it('deleteTask$ sends DELETE request', () => {
    service.deleteTask$('task-1').subscribe((res) => {
      expect(res.ok).toBeTrue();
    });

    const req = http.expectOne((r) => r.url.endsWith('/tasks/task-1'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ ok: true });
  });

  it('fetchSubtasks$ requests subtasks by parentId', () => {
    service.fetchSubtasks$('parent-1', 100).subscribe();

    const req = http.expectOne((r) => r.url.includes('/tasks?parentId=parent-1&pageSize=100'));
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(paginated([]));
  });
});
