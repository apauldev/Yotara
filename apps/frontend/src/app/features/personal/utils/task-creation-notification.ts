import type { TaskStatus } from '@yotara/shared';
import { DateTime } from 'luxon';
import { parseCalendarDate, startOfToday } from '../../../shared/utils/timestamps';

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
  status?: TaskStatus;
  /** The projects the user can choose from, used to name the bucket. */
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
 * bucket it went into, and the date it resolved to.
 */
export function taskCreationNotification(notice: TaskCreationNotice): string {
  const { title, dueDate, status = 'inbox', projects = [], projectId, reference } = notice;

  const destination = getTaskViewDestination(dueDate, status, reference);
  const label = DESTINATION_LABELS[destination];
  const projectName = resolveProjectName(projects, projectId);
  const formattedDueDate = parseCalendarDate(dueDate)?.toFormat('EEE, LLL d, yyyy');

  // The default capture project is itself named "Inbox", so a bucket that
  // repeats the destination label would read as a stutter.
  const bucket = projectName && projectName !== label ? ` (${projectName})` : '';
  const head = `"${truncateTitle(title)}" added to ${label}${bucket}`;

  return formattedDueDate ? `${head} · due ${formattedDueDate}` : head;
}

function truncateTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;

  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
