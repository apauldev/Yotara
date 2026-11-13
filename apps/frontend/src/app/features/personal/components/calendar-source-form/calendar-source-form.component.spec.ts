import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarService } from '../../../../core/services/calendar.service';
import { CalendarSourceFormComponent } from './calendar-source-form.component';

describe('CalendarSourceFormComponent provider help', () => {
  let fixture: ComponentFixture<CalendarSourceFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarSourceFormComponent],
      providers: [
        {
          provide: CalendarService,
          useValue: { createSource: jasmine.createSpy('createSource') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarSourceFormComponent);
    fixture.detectChanges();
  });

  it('opens provider instructions in a dialog with Google steps by default', () => {
    const helpButton = fixture.nativeElement.querySelector(
      '.provider-help-button',
    ) as HTMLButtonElement;
    helpButton.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Secret address in iCal format');
    expect(
      dialog.querySelector('a[href="https://support.google.com/calendar/answer/37648"]'),
    ).not.toBeNull();
  });

  it('switches provider instructions and closes on Escape', () => {
    (fixture.nativeElement.querySelector('.provider-help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.provider-tabs button');
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.provider-instructions h3')?.textContent).toContain(
      'Outlook.com or Microsoft 365',
    );

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('explains that a calendar page URL with cid is not an ICS feed', () => {
    (fixture.nativeElement.querySelector('.provider-help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.provider-tabs button');
    (tabs[4] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.provider-instructions')?.textContent).toContain(
      '?cid=',
    );
    expect(fixture.nativeElement.querySelector('.provider-instructions')?.textContent).toContain(
      'not an ICS feed URL',
    );
  });
});
