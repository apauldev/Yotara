import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { StrengthMeterComponent } from './strength-meter.component';

describe('StrengthMeterComponent', () => {
  function createComponent(password: string) {
    const fixture = TestBed.createComponent(StrengthMeterComponent);
    fixture.componentRef.setInput('password', password);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrengthMeterComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = createComponent('');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not render anything when password is empty', () => {
    const fixture = createComponent('');
    expect(fixture.debugElement.query(By.css('.strength-meter'))).toBeNull();
  });

  it('should render weak strength for a password with very few requirements met', () => {
    const fixture = createComponent('a');
    const label = fixture.debugElement.query(By.css('.strength-label span'));
    expect(label.nativeElement.textContent).toContain('Weak');

    const bar = fixture.debugElement.query(By.css('.strength-bar'));
    expect(bar.nativeElement.classList).toContain('strength-weak');
    expect(bar.styles['width']).toBe('33%');
  });

  it('should render fair strength for a medium password', () => {
    const fixture = createComponent('Ab');
    const label = fixture.debugElement.query(By.css('.strength-label span'));
    expect(label.nativeElement.textContent).toContain('Fair');

    const bar = fixture.debugElement.query(By.css('.strength-bar'));
    expect(bar.nativeElement.classList).toContain('strength-fair');
    expect(bar.styles['width']).toBe('66%');
  });

  it('should render good strength for password meeting most requirements', () => {
    const fixture = createComponent('Abcdef12');
    const label = fixture.debugElement.query(By.css('.strength-label span'));
    expect(label.nativeElement.textContent).toContain('Good');

    const bar = fixture.debugElement.query(By.css('.strength-bar'));
    expect(bar.nativeElement.classList).toContain('strength-good');
    expect(bar.styles['width']).toBe('99%');
  });

  it('should render strong strength for a password meeting all requirements', () => {
    const fixture = createComponent('Abcdef1!');
    const label = fixture.debugElement.query(By.css('.strength-label span'));
    expect(label.nativeElement.textContent).toContain('Strong');

    const bar = fixture.debugElement.query(By.css('.strength-bar'));
    expect(bar.nativeElement.classList).toContain('strength-strong');
    expect(bar.styles['width']).toBe('99%');
  });

  it('should show met/unmet requirements', () => {
    const fixture = createComponent('Abcdef1!xyz');
    const requirementSpans = fixture.debugElement.queryAll(By.css('.requirements span'));

    expect(requirementSpans.length).toBe(5);
    expect(requirementSpans[0].nativeElement.classList).toContain('met'); // 8+ chars
    expect(requirementSpans[1].nativeElement.classList).toContain('met'); // Capital
    expect(requirementSpans[2].nativeElement.classList).toContain('met'); // Lowercase
    expect(requirementSpans[3].nativeElement.classList).toContain('met'); // Number
    expect(requirementSpans[4].nativeElement.classList).toContain('met'); // Symbol
  });

  it('should show unmet requirements for a weak password', () => {
    const fixture = createComponent('ab');
    const requirementSpans = fixture.debugElement.queryAll(By.css('.requirements span'));

    expect(requirementSpans[0].nativeElement.classList).not.toContain('met'); // 8+ chars
    expect(requirementSpans[1].nativeElement.classList).not.toContain('met'); // Capital
    expect(requirementSpans[2].nativeElement.classList).toContain('met'); // Lowercase ✓
    expect(requirementSpans[3].nativeElement.classList).not.toContain('met'); // Number
    expect(requirementSpans[4].nativeElement.classList).not.toContain('met'); // Symbol
  });
});
