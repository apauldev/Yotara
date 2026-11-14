import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { CalendarEventDto, Task } from '@yotara/shared';
import { CalendarDayViewComponent } from './calendar-day-view.component';

const task: Task = {
  id: 'task-1',
  title: 'Send invoice',
  status: 'inbox',
  priority: 'medium',
  completed: false,
  order: 0,
  createdAt: '',
  updatedAt: '',
  dueDate: '2026-10-12',
  dueTime: '14:00',
  labels: [],
} as Task;

const event: CalendarEventDto = {
  id: 'event-1',
  sourceId: 'source-1',
  sourceName: 'Work',
  sourceColor: 'teal',
  summary: 'Standup',
  description: null,
  location: null,
  allDay: false,
  dayKeys: ['2026-10-12'],
  startTime: '09:00',
  endTime: '09:30',
  floating: false,
  timezone: 'UTC',
  status: 'CONFIRMED',
};

describe('CalendarDayViewComponent', () => {
  let fixture: ComponentFixture<CalendarDayViewComponent>;
  let component: CalendarDayViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarDayViewComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarDayViewComponent);
    component = fixture.componentInstance;
    component.dateLabel = 'Monday, October 12, 2026';
    component.dateKey = '2026-10-12';
    component.todayKey = '2026-10-12';
    component.tasks = [task];
    component.events = [event];
    fixture.detectChanges();
  });

  it('puts all-day events in their own band and timed entries in time order', () => {
    component.events = [
      event,
      { ...event, id: 'all-day', allDay: true, startTime: null, endTime: null },
    ];
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll(
        '#all-day-heading + .agenda-list app-calendar-event-chip',
      ),
    ).toHaveSize(1);
    const times = Array.from(
      fixture.nativeElement.querySelectorAll('.agenda-timeline .agenda-time'),
    ) as HTMLElement[];
    expect(times.map((time) => time.textContent?.trim())).toEqual(['09:00', '14:00']);
    expect(fixture.nativeElement.querySelector('.agenda-now')).toBeTruthy();
  });

  it('shows timed tasks as tasks and events without completion controls', () => {
    const eventChip = fixture.nativeElement.querySelector(
      '.agenda-timeline app-calendar-event-chip',
    );
    expect(eventChip).toBeTruthy();
    expect(eventChip.querySelector('.cal-chip-check')).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '.agenda-timeline app-calendar-task-chip .cal-chip-check',
      ),
    ).toBeTruthy();
  });

  it('emits event selection without opening a task editor', () => {
    let selected: CalendarEventDto | undefined;
    component.openEvent.subscribe((value) => (selected = value));
    (
      fixture.nativeElement.querySelector(
        '.agenda-timeline app-calendar-event-chip button',
      ) as HTMLButtonElement
    ).click();
    expect(selected?.id).toBe('event-1');
  });
});
