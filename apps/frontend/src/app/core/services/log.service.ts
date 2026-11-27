import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Console-only logging with sensitive-data redaction. Logs are deliberately
 * not buffered or persisted: nothing in the app reads them back, and keeping
 * a localStorage mirror only risks retaining secrets on shared devices.
 */
@Injectable({
  providedIn: 'root',
})
export class LogService {
  /**
   * Log an error to the console.
   */
  error(message: string, error?: unknown, context?: string) {
    // eslint-disable-next-line no-console
    console.error(`[${context || 'Error'}] ${message}`, this.sanitizeData(error));
  }

  /**
   * Log informational messages.
   */
  info(message: string, data?: unknown, context?: string) {
    // eslint-disable-next-line no-console
    console.info(`[${context || 'Info'}] ${message}`, this.sanitizeData(data));
  }

  /**
   * Log warning messages.
   */
  warn(message: string, data?: unknown, context?: string) {
    console.warn(`[${context || 'Warning'}] ${message}`, this.sanitizeData(data));
  }

  private sanitizeData(data: unknown): unknown {
    if (!data) return undefined;

    if (data instanceof Error) {
      const result: Record<string, unknown> = {
        name: data.name,
        message: data.message,
      };
      // Only include stack in non-production builds
      if (!environment.production) {
        result['stack'] = data.stack;
      }
      return result;
    }

    try {
      // Deep clone + redact sensitive keys
      const SENSITIVE_KEYS = new Set([
        'authorization',
        'cookie',
        'set-cookie',
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'idToken',
        'secret',
        'BETTER_AUTH_SECRET',
        'RESEND_API_KEY',
      ]);

      function redactSensitive(obj: object): Record<string, unknown> {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            cleaned[key] = '[REDACTED]';
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            cleaned[key] = redactSensitive(value);
          } else {
            cleaned[key] = value;
          }
        }
        return cleaned;
      }

      const cloned = JSON.parse(JSON.stringify(data));
      return typeof cloned === 'object' && cloned !== null ? redactSensitive(cloned) : cloned;
    } catch {
      return '[Unserializable Data]';
    }
  }
}
