import { Injectable } from '@angular/core';

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
      return {
        ...data,
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }

    try {
      // Circular check / structure check
      return JSON.parse(JSON.stringify(data));
    } catch {
      return '[Unserializable Data]';
    }
  }
}
