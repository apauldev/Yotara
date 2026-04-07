import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

export const loginRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  try {
    await authState.initialize();

    if (!authState.isAuthenticated()) {
      return true;
    }

    return router.parseUrl(authState.getPostAuthRedirectUrl());
  } catch (error) {
    console.error('Login redirect guard validation error', error);
    return true;
  }
};
