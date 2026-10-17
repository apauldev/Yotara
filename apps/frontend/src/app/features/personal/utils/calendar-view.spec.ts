import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
import {
  buildMonthCells,
  buildTasksByDay,
  buildUndatedTasks,
  dayKey,
  isCalendarTask,
} from './calendar-view';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    order: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as Task;
}

describe('calendar-view', () => {
  describe('isCalendarTask', () => {
    it('excludes subtasks and includes top-level tasks', () => {
      expect(isCalendarTask(task())).toBe(true);
      expect(isCalendarTask(task({ parentId: 'parent' }))).toBe(false);
    });
  });

  describe('buildTasksByDay', () => {
    it('groups tasks by due date and ignores undated tasks', () => {
      const map = buildTasksByDay([
        task({ id: 'a', dueDate: '2026-10-12' }),
        task({ id: 'b', dueDate: '2026-10-12T09:00:00.000Z' }),
        task({ id: 'c', dueDate: '2026-10-13' }),
        task({ id: 'd' }),
      ]);

      expect(map.get('2026-10-12')?.map((t) => t.id)).toEqual(['a', 'b']);
      expect(map.get('2026-10-13')?.map((t) => t.id)).toEqual(['c']);
      expect(map.has('d')).toBe(false);
      expect(map.size).toBe(2);
    });

    it('excludes subtasks', () => {
      const map = buildTasksByDay([task({ id: 'a', dueDate: '2026-10-12', parentId: 'p' })]);

      expect(map.size).toBe(0);
    });

    it('orders a day by time, then priority, then title', () => {
      const map = buildTasksByDay([
        task({ id: 'untimed-high', dueDate: '2026-10-12', priority: 'high' }),
        task({ id: 'late', dueDate: '2026-10-12', dueTime: '15:00' }),
        task({ id: 'morning', dueDate: '2026-10-12', dueTime: '09:00' }),
      ]);

      expect(map.get('2026-10-12')?.map((t) => t.id)).toEqual(['morning', 'late', 'untimed-high']);
    });
  });

  describe('buildUndatedTasks', () => {
    it('returns only top-level tasks without a due date', () => {
      const undated = buildUndatedTasks([
        task({ id: 'a' }),
        task({ id: 'b', dueDate: '2026-10-12' }),
        task({ id: 'c', parentId: 'p' }),
      ]);

      expect(undated.map((t) => t.id)).toEqual(['a']);
    });
  });

  describe('buildMonthCells', () => {
    const today = DateTime.fromISO('2026-10-17');

    it('builds a 4-row month whose first day is Sunday', () => {
      const cells = buildMonthCells(DateTime.fromISO('2026-02-01'), new Map(), today);

      expect(cells).toHaveSize(28);
      expect(cells[0].key).toBe('2026-02-01');
      expect(cells.every((cell) => cell.inMonth)).toBe(true);
    });

    it('builds a 5-row month with leading days from the previous month', () => {
      const cells = buildMonthCells(DateTime.fromISO('2026-10-01'), new Map(), today);

      expect(cells).toHaveSize(35);
      expect(cells[0].key).toBe('2026-09-27');
      expect(cells[0].inMonth).toBe(false);
      expect(cells[cells.length - 1].key).toBe('2026-10-31');
    });

    it('builds a 6-row month with trailing days into the next month', () => {
      const cells = buildMonthCells(DateTime.fromISO('2026-08-01'), new Map(), today);

      expect(cells).toHaveSize(42);
      expect(cells[0].key).toBe('2026-07-26');
      expect(cells[cells.length - 1].key).toBe('2026-09-05');
    });

    it('marks today and attaches the day of tasks', () => {
      const tasksByDay = buildTasksByDay([task({ id: 'a', dueDate: '2026-10-17' })]);
      const cells = buildMonthCells(DateTime.fromISO('2026-10-01'), tasksByDay, today);
      const todayCell = cells.find((cell) => cell.key === '2026-10-17');

      expect(todayCell?.isToday).toBe(true);
      expect(todayCell?.tasks.map((t) => t.id)).toEqual(['a']);
    });
  });

  describe('dayKey', () => {
    it('formats as an ISO calendar date', () => {
      expect(dayKey(DateTime.fromISO('2026-10-17T15:00:00'))).toBe('2026-10-17');
    });
  });
});
