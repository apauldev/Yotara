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
  /**
   * The project the UI offered by default. When the task lands there, the
   * bucket is omitted: naming the default adds noise, and a default project
   * named "Inbox" reads as the destination view rather than the bucket.
   */
  defaultProjectId?: string | null;
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
  const {
    title,
    dueDate,
    status = 'inbox',
    projects = [],
    projectId,
    defaultProjectId,
    reference,
  } = notice;

  const destination = getTaskViewDestination(dueDate, status, reference);
  const label = DESTINATION_LABELS[destination];
  const projectName = resolveProjectName(projects, projectId);
  const formattedDueDate = parseCalendarDate(dueDate)?.toFormat('EEE, LLL d, yyyy');

  // Name the bucket only when it tells the user something: an explicitly
  // chosen (or contextual) project. The default project is omitted, since a
  // default named "Inbox" would read as the destination view — e.g. a dated
  // task "added to Upcoming (Inbox)" looks like it went to Inbox. A bucket
  // that repeats the destination label is likewise dropped as a stutter.
  const showBucket = !!projectName && projectId !== defaultProjectId && projectName !== label;
  const bucket = showBucket ? ` (${projectName})` : '';
  const head = `"${truncateTitle(title)}" added to ${label}${bucket}`;

  return formattedDueDate ? `${head} · due ${formattedDueDate}` : head;
}

function truncateTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;

  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
