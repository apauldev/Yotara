import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Task } from '@yotara/shared';
import { CalendarTaskChipComponent } from './calendar-task-chip.component';

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

describe('CalendarTaskChipComponent', () => {
  let fixture: ComponentFixture<CalendarTaskChipComponent>;
  let component: CalendarTaskChipComponent;

  function el<T extends HTMLElement>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector) as T | null;
    if (!found) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarTaskChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarTaskChipComponent);
    component = fixture.componentInstance;
    component.task = task({ id: 'a', title: 'Ship the calendar' });
    fixture.detectChanges();
  });

  it('emits select from the body and not complete', () => {
    const select = jasmine.createSpy('select');
    const complete = jasmine.createSpy('complete');
    component.select.subscribe(select);
    component.complete.subscribe(complete);

    el<HTMLButtonElement>('.cal-chip-body').click();

    expect(select).toHaveBeenCalledWith(component.task);
    expect(complete).not.toHaveBeenCalled();
  });

  it('emits complete from the check and not select', () => {
    const select = jasmine.createSpy('select');
    const complete = jasmine.createSpy('complete');
    component.select.subscribe(select);
    component.complete.subscribe(complete);

    el<HTMLButtonElement>('.cal-chip-check').click();

    expect(complete).toHaveBeenCalledWith(component.task);
    expect(select).not.toHaveBeenCalled();
  });

  it('renders the time label and recurrence icon', () => {
    component.task = task({
      id: 'b',
      title: 'Standup',
      dueTime: '09:00',
      recurrenceRule: { frequency: 'weekly', interval: 1 },
    });
    fixture.detectChanges();

    expect(el('.cal-chip-time').textContent?.trim()).toBe('9:00 AM');
    expect(el('.cal-chip-recur')).toBeTruthy();
  });

  it('shows a completed chip whose check stays usable for undo', () => {
    component.completed = true;
    fixture.detectChanges();

    expect(el('.cal-chip').classList.contains('cal-chip-completed')).toBe(true);
    expect(el<HTMLButtonElement>('.cal-chip-check').disabled).toBe(false);
  });

  it('colors the bar by priority and shows the label count when metadata is enabled', () => {
    component.task = task({ id: 'b', title: 'Ship it', priority: 'high', labels: ['l1'] });
    component.showMeta = true;
    component.labelCount = 1;
    fixture.detectChanges();

    expect(el('.cal-chip-bar-high')).toBeTruthy();
    expect(el('.cal-chip-labels')).toBeTruthy();
  });

  it('colors the priority bar even without metadata', () => {
    expect(el('.cal-chip-bar-medium')).toBeTruthy();
  });

  it('marks the chip with its priority and touch-target classes', () => {
    expect(el('.cal-chip').classList.contains('cal-chip-priority-medium')).toBe(true);

    component.touchTargets = true;
    fixture.detectChanges();

    expect(el('.cal-chip').classList.contains('cal-chip-touch')).toBe(true);
  });

  it('can hide the inline time while still announcing it', () => {
    component.task = task({ id: 'b', title: 'Standup', dueTime: '09:00' });
    component.showTime = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cal-chip-time')).toBeFalsy();
    expect(el<HTMLButtonElement>('.cal-chip-body').getAttribute('aria-label')).toContain('9:00 AM');
  });

  it('hides the completion control when showCheck is false', () => {
    component.showCheck = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cal-chip-check')).toBeFalsy();
  });

  it('applies the overdue ring', () => {
    component.overdue = true;
    fixture.detectChanges();

    expect(el('.cal-chip').classList.contains('cal-chip-overdue')).toBe(true);
  });
});
