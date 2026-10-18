import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';

export interface CalendarCell {
  key: string;
  date: DateTime;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
}

export interface CalendarRescheduleRequest {
  task: Task;
  date: string;
}

const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function dayKey(date: DateTime): string {
  return date.toISODate() ?? '';
}

export function taskDayKey(task: Task): string | null {
  return task.dueDate ? task.dueDate.slice(0, 10) : null;
}

/** Subtasks belong to their parent, so the calendar shows top-level tasks only. */
export function isCalendarTask(task: Task): boolean {
  return !task.parentId;
}

function sortDayTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aTime = a.dueTime ?? '';
    const bTime = b.dueTime ?? '';
    if (aTime !== bTime) {
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime < bTime ? -1 : 1;
    }
    if (a.priority !== b.priority) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return a.title.localeCompare(b.title);
  });
}

export function buildTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!isCalendarTask(task)) continue;
    const key = taskDayKey(task);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }
  for (const [key, list] of map) {
    map.set(key, sortDayTasks(list));
  }
  return map;
}

export function buildUndatedTasks(tasks: Task[]): Task[] {
  return sortDayTasks(tasks.filter((task) => isCalendarTask(task) && !task.dueDate));
}

/**
 * Build the six-week-max grid for the month of `reference`, starting weeks on
 * Sunday to match the rest of the product (`DatePickerComponent`).
 */
export function buildMonthCells(
  reference: DateTime,
  tasksByDay: Map<string, Task[]>,
  today: DateTime,
): CalendarCell[] {
  const monthStart = reference.startOf('month');
  const leadingDays = monthStart.weekday % 7;
  const daysInMonth = monthStart.plus({ months: 1 }).startOf('month').minus({ days: 1 }).day;
  const totalDays = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const gridStart = monthStart.minus({ days: leadingDays });
  const todayKey = dayKey(today);

  const cells: CalendarCell[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = gridStart.plus({ days: offset });
    const key = dayKey(date);
    cells.push({
      key,
      date,
      inMonth: date.month === monthStart.month && date.year === monthStart.year,
      isToday: key === todayKey,
      tasks: tasksByDay.get(key) ?? [],
    });
  }
  return cells;
}
