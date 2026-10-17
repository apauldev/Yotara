import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarHeaderComponent } from './calendar-header.component';

describe('CalendarHeaderComponent', () => {
  let fixture: ComponentFixture<CalendarHeaderComponent>;
  let component: CalendarHeaderComponent;

  function el<T extends HTMLElement>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector) as T | null;
    if (!found) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarHeaderComponent);
    component = fixture.componentInstance;
    component.monthLabel = 'October 2026';
    fixture.detectChanges();
  });

  it('shows the month label and no badge at zero', () => {
    expect(el('.cal-month').textContent).toContain('October 2026');
    expect(fixture.nativeElement.querySelector('.cal-badge')).toBeNull();
  });

  it('shows the no-date count badge and active state', () => {
    component.noDateCount = 3;
    component.noDateActive = true;
    fixture.detectChanges();

    expect(el('.cal-badge').textContent?.trim()).toBe('3');
    expect(el('.cal-nodate-btn').classList.contains('cal-nodate-btn-active')).toBe(true);
  });

  it('emits navigation and action events', () => {
    const calls = { previous: 0, next: 0, today: 0, newTask: 0, toggleNoDate: 0 };
    component.previous.subscribe(() => (calls.previous += 1));
    component.next.subscribe(() => (calls.next += 1));
    component.today.subscribe(() => (calls.today += 1));
    component.newTask.subscribe(() => (calls.newTask += 1));
    component.toggleNoDate.subscribe(() => (calls.toggleNoDate += 1));

    el('[aria-label="Previous month"]').click();
    el('[aria-label="Next month"]').click();
    el('.cal-today-btn').click();
    el('.cal-nodate-btn').click();
    el('.cal-new-btn').click();

    expect(calls).toEqual({ previous: 1, next: 1, today: 1, newTask: 1, toggleNoDate: 1 });
  });
});
