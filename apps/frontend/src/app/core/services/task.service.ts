import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  BatchTaskPatchDto,
  CreateTaskDto,
  PaginatedResponse,
  Task,
  UpdateTaskDto,
} from '@yotara/shared';
import { LogService } from './log.service';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  forkJoin,
  map,
  of,
  switchMap,
  type Observable,
} from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { LabelService } from './label.service';
import { ProjectService } from './project.service';
import { TaskApiService, TASKS_PAGE_SIZE, type TaskFilterState } from './task-api.service';
import { TaskRefreshState } from './task-refresh-state';
import { TaskListStore, type UpcomingBucket, type UpcomingTaskGroup } from './task-list.store';
import { getUserTimezone } from '../../shared/utils/timezone';

export { TASKS_PAGE_SIZE, type TaskFilterState };
export type { UpcomingBucket, UpcomingTaskGroup };

/**
 * The calendar's visible windows. The drawn grid and the open day's week are
 * fetched as two fixed-size requests, so browsing to far-away months never
 * grows the payload with the months in between. Bounds are inclusive
 * YYYY-MM-DD dates.
 */
export interface CalendarRangeRequest {
  grid: { from: string; to: string };
  /** The week around the open day; ignored when the grid already covers it. */
  focus: { from: string; to: string };
}

/** Normalized fetch state: focus windows the grid covers collapse to `null`. */
interface CalendarRangeState {
  grid: { from: string; to: string };
  focus: { from: string; to: string } | null;
}

function calendarRangeStateKey(range: CalendarRangeState): string {
  return JSON.stringify([
    range.grid.from,
    range.grid.to,
    range.focus?.from ?? null,
    range.focus?.to ?? null,
  ]);
}

