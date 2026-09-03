import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelope, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { AuthStateService } from '../../core/services/auth-state.service';
import { isLocalhostHostname } from '../../shared/utils/hostname';
import { AuthService } from '@yotara/shared';

@Component({
  selector: 'app-forgot-password',
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

        @if (emailSent()) {
          @if (showDevResetLink() && devResetUrl()) {
            <h1>Reset link ready</h1>
            <p class="subtitle">Dev mode — here's your reset link (expires in 15 minutes):</p>
            <a class="dev-reset-link" [href]="devResetUrl()">{{ devResetUrl() }}</a>
            <button type="button" class="submit-button" (click)="goToResetWithLink()">
              Reset password now
            </button>
          } @else {
            <h1>Check your email</h1>
            <p class="subtitle">
              If an account exists for <strong>{{ submittedEmail() }}</strong
              >, we've sent a password reset link. It will expire in 1 hour.
            </p>
          }

          <button type="button" class="submit-button secondary" (click)="backToForm()">
            Send again
          </button>
        } @else {
          <h1>Reset your password</h1>
          <p class="subtitle">
            Enter the email address associated with your account and we'll send you a reset link.
          </p>

          <form (ngSubmit)="onSubmit()">
            <div class="field-group">
              <label for="email">Email</label>
              <div class="input-wrap" [class.input-wrap-invalid]="!!error()">
                <fa-icon class="input-icon" [icon]="faEnvelope" aria-hidden="true"></fa-icon>
                <input
                  id="email"
                  type="email"
                  [ngModel]="email()"
                  (ngModelChange)="email.set($event)"
                  name="email"
                  placeholder="your@email.com"
                  autocomplete="email"
                  required
                />
              </div>
              @if (error()) {
                <div class="field-error">{{ error() }}</div>
              }
            </div>

            <button type="submit" [disabled]="loading()" class="submit-button">
              {{ loading() ? 'Sending...' : 'Send reset link' }}
            </button>
          </form>
        }

        <div class="divider"></div>
        <p class="toggle-mode">
          <button type="button" class="link-button accent-link" (click)="goBack()">
            <fa-icon [icon]="faArrowLeft" aria-hidden="true"></fa-icon>
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.component.scss', './forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  protected readonly faEnvelope = faEnvelope;
  protected readonly faArrowLeft = faArrowLeft;
  email = signal('');
  submittedEmail = signal('');
  loading = signal(false);
  error = signal('');
  emailSent = signal(false);
  devResetUrl = signal('');

  private router = inject(Router);
  private authState = inject(AuthStateService);

  /** Dev reset links show only when the viewer is on localhost — a remote
   *  test deployment running dev mode must not fetch or display them. */
  protected readonly showDevResetLink = computed(
    () =>
      this.authState.devMode() &&
      typeof window !== 'undefined' &&
      isLocalhostHostname(window.location.hostname),
  );

  backToForm() {
    this.emailSent.set(false);
    this.devResetUrl.set('');
    this.error.set('');
  }

  goBack() {
    this.router.navigate(['/login']);
  }

  goToResetWithLink() {
    const url = this.devResetUrl();
    if (url) {
      const token = new URL(url).searchParams.get('token');
      if (token) {
        this.router.navigate(['/reset-password'], { queryParams: { token } });
      }
    }
  }

  async onSubmit() {
    const email = this.email().trim();
    if (!email) {
      this.error.set('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Enter a valid email address');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    let resetRequested = false;

    try {
      await this.authState.forgotPassword(email);
      resetRequested = true;
      this.submittedEmail.set(email);
      this.emailSent.set(true);
    } catch (_err) {
      // Don't reveal whether the email exists — show generic success even on error
      this.submittedEmail.set(email);
      this.emailSent.set(true);
    } finally {
      this.loading.set(false);
    }

    // In dev mode, fetch the reset link so it can be shown directly on screen.
    if (resetRequested && this.showDevResetLink() && this.emailSent()) {
      const url = await AuthService.getDevResetLink(email);
      if (url) {
        this.devResetUrl.set(url);
      }
    }
  }
}
