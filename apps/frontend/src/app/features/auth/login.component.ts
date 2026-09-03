import {
  Component,
  OnDestroy,
  OnInit,
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
import { isLocalhostHostname } from '../../shared/utils/hostname';
import { passwordPolicyMessage } from './password-policy';
import { AuthStateService } from '../../core/services/auth-state.service';
import { LegalContentService } from '../../core/services/legal-content.service';
import { BetaTermsNoticeComponent } from './beta-terms-notice.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    FontAwesomeModule,
    PasswordTrialComponent,
    StrengthMeterComponent,
    BetaTermsNoticeComponent,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
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
  alreadySignedIn = signal(false);
  /** Beta ToS agreement — required on signup only when legal content is configured. */
  termsAccepted = signal(false);
  termsTouched = signal(false);
  /** Hidden honeypot field — bots fill it, humans never see it. */
  website = signal('');
  /** The placeholder password used for the unverified signup, kept so the user
   *  can set a real password after verification (changePassword needs it). */
  placeholderPassword = signal('');
  protected locked = computed(() => (this.retryAfterSeconds() ?? 0) > 0);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private redirectTimeout: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  protected readonly legalContent = inject(LegalContentService);
  private authState = inject(AuthStateService);
  private router = inject(Router);

  ngOnInit() {
    void this.legalContent.load();

    const handleAuthState = () => {
      if (this.destroyed || !this.authState.isAuthenticated()) {
        return;
      }

      this.alreadySignedIn.set(true);
      this.redirectTimeout = setTimeout(() => {
        void this.router.navigateByUrl(this.authState.getPostAuthRedirectUrl());
      }, 3000);
    };

    if (this.authState.initialized()) {
      handleAuthState();
      return;
    }

    void this.authState.initialize().then(handleAuthState);
  }

  /** Whether the signup form should collect a password (false when email
   *  verification is required — email-first flow). */
  protected get emailFirstSignup(): boolean {
    return !this.isLogin() && this.authState.requireEmailVerification();
  }

  /**
   * Dev-mode badge: only when the server reports dev mode AND the app is
   * served from localhost — a test deployment running dev mode must not
   * advertise it on screen.
   */
  protected readonly showDevBadge = computed(() => {
    return this.authState.devMode() && isLocalhostHostname(window.location.hostname);
  });

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
    this.destroyed = true;
    this.clearCountdown();
    if (this.redirectTimeout !== null) {
      clearTimeout(this.redirectTimeout);
      this.redirectTimeout = null;
    }
  }

  toggleMode() {
    this.isLogin.set(!this.isLogin());
    this.error.set('');
    this.termsAccepted.set(false);
    this.termsTouched.set(false);
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

  markTouched(field: 'name' | 'email' | 'password' | 'terms') {
    if (field === 'name') {
      this.nameTouched.set(true);
      return;
    }
    if (field === 'email') {
      this.emailTouched.set(true);
      return;
    }
    if (field === 'terms') {
      this.termsTouched.set(true);
      return;
    }
    this.passwordTouched.set(true);
  }

  private markAllTouched() {
    this.nameTouched.set(true);
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
    this.termsTouched.set(true);
  }

  private resetTouched() {
    this.nameTouched.set(false);
    this.emailTouched.set(false);
    this.passwordTouched.set(false);
    this.termsTouched.set(false);
  }

  /** Whether the signup form must collect Beta ToS agreement. */
  protected get termsRequired(): boolean {
    return !this.isLogin() && this.legalContent.configured();
  }

  getFieldError(field: 'name' | 'email' | 'password' | 'terms'): string | null {
    const email = this.email().trim();
    const password = this.password();
    const name = this.name().trim();

    if (field === 'terms') {
      if (this.termsRequired && !this.termsAccepted()) {
        return 'Please accept the Beta Terms of Service';
      }
      return null;
    }

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

  shouldShowFieldError(field: 'name' | 'email' | 'password' | 'terms'): boolean {
    if (field === 'terms') {
      return this.termsTouched() && !!this.getFieldError('terms');
    }
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
      this.getFieldError('name') ||
      this.getFieldError('email') ||
      this.getFieldError('password') ||
      this.getFieldError('terms')
    );
  }

  /** Generate a cryptographically random throwaway password. */
  private generatePlaceholderPassword(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async onSubmit() {
    // The runtime config decides whether signup is email-first. If it has not
    // landed yet, wait for the in-flight initialization once — the login form
    // renders before it, but a submission must never use a stale form flow.
    if (!this.authState.configLoaded()) {
      await this.authState.initialize();
    }

    if (!this.authState.configLoaded()) {
      return;
    }

    if (this.alreadySignedIn()) {
      return;
    }

    // The Beta ToS gate depends on a separate async load — wait for its
    // decision so a fast submit cannot bypass agreement while it is pending.
    await this.legalContent.load();

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
        const placeholder = this.generatePlaceholderPassword();
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
