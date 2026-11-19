import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Task } from '@yotara/shared';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  interval,
  map,
  of,
  startWith,
  switchMap,
  tap,
  type Observable,
} from 'rxjs';
import { DateTime } from 'luxon';
import { AuthStateService } from './auth-state.service';
import { LogService } from './log.service';
import { TaskApiService, TaskFilterState } from './task-api.service';
import { TaskRefreshState } from './task-refresh-state';
import { parseCalendarDate, startOfToday } from '../../shared/utils/timestamps';
import { getUserTimezone } from '../../shared/utils/timezone';

export type UpcomingBucket = 'This Week' | 'Next Week' | 'Later';

export interface UpcomingTaskGroup {
  label: UpcomingBucket;
  tasks: Task[];
}

/** Stable identity for a filter combination, independent of label order. */
function taskFilterKey(filter: TaskFilterState): string {
  return [
    [...filter.labelIds].sort().join(','),
    filter.labelMode,
    filter.projectId ?? '',
    filter.priority ?? '',
  ].join(':');
}

function hasActiveTaskFilters(filter: TaskFilterState): boolean {
  return filter.labelIds.length > 0 || filter.projectId !== null || filter.priority !== null;
}

@Injectable({ providedIn: 'root' })
export class TaskListStore {
  private taskApiService = inject(TaskApiService);
  private authState = inject(AuthStateService);
  private refreshState = inject(TaskRefreshState);
  private logService = inject(LogService);

  private loadingState = signal(false);
  private errorState = signal<string | null>(null);

  private filterState = signal<TaskFilterState>({
    labelIds: [],
    labelMode: 'any',
    projectId: null,
    priority: null,
  });
  private filterLoadingState = signal(false);
  private filterResolvedKeyState = signal('');
  private filterTruncatedState = signal(false);
  private labelPaneTruncatedState = signal(false);

  private todayTruncatedState = signal(false);
  private overdueTruncatedState = signal(false);
  private inboxTruncatedState = signal(false);
  private upcomingTruncatedState = signal(false);

