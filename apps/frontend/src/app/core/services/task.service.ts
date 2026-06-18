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
  readonly revision = this.refreshState.asReadonly();

  getArchivedTasks(page: number, pageSize: number) {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?page=${page}&pageSize=${pageSize}&completed=true&includeSubtasks=true`,
      { withCredentials: true },
    );
  }
  fetchTodayTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=today&tz=${tz}&pageSize=100`,
      { withCredentials: true },
    );
  }

  fetchOverdueTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?overdue=true&tz=${tz}&pageSize=100`,
      { withCredentials: true },
    );
  }

  fetchInboxTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=inbox&tz=${tz}&pageSize=100`,
      { withCredentials: true },
    );
  }

  fetchUpcomingTasks$() {
    const tz = getUserTimezone();
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=upcoming&tz=${tz}&pageSize=100`,
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
      >(`${this.baseUrl}/tasks?page=1&pageSize=1000&completed=false&includeSubtasks=true`, { withCredentials: true })
      .pipe(map((response) => response.data));
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

  readonly todayTasks = toSignal(
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
        return this.fetchTodayTasks$().pipe(
          map((response) =>
            response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order),
          ),
          catchError(this.handleLoadError('today tasks')),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly overdueTasks = toSignal(
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
        return this.fetchOverdueTasks$().pipe(
          map((response) =>
            response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order),
          ),
          catchError(this.handleLoadError('overdue tasks')),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly inboxTasks = toSignal(
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
        return this.fetchInboxTasks$().pipe(
          map((response) =>
            response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order),
          ),
          catchError(this.handleLoadError('inbox tasks')),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly upcomingTasks = toSignal(
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
        return this.fetchUpcomingTasks$().pipe(
          map((response) =>
            response.data
              .filter((task) => !task.parentId)
              .sort((left, right) => left.order - right.order),
          ),
          catchError(this.handleLoadError('upcoming tasks')),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

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
      const createdTask = await firstValueFrom(
        this.http.post<Task>(`${this.baseUrl}/tasks`, payload, { withCredentials: true }),
      );
      this.refreshState.update((value: number) => value + 1);
      this.labelService.refreshLabels();
      this.projectService.refreshProjects();
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
      this.labelService.refreshLabels();
      this.projectService.refreshProjects();
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
      this.labelService.refreshLabels();
      this.projectService.refreshProjects();
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

  refreshTasks() {
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
