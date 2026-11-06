import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TimePickerComponent, parseExactTime } from './time-picker.component';

describe('TimePickerComponent', () => {
  let fixture: ComponentFixture<TimePickerComponent>;
  let component: TimePickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimePickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  async function openPopover() {
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();
  }

  async function waitFor(predicate: () => boolean, timeout = 2000) {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeout) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it('renders "No time set" when value is empty', () => {
    const valueEl = fixture.debugElement.query(By.css('.time-picker-value'));
    expect(valueEl.nativeElement.textContent.trim()).toBe('No time set');
    expect(valueEl.nativeElement.classList.contains('placeholder')).toBeTrue();
  });

  it('renders formatted time when valid value is provided', () => {
    fixture.componentRef.setInput('value', '15:30');
    fixture.detectChanges();

    const valueEl = fixture.debugElement.query(By.css('.time-picker-value'));
    expect(valueEl.nativeElement.textContent.trim()).toBe('3:30 PM');
    expect(valueEl.nativeElement.classList.contains('placeholder')).toBeFalse();
  });

  it('reflects disabled state on the trigger button', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    expect(trigger.nativeElement.disabled).toBeTrue();
  });

  it('opens the popover panel when trigger is clicked', async () => {
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    const panel = document.querySelector('.time-picker-panel');
    expect(panel).toBeTruthy();
  });

  it('emits value when a preset is clicked', async () => {
    const emitSpy = spyOn(component.valueChange, 'emit');
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    const presetBtn = document.querySelector<HTMLButtonElement>('.time-picker-preset-btn');
    expect(presetBtn).toBeTruthy();
    presetBtn?.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('09:00');
  });

  it('emits value when a 15-minute slot is clicked', async () => {
    const emitSpy = spyOn(component.valueChange, 'emit');
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    const slotBtn = document.querySelector<HTMLButtonElement>('[data-time="14:15"]');
    expect(slotBtn).toBeTruthy();
    slotBtn?.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('14:15');
  });

  it('allows entering and applying an exact custom time', async () => {
    const emitSpy = spyOn(component.valueChange, 'emit');
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    const input = document.querySelector<HTMLInputElement>('.time-picker-custom-input');
    const setBtn = document.querySelector<HTMLButtonElement>('.time-picker-set-btn');
    expect(input).toBeTruthy();
    expect(setBtn).toBeTruthy();

    if (input) {
      input.value = '2:35 PM';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    expect(setBtn?.disabled).toBeFalse();
    setBtn?.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('14:35');
  });

  it('shows error hint when invalid custom time is submitted via enter', async () => {
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    const input = document.querySelector<HTMLInputElement>('.time-picker-custom-input');
    if (input) {
      input.value = 'invalid-time';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
    }

    const error = document.querySelector('.time-picker-error-hint');
    expect(error?.textContent).toContain('Enter a valid time');
  });

  it('clears time when clear button is clicked', async () => {
    fixture.componentRef.setInput('value', '10:00');
    fixture.detectChanges();

    const emitSpy = spyOn(component.valueChange, 'emit');
    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    const clearBtn = document.querySelector<HTMLButtonElement>('.time-picker-clear');
    expect(clearBtn).toBeTruthy();
    clearBtn?.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('');
  });

  it('updates the trigger when a slot is selected without a parent write-back', async () => {
    await openPopover();

    document.querySelector<HTMLButtonElement>('[data-time="14:15"]')?.click();
    fixture.detectChanges();

    const valueEl = fixture.debugElement.query(By.css('.time-picker-value'));
    expect(valueEl.nativeElement.textContent.trim()).toBe('2:15 PM');
  });

  it('allows submitting a non-empty invalid time so the error is announced', async () => {
    await openPopover();

    const input = document.querySelector<HTMLInputElement>('.time-picker-custom-input');
    const setBtn = document.querySelector<HTMLButtonElement>('.time-picker-set-btn');
    expect(input).toBeTruthy();
    expect(setBtn).toBeTruthy();
    if (!input || !setBtn) return;

    input.value = 'not-a-time';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(setBtn.disabled).toBeFalse();
    setBtn.click();
    fixture.detectChanges();

    const error = document.querySelector<HTMLElement>('.time-picker-error-hint');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBe(error?.id ?? null);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('marks the selected slot as pressed with a single tab stop', async () => {
    fixture.componentRef.setInput('value', '15:30');
    fixture.detectChanges();
    await openPopover();

    const selected = document.querySelector<HTMLButtonElement>('[data-time="15:30"]');
    expect(selected).toBeTruthy();
    if (!selected) return;
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.getAttribute('tabindex')).toBe('0');

    const tabbable = Array.from(document.querySelectorAll('.time-picker-slot')).filter(
      (slot) => slot.getAttribute('tabindex') === '0',
    );
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]).toBe(selected);
  });

  it('moves focus across the interval grid with arrow keys', async () => {
    fixture.componentRef.setInput('value', '09:00');
    fixture.detectChanges();
    await openPopover();

    const start = document.querySelector<HTMLButtonElement>('[data-time="09:00"]');
    expect(start).toBeTruthy();
    start?.focus();

    const press = (key: string) => {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      fixture.detectChanges();
    };

    press('ArrowRight');
    expect(document.activeElement).toBe(document.querySelector('[data-time="09:15"]'));

    press('ArrowDown');
    expect(document.activeElement).toBe(document.querySelector('[data-time="10:00"]'));
  });

  it('names the popover dialog and does not nest a second dialog role', async () => {
    await openPopover();

    const panel = document.querySelector('.time-picker-panel');
    expect(panel?.getAttribute('role')).toBeNull();

    const dialog = panel?.closest('.cdk-dialog-container');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-label')).toBe('Choose due time');
  });

  it('does not open the popover when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.time-picker-trigger'));
    trigger.nativeElement.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.querySelector('.time-picker-panel')).toBeNull();
  });

  it('closes the popover on Escape', async () => {
    await openPopover();
    expect(document.querySelector('.time-picker-panel')).toBeTruthy();

    const active = document.activeElement;
    expect(active).toBeTruthy();
    active?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await waitFor(() => document.querySelector('.time-picker-panel') === null);
    expect(document.querySelector('.time-picker-panel')).toBeNull();
  });

  describe('panel focus trap', () => {
    function panelTabbables(): HTMLElement[] {
      const panel = document.querySelector<HTMLElement>('.time-picker-panel');
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

    it('wraps Tab from the last panel element back to the first instead of escaping', async () => {
      fixture.componentRef.setInput('value', '15:30');
      fixture.detectChanges();
      await openPopover();

      const tabbable = panelTabbables();
      expect(tabbable.length).toBeGreaterThan(1);
      const last = tabbable[tabbable.length - 1];
      last.focus();
      expect(document.activeElement).toBe(last);

      pressTab();

      expect(document.activeElement).toBe(tabbable[0]);
      expect(document.querySelector('.time-picker-panel')).toBeTruthy();
    });

    it('wraps Shift+Tab from the first panel element back to the last', async () => {
      await openPopover();

      const tabbable = panelTabbables();
      const first = tabbable[0];
      first.focus();
      expect(document.activeElement).toBe(first);

      pressTab(true);

      expect(document.activeElement).toBe(tabbable[tabbable.length - 1]);
    });

    it('keeps the interval grid a single tab stop while trapping', async () => {
      fixture.componentRef.setInput('value', '15:30');
      fixture.detectChanges();
      await openPopover();

      const tabbable = panelTabbables();
      const slots = tabbable.filter((el) => el.classList.contains('time-picker-slot'));
      expect(slots.length).toBe(1);
      expect(slots[0].getAttribute('data-time')).toBe('15:30');
    });
  });
});

