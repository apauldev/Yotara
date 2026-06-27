import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faLock, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { AuthStateService } from '../../core/services/auth-state.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <div class="login-screen">
      <div class="auth-card">
        <div class="hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              class="hero-leaf"
              d="M20 4C11 4 4 10.3 4 18c0 .9.1 1.8.4 2.6A9.8 9.8 0 0 0 12 24c6.6 0 12-5.4 12-12V4h-4Z"
            />
            <path
              class="hero-vein"
              d="M7.5 16.8a1 1 0 1 0 1.5 1.4c1.6-1.7 4-3.4 7.4-4.5a1 1 0 1 0-.6-1.9c-3.8 1.3-6.6 3.2-8.3 5Z"
            />
          </svg>
        </div>

        @if (resetSuccessful()) {
          <h1>Password updated</h1>
          <p class="subtitle">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <button type="button" class="submit-button" (click)="goToLogin()">
            <fa-icon [icon]="faArrowRight" aria-hidden="true"></fa-icon>
            Sign in
          </button>
        } @else if (invalidToken()) {
          <h1>Invalid or expired link</h1>
          <p class="subtitle">
            This password reset link is no longer valid. It may have expired or already been used.
          </p>
          <button type="button" class="submit-button" (click)="goToForgotPassword()">
            Request a new link
          </button>
        } @else {
          <h1>Set new password</h1>
          <p class="subtitle">
            Choose a new password for your account. Must be at least 8 characters.
          </p>

          <form (ngSubmit)="onSubmit()">
            <div class="field-group">
              <label for="newPassword">New password</label>
              <div class="input-wrap" [class.input-wrap-invalid]="!!error()">
                <fa-icon class="input-icon" [icon]="faLock" aria-hidden="true"></fa-icon>
                <input
                  id="newPassword"
                  type="password"
                  [ngModel]="newPassword()"
                  (ngModelChange)="newPassword.set($event)"
                  name="newPassword"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  minlength="8"
                  required
                />
              </div>
            </div>

            <div class="field-group">
              <label for="confirmPassword">Confirm password</label>
              <div class="input-wrap" [class.input-wrap-invalid]="!!error()">
                <fa-icon class="input-icon" [icon]="faLock" aria-hidden="true"></fa-icon>
                <input
                  id="confirmPassword"
                  type="password"
                  [ngModel]="confirmPassword()"
                  (ngModelChange)="confirmPassword.set($event)"
                  name="confirmPassword"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  minlength="8"
                  required
                />
              </div>
            </div>

            @if (error()) {
              <div class="error-msg">{{ error() }}</div>
            }

            @if (validationError()) {
              <div class="error-msg">{{ validationError() }}</div>
            }

            <button type="submit" [disabled]="loading()" class="submit-button">
              {{ loading() ? 'Resetting...' : 'Reset password' }}
            </button>
          </form>

          <div class="divider"></div>
          <p class="toggle-mode">
            <button type="button" class="link-button accent-link" (click)="goToLogin()">
              Back to sign in
            </button>
          </p>
        }
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss', './forgot-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  protected readonly faLock = faLock;
  protected readonly faArrowRight = faArrowRight;

  newPassword = signal('');
  confirmPassword = signal('');
  loading = signal(false);
  error = signal('');
  validationError = signal('');
  resetSuccessful = signal(false);
  invalidToken = signal(false);
  private token = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authState: AuthStateService,
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      const error = this.route.snapshot.queryParamMap.get('error');
      if (error === 'INVALID_TOKEN') {
        this.invalidToken.set(true);
      } else {
        this.error.set('No reset token found. Please request a new password reset link.');
      }
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  async onSubmit() {
    this.validationError.set('');
    this.error.set('');

    if (!this.newPassword()) {
      this.validationError.set('Password is required');
      return;
    }

    if (this.newPassword().length < 8) {
      this.validationError.set('Password must be at least 8 characters');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.validationError.set('Passwords do not match');
      return;
    }

    if (!this.token) {
      this.error.set('Reset token is missing. Please request a new link.');
      return;
    }

    this.loading.set(true);

    try {
      const result = await this.authState.resetPassword(this.newPassword(), this.token);
      if (result?.error) {
        this.error.set(
          result.error.message || 'Failed to reset password. The link may have expired.',
        );
        return;
      }
      this.resetSuccessful.set(true);
    } catch (_err) {
      this.error.set('Failed to reset password. The link may have expired.');
    } finally {
      this.loading.set(false);
    }
  }
}
