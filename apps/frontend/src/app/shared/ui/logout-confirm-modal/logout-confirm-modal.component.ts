import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-logout-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="modal-shell">
        <button
          type="button"
          class="backdrop"
          aria-label="Close logout confirmation"
          (click)="close.emit()"
        ></button>

        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
        >
          <button
            type="button"
            class="dismiss-button"
            aria-label="Close logout confirmation"
            (click)="close.emit()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>

          <div class="icon-wrap" aria-hidden="true">
            <div class="icon-disc">
              <svg viewBox="0 0 24 24">
                <path d="M12 3v10" />
                <path d="m16 9-4 4-4-4" />
                <path d="M4 17v2h16v-2" />
              </svg>
            </div>
          </div>

          <h2 id="logout-modal-title">{{ title }}</h2>
          <p>{{ description }}</p>

          <div class="actions">
            <button
              type="button"
              class="secondary-button"
              [disabled]="loading"
              (click)="stay.emit()"
            >
              {{ stayLabel }}
            </button>
            <button
              type="button"
              class="primary-button"
              [disabled]="loading"
              (click)="confirm.emit()"
            >
              {{ loading ? loadingLabel : confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(42, 39, 32, 0.22);
        backdrop-filter: blur(4px);
      }

      .modal-card {
        position: relative;
        z-index: 1;
        width: min(100%, 30rem);
        border-radius: 1.8rem;
        background: #fcfbf7;
        border: 1px solid rgba(230, 224, 209, 0.95);
        box-shadow: 0 28px 58px rgba(78, 71, 57, 0.18);
        padding: 2rem 1.9rem 1.5rem;
        text-align: center;
      }

      .dismiss-button {
        position: absolute;
        top: 0.85rem;
        right: 0.85rem;
        width: 2rem;
        height: 2rem;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #7d7767;
        cursor: pointer;
      }

      .dismiss-button svg {
        width: 100%;
        height: 100%;
        display: block;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
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

      h2 {
        margin: 0;
        color: #1f2420;
        font-size: clamp(1.8rem, 3.2vw, 2.4rem);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }

      p {
        margin: 0.95rem auto 0;
        max-width: 22rem;
        color: #5e6159;
        font-size: 1rem;
        line-height: 1.45;
      }

      .actions {
        margin-top: 1.5rem;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.7rem;
      }

      .primary-button,
      .secondary-button {
        border: 0;
        border-radius: 999px;
        min-height: 2.8rem;
        padding: 0 0.9rem;
        font-size: 0.96rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        cursor: pointer;
      }

      .primary-button {
        background: #2b7f57;
        color: #f5faf4;
        box-shadow: 0 10px 22px rgba(43, 127, 87, 0.28);
      }

      .secondary-button {
        background: #ece9df;
        color: #4f5149;
      }

      .primary-button:disabled,
      .secondary-button:disabled {
        opacity: 0.75;
        cursor: default;
      }

      @media (max-width: 540px) {
        .modal-card {
          padding: 1.6rem 1.2rem 1.2rem;
          border-radius: 1.3rem;
        }
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
