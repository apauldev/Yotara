import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-logout-confirm-modal',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      [open]="open"
      [title]="title"
      [description]="description"
      [confirmLabel]="confirmLabel"
      [cancelLabel]="stayLabel"
      [loading]="loading"
      [loadingLabel]="loadingLabel"
      (close)="close.emit()"
      (cancel)="stay.emit()"
      (confirm)="confirm.emit()"
    >
      <div confirm-icon class="icon-wrap" aria-hidden="true">
        <div class="icon-disc">
          <svg viewBox="0 0 24 24">
            <path d="M12 3v10" />
            <path d="m16 9-4 4-4-4" />
            <path d="M4 17v2h16v-2" />
          </svg>
        </div>
      </div>
    </app-confirm-dialog>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .icon-wrap {
        display: grid;
        place-items: center;
        margin-bottom: 1rem;
      }

      .icon-disc {
        width: 4.4rem;
        height: 4.4rem;
        border-radius: 999px;
        background: #f0efe8;
        display: grid;
        place-items: center;
      }

      .icon-disc svg {
        width: 2rem;
        height: 2rem;
        stroke: #6d947c;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ],
})
export class LogoutConfirmModalComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() title = 'Leave the Sanctuary?';
  @Input() description =
    "Your progress is safe. We'll be here when you're ready to find your focus again.";
  @Input() stayLabel = 'Stay and Focus';
  @Input() confirmLabel = 'Logout';
  @Input() loadingLabel = 'Logging out...';
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly stay = new EventEmitter<void>();
  @Output() readonly confirm = new EventEmitter<void>();
}
