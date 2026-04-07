import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

function requestedPath(segments: UrlSegment[]) {
  return `/${segments.map((segment) => segment.path).join('/')}`;
}

function shouldDeferToAuthGuards(authState: AuthStateService) {
  return !authState.initialized() || !authState.isAuthenticated() || authState.needsOnboarding();
}

export const personalModeMatchGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  try {
    await authState.initialize();

    if (shouldDeferToAuthGuards(authState)) {
      return true;
    }

    const path = requestedPath(segments);
    const isPersonal = authState.user()?.workspaceMode === 'personal';

    if (isPersonal) {
      return true;
    }

    return path === '/dashboard' ? false : router.parseUrl('/dashboard');
  } catch (error) {
    console.error('Personal mode match guard validation error', error);
    return router.parseUrl('/login');
  }
};

export const teamModeMatchGuard: CanMatchFn = async (_route, _segments) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  try {
    await authState.initialize();

    if (shouldDeferToAuthGuards(authState)) {
      return true;
    }

    const isTeam = authState.user()?.workspaceMode === 'team';

    if (isTeam) {
      return true;
    }

    return router.parseUrl('/inbox');
  } catch (error) {
    console.error('Team mode match guard validation error', error);
    return router.parseUrl('/login');
  }
};
