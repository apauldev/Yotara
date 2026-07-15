import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-delete-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      [open]="open"
      [title]="title()"
      [description]="description()"
      [confirmLabel]="confirmLabel()"
      [cancelLabel]="cancelLabel()"
      [loading]="loading()"
      [loadingLabel]="'Deleting...'"
      [danger]="true"
      size="md"
      (confirm)="onConfirm()"
      (cancel)="onCancel()"
      (close)="onClose()"
    >
      <div confirm-icon class="icon-wrap" aria-hidden="true">
        <div class="icon-disc">
          <fa-icon [icon]="faTrash"></fa-icon>
        </div>
      </div>

      <div confirm-extra>
        @if (step() === 'confirm') {
          <div class="data-summary">
            <p class="data-summary-text">This will permanently delete:</p>
            <div class="data-counts">
              @if (taskCount > 0) {
                <span class="data-count">
                  <strong>{{ taskCount }}</strong> {{ taskCount === 1 ? 'task' : 'tasks' }}
                </span>
              }
              @if (projectCount > 0) {
                <span class="data-count">
                  <strong>{{ projectCount }}</strong>
                  {{ projectCount === 1 ? 'project' : 'projects' }}
                </span>
              }
              @if (labelCount > 0) {
                <span class="data-count">
                  <strong>{{ labelCount }}</strong>
                  {{ labelCount === 1 ? 'label' : 'labels' }}
                </span>
              }
            </div>
          </div>
        } @else {
          <form class="verify-form" (submit)="onDelete($event)">
            @if (error()) {
              <div class="error-banner" role="alert">{{ error() }}</div>
            }

            <label class="field" for="delete-account-email">
              <span class="field-label">Type your email to confirm</span>
              <input
                #emailInput
                id="delete-account-email"
                type="email"
                [ngModel]="emailInputValue()"
                (ngModelChange)="emailInputValue.set($event)"
                name="delete-email"
                autocomplete="new-password"
                required
                [placeholder]="userEmail"
              />
              @if (emailInputValue() && emailInputValue() !== userEmail) {
                <span class="field-error">Email does not match your account</span>
              }
            </label>

            <label class="field" for="delete-account-password">
              <span class="field-label">Enter your password</span>
              <input
                id="delete-account-password"
                type="password"
                [ngModel]="passwordInputValue()"
                (ngModelChange)="passwordInputValue.set($event)"
                name="delete-password"
                autocomplete="new-password"
                required
                placeholder="••••••••"
              />
            </label>
          </form>
        }
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
        background: color-mix(in srgb, var(--status-overdue) 12%, var(--surface-container-low));
        display: grid;
        place-items: center;
        color: var(--status-overdue);
        font-size: 1.6rem;
      }

      .data-summary {
        text-align: center;
      }

      .data-summary-text {
        margin: 0 0 0.75rem;
        color: var(--on-surface-muted);
        font-size: 0.9rem;
      }

      .data-counts {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .data-count {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--status-overdue) 10%, var(--surface-container-high));
        color: var(--on-surface);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .data-count strong {
        color: var(--error-solid);
      }

      .verify-form {
        display: grid;
        gap: 1rem;
        text-align: left;
      }

      .error-banner {
        padding: 0.75rem 1rem;
        background: var(--error-soft);
        color: var(--error-solid);
        border-radius: 0.75rem;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .field {
        display: grid;
        gap: 0.45rem;
      }

      .field-label {
        color: var(--on-surface-subtle);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        font-weight: 800;
      }

      .field-error {
        color: var(--error-solid);
        font-size: 0.8rem;
        font-weight: 600;
      }

      input {
        min-height: 3rem;
        border: 0;
        border-radius: 1rem;
        background: var(--input);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 0 1.15rem;
        font: inherit;
        color: var(--on-surface);
        transition: all 0.2s ease;
      }

      input:focus {
        outline: none;
        box-shadow: inset 0 0 0 2px var(--primary-solid);
      }

      input::placeholder {
        color: var(--on-surface-subtle);
      }
    `,
  ],
})
export class DeleteAccountModalComponent {
  protected readonly faTrash = faTrash;
  private readonly authState = inject(AuthStateService);

  @Input() open = false;
  @Input() taskCount = 0;
  @Input() projectCount = 0;
  @Input() labelCount = 0;
  @Input() userEmail = '';
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly deleted = new EventEmitter<void>();

  protected readonly step = signal<'confirm' | 'verify'>('confirm');
  protected readonly emailInputValue = signal('');
  protected readonly passwordInputValue = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly loading = this.authState.loading;

  protected readonly title = computed(() =>
    this.step() === 'confirm' ? 'Delete your account?' : 'Confirm deletion',
  );

  protected readonly description = computed(() =>
    this.step() === 'confirm'
      ? 'This action is permanent and unrecoverable. There is no undo.'
      : 'Type your email and password to permanently delete your account and all data.',
  );

  protected readonly confirmLabel = computed(() =>
    this.step() === 'confirm' ? 'I understand, continue' : 'Delete my account',
  );

  protected readonly cancelLabel = computed(() => (this.step() === 'confirm' ? 'Cancel' : 'Back'));

  protected get emailMatches(): boolean {
    return this.emailInputValue().toLowerCase() === this.userEmail.toLowerCase();
  }

  protected get canDelete(): boolean {
    return this.emailMatches && this.passwordInputValue().length > 0 && !this.loading();
  }

  protected onConfirm() {
    if (this.step() === 'confirm') {
      this.step.set('verify');
      this.error.set(null);
    } else {
      this.onSubmit();
    }
  }

  protected onCancel() {
    if (this.step() === 'verify') {
      this.step.set('confirm');
      this.reset();
    } else {
      this.onClose();
    }
  }

  protected onClose() {
    if (this.loading()) return;
    this.reset();
    this.close.emit();
  }

  protected async onDelete(event: Event) {
    event.preventDefault();
    if (!this.canDelete) return;
    this.onSubmit();
  }

  private async onSubmit() {
    if (!this.canDelete) return;

    this.error.set(null);

    try {
      await this.authState.deleteAccount(this.passwordInputValue());
      this.deleted.emit();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      this.error.set(
        /too many requests|rate limit/i.test(message)
          ? 'Too many attempts. Please wait a few minutes before trying again.'
          : message,
      );
      this.passwordInputValue.set('');
    }
  }

  private reset() {
    this.emailInputValue.set('');
    this.passwordInputValue.set('');
    this.error.set(null);
    this.step.set('confirm');
  }
}
