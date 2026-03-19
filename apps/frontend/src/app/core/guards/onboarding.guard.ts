import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

export const onboardingGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const authState = inject(AuthStateService);

  try {
    await authState.initialize();

    if (!authState.isAuthenticated()) {
      return router.parseUrl('/login');
    }

    const needsOnboarding = authState.needsOnboarding();
    const isOnboardingRoute = state.url.startsWith('/onboarding');

    if (needsOnboarding && !isOnboardingRoute) {
      return router.parseUrl('/onboarding');
    }

    if (!needsOnboarding && isOnboardingRoute) {
      return router.parseUrl('/dashboard');
    }

    return true;
  } catch (error) {
    console.error('Onboarding guard validation error', error);
    return router.parseUrl('/login');
  }
};
