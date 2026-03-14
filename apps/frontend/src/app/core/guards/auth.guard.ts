import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

export const authGuard: CanActivateFn = async () => {
    const router = inject(Router);
    const authState = inject(AuthStateService);

    try {
        await authState.initialize();

        if (authState.isAuthenticated()) {
            return true;
        }
    } catch (error) {
        console.error('Session validation error', error);
        return router.parseUrl('/login');
    }

    return router.parseUrl('/login');
};
