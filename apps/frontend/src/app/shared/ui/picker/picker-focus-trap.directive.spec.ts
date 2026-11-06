import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PickerFocusTrapDirective } from './picker-focus-trap.directive';

/**
 * The directive listens for keydowns bubbling through its host panel, so the
 * hosts below render a plain panel with explicit tab stops to pin down the
 * trap order independently of either picker.
 */
@Component({
  template: `
    <div appPickerFocusTrap data-testid="panel">
      <button id="first-button" type="button">First</button>
      <button id="aria-hidden-button" type="button" aria-hidden="true">Hidden</button>
      <button id="disabled-button" type="button" disabled>Disabled</button>
      <button id="inactive-slot" type="button" tabindex="-1">Inactive slot</button>
      <span id="middle-tabstop" tabindex="0">Middle</span>
      <input id="text-input" type="text" />
      <button id="last-button" type="button">Last</button>
    </div>
  `,
  imports: [PickerFocusTrapDirective],
})
class TrapHostComponent {}

@Component({
  template: `
    <div appPickerFocusTrap data-testid="empty-panel">
      <span>Nothing focusable here</span>
    </div>
  `,
  imports: [PickerFocusTrapDirective],
})
class EmptyPanelHostComponent {}

@Component({
  template: `
    <div appPickerFocusTrap data-testid="svg-panel">
      <button id="svg-first-button" type="button">First</button>
      <svg id="svg-tabstop" tabindex="0" width="16" height="16">
        <circle cx="8" cy="8" r="4" />
      </svg>
    </div>
  `,
  imports: [PickerFocusTrapDirective],
})
class SvgHostComponent {}

describe('PickerFocusTrapDirective', () => {
  let fixture: ComponentFixture<TrapHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TrapHostComponent);
    fixture.detectChanges();
  });

  /**
   * Dispatches on the currently focused element (matching real keyboard
   * behavior) or an explicit target. Only focus movement is asserted:
   * synthetic `defaultPrevented` is unreliable under zone.js, which replaces
   * `preventDefault` on the quick path used by tests.
   */
  function pressTab(options: { shift?: boolean; key?: string; target?: HTMLElement } = {}) {
    const target = options.target ?? (document.activeElement as HTMLElement);
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: options.key ?? 'Tab',
        shiftKey: options.shift ?? false,
        bubbles: true,
      }),
    );
    fixture.detectChanges();

    return document.activeElement as HTMLElement;
  }

  function byId(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  it('keeps Tab trapped inside the panel, skipping unavailable elements', () => {
    const firstButton = byId('first-button');
    const middleTabstop = byId('middle-tabstop');
    expect(firstButton).withContext('first tab stop rendered').toBeTruthy();
    expect(middleTabstop).withContext('skipped-over tab stop rendered').toBeTruthy();
    if (!firstButton || !middleTabstop) return;

    firstButton.focus();
    const active = pressTab();

    // Trap order excludes the aria-hidden, disabled and tabindex="-1" hosts.
    expect(active).toBe(middleTabstop);
  });

  it('cycles forward from the last element back to the first', () => {
    const lastButton = byId('last-button');
    const firstButton = byId('first-button');
    expect(lastButton).withContext('last tab stop rendered').toBeTruthy();
    expect(firstButton).withContext('first tab stop rendered').toBeTruthy();
    if (!lastButton || !firstButton) return;

    lastButton.focus();
    const active = pressTab();

    expect(active).toBe(firstButton);
  });

  it('cycles backward from the first element to the last', () => {
    const firstButton = byId('first-button');
    const lastButton = byId('last-button');
    expect(firstButton).withContext('first tab stop rendered').toBeTruthy();
    expect(lastButton).withContext('last tab stop rendered').toBeTruthy();
    if (!firstButton || !lastButton) return;

    firstButton.focus();
    const active = pressTab({ shift: true });

    expect(active).toBe(lastButton);
  });

  it('steps backward within the panel with Shift+Tab', () => {
    const textInput = byId('text-input');
    const middleTabstop = byId('middle-tabstop');
    expect(textInput).withContext('input tab stop rendered').toBeTruthy();
    expect(middleTabstop).withContext('middle tab stop rendered').toBeTruthy();
    if (!textInput || !middleTabstop) return;

    textInput.focus();
    const active = pressTab({ shift: true });

    expect(active).toBe(middleTabstop);
  });

  it('starts at the first element when focus is elsewhere', () => {
    const firstButton = byId('first-button');
    const panel = document.querySelector<HTMLElement>('[data-testid="panel"]');
    expect(firstButton).withContext('first tab stop rendered').toBeTruthy();
    expect(panel).withContext('panel rendered').toBeTruthy();
    if (!firstButton || !panel) return;

    document.body.focus();
    const active = pressTab({ target: panel });

    expect(active).toBe(firstButton);
  });

  it('starts at the last element when focus is elsewhere and Shift is held', () => {
    const lastButton = byId('last-button');
    const panel = document.querySelector<HTMLElement>('[data-testid="panel"]');
    expect(lastButton).withContext('last tab stop rendered').toBeTruthy();
    expect(panel).withContext('panel rendered').toBeTruthy();
    if (!lastButton || !panel) return;

    document.body.focus();
    const active = pressTab({ shift: true, target: panel });

    expect(active).toBe(lastButton);
  });

  it('treats non-HTMLElement focus targets as outside the trap order', () => {
    // SVG hosts live in their own panel so the shared host's trap order
    // expectations still line up element-for-element.
    const svgFixture = TestBed.createComponent(SvgHostComponent);
    svgFixture.detectChanges();

    const svg = document.getElementById('svg-tabstop');
    const firstButton = document.getElementById('svg-first-button');
    expect(svg).withContext('svg tab stop rendered').toBeTruthy();
    expect(firstButton).withContext('first tab stop rendered').toBeTruthy();
    if (!svg || !firstButton) return;

    svg.focus();
    expect(document.activeElement).toBe(svg);

    // SVGElement is not an HTMLElement, so the trap cannot find it in its
    // order and behaves as if focus were elsewhere: Tab (forward) starts at
    // the first element.
    const active = pressTab({ target: svg });

    expect(active).toBe(firstButton);
  });

  it('leaves non-Tab keypresses alone', () => {
    const textInput = byId('text-input');
    expect(textInput).withContext('input tab stop rendered').toBeTruthy();
    if (!textInput) return;
    textInput.focus();

    const active = pressTab({ key: 'Enter' });

    expect(active).toBe(textInput);
  });

  it('is a no-op for panels without any tabbable element', () => {
    const emptyFixture = TestBed.createComponent(EmptyPanelHostComponent);
    emptyFixture.detectChanges();
    const emptyPanel = document.querySelector<HTMLElement>('[data-testid="empty-panel"]');
    expect(emptyPanel).withContext('empty panel rendered').toBeTruthy();
    if (!emptyPanel) return;

    document.body.focus();
    const active = pressTab({ target: emptyPanel });

    expect(active).toBe(document.body);
  });
});
