import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { loginRedirectGuard } from './login-redirect.guard';

describe('loginRedirectGuard', () => {
  it('allows the login route while authentication is pending', async () => {
    const authState = {
      initialized: jasmine.createSpy().and.returnValue(false),
      isAuthenticated: jasmine.createSpy().and.returnValue(false),
      getPostAuthRedirectUrl: jasmine.createSpy(),
    };

    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: authState }],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      loginRedirectGuard({ routeConfig: { path: 'login' } } as never, { url: '/login' } as never),
    );

    expect(result).toBeTrue();
    expect(authState.isAuthenticated).not.toHaveBeenCalled();
  });

  it('allows the login route after an unauthenticated initialization', async () => {
    const authState = {
      initialized: jasmine.createSpy().and.returnValue(true),
      isAuthenticated: jasmine.createSpy().and.returnValue(false),
      getPostAuthRedirectUrl: jasmine.createSpy(),
    };

    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: authState }],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      loginRedirectGuard({ routeConfig: { path: 'login' } } as never, { url: '/login' } as never),
    );

    expect(result).toBeTrue();
  });

  it('redirects an already authenticated user away from non-login routes', async () => {
    const authState = {
      initialize: jasmine.createSpy().and.resolveTo(undefined),
      initialized: jasmine.createSpy().and.returnValue(true),
      isAuthenticated: jasmine.createSpy().and.returnValue(true),
      getPostAuthRedirectUrl: jasmine.createSpy().and.returnValue('/inbox'),
    };

    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStateService, useValue: authState }],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      loginRedirectGuard(
        { routeConfig: { path: 'forgot-password' } } as never,
        {
          url: '/forgot-password',
        } as never,
      ),
    );
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/inbox');
  });
});
