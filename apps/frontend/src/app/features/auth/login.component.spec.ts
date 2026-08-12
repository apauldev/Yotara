import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthStateService } from '../../core/services/auth-state.service';
import { Router } from '@angular/router';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };
  let authState: {
    signIn: jasmine.Spy;
    signUp: jasmine.Spy;
    getPostAuthRedirectUrl: jasmine.Spy;
    requireEmailVerification: () => boolean;
    sendVerificationEmail: jasmine.Spy;
  };

  beforeEach(async () => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
    };

    authState = {
      signIn: jasmine.createSpy('signIn').and.resolveTo({ error: null }),
      signUp: jasmine.createSpy('signUp').and.resolveTo({ error: null }),
      getPostAuthRedirectUrl: jasmine.createSpy('getPostAuthRedirectUrl').and.returnValue('/inbox'),
      requireEmailVerification: () => false,
      sendVerificationEmail: jasmine.createSpy('sendVerificationEmail').and.resolveTo(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('renders the sign in form by default', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Welcome to Yotara');
    expect(fixture.nativeElement.textContent).toContain('Sign In');
    expect(fixture.nativeElement.textContent).not.toContain('Name');
  });

  it('switches to sign up mode and shows the name field', () => {
    fixture.detectChanges();

    component.toggleMode();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create your Yotara account');
    expect(fixture.nativeElement.textContent).toContain('Name');
    expect(fixture.nativeElement.textContent).toContain('Create account');
  });

  it('blocks submission when validation fails', async () => {
    fixture.detectChanges();

    component.email.set('invalid-email');
    component.password.set('');

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address');
    expect(fixture.nativeElement.textContent).toContain('Password is required');
  });

  it('signs in and navigates to the post-auth redirect', async () => {
    fixture.detectChanges();

    component.email.set('  alex@example.com ');
    component.password.set('secret-password');

    await component.onSubmit();

    expect(authState.signIn).toHaveBeenCalledWith('alex@example.com', 'secret-password');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/inbox');
  });

  it('signs up and sends onboarding users through the created redirect', async () => {
    fixture.detectChanges();
    component.toggleMode();
    authState.getPostAuthRedirectUrl.and.returnValue('/onboarding');

    component.name.set('Alex Rivers');
    component.email.set('alex@example.com');
    component.password.set('LongEn0ugh!Pass');

    await component.onSubmit();

    expect(authState.signUp).toHaveBeenCalledWith(
      'alex@example.com',
      'LongEn0ugh!Pass',
      'Alex Rivers',
      '',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding'], {
      queryParams: { created: '1' },
    });
  });

  it('email-first signup shows no password field and a check-email screen', async () => {
    authState.requireEmailVerification = () => true;
    fixture.detectChanges();
    component.toggleMode();
    fixture.detectChanges();

    // No password field when verification is required.
    expect(fixture.nativeElement.querySelector('input[name="password"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('verification link');

    component.name.set('Alex Rivers');
    component.email.set('alex@example.com');

    await component.onSubmit();
    fixture.detectChanges();

    // Signup called with a throwaway placeholder (email + 5 letters) and the
    // empty honeypot website value; no auto-login redirect.
    expect(authState.signUp).toHaveBeenCalledWith(
      'alex@example.com',
      jasmine.stringMatching(/^alex@example\.com[a-z]{5}$/),
      'Alex Rivers',
      '',
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Check your email');
  });

  it('email-first signup sends the honeypot website value when a bot fills it', async () => {
    authState.requireEmailVerification = () => true;
    fixture.detectChanges();
    component.toggleMode();

    component.name.set('Bot');
    component.email.set('bot@example.com');
    component.website.set('http://spam.example.com');

    await component.onSubmit();

    expect(authState.signUp).toHaveBeenCalledWith(
      'bot@example.com',
      jasmine.stringMatching(/^bot@example\.com[a-z]{5}$/),
      'Bot',
      'http://spam.example.com',
    );
  });

  it('shows field error for empty name in sign-up mode', () => {
    fixture.detectChanges();
    component.toggleMode();
    component.markTouched('name');

    const error = component.getFieldError('name');
    expect(error).toBe('Name is required');
    expect(component.shouldShowFieldError('name')).toBeTrue();
  });

  it('shows field error for empty email', () => {
    fixture.detectChanges();
    component.email.set('');
    component.emailTouched.set(true);

    expect(component.getFieldError('email')).toBe('Email is required');
    expect(component.shouldShowFieldError('email')).toBeTrue();
  });

  it('shows field error for short password in sign-up mode', () => {
    fixture.detectChanges();
    component.toggleMode();
    component.password.set('short');
    component.passwordTouched.set(true);

    expect(component.getFieldError('password')).toContain('Password must include:');
    expect(component.shouldShowFieldError('password')).toBeTrue();
  });

  it('does not show field error when field is not touched', () => {
    fixture.detectChanges();

    expect(component.shouldShowFieldError('email')).toBeFalse();
    expect(component.shouldShowFieldError('password')).toBeFalse();
  });

  it('returns null for name field in login mode', () => {
    fixture.detectChanges();

    expect(component.getFieldError('name')).toBeNull();
  });

  it('shows authentication error message and clears password', async () => {
    fixture.detectChanges();
    const errorMsg = 'Invalid credentials';
    authState.signIn.and.resolveTo({ error: { message: errorMsg } });

    component.email.set('alex@example.com');
    component.password.set('wrong');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.error()).toBe(errorMsg);
    expect(component.password()).toBe('');
    expect(fixture.nativeElement.textContent).toContain(errorMsg);
  });

  it('handles login lockout with remaining attempts and retry after', async () => {
    fixture.detectChanges();
    authState.signIn.and.resolveTo({
      error: { message: 'Too many attempts', remainingAttempts: 2, retryAfterSeconds: 30 },
    });

    component.email.set('alex@example.com');
    component.password.set('wrong');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.remainingAttempts()).toBe(2);
    expect(component.retryAfterSeconds()).toBe(30);
    expect((component as any).locked()).toBeTrue();
  });

  it('handles unexpected error in onSubmit catch block', async () => {
    fixture.detectChanges();
    authState.signIn.and.rejectWith(new Error('Network failure'));

    component.email.set('alex@example.com');
    component.password.set('secret');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.error()).toBe('Network failure');
    expect(component.loading()).toBeFalse();
  });

  it('clears countdown interval on destroy', () => {
    fixture.detectChanges();
    component.retryAfterSeconds.set(10);
    component['startCountdown']();

    const interval = component['countdownInterval'];
    expect(interval).not.toBeNull();

    component.ngOnDestroy();

    expect(component['countdownInterval']).toBeNull();
  });

  it('resets touched fields when toggling mode', () => {
    fixture.detectChanges();
    component.nameTouched.set(true);
    component.emailTouched.set(true);
    component.passwordTouched.set(true);

    component.toggleMode();

    expect(component.nameTouched()).toBeFalse();
    expect(component.emailTouched()).toBeFalse();
    expect(component.passwordTouched()).toBeFalse();
  });

  it('marks individual fields as touched', () => {
    component.markTouched('name');
    expect(component.nameTouched()).toBeTrue();

    component.markTouched('email');
    expect(component.emailTouched()).toBeTrue();

    component.markTouched('password');
    expect(component.passwordTouched()).toBeTrue();
  });

  it('disables submit button when loading', () => {
    fixture.detectChanges();
    component.loading.set(true);
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button');
    expect(btn.disabled).toBeTrue();
    expect(btn.textContent).toContain('Loading...');
  });

  it('disables submit button when locked', () => {
    fixture.detectChanges();
    component.retryAfterSeconds.set(60);
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button');
    expect(btn.disabled).toBeTrue();
  });

  it('counts down retryAfterSeconds', () => {
    jasmine.clock().install();
    fixture.detectChanges();
    component.retryAfterSeconds.set(5);
    component['startCountdown']();

    jasmine.clock().tick(2000);

    expect(component.retryAfterSeconds()).toBe(3);

    jasmine.clock().tick(3000);

    expect(component.retryAfterSeconds()).toBeNull();
    jasmine.clock().uninstall();
  });

  it('navigates to forgot-password on clicking Forgot password?', () => {
    fixture.detectChanges();

    const forgotBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.link-button');
    forgotBtn.click();

    expect(router.navigate).toHaveBeenCalledWith(['/forgot-password']);
  });
});
