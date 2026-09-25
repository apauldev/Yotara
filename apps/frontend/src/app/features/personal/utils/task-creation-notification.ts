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

export function taskCreationNotification(
  dueDate: string | null | undefined,
  status: TaskStatus = 'inbox',
  reference: DateTime = startOfToday(),
): string {
  const destination = getTaskViewDestination(dueDate, status, reference);
  const label = DESTINATION_LABELS[destination];
  const formattedDueDate = parseCalendarDate(dueDate)?.toFormat('EEE, LLL d, yyyy');

  return formattedDueDate
    ? `Task added to ${label} · due ${formattedDueDate}.`
    : `Task added to ${label}.`;
}
