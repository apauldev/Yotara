import { routes } from '../../app.routes';
import { loginRedirectGuard } from './login-redirect.guard';

describe('loginRedirectGuard', () => {
  it('allows the login route to render immediately', () => {
    expect(loginRedirectGuard({} as never, {} as never)).toBeTrue();
  });

  it('is attached only to the login route', () => {
    const guardedPaths = routes
      .filter((route) => route.canActivate?.includes(loginRedirectGuard))
      .map((route) => route.path);

    expect(guardedPaths).toEqual(['login']);
    expect(routes.find((route) => route.path === 'forgot-password')?.canActivate).toBeUndefined();
    expect(routes.find((route) => route.path === 'reset-password')?.canActivate).toBeUndefined();
  });
});
