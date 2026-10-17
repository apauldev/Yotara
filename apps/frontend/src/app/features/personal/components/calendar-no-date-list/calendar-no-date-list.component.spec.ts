import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Task } from '@yotara/shared';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { CalendarNoDateListComponent } from './calendar-no-date-list.component';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Task;
}

describe('CalendarNoDateListComponent', () => {
  let fixture: ComponentFixture<CalendarNoDateListComponent>;
  let component: CalendarNoDateListComponent;

  function el<T extends HTMLElement>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector) as T | null;
    if (!found) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  function datePicker(): DatePickerComponent {
    return fixture.debugElement.query(By.directive(DatePickerComponent))
      .componentInstance as DatePickerComponent;
  }

  function setTasks(tasks: Task[]): void {
    component.tasks = tasks;
    component.todayKey = '2026-10-29';
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarNoDateListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarNoDateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the empty state', () => {
    setTasks([]);

    expect(el('.cal-panel-empty').textContent).toContain('Everything has a date.');
  });

  it('emits scheduleTask for Today and Tomorrow', () => {
    setTasks([task({ id: 'u1', title: 'Water plants' })]);
    const schedule = jasmine.createSpy('schedule');
    component.scheduleTask.subscribe(schedule);

    const quickButtons = fixture.nativeElement.querySelectorAll(
      '.cal-quick-btn',
    ) as NodeListOf<HTMLButtonElement>;
    quickButtons[0].click();
    quickButtons[1].click();

    expect(schedule).toHaveBeenCalledWith({ task: component.tasks[0], date: '2026-10-29' });
    expect(schedule).toHaveBeenCalledWith({ task: component.tasks[0], date: '2026-10-30' });
  });

  it('emits scheduleTask from the date picker and ignores an empty pick', () => {
    setTasks([task({ id: 'u1', title: 'Water plants' })]);
    const schedule = jasmine.createSpy('schedule');
    component.scheduleTask.subscribe(schedule);

    datePicker().valueChange.emit('2026-12-01');
    datePicker().valueChange.emit('');

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith({ task: component.tasks[0], date: '2026-12-01' });
  });

  it('emits openTask and completeTask from the chip', () => {
    setTasks([task({ id: 'u1', title: 'Water plants' })]);
    const open = jasmine.createSpy('open');
    const complete = jasmine.createSpy('complete');
    component.openTask.subscribe(open);
    component.completeTask.subscribe(complete);

    el<HTMLButtonElement>('.cal-chip-body').click();
    el<HTMLButtonElement>('.cal-chip-check').click();

    expect(open).toHaveBeenCalledWith(component.tasks[0]);
    expect(complete).toHaveBeenCalledWith(component.tasks[0]);
  });
});
