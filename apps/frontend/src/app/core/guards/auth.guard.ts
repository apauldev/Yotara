import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@yotara/shared';

export const authGuard: CanActivateFn = async () => {
    const router = inject(Router);

    try {
        const session = await AuthService.getSession();
        if (session?.data?.session) {
            return true;
        }
    } catch (error) {
        console.error('Session validation error', error);
    }

    return router.parseUrl('/login');
};
