import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';

type ModalSize = 'sm' | 'md' | 'lg';

export type ModalLayout = 'default' | 'full-height';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './modal.component.scss',
})
export class ModalComponent implements OnChanges, AfterViewChecked, OnDestroy {
  private readonly document = inject(DOCUMENT);

  @Input() open = false;
  @Input() title = '';
  @Input() size: ModalSize = 'md';
  @Input() layout: ModalLayout = 'default';
  @Input() showFooter = true;
  @Input() closeOnBackdrop = true;
  @Input() closeOnEsc = true;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly afterOpen = new EventEmitter<void>();

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  private previousFocus: HTMLElement | null = null;
  private previousBodyOverflow = '';
  private bodyLocked = false;
  private pendingAfterOpen = false;
  private isOpen = false;

  readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 10)}`;

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['open']) {
      return;
    }

    if (this.open && !this.isOpen) {
      this.handleOpen();
    } else if (!this.open && this.isOpen) {
      this.handleClose();
    }
  }

  ngAfterViewChecked() {
    if (!this.pendingAfterOpen || !this.dialog) {
      return;
    }

    this.pendingAfterOpen = false;
    this.focusFirstElement();
    this.afterOpen.emit();
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
    this.restoreFocus();
  }

  protected onBackdropClick() {
    if (this.closeOnBackdrop) {
      this.close.emit();
    }
  }

  protected onDialogClick(event: MouseEvent) {
    event.stopPropagation();
  }

  protected onDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.closeOnEsc) {
        event.preventDefault();
        this.close.emit();
      }
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  protected closeFromButton() {
    this.close.emit();
  }

  private handleOpen() {
    this.isOpen = true;
    this.previousFocus =
      this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    this.lockBodyScroll();
    this.pendingAfterOpen = true;
  }

  private handleClose() {
    this.isOpen = false;
    this.pendingAfterOpen = false;
    this.unlockBodyScroll();
    this.restoreFocus();
  }

  private lockBodyScroll() {
    if (this.bodyLocked) {
      return;
    }
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.bodyLocked = true;
  }

  private unlockBodyScroll() {
    if (!this.bodyLocked) {
      return;
    }
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.bodyLocked = false;
  }

  private restoreFocus() {
    const target = this.previousFocus;
    this.previousFocus = null;
    if (target && target.isConnected) {
      target.focus();
    }
  }

  private focusFirstElement() {
    const dialog = this.dialog?.nativeElement;
    if (!dialog) {
      return;
    }

    const autofocusTarget = dialog.querySelector<HTMLElement>('[autofocus],[data-autofocus]');
    if (
      autofocusTarget &&
      !autofocusTarget.hasAttribute('disabled') &&
      !autofocusTarget.hasAttribute('aria-hidden')
    ) {
      autofocusTarget.focus();
      return;
    }

    const focusable = this.getFocusableElements(dialog);
    if (focusable.length > 0) {
      focusable[0].focus();
      return;
    }

    dialog.focus();
  }

  private trapFocus(event: KeyboardEvent) {
    const dialog = this.dialog?.nativeElement;
    if (!dialog) {
      return;
    }

    const focusable = this.getFocusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const currentIndex = focusable.indexOf(this.document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === focusable.length - 1
        ? 0
        : currentIndex + 1;

    event.preventDefault();
    focusable[nextIndex].focus();
  }

  private getFocusableElements(container: HTMLElement) {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          '[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      ),
    ).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        !element.hasAttribute('aria-hidden') &&
        // Collapsed regions (e.g. display:none) stay in the DOM but must not
        // participate in the trap: focusing them is a no-op that leaves
        // keyboard users stuck after preventDefault().
        element.checkVisibility(),
    );
  }
}
