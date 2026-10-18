import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { Task } from '@yotara/shared';
import { CalendarDayPanelComponent } from './calendar-day-panel.component';

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

describe('CalendarDayPanelComponent', () => {
  let fixture: ComponentFixture<CalendarDayPanelComponent>;
  let component: CalendarDayPanelComponent;

  function el<T extends HTMLElement>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector) as T | null;
    if (!found) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  function setTasks(tasks: Task[]): void {
    component.dateLabel = 'Friday, Oct 17, 2026';
    component.tasks = tasks;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarDayPanelComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarDayPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('orders the timed section by time', () => {
    setTasks([
      task({ id: 'late', title: 'Late standup', dueTime: '17:00' }),
      task({ id: 'early', title: 'Early standup', dueTime: '09:00' }),
    ]);

    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('.cal-schedule-row') as NodeListOf<HTMLElement>,
    ).map((row) => row.textContent?.trim() ?? '');

    expect(rows[0]).toContain('Early standup');
    expect(rows[1]).toContain('Late standup');
  });

  it('shows the date, count and the empty state', () => {
    setTasks([]);

    expect(el('.cal-panel-title').textContent).toContain('Friday, Oct 17, 2026');
    expect(el('.cal-panel-count').textContent?.trim()).toBe('0 tasks');
    expect(el('.cal-panel-empty').textContent).toContain('Nothing due on this day.');
  });

  it('renders a chip per task with a singular count', () => {
    setTasks([task({ id: 'a', title: 'One' })]);

    expect(fixture.nativeElement.querySelectorAll('app-calendar-task-chip').length).toBe(1);
    expect(el('.cal-panel-count').textContent?.trim()).toBe('1 task');
  });

  it('emits openTask, completeTask and addTask', () => {
    setTasks([task({ id: 'a', title: 'One' })]);
    const open = jasmine.createSpy('open');
    const complete = jasmine.createSpy('complete');
    const add = jasmine.createSpy('add');
    component.openTask.subscribe(open);
    component.completeTask.subscribe(complete);
    component.addTask.subscribe(add);

    el<HTMLButtonElement>('.cal-chip-body').click();
    el<HTMLButtonElement>('.cal-chip-check').click();
    el<HTMLButtonElement>('.cal-panel-add').click();

    expect(open).toHaveBeenCalledWith(component.tasks[0]);
    expect(complete).toHaveBeenCalledWith(component.tasks[0]);
    expect(add).toHaveBeenCalled();
  });

  it('reads a chip as completed from the completion overrides', () => {
    setTasks([task({ id: 'a', title: 'One' })]);

    component.completionOverrides = new Map([['a', true]]);
    fixture.detectChanges();

    expect(el('.cal-chip').classList.contains('cal-chip-completed')).toBe(true);
  });

  it('renders full metadata (priority, project, labels) for each task', () => {
    component.projectNames = new Map([['p1', 'Work']]);
    component.labelNames = new Map([['l1', 'urgent']]);
    component.showMetadata = true;

    setTasks([
      task({ id: 'a', title: 'One', priority: 'high', projectId: 'p1', labels: ['l1'] }),
      task({ id: 'b', title: 'Plain' }),
      task({ id: 'c', title: 'Orphaned', projectId: 'gone', labels: ['missing'] }),
    ]);

    expect(fixture.nativeElement.textContent).toContain('High');
    expect(fixture.nativeElement.textContent).toContain('Work');
    expect(fixture.nativeElement.textContent).toContain('urgent');
  });

  it('shows untimed tasks first, then timed tasks in a time schedule', () => {
    setTasks([
      task({ id: 'timed', title: 'Timed task', dueTime: '09:00' }),
      task({ id: 'untimed', title: 'Untimed task' }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text.indexOf('Untimed task')).toBeLessThan(text.indexOf('Timed task'));

    expect(el('.cal-schedule')).toBeTruthy();
    expect(el('.cal-schedule-time').textContent).toContain('9:00 AM');
    // The timed chip does not repeat its time inline; the gutter owns it.
    expect(fixture.nativeElement.querySelector('.cal-schedule .cal-chip-time')).toBeFalsy();
  });

  it('announces changes to the selected day', () => {
    setTasks([]);

    const header = fixture.nativeElement.querySelector('.cal-panel-head') as HTMLElement;
    expect(header.getAttribute('aria-live')).toBe('polite');
  });
});
