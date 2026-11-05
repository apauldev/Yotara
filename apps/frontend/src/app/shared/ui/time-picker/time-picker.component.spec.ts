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

  afterEach(() => {
    // Clean up popover overlays from document body
    const panels = document.querySelectorAll('.time-picker-panel');
    panels.forEach((p) => p.closest('brn-popover')?.remove());
  });

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

    const slotBtn = document.querySelector<HTMLButtonElement>('#slot-14-15');
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
  });
});