describe('parseExactTime', () => {
  it('parses 24h formats', () => {
    expect(parseExactTime('14:35')).toBe('14:35');
    expect(parseExactTime('09:05')).toBe('09:05');
    expect(parseExactTime('9:05')).toBe('09:05');
    expect(parseExactTime('00:00')).toBe('00:00');
    expect(parseExactTime('23:59')).toBe('23:59');
  });

  it('parses 12h formats with am/pm', () => {
    expect(parseExactTime('2:35 PM')).toBe('14:35');
    expect(parseExactTime('2:35pm')).toBe('14:35');
    expect(parseExactTime('2:35p')).toBe('14:35');
    expect(parseExactTime('9:12 AM')).toBe('09:12');
    expect(parseExactTime('12:00 PM')).toBe('12:00');
    expect(parseExactTime('12:00 AM')).toBe('00:00');
    expect(parseExactTime('12:45 am')).toBe('00:45');
  });

  it('parses hour-only formats', () => {
    expect(parseExactTime('9am')).toBe('09:00');
    expect(parseExactTime('9a')).toBe('09:00');
    expect(parseExactTime('5pm')).toBe('17:00');
    expect(parseExactTime('5p')).toBe('17:00');
  });

  it('returns null for invalid inputs', () => {
    expect(parseExactTime('')).toBeNull();
    expect(parseExactTime('invalid')).toBeNull();
    expect(parseExactTime('25:00')).toBeNull();
    expect(parseExactTime('12:65')).toBeNull();
    expect(parseExactTime('24:00')).toBeNull();
    expect(parseExactTime('9:5')).toBeNull();
    expect(parseExactTime('13pm')).toBeNull();
    expect(parseExactTime('0am')).toBeNull();
  });

  it('handles whitespace and meridiem edge cases', () => {
    expect(parseExactTime(' 9:15 pm ')).toBe('21:15');
    expect(parseExactTime('12p')).toBe('12:00');
    expect(parseExactTime('12:30a')).toBe('00:30');
    expect(parseExactTime('0:15')).toBe('00:15');
  });
});
