import type { TaskStatus } from '@yotara/shared';
import { DateTime } from 'luxon';
import { formatTimeLabel, parseCalendarDate, startOfToday } from '../../../shared/utils/timestamps';

export type TaskViewDestination = 'inbox' | 'today' | 'upcoming' | 'overdue';

const DESTINATION_LABELS: Record<TaskViewDestination, string> = {
  inbox: 'Inbox',
  today: 'Today',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
};

const MAX_TITLE_LENGTH = 40;

export interface ProjectOption {
  id: string;
  name: string;
}

export interface TaskCreationNotice {
  /** The title as it was saved, so the user can identify which task this is. */
  title: string;
  dueDate?: string | null;
  dueTime?: string | null;
  status?: TaskStatus;
  /** The projects the user can choose from, used to resolve the destination. */
  projects?: ProjectOption[];
  projectId?: string | null;
  reference?: DateTime;
}

/**
 * Mirrors the task views used by the API so a save confirmation can tell the
 * user where a new task will appear.
 */
export function getTaskViewDestination(
  dueDate: string | null | undefined,
  status: TaskStatus = 'inbox',
  reference: DateTime = startOfToday(),
): TaskViewDestination {
  const dueDay = parseCalendarDate(dueDate)?.startOf('day');
  if (!dueDay) {
    if (status === 'today') return 'today';
    if (status === 'upcoming') return 'upcoming';
    return 'inbox';
  }

  const referenceDay = reference.startOf('day');
  if (dueDay.toMillis() < referenceDay.toMillis()) return 'overdue';
  if (dueDay.toMillis() > referenceDay.toMillis()) return 'upcoming';
  return 'today';
}

export function resolveProjectName(
  projects: ProjectOption[],
  projectId?: string | null,
): string | null {
  if (!projectId) return null;
  return projects.find((project) => project.id === projectId)?.name ?? null;
}

/**
 * Describes a created task: what was set, which view it landed in, which
 * project it went into, and the date it resolved to.
 */
export function taskCreationNotification(notice: TaskCreationNotice): string {
  const { title, dueDate, dueTime, status = 'inbox', projects = [], projectId, reference } = notice;

  const destination = getTaskViewDestination(dueDate, status, reference);
  const label = DESTINATION_LABELS[destination];
  const projectName = resolveProjectName(projects, projectId);
  const formattedDueDate = parseCalendarDate(dueDate)?.toFormat('EEE, LLL d, yyyy');
  const formattedDueTime = formatTimeLabel(dueTime);

  // An undated capture filed into a project lands in that project, not in
  // Inbox. Naming the project as the destination avoids the misleading
  // "added to Inbox (Project)" phrasing.
  if (projectName && !formattedDueDate) {
    return `"${truncateTitle(title)}" added to ${projectName}`;
  }

  // Dated tasks are announced by the view their date puts them in. Name the
  // project only when it adds information and does not repeat that view name.
  const showProject = !!projectName && projectName !== label;
  const projectSuffix = showProject ? ` (${projectName})` : '';
  const head = `"${truncateTitle(title)}" added to ${label}${projectSuffix}`;

  // The time is only ever shown when one was set; a date-only task stays
  // date-only in the confirmation.
  const due = formattedDueDate
    ? `${formattedDueDate}${formattedDueTime ? `, ${formattedDueTime}` : ''}`
    : '';

  return due ? `${head} · due ${due}` : head;
}

function truncateTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;

  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
