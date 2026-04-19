import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../core/services/auth-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
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
