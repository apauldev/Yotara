import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateTime } from 'luxon';
import { CalendarWeekStripComponent } from './calendar-week-strip.component';
import type { CalendarWeekDay } from '../../utils/calendar-view';

function day(overrides: Partial<CalendarWeekDay> & { key: string }): CalendarWeekDay {
  return {
    date: DateTime.fromISO(overrides.key),
    isToday: false,
    isSelected: false,
    taskCount: 0,
    ...overrides,
  };
}

describe('CalendarWeekStripComponent', () => {
  let fixture: ComponentFixture<CalendarWeekStripComponent>;
  let component: CalendarWeekStripComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarWeekStripComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarWeekStripComponent);
    component = fixture.componentInstance;
  });

  it('renders a button per day with its weekday label and number', () => {
    component.days = [day({ key: '2026-10-11' }), day({ key: '2026-10-12' })];
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.cal-week-day');
    expect(buttons).toHaveSize(2);
    expect(buttons[0].querySelector('.cal-week-weekday')?.textContent?.trim()).toBe('Sun');
    expect(buttons[0].querySelector('.cal-week-number')?.textContent?.trim()).toBe('11');
  });

  it('shows a count badge only for days with tasks', () => {
    component.days = [day({ key: '2026-10-11' }), day({ key: '2026-10-12', taskCount: 3 })];
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.cal-week-day');
    expect(buttons[0].querySelector('.cal-week-count')).toBeNull();
    expect(buttons[1].querySelector('.cal-week-count')?.textContent?.trim()).toBe('3');
  });

  it('marks the selected and today buttons and labels them for screen readers', () => {
    component.days = [
      day({ key: '2026-10-12', isToday: true, taskCount: 1 }),
      day({ key: '2026-10-13', isSelected: true }),
    ];
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.cal-week-day');
    expect(buttons[0].classList.contains('cal-week-day-today')).toBe(true);
    expect(buttons[1].classList.contains('cal-week-day-selected')).toBe(true);

    const label = buttons[0].getAttribute('aria-label');
    expect(label).toContain('Monday, October 12, 2026');
    expect(label).toContain('1 task');
    expect(label).toContain('today');
  });

  it('emits the selected date on click', () => {
    component.days = [day({ key: '2026-10-12' })];
    fixture.detectChanges();

    let selected: DateTime | undefined;
    component.selectDate.subscribe((value) => (selected = value));

    (fixture.nativeElement.querySelector('.cal-week-day') as HTMLButtonElement).click();

    expect(selected?.toISODate()).toBe('2026-10-12');
  });
});
