import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BatchTaskPatchDto,
  BatchUpdateTasksResponse,
  CreateTaskDto,
  PaginatedResponse,
  Priority,
  Task,
  UpdateTaskDto,
} from '@yotara/shared';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getUserTimezone } from '../../shared/utils/timezone';
import { DateTime } from 'luxon';

/**
 * Largest tasks page the app requests. It matches the API's per-page cap; the
 * calendar flags truncation when a window returns more than it can hold.
 */
export const TASKS_PAGE_SIZE = 3000;

/**
 * Opt-out for the global error toast. A caller that reports the failure itself
 * sets this so the person sees one message, not the same failure twice.
 */
export interface MutationOptions {
  skipErrorToast?: boolean;
}

function skipErrorHeaders(options: MutationOptions): Record<string, string> | undefined {
  return options.skipErrorToast ? { 'X-Skip-Error': 'true' } : undefined;
}

export interface TaskFilterState {
  labelIds: string[];
  labelMode: 'any' | 'all';
  projectId: string | null;
  priority: Priority | null;
}

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  fetchRecentlyCompletedTasks$(page = 1, pageSize = 100): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?page=${page}&pageSize=${pageSize}&completed=true&includeSubtasks=true`,
      { withCredentials: true },
    );
  }

  getArchivedTasks(page: number, pageSize: number): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?page=${page}&pageSize=${pageSize}&completed=true&includeSubtasks=true`,
      { withCredentials: true },
    );
  }

  getDeletedTasks(page: number, pageSize: number): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?deleted=true&includeSubtasks=true&page=${page}&pageSize=${pageSize}`,
      { withCredentials: true },
    );
  }

  /** Active tasks with no project — the pool for "Add existing task". */
  getUnassignedTasks(pageSize = TASKS_PAGE_SIZE): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?unassigned=true&completed=false&page=1&pageSize=${pageSize}`,
      { withCredentials: true },
    );
  }

  /** Applies one patch to several tasks in a single API call. */
  updateTasks$(taskIds: string[], patch: BatchTaskPatchDto): Observable<BatchUpdateTasksResponse> {
    return this.http.patch<BatchUpdateTasksResponse>(
      `${this.baseUrl}/tasks`,
      { taskIds, patch },
      { withCredentials: true },
    );
  }

  restoreTask$(taskId: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.baseUrl}/tasks/${taskId}/restore`, null, {
      withCredentials: true,
    });
  }

  clearCompletedTasks$(): Observable<{ ok: boolean; removed: number }> {
    return this.http.delete<{ ok: boolean; removed: number }>(`${this.baseUrl}/tasks/completed`, {
      withCredentials: true,
    });
  }

  fetchTodayTasks$(tz = getUserTimezone()): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=today&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchOverdueTasks$(tz = getUserTimezone()): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?overdue=true&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchInboxTasks$(tz = getUserTimezone()): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=inbox&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchUpcomingTasks$(tz = getUserTimezone()): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?view=upcoming&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  fetchCompletedSincePage$(
    completedSince: string,
    page = 1,
    pageSize = TASKS_PAGE_SIZE,
    tz = getUserTimezone(),
  ): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?completedSince=${completedSince}&tz=${tz}&page=${page}&pageSize=${pageSize}`,
      { withCredentials: true },
    );
  }

  fetchTodayCompletedTasks$(
    today = DateTime.now().setZone(getUserTimezone()).toFormat('yyyy-MM-dd'),
    tz = getUserTimezone(),
  ): Observable<Task[]> {
    const fetchPage = (page: number): Observable<Task[]> =>
      this.fetchCompletedSincePage$(today, page, TASKS_PAGE_SIZE, tz).pipe(
        switchMap((response) => {
          const tasks = response.data.filter((task) => !task.parentId);
          return response.meta.hasNextPage
            ? fetchPage(page + 1).pipe(map((remaining) => [...tasks, ...remaining]))
            : of(tasks);
        }),
      );

    return fetchPage(1);
  }

  /** Fetch all active tasks including subtasks (for subtask maps, labels, search). */
  fetchAllActiveTasks$(): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?page=1&pageSize=${TASKS_PAGE_SIZE}&completed=false&includeSubtasks=true`,
      { withCredentials: true },
    );
  }

  /**
   * Fetch tasks carrying one label (the Labels page pane). Runs server-side
   * via the labelIds filter so the pane matches the flat, non-deleted count
   * scope the label list reports. `completed` maps the Open/Completed/All
   * pane tabs; undefined asks for both.
   */
  fetchTasksByLabel$(labelId: string, completed?: boolean): Observable<PaginatedResponse<Task[]>> {
    const params = new URLSearchParams({
      labelIds: labelId,
      includeSubtasks: 'true',
      page: '1',
      pageSize: String(TASKS_PAGE_SIZE),
    });
    if (completed !== undefined) {
      params.set('completed', String(completed));
    }

    return this.http.get<PaginatedResponse<Task[]>>(`${this.baseUrl}/tasks?${params.toString()}`, {
      withCredentials: true,
    });
  }

  fetchTasksByFilters$(filter: TaskFilterState): Observable<PaginatedResponse<Task[]>> {
    const params = new URLSearchParams({
      includeSubtasks: 'true',
      completed: 'false',
      page: '1',
      pageSize: String(TASKS_PAGE_SIZE),
    });
    if (filter.labelIds.length > 0) {
      params.set('labelIds', filter.labelIds.join(','));
      params.set('labelMode', filter.labelMode);
    }
    if (filter.projectId) {
      params.set('projectId', filter.projectId);
    }
    if (filter.priority) {
      params.set('priority', filter.priority);
    }

    return this.http.get<PaginatedResponse<Task[]>>(`${this.baseUrl}/tasks?${params.toString()}`, {
      withCredentials: true,
    });
  }

  /** Fetch active tasks without a due date (the calendar's No date list). */
  fetchUndatedTasks$(tz = getUserTimezone()): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?hasDueDate=false&completed=false&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  /** Fetch tasks due within an inclusive calendar-date range (YYYY-MM-DD bounds). */
  fetchTasksDueBetween$(
    dueFrom: string,
    dueTo: string,
    tz = getUserTimezone(),
  ): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?dueFrom=${dueFrom}&dueTo=${dueTo}&tz=${tz}&pageSize=${TASKS_PAGE_SIZE}`,
      { withCredentials: true },
    );
  }

  /**
   * Fetch all tasks for export (bypasses the 100-task cached page).
   * Returns up to 10,000 tasks — enough for any reasonable power user.
   */
  fetchAllTasks$(): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(`${this.baseUrl}/tasks?export=true`, {
      withCredentials: true,
    });
  }

  createTask$(payload: CreateTaskDto, tz = getUserTimezone()): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks`, payload, {
      withCredentials: true,
      params: { tz },
    });
  }

  updateTask$(
    taskId: string,
    payload: UpdateTaskDto,
    tz = getUserTimezone(),
    options: MutationOptions = {},
  ): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/tasks/${taskId}?tz=${tz}`, payload, {
      withCredentials: true,
      headers: skipErrorHeaders(options),
    });
  }

  deleteTask$(taskId: string, options: MutationOptions = {}): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/tasks/${taskId}`, {
      withCredentials: true,
      headers: skipErrorHeaders(options),
    });
  }

  fetchSubtasks$(parentId: string, pageSize = 100): Observable<PaginatedResponse<Task[]>> {
    return this.http.get<PaginatedResponse<Task[]>>(
      `${this.baseUrl}/tasks?parentId=${parentId}&pageSize=${pageSize}`,
      { withCredentials: true },
    );
  }
}
