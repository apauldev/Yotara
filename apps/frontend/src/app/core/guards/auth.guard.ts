import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { LogService } from '../services/log.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  try {
    await authState.initialize();

    if (authState.isAuthenticated()) {
      return true;
    }
  } catch (error) {
    inject(LogService).error('Session validation error', error, 'AuthGuard');
    return router.parseUrl('/login');
  }

  return router.parseUrl('/login');
};
