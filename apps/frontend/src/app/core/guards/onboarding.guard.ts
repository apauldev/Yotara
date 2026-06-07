import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { LogService } from '../services/log.service';

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
      return router.parseUrl(authState.getPostAuthRedirectUrl());
    }

    return true;
  } catch (error) {
    inject(LogService).error('Onboarding guard validation error', error, 'OnboardingGuard');
    return router.parseUrl('/login');
  }
};
