import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'onboarding',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./features/onboarding/pages/start-screen/start-screen.component').then(
        (m) => m.StartScreenComponent,
      ),
  },
  {
    path: 'preview/picker',
    loadComponent: () =>
      import('./features/onboarding/pages/start-screen/start-screen.component').then(
        (m) => m.StartScreenComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./features/tasks/pages/tasks-page/tasks-page.component').then(
        (m) => m.TasksPageComponent,
      ),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
];
