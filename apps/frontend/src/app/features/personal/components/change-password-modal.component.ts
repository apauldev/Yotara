import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <app-modal [open]="open" title="Change Password" size="md" (close)="onClose()">
      <form class="password-form" (submit)="onSubmit($event)">
        <p class="form-description">Update your account password to keep your sanctuary secure.</p>

        @if (error()) {
          <div class="error-banner">
            {{ error() }}
          </div>
        }

        @if (success()) {
          <div class="success-banner">Password updated successfully.</div>
        }

        <label class="field">
          <span class="field-label">Current Password</span>
          <input
            type="password"
            [ngModel]="currentPassword()"
            (ngModelChange)="currentPassword.set($event)"
            name="currentPassword"
            required
            placeholder="••••••••"
          />
        </label>

        <div class="field">
          <label class="field-label" for="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            [ngModel]="newPassword()"
            (ngModelChange)="newPassword.set($event)"
            name="newPassword"
            required
            placeholder="••••••••"
          />

          @if (newPassword()) {
            <div class="strength-meter">
              <div
                class="strength-bar"
                [style.width.%]="strength().percent"
                [ngClass]="strength().class"
              ></div>
            </div>
            <div class="strength-label">
              Strength: <span [ngClass]="strength().class">{{ strength().label }}</span>
            </div>
            <div class="requirements">
              <span [class.met]="hasMinLength()">8+ chars</span>
              <span [class.met]="hasCapital()">Capital</span>
              <span [class.met]="hasLower()">Lowercase</span>
              <span [class.met]="hasNumber()">Number</span>
              <span [class.met]="hasSymbol()">Symbol</span>
            </div>
          }
        </div>

        <div class="field">
          <label class="field-label" for="confirm-password">Confirm New Password</label>
          <input
            id="confirm-password"
            type="password"
            [ngModel]="confirmPassword()"
            (ngModelChange)="confirmPassword.set($event)"
            name="confirmPassword"
            required
            placeholder="••••••••"
            [class.input-error]="confirmPassword() && !passwordsMatch()"
          />
          @if (confirmPassword() && !passwordsMatch()) {
            <span class="error-text">Passwords do not match</span>
          }
        </div>

        <div class="form-actions">
          <button type="button" class="secondary-button" (click)="onClose()">Cancel</button>
          <button
            type="submit"
            class="primary-button"
            [disabled]="loading() || success() || !isFormValid()"
          >
            {{ loading() ? 'Updating...' : 'Change Password' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .password-form {
        padding: 1.5rem;
        display: grid;
        gap: 1.5rem;
      }

      .form-description {
        margin: 0;
        color: var(--on-surface-muted);
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .error-banner {
        padding: 0.75rem 1rem;
        background: var(--error-soft);
        color: var(--error-solid);
        border-radius: 0.75rem;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .success-banner {
        padding: 0.75rem 1rem;
        background: var(--primary-soft);
        color: var(--primary-solid);
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

      input {
        min-height: 3.25rem;
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

      .input-error {
        box-shadow: inset 0 0 0 1px var(--error-solid) !important;
      }

      .error-text {
        color: var(--error-solid);
        font-size: 0.8rem;
        font-weight: 600;
        padding-left: 0.5rem;
      }

      .strength-meter {
        height: 4px;
        background: var(--surface-container-high);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 0.25rem;
      }

      .strength-bar {
        height: 100%;
        transition: all 0.3s ease;
      }

      .strength-weak {
        background: var(--error-solid);
      }
      .strength-medium {
        background: #f1c582;
      }
      .strength-good {
        background: #8dd0d6;
      }
      .strength-strong {
        background: var(--primary-solid);
      }

      .strength-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--on-surface-muted);
        margin-top: 0.25rem;
        padding-left: 0.25rem;
      }

      .strength-label span {
        transition: color 0.2s ease;
      }

      .strength-label .strength-weak {
        background: transparent;
        color: var(--error-solid);
      }
      .strength-label .strength-medium {
        background: transparent;
        color: #f1c582;
      }
      .strength-label .strength-good {
        background: transparent;
        color: #2c7680;
      }
      .strength-label .strength-strong {
        background: transparent;
        color: var(--primary-solid);
      }

      .requirements {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--on-surface-muted);
        padding-left: 0.25rem;
      }

      .requirements .met {
        color: var(--primary-solid);
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.85rem;
        margin-top: 0.5rem;
      }

      @media (max-width: 640px) {
        .password-form {
          padding: 1.25rem 1rem 2rem;
        }

        .form-actions {
          flex-direction: column-reverse;
          gap: 0.75rem;
        }

        .primary-button,
        .secondary-button {
          width: 100%;
        }
      }

      .primary-button,
      .secondary-button {
        min-height: 3rem;
        border: 0;
        border-radius: 1rem;
        padding: 0 1.5rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.95rem;
        transition: all 0.2s ease;
      }

      .primary-button {
        background: var(--primary-action-gradient);
        color: hsl(var(--primary-foreground));
      }

      .primary-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px var(--primary-soft);
      }

      .primary-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .secondary-button {
        background: var(--surface-container-high);
        color: var(--on-surface-muted);
      }

      .secondary-button:hover {
        background: var(--surface-container-highest);
        color: var(--on-surface);
      }
    `,
  ],
})
export class ChangePasswordModalComponent {
  private readonly authState = inject(AuthStateService);

  @Input() open = false;
  @Output() readonly close = new EventEmitter<void>();

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly loading = this.authState.loading;

  protected readonly hasMinLength = computed(() => this.newPassword().length >= 8);
  protected readonly hasCapital = computed(() => /[A-Z]/.test(this.newPassword()));
  protected readonly hasLower = computed(() => /[a-z]/.test(this.newPassword()));
  protected readonly hasNumber = computed(() => /[0-9]/.test(this.newPassword()));
  protected readonly hasSymbol = computed(() => /[^A-Za-z0-9]/.test(this.newPassword()));
  protected readonly passwordsMatch = computed(() => this.newPassword() === this.confirmPassword());

  protected readonly strength = computed(() => {
    const p = this.newPassword();
    if (!p) return { percent: 0, class: '', label: '' };

    let score = 0;
    if (this.hasMinLength()) score++;
    if (this.hasCapital()) score++;
    if (this.hasLower()) score++;
    if (this.hasNumber()) score++;
    if (this.hasSymbol()) score++;
    if (p.length >= 12) score++;

    const percent = Math.min((score / 5) * 100, 100);
    let className = 'strength-weak';
    let label = 'Weak';

    if (score >= 5) {
      className = 'strength-strong';
      label = 'Strong';
    } else if (score >= 4) {
      className = 'strength-good';
      label = 'Good';
    } else if (score >= 2) {
      className = 'strength-medium';
      label = 'Fair';
    }

    return { percent, class: className, label };
  });

  protected readonly isFormValid = computed(() => {
    return (
      this.currentPassword().length > 0 &&
      this.hasMinLength() &&
      this.hasCapital() &&
      this.hasLower() &&
      this.hasNumber() &&
      this.hasSymbol() &&
      this.passwordsMatch()
    );
  });

  protected onClose() {
    if (this.loading()) return;
    this.reset();
    this.close.emit();
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.isFormValid()) return;

    this.error.set(null);

    try {
      const result = await this.authState.changePassword(
        this.currentPassword(),
        this.newPassword(),
      );

      if (result.error) {
        this.error.set(result.error.message || 'Failed to change password.');
      } else {
        this.success.set(true);
        setTimeout(() => this.onClose(), 2000);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      this.error.set(message);
    }
  }

  private reset() {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.error.set(null);
    this.success.set(false);
  }
}
