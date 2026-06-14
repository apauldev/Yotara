import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { StatusService } from '../services/status.service';

/**
 * Automatically tracks the lifecycle of HTTP requests to manage global loading state.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const statusService = inject(StatusService);

  // Skip loading state for requests that explicitly opt-out (e.g., background polling)
  if (req.headers.get('X-Skip-Loading') === 'true') {
    return next(req);
  }

  const MIN_DISPLAY_MS = 250;
  const startedAt = performance.now();
  statusService.startLoading();

  return next(req).pipe(
    finalize(() => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      if (remaining > 0) {
        setTimeout(() => statusService.stopLoading(), remaining);
      } else {
        statusService.stopLoading();
      }
    }),
  );
};
