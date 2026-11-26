import { Injectable, inject, signal } from '@angular/core';
import { BatchTaskPatchDto, CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { LogService } from './log.service';
import { firstValueFrom, map, type Observable } from 'rxjs';
import { LabelService } from './label.service';
import { ProjectService } from './project.service';
import {
  TaskApiService,
  TASKS_PAGE_SIZE,
  type TaskFilterState,
  type MutationOptions,
} from './task-api.service';
import { TaskRefreshState } from './task-refresh-state';
import { TaskListStore, type UpcomingBucket, type UpcomingTaskGroup } from './task-list.store';
import { TaskCalendarStore, type CalendarRangeRequest } from './task-calendar.store';
import { getUserTimezone } from '../../shared/utils/timezone';

export { TASKS_PAGE_SIZE, type TaskFilterState };
export type { UpcomingBucket, UpcomingTaskGroup };
export type { CalendarRangeRequest };

@Injectable({ providedIn: 'root' })
export class TaskService {
  private taskApiService = inject(TaskApiService);
  private taskListStore = inject(TaskListStore);
  private taskCalendarStore = inject(TaskCalendarStore);
  private refreshState = inject(TaskRefreshState);
  private labelService = inject(LabelService);
  private projectService = inject(ProjectService);
  private logService = inject(LogService);

  private creatingState = signal(false);

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

  // Delegated calendar & undated signals
  readonly undatedTasks = this.taskCalendarStore.undatedTasks;
  readonly undatedLoading = this.taskCalendarStore.undatedLoading;
  readonly undatedLoaded = this.taskCalendarStore.undatedLoaded;
  readonly undatedTruncated = this.taskCalendarStore.undatedTruncated;
  readonly calendarRangeLoading = this.taskCalendarStore.calendarRangeLoading;
  readonly calendarRangeLoaded = this.taskCalendarStore.calendarRangeLoaded;
  readonly calendarRangeReady = this.taskCalendarStore.calendarRangeReady;
  readonly calendarRangeTruncated = this.taskCalendarStore.calendarRangeTruncated;
  readonly calendarRangeTasks = this.taskCalendarStore.calendarRangeTasks;

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

  // Delegated calendar & undated methods
  fetchUndatedTasks$() {
    return this.taskCalendarStore.fetchUndatedTasks$();
  }

  fetchTasksDueBetween$(dueFrom: string, dueTo: string) {
    return this.taskCalendarStore.fetchTasksDueBetween$(dueFrom, dueTo);
  }

  loadUndatedTasks(): void {
    this.taskCalendarStore.loadUndatedTasks();
  }

  setCalendarRange(range: CalendarRangeRequest): void {
    this.taskCalendarStore.setCalendarRange(range);
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

  async createTask(payload: CreateTaskDto, options: MutationOptions = {}) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      const tz = getUserTimezone();
      const createdTask = await firstValueFrom(
        this.taskApiService.createTask$(payload, tz, options),
      );
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

  /**
   * Background purge; a failure is logged only and reported as false so the
   * caller can retry. It must not raise a toast or inline error state.
   */
  async cleanupRetention(): Promise<boolean> {
    try {
      await firstValueFrom(this.taskApiService.cleanupRetention$());
      return true;
    } catch (error) {
      this.logService.error('Failed to clean up old tasks', error, 'TaskService');
      return false;
    }
  }

  async updateTask(taskId: string, payload: UpdateTaskDto, options: MutationOptions = {}) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      const tz = getUserTimezone();
      const updatedTask = await firstValueFrom(
        this.taskApiService.updateTask$(taskId, payload, tz, options),
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

  async deleteTask(taskId: string, options: MutationOptions = {}) {
    this.creatingState.set(true);
    this.taskListStore.setError(null);

    try {
      await firstValueFrom(this.taskApiService.deleteTask$(taskId, options));
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
}
