import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
import {
  buildMonthCells,
  buildTasksByDay,
  buildUndatedTasks,
  buildWeekDays,
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

    it('orders two untimed tasks by priority', () => {
      const map = buildTasksByDay([
        task({ id: 'low', dueDate: '2026-10-12', priority: 'low' }),
        task({ id: 'high', dueDate: '2026-10-12', priority: 'high' }),
      ]);

      expect(map.get('2026-10-12')?.map((t) => t.id)).toEqual(['high', 'low']);
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

  describe('buildWeekDays', () => {
    const today = DateTime.fromISO('2026-10-17');

    it('returns the Sunday-first week containing the reference', () => {
      const days = buildWeekDays(DateTime.fromISO('2026-10-14'), new Map(), today);

      expect(days).toHaveSize(7);
      expect(days[0].key).toBe('2026-10-11');
      expect(days[6].key).toBe('2026-10-17');
    });

    it('flags the selected day, today, and each day task count', () => {
      const tasksByDay = buildTasksByDay([
        task({ id: 'a', dueDate: '2026-10-14' }),
        task({ id: 'b', dueDate: '2026-10-14' }),
        task({ id: 'c', dueDate: '2026-10-17' }),
      ]);
      const days = buildWeekDays(DateTime.fromISO('2026-10-14'), tasksByDay, today);

      const selected = days.find((day) => day.key === '2026-10-14');
      const todayDay = days.find((day) => day.key === '2026-10-17');

      expect(selected?.isSelected).toBe(true);
      expect(selected?.taskCount).toBe(2);
      expect(todayDay?.isToday).toBe(true);
      expect(todayDay?.taskCount).toBe(1);
    });
  });

  describe('buildMonthCells', () => {
    const today = DateTime.fromISO('2026-10-17');

    it('pads a 4-row month to a fixed six rows', () => {
      const cells = buildMonthCells(DateTime.fromISO('2026-02-01'), new Map(), today);

      expect(cells).toHaveSize(42);
      expect(cells[0].key).toBe('2026-02-01');
      expect(cells[27].inMonth).toBe(true);
      expect(cells[28].inMonth).toBe(false);
      expect(cells[cells.length - 1].key).toBe('2026-03-14');
    });

    it('keeps six rows for a 5-row month with leading days', () => {
      const cells = buildMonthCells(DateTime.fromISO('2026-10-01'), new Map(), today);

      expect(cells).toHaveSize(42);
      expect(cells[0].key).toBe('2026-09-27');
      expect(cells[0].inMonth).toBe(false);
      expect(cells[cells.length - 1].key).toBe('2026-11-07');
    });

    it('keeps six rows for a naturally 6-row month', () => {
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
