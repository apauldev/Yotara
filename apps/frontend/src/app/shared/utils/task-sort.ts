import { Task } from '@yotara/shared';
import { parseCalendarDate } from './timestamps';

export type TaskSortOption = 'date' | 'alpha';

export function sortTasks<T>(
  items: T[],
  sortOption: TaskSortOption,
  getTask: (item: T) => Task = (i: unknown) => i as Task,
): T[] {
  return [...items].sort((a, b) => {
    const taskA = getTask(a);
    const taskB = getTask(b);

    if (sortOption === 'alpha') {
      return taskA.title.localeCompare(taskB.title);
    }

    const dateA =
      parseCalendarDate(taskA.dueDate)?.toMillis() ?? new Date(taskA.createdAt).getTime();
    const dateB =
      parseCalendarDate(taskB.dueDate)?.toMillis() ?? new Date(taskB.createdAt).getTime();
    return dateB - dateA;
  });
}

export function sortAndPaginate<T>(
  items: T[],
  sortOption: TaskSortOption,
  currentPage: number,
  pageSize: number,
  getTask: (item: T) => Task = (i: unknown) => i as Task,
): T[] {
  const sorted = sortTasks(items, sortOption, getTask);
  const start = (currentPage - 1) * pageSize;
  return sorted.slice(start, start + pageSize);
}
