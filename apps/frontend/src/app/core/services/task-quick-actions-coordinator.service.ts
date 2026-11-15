import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TaskQuickActionsCoordinatorService {
  private readonly activeTaskIdState = signal<string | null>(null);

  /**
   * ID of the task currently displaying its quick action menu, or null if none.
   */
  readonly activeTaskId = this.activeTaskIdState.asReadonly();

  /**
   * Sets the specified task as having the open quick action menu.
   */
  open(taskId: string): void {
    this.activeTaskIdState.set(taskId);
  }

  /**
   * Closes the active menu. If a taskId is provided, it only closes if that task is active.
   */
  close(taskId?: string): void {
    if (!taskId || this.activeTaskIdState() === taskId) {
      this.activeTaskIdState.set(null);
    }
  }

  /**
   * Checks whether the specified task currently has an open menu.
   */
  isOpen(taskId: string): boolean {
    return this.activeTaskIdState() === taskId;
  }
}
