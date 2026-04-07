import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { loginRedirectGuard } from './core/guards/login-redirect.guard';
import { personalModeMatchGuard, teamModeMatchGuard } from './core/guards/workspace-mode.guard';

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
    path: 'login',
    canActivate: [loginRedirectGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canMatch: [personalModeMatchGuard],
    canActivateChild: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./features/personal/shell/personal-shell.component').then(
        (m) => m.PersonalShellComponent,
      ),
    children: [
      {
        path: 'inbox',
        loadComponent: () =>
          import('./features/personal/pages/inbox-page.component').then(
            (m) => m.InboxPageComponent,
          ),
      },
      {
        path: 'today',
        loadComponent: () =>
          import('./features/personal/pages/today-page.component').then(
            (m) => m.TodayPageComponent,
          ),
      },
      {
        path: 'upcoming',
        loadComponent: () =>
          import('./features/personal/pages/upcoming-page.component').then(
            (m) => m.UpcomingPageComponent,
          ),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/personal/pages/projects-page.component').then(
            (m) => m.ProjectsPageComponent,
          ),
      },
      {
        path: 'labels',
        loadComponent: () =>
          import('./features/personal/pages/labels-page.component').then(
            (m) => m.LabelsPageComponent,
          ),
      },
    ],
  },
  {
    path: '',
    canMatch: [teamModeMatchGuard],
    canActivateChild: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./features/shell/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/tasks/pages/tasks-page/tasks-page.component').then(
            (m) => m.TasksPageComponent,
          ),
      },
    ],
  },
];
