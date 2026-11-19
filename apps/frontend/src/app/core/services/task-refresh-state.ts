import { Injectable, signal } from '@angular/core';

/**
 * Shared refresh version counter to coordinate reactive refetches across
 * stores without circular dependency on TaskService.
 */
@Injectable({ providedIn: 'root' })
export class TaskRefreshState {
  private readonly versionState = signal(0);
  readonly version = this.versionState.asReadonly();

  refresh(): void {
    this.versionState.update((v) => v + 1);
  }
}
