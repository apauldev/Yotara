import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Starter interceptor placeholder.
 * Add request URL / header transforms here when needed.
 */
export const apiPrefixInterceptor: HttpInterceptorFn = (req, next) => next(req);
