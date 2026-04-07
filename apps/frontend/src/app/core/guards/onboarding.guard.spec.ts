import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { onboardingGuard } from './onboarding.guard';
import { AuthStateService } from '../services/auth-state.service';

describe('onboardingGuard', () => {
  function createAuthState(workspaceMode: 'personal' | 'team') {
    return {
      initialize: jasmine.createSpy().and.resolveTo(undefined),
      isAuthenticated: jasmine.createSpy().and.returnValue(true),
      needsOnboarding: jasmine.createSpy().and.returnValue(false),
      getPostAuthRedirectUrl: jasmine
        .createSpy()
        .and.returnValue(workspaceMode === 'personal' ? '/inbox' : '/dashboard'),
    };
  }

  it('redirects personal users away from onboarding to inbox once setup is complete', async () => {
    const authState = createAuthState('personal');

    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: authState }],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as never, { url: '/onboarding' } as never),
    );
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/inbox');
  });

  it('redirects team users away from onboarding to dashboard once setup is complete', async () => {
    const authState = createAuthState('team');

    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: authState }],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as never, { url: '/onboarding' } as never),
    );
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});
