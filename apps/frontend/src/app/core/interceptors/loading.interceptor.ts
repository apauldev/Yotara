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

  statusService.startLoading();

  return next(req).pipe(finalize(() => statusService.stopLoading()));
};
