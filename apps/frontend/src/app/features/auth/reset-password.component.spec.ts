import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthStateService } from '../../core/services/auth-state.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let router: { navigate: jasmine.Spy };
  let authState: { resetPassword: jasmine.Spy };
  let route: { snapshot: { queryParamMap: { get: jasmine.Spy } } };

  function createRoute(token: string | null, error?: string | null) {
    return {
      snapshot: {
        queryParamMap: {
          get: jasmine.createSpy('get').and.callFake((key: string) => {
            if (key === 'token') return token;
            if (key === 'error') return error ?? null;
            return null;
          }),
        },
      },
    };
  }

  beforeEach(async () => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    authState = {
      resetPassword: jasmine.createSpy('resetPassword').and.resolveTo({ error: null }),
    };

    route = createRoute('valid-token-123');
  });

  async function buildComponent() {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authState },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
  }

  it('renders the set new password form with a valid token', async () => {
    await buildComponent();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Set new password');
    expect(fixture.nativeElement.textContent).toContain('Reset password');
    expect(fixture.nativeElement.textContent).toContain('Back to sign in');
  });

  it('shows invalid token state when token is missing with INVALID_TOKEN error', async () => {
    route = createRoute(null, 'INVALID_TOKEN');
    await buildComponent();
    fixture.detectChanges();

    expect(component.invalidToken()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Invalid or expired link');
    expect(fixture.nativeElement.textContent).toContain('Request a new link');
  });

  it('shows error message when token is missing without error param', async () => {
    route = createRoute(null, null);
    await buildComponent();
    component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No reset token found');
  });

  it('shows validation error for empty password', async () => {
    await buildComponent();
    fixture.detectChanges();

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Password is required');
  });

  it('shows validation error for short password', async () => {
    await buildComponent();
    fixture.detectChanges();

    component.newPassword.set('short');
    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Password must be at least 8 characters');
  });

  it('shows validation error when passwords do not match', async () => {
    await buildComponent();
    fixture.detectChanges();

    component.newPassword.set('long-enough-password');
    component.confirmPassword.set('different-password');
    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Passwords do not match');
  });

  it('shows error when token is missing on submit', async () => {
    route = createRoute('');
    await buildComponent();
    fixture.detectChanges();

    component.newPassword.set('long-enough-password');
    component.confirmPassword.set('long-enough-password');
    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Reset token is missing');
  });

  it('calls resetPassword and shows success on valid submission', async () => {
    await buildComponent();
    fixture.detectChanges();

    component.newPassword.set('new-password-123');
    component.confirmPassword.set('new-password-123');
    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.resetPassword).toHaveBeenCalledWith('new-password-123', 'valid-token-123');
    expect(component.resetSuccessful()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Password updated');
  });

  it('shows error when resetPassword returns an error', async () => {
    await buildComponent();
    authState.resetPassword.and.resolveTo({
      error: { message: 'Token expired' },
    });

    fixture.detectChanges();
    component.newPassword.set('new-password-123');
    component.confirmPassword.set('new-password-123');
    await component.onSubmit();
    fixture.detectChanges();

    expect(component.resetSuccessful()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Token expired');
  });

  it('shows generic error when resetPassword throws', async () => {
    await buildComponent();
    authState.resetPassword.and.rejectWith(new Error('network failure'));

    fixture.detectChanges();
    component.newPassword.set('new-password-123');
    component.confirmPassword.set('new-password-123');
    await component.onSubmit();
    fixture.detectChanges();

    expect(component.resetSuccessful()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('link may have expired');
  });

  it('disables submit button while loading', async () => {
    await buildComponent();
    component.loading.set(true);
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button');
    expect(btn.disabled).toBeTrue();
    expect(btn.textContent).toContain('Resetting...');
  });

  it('navigates to login on success button click', async () => {
    await buildComponent();
    component.goToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('navigates to forgot-password on invalid token button click', async () => {
    await buildComponent();
    component.goToForgotPassword();
    expect(router.navigate).toHaveBeenCalledWith(['/forgot-password']);
  });
});
