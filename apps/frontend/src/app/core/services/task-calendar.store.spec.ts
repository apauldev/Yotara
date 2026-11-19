import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  TaskCalendarStore,
  mergeCalendarTasks,
  calendarRangeStateKey,
  type CalendarRangeRequest,
} from './task-calendar.store';
import { TaskRefreshState } from './task-refresh-state';
import { TaskApiService } from './task-api.service';
import { TaskListStore } from './task-list.store';
import { AuthStateService } from './auth-state.service';
import { PaginatedResponse, Task } from '@yotara/shared';

describe('TaskCalendarStore', () => {
  const initialized = signal(false);
  const currentUserId = signal<string | null>(null);

  function calendarTask(id: string, dueDate: string): Task {
    return {
      id,
      title: id,
      status: 'inbox',
      priority: 'medium',
      completed: false,
      dueDate,
      order: 0,
      createdAt: '',
      updatedAt: '',
    };
  }

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

  beforeEach(() => {
    initialized.set(false);
    currentUserId.set(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskCalendarStore,
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
    // Flush any leftover requests from list store or calendar store
    const matches = http.match(() => true);
    matches.forEach((req) => {
      if (!req.cancelled) {
        req.flush(paginated([]));
      }
    });
    http.verify();
    TestBed.resetTestingModule();
  });

  describe('helper functions', () => {
    it('mergeCalendarTasks returns grid tasks when focus is empty', () => {
      const grid = [calendarTask('t1', '2026-10-01')];
      expect(mergeCalendarTasks(grid, [])).toEqual(grid);
    });

    it('mergeCalendarTasks deduplicates tasks present in both grid and focus', () => {
      const grid = [calendarTask('t1', '2026-10-01')];
      const focus = [calendarTask('t1', '2026-10-01'), calendarTask('t2', '2026-10-02')];
      const merged = mergeCalendarTasks(grid, focus);
      expect(merged.map((t) => t.id)).toEqual(['t1', 't2']);
    });

    it('calendarRangeStateKey generates predictable keys', () => {
      const key = calendarRangeStateKey({
        grid: { from: '2026-10-01', to: '2026-10-31' },
        focus: null,
      });
      expect(key).toBe(JSON.stringify(['2026-10-01', '2026-10-31', null, null]));
    });
  });

  describe('setCalendarRange & calendarRangeTasks', () => {
    it('fetches only grid when focus window is covered by grid', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      const range: CalendarRangeRequest = {
        grid: { from: '2026-10-01', to: '2026-10-31' },
        focus: { from: '2026-10-05', to: '2026-10-11' },
      };
      store.setCalendarRange(range);
      tick();

      const req = http.expectOne(
        (r) => r.url.includes('dueFrom=2026-10-01') && r.url.includes('dueTo=2026-10-31'),
      );
      req.flush(paginated([calendarTask('grid-1', '2026-10-06')]));
      tick();

      expect(store.calendarRangeTasks().map((t) => t.id)).toEqual(['grid-1']);
      expect(store.calendarRangeReady()).toBe(true);

      // Moving focus within same grid does not trigger a refetch
      store.setCalendarRange({
        grid: { from: '2026-10-01', to: '2026-10-31' },
        focus: { from: '2026-10-12', to: '2026-10-18' },
      });
      tick();
      http.expectNone((r) => r.url.includes('dueFrom='));
    }));

    it('fetches both grid and focus when focus is outside grid', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      store.setCalendarRange({
        grid: { from: '2026-10-01', to: '2026-10-31' },
        focus: { from: '2026-11-05', to: '2026-11-11' },
      });
      tick();

      const gridReq = http.expectOne((r) => r.url.includes('dueFrom=2026-10-01'));
      const focusReq = http.expectOne((r) => r.url.includes('dueFrom=2026-11-05'));

      gridReq.flush(paginated([calendarTask('grid-1', '2026-10-10')]));
      focusReq.flush(paginated([calendarTask('focus-1', '2026-11-06')]));
      tick();

      expect(store.calendarRangeTasks().map((t) => t.id)).toEqual(['grid-1', 'focus-1']);
    }));

    it('flags calendarRangeTruncated when a window exceeds the page cap', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      store.setCalendarRange({
        grid: { from: '2026-10-01', to: '2026-10-31' },
        focus: { from: '2026-10-05', to: '2026-10-11' },
      });
      tick();

      http
        .expectOne((r) => r.url.includes('dueFrom=2026-10-01'))
        .flush(paginated([calendarTask('grid-1', '2026-10-05')], { total: 4000 }));
      tick();

      expect(store.calendarRangeTruncated()).toBe(true);
    }));
  });

  describe('loadUndatedTasks', () => {
    it('ignores call before auth is ready', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      store.loadUndatedTasks();
      tick();

      http.expectNone((r) => r.url.includes('hasDueDate=false'));
      expect(store.undatedLoading()).toBe(false);
      expect(store.undatedLoaded()).toBe(false);
    }));

    it('loads undated tasks on first request and reuses on subsequent calls', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      store.loadUndatedTasks();
      tick();

      http
        .expectOne((r) => r.url.includes('hasDueDate=false'))
        .flush(paginated([calendarTask('u-1', '')]));
      tick();

      expect(store.undatedTasks().map((t) => t.id)).toEqual(['u-1']);
      expect(store.undatedLoaded()).toBe(true);

      // Reopening drawer reuses loaded data
      store.loadUndatedTasks();
      tick();
      http.expectNone((r) => r.url.includes('hasDueDate=false'));
    }));

    it('retries undated tasks after a failure', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      store.loadUndatedTasks();
      tick();

      http
        .expectOne((r) => r.url.includes('hasDueDate=false'))
        .flush('server error', { status: 500, statusText: 'Server Error' });
      tick();

      expect(store.undatedLoading()).toBe(false);
      expect(store.undatedLoaded()).toBe(false);

      // Retry
      store.loadUndatedTasks();
      tick();

      http
        .expectOne((r) => r.url.includes('hasDueDate=false'))
        .flush(paginated([calendarTask('u-2', '')]));
      tick();

      expect(store.undatedLoaded()).toBe(true);
      expect(store.undatedTasks().map((t) => t.id)).toEqual(['u-2']);
    }));

    it('flags undatedTruncated when undated tasks exceed total', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      store.loadUndatedTasks();
      tick();

      http
        .expectOne((r) => r.url.includes('hasDueDate=false'))
        .flush(paginated([calendarTask('u-1', '')], { total: 5000 }));
      tick();

      expect(store.undatedTruncated()).toBe(true);
    }));
  });

  describe('auth transitions', () => {
    it('resets sticky flags on sign-out so the next user starts clean', fakeAsync(() => {
      const store = TestBed.inject(TaskCalendarStore);
      const http = TestBed.inject(HttpTestingController);

      initialized.set(true);
      currentUserId.set('user-1');
      tick();

      store.loadUndatedTasks();
      store.setCalendarRange({
        grid: { from: '2026-10-01', to: '2026-10-31' },
        focus: { from: '2026-10-05', to: '2026-10-11' },
      });
      tick();

      http
        .expectOne((r) => r.url.includes('dueFrom=2026-10-01'))
        .flush(paginated([calendarTask('grid-1', '2026-10-05')], { total: 4000 }));
      http
        .expectOne((r) => r.url.includes('hasDueDate=false'))
        .flush(paginated([calendarTask('u-1', '')], { total: 5000 }));
      tick();

      expect(store.calendarRangeLoaded()).toBe(true);
      expect(store.calendarRangeTruncated()).toBe(true);
      expect(store.undatedTruncated()).toBe(true);

      // Sign out
      currentUserId.set(null);
      tick();

      expect(store.calendarRangeTasks()).toEqual([]);
      expect(store.calendarRangeLoaded()).toBe(false);
      expect(store.calendarRangeTruncated()).toBe(false);
      expect(store.undatedTruncated()).toBe(false);

      // Next user signs in
      currentUserId.set('user-2');
      tick();

      expect(store.calendarRangeLoaded()).toBe(false);
      http.expectOne((r) => r.url.includes('dueFrom=2026-10-01')).flush(paginated([]));
      tick();

      expect(store.calendarRangeLoaded()).toBe(true);
    }));
  });
});
