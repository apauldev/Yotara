import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TaskListStore } from './task-list.store';
import { TaskRefreshState } from './task-refresh-state';
import { TaskApiService, TASKS_PAGE_SIZE } from './task-api.service';
import { AuthStateService } from './auth-state.service';
import { PaginatedResponse, Task } from '@yotara/shared';

describe('TaskListStore', () => {
  const initialized = signal(false);
  const currentUserId = signal<string | null>(null);

  const ACTIVE_URL = `http://localhost:3000/tasks?page=1&pageSize=${TASKS_PAGE_SIZE}&completed=false&includeSubtasks=true`;
  const COMPLETED_URL =
    'http://localhost:3000/tasks?page=1&pageSize=100&completed=true&includeSubtasks=true';

  const sampleTask: Task = {
    id: 't-1',
    title: 'Task 1',
    status: 'today',
    priority: 'medium',
    completed: false,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function paginated(
    tasks: Task[],
    meta: Partial<PaginatedResponse<Task[]>['meta']> = {},
  ): PaginatedResponse<Task[]> {
    return {
      data: tasks,
      meta: {
        total: tasks.length,
        page: 1,
        pageSize: 100,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        ...meta,
      },
    };
  }

  function flushDefaultViews(http: HttpTestingController) {
    const viewMatch = http.match(
      (req) =>
        req.url.includes('/tasks') &&
        (req.url.includes('view=') ||
          req.url.includes('overdue=') ||
          req.url.includes('completedSince=') ||
          req.url.includes('labelIds=')),
    );
    viewMatch.forEach((req) => {
      if (!req.cancelled) {
        req.flush(paginated([]));
      }
    });

    const activeMatch = http.match((req) => req.url.includes(ACTIVE_URL));
    activeMatch.forEach((req) => {
      if (!req.cancelled) {
        req.flush(paginated([]));
      }
    });

    const completedMatch = http.match((req) => req.url.includes(COMPLETED_URL));
    completedMatch.forEach((req) => {
      if (!req.cancelled) {
        req.flush(paginated([]));
      }
    });
  }

  function flushView(http: HttpTestingController, query: string, tasks: Task[] = []) {
    const match = http.match((req) => req.url.includes(query));
    match.forEach((req) => {
      if (!req.cancelled) {
        req.flush(paginated(tasks));
      }
    });
  }

  beforeEach(() => {
    initialized.set(false);
    currentUserId.set(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskListStore,
        TaskRefreshState,
        TaskApiService,
        {
          provide: AuthStateService,
          useValue: {
            initialized,
            currentUserId,
          },
        },
      ],
    });
  });

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    flushDefaultViews(http);
    http.verify();
    TestBed.resetTestingModule();
  });

  describe('TaskRefreshState', () => {
    it('initializes version to 0 and increments on refresh()', () => {
      const refreshState = TestBed.inject(TaskRefreshState);
      expect(refreshState.version()).toBe(0);
      refreshState.refresh();
      expect(refreshState.version()).toBe(1);
      refreshState.refresh();
      expect(refreshState.version()).toBe(2);
    });
  });

  describe('auth transitions and reactive streams', () => {
    it('returns empty lists when user is unauthenticated', fakeAsync(() => {
      const store = TestBed.inject(TaskListStore);
      const http = TestBed.inject(HttpTestingController);

      tick();

      expect(store.todayTasks()).toEqual([]);
      expect(store.overdueTasks()).toEqual([]);
      expect(store.inboxTasks()).toEqual([]);
      expect(store.upcomingTasks()).toEqual([]);
      expect(store.allActiveTasks()).toEqual([]);
      expect(store.recentlyCompleted()).toEqual([]);
      expect(store.filteredTasks()).toEqual([]);
      http.expectNone(ACTIVE_URL);
      http.expectNone(COMPLETED_URL);
    }));

    it('fetches tasks, filters subtasks, and sorts by order when authenticated', fakeAsync(() => {
      const store = TestBed.inject(TaskListStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-123');
      tick();

      const task1: Task = { ...sampleTask, id: 't-1', order: 2 };
      const task2: Task = { ...sampleTask, id: 't-2', order: 1 };
      const subtask: Task = { ...sampleTask, id: 'sub-1', parentId: 't-1', order: 0 };

      http.expectOne(ACTIVE_URL).flush(paginated([]));
      http.expectOne(COMPLETED_URL).flush(paginated([]));
      tick();

      flushView(http, 'view=today', [task1, subtask, task2]);
      flushDefaultViews(http);
      tick();

      expect(store.todayTasks().map((t) => t.id)).toEqual(['t-2', 't-1']);
    }));

    it('refetches when refreshState.refresh() is called', fakeAsync(() => {
      const store = TestBed.inject(TaskListStore);
      const refreshState = TestBed.inject(TaskRefreshState);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-123');
      tick();

      http.expectOne(ACTIVE_URL).flush(paginated([]));
      http.expectOne(COMPLETED_URL).flush(paginated([]));
      flushDefaultViews(http);
      tick();

      refreshState.refresh();
      tick();

      http.expectOne(ACTIVE_URL).flush(paginated([sampleTask]));
      flushDefaultViews(http);
      tick();

      expect(store.allActiveTasks()).toEqual([sampleTask]);
    }));
  });

  describe('filter state management', () => {
    it('updates filterState and tracks loading/pending', fakeAsync(() => {
      const store = TestBed.inject(TaskListStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-123');
      tick();

      http.expectOne(ACTIVE_URL).flush(paginated([]));
      http.expectOne(COMPLETED_URL).flush(paginated([]));
      flushDefaultViews(http);
      tick();

      expect(store.filterPending()).toBeFalse();

      store.setFilters({
        labelIds: ['l-1'],
        labelMode: 'any',
        projectId: 'p-1',
        priority: 'high',
      });
      tick();

      flushView(http, 'labelIds=l-1', [sampleTask]);
      tick();

      expect(store.filteredTasks()).toEqual([sampleTask]);
      expect(store.filterPending()).toBeFalse();
    }));
  });

  describe('upcoming buckets and dates', () => {
    it('buckets tasks correctly and formats dates', () => {
      const store = TestBed.inject(TaskListStore);
      const taskNoDate: Task = { ...sampleTask, dueDate: undefined };
      expect(store.upcomingBucketForTask(taskNoDate)).toBe('Later');
      expect(store.formatTaskDate(null)).toBe('');
      expect(store.formatTaskDate('2026-04-08')).toBe('Apr 8');
    });

    it('sets and clears error state via setError', () => {
      const store = TestBed.inject(TaskListStore);
      store.setError('Custom error');
      expect(store.error()).toBe('Custom error');
      store.setError(null);
      expect(store.error()).toBeNull();
    });
  });
});
