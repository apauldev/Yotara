import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LabelChipComponent } from './label-chip.component';

describe('LabelChipComponent', () => {
  function createComponent(inputs: Partial<Record<string, unknown>> & { label: unknown }) {
    const fixture = TestBed.createComponent(LabelChipComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  const redLabel = { id: 'l1', name: 'Urgent', color: '#d44d3c', userId: 'u1' };
  const neutralLabel = { id: 'l2', name: 'Ice', color: '#dee0d8', userId: 'u1' };
  const legacyLabel = { id: 'l3', name: 'Legacy', color: 'rebeccapurple', userId: 'u1' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelChipComponent],
    }).compileComponents();
  });

  it('renders the name in full mode and omits it in compact mode', () => {
    const full = createComponent({ label: redLabel, mode: 'full' });
    expect(full.debugElement.query(By.css('.label-chip-name')).nativeElement.textContent).toBe(
      'Urgent',
    );

    const compact = createComponent({ label: redLabel, mode: 'compact' });
    expect(compact.debugElement.query(By.css('.label-chip-name'))).toBeNull();
    expect(
      compact.debugElement
        .query(By.css('.label-chip-body'))
        .nativeElement.getAttribute('aria-label'),
    ).toBe('Label: Urgent');
  });

  it('is static by default and a button only when interactive', () => {
    const interactive = createComponent({ label: redLabel, interactive: true });
    const button = interactive.debugElement.query(By.css('button.label-chip-control'))
      .nativeElement as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBeNull();

    const selected = createComponent({ label: redLabel, interactive: true, selected: true });
    expect(
      selected.debugElement
        .query(By.css('button.label-chip-control'))
        .nativeElement.getAttribute('aria-pressed'),
    ).toBe('true');

    const chip = createComponent({ label: redLabel });
    expect(chip.debugElement.query(By.css('button.label-chip-control'))).toBeNull();
  });

  it('emits select with the label and stops the event from reaching card handlers', () => {
    const fixture = createComponent({ label: redLabel, interactive: true });
    const selectSpy = jasmine.createSpy('select');
    fixture.componentInstance.select.subscribe(selectSpy);

    const event = new MouseEvent('click', { bubbles: true });
    let propagated = true;
    event.stopPropagation = () => (propagated = false);
    fixture.debugElement
      .query(By.css('button.label-chip-control'))
      .triggerEventHandler('click', event);
    expect(selectSpy).toHaveBeenCalledWith(redLabel);
    expect(propagated).toBe(false);
  });

  it('renders a sibling remove button, never nested inside the control', () => {
    const fixture = createComponent({ label: redLabel, removable: true });
    const removeButton = fixture.debugElement.query(By.css('.label-chip-remove'));
    expect(removeButton).toBeTruthy();
    expect(removeButton.nativeElement.getAttribute('aria-label')).toBe('Remove Urgent');

    const container = fixture.debugElement.query(By.css('.label-chip'));
    const buttons = Array.from(
      (container.nativeElement as HTMLElement).querySelectorAll('button'),
    ) as HTMLElement[];
    // Siblings, so no button is a descendant of another button.
    expect(buttons.every((b) => b.parentElement?.querySelectorAll('button').length === 1)).toBe(
      true,
    );
  });

  it('emits remove and stops propagation when the remove button is clicked', () => {
    const fixture = createComponent({ label: redLabel, removable: true });
    const removeSpy = jasmine.createSpy('remove');
    fixture.componentInstance.remove.subscribe(removeSpy);

    const event = new MouseEvent('click', { bubbles: true });
    let propagated = true;
    event.stopPropagation = () => (propagated = false);
    fixture.debugElement.query(By.css('.label-chip-remove')).triggerEventHandler('click', event);
    expect(removeSpy).toHaveBeenCalledWith(redLabel);
    expect(propagated).toBe(false);
  });

  it('maps label colors to the max-contrast on-color token', () => {
    const light = createComponent({ label: neutralLabel });
    const host = light.debugElement.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--label-on-strong').trim()).toBe('#000000');
    expect(host.style.getPropertyValue('--label-color').trim()).toBe('#dee0d8');

    const dark = createComponent({
      label: { id: 'l4', name: 'Deep', color: '#2b7c55', userId: 'u1' },
    });
    expect(
      (dark.debugElement.nativeElement as HTMLElement).style
        .getPropertyValue('--label-on-strong')
        .trim(),
    ).toBe('#ffffff');

    // #d44d3c is a mid-tone per WCAG: black (4.93:1) beats white (4.26:1).
    const midtone = createComponent({ label: redLabel });
    expect(
      (midtone.debugElement.nativeElement as HTMLElement).style
        .getPropertyValue('--label-on-strong')
        .trim(),
    ).toBe('#000000');
  });

  it('falls back to accent tokens for legacy non-hex colors', () => {
    const fixture = createComponent({ label: legacyLabel });
    const host = fixture.debugElement.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--label-color').trim()).toBe('var(--accent-strong)');
  });

  it('marks near-neutral chips for the subtle border treatment', () => {
    const neutral = createComponent({ label: neutralLabel });
    expect((neutral.debugElement.nativeElement as HTMLElement).classList).toContain(
      'label-chip-neutral',
    );

    const saturated = createComponent({ label: redLabel });
    expect((saturated.debugElement.nativeElement as HTMLElement).classList).not.toContain(
      'label-chip-neutral',
    );
  });
});
