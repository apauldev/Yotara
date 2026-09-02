import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AuthService } from '@yotara/shared';
import { Router } from '@angular/router';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let router: { navigate: jasmine.Spy };
  let authState: { forgotPassword: jasmine.Spy; devMode: jasmine.Spy };

  beforeEach(async () => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    authState = {
      forgotPassword: jasmine.createSpy('forgotPassword').and.resolveTo(undefined),
      devMode: jasmine.createSpy('devMode').and.returnValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
  });

  it('renders the forgot password form by default', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reset your password');
    expect(fixture.nativeElement.textContent).toContain('Send reset link');
    expect(fixture.nativeElement.textContent).toContain('Back to sign in');
  });

  it('shows error when submitting with empty email', async () => {
    fixture.detectChanges();

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.forgotPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Email is required');
  });

  it('shows error when submitting with invalid email', async () => {
    fixture.detectChanges();
    component.email.set('not-an-email');

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.forgotPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address');
  });

  it('calls forgotPassword and transitions to confirmation screen', async () => {
    fixture.detectChanges();
    component.email.set('alex@example.com');

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.forgotPassword).toHaveBeenCalledWith('alex@example.com');
    expect(component.emailSent()).toBeTrue();
    expect(component.submittedEmail()).toBe('alex@example.com');
    expect(fixture.nativeElement.textContent).toContain('Check your email');
  });

  it('transitions to confirmation even when forgotPassword throws (no email leak)', async () => {
    fixture.detectChanges();
    authState.forgotPassword.and.rejectWith(new Error('network error'));
    component.email.set('unknown@example.com');

    await component.onSubmit();
    fixture.detectChanges();

    // Should show success even on error — never reveal if the email exists
    expect(component.emailSent()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Check your email');
    expect(fixture.nativeElement.textContent).toContain('unknown@example.com');
  });

  it('goes back to form after clicking send again', () => {
    component.emailSent.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Send again');

    component.backToForm();
    fixture.detectChanges();

    expect(component.emailSent()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Send reset link');
  });

  it('navigates to login on back to sign in', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('disables submit button while loading', () => {
    component.loading.set(true);
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button');
    expect(btn.disabled).toBeTrue();
    expect(btn.textContent).toContain('Sending...');
  });

  it('trims email before submitting', async () => {
    fixture.detectChanges();
    component.email.set('  alex@example.com  ');

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.forgotPassword).toHaveBeenCalledWith('alex@example.com');
  });

  it('shows and follows the dev reset link in dev mode after submitting', async () => {
    authState.devMode.and.returnValue(true);
    const resetUrl = 'http://localhost:4200/reset-password?token=dev-reset-token';
    const getDevResetLinkSpy = spyOn(AuthService, 'getDevResetLink').and.resolveTo(resetUrl);
    fixture.detectChanges();
    component.email.set('alex@example.com');

    await component.onSubmit();
    fixture.detectChanges();

    expect(getDevResetLinkSpy).toHaveBeenCalledWith('alex@example.com');
    expect(component.devResetUrl()).toBe(resetUrl);
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.dev-reset-link');
    expect(link.href).toBe(resetUrl);
    expect(fixture.nativeElement.textContent).toContain('Reset password now');

    component.goToResetWithLink();
    expect(router.navigate).toHaveBeenCalledWith(['/reset-password'], {
      queryParams: { token: 'dev-reset-token' },
    });
  });

  it('does not fetch a dev reset link when the reset request fails', async () => {
    authState.devMode.and.returnValue(true);
    const getDevResetLinkSpy = spyOn(AuthService, 'getDevResetLink');
    authState.forgotPassword.and.rejectWith(new Error('network error'));
    fixture.detectChanges();
    component.email.set('alex@example.com');

    await component.onSubmit();

    expect(getDevResetLinkSpy).not.toHaveBeenCalled();
  });
});
