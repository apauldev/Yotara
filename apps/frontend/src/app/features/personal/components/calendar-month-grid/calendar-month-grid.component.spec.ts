import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
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
});
