import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
import { CalendarCell } from '../../utils/calendar-view';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarMonthGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarMonthGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts the create flow when an empty day is clicked', () => {
    setCells([]);
    let created: DateTime | undefined;
    component.createTask.subscribe((value) => (created = value));

    cell().click();

    expect(created?.toISODate()).toBe('2026-10-12');
  });

  it('selects the day when a populated day is clicked', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let selected: DateTime | undefined;
    let created = false;
    component.selectDate.subscribe((value) => (selected = value));
    component.createTask.subscribe(() => (created = true));

    cell().click();

    expect(selected?.toISODate()).toBe('2026-10-12');
    expect(created).toBe(false);
  });

  it('ignores clicks on a task chip (including its padding)', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let created = false;
    let selected = false;
    component.createTask.subscribe(() => (created = true));
    component.selectDate.subscribe(() => (selected = true));

    (fixture.nativeElement.querySelector('.cal-chip') as HTMLElement).click();

    expect(created).toBe(false);
    expect(selected).toBe(false);
  });

  it('selects the day from the day-number button', () => {
    setCells([task({ id: 'a', dueDate: '2026-10-12' })]);
    let selected: DateTime | undefined;
    let created = false;
    component.selectDate.subscribe((value) => (selected = value));
    component.createTask.subscribe(() => (created = true));

    (fixture.nativeElement.querySelector('.cal-cell-head') as HTMLButtonElement).click();

    expect(selected?.toISODate()).toBe('2026-10-12');
    expect(created).toBe(false);
  });
});