/** Merge the grid and focus windows, keeping one copy of tasks in both. */
function mergeCalendarTasks(gridTasks: Task[], focusTasks: Task[]): Task[] {
  if (focusTasks.length === 0) {
    return gridTasks;
  }

  const byId = new Map(gridTasks.map((task) => [task.id, task]));
  for (const task of focusTasks) {
    if (!byId.has(task.id)) {
      byId.set(task.id, task);
    }
  }

  return [...byId.values()];
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private taskApiService = inject(TaskApiService);
  private taskListStore = inject(TaskListStore);
  private refreshState = inject(TaskRefreshState);
  private authState = inject(AuthStateService);
  private labelService = inject(LabelService);
  private projectService = inject(ProjectService);
  private logService = inject(LogService);

  private creatingState = signal(false);

  // Calendar and undated state (extracted in FE-3)
  private calendarRangeState = signal<CalendarRangeState | null>(null);
  private calendarRangeLoadingState = signal(false);
  private calendarRangeLoadedState = signal(false);
  private calendarRangeSettledKeyState = signal<string | null>(null);
  private calendarRangeTruncatedState = signal(false);
  private undatedRequestedState = signal(false);
  private undatedRetryState = signal(0);
  private undatedLoadingState = signal(false);
  private undatedLoadedState = signal(false);
  private undatedTruncatedState = signal(false);

  private handleLoadError(context: string) {
    return (error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return of([] as Task[]);
      }

      this.logService.error(`Failed to load ${context}`, error, 'TaskService');
      this.taskListStore.setError(`Could not load ${context} right now.`);
      return of([] as Task[]);
    };
  }

  // Delegated list signals & state
  readonly recentlyCompleted = this.taskListStore.recentlyCompleted;
  readonly todayTasks = this.taskListStore.todayTasks;
  readonly todayTruncated = this.taskListStore.todayTruncated;
  readonly overdueTasks = this.taskListStore.overdueTasks;
  readonly overdueTruncated = this.taskListStore.overdueTruncated;
  readonly inboxTasks = this.taskListStore.inboxTasks;
  readonly inboxTruncated = this.taskListStore.inboxTruncated;
  readonly upcomingTasks = this.taskListStore.upcomingTasks;
  readonly upcomingTruncated = this.taskListStore.upcomingTruncated;
  readonly todayCompletedTasks = this.taskListStore.todayCompletedTasks;
  readonly upcomingTaskGroups = this.taskListStore.upcomingTaskGroups;
  readonly allActiveTasks = this.taskListStore.allActiveTasks;
  readonly filteredTasks = this.taskListStore.filteredTasks;
  readonly filterLoading = this.taskListStore.filterLoading;
  readonly filterPending = this.taskListStore.filterPending;
  readonly filterTruncated = this.taskListStore.filterTruncated;
  readonly labelPaneTruncated = this.taskListStore.labelPaneTruncated;
  readonly loading = this.taskListStore.loading;
  readonly error = this.taskListStore.error;
  readonly version = this.refreshState.version;
  readonly creating = this.creatingState.asReadonly();

  // Delegated list methods
  setFilters(next: TaskFilterState) {
    this.taskListStore.setFilters(next);
  }

  fetchTodayTasks$() {
    return this.taskListStore.fetchTodayTasks$();
  }

  fetchOverdueTasks$() {
    return this.taskListStore.fetchOverdueTasks$();
  }

  fetchInboxTasks$() {
    return this.taskListStore.fetchInboxTasks$();
  }

  fetchUpcomingTasks$() {
    return this.taskListStore.fetchUpcomingTasks$();
  }

  fetchTodayCompletedTasks$(today?: string): Observable<Task[]> {
    return this.taskListStore.fetchTodayCompletedTasks$(today);
  }

  fetchAllActiveTasks$(): Observable<Task[]> {
    return this.taskListStore.fetchAllActiveTasks$();
  }

  fetchTasksByLabel$(labelId: string, completed?: boolean): Observable<Task[]> {
    return this.taskListStore.fetchTasksByLabel$(labelId, completed);
  }

  formatTaskDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
    return this.taskListStore.formatTaskDate(value, options);
  }

  upcomingBucketForTask(task: Task): UpcomingBucket {
    return this.taskListStore.upcomingBucketForTask(task);
  }

  refresh() {
    this.refreshState.refresh();
  }

  // HTTP CRUD / batch / retention methods
  getArchivedTasks(page: number, pageSize: number) {
    return this.taskApiService.getArchivedTasks(page, pageSize);
  }

  getDeletedTasks(page: number, pageSize: number) {
    return this.taskApiService.getDeletedTasks(page, pageSize);
  }

  /** Active tasks with no project — the pool for "Add existing task". */
  getUnassignedTasks(pageSize = TASKS_PAGE_SIZE) {
    return this.taskApiService.getUnassignedTasks(pageSize);
  }

  /** Applies one patch to several tasks in a single API call. */
  async updateTasks(taskIds: string[], patch: BatchTaskPatchDto) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      const result = await firstValueFrom(this.taskApiService.updateTasks$(taskIds, patch));
      this.refreshState.refresh();
      this.labelService.refresh();
      this.projectService.refresh();
      return result;
    } catch (error) {
      this.logService.error('Failed to update tasks', error, 'TaskService');
      this.taskListStore.setError('Could not update your tasks right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async restoreTask(taskId: string) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      await firstValueFrom(this.taskApiService.restoreTask$(taskId));
      this.refreshState.refresh();
      this.labelService.refresh();
      this.projectService.refresh();
    } catch (error) {
      this.logService.error('Failed to restore task', error, 'TaskService');
      this.taskListStore.setError('Could not restore your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async clearCompletedTasks() {
    const result = await firstValueFrom(this.taskApiService.clearCompletedTasks$());
    this.refreshState.refresh();
    return result;
  }

  /**
   * Fetch all tasks for export (bypasses the 100-task cached page).
   * Returns up to 10,000 tasks — enough for any reasonable power user.
   */
  fetchAllTasks(): Promise<Task[]> {
    return firstValueFrom(this.taskApiService.fetchAllTasks$().pipe(map((res) => res.data)));
  }

  async createTask(payload: CreateTaskDto) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      const tz = getUserTimezone();
      const createdTask = await firstValueFrom(this.taskApiService.createTask$(payload, tz));
      this.refreshState.refresh();
      this.labelService.refresh();
      this.projectService.refresh();
      return createdTask;
    } catch (error) {
      this.logService.error('Failed to create task', error, 'TaskService');
      this.taskListStore.setError('Could not save your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async updateTask(taskId: string, payload: UpdateTaskDto) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      const tz = getUserTimezone();
      const updatedTask = await firstValueFrom(
        this.taskApiService.updateTask$(taskId, payload, tz),
      );
      this.refreshState.refresh();
      this.labelService.refresh();
      this.projectService.refresh();
      return updatedTask;
    } catch (error) {
      this.logService.error('Failed to update task', error, 'TaskService');
      this.taskListStore.setError('Could not update your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async deleteTask(taskId: string) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      await firstValueFrom(this.taskApiService.deleteTask$(taskId));
      this.refreshState.refresh();
      this.labelService.refresh();
      this.projectService.refresh();
    } catch (error) {
      this.logService.error('Failed to delete task', error, 'TaskService');
      this.taskListStore.setError('Could not delete your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async fetchSubtasks(parentId: string): Promise<Task[]> {
    try {
      const response = await firstValueFrom(this.taskApiService.fetchSubtasks$(parentId));
      return response.data;
    } catch (error) {
      this.logService.error('Failed to fetch subtasks', error, 'TaskService');
      return [];
    }
  }

  // Calendar and undated methods & signals
  fetchUndatedTasks$() {
    return this.taskApiService.fetchUndatedTasks$();
  }

  fetchTasksDueBetween$(dueFrom: string, dueTo: string) {
    return this.taskApiService.fetchTasksDueBetween$(dueFrom, dueTo);
  }

  /** Signal of active tasks without a due date, for the calendar's No date list. */
  readonly undatedTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
      toObservable(this.undatedRequestedState).pipe(distinctUntilChanged()),
      toObservable(this.undatedRetryState),
    ]).pipe(
      switchMap(([initialized, currentUserId, , requested]) => {
        if (!initialized || !currentUserId) {
          this.undatedRequestedState.set(false);
          this.undatedLoadingState.set(false);
          this.undatedLoadedState.set(false);
          this.undatedTruncatedState.set(false);
          return of([] as Task[]);
        }
        if (!requested) {
          return of([] as Task[]);
        }

        this.undatedLoadingState.set(true);
        this.taskListStore.setError(null);
        return this.fetchUndatedTasks$().pipe(
          map((response) => {
            this.undatedLoadedState.set(true);
            this.undatedTruncatedState.set(response.meta.total > response.data.length);
            return response.data;
          }),
          catchError((error) => {
            this.undatedLoadedState.set(false);
            this.undatedTruncatedState.set(false);
            return this.handleLoadError('undated tasks')(error);
          }),
          finalize(() => this.undatedLoadingState.set(false)),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  /** Start loading on first open; reuse loaded data and allow retry after a failure. */
  loadUndatedTasks(): void {
    if (!this.authState.initialized() || !this.authState.currentUserId()) {
      return;
    }
    if (this.undatedLoadingState() || this.undatedLoadedState()) {
      return;
    }

    this.undatedLoadingState.set(true);
    if (this.undatedRequestedState()) {
      this.undatedRetryState.update((version) => version + 1);
    } else {
      this.undatedRequestedState.set(true);
    }
  }

  readonly undatedLoading = this.undatedLoadingState.asReadonly();
  readonly undatedLoaded = this.undatedLoadedState.asReadonly();
  readonly undatedTruncated = this.undatedTruncatedState.asReadonly();

  /**
   * Set the calendar's visible windows (inclusive YYYY-MM-DD bounds). A focus
   * window the grid already covers collapses to `null`, so moving the open day
   * around inside the drawn grid never triggers a refetch.
   */
  setCalendarRange(range: CalendarRangeRequest): void {
    const covered = range.grid.from <= range.focus.from && range.focus.to <= range.grid.to;
    const next: CalendarRangeState = {
      grid: range.grid,
      focus: covered ? null : range.focus,
    };

    this.calendarRangeState.update((current) =>
      current?.grid.from === next.grid.from &&
      current?.grid.to === next.grid.to &&
      current?.focus?.from === next.focus?.from &&
      current?.focus?.to === next.focus?.to
        ? current
        : next,
    );
  }

  readonly calendarRangeLoading = this.calendarRangeLoadingState.asReadonly();
  readonly calendarRangeLoaded = this.calendarRangeLoadedState.asReadonly();

  readonly calendarRangeReady = computed(() => {
    const range = this.calendarRangeState();
    return (
      range !== null &&
      !this.calendarRangeLoadingState() &&
      this.calendarRangeSettledKeyState() === calendarRangeStateKey(range)
    );
  });

  readonly calendarRangeTruncated = this.calendarRangeTruncatedState.asReadonly();

  readonly calendarRangeTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState.version),
      toObservable(this.calendarRangeState),
    ]).pipe(
      switchMap(([initialized, currentUserId, , range]) => {
        if (!initialized || !currentUserId || !range) {
          this.calendarRangeLoadingState.set(false);
          this.calendarRangeLoadedState.set(false);
          this.calendarRangeSettledKeyState.set(null);
          this.calendarRangeTruncatedState.set(false);
          return of([] as Task[]);
        }
        const requestedRangeKey = calendarRangeStateKey(range);
        this.calendarRangeLoadingState.set(true);
        this.taskListStore.setError(null);

        const focusResponse$ = range.focus
          ? this.fetchTasksDueBetween$(range.focus.from, range.focus.to)
          : of<PaginatedResponse<Task[]> | null>(null);

        return forkJoin([
          this.fetchTasksDueBetween$(range.grid.from, range.grid.to),
          focusResponse$,
        ]).pipe(
          map(([gridResponse, focusResponse]) => {
            const truncated =
              gridResponse.meta.total > gridResponse.data.length ||
              (focusResponse ? focusResponse.meta.total > focusResponse.data.length : false);
            this.calendarRangeTruncatedState.set(truncated);
            return mergeCalendarTasks(gridResponse.data, focusResponse?.data ?? []);
          }),
          catchError((error) => {
            this.calendarRangeTruncatedState.set(false);
            return this.handleLoadError('calendar tasks')(error);
          }),
          finalize(() => {
            this.calendarRangeLoadingState.set(false);
            this.calendarRangeLoadedState.set(true);
            this.calendarRangeSettledKeyState.set(requestedRangeKey);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );
}
