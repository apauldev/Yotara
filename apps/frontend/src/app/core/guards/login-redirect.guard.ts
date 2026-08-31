import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { LogService } from '../services/log.service';

export const loginRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authState = inject(AuthStateService);
  const logService = inject(LogService);

  try {
    // Never block the login screen on session validation. The login component
    // awaits the in-flight initialization and redirects authenticated users
    // once the session lands; awaiting here would put the three auth
    // round-trips on the first-paint critical path.
    if (!authState.initialized()) {
      await authState.initialize();
    }

    if (!authState.isAuthenticated()) {
      return true;
    }

    return router.parseUrl(authState.getPostAuthRedirectUrl());
  } catch (error) {
    logService.error('Login redirect guard validation error', error, 'LoginRedirectGuard');
    return true;
  }
};
