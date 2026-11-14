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

  it('linkifies web URLs and leaves unsafe destinations as plain text', () => {
    fixture.componentInstance.event = {
      ...fixture.componentInstance.event,
      description:
        'Bad https://user:pass@example.com/private. Join https://meet.example.com/room. Backup http://docs.example.com/agenda. javascript:alert(1)',
    };
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll(
      '.event-description-link',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(2);
    expect(links[0].href).toBe('https://meet.example.com/room');
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toContain('noopener');
    expect(links[0].rel).toContain('noreferrer');
    expect(links[0].getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(links[1].href).toBe('http://docs.example.com/agenda');
    expect(fixture.nativeElement.querySelector('.event-description')?.textContent).toContain(
      'javascript:alert(1)',
    );
  });

  it('shows all-day dates and the untitled fallback without optional details', () => {
    fixture.componentInstance.event = {
      ...fixture.componentInstance.event,
      summary: '',
      description: null,
      location: null,
      allDay: true,
      dayKeys: ['2026-10-12', '2026-10-13'],
      startTime: null,
      endTime: null,
    };
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Untitled event');
    expect(fixture.nativeElement.textContent).toContain('2026-10-12 – 2026-10-13 · All day');
    expect(fixture.nativeElement.querySelector('.event-location')).toBeNull();
    expect(fixture.nativeElement.querySelector('.event-description')).toBeNull();
  });

  it('emits close from the close control', () => {
    let closed = false;
    fixture.componentInstance.close.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('.event-close') as HTMLButtonElement).click();
    expect(closed).toBeTrue();
  });
});
