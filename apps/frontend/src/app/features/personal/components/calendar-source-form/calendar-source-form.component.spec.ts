import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import type { CalendarSource } from '@yotara/shared';
import { CalendarService } from '../../../../core/services/calendar.service';
import { CalendarSourceFormComponent } from './calendar-source-form.component';

describe('CalendarSourceFormComponent provider help', () => {
  let fixture: ComponentFixture<CalendarSourceFormComponent>;
  let createSource: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarSourceFormComponent],
      providers: [
        {
          provide: CalendarService,
          useValue: { createSource: (createSource = jasmine.createSpy('createSource')) },
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

  it('tells users they can paste webcal links unchanged', () => {
    (fixture.nativeElement.querySelector('.provider-help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.provider-tabs button');
    (tabs[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    const instructions = fixture.nativeElement.querySelector(
      '.provider-instructions',
    ) as HTMLElement;
    expect(instructions.textContent).toContain('Paste the link into Yotara as copied');
    expect(instructions.textContent).toContain('webcal://');
    expect(instructions.textContent).toContain('converted to HTTPS automatically');

    (tabs[4] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.provider-instructions')?.textContent).toContain(
      'webcal:// links are converted to HTTPS automatically',
    );
  });

  it('connects a trimmed URL, reports success, clears fields, and emits the source', async () => {
    const connectedSource: CalendarSource = {
      id: 'source-1',
      name: 'Work',
      color: 'teal',
      enabled: true,
      host: 'calendar.example.com',
      eventCount: 4,
      lastFetchedAt: null,
      lastSuccessAt: null,
      lastError: null,
      createdAt: '2026-11-13T00:00:00.000Z',
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    createSource.and.resolveTo(connectedSource);
    const emitted: CalendarSource[] = [];
    fixture.componentInstance.connected.subscribe((source) => emitted.push(source));

    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    inputs[0].value = '  webcal://calendar.example.com/feed.ics  ';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = '  Work  ';
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createSource).toHaveBeenCalledWith({
      url: 'webcal://calendar.example.com/feed.ics',
      name: 'Work',
      color: 'teal',
    });
    expect(emitted).toEqual([connectedSource]);
    expect(fixture.nativeElement.querySelector('.source-success')?.textContent).toContain(
      '4 events found',
    );
    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
  });

  it('shows the safe API error message when a connection is rejected', async () => {
    createSource.and.rejectWith(
      new HttpErrorResponse({ error: { message: 'The feed URL is not allowed.' }, status: 422 }),
    );
    const input = fixture.nativeElement.querySelector('input[type="url"]') as HTMLInputElement;
    input.value = 'webcal://calendar.example.com/feed.ics';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.source-error')?.textContent).toContain(
      'The feed URL is not allowed.',
    );
    expect(fixture.nativeElement.querySelector('.source-success')).toBeNull();
  });
});
