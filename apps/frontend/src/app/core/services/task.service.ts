import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CreateTaskDto, PaginatedResponse, Task, UpdateTaskDto } from '@yotara/shared';
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

type UpcomingBucket = 'This Week' | 'Next Week' | 'Later';

export interface UpcomingTaskGroup {
  label: UpcomingBucket;
  tasks: Task[];
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private authState = inject(AuthStateService);
  private baseUrl = environment.apiBaseUrl;
  private refreshState = signal(0);
  private loadingState = signal(false);
  private creatingState = signal(false);
  private errorState = signal<string | null>(null);

  readonly tasks = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized]) => {
        if (!initialized || !this.authState.isAuthenticated()) {
          this.errorState.set(null);
          return of([] as Task[]);
        }

        this.loadingState.set(true);
        this.errorState.set(null);

        return this.http
          .get<PaginatedResponse<Task[]>>(`${this.baseUrl}/tasks?page=1&pageSize=100`, {
            withCredentials: true,
          })
          .pipe(
            map((response) => [...response.data].sort((left, right) => left.order - right.order)),
            catchError((error: unknown) => {
              if (error instanceof HttpErrorResponse && error.status === 401) {
                this.errorState.set(null);
                return of([] as Task[]);
              }

              console.error('Failed to load tasks', error);
              this.errorState.set('Could not load your tasks right now.');
              return of([] as Task[]);
            }),
            finalize(() => {
              this.loadingState.set(false);
            }),
          );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly loading = this.loadingState.asReadonly();
  readonly creating = this.creatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly activeTasks = computed(() =>
    this.tasks().filter((task) => !task.completed && task.status !== 'archived'),
  );
  readonly pendingTasks = computed(() => this.tasks().filter((task) => !task.completed));
  readonly completedTasks = computed(() => this.tasks().filter((task) => task.completed));
  readonly inboxTasks = computed(() =>
    this.activeTasks().filter((task) => task.status === 'inbox'),
  );
  readonly overdueTasks = computed(() =>
    this.activeTasks().filter((task) => this.isTaskOverdue(task)),
  );
  readonly todayTasks = computed(() =>
    this.activeTasks().filter((task) => this.isTaskToday(task) && !this.isTaskOverdue(task)),
  );
  readonly todayCompletedTasks = computed(() =>
    this.completedTasks().filter((task) => this.isTaskToday(task) || this.isTaskOverdue(task)),
  );
  readonly upcomingTasks = computed(() =>
    this.activeTasks().filter((task) => this.isTaskUpcoming(task)),
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

  async createTask(payload: CreateTaskDto) {
    this.creatingState.set(true);
    this.errorState.set(null);

    try {
      const createdTask = await firstValueFrom(
        this.http.post<Task>(`${this.baseUrl}/tasks`, payload, { withCredentials: true }),
      );
      this.refreshState.update((value: number) => value + 1);
      return createdTask;
    } catch (error) {
      console.error('Failed to create task', error);
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
      const updatedTask = await firstValueFrom(
        this.http.patch<Task>(`${this.baseUrl}/tasks/${taskId}`, payload, {
          withCredentials: true,
        }),
      );
      this.refreshState.update((value: number) => value + 1);
      return updatedTask;
    } catch (error) {
      console.error('Failed to update task', error);
      this.errorState.set('Could not update your task right now.');
      throw error;
    } finally {
      this.creatingState.set(false);
    }
  }

  refreshTasks() {
    this.refreshState.update((value: number) => value + 1);
  }

  formatTaskDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
    const date = toCalendarDate(value);
    if (!date) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', options ?? { month: 'short', day: 'numeric' }).format(
      date,
    );
  }

  isTaskOverdue(task: Task) {
    const dueDate = toCalendarDate(task.dueDate);
    const today = startOfToday();

    return !!dueDate && dueDate.getTime() < today.getTime() && !task.completed;
  }

  isTaskToday(task: Task) {
    if (task.completed && task.status === 'today') {
      return true;
    }

    const dueDate = toCalendarDate(task.dueDate);
    return task.status === 'today' || (!!dueDate && dueDate.getTime() === startOfToday().getTime());
  }

  isTaskUpcoming(task: Task) {
    if (task.completed || this.isTaskOverdue(task) || this.isTaskToday(task)) {
      return false;
    }

    const dueDate = toCalendarDate(task.dueDate);
    return (
      task.status === 'upcoming' || (!!dueDate && dueDate.getTime() > startOfToday().getTime())
    );
  }

  private upcomingBucketForTask(task: Task): UpcomingBucket {
    const dueDate = toCalendarDate(task.dueDate);
    const today = startOfToday();

    if (!dueDate) {
      return 'Later';
    }

    const dayDiff = Math.floor((dueDate.getTime() - today.getTime()) / 86_400_000);

    if (dayDiff <= 7) {
      return 'This Week';
    }

    if (dayDiff <= 14) {
      return 'Next Week';
    }

    return 'Later';
  }
}

function toCalendarDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
