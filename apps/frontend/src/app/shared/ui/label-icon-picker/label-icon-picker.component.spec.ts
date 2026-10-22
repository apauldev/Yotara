import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LABEL_ICON_KEYS } from '@yotara/shared';
import { LabelIconComponent } from '../label-icon/label-icon.component';
import { LabelIconPickerComponent } from './label-icon-picker.component';

describe('LabelIconPickerComponent', () => {
  let fixture: ComponentFixture<LabelIconPickerComponent>;
  let component: LabelIconPickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelIconPickerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LabelIconPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders every shared icon as a radio option', () => {
    const radios = fixture.debugElement.queryAll(By.css('[role="radio"]'));
    expect(radios.length).toBe(LABEL_ICON_KEYS.length);
    expect(radios[0].nativeElement.getAttribute('aria-checked')).toBe('false');
  });

  it('exposes the selected icon with roving tabindex', () => {
    fixture.componentRef.setInput('icon', 'pen');
    fixture.detectChanges();

    const pen = fixture.debugElement
      .queryAll(By.css('[role="radio"]'))
      .find((radio) => radio.nativeElement.getAttribute('aria-label') === 'pen icon')!;
    expect(pen.nativeElement.getAttribute('aria-checked')).toBe('true');
    expect(pen.nativeElement.getAttribute('tabindex')).toBe('0');

    const others = fixture.debugElement
      .queryAll(By.css('[role="radio"]'))
      .filter((radio) => radio !== pen);
    expect(
      others.every((radio) => radio.nativeElement.getAttribute('tabindex') === '-1'),
    ).toBeTrue();
  });

  it('emits the chosen icon when an option is clicked', () => {
    const emitted: string[] = [];
    component.iconChange.subscribe((icon) => emitted.push(icon));

    const book = fixture.debugElement
      .queryAll(By.css('[role="radio"]'))
      .find((radio) => radio.nativeElement.getAttribute('aria-label') === 'book icon')!;
    book.nativeElement.click();

    expect(emitted).toEqual(['book']);
  });

  it('moves focus with arrow keys inside the radio group', () => {
    fixture.componentRef.setInput('icon', 'tag');
    fixture.detectChanges();

    const group = fixture.debugElement.query(By.css('[role="radiogroup"]'));
    group.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    const radios = fixture.debugElement.queryAll(By.css('[role="radio"]'));
    expect(radios[0].nativeElement.getAttribute('tabindex')).toBe('0');
    expect(radios[1].nativeElement.getAttribute('tabindex')).toBe('-1');
  });

  it('renders every shared icon as a large flat glyph with no suggested shortcut', () => {
    const icons = fixture.debugElement.queryAll(By.directive(LabelIconComponent));
    expect(icons.length).toBe(LABEL_ICON_KEYS.length);
    expect(icons.every((icon) => icon.componentInstance.flat)).toBeTrue();
    expect(icons.every((icon) => icon.componentInstance.size === 'xl')).toBeTrue();
    expect(fixture.debugElement.query(By.css('.suggested-row'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.suggested-option'))).toBeNull();
  });
});
