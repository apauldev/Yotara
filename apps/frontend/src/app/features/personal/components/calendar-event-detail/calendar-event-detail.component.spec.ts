import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CalendarEventDto } from '@yotara/shared';
import { CalendarEventDetailComponent } from './calendar-event-detail.component';

describe('CalendarEventDetailComponent', () => {
  let fixture: ComponentFixture<CalendarEventDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarEventDetailComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventDetailComponent);
    fixture.componentInstance.event = {
      id: 'event-1',
      sourceId: 'source-1',
      sourceName: 'Work',
      sourceColor: 'teal',
      summary: 'Planning',
      description: '<unsafe>',
      location: 'Room 3',
      allDay: false,
      dayKeys: ['2026-10-12'],
      startTime: '09:00',
      endTime: '09:30',
      floating: false,
      timezone: 'UTC',
      status: 'CONFIRMED',
    } satisfies CalendarEventDto;
    fixture.detectChanges();
  });

  it('renders plain event text and labels it read-only', () => {
    expect(fixture.nativeElement.textContent).toContain('From Work calendar · Read-only.');
    expect(fixture.nativeElement.textContent).toContain('<unsafe>');
    expect(fixture.nativeElement.querySelector('button[aria-label*="complete"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label*="delete"]')).toBeNull();
  });

  it('emits close from the close control', () => {
    let closed = false;
    fixture.componentInstance.close.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('.event-close') as HTMLButtonElement).click();
    expect(closed).toBeTrue();
  });
});
