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
    spyOn(AuthService, 'getConfig').and.resolveTo({
      requireEmailVerification: false,
      devMode: false,
    });
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
    spyOn(AuthService, 'getConfig').and.resolveTo({
      requireEmailVerification: false,
      devMode: false,
    });
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    await service.initialize();

    expect(AuthService.getSession).toHaveBeenCalledTimes(1);

    await service.initialize();

    expect(AuthService.getSession).toHaveBeenCalledTimes(1);
  });

  it('starts config and session requests concurrently without serial waiting', async () => {
    let resolveConfig: (value: { requireEmailVerification: boolean; devMode: boolean }) => void;
    let resolveSession: (value: any) => void;
    spyOn(AuthService, 'getConfig').and.callFake(
      () => new Promise((resolve) => (resolveConfig = resolve)),
    );
    spyOn(AuthService, 'getSession').and.callFake(
      () => new Promise((resolve) => (resolveSession = resolve)),
    );
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    const initPromise = service.initialize();

    // Both requests must have started before either resolves — the old
    // implementation waited for config before calling getSession.
    expect(AuthService.getConfig).toHaveBeenCalledTimes(1);
    expect(AuthService.getSession).toHaveBeenCalledTimes(1);

    resolveSession!({ data: { session: null, user: null } });
    resolveConfig!({ requireEmailVerification: true, devMode: true });
    await initPromise;

    expect(service.requireEmailVerification()).toBeTrue();
    expect(service.initialized()).toBeTrue();
  });

  it('coalesces concurrent initialize calls into one config and one session request', async () => {
    let resolveSession: (value: any) => void;
    spyOn(AuthService, 'getConfig').and.resolveTo({
      requireEmailVerification: false,
      devMode: false,
    });
    spyOn(AuthService, 'getSession').and.callFake(
      () => new Promise((resolve) => (resolveSession = resolve)),
    );
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    const first = service.initialize();
    const second = service.initialize();

    resolveSession!({ data: { session: null, user: null } });
    await Promise.all([first, second]);

    expect(AuthService.getConfig).toHaveBeenCalledTimes(1);
    expect(AuthService.getSession).toHaveBeenCalledTimes(1);
    expect(service.initialized()).toBeTrue();
  });

  it('does not resolve second caller before config completes', async () => {
    let resolveSession: (value: any) => void;
    let resolveConfig: (value: { requireEmailVerification: boolean; devMode: boolean }) => void;
    spyOn(AuthService, 'getConfig').and.callFake(
      () => new Promise((resolve) => (resolveConfig = resolve)),
    );
    spyOn(AuthService, 'getSession').and.callFake(
      () => new Promise((resolve) => (resolveSession = resolve)),
    );
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    const first = service.initialize();

    // Resolve session before config
    resolveSession!({ data: { session: null, user: null } });

    // Second caller should not resolve yet — config is still pending
    const second = service.initialize();
    let secondResolved = false;
    second.then(() => (secondResolved = true));

    // Flush microtasks — second should still be pending
    await Promise.resolve();
    expect(secondResolved).toBeFalse();

    // Now resolve config
    resolveConfig!({ requireEmailVerification: true, devMode: false });

    await Promise.all([first, second]);

    expect(service.configLoaded()).toBeTrue();
    expect(service.requireEmailVerification()).toBeTrue();
    expect(service.initialized()).toBeTrue();
  });

  it('sets initialized only after both config and session settle', async () => {
    let resolveSession: (value: any) => void;
    let resolveConfig: (value: { requireEmailVerification: boolean; devMode: boolean }) => void;
    spyOn(AuthService, 'getConfig').and.callFake(
      () => new Promise((resolve) => (resolveConfig = resolve)),
    );
    spyOn(AuthService, 'getSession').and.callFake(
      () => new Promise((resolve) => (resolveSession = resolve)),
    );
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    const initPromise = service.initialize();

    // Resolve session first — initialized should still be false
    resolveSession!({ data: { session: null, user: null } });
    await Promise.resolve();
    expect(service.initialized()).toBeFalse();

    // Resolve config — now initialized should become true
    resolveConfig!({ requireEmailVerification: false, devMode: false });
    await initPromise;

    expect(service.initialized()).toBeTrue();
    expect(service.configLoaded()).toBeTrue();
  });

  it('keeps safe defaults and still initializes the session when config fails', async () => {
    spyOn(TestBed.inject(LogService), 'error');
    spyOn(AuthService, 'getConfig').and.rejectWith(new Error('config down'));
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    await service.initialize();

    expect(service.requireEmailVerification()).toBeTrue();
    expect(service.devMode()).toBeFalse();
    expect(service.configLoaded()).toBeTrue();
    expect(service.initialized()).toBeTrue();
    expect(AuthService.getSession).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(LogService).error).toHaveBeenCalled();
  });

  it('marks configLoaded after config succeeds', async () => {
    spyOn(AuthService, 'getConfig').and.resolveTo({
      requireEmailVerification: true,
      devMode: true,
    });
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    await service.initialize();

    expect(service.configLoaded()).toBeTrue();
  });

  it('exposes the runtime config flags from getConfig', async () => {
    spyOn(AuthService, 'getConfig').and.resolveTo({
      requireEmailVerification: true,
      devMode: true,
    });
    spyOn(AuthService, 'getSession').and.resolveTo({ data: { session: null, user: null } } as any);
    spyOn(AuthService, 'getProfile');

    const service = TestBed.inject(AuthStateService);
    await service.initialize();

    expect(service.requireEmailVerification()).toBeTrue();
    expect(service.devMode()).toBeTrue();
    expect(service.configLoaded()).toBeTrue();
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

  it('does not refresh session when signUp succeeds with requireEmailVerification', async () => {
    spyOn(AuthService, 'signUp').and.resolveTo({ error: null } as any);
    spyOn(AuthService, 'getSession');

    const service = TestBed.inject(AuthStateService);
    // Mimic the runtime config flag
    (service as any).requireEmailVerificationState.set(true);
    const result = await service.signUp('test@example.com', 'placeholder', 'Test User');

    expect(result.error).toBeNull();
    expect(AuthService.getSession).not.toHaveBeenCalled();
    expect(service.loading()).toBeFalse();
  });

  it('delegates sendVerificationEmail to AuthService', async () => {
    spyOn(AuthService, 'sendVerificationEmail').and.resolveTo(undefined as any);

    const service = TestBed.inject(AuthStateService);
    await service.sendVerificationEmail('test@example.com');

    expect(AuthService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('delegates setPassword to AuthService', async () => {
    spyOn(AuthService, 'setPassword').and.resolveTo(undefined);

    const service = TestBed.inject(AuthStateService);
    await service.setPassword('newPass123!');

    expect(AuthService.setPassword).toHaveBeenCalledWith('newPass123!');
    expect(service.loading()).toBeFalse();
  });

  it('sets loading false even when setPassword throws', async () => {
    spyOn(AuthService, 'setPassword').and.rejectWith(new Error('expired token'));

    const service = TestBed.inject(AuthStateService);
    await expectAsync(service.setPassword('newPass123!')).toBeRejected();
    expect(service.loading()).toBeFalse();
  });
});
