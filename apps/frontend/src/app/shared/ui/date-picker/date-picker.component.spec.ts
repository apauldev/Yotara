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
