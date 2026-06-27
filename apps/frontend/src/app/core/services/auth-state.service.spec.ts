import { TestBed } from '@angular/core/testing';
import { AuthService } from '@yotara/shared';
import { AuthStateService } from './auth-state.service';
import { LogService } from './log.service';

describe('AuthStateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('falls back to unauthenticated state when initial session refresh fails', async () => {
    spyOn(TestBed.inject(LogService), 'error');
    spyOn(AuthService, 'getSession').and.rejectWith(new Error('network down'));
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);

    await expectAsync(service.initialize()).toBeResolvedTo(null);

    expect(service.initialized()).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(AuthService.getSession).toHaveBeenCalledTimes(1);
    expect(AuthService.getProfile).not.toHaveBeenCalled();
    expect(TestBed.inject(LogService).error).toHaveBeenCalled();
  });

  it('returns the onboarding route for authenticated users who have not completed setup', async () => {
    spyOn(AuthService, 'getSession').and.resolveTo({
      data: {
        session: {
          id: 'session-1',
          userId: 'user-1',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          token: 'token',
        },
        user: {
          id: 'user-1',
          email: 'person@example.com',
          name: 'Person',
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
      },
    } as Awaited<ReturnType<typeof AuthService.getSession>>);
    spyOn(AuthService, 'getProfile').and.resolveTo({
      user: {
        id: 'user-1',
        email: 'person@example.com',
        name: 'Person',
        onboardingCompleted: false,
        workspaceMode: null,
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    });

    const service = TestBed.inject(AuthStateService);

    await service.initialize();

    expect(service.needsOnboarding()).toBeTrue();
    expect(service.getPostAuthRedirectUrl()).toBe('/onboarding');
  });

  it('updates local auth state after onboarding completes', async () => {
    spyOn(AuthService, 'completeOnboarding').and.resolveTo({
      user: {
        id: 'user-1',
        email: 'person@example.com',
        name: 'Person',
        onboardingCompleted: true,
        workspaceMode: 'personal',
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    });

    const service = TestBed.inject(AuthStateService);

    await service.completeOnboarding('personal');

    expect(service.user()?.workspaceMode).toBe('personal');
    expect(service.user()?.onboardingCompleted).toBeTrue();
    expect(service.getPostAuthRedirectUrl()).toBe('/inbox');
  });

  it('returns the team dashboard when onboarding is complete in team mode', async () => {
    spyOn(AuthService, 'completeOnboarding').and.resolveTo({
      user: {
        id: 'user-1',
        email: 'person@example.com',
        name: 'Person',
        onboardingCompleted: true,
        workspaceMode: 'team',
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    });

    const service = TestBed.inject(AuthStateService);

    await service.completeOnboarding('team');

    expect(service.getPostAuthRedirectUrl()).toBe('/dashboard');
  });

  it('delegates forgotPassword to AuthService', async () => {
    spyOn(AuthService, 'forgotPassword').and.resolveTo(undefined);

    const service = TestBed.inject(AuthStateService);

    await service.forgotPassword('alex@example.com');

    expect(AuthService.forgotPassword).toHaveBeenCalledWith('alex@example.com');
    expect(service.loading()).toBeFalse();
  });

  it('sets loading false even when forgotPassword throws', async () => {
    spyOn(AuthService, 'forgotPassword').and.rejectWith(new Error('network error'));

    const service = TestBed.inject(AuthStateService);

    await expectAsync(service.forgotPassword('alex@example.com')).toBeRejected();
    expect(service.loading()).toBeFalse();
  });

  it('delegates resetPassword to AuthService', async () => {
    spyOn(AuthService, 'resetPassword').and.resolveTo(undefined);

    const service = TestBed.inject(AuthStateService);

    await service.resetPassword('newPass123!', 'valid-token');

    expect(AuthService.resetPassword).toHaveBeenCalledWith('newPass123!', 'valid-token');
    expect(service.loading()).toBeFalse();
  });

  it('sets loading false even when resetPassword throws', async () => {
    spyOn(AuthService, 'resetPassword').and.rejectWith(new Error('token expired'));

    const service = TestBed.inject(AuthStateService);

    await expectAsync(service.resetPassword('newPass123!', 'bad-token')).toBeRejected();
    expect(service.loading()).toBeFalse();
  });
});
