import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
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
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const authState = inject(AuthStateService);
        return () => {
          configureAuthClient(`${environment.apiBaseUrl}/auth`);
          return authState.initialize();
        };
      },
    },
    {
      provide: SANITIZE,
      useValue: (html: string) => DOMPurify.sanitize(html),
    },
  ],
};