  private handleLoadError(context: string) {
    return (error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return of([] as Task[]);
      }

      this.logService.error(`Failed to load ${context}`, error, 'TaskService');
      this.errorState.set(`Could not load ${context} right now.`);
      return of([] as Task[]);
    };
  }

  setError(message: string | null): void {
    this.errorState.set(message);
  }

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly recentlyCompleted = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          return of([] as Task[]);
        }
        this.errorState.set(null);

        return this.taskApiService.fetchRecentlyCompletedTasks$().pipe(
          map((response) => response.data),
          catchError(this.handleLoadError('recently completed tasks')),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly allActiveTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.loadingState.set(false);
          return of([] as Task[]);
        }
        this.loadingState.set(true);
        this.errorState.set(null);
        return this.taskApiService.fetchAllActiveTasks$().pipe(
          map((response) => response.data),
          catchError(this.handleLoadError('tasks')),
          finalize(() => this.loadingState.set(false)),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly todayTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.todayTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.taskApiService.fetchTodayTasks$().pipe(
          map((response) => {
            this.todayTruncatedState.set(response.meta.total > response.data.length);
            return response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order);
          }),
          catchError((error) => {
            this.todayTruncatedState.set(false);
            return this.handleLoadError('today tasks')(error);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly todayTruncated = this.todayTruncatedState.asReadonly();

  readonly overdueTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.overdueTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.taskApiService.fetchOverdueTasks$().pipe(
          map((response) => {
            this.overdueTruncatedState.set(response.meta.total > response.data.length);
            return response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order);
          }),
          catchError((error) => {
            this.overdueTruncatedState.set(false);
            return this.handleLoadError('overdue tasks')(error);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly overdueTruncated = this.overdueTruncatedState.asReadonly();

  readonly inboxTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.inboxTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.taskApiService.fetchInboxTasks$().pipe(
          map((response) => {
            this.inboxTruncatedState.set(response.meta.total > response.data.length);
            return response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order);
          }),
          catchError((error) => {
            this.inboxTruncatedState.set(false);
            return this.handleLoadError('inbox tasks')(error);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly inboxTruncated = this.inboxTruncatedState.asReadonly();

  readonly upcomingTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.upcomingTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.taskApiService.fetchUpcomingTasks$().pipe(
          map((response) => {
            this.upcomingTruncatedState.set(response.meta.total > response.data.length);
            return response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order);
          }),
          catchError((error) => {
            this.upcomingTruncatedState.set(false);
            return this.handleLoadError('upcoming tasks')(error);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly upcomingTruncated = this.upcomingTruncatedState.asReadonly();

  private readonly todayDateKey$ = interval(60_000).pipe(
    startWith(0),
    map(() => DateTime.now().setZone(getUserTimezone()).toFormat('yyyy-MM-dd')),
    distinctUntilChanged(),
  );

  readonly todayCompletedTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
      this.todayDateKey$,
    ]).pipe(
      switchMap(([initialized, currentUserId, , today]) => {
        if (!initialized || !currentUserId) {
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.taskApiService
          .fetchTodayCompletedTasks$(today)
          .pipe(catchError(this.handleLoadError('completed tasks')));
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly upcomingTaskGroups = computed<UpcomingTaskGroup[]>(() => {
    const buckets: Record<UpcomingBucket, Task[]> = {
      'This Week': [],
      'Next Week': [],
      Later: [],
    };

    for (const task of this.upcomingTasks()) {
      buckets[this.upcomingBucketForTask(task)].push(task);
    }

    return (Object.entries(buckets) as [UpcomingBucket, Task[]][])
      .filter(([, tasks]) => tasks.length > 0)
      .map(([label, tasks]) => ({ label, tasks }));
  });

  setFilters(next: TaskFilterState): void {
    const normalized: TaskFilterState = {
      labelIds: [...new Set(next.labelIds.filter(Boolean))],
      labelMode: next.labelMode,
      projectId: next.projectId || null,
      priority: next.priority || null,
    };
    if (taskFilterKey(this.filterState()) === taskFilterKey(normalized)) {
      return;
    }
    this.filterState.set(normalized);
  }

  readonly filteredTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
      toObservable(this.filterState),
    ]).pipe(
      switchMap(([initialized, currentUserId, , filter]) => {
        const key = taskFilterKey(filter);
        if (!initialized || !currentUserId || !hasActiveTaskFilters(filter)) {
          this.filterLoadingState.set(false);
          this.filterTruncatedState.set(false);
          if (!hasActiveTaskFilters(filter)) {
            this.filterResolvedKeyState.set(key);
          }
          return of([] as Task[]);
        }
        this.filterLoadingState.set(true);
        return this.fetchTasksByFilters$(filter).pipe(
          tap({
            next: () => this.filterResolvedKeyState.set(key),
            error: () => this.filterResolvedKeyState.set(key),
          }),
          finalize(() => this.filterLoadingState.set(false)),
          catchError(this.handleLoadError('filtered tasks')),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly filterLoading = this.filterLoadingState.asReadonly();
  readonly filterPending = computed(() => {
    const filter = this.filterState();
    return hasActiveTaskFilters(filter) && this.filterResolvedKeyState() !== taskFilterKey(filter);
  });
  readonly filterTruncated = this.filterTruncatedState.asReadonly();
  readonly labelPaneTruncated = this.labelPaneTruncatedState.asReadonly();

  private fetchTasksByFilters$(filter: TaskFilterState): Observable<Task[]> {
    return this.taskApiService.fetchTasksByFilters$(filter).pipe(
      tap({
        next: (response) =>
          this.filterTruncatedState.set(response.meta.total > response.data.length),
        error: () => this.filterTruncatedState.set(false),
      }),
      map((response) => response.data),
    );
  }

  fetchTasksByLabel$(labelId: string, completed?: boolean): Observable<Task[]> {
    return this.taskApiService.fetchTasksByLabel$(labelId, completed).pipe(
      tap({
        next: (response) =>
          this.labelPaneTruncatedState.set(response.meta.total > response.data.length),
        error: () => this.labelPaneTruncatedState.set(false),
      }),
      map((response) => response.data),
    );
  }

  fetchTodayTasks$() {
    return this.taskApiService.fetchTodayTasks$();
  }

  fetchOverdueTasks$() {
    return this.taskApiService.fetchOverdueTasks$();
  }

  fetchInboxTasks$() {
    return this.taskApiService.fetchInboxTasks$();
  }

  fetchUpcomingTasks$() {
    return this.taskApiService.fetchUpcomingTasks$();
  }

  fetchTodayCompletedTasks$(
    today = DateTime.now().setZone(getUserTimezone()).toFormat('yyyy-MM-dd'),
  ): Observable<Task[]> {
    return this.taskApiService.fetchTodayCompletedTasks$(today);
  }

  fetchAllActiveTasks$(): Observable<Task[]> {
    return this.taskApiService.fetchAllActiveTasks$().pipe(map((response) => response.data));
  }

  formatTaskDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
    const dt = parseCalendarDate(value);
    if (!dt) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', options ?? { month: 'short', day: 'numeric' }).format(
      dt.toJSDate(),
    );
  }

  upcomingBucketForTask(task: Task): UpcomingBucket {
    const dueDate = parseCalendarDate(task.dueDate);
    const today = startOfToday();

    if (!dueDate) {
      return 'Later';
    }

    const dayDiff = Math.floor(dueDate.diff(today, 'days').days);

    if (dayDiff <= 7) {
      return 'This Week';
    }

    if (dayDiff <= 14) {
      return 'Next Week';
    }

    return 'Later';
  }
}
