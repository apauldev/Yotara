import { DateTime } from 'luxon';
import type { CalendarEventDto, Task } from '@yotara/shared';

export interface CalendarCell {
  key: string;
  date: DateTime;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  events: CalendarEventDto[];
}

export interface CalendarWeekDay {
  key: string;
  date: DateTime;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
  eventCount: number;
}

export interface CalendarRescheduleRequest {
  task: Task;
  date: string;
}

export interface VisibleCellChips {
  tasks: Task[];
  events: CalendarEventDto[];
  hiddenTasks: number;
  hiddenEvents: number;
}

export type CalendarAgendaEntry =
  | { kind: 'task'; task: Task; time: string }
  | { kind: 'event'; event: CalendarEventDto; time: string };

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

export function buildEventsByDay(events: CalendarEventDto[]): Map<string, CalendarEventDto[]> {
  const map = new Map<string, CalendarEventDto[]>();
  for (const event of events) {
    for (const key of event.dayKeys) {
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
  }
  for (const [key, list] of map) {
    map.set(
      key,
      [...list].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    );
  }
  return map;
}

/** Keep month cells compact while preserving at least one slot for each kind. */
export function planCellChips(
  tasks: Task[],
  events: CalendarEventDto[],
  maxRows = 3,
): VisibleCellChips {
  const eventSlots = tasks.length ? Math.min(events.length, Math.max(0, maxRows - 1)) : maxRows;
  const taskSlots = Math.min(tasks.length, maxRows - eventSlots);
  const visibleEvents = Math.min(events.length, maxRows - taskSlots);
  return {
    tasks: tasks.slice(0, taskSlots),
    events: events.slice(0, visibleEvents),
    hiddenTasks: Math.max(0, tasks.length - taskSlots),
    hiddenEvents: Math.max(0, events.length - visibleEvents),
  };
}

export function buildDayAgenda(tasks: Task[], events: CalendarEventDto[]): CalendarAgendaEntry[] {
  return [
    ...tasks
      .filter((task) => !!task.dueTime)
      .map((task): CalendarAgendaEntry => ({ kind: 'task', task, time: task.dueTime! })),
    ...events
      .filter((event) => !event.allDay && !!event.startTime)
      .map((event): CalendarAgendaEntry => ({ kind: 'event', event, time: event.startTime! })),
  ].sort((a, b) => a.time.localeCompare(b.time));
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
  eventsByDay: Map<string, CalendarEventDto[]> = new Map(),
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
      eventCount: eventsByDay.get(key)?.length ?? 0,
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
  eventsByDay: Map<string, CalendarEventDto[]> = new Map(),
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
      events: eventsByDay.get(key) ?? [],
    });
  }
  return cells;
}
