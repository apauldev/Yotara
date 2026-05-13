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
        path: 'tasks',
        loadComponent: () =>
          import('./features/personal/pages/task-list-page/task-list-page.component').then(
            (m) => m.TaskListPageComponent,
          ),
      },
      {
        path: 'inbox',
        redirectTo: 'tasks',
        pathMatch: 'full',
      },
      {
        path: 'today',
        redirectTo: 'tasks',
        pathMatch: 'full',
      },
      {
        path: 'upcoming',
        redirectTo: 'tasks',
        pathMatch: 'full',
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/personal/pages/project-detail-page.component').then(
            (m) => m.ProjectDetailPageComponent,
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
      {
        path: 'archive',
        loadComponent: () =>
          import('./features/personal/pages/archive-page.component').then(
            (m) => m.ArchivePageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/personal/pages/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
      {
        path: 'search',
        redirectTo: 'tasks',
        pathMatch: 'full',
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/error/not-found.component').then((m) => m.NotFoundComponent),
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
      {
        path: '**',
        loadComponent: () =>
          import('./features/error/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/error/not-found.component').then((m) => m.NotFoundComponent),
  },
];
