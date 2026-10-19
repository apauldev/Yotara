import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';

export interface CalendarCell {
  key: string;
  date: DateTime;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
}

export interface CalendarWeekDay {
  key: string;
  date: DateTime;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
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

/** The Sunday that starts the week containing `reference`. */
export function weekStart(reference: DateTime): DateTime {
  return reference.startOf('day').minus({ days: reference.weekday % 7 });
}

/** The seven days (Sunday-first) of the week containing `reference`. */
export function buildWeekDays(
  reference: DateTime,
  tasksByDay: Map<string, Task[]>,
  today: DateTime,
): CalendarWeekDay[] {
  const start = weekStart(reference);
  const todayKey = dayKey(today);
  const selectedKey = dayKey(reference);

  return Array.from({ length: 7 }, (_, offset) => {
    const date = start.plus({ days: offset });
    const key = dayKey(date);
    return {
      key,
      date,
      isToday: key === todayKey,
      isSelected: key === selectedKey,
      taskCount: tasksByDay.get(key)?.length ?? 0,
    };
  });
}

/**
 * Build a fixed six-week grid for the month of `reference`, starting weeks on
 * Sunday to match the rest of the product (`DatePickerComponent`). Always 42
 * cells, so moving between months never changes the calendar's height.
 */
export function buildMonthCells(
  reference: DateTime,
  tasksByDay: Map<string, Task[]>,
  today: DateTime,
): CalendarCell[] {
  const monthStart = reference.startOf('month');
  const leadingDays = monthStart.weekday % 7;
  const totalDays = 7 * 6;
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
