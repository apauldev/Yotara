import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
import { CalendarCell, CalendarRescheduleRequest } from '../../utils/calendar-view';
import { CalendarMonthGridComponent } from './calendar-month-grid.component';

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

describe('CalendarMonthGridComponent', () => {
  let fixture: ComponentFixture<CalendarMonthGridComponent>;
  let component: CalendarMonthGridComponent;
  const date = DateTime.fromISO('2026-10-12');

  function setCells(tasks: Task[]): void {
    component.cells = [{ key: '2026-10-12', date, inMonth: true, isToday: false, tasks }];
    fixture.detectChanges();
  }

  function cell(): HTMLElement {
    return fixture.nativeElement.querySelector('.cal-cell') as HTMLElement;
  }

  function makeCell(key: string, overrides: Partial<CalendarCell> = {}): CalendarCell {
    return {
      key,
      date: DateTime.fromISO(key),
      inMonth: true,
      isToday: false,
      tasks: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthGridComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarMonthGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects the day when an empty day is clicked', () => {
    setCells([]);
    let selected: DateTime | undefined;
    component.selectDate.subscribe((value) => (selected = value));

    cell().click();

    expect(selected?.toISODate()).toBe('2026-10-12');
  });

  it('selects the day when a populated day is clicked', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let selected: DateTime | undefined;
    component.selectDate.subscribe((value) => (selected = value));

    cell().click();

    expect(selected?.toISODate()).toBe('2026-10-12');
  });

  it('ignores clicks on a task chip (including its padding)', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let selected = false;
    component.selectDate.subscribe(() => (selected = true));

    (fixture.nativeElement.querySelector('.cal-chip') as HTMLElement).click();

    expect(selected).toBe(false);
  });

  it('renders a completed task as completed', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12', completed: true })]);

    expect(fixture.nativeElement.querySelector('.cal-chip-completed')).toBeTruthy();
  });

  it('selects the day from the day-number button', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let selected: DateTime | undefined;
    component.selectDate.subscribe((value) => (selected = value));

    (fixture.nativeElement.querySelector('.cal-cell-head') as HTMLButtonElement).click();

    expect(selected?.toISODate()).toBe('2026-10-12');
  });

  it('only allows dragging non-recurring, incomplete tasks when enabled', () => {
    const canDrag = (value: Task): boolean =>
      (component as unknown as { canDrag: (t: Task) => boolean }).canDrag(value);

    expect(canDrag(task({ id: 'a' }))).toBe(true);
    expect(canDrag(task({ id: 'b', recurrenceRule: { frequency: 'weekly', interval: 1 } }))).toBe(
      false,
    );
    expect(canDrag(task({ id: 'c', completed: true }))).toBe(false);

    component.allowDrag = false;
    expect(canDrag(task({ id: 'd' }))).toBe(false);
  });

  it('emits a reschedule when a task is dropped on another day', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let request: CalendarRescheduleRequest | undefined;
    component.rescheduleTask.subscribe((value) => (request = value));

    const event = {
      item: { data: component.cells[0].tasks[0] },
    } as unknown as CdkDragDrop<CalendarCell>;
    const target: CalendarCell = {
      key: '2026-10-20',
      date: DateTime.fromISO('2026-10-20'),
      inMonth: true,
      isToday: false,
      tasks: [],
    };
    (component as unknown as { onDrop: (e: unknown, c: CalendarCell) => void }).onDrop(
      event,
      target,
    );

    expect(request?.task.id).toBe('a');
    expect(request?.date).toBe('2026-10-20');
  });

  it('does nothing when a task is dropped on its own day', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let count = 0;
    component.rescheduleTask.subscribe(() => (count += 1));

    const event = {
      item: { data: component.cells[0].tasks[0] },
    } as unknown as CdkDragDrop<CalendarCell>;
    (component as unknown as { onDrop: (e: unknown, c: CalendarCell) => void }).onDrop(
      event,
      component.cells[0],
    );

    expect(count).toBe(0);
  });

  it('shows only a task count per day in compact mode', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' }), task({ id: 'b', dueDate: '2026-10-12' })]);
    component.compactCounts = true;
    fixture.detectChanges();

    const counts = fixture.nativeElement.querySelectorAll('.cal-cell-count');
    expect(counts).toHaveSize(1);
    expect(counts[0].textContent?.trim()).toBe('2');
    expect(fixture.nativeElement.querySelector('app-calendar-task-chip')).toBeNull();
    expect(fixture.nativeElement.querySelector('.cal-more')).toBeNull();
  });

  it('labels a day with its full date and task count', () => {
    component.cells = [
      makeCell('2026-10-01'),
      makeCell('2026-10-02', { isToday: true, tasks: [task({ id: 'a' })] }),
    ];
    fixture.detectChanges();

    const label = fixture.nativeElement
      .querySelector('[data-cal-day="2026-10-02"]')
      ?.getAttribute('aria-label');

    expect(label).toContain('Friday, October 2, 2026');
    expect(label).toContain('1 task');
    expect(label).toContain('today');
  });

  it('keeps one tab stop and moves focus with the arrow keys', () => {
    component.cells = [makeCell('2026-10-01'), makeCell('2026-10-02')];
    component.selectedKey = '2026-10-01';
    fixture.detectChanges();

    const heads = Array.from(
      fixture.nativeElement.querySelectorAll('.cal-cell-head') as NodeListOf<HTMLButtonElement>,
    );
    expect(heads.filter((button) => button.getAttribute('tabindex') === '0')).toHaveSize(1);

    const first = fixture.nativeElement.querySelector(
      '[data-cal-day="2026-10-01"]',
    ) as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[data-cal-day="2026-10-02"]'),
    );
  });

  it('moves focus by day, week, and week edges from the keyboard', () => {
    component.cells = Array.from({ length: 42 }, (_, index) =>
      makeCell(DateTime.fromISO('2026-09-27').plus({ days: index }).toISODate() ?? ''),
    );
    component.selectedKey = '2026-10-08';
    fixture.detectChanges();

    // 2026-10-08 is a Thursday, so Home/End land on that week's Sunday/Saturday.
    const press = (key: string) => {
      const head = fixture.nativeElement.querySelector(
        '[data-cal-day="2026-10-08"]',
      ) as HTMLButtonElement;
      head.focus();
      head.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();

      return (document.activeElement as HTMLElement | null)?.getAttribute('data-cal-day');
    };

    expect(press('ArrowLeft')).toBe('2026-10-07');
    expect(press('ArrowDown')).toBe('2026-10-15');
    expect(press('ArrowUp')).toBe('2026-10-01');
    expect(press('Home')).toBe('2026-10-04');
    expect(press('End')).toBe('2026-10-10');
    // Keys the grid does not handle leave focus where it is.
    expect(press('x')).toBe('2026-10-08');
  });

  it('has no tab stop when the grid is empty', () => {
    component.cells = [];
    fixture.detectChanges();

    expect((component as unknown as { tabbableKey: () => string }).tabbableKey()).toBe('');
  });

  it('falls back to the first cell when no day belongs to the viewed month', () => {
    component.cells = [makeCell('2026-09-27', { inMonth: false })];
    fixture.detectChanges();

    expect((component as unknown as { tabbableKey: () => string }).tabbableKey()).toBe(
      '2026-09-27',
    );
  });

  it('ignores a drop without a task and the clicks a drop leaves behind', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let rescheduled = 0;
    let opened = 0;
    let completed = 0;
    component.rescheduleTask.subscribe(() => (rescheduled += 1));
    component.openTask.subscribe(() => (opened += 1));
    component.completeTask.subscribe(() => (completed += 1));

    const internals = component as unknown as {
      onDrop: (event: unknown, cell: CalendarCell) => void;
      onSelect: (task: Task) => void;
      onComplete: (task: Task) => void;
      onCellClick: (cell: CalendarCell, event: MouseEvent) => void;
    };

    internals.onDrop({ item: {} } as CdkDragDrop<CalendarCell>, component.cells[0]);
    expect(rescheduled).toBe(0);

    internals.onDrop(
      {
        item: { data: task({ id: 'a', dueDate: '2026-10-11' }) },
      } as unknown as CdkDragDrop<CalendarCell>,
      component.cells[0],
    );
    expect(rescheduled).toBe(1);

    // CDK leaves the dropped element behind, so the trailing click is ignored.
    internals.onSelect(task({ id: 'a' }));
    internals.onComplete(task({ id: 'a' }));
    internals.onCellClick(component.cells[0], new MouseEvent('click'));

    expect(opened).toBe(0);
    expect(completed).toBe(0);
  });

  it('opens the task when its chip is selected', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let opened: Task | undefined;
    component.openTask.subscribe((value) => (opened = value));

    (fixture.nativeElement.querySelector('.cal-chip-body') as HTMLButtonElement).click();

    expect(opened?.id).toBe('a');
  });

  it('creates a task from the cell add button', () => {
    setCells([]);
    let created: DateTime | undefined;
    component.createTask.subscribe((value) => (created = value));

    (fixture.nativeElement.querySelector('.cal-cell-add') as HTMLButtonElement).click();

    expect(created?.toISODate()).toBe('2026-10-12');
  });

  it('releases focus after the add button is clicked', () => {
    setCells([]);
    const add = fixture.nativeElement.querySelector('.cal-cell-add') as HTMLButtonElement;
    add.focus();
    expect(document.activeElement).toBe(add);

    add.click();

    expect(document.activeElement).not.toBe(add);
  });

  it('creates a task on double-clicking an empty cell', () => {
    setCells([]);
    let created: DateTime | undefined;
    component.createTask.subscribe((value) => (created = value));

    cell().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(created?.toISODate()).toBe('2026-10-12');
  });

  it('does not create from a double-click on a task chip', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let count = 0;
    component.createTask.subscribe(() => (count += 1));

    (fixture.nativeElement.querySelector('.cal-chip') as HTMLElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );

    expect(count).toBe(0);
  });

  it('disables quick create when asked', () => {
    component.allowQuickCreate = false;
    setCells([]);
    let count = 0;
    component.createTask.subscribe(() => (count += 1));

    expect(fixture.nativeElement.querySelector('.cal-cell-add')).toBeFalsy();

    cell().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(count).toBe(0);
  });
});
