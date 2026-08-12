import {
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import { PasswordTrialComponent } from './password-trial.component';
import { StrengthMeterComponent } from '../../shared/ui/strength-meter/strength-meter.component';
import { passwordPolicyMessage } from './password-policy';
import { AuthStateService } from '../../core/services/auth-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, PasswordTrialComponent, StrengthMeterComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnDestroy {
  protected readonly faEnvelope = faEnvelope;
  protected readonly faLock = faLock;
  isLogin = signal(true);
  email = signal('');
  password = signal('');
  name = signal('');
  nameTouched = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  loading = signal(false);
  error = signal('');
  remainingAttempts = signal<number | null>(null);
  retryAfterSeconds = signal<number | null>(null);
  /** Email-first signup state: email submitted → check-your-inbox screen. */
  emailSubmitted = signal(false);
  /** Hidden honeypot field — bots fill it, humans never see it. */
  website = signal('');
  /** The placeholder password used for the unverified signup, kept so the user
   *  can set a real password after verification (changePassword needs it). */
  placeholderPassword = signal('');
  protected locked = computed(() => (this.retryAfterSeconds() ?? 0) > 0);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private authState = inject(AuthStateService);
  private router = inject(Router);

  constructor() {}

  /** Whether the signup form should collect a password (false when email
   *  verification is required — email-first flow). */
  protected get emailFirstSignup(): boolean {
    return !this.isLogin() && this.authState.requireEmailVerification();
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  /** Resend the verification email from the check-your-inbox screen. */
  async resendVerification() {
    this.error.set('');
    try {
      await this.authState.sendVerificationEmail(this.email().trim());
      this.error.set('Verification email resent. Check your inbox.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resend the email.';
      this.error.set(message);
    }
  }

  ngOnDestroy() {
    this.clearCountdown();
  }

  toggleMode() {
    this.isLogin.set(!this.isLogin());
    this.error.set('');
    this.resetTrialState();
    this.resetTouched();
  }

  private resetTrialState() {
    this.remainingAttempts.set(null);
    this.retryAfterSeconds.set(null);
    this.clearCountdown();
  }

  private clearCountdown() {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private startCountdown() {
    this.clearCountdown();
    this.countdownInterval = setInterval(() => {
      const current = this.retryAfterSeconds();
      if (current === null || current <= 1) {
        this.resetTrialState();
        return;
      }
      this.retryAfterSeconds.set(current - 1);
    }, 1000);
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

    // Email-first signup collects no password.
    if (this.emailFirstSignup) {
      return null;
    }

    if (!password) {
      return 'Password is required';
    }
    if (!this.isLogin()) {
      return passwordPolicyMessage(password);
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

  /** Generate the throwaway placeholder password (email + 5 random letters). */
  private generatePlaceholderPassword(email: string): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += letters[Math.floor(Math.random() * letters.length)];
    }
    // email is always >= 8 chars; truncate to stay under Better Auth's max.
    return `${email}${suffix}`.slice(0, 128);
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
      } else if (this.emailFirstSignup) {
        const placeholder = this.generatePlaceholderPassword(this.email().trim());
        this.placeholderPassword.set(placeholder);
        res = await this.authState.signUp(
          this.email().trim(),
          placeholder,
          this.name().trim(),
          this.website(),
        );
        if (res.error) {
          this.error.set(res.error.message || 'Authentication failed');
          return;
        }
        // Email-first: never auto-login; show the check-your-inbox screen only
        // on success (including the honeypot fake-success).
        this.emailSubmitted.set(true);
        return;
      } else {
        res = await this.authState.signUp(
          this.email().trim(),
          this.password(),
          this.name().trim(),
          this.website(),
        );
      }

      if (res.error) {
        this.password.set('');
        this.error.set(res.error.message || 'Authentication failed');
        const errorBody = res.error as Record<string, unknown>;
        if (typeof errorBody['remainingAttempts'] === 'number') {
          this.remainingAttempts.set(errorBody['remainingAttempts']);
        }
        if (
          typeof errorBody['retryAfterSeconds'] === 'number' &&
          (errorBody['retryAfterSeconds'] as number) > 0
        ) {
          this.retryAfterSeconds.set(errorBody['retryAfterSeconds'] as number);
          this.startCountdown();
        }
      } else {
        this.resetTrialState();
        const redirectUrl = this.authState.getPostAuthRedirectUrl();

        if (!this.isLogin() && redirectUrl === '/onboarding') {
          this.router.navigate(['/onboarding'], { queryParams: { created: '1' } });
          return;
        }

        this.router.navigateByUrl(redirectUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
