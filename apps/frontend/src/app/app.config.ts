import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideEnvironmentInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMarkdown, SANITIZE } from 'ngx-markdown';
import DOMPurify from 'dompurify';
import { configureAuthClient } from '@yotara/shared';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { apiPrefixInterceptor } from './core/interceptors/api-prefix.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthStateService } from './core/services/auth-state.service';

type E2EWindow = Window & { __YOTARA_E2E_API_URL__?: string };

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideMarkdown(),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiPrefixInterceptor, loadingInterceptor, errorInterceptor]),
    ),
    provideEnvironmentInitializer(() => {
      // Configure the shared auth client's base URL as soon as the environment
      // is available, without blocking bootstrap. This used to be an
      // APP_INITIALIZER that awaited auth initialization — auth requests must
      // no longer gate the first paint of the login screen.
      const apiBaseUrl = (window as E2EWindow).__YOTARA_E2E_API_URL__ ?? environment.apiBaseUrl;
      configureAuthClient(`${apiBaseUrl}/auth`);
    }),
    {
      provide: SANITIZE,
      useValue: (html: string) => DOMPurify.sanitize(html),
    },
  ],
};
