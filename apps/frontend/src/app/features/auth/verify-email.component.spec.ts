import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyEmailComponent } from './verify-email.component';
import { AuthStateService } from '../../core/services/auth-state.service';
import { StatusService } from '../../core/services/status.service';
import { ActivatedRoute, Router } from '@angular/router';

describe('VerifyEmailComponent', () => {
  let fixture: ComponentFixture<VerifyEmailComponent>;
  let component: VerifyEmailComponent;
  let router: { navigate: jasmine.Spy };
  let status: { success: jasmine.Spy };
  let authState: {
    verifyEmail: jasmine.Spy;
    setPassword: jasmine.Spy;
  };

  beforeEach(async () => {
    router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    status = { success: jasmine.createSpy('success') };
    authState = {
      verifyEmail: jasmine.createSpy('verifyEmail').and.resolveTo({ error: null }),
      setPassword: jasmine.createSpy('setPassword').and.resolveTo(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: StatusService, useValue: status },
        { provide: AuthStateService, useValue: authState },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: new Map([['token', 'abc123']]) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerifyEmailComponent);
    component = fixture.componentInstance;
  });

  it('verifies the token and shows the set-password step', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(authState.verifyEmail).toHaveBeenCalledWith('abc123');
    expect(component.state()).toBe('set-password');
  });

  it('shows invalid state when the token is missing', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: StatusService, useValue: status },
        { provide: AuthStateService, useValue: authState },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map() } } },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(VerifyEmailComponent);
    f.detectChanges();
    await Promise.resolve();
    f.detectChanges();

    expect(f.componentInstance.state()).toBe('invalid');
    expect(authState.verifyEmail).not.toHaveBeenCalled();
  });

  it('shows invalid state when verification fails', async () => {
    authState.verifyEmail.and.resolveTo({ error: { message: 'expired' } });
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.state()).toBe('invalid');
  });

  it('sets the password and navigates to onboarding with a toast', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    component.newPassword = 'NewPassword123!';
    await component.setPassword();

    expect(authState.setPassword).toHaveBeenCalledWith('NewPassword123!');
    expect(status.success).toHaveBeenCalledWith('Your email is verified.');
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('does not call setPassword when the password is invalid', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    component.newPassword = 'short';
    await component.setPassword();

    expect(authState.setPassword).not.toHaveBeenCalled();
  });
});
