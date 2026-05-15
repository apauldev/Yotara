import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { StatusService } from '../services/status.service';
import { LogService } from '../services/log.service';

/**
 * Global error handler for HTTP requests.
 * Catches errors, displays notifications, and logs them for debugging.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const statusService = inject(StatusService);
  const logService = inject(LogService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // Skip 401 as it's handled by AuthRedirectGuard or specialized logic
        if (error.status === 401) {
          return throwError(() => error);
        }

        const message = extractErrorMessage(error);
        statusService.error(message);
        logService.error(message, error, 'HTTP');
      } else {
        logService.error('An unexpected error occurred', error, 'App');
      }

      return throwError(() => error);
    }),
  );
};

/**
 * Extracts a human-readable message from an HTTP error response.
 */
function extractErrorMessage(error: HttpErrorResponse): string {
  // If the backend provided a specific message
  if (error.error?.message) {
    return error.error.message;
  }

  // Handle common status codes
  switch (error.status) {
    case 0:
      return 'Cannot connect to the server. Please check your internet connection.';
    case 400:
      return 'The request was invalid. Please check your input.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 500:
      return 'A server-side error occurred. We have been notified.';
    default:
      return error.statusText || 'An unexpected error occurred.';
  }
}
