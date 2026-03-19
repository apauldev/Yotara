import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../core/services/auth-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-screen">
      <div class="auth-card">
        <div class="hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M20 4C11 4 4 10.3 4 18c0 .9.1 1.8.4 2.6A9.8 9.8 0 0 0 12 24c6.6 0 12-5.4 12-12V4h-4Z"
            />
            <path
              class="hero-vein"
              d="M7.5 16.8a1 1 0 1 0 1.5 1.4c1.6-1.7 4-3.4 7.4-4.5a1 1 0 1 0-.6-1.9c-3.8 1.3-6.6 3.2-8.3 5Z"
            />
          </svg>
        </div>
        <h1>{{ isLogin() ? 'Welcome to Yotara' : 'Create your Yotara account' }}</h1>
        <p class="subtitle">
          {{
            isLogin() ? 'A calm space for your tasks' : 'Set up your workspace in under a minute'
          }}
        </p>

        <form (ngSubmit)="onSubmit()">
          @if (!isLogin()) {
            <div class="field-group">
              <label for="name">Name</label>
              <div class="input-wrap" [class.input-wrap-invalid]="shouldShowFieldError('name')">
                <input
                  id="name"
                  type="text"
                  [ngModel]="name()"
                  (ngModelChange)="name.set($event)"
                  (blur)="markTouched('name')"
                  name="name"
                  placeholder="Your name"
                  autocomplete="name"
                  required
                />
              </div>
              @if (shouldShowFieldError('name')) {
                <div class="field-error">{{ getFieldError('name') }}</div>
              }
            </div>
          }

          <div class="field-group">
            <label for="email">Email</label>
            <div class="input-wrap" [class.input-wrap-invalid]="shouldShowFieldError('email')">
              <span class="input-icon" aria-hidden="true">✉</span>
              <input
                id="email"
                type="email"
                [ngModel]="email()"
                (ngModelChange)="email.set($event)"
                (blur)="markTouched('email')"
                name="email"
                placeholder="your@email.com"
                autocomplete="email"
                required
              />
            </div>
            @if (shouldShowFieldError('email')) {
              <div class="field-error">{{ getFieldError('email') }}</div>
            }
          </div>

          <div class="field-group">
            <div class="password-label">
              <label for="password">Password</label>
              @if (isLogin()) {
                <button type="button" class="link-button">Forgot password?</button>
              }
            </div>
            <div class="input-wrap" [class.input-wrap-invalid]="shouldShowFieldError('password')">
              <span class="input-icon" aria-hidden="true">🔒</span>
              <input
                id="password"
                type="password"
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                (blur)="markTouched('password')"
                name="password"
                placeholder="••••••••"
                [attr.minlength]="!isLogin() ? 8 : null"
                [attr.autocomplete]="isLogin() ? 'current-password' : 'new-password'"
                required
              />
            </div>
            @if (shouldShowFieldError('password')) {
              <div class="field-error">{{ getFieldError('password') }}</div>
            }
          </div>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }

          <button type="submit" [disabled]="loading()" class="submit-button">
            {{ loading() ? 'Loading...' : isLogin() ? 'Sign In' : 'Create account' }}
          </button>
        </form>

        <div class="divider"></div>
        <p class="toggle-mode">
          {{ isLogin() ? 'New to Yotara?' : 'Already have an account?' }}
          <button type="button" (click)="toggleMode()" class="link-button accent-link">
            {{ isLogin() ? 'Create an account' : 'Sign in' }}
          </button>
        </p>
      </div>
      <p class="footer-note">© 2024 Yotara. Designed for focused productivity.</p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .login-screen {
        min-height: 100dvh;
        background: #f4f2ea;
        padding: 1.5rem 1rem 2.25rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Avenir Next', 'Manrope', 'Segoe UI', sans-serif;
        color: #304335;
      }

      .auth-card {
        width: min(100%, 32rem);
        background: #f8f8f5;
        border: 1px solid #dbe0d8;
        border-radius: 0.9rem;
        padding: 2rem 2rem 1.7rem;
        box-shadow: 0 1px 2px rgba(31, 49, 38, 0.06);
      }

      .hero-icon {
        width: 4.75rem;
        height: 4.75rem;
        border-radius: 999px;
        background: #e6eadf;
        color: #4f986f;
        display: grid;
        place-items: center;
        margin: 0 auto 1.2rem;
      }

      .hero-icon svg {
        width: 2rem;
        height: 2rem;
        display: block;
        fill: currentColor;
      }

      .hero-vein {
        fill: #f2f4ee;
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 2.5vw, 2.25rem);
        text-align: center;
        line-height: 1.15;
        letter-spacing: -0.02em;
        color: #2f4538;
      }

      .subtitle {
        margin: 0.5rem 0 1.8rem;
        text-align: center;
        font-size: 1.05rem;
        color: #72a687;
      }

      form {
        width: 100%;
      }

      .field-group {
        margin-bottom: 1rem;
      }

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 1.05rem;
        font-weight: 600;
        color: #314034;
      }

      .password-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }

      .input-wrap {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        border: 1px solid #cfd8ce;
        border-radius: 0.55rem;
        background: #f8faf7;
        padding: 0 0.85rem;
        min-height: 3.25rem;
      }

      .input-wrap-invalid {
        border-color: #cb6565;
        box-shadow: 0 0 0 1px rgba(203, 101, 101, 0.2);
      }

      .input-icon {
        color: #a5b7a8;
        font-size: 1rem;
        line-height: 1;
      }

      input {
        border: 0;
        outline: none;
        width: 100%;
        background: transparent;
        font-size: 1rem;
        color: #314034;
        padding: 0.85rem 0;
      }

      input::placeholder {
        color: #b2c3b5;
      }

      .submit-button {
        width: 100%;
        margin-top: 1rem;
        border: 0;
        border-radius: 0.55rem;
        background: #4f986f;
        color: #f3f7f2;
        min-height: 3.6rem;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 14px rgba(55, 116, 84, 0.2);
      }

      .submit-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .error-msg {
        margin-top: 0.4rem;
        color: #b13a3a;
        font-size: 0.88rem;
      }

      .field-error {
        margin-top: 0.4rem;
        color: #b13a3a;
        font-size: 0.85rem;
      }

      .divider {
        margin: 1.8rem 0 1rem;
        border-top: 1px solid #dbe0d8;
      }

      .toggle-mode {
        margin: 0;
        font-size: 0.95rem;
        color: #8c9a8d;
        text-align: center;
      }

      .link-button {
        border: 0;
        background: transparent;
        color: #4f986f;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        padding: 0;
        line-height: 1.2;
      }

      .accent-link {
        font-size: 0.95rem;
        font-weight: 700;
        margin-left: 0.15rem;
      }

      .footer-note {
        margin: 1.3rem 0 0;
        color: #bfd3c0;
        font-size: 0.72rem;
        text-align: center;
      }

      @media (max-width: 640px) {
        .login-screen {
          justify-content: flex-start;
          padding-top: 1rem;
        }

        .auth-card {
          padding: 1.45rem 1rem 1.2rem;
        }

        h1 {
          font-size: 1.75rem;
        }

        .subtitle {
          font-size: 0.98rem;
        }

        label {
          font-size: 0.98rem;
        }

        .accent-link {
          margin-left: 0.2rem;
        }
      }
    `,
  ],
})
export class LoginComponent {
  isLogin = signal(true);
  email = signal('');
  password = signal('');
  name = signal('');
  nameTouched = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(
    private router: Router,
    private authState: AuthStateService,
  ) {}

  toggleMode() {
    this.isLogin.set(!this.isLogin());
    this.error.set('');
    this.resetTouched();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  markTouched(field: 'name' | 'email' | 'password') {
    if (field === 'name') {
      this.nameTouched.set(true);
      return;
    }
    if (field === 'email') {
      this.emailTouched.set(true);
      return;
    }
    this.passwordTouched.set(true);
  }

  private markAllTouched() {
    this.nameTouched.set(true);
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
  }

  private resetTouched() {
    this.nameTouched.set(false);
    this.emailTouched.set(false);
    this.passwordTouched.set(false);
  }

  getFieldError(field: 'name' | 'email' | 'password'): string | null {
    const email = this.email().trim();
    const password = this.password();
    const name = this.name().trim();

    if (field === 'name') {
      if (!this.isLogin() && !name) {
        return 'Name is required';
      }
      return null;
    }

    if (field === 'email') {
      if (!email) {
        return 'Email is required';
      }
      if (!this.isValidEmail(email)) {
        return 'Enter a valid email address';
      }
      return null;
    }

    if (!password) {
      return 'Password is required';
    }
    if (!this.isLogin() && password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  shouldShowFieldError(field: 'name' | 'email' | 'password'): boolean {
    const isTouched =
      field === 'name'
        ? this.nameTouched()
        : field === 'email'
          ? this.emailTouched()
          : this.passwordTouched();

    return isTouched && !!this.getFieldError(field);
  }

  private validateForm(): string | null {
    return (
      this.getFieldError('name') || this.getFieldError('email') || this.getFieldError('password')
    );
  }

  async onSubmit() {
    this.markAllTouched();
    this.error.set('');

    const validationError = this.validateForm();
    if (validationError) {
      return;
    }

    this.loading.set(true);

    try {
      let res;
      if (this.isLogin()) {
        res = await this.authState.signIn(this.email().trim(), this.password());
      } else {
        res = await this.authState.signUp(this.email().trim(), this.password(), this.name().trim());
      }

      if (res.error) {
        this.error.set(res.error.message || 'Authentication failed');
      } else {
        const redirectUrl = this.authState.getPostAuthRedirectUrl();

        if (!this.isLogin() && redirectUrl === '/onboarding') {
          this.router.navigate(['/onboarding'], { queryParams: { created: '1' } });
          return;
        }

        this.router.navigateByUrl(redirectUrl);
      }
    } catch (err: any) {
      this.error.set(err.message || 'An unexpected error occurred');
    } finally {
      this.loading.set(false);
    }
  }
}
