import { Injectable, computed, signal } from '@angular/core';

export type StatusType = 'success' | 'error' | 'info' | 'warning';

export interface StatusAction {
  label: string;
  callback: () => void;
}

export interface StatusOptions {
  action?: StatusAction;
  /**
   * Stable identity for a notification. Showing another toast with the same
   * key replaces the earlier one and cancels its timer.
   */
  key?: string;
}

export interface StatusMessage {
  id: string;
  message: string;
  type: StatusType;
  dismissible?: boolean;
  action?: StatusAction;
  /** Lifetime supplied to `show`, retained for pause/resume bookkeeping. */
  duration: number;
  key?: string;
}

interface StatusTimer {
  handle?: ReturnType<typeof setTimeout>;
  remaining: number;
  startedAt: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class StatusService {
  private readonly _toasts = signal<StatusMessage[]>([]);
  private readonly _loadingCount = signal(0);
  private readonly timers = new Map<string, StatusTimer>();

  /**
   * Currently active toasts.
   */
  readonly toasts = this._toasts.asReadonly();

  /**
   * Whether any background operations are currently in progress.
   */
  readonly isLoading = computed(() => this._loadingCount() > 0);

  /**
   * Display a notification message.
   * @param message The text to display
   * @param type The visual style of the toast
   * @param duration Time in ms before auto-dismissal (set to 0 for manual dismissal only)
   * @param options Optional action and replacement key
   */
  show(
    message: string,
    type: StatusType = 'info',
    duration = 5000,
    options: StatusOptions = {},
  ): string {
    if (options.key) {
      const existing = this._toasts().find((toast) => toast.key === options.key);
      if (existing) {
        this.remove(existing.id);
      }
    }

    const id = Math.random().toString(36).substring(2, 11);
    const toast: StatusMessage = {
      id,
      message,
      type,
      dismissible: true,
      action: options.action,
      duration,
      key: options.key,
    };

    this._toasts.update((current) => [...current, toast]);

    if (duration > 0) {
      this.startTimer(id, duration);
    }

    return id;
  }

  /**
   * Specifically display a success message.
   */
  success(message: string, duration = 4000, options: StatusOptions = {}) {
    return this.show(message, 'success', duration, options);
  }

  /**
   * Specifically display an error message.
   */
  error(message: string, duration = 7000, options: StatusOptions = {}) {
    return this.show(message, 'error', duration, options);
  }

  /**
   * Pause a toast's dismissal timer. Safe to call when no timer exists.
   */
  pause(id: string) {
    const timer = this.timers.get(id);
    if (!timer || timer.startedAt === null) return;

    if (timer.handle) {
      clearTimeout(timer.handle);
    }
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    timer.startedAt = null;
  }

  /**
   * Resume a paused toast's dismissal timer. Safe to call when no timer exists
   * or when the timer is already running.
   */
  resume(id: string) {
    const timer = this.timers.get(id);
    if (!timer || timer.startedAt !== null) return;

    if (timer.remaining <= 0) {
      this.remove(id);
      return;
    }

    this.startTimer(id, timer.remaining, timer);
  }

  /**
   * Remove a toast by its ID.
   */
  remove(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      if (timer.handle) {
        clearTimeout(timer.handle);
      }
      this.timers.delete(id);
    }

    this._toasts.update((current) => current.filter((toast) => toast.id !== id));
  }

  /**
   * Remove every toast and cancel every dismissal timer. Used when the toast
   * host is being torn down.
   */
  clearAll() {
    for (const timer of this.timers.values()) {
      if (timer.handle) {
        clearTimeout(timer.handle);
      }
    }
    this.timers.clear();
    this._toasts.set([]);
  }

  /**
   * Increment the global loading counter.
   */
  startLoading() {
    this._loadingCount.update((count) => count + 1);
  }

  /**
   * Decrement the global loading counter.
   */
  stopLoading() {
    this._loadingCount.update((count) => Math.max(0, count - 1));
  }

  private startTimer(id: string, duration: number, existing?: StatusTimer) {
    const timer: StatusTimer = existing ?? { remaining: duration, startedAt: null };

    timer.remaining = duration;
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => {
      this.timers.delete(id);
      this._toasts.update((current) => current.filter((toast) => toast.id !== id));
    }, duration);
    this.timers.set(id, timer);
  }
}
