import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

const MAX_LOGS = 100;
const STORAGE_KEY = 'yotara_debug_logs';

@Injectable({
  providedIn: 'root',
})
export class LogService {
  private buffer: LogEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Log an error to the console and persistent storage.
   */
  error(message: string, error?: unknown, context?: string) {
    const sanitizedData = this.sanitizeData(error);
    // eslint-disable-next-line no-console
    console.error(`[${context || 'Error'}] ${message}`, sanitizedData);
    this.addToBuffer('error', message, context, error);
  }

  /**
   * Log informational messages.
   */
  info(message: string, data?: unknown, context?: string) {
    const sanitizedData = this.sanitizeData(data);
    console.warn(`[${context || 'Info'}] ${message}`, sanitizedData);
    this.addToBuffer('info', message, context, data);
  }

  /**
   * Log warning messages.
   */
  warn(message: string, data?: unknown, context?: string) {
    const sanitizedData = this.sanitizeData(data);
    console.warn(`[${context || 'Warning'}] ${message}`, sanitizedData);
    this.addToBuffer('warn', message, context, data);
  }

  /**
   * Get all currently stored logs.
   */
  getLogs(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clear all stored logs.
   */
  clearLogs() {
    this.buffer = [];
    this.saveToStorage();
  }

  private addToBuffer(level: LogLevel, message: string, context?: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: this.sanitizeData(data),
    };

    this.buffer.push(entry);

    if (this.buffer.length > MAX_LOGS) {
      this.buffer.shift();
    }

    this.saveToStorage();
  }

  private saveToStorage() {
    if (environment.production) return; // never persist to localStorage in prod
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
    } catch (e) {
      console.warn('Failed to save logs to localStorage', e);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.buffer = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load logs from localStorage', e);
      this.buffer = [];
    }
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

      function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            cleaned[key] = '[REDACTED]';
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            cleaned[key] = redactSensitive(value as Record<string, unknown>);
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
