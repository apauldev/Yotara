import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  type Observable,
} from 'rxjs';
import { PaginatedResponse, Task } from '@yotara/shared';
import { AuthStateService } from './auth-state.service';
import { LogService } from './log.service';
import { TaskApiService } from './task-api.service';
import { TaskRefreshState } from './task-refresh-state';
import { TaskListStore } from './task-list.store';

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
export interface CalendarRangeState {
  grid: { from: string; to: string };
  focus: { from: string; to: string } | null;
}

export function calendarRangeStateKey(range: CalendarRangeState): string {
  return JSON.stringify([
    range.grid.from,
    range.grid.to,
    range.focus?.from ?? null,
    range.focus?.to ?? null,
  ]);
}

/** Merge the grid and focus windows, keeping one copy of tasks in both. */
export function mergeCalendarTasks(gridTasks: Task[], focusTasks: Task[]): Task[] {
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
export class TaskCalendarStore {
  private taskApiService = inject(TaskApiService);
  private authState = inject(AuthStateService);
  private refreshState = inject(TaskRefreshState);
  private taskListStore = inject(TaskListStore);
  private logService = inject(LogService);

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

  fetchUndatedTasks$(): Observable<PaginatedResponse<Task[]>> {
    return this.taskApiService.fetchUndatedTasks$();
  }

  fetchTasksDueBetween$(dueFrom: string, dueTo: string): Observable<PaginatedResponse<Task[]>> {
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
