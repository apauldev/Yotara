import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Traps Tab within the panel it decorates while a picker popover is open.
 *
 * Picker popovers render their content in a document-level CDK overlay,
 * outside any containing modal dialog. Keydowns fired inside the panel never
 * bubble through the dialog element, so the dialog's own focus trap cannot
 * see them: a keyboard user could Tab straight out of the parent modal while
 * the picker is open. This directive keeps Tab (and Shift+Tab) cycling within
 * the panel. Escape or selecting a value still closes the popover and CDK
 * restores focus to the trigger inside the dialog.
 */
@Directive({
  selector: '[appPickerFocusTrap]',
  host: {
    '(keydown)': 'onKeydown($event)',
  },
})
export class PickerFocusTrapDirective {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusable = this.getPanelTabbables(this.host.nativeElement);
    if (focusable.length === 0) return;

    const active = this.document.activeElement;
    const currentIndex = active instanceof HTMLElement ? focusable.indexOf(active) : -1;
    const backwards = event.shiftKey;
    const nextIndex =
      currentIndex === -1
        ? backwards
          ? focusable.length - 1
          : 0
        : backwards
          ? currentIndex <= 0
            ? focusable.length - 1
            : currentIndex - 1
          : currentIndex >= focusable.length - 1
            ? 0
            : currentIndex + 1;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  private getPanelTabbables(panel: HTMLElement) {
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[href]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      ),
    ).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        element.getAttribute('tabindex') !== '-1' &&
        !element.hasAttribute('aria-hidden') &&
        // Both pickers use roving tabindex grids (time slots and calendar
        // days), so inactive grid cells (tabindex="-1") must stay out of the
        // trap order and each grid keeps a single Tab stop.
        element.checkVisibility(),
    );
  }
}
