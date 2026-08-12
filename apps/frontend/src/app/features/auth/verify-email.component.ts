import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../core/services/auth-state.service';
import { StatusService } from '../../core/services/status.service';
import { passwordPolicyMessage } from './password-policy';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="verify-screen">
      <div class="auth-card">
        <h1>Verify your email</h1>

        @if (state() === 'verifying') {
          <p>Verifying your email…</p>
        }

        @if (state() === 'invalid') {
          <p class="error-msg">{{ error() }}</p>
          <button type="button" class="submit-button" (click)="goToLogin()">Back to login</button>
        }

        @if (state() === 'set-password') {
          <p class="success-msg">Your email is verified. Choose a password to finish setup.</p>

          <div class="field-group">
            <label for="new-password">Password</label>
            <input
              id="new-password"
              type="password"
              [(ngModel)]="newPassword"
              name="newPassword"
              placeholder="At least 8 characters"
              autocomplete="new-password"
            />
            @if (passwordError()) {
              <div class="field-error">{{ passwordError() }}</div>
            }
          </div>

          <button
            type="button"
            class="submit-button"
            [disabled]="loading()"
            (click)="setPassword()"
          >
            {{ loading() ? 'Saving…' : 'Set password and continue' }}
          </button>
          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
        }

        @if (state() === 'done') {
          <p class="success-msg">Your email is verified. Taking you to your workspace…</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .verify-screen {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface);
      }
      .auth-card {
        max-width: 400px;
        width: 100%;
        padding: 2rem;
        border-radius: 12px;
        background: var(--surface-container);
        box-shadow: 0 8px 30px var(--outline-variant);
      }
      h1 {
        margin: 0 0 1rem;
        font-size: 1.5rem;
      }
      p {
        margin: 0 0 1rem;
        color: var(--on-surface-subtle);
        line-height: 1.5;
      }
      .success-msg {
        color: var(--primary-solid);
        font-weight: 500;
      }
      .error-msg {
        color: var(--status-overdue);
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-bottom: 1rem;
      }
      input {
        padding: 0.65rem 0.8rem;
        border: 1px solid var(--outline-variant);
        border-radius: 8px;
        background: var(--surface);
        color: var(--on-surface);
        font-size: 0.95rem;
      }
      .field-error {
        color: var(--status-overdue);
        font-size: 0.85rem;
      }
      .submit-button {
        width: 100%;
        padding: 0.7rem;
        border: 0;
        border-radius: 8px;
        background: var(--primary-solid);
        color: var(--on-primary);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      }
      .submit-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private status = inject(StatusService);

  state = signal<'verifying' | 'invalid' | 'set-password' | 'done'>('verifying');
  error = signal('');
  loading = signal(false);
  newPassword = '';
  private token = '';

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.state.set('invalid');
      this.error.set('Missing verification token. The link may be malformed.');
      return;
    }

    const result = await this.authState.verifyEmail(this.token);
    if (result.error) {
      this.state.set('invalid');
      this.error.set(
        (result.error as { message?: string })?.message ??
          'This verification link is invalid or expired.',
      );
      return;
    }

    this.state.set('set-password');
  }

  passwordError(): string | null {
    if (!this.newPassword) {
      return 'Password is required';
    }
    return passwordPolicyMessage(this.newPassword);
  }

  async setPassword() {
    const validation = this.passwordError();
    if (validation) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      // The account was created with a throwaway placeholder password that the
      // user never knows; the server sets the real one (verified session).
      await this.authState.setPassword(this.newPassword);
      this.state.set('done');
      this.status.success('Your email is verified.');
      await this.router.navigate(['/onboarding']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to set password.');
    } finally {
      this.loading.set(false);
    }
  }

  goToLogin() {
    void this.router.navigate(['/login']);
  }
}
