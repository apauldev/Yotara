import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CreateTaskDto, PaginatedResponse, Task, UpdateTaskDto } from '@yotara/shared';
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
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStateService } from './auth-state.service';
import { LabelService } from './label.service';
import { ProjectService } from './project.service';
import { parseCalendarDate, startOfToday } from '../../shared/utils/timestamps';
import { getUserTimezone } from '../../shared/utils/timezone';
import { DateTime } from 'luxon';

export type UpcomingBucket = 'This Week' | 'Next Week' | 'Later';

export interface UpcomingTaskGroup {
  label: UpcomingBucket;
  tasks: Task[];
}

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

/**
 * Largest tasks page the app requests. It matches the API's per-page cap; the
 * calendar flags truncation when a window returns more than it can hold.
 */
export const TASKS_PAGE_SIZE = 3000;

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
  private http = inject(HttpClient);
  private authState = inject(AuthStateService);
  private labelService = inject(LabelService);
  private projectService = inject(ProjectService);
  private logService = inject(LogService);
  private baseUrl = environment.apiBaseUrl;
  private refreshState = signal(0);
  private loadingState = signal(false);
  private creatingState = signal(false);
  private errorState = signal<string | null>(null);
  private calendarRangeState = signal<CalendarRangeState | null>(null);
  private calendarRangeLoadingState = signal(false);
  private calendarRangeLoadedState = signal(false);
  private calendarRangeTruncatedState = signal(false);
  private undatedTruncatedState = signal(false);
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

  readonly recentlyCompleted = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          return of([] as Task[]);
        }
        this.errorState.set(null);

        return this.http
          .get<
            PaginatedResponse<Task[]>
          >(`${this.baseUrl}/tasks?page=1&pageSize=100&completed=true&includeSubtasks=true`, { withCredentials: true })
          .pipe(
            map((response) => response.data),
            catchError(this.handleLoadError('recently completed tasks')),
          );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly loading = this.loadingState.asReadonly();
  readonly creating = this.creatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly version = this.refreshState.asReadonly();

  getArchivedTasks(page: number, pageSize: number) {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?page=${page}&pageSize=${pageSize}&completed=true&includeSubtasks=true`,
      { withCredentials: true },
    );
  }
  fetchTodayTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=today&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchOverdueTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?overdue=true&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchInboxTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=inbox&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchUpcomingTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=upcoming&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchTodayCompletedTasks$() {
    const tz = getUserTimezone();
    const today = DateTime.now().setZone(tz).toFormat('yyyy-MM-dd');
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?completedSince=${today}&tz=${tz}&pageSize=100`,
      { withCredentials: true },
    );
  }

  /** Fetch all active tasks including subtasks (for subtask maps, labels, search). */
  fetchAllActiveTasks$() {
    return this.http
      .get<
        PaginatedResponse<Task[]>
      >(`${this.baseUrl}/tasks?page=1&pageSize=${TASKS_PAGE_SIZE}&completed=false&includeSubtasks=true`, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  /**
   * Fetch the open tasks carrying one label (the Labels page pane). Runs
   * server-side via the labelIds filter so the pane matches the flat,
   * non-deleted count scope the label list reports — the Labels page must not
   * client-filter allActiveTasks.
   */
  fetchTasksByLabel$(labelId: string) {
    return this.http
      .get<
        PaginatedResponse<Task[]>
      >(`${this.baseUrl}/tasks?labelIds=${labelId}&completed=false&includeSubtasks=true&page=1&pageSize=${TASKS_PAGE_SIZE}`, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  /** Fetch active tasks without a due date (the calendar's No date list). */
  fetchUndatedTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?hasDueDate=false&completed=false&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  /** Fetch tasks due within an inclusive calendar-date range (YYYY-MM-DD bounds). */
  fetchTasksDueBetween$(dueFrom: string, dueTo: string) {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?dueFrom=${dueFrom}&dueTo=${dueTo}&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  /** Signal of all active tasks for subtask maps, labels, and search. */
  readonly allActiveTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.loadingState.set(false);
          return of([] as Task[]);
        }
        this.loadingState.set(true);
        this.errorState.set(null);
        return this.fetchAllActiveTasks$().pipe(
          catchError(this.handleLoadError('tasks')),
          finalize(() => this.loadingState.set(false)),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  /** Signal of active tasks without a due date, for the calendar's No date list. */
  readonly undatedTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          // No user owns the list now; clear its flag so the next user does
          // not inherit a truncation notice from the previous account.
          this.undatedTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.fetchUndatedTasks$().pipe(
          map((response) => {
            this.undatedTruncatedState.set(response.meta.total > response.data.length);
            return response.data;
          }),
          catchError((error) => {
            this.undatedTruncatedState.set(false);
            return this.handleLoadError('undated tasks')(error);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  /**
   * True when the No date list holds more tasks than the API returns in a
   * page, so the list (and its count) is incomplete.
   */
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

  /**
   * True once a window has been fetched, so refetches never re-show the
   * loader. Reset on sign-out so the next user in the tab still gets it.
   */
  readonly calendarRangeLoaded = this.calendarRangeLoadedState.asReadonly();

  /**
   * True when the fetched windows hold more tasks than the API returns in a
   * page, so some days in the range are missing their tail.
   */
  readonly calendarRangeTruncated = this.calendarRangeTruncatedState.asReadonly();

  /**
   * Signal of tasks due inside the calendar's visible windows. The grid and
   * the open day's week are fetched as two bounded requests (the week is
   * skipped when the grid already covers it), so the payload never grows with
   * the months browsed between the selection and the drawn grid. A window that
   * fills the API page cap is surfaced through `calendarRangeTruncated`.
   */
  readonly calendarRangeTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
      toObservable(this.calendarRangeState),
    ]).pipe(
      switchMap(([initialized, currentUserId, , range]) => {
        if (!initialized || !currentUserId || !range) {
          // No user owns the calendar now, so drop the sticky load flags. The
          // next user in this tab then gets the loading state instead of a
          // stale, empty calendar (and no stale truncation notice).
          this.calendarRangeLoadingState.set(false);
          this.calendarRangeLoadedState.set(false);
          this.calendarRangeTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.calendarRangeLoadingState.set(true);
        this.errorState.set(null);

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
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly todayTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.todayTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.fetchTodayTasks$().pipe(
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

  /** True when the Today view holds more tasks than one API page. */
  readonly todayTruncated = this.todayTruncatedState.asReadonly();

  readonly overdueTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.overdueTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.fetchOverdueTasks$().pipe(
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

  /** True when the Overdue list holds more tasks than one API page. */
  readonly overdueTruncated = this.overdueTruncatedState.asReadonly();

  readonly inboxTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.inboxTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.fetchInboxTasks$().pipe(
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

  /** True when the Inbox holds more tasks than one API page. */
  readonly inboxTruncated = this.inboxTruncatedState.asReadonly();

  readonly upcomingTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.upcomingTruncatedState.set(false);
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.fetchUpcomingTasks$().pipe(
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

  /** True when the Upcoming list holds more tasks than one API page. */
  readonly upcomingTruncated = this.upcomingTruncatedState.asReadonly();

  readonly todayCompletedTasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          return of([] as Task[]);
        }
        this.errorState.set(null);
        return this.fetchTodayCompletedTasks$().pipe(
          map((response) => response.data.filter((task) => !task.parentId)),
          catchError(this.handleLoadError('completed tasks')),
        );
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

  /** Fetch all tasks for export (bypasses the 100-task cached page).
   *  Returns up to 10,000 tasks — enough for any reasonable power user.
   *  Beyond that, a database-level export is more appropriate. */
  fetchAllTasks(): Promise<Task[]> {
    return firstValueFrom(
      this.http
        .get<PaginatedResponse<Task[]>>(`${this.baseUrl}/tasks?export=true`, {
          withCredentials: true,
        })
        .pipe(map((res) => res.data)),
    );
  }

  async createTask(payload: CreateTaskDto) {
    this.creatingState.set(true);
    this.errorState.set(null);

    try {
      const tz = getUserTimezone();
      const createdTask = await firstValueFrom(
        this.http.post<Task>(`${this.baseUrl}/tasks`, payload, {
          withCredentials: true,
          params: { tz },
        }),
      );
      this.refreshState.update((value: number) => value + 1);
      this.labelService.refresh();
      this.projectService.refresh();
      return createdTask;
    } catch (error) {
      this.logService.error('Failed to create task', error, 'TaskService');
      this.errorState.set('Could not save your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async updateTask(taskId: string, payload: UpdateTaskDto) {
    this.creatingState.set(true);
    this.errorState.set(null);

    try {
      const tz = getUserTimezone();
      const updatedTask = await firstValueFrom(
        this.http.patch<Task>(`${this.baseUrl}/tasks/${taskId}?tz=${tz}`, payload, {
          withCredentials: true,
        }),
      );
      this.refreshState.update((value: number) => value + 1);
      this.labelService.refresh();
      this.projectService.refresh();
      return updatedTask;
    } catch (error) {
      this.logService.error('Failed to update task', error, 'TaskService');
      this.errorState.set('Could not update your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async deleteTask(taskId: string) {
    this.creatingState.set(true);
    this.errorState.set(null);

    try {
      await firstValueFrom(
        this.http.delete<{ ok: true }>(`${this.baseUrl}/tasks/${taskId}`, {
          withCredentials: true,
        }),
      );
      this.refreshState.update((value: number) => value + 1);
      this.labelService.refresh();
      this.projectService.refresh();
    } catch (error) {
      this.logService.error('Failed to delete task', error, 'TaskService');
      this.errorState.set('Could not delete your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  async fetchSubtasks(parentId: string): Promise<Task[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<PaginatedResponse<Task[]>>(
          `${this.baseUrl}/tasks?parentId=${parentId}&pageSize=100`,
          { withCredentials: true },
        ),
      );
      return response.data;
    } catch (error) {
      this.logService.error('Failed to fetch subtasks', error, 'TaskService');
      return [];
    }
  }

  refresh() {
    this.refreshState.update((value: number) => value + 1);
  }

  formatTaskDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
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
