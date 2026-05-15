import { Injectable, computed, signal } from '@angular/core';

export type StatusType = 'success' | 'error' | 'info' | 'warning';

export interface StatusMessage {
  id: string;
  message: string;
  type: StatusType;
  dismissible?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StatusService {
  private readonly _toasts = signal<StatusMessage[]>([]);
  private readonly _loadingCount = signal(0);

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
   */
  show(message: string, type: StatusType = 'info', duration = 5000): string {
    const id = Math.random().toString(36).substring(2, 11);
    const toast: StatusMessage = { id, message, type, dismissible: true };

    this._toasts.update((current) => [...current, toast]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }

    return id;
  }

  /**
   * Specifically display a success message.
   */
  success(message: string, duration = 4000) {
    return this.show(message, 'success', duration);
  }

  /**
   * Specifically display an error message.
   */
  error(message: string, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  /**
   * Remove a toast by its ID.
   */
  remove(id: string) {
    this._toasts.update((current) => current.filter((t) => t.id !== id));
  }

  /**
   * Increment the global loading counter.
   */
  startLoading() {
    this._loadingCount.update((c) => c + 1);
  }

  /**
   * Decrement the global loading counter.
   */
  stopLoading() {
    this._loadingCount.update((c) => Math.max(0, c - 1));
  }
}
