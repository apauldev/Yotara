import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Task } from '@yotara/shared';
import type { DateTime } from 'luxon';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { notifyTaskCompleted } from './task-completion-notice';
import {
  ProjectOption,
  TASK_VIEW_LABELS,
  TaskViewDestination,
  getTaskViewDestination,
  resolveProjectName,
  truncateTaskTitle,
} from './task-creation-notification';

export interface TaskMovementRoute {
  commands: string[];
  queryParams?: Record<string, string>;
}

export interface TaskMovementNotice {
  message: string;
  route: TaskMovementRoute | null;
  /** Replaces an earlier toast for the same task instead of stacking. */
  key: string;
}

const MOVEMENT_TOAST_DURATION = 3000;

/**
 * The Inbox is a derived view: incomplete, undated, unfiled tasks. Movement
 * notices compare this shape before and after a save rather than trusting a
 * transition label from the caller.
 */
export function isInboxTask(
  task: Pick<Task, 'completed' | 'status' | 'dueDate' | 'projectId' | 'parentId'>,
): boolean {
  return (
    !task.completed &&
    task.status === 'inbox' &&
    !task.dueDate &&
    task.projectId == null &&
    !task.parentId
  );
}

export function taskCompletionMovementNotice(task: Task): TaskMovementNotice | null {
  if (!isInboxTask(task)) return null;

  return {
    message: `"${truncateTaskTitle(task.title)}" completed and moved to your Completed view`,
    route: { commands: ['/archive'] },
    key: taskMovementKey(task.id),
  };
}

/**
 * Describes how a saved task left Inbox, or returns null when it stayed put.
 * Completion wins over filing/scheduling because the task lands in Archive.
 */
export function taskMovementNotice(
  before: Task,
  after: Task,
  projects: ProjectOption[] = [],
  reference?: DateTime,
): TaskMovementNotice | null {
  if (!isInboxTask(before) || isInboxTask(after)) return null;

  const title = truncateTaskTitle(after.title || before.title);

  if (after.completed) {
    return {
      message: `"${title}" completed and moved to your Completed view`,
      route: { commands: ['/archive'] },
      key: taskMovementKey(after.id),
    };
  }

  const destination = getTaskViewDestination(after.dueDate, after.status, reference);
  const scheduled = destination !== 'inbox';
  const projectName = resolveProjectName(projects, after.projectId);
  const projectDestination = projectName ?? (after.projectId ? 'its project' : null);

  if (scheduled) {
    const label = TASK_VIEW_LABELS[destination];
    const projectSuffix =
      projectDestination && projectDestination !== label ? ` (${projectDestination})` : '';
    return {
      message: `"${title}" moved to ${label}${projectSuffix}`,
      route: viewRoute(destination),
      key: taskMovementKey(after.id),
    };
  }

  if (!after.projectId) return null;

  return {
    message: `"${title}" moved to ${projectDestination}`,
    route: { commands: ['/projects', after.projectId] },
    key: taskMovementKey(after.id),
  };
}

function taskMovementKey(taskId: string): string {
  return `task-movement:${taskId}`;
}

function viewRoute(destination: Exclude<TaskViewDestination, 'inbox'>): TaskMovementRoute {
  return {
    commands: ['/tasks'],
    // Overdue work stays visible from Today; there is no separate Overdue view.
    queryParams: { view: destination === 'upcoming' ? 'upcoming' : 'today' },
  };
}

/**
 * Centralizes destination copy and navigation for Inbox movement feedback so
 * cards and the task modal cannot drift apart.
 */
@Injectable({ providedIn: 'root' })
export class TaskMovementNoticeService {
  private readonly status = inject(StatusService);
  private readonly preferences = inject(PreferencesStore);
  private readonly projects = inject(ProjectService);
  private readonly router = inject(Router);

  /**
   * Announces a completed task. Inbox completions get the destination-aware
   * movement toast; every other surface keeps the existing generic notice.
   */
  notifyCompleted(task: Task, fromInbox: boolean): void {
    if (!this.preferences.actionNotifications()) return;

    const notice = fromInbox ? taskCompletionMovementNotice(task) : null;
    if (!notice) {
      notifyTaskCompleted(this.status, this.preferences);
      return;
    }

    this.show(notice);
  }

  /**
   * Announces filing/scheduling only when the caller explicitly identifies
   * itself as the visible Inbox. A save from Search, a project, or the
   * calendar therefore never raises a movement toast.
   */
  notifyMoved(before: Task, after: Task, fromInbox: boolean): void {
    if (!fromInbox || !this.preferences.actionNotifications()) return;

    const notice = taskMovementNotice(before, after, this.projects.projects());
    if (notice) {
      this.show(notice);
    }
  }

  private show(notice: TaskMovementNotice): void {
    const route = notice.route;
    this.status.success(notice.message, MOVEMENT_TOAST_DURATION, {
      key: notice.key,
      action: route
        ? {
            label: 'View',
            callback: () => {
              void this.router.navigate(
                route.commands,
                route.queryParams ? { queryParams: route.queryParams } : undefined,
              );
            },
          }
        : undefined,
    });
  }
}
