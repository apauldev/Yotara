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

  it('clears auth state after deleteAccount succeeds', async () => {
    spyOn(AuthService, 'deleteAccount').and.resolveTo({ ok: true as const });

    const service = TestBed.inject(AuthStateService);

    await service.deleteAccount('password123');

    expect(AuthService.deleteAccount).toHaveBeenCalledWith('password123');
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.initialized()).toBeFalse();
    expect(service.loading()).toBeFalse();
  });

  it('sets loading false even when deleteAccount throws', async () => {
    spyOn(AuthService, 'deleteAccount').and.rejectWith(new Error('invalid password'));

    const service = TestBed.inject(AuthStateService);

    await expectAsync(service.deleteAccount('wrong')).toBeRejected();
    expect(service.loading()).toBeFalse();
  });

  it('delegates getCounts to AuthService', async () => {
    const mockCounts = { tasks: 10, projects: 5, labels: 3 };
    spyOn(AuthService, 'getCounts').and.resolveTo(mockCounts);

    const service = TestBed.inject(AuthStateService);

    const result = await service.getCounts();

    expect(AuthService.getCounts).toHaveBeenCalled();
    expect(result).toEqual(mockCounts);
  });

  it('returns early from initialize when already initialized', async () => {
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    await service.initialize();

    expect(AuthService.getSession).toHaveBeenCalledTimes(1);

    await service.initialize();

    expect(AuthService.getSession).toHaveBeenCalledTimes(1);
  });

  it('delegates signIn to AuthService and refreshes session on success', async () => {
    spyOn(AuthService, 'signIn').and.resolveTo({ error: null } as any);
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);

    const service = TestBed.inject(AuthStateService);
    const result = await service.signIn('test@example.com', 'password');

    expect(AuthService.signIn).toHaveBeenCalledWith('test@example.com', 'password');
    expect(result.error).toBeNull();
    expect(service.loading()).toBeFalse();
  });

  it('does not refresh session when signIn returns an error', async () => {
    spyOn(AuthService, 'signIn').and.resolveTo({
      error: { message: 'Invalid credentials', status: 401, statusText: 'Unauthorized' },
    } as any);
    spyOn(AuthService, 'getSession');

    const service = TestBed.inject(AuthStateService);
    const result = await service.signIn('test@example.com', 'wrong');

    expect(AuthService.signIn).toHaveBeenCalled();
    expect(result.error).toBeTruthy();
    expect(AuthService.getSession).not.toHaveBeenCalled();
    expect(service.loading()).toBeFalse();
  });

  it('delegates signUp to AuthService and refreshes session on success', async () => {
    spyOn(AuthService, 'signUp').and.resolveTo({ error: null } as any);
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);

    const service = TestBed.inject(AuthStateService);
    const result = await service.signUp('test@example.com', 'password', 'Test User');

    expect(AuthService.signUp).toHaveBeenCalledWith(
      'test@example.com',
      'password',
      'Test User',
      '',
    );
    expect(result.error).toBeNull();
    expect(service.loading()).toBeFalse();
  });

  it('does not refresh session when signUp returns an error', async () => {
    spyOn(AuthService, 'signUp').and.resolveTo({
      error: { message: 'Email already in use', status: 409, statusText: 'Conflict' },
    } as any);
    spyOn(AuthService, 'getSession');

    const service = TestBed.inject(AuthStateService);
    const result = await service.signUp('test@example.com', 'password', 'Test User');

    expect(result.error).toBeTruthy();
    expect(AuthService.getSession).not.toHaveBeenCalled();
    expect(service.loading()).toBeFalse();
  });

  it('delegates signOut to AuthService and clears auth state', async () => {
    spyOn(AuthService, 'signOut').and.resolveTo(undefined);
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);

    const service = TestBed.inject(AuthStateService);
    await service.initialize();

    await service.signOut();

    expect(AuthService.signOut).toHaveBeenCalled();
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.initialized()).toBeFalse();
    expect(service.loading()).toBeFalse();
  });

  it('delegates changePassword to AuthService', async () => {
    spyOn(AuthService, 'changePassword').and.resolveTo(undefined);

    const service = TestBed.inject(AuthStateService);
    await service.changePassword('oldPass', 'newPass', false);

    expect(AuthService.changePassword).toHaveBeenCalledWith('oldPass', 'newPass', false);
    expect(service.loading()).toBeFalse();
  });

  it('sets loading false even when changePassword throws', async () => {
    spyOn(AuthService, 'changePassword').and.rejectWith(new Error('weak password'));

    const service = TestBed.inject(AuthStateService);
    await expectAsync(service.changePassword('old', 'weak')).toBeRejected();
    expect(service.loading()).toBeFalse();
  });

  it('delegates updateProfile to AuthService', async () => {
    spyOn(AuthService, 'updateProfile').and.resolveTo({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        onboardingCompleted: true,
        workspaceMode: 'personal',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const service = TestBed.inject(AuthStateService);
    await service.updateProfile({ archiveAutoDelete: false });

    expect(AuthService.updateProfile).toHaveBeenCalledWith({ archiveAutoDelete: false });
    expect(service.user()?.workspaceMode).toBe('personal');
    expect(service.loading()).toBeFalse();
  });

  it('sets loading false even when updateProfile throws', async () => {
    spyOn(AuthService, 'updateProfile').and.rejectWith(new Error('server error'));

    const service = TestBed.inject(AuthStateService);
    await expectAsync(service.updateProfile({ captureBehavior: 'capture' })).toBeRejected();
    expect(service.loading()).toBeFalse();
  });
});
