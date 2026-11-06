import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DatePickerComponent } from './date-picker.component';

describe('DatePickerComponent trigger semantics', () => {
  let fixture: ComponentFixture<DatePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatePickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DatePickerComponent);
    fixture.detectChanges();
  });

  it('exposes a public open interaction for external Change buttons', async () => {
    fixture.componentInstance.open();
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.querySelector('.date-picker-panel')).toBeTruthy();
    expect(document.activeElement?.classList.contains('date-picker-nav')).toBeTrue();
  });

  it('emits one value change for a calendar day click', () => {
    const emitSpy = spyOn(fixture.componentInstance.valueChange, 'emit');
    fixture.componentInstance.open();
    fixture.detectChanges();

    const day = document.querySelector<HTMLButtonElement>('.date-picker-day');
    expect(day).toBeTruthy();
    expect(day?.getAttribute('aria-label')).toMatch(/\w+day,/);
    day?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits an empty date and closes when the selected date is cleared', () => {
    fixture.componentRef.setInput('value', '2026-10-02');
    fixture.detectChanges();
    const emitSpy = spyOn(fixture.componentInstance.valueChange, 'emit');
    fixture.componentInstance.open();
    fixture.detectChanges();

    const clearButton = document.querySelector<HTMLButtonElement>('.date-picker-clear');
    expect(clearButton).toBeTruthy();
    clearButton?.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledOnceWith('');
    expect(
      fixture.debugElement
        .query(By.css('.date-picker-trigger'))
        .nativeElement.getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('leaves the trigger unmarked by default', () => {
    const trigger = fixture.debugElement.query(By.css('.date-picker-trigger'));

    expect(trigger.nativeElement.getAttribute('aria-invalid')).toBeNull();
    expect(trigger.nativeElement.getAttribute('aria-describedby')).toBeNull();
  });

  it('reflects invalid and described-by state on the trigger', () => {
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('describedBy', 'task-due-date-error');
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.date-picker-trigger'));

    expect(trigger.nativeElement.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.nativeElement.getAttribute('aria-describedby')).toBe('task-due-date-error');
  });
});

describe('DatePickerComponent panel focus trap', () => {
  let fixture: ComponentFixture<DatePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatePickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DatePickerComponent);
    fixture.detectChanges();
  });

  function panelTabbables(): HTMLElement[] {
    const panel = document.querySelector<HTMLElement>('.date-picker-panel');
    expect(panel).toBeTruthy();
    return Array.from(
      panel!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        element.getAttribute('tabindex') !== '-1' &&
        element.checkVisibility(),
    );
  }

  function pressTab(shift = false): void {
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }),
    );
    fixture.detectChanges();
  }

  async function openPanel() {
    fixture.componentInstance.open();
    fixture.detectChanges();
    await Promise.resolve();
  }

  it('wraps Tab from the last panel element back to the first instead of escaping', async () => {
    fixture.componentRef.setInput('value', '2026-10-02');
    fixture.detectChanges();
    await openPanel();

    const tabbable = panelTabbables();
    expect(tabbable.length).toBeGreaterThan(1);
    const clearButton = tabbable[tabbable.length - 1];
    clearButton.focus();
    expect(document.activeElement).toBe(clearButton);

    pressTab();

    expect(document.activeElement).toBe(tabbable[0]);
    expect(tabbable[0].classList.contains('date-picker-nav')).toBeTrue();
    expect(document.querySelector('.date-picker-panel')).toBeTruthy();
  });

  it('wraps Shift+Tab from the first panel element back to the last', async () => {
    await openPanel();

    const tabbable = panelTabbables();
    const first = tabbable[0];
    first.focus();
    expect(document.activeElement).toBe(first);

    pressTab(true);

    expect(document.activeElement).toBe(tabbable[tabbable.length - 1]);
  });

  it('keeps the calendar grid a single tab stop while trapping', async () => {
    fixture.componentRef.setInput('value', '2026-10-02');
    fixture.detectChanges();
    await openPanel();

    const tabbable = panelTabbables();
    const dayCells = tabbable.filter((el) => el.classList.contains('date-picker-day'));
    expect(dayCells.length).toBe(1);
    expect(dayCells[0].getAttribute('aria-selected')).toBe('true');

    pressTab();

    expect(document.activeElement).not.toBe(dayCells[0]);
    expect(tabbable.includes(document.activeElement as HTMLElement))
      .withContext('focus stays within the panel')
      .toBeTrue();
  });
});
