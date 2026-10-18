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

  it('opens the day instead of the task on touch layouts', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    component.selectDayOnTaskTap = true;
    fixture.detectChanges();

    let selected: DateTime | undefined;
    let opened = false;
    component.selectDate.subscribe((value) => (selected = value));
    component.openTask.subscribe(() => (opened = true));

    (fixture.nativeElement.querySelector('.cal-chip-body') as HTMLButtonElement).click();

    expect(selected?.toISODate()).toBe('2026-10-12');
    expect(opened).toBe(false);
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
});
